/**
 * AlertEvaluatorEngine
 * ─────────────────────
 * Central orchestrator for the rule-evaluation pipeline.
 *
 * Responsibilities:
 *   1. Maintain a registry of IRuleEvaluator instances, keyed by AlertType.
 *   2. Enforce cool-down / throttle: skip evaluation if the rule fired within
 *      its cooldownDurationMinutes window (prevents notification fatigue).
 *   3. Persist AlertLog records via PrismaService when rules trigger.
 *   4. Update AlertRule.lastTriggeredAt on successful trigger.
 *
 * Cool-down Logic:
 *   A rule is suppressed if:
 *     now() - lastTriggeredAt < cooldownDurationMinutes
 *   This check is performed IN-PROCESS (no Redis needed) because the
 *   lastTriggeredAt column is always up-to-date from the previous trigger write.
 *
 * Usage (called by a scheduled job or from AlertService.evaluatePortfolio):
 *   await engine.evaluateAll(snapshot, activeRules);
 */

import { Injectable, Logger } from "@nestjs/common";
import { AlertType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ConcentrationRuleEvaluator } from "./evaluators/concentration-rule.evaluator";
import { DrawdownRuleEvaluator } from "./evaluators/drawdown-rule.evaluator";
import { TargetDriftRuleEvaluator } from "./evaluators/target-drift-rule.evaluator";
import { VolatilityRuleEvaluator } from "./evaluators/volatility-rule.evaluator";
import {
  AlertCondition,
  IRuleEvaluator,
  PortfolioRiskSnapshot,
} from "./interfaces/alert-evaluator.interface";

/**
 * Minimal AlertRule shape required by the engine.
 * Matches the Prisma AlertRule model (subset of fields).
 */
export interface AlertRuleRecord {
  id: string;
  userId: string;
  name: string;
  alertType: AlertType;
  condition: unknown;
  cooldownDurationMinutes: number;
  isActive: boolean;
  lastTriggeredAt: Date | null;
}

/**
 * Summary of a single rule evaluation pass.
 */
export interface RuleEvaluationSummary {
  ruleId: string;
  ruleName: string;
  alertType: AlertType;
  evaluated: boolean;
  suppressed: boolean;
  triggered: boolean;
  logId?: string;
  violationMessage?: string;
}

@Injectable()
export class AlertEvaluatorEngine {
  private readonly logger = new Logger(AlertEvaluatorEngine.name);

