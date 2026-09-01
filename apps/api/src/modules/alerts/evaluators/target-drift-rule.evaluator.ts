/**
 * TargetDriftRuleEvaluator
 * ────────────────────────
 * Triggers when any asset class allocation drifts outside the user's allowed
 * rebalancing band around the target weight.
 *
 * Condition shape (TargetDriftCondition):
 *   { "tolerancePpt": 5 }   → alert when any drift > ±5 percentage points
 *
 * Algorithm:
 *   For each asset class in targetWeights:
 *     drift_ppt = |currentWeight × 100 - targetWeight × 100|
 *     if drift_ppt > tolerancePpt → trigger
 *
 * If a target weight exists for an asset class that has no current allocation,
 * the current weight is treated as 0 (full underweight).
 *
 * Source fields:
 *   snapshot.targetWeights  — user's IPS target allocation (asset class level)
 *   snapshot.assetWeights   — current portfolio weights (asset id level)
 *
 * NOTE: This evaluator expects targetWeights keys to match assetWeights keys
 * (either assetId or assetClass code). The calling service is responsible for
 * aggregating assetWeights to the same granularity as targetWeights before
 * passing the snapshot.
 */

import { Injectable } from "@nestjs/common";
import { AlertType } from "@prisma/client";
import {
  AlertCondition,
  EvaluationResult,
  IRuleEvaluator,
  PortfolioRiskSnapshot,
  TargetDriftCondition,
} from "../interfaces/alert-evaluator.interface";

interface DriftViolation {
  identifier: string;
  currentWeightPct: number;
  targetWeightPct: number;
  driftPpt: number;
  tolerancePpt: number;
  direction: "overweight" | "underweight";
}

@Injectable()
export class TargetDriftRuleEvaluator implements IRuleEvaluator {
  readonly alertType = AlertType.PORTFOLIO_REBALANCE;

  evaluate(snapshot: PortfolioRiskSnapshot, condition: AlertCondition): EvaluationResult {
    const { tolerancePpt } = condition as TargetDriftCondition;

    if (!snapshot.targetWeights || Object.keys(snapshot.targetWeights).length === 0) {
      return {
        triggered: false,
        triggeredValues: {
          message: "No target weights configured; skipping drift evaluation",
          portfolioId: snapshot.portfolioId,
          snapshotAt: snapshot.snapshotAt.toISOString(),
        },
      };
    }

    const violations: DriftViolation[] = [];

    for (const [identifier, targetWeight] of Object.entries(snapshot.targetWeights)) {
      const currentWeight = snapshot.assetWeights[identifier] ?? 0;
      const targetWeightPct = targetWeight * 100;
      const currentWeightPct = currentWeight * 100;
      const driftPpt = Math.abs(currentWeightPct - targetWeightPct);

      if (driftPpt > tolerancePpt) {
        violations.push({
          identifier,
          currentWeightPct: parseFloat(currentWeightPct.toFixed(4)),
          targetWeightPct: parseFloat(targetWeightPct.toFixed(4)),
          driftPpt: parseFloat(driftPpt.toFixed(4)),
          tolerancePpt,
          direction: currentWeightPct > targetWeightPct ? "overweight" : "underweight",
        });
      }
    }

    if (violations.length === 0) {
      return {
        triggered: false,
        triggeredValues: {
          violations: [],
          tolerancePpt,
          portfolioId: snapshot.portfolioId,
          snapshotAt: snapshot.snapshotAt.toISOString(),
        },
      };
    }

    // Report worst offender
    const worst = violations.reduce((a, b) => (a.driftPpt > b.driftPpt ? a : b));

    return {
      triggered: true,
      violationMessage:
        `"${worst.identifier}" is ${worst.direction} by ${worst.driftPpt.toFixed(2)}pp ` +
        `(current ${worst.currentWeightPct.toFixed(2)}%, target ${worst.targetWeightPct.toFixed(2)}%, ` +
        `tolerance ±${tolerancePpt}pp). ` +
        `${violations.length} asset class${violations.length > 1 ? "es" : ""} require rebalancing.`,
      triggeredValues: {
        violations,
        totalViolations: violations.length,
        tolerancePpt,
        portfolioId: snapshot.portfolioId,
        snapshotAt: snapshot.snapshotAt.toISOString(),
      },
    };
  }
}
