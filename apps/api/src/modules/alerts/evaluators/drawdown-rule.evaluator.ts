/**
 * DrawdownRuleEvaluator
 * ─────────────────────
 * Triggers when the portfolio's current maximum drawdown exceeds the user's
 * configured threshold.
 *
 * Condition shape (DrawdownCondition):
 *   { "thresholdPct": 15 }   → alert when maxDrawdown > 15%
 *
 * Algorithm:
 *   maxDrawdownPct (fraction) × 100 > thresholdPct
 */

import { Injectable } from "@nestjs/common";
import { AlertType } from "@prisma/client";
import {
  AlertCondition,
  DrawdownCondition,
  EvaluationResult,
  IRuleEvaluator,
  PortfolioRiskSnapshot,
} from "../interfaces/alert-evaluator.interface";

@Injectable()
export class DrawdownRuleEvaluator implements IRuleEvaluator {
  readonly alertType = AlertType.DRAWDOWN_LIMIT;

  evaluate(snapshot: PortfolioRiskSnapshot, condition: AlertCondition): EvaluationResult {
    const { thresholdPct } = condition as DrawdownCondition;
    const currentDrawdownPct = snapshot.maxDrawdownPct * 100;
    const triggered = currentDrawdownPct > thresholdPct;

    return {
      triggered,
      violationMessage: triggered
        ? `Portfolio drawdown ${currentDrawdownPct.toFixed(2)}% exceeds threshold of ${thresholdPct}%`
        : undefined,
      triggeredValues: {
        currentDrawdownPct: parseFloat(currentDrawdownPct.toFixed(4)),
        thresholdPct,
        portfolioId: snapshot.portfolioId,
        snapshotAt: snapshot.snapshotAt.toISOString(),
      },
    };
  }
}
