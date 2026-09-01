/**
 * ConcentrationRuleEvaluator
 * ──────────────────────────
 * Triggers when any single asset weight OR any single sector weight exceeds
 * the user's configured maximum allowed weight.
 *
 * Condition shape (ConcentrationCondition):
 *   { "maxAssetWeightPct": 20, "maxSectorWeightPct": 40 }
 *
 * Algorithm:
 *   For each asset: (weight × 100) > maxAssetWeightPct → trigger
 *   For each sector: (weight × 100) > maxSectorWeightPct → trigger
 *
 * Violation is reported for the MOST concentrated offender (highest excess).
 * All offenders are captured in triggeredValues for downstream display.
 */

import { Injectable } from "@nestjs/common";
import { AlertType } from "@prisma/client";
import {
  AlertCondition,
  ConcentrationCondition,
  EvaluationResult,
  IRuleEvaluator,
  PortfolioRiskSnapshot,
} from "../interfaces/alert-evaluator.interface";

interface ConcentrationViolation {
  identifier: string;
  type: "asset" | "sector";
  weightPct: number;
  thresholdPct: number;
  excessPpt: number;
}

@Injectable()
export class ConcentrationRuleEvaluator implements IRuleEvaluator {
  readonly alertType = AlertType.PORTFOLIO_REBALANCE;

  evaluate(snapshot: PortfolioRiskSnapshot, condition: AlertCondition): EvaluationResult {
    const { maxAssetWeightPct, maxSectorWeightPct } = condition as ConcentrationCondition;
    const violations: ConcentrationViolation[] = [];

    // ── Asset-level concentration check ──────────────────────────────────────
    if (maxAssetWeightPct !== undefined) {
      for (const [assetId, weight] of Object.entries(snapshot.assetWeights)) {
        const weightPct = weight * 100;
        if (weightPct > maxAssetWeightPct) {
          const symbol = snapshot.assetSymbols?.[assetId] ?? assetId;
          violations.push({
            identifier: symbol,
            type: "asset",
            weightPct: parseFloat(weightPct.toFixed(4)),
            thresholdPct: maxAssetWeightPct,
            excessPpt: parseFloat((weightPct - maxAssetWeightPct).toFixed(4)),
          });
        }
      }
    }

    // ── Sector-level concentration check ────────────────────────────────────
    if (maxSectorWeightPct !== undefined && snapshot.sectorWeights) {
      for (const [sector, weight] of Object.entries(snapshot.sectorWeights)) {
        const weightPct = weight * 100;
        if (weightPct > maxSectorWeightPct) {
          violations.push({
            identifier: sector,
            type: "sector",
            weightPct: parseFloat(weightPct.toFixed(4)),
            thresholdPct: maxSectorWeightPct,
            excessPpt: parseFloat((weightPct - maxSectorWeightPct).toFixed(4)),
          });
        }
      }
    }

    if (violations.length === 0) {
      return {
        triggered: false,
        triggeredValues: {
          violations: [],
          portfolioId: snapshot.portfolioId,
          snapshotAt: snapshot.snapshotAt.toISOString(),
        },
      };
    }

    // Report the worst offender in the human-readable message
    const worst = violations.reduce((a, b) => (a.excessPpt > b.excessPpt ? a : b));

    return {
      triggered: true,
      violationMessage:
        `${worst.type === "asset" ? "Asset" : "Sector"} "${worst.identifier}" ` +
        `weight ${worst.weightPct.toFixed(2)}% exceeds ${worst.type} limit of ` +
        `${worst.thresholdPct}% by ${worst.excessPpt.toFixed(2)}pp ` +
        `(${violations.length} violation${violations.length > 1 ? "s" : ""} total)`,
      triggeredValues: {
        violations,
        totalViolations: violations.length,
        portfolioId: snapshot.portfolioId,
        snapshotAt: snapshot.snapshotAt.toISOString(),
      },
    };
  }
}
