/**
 * VolatilityRuleEvaluator
 * ───────────────────────
 * Triggers when the portfolio's annualised volatility exceeds the user's
 * configured threshold.
 *
 * Condition shape (VolatilityCondition):
 *   { "thresholdPct": 25 }   → alert when annualised vol > 25%
 *
 * Algorithm:
 *   volatilityAnnual (fraction) × 100 > thresholdPct
 *
 * Source field: RiskMetricSnapshot.volatilityAnnual.
 */

import { Injectable } from "@nestjs/common";
import { AlertType } from "@prisma/client";
import {
  AlertCondition,
  EvaluationResult,
  IRuleEvaluator,
  PortfolioRiskSnapshot,
  VolatilityCondition,
} from "../interfaces/alert-evaluator.interface";

@Injectable()
export class VolatilityRuleEvaluator implements IRuleEvaluator {
  readonly alertType = AlertType.RISK_SCORE_SPIKE;

  evaluate(snapshot: PortfolioRiskSnapshot, condition: AlertCondition): EvaluationResult {
    const { thresholdPct } = condition as VolatilityCondition;
    const currentVolPct = snapshot.volatilityAnnual * 100;
    const triggered = currentVolPct > thresholdPct;

    return {
      triggered,
      violationMessage: triggered
        ? `Annualised portfolio volatility ${currentVolPct.toFixed(2)}% exceeds threshold of ${thresholdPct}%`
        : undefined,
      triggeredValues: {
        currentVolatilityPct: parseFloat(currentVolPct.toFixed(4)),
        thresholdPct,
        portfolioId: snapshot.portfolioId,
        snapshotAt: snapshot.snapshotAt.toISOString(),
      },
    };
  }
}
