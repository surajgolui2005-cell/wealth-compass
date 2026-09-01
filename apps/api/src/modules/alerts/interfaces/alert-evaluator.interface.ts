/**
 * Alert Evaluator Interface
 * ─────────────────────────
 * Contract that every concrete rule evaluator must satisfy.
 * Evaluators are pure functions: given a portfolio snapshot and the rule's
 * condition payload, they return whether the rule is triggered and
 * a human-readable violation description for the AlertLog.
 */

import { AlertType } from "@prisma/client";

/**
 * Normalised portfolio snapshot passed to every evaluator.
 * Built from RiskMetricSnapshot + PortfolioSnapshot + live holding data.
 */
export interface PortfolioRiskSnapshot {
  portfolioId: string;

  /** Annualised volatility as a fraction (e.g. 0.25 = 25%) */
  volatilityAnnual: number;

  /**
   * Maximum drawdown as a positive fraction (e.g. 0.15 = 15% drawdown).
   * Zero if the portfolio has never drawn down below its peak.
   */
  maxDrawdownPct: number;

  /**
   * Current portfolio total value in home currency (INR).
   */
  totalValue: number;

  /**
   * Asset allocation map: assetId → weight as fraction (sum ≈ 1).
   * Derived from the PortfolioSnapshot.assetAllocation JSON field.
   */
  assetWeights: Record<string, number>;

  /**
   * Sector allocation map: sectorName → weight as fraction (sum ≈ 1).
   * Optional — populated only when sector metadata is available.
   */
  sectorWeights?: Record<string, number>;

  /**
   * Asset symbol map: assetId → ticker symbol.
   * Used to produce human-readable violation messages.
   */
  assetSymbols?: Record<string, string>;

  /**
   * Target allocation map: assetClass → target weight as fraction.
   * Used by TargetDriftRuleEvaluator.
   */
  targetWeights?: Record<string, number>;

  /** Timestamp of the snapshot this data was derived from. */
  snapshotAt: Date;
}

/**
 * Result returned by every rule evaluator.
 */
export interface EvaluationResult {
  /** True when the alert condition is breached and should fire. */
  triggered: boolean;

  /**
   * Human-readable summary of what was violated.
   * Should be self-contained (e.g. "RELIANCE weight 35.2% exceeds 30% limit").
   * Only populated when triggered = true.
   */
  violationMessage?: string;

  /**
   * Structured machine-readable details stored in AlertLog.triggeredValues.
   * Must be JSON-serialisable.
   */
  triggeredValues: Record<string, unknown>;
}

/**
 * Rule condition payload shapes keyed by AlertType.
 * These are persisted in AlertRule.condition (JSON column).
 */

export interface DrawdownCondition {
  /** Max drawdown threshold as a positive percentage (e.g. 15 = 15%). */
  thresholdPct: number;
}

export interface ConcentrationCondition {
  /** Maximum allowed weight for any single asset (percentage, e.g. 20). */
  maxAssetWeightPct?: number;
  /** Maximum allowed weight for any single sector (percentage, e.g. 40). */
  maxSectorWeightPct?: number;
}

export interface VolatilityCondition {
  /** Annualised volatility threshold as a percentage (e.g. 25 = 25%). */
  thresholdPct: number;
}

export interface TargetDriftCondition {
  /**
   * Maximum allowed absolute deviation from target weight (percentage points).
   * e.g. 5 means ±5pp band around target.
   */
  tolerancePpt: number;
}

export type AlertCondition =
  DrawdownCondition | ConcentrationCondition | VolatilityCondition | TargetDriftCondition;

/**
 * Pluggable evaluator interface.
 */
export interface IRuleEvaluator {
  /** The AlertType this evaluator handles. */
  readonly alertType: AlertType;

  /**
   * Evaluate a portfolio snapshot against the rule condition.
   *
   * @param snapshot  Normalised portfolio + risk snapshot.
   * @param condition Typed condition payload from AlertRule.condition.
   * @returns         EvaluationResult with triggered flag and details.
   */
  evaluate(snapshot: PortfolioRiskSnapshot, condition: AlertCondition): EvaluationResult;
}