  /** Registry: AlertType → evaluator instance. */
  private readonly evaluators: Map<AlertType, IRuleEvaluator>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly drawdownEvaluator: DrawdownRuleEvaluator,
    private readonly concentrationEvaluator: ConcentrationRuleEvaluator,
    private readonly volatilityEvaluator: VolatilityRuleEvaluator,
    private readonly targetDriftEvaluator: TargetDriftRuleEvaluator,
  ) {
    this.evaluators = new Map<AlertType, IRuleEvaluator>([
      [AlertType.DRAWDOWN_LIMIT, this.drawdownEvaluator],
      // Concentration and TargetDrift both map to PORTFOLIO_REBALANCE in the schema.
      // The engine distinguishes them via the condition payload shape.
      // We register concentration under PORTFOLIO_REBALANCE; drift is handled
      // as a fallback evaluator inspected by condition key presence.
      [AlertType.PORTFOLIO_REBALANCE, this.concentrationEvaluator],
      [AlertType.RISK_SCORE_SPIKE, this.volatilityEvaluator],
    ]);
  }

  // ── Cool-down check ───────────────────────────────────────────────────────

  /**
   * Returns true if the rule is within its cooldown window and should be
   * suppressed (i.e. NOT evaluated / fired again).
   */
  private isInCooldown(rule: AlertRuleRecord): boolean {
    if (!rule.lastTriggeredAt) return false;

    const cooldownMs = rule.cooldownDurationMinutes * 60 * 1000;
    const elapsedMs = Date.now() - rule.lastTriggeredAt.getTime();
    return elapsedMs < cooldownMs;
  }

  // ── Evaluator resolution ─────────────────────────────────────────────────

  /**
   * Resolves the correct evaluator for a rule.
   * For PORTFOLIO_REBALANCE rules we inspect the condition to decide whether
   * to use ConcentrationRuleEvaluator or TargetDriftRuleEvaluator.
   */
  private resolveEvaluator(rule: AlertRuleRecord): IRuleEvaluator | null {
    if (rule.alertType === AlertType.PORTFOLIO_REBALANCE) {
      const cond = rule.condition as Record<string, unknown>;
      // TargetDrift condition has "tolerancePpt"; Concentration has "maxAssetWeightPct"/"maxSectorWeightPct"
      if ("tolerancePpt" in cond) {
        return this.targetDriftEvaluator;
      }
      return this.concentrationEvaluator;
    }

    return this.evaluators.get(rule.alertType) ?? null;
  }

  // ── Core evaluation pipeline ──────────────────────────────────────────────

  /**
   * Evaluates a single rule against the provided portfolio snapshot.
   * Handles cooldown suppression, evaluation, persistence, and summary.
   */
  async evaluateRule(
    snapshot: PortfolioRiskSnapshot,
    rule: AlertRuleRecord,
  ): Promise<RuleEvaluationSummary> {
    const base: Omit<RuleEvaluationSummary, "evaluated" | "suppressed" | "triggered"> = {
      ruleId: rule.id,
      ruleName: rule.name,
      alertType: rule.alertType,
    };

    // ── Cooldown suppression ─────────────────────────────────────────────────
    if (this.isInCooldown(rule)) {
      const remaining =
        rule.cooldownDurationMinutes -
        Math.floor((Date.now() - rule.lastTriggeredAt!.getTime()) / 60_000);
      this.logger.debug(
        `Rule "${rule.name}" [${rule.id}] suppressed — cooldown active (${remaining}m remaining)`,
      );
      return { ...base, evaluated: false, suppressed: true, triggered: false };
    }

    // ── Evaluator resolution ─────────────────────────────────────────────────
    const evaluator = this.resolveEvaluator(rule);
    if (!evaluator) {
      this.logger.warn(
        `No evaluator registered for AlertType "${rule.alertType}" (rule: ${rule.id})`,
      );
      return { ...base, evaluated: false, suppressed: false, triggered: false };
    }

    // ── Evaluation ───────────────────────────────────────────────────────────
    let result;
    try {
      result = evaluator.evaluate(snapshot, rule.condition as AlertCondition);
    } catch (err) {
      this.logger.error(
        `Evaluator "${evaluator.constructor.name}" threw for rule "${rule.name}": ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { ...base, evaluated: true, suppressed: false, triggered: false };
    }

    if (!result.triggered) {
      return { ...base, evaluated: true, suppressed: false, triggered: false };
    }

    // ── Persist AlertLog + update lastTriggeredAt ────────────────────────────
    const now = new Date();
    let logId: string | undefined;

    try {
      const [log] = await this.prisma.$transaction([
        this.prisma.alertLog.create({
          data: {
            alertRuleId: rule.id,
            triggeredAt: now,
            triggeredValues: result.triggeredValues,
            deliveryStatus: "PENDING",
          },
        }),
        this.prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: now },
        }),
      ]);
      logId = log.id;
      this.logger.log(
        `Alert fired: rule="${rule.name}" [${rule.id}] → log=${logId} | ${result.violationMessage}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to persist AlertLog for rule "${rule.name}": ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return {
      ...base,
      evaluated: true,
      suppressed: false,
      triggered: true,
      logId,
      violationMessage: result.violationMessage,
    };
  }

  /**
   * Evaluates ALL provided alert rules against the snapshot in sequence.
   * Returns one summary per rule.
   *
   * @param snapshot  Normalised portfolio risk snapshot.
   * @param rules     Active alert rules for this portfolio's user.
   */
  async evaluateAll(
    snapshot: PortfolioRiskSnapshot,
    rules: AlertRuleRecord[],
  ): Promise<RuleEvaluationSummary[]> {
    const summaries: RuleEvaluationSummary[] = [];

    for (const rule of rules) {
      if (!rule.isActive) continue;
      const summary = await this.evaluateRule(snapshot, rule);
      summaries.push(summary);
    }

    const fired = summaries.filter((s) => s.triggered).length;
    const suppressed = summaries.filter((s) => s.suppressed).length;
    this.logger.log(
      `evaluateAll complete: ${rules.length} rules, ${fired} fired, ${suppressed} suppressed ` +
        `[portfolio: ${snapshot.portfolioId}]`,
    );

    return summaries;
  }
}
