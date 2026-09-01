/**
 * AlertService
 * ─────────────
 * Domain service for the Alert module. Provides:
 *
 *   CRUD operations on AlertRule (scoped to the authenticated user)
 *   AlertLog history retrieval (scoped to the rule owner)
 *   Manual evaluation trigger (for testing and on-demand checks)
 *   Cooldown query (so the controller can surface remaining suppression time)
 *
 * Architecture note:
 *   This service intentionally does NOT import the NestJS EventEmitter or any
 *   notification transport. Alert delivery (email, push, SMS) is decoupled and
 *   handled by a dedicated NotificationService (Step 18). This service only
 *   writes AlertLog records with deliveryStatus=PENDING; a separate delivery
 *   worker picks them up.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AlertType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AlertEvaluatorEngine, AlertRuleRecord } from "./alert-evaluator.engine";
import { PortfolioRiskSnapshot } from "./interfaces/alert-evaluator.interface";
import {
  AlertLogResponseDto,
  AlertRuleResponseDto,
  CreateAlertRuleDto,
  EvaluateAlertDto,
  UpdateAlertRuleDto,
} from "./dto/alert.dto";

/** Allowed AlertTypes that the evaluator engine can actually process. */
const EVALUABLE_ALERT_TYPES = new Set<AlertType>([
  AlertType.DRAWDOWN_LIMIT,
  AlertType.PORTFOLIO_REBALANCE,
  AlertType.RISK_SCORE_SPIKE,
]);

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AlertEvaluatorEngine,
  ) {}

  // ── Alert Rule CRUD ───────────────────────────────────────────────────────

  /**
   * Creates a new alert rule for the authenticated user.
   */
  async createAlertRule(userId: string, dto: CreateAlertRuleDto): Promise<AlertRuleResponseDto> {
    this.validateConditionShape(dto.alertType, dto.condition);

    const rule = await this.prisma.alertRule.create({
      data: {
        userId,
        name: dto.name.trim(),
        alertType: dto.alertType,
        condition: dto.condition as unknown as Prisma.InputJsonValue,
        channels: dto.channels as unknown as Prisma.InputJsonValue,
        cooldownDurationMinutes: dto.cooldownDurationMinutes ?? 60,
        isActive: dto.isActive ?? true,
      },
      include: { _count: { select: { instances: true } } },
    });

    this.logger.log(`AlertRule created: "${rule.name}" [${rule.id}] for user ${userId}`);
    return AlertRuleResponseDto.fromPrisma(rule);
  }

  /**
   * Returns all alert rules belonging to the authenticated user.
   */
  async getUserAlertRules(userId: string): Promise<AlertRuleResponseDto[]> {
    const rules = await this.prisma.alertRule.findMany({
      where: { userId, deletedAt: null },
      include: { _count: { select: { instances: true } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return rules.map(AlertRuleResponseDto.fromPrisma);
  }

  /**
   * Returns a single alert rule (must belong to authenticated user).
   */
  async getAlertRuleById(userId: string, ruleId: string): Promise<AlertRuleResponseDto> {
    const rule = await this.findRuleOrThrow(userId, ruleId);
    return AlertRuleResponseDto.fromPrisma(rule);
  }

  /**
   * Partially updates an alert rule.
   */
  async updateAlertRule(
    userId: string,
    ruleId: string,
    dto: UpdateAlertRuleDto,
  ): Promise<AlertRuleResponseDto> {
    const rule = await this.findRuleOrThrow(userId, ruleId);

    if (dto.condition) {
      this.validateConditionShape(rule.alertType, dto.condition);
    }

    const updated = await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        condition: dto.condition as unknown as Prisma.InputJsonValue | undefined,
        channels: dto.channels as unknown as Prisma.InputJsonValue | undefined,
        cooldownDurationMinutes: dto.cooldownDurationMinutes,
        isActive: dto.isActive,
      },
      include: { _count: { select: { instances: true } } },
    });

    this.logger.log(`AlertRule updated: "${updated.name}" [${ruleId}]`);
    return AlertRuleResponseDto.fromPrisma(updated);
  }

  /**
   * Soft-deletes an alert rule.
   */
  async deleteAlertRule(userId: string, ruleId: string): Promise<{ message: string }> {
    const rule = await this.findRuleOrThrow(userId, ruleId);

    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`AlertRule deleted: "${rule.name}" [${ruleId}] for user ${userId}`);
    return { message: `Alert rule "${rule.name}" deleted successfully` };
  }

  // ── Alert Log History ─────────────────────────────────────────────────────

  /**
   * Returns the trigger history for a given alert rule.
   *
   * @param userId   Requesting user — must own the rule.
   * @param ruleId   Alert rule ID.
   * @param limit    Page size (default 50, max 200).
   * @param offset   Pagination offset (default 0).
   */
  async getAlertHistory(
    userId: string,
    ruleId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ total: number; logs: AlertLogResponseDto[] }> {
    // Verify ownership
    await this.findRuleOrThrow(userId, ruleId);

    const safeLimit = Math.min(limit, 200);

    const [total, logs] = await Promise.all([
      this.prisma.alertLog.count({ where: { alertRuleId: ruleId } }),
      this.prisma.alertLog.findMany({
        where: { alertRuleId: ruleId },
        include: { alertRule: { select: { name: true, alertType: true } } },
        orderBy: { triggeredAt: "desc" },
        take: safeLimit,
        skip: offset,
      }),
    ]);

    return {
      total,
      logs: logs.map(AlertLogResponseDto.fromPrisma),
    };
  }

  /**
   * Returns alert history across ALL rules for the authenticated user.
   * Useful for the notification inbox / activity feed.
   */
  async getUserAlertHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ total: number; logs: AlertLogResponseDto[] }> {
    const safeLimit = Math.min(limit, 200);

    const [total, logs] = await Promise.all([
      this.prisma.alertLog.count({
        where: { alertRule: { userId, deletedAt: null } },
      }),
      this.prisma.alertLog.findMany({
        where: { alertRule: { userId, deletedAt: null } },
        include: { alertRule: { select: { name: true, alertType: true } } },
        orderBy: { triggeredAt: "desc" },
        take: safeLimit,
        skip: offset,
      }),
    ]);

    return {
      total,
      logs: logs.map(AlertLogResponseDto.fromPrisma),
    };
  }

  // ── Manual Evaluation Trigger ─────────────────────────────────────────────

  /**
   * On-demand evaluation: builds a snapshot from the latest DB snapshots and
   * runs it through the evaluator engine. Primarily for testing and debugging.
   *
   * @param userId  Requesting user — must own the portfolio.
   * @param dto     EvaluateAlertDto specifying portfolioId and optional ruleIds.
   */
  async evaluatePortfolio(userId: string, dto: EvaluateAlertDto) {
    // ── 1. Fetch latest risk snapshot ────────────────────────────────────────
    const riskSnapshot = await this.prisma.riskMetricSnapshot.findFirst({
      where: { portfolio: { userId, id: dto.portfolioId } },
      orderBy: { computedAt: "desc" },
    });

    if (!riskSnapshot) {
      throw new NotFoundException(
        `No risk metric snapshot found for portfolio ${dto.portfolioId}. ` +
          "Run risk computation first.",
      );
    }

    // ── 2. Fetch latest portfolio snapshot ───────────────────────────────────
    const portfolioSnapshot = await this.prisma.portfolioSnapshot.findFirst({
      where: { portfolio: { userId, id: dto.portfolioId } },
      orderBy: { snapshotDate: "desc" },
    });

    if (!portfolioSnapshot) {
      throw new NotFoundException(`No portfolio snapshot found for portfolio ${dto.portfolioId}.`);
    }

    // ── 3. Fetch active holdings for weight map ──────────────────────────────
    const holdings = await this.prisma.holding.findMany({
      where: { portfolioId: dto.portfolioId, deletedAt: null },
      select: {
        assetId: true,
        currentValue: true,
        asset: { select: { symbol: true } },
      },
    });

    const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.currentValue.toString()), 0);

    const assetWeights: Record<string, number> = {};
    const assetSymbols: Record<string, string> = {};

    for (const h of holdings) {
      const weight = totalValue > 0 ? parseFloat(h.currentValue.toString()) / totalValue : 0;
      assetWeights[h.assetId] = weight;
      assetSymbols[h.assetId] = h.asset.symbol;
    }

    // ── 4. Build normalised snapshot ─────────────────────────────────────────
    const snapshot: PortfolioRiskSnapshot = {
      portfolioId: dto.portfolioId,
      volatilityAnnual: parseFloat(riskSnapshot.volatilityAnnual.toString()),
      maxDrawdownPct: parseFloat(riskSnapshot.maxDrawdown.toString()),
      totalValue,
      assetWeights,
      assetSymbols,
      sectorWeights: undefined, // populated in future when sector data is available
      targetWeights: undefined, // populated from UserPreferences.notificationSettings if set
      snapshotAt: riskSnapshot.computedAt,
    };

    // ── 5. Fetch applicable alert rules ─────────────────────────────────────
    const rulesQuery = await this.prisma.alertRule.findMany({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
        ...(dto.ruleIds?.length ? { id: { in: dto.ruleIds } } : {}),
      },
    });

    const rules: AlertRuleRecord[] = rulesQuery.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      alertType: r.alertType,
      condition: r.condition,
      cooldownDurationMinutes: r.cooldownDurationMinutes,
      isActive: r.isActive,
      lastTriggeredAt: r.lastTriggeredAt,
    }));

    // ── 6. Evaluate ───────────────────────────────────────────────────────────
    const summaries = await this.engine.evaluateAll(snapshot, rules);

    return {
      portfolioId: dto.portfolioId,
      evaluatedAt: new Date(),
      riskSnapshotId: riskSnapshot.id,
      rulesEvaluated: summaries.filter((s) => s.evaluated).length,
      rulesSuppressed: summaries.filter((s) => s.suppressed).length,
      rulesTriggered: summaries.filter((s) => s.triggered).length,
      results: summaries,
    };
  }

  // ── Cooldown Status ───────────────────────────────────────────────────────

  /**
   * Returns the current cooldown status for a specific alert rule.
   * Useful for the UI to show "next check in X minutes".
   */
  async getCooldownStatus(
    userId: string,
    ruleId: string,
  ): Promise<{
    inCooldown: boolean;
    remainingMinutes: number | null;
    lastTriggeredAt: Date | null;
  }> {
    const rule = await this.findRuleOrThrow(userId, ruleId);

    if (!rule.lastTriggeredAt) {
      return { inCooldown: false, remainingMinutes: null, lastTriggeredAt: null };
    }

    const cooldownMs = rule.cooldownDurationMinutes * 60_000;
    const elapsedMs = Date.now() - rule.lastTriggeredAt.getTime();
    const inCooldown = elapsedMs < cooldownMs;
    const remainingMinutes = inCooldown ? Math.ceil((cooldownMs - elapsedMs) / 60_000) : null;

    return { inCooldown, remainingMinutes, lastTriggeredAt: rule.lastTriggeredAt };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Fetches an alert rule, asserting it belongs to the given userId.
   * Throws NotFoundException if not found; ForbiddenException if ownership
   * mismatch (prevents rule ID enumeration attacks).
   */
  private async findRuleOrThrow(userId: string, ruleId: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, deletedAt: null },
      include: { _count: { select: { instances: true } } },
    });

    if (!rule) {
      throw new NotFoundException(`Alert rule ${ruleId} not found`);
    }

    if (rule.userId !== userId) {
      throw new ForbiddenException("You do not have access to this alert rule");
    }

    return rule;
  }

  /**
   * Validates that the provided condition object contains the required keys
   * for the given AlertType. Provides actionable error messages.
   */
  private validateConditionShape(alertType: AlertType, condition: Record<string, unknown>): void {
    switch (alertType) {
      case AlertType.DRAWDOWN_LIMIT:
      case AlertType.RISK_SCORE_SPIKE: {
        if (typeof condition["thresholdPct"] !== "number") {
          throw new BadRequestException(
            `condition.thresholdPct (number) is required for alertType "${alertType}"`,
          );
        }
        if (condition["thresholdPct"] <= 0 || condition["thresholdPct"] > 100) {
          throw new BadRequestException("condition.thresholdPct must be between 0 and 100");
        }
        break;
      }

      case AlertType.PORTFOLIO_REBALANCE: {
        const hasTolerance = "tolerancePpt" in condition;
        const hasAssetLimit = "maxAssetWeightPct" in condition;
        const hasSectorLimit = "maxSectorWeightPct" in condition;

        if (!hasTolerance && !hasAssetLimit && !hasSectorLimit) {
          throw new BadRequestException(
            "PORTFOLIO_REBALANCE condition must contain at least one of: " +
              "tolerancePpt, maxAssetWeightPct, maxSectorWeightPct",
          );
        }

        if (hasTolerance && typeof condition["tolerancePpt"] !== "number") {
          throw new BadRequestException("condition.tolerancePpt must be a number");
        }
        if (hasAssetLimit && typeof condition["maxAssetWeightPct"] !== "number") {
          throw new BadRequestException("condition.maxAssetWeightPct must be a number");
        }
        if (hasSectorLimit && typeof condition["maxSectorWeightPct"] !== "number") {
          throw new BadRequestException("condition.maxSectorWeightPct must be a number");
        }
        break;
      }

      case AlertType.PRICE_THRESHOLD:
      case AlertType.FD_MATURITY:
      case AlertType.SYNC_FAILURE:
        // These are handled by future specialized services; minimal validation here
        break;

      default:
        throw new BadRequestException(`Unsupported alertType: ${alertType as string}`);
    }
  }
}
