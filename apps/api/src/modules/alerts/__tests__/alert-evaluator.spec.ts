/**
 * Alert Evaluator Engine — Test Suite
 * =====================================
 *
 * Tests all four concrete rule evaluators plus the engine orchestration
 * (cooldown suppression, evaluator dispatch, AlertLog persistence).
 *
 * Test Strategy
 * -------------
 *   Tier 1 — DrawdownRuleEvaluator
 *   Tier 2 — ConcentrationRuleEvaluator
 *   Tier 3 — VolatilityRuleEvaluator
 *   Tier 4 — TargetDriftRuleEvaluator
 *   Tier 5 — AlertEvaluatorEngine (orchestration, cooldown, persistence)
 *
 * All evaluator tests are pure unit tests (no I/O).
 * Engine tests use a mocked PrismaService.
 */

import { AlertType } from "@prisma/client";
import { AlertEvaluatorEngine, AlertRuleRecord } from "../alert-evaluator.engine";
import { ConcentrationRuleEvaluator } from "../evaluators/concentration-rule.evaluator";
import { DrawdownRuleEvaluator } from "../evaluators/drawdown-rule.evaluator";
import { TargetDriftRuleEvaluator } from "../evaluators/target-drift-rule.evaluator";
import { VolatilityRuleEvaluator } from "../evaluators/volatility-rule.evaluator";
import {
  ConcentrationCondition,
  DrawdownCondition,
  PortfolioRiskSnapshot,
  TargetDriftCondition,
  VolatilityCondition,
} from "../interfaces/alert-evaluator.interface";

// ── Shared test fixtures ──────────────────────────────────────────────────────

/**
 * A well-diversified 5-asset portfolio snapshot.
 * Drawdown: 8% | Volatility: 18% | Max single weight: 25%
 */
const SNAPSHOT_DIVERSIFIED: PortfolioRiskSnapshot = {
  portfolioId: "portfolio-abc-001",
  volatilityAnnual: 0.18, // 18%
  maxDrawdownPct: 0.08, // 8%
  totalValue: 1_000_000,
  assetWeights: {
    "asset-reliance": 0.25, // 25%
    "asset-infy": 0.2, // 20%
    "asset-tcs": 0.2, // 20%
    "asset-hdfc": 0.2, // 20%
    "asset-icici": 0.15, // 15%
  },
  assetSymbols: {
    "asset-reliance": "RELIANCE",
    "asset-infy": "INFY",
    "asset-tcs": "TCS",
    "asset-hdfc": "HDFC",
    "asset-icici": "ICICI",
  },
  sectorWeights: {
    Energy: 0.25,
    Technology: 0.4,
    Finance: 0.35,
  },
  targetWeights: {
    "asset-reliance": 0.2, // target 20% — currently 5pp over
    "asset-infy": 0.2,
    "asset-tcs": 0.2,
    "asset-hdfc": 0.2,
    "asset-icici": 0.2, // target 20% — currently 5pp under
  },
  snapshotAt: new Date("2026-09-01T10:00:00Z"),
};

/**
 * A highly concentrated single-stock-dominant snapshot.
 * Drawdown: 22% | Volatility: 35% | AAPL weight: 80%
 */
const SNAPSHOT_CONCENTRATED: PortfolioRiskSnapshot = {
  portfolioId: "portfolio-xyz-002",
  volatilityAnnual: 0.35, // 35%
  maxDrawdownPct: 0.22, // 22%
  totalValue: 500_000,
  assetWeights: {
    "asset-aapl": 0.8, // 80% — massively over any sane limit
    "asset-msft": 0.1,
    "asset-goog": 0.1,
  },
  assetSymbols: {
    "asset-aapl": "AAPL",
    "asset-msft": "MSFT",
    "asset-goog": "GOOG",
  },
  sectorWeights: {
    Technology: 1.0, // 100% single sector
  },
  targetWeights: {
    "asset-aapl": 0.33, // target 33% — currently 47pp over
    "asset-msft": 0.33,
    "asset-goog": 0.34,
  },
  snapshotAt: new Date("2026-09-01T10:00:00Z"),
};

// ── Helper: build a minimal AlertRuleRecord ───────────────────────────────────
function makeRule(
  overrides: Partial<AlertRuleRecord> & {
    alertType: AlertType;
    condition: object;
  },
): AlertRuleRecord {
  return {
    id: "rule-" + Math.random().toString(36).slice(2, 9),
    userId: "user-001",
    name: "Test Rule",
    cooldownDurationMinutes: 60,
    isActive: true,
    lastTriggeredAt: null,
    ...overrides,
  };
}

// =============================================================================
// TIER 1: DrawdownRuleEvaluator
// =============================================================================

describe("DrawdownRuleEvaluator", () => {
  const evaluator = new DrawdownRuleEvaluator();

  it("has alertType = DRAWDOWN_LIMIT", () => {
    expect(evaluator.alertType).toBe(AlertType.DRAWDOWN_LIMIT);
  });

  describe("when drawdown is BELOW threshold", () => {
    const condition: DrawdownCondition = { thresholdPct: 15 };

    it("does not trigger for 8% drawdown vs 15% threshold", () => {
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
      expect(result.violationMessage).toBeUndefined();
    });

    it("includes accurate triggeredValues even when not triggered", () => {
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggeredValues["currentDrawdownPct"]).toBeCloseTo(8.0, 2);
      expect(result.triggeredValues["thresholdPct"]).toBe(15);
      expect(result.triggeredValues["portfolioId"]).toBe("portfolio-abc-001");
    });
  });

  describe("when drawdown EQUALS threshold (strict greater-than)", () => {
    const condition: DrawdownCondition = { thresholdPct: 8 };

    it("does NOT trigger when exactly at threshold (strictly >)", () => {
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
    });
  });

  describe("when drawdown EXCEEDS threshold", () => {
    const condition: DrawdownCondition = { thresholdPct: 15 };

    it("triggers for 22% drawdown vs 15% threshold", () => {
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.triggered).toBe(true);
    });

    it("produces a human-readable violation message", () => {
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.violationMessage).toContain("22.00%");
      expect(result.violationMessage).toContain("15%");
      expect(result.violationMessage?.toLowerCase()).toContain("drawdown");
    });

    it("includes accurate triggeredValues", () => {
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.triggeredValues["currentDrawdownPct"]).toBeCloseTo(22.0, 2);
      expect(result.triggeredValues["thresholdPct"]).toBe(15);
    });
  });

  describe("boundary conditions", () => {
    it("does not trigger for a portfolio with 0% drawdown", () => {
      const snapshot: PortfolioRiskSnapshot = {
        ...SNAPSHOT_DIVERSIFIED,
        maxDrawdownPct: 0,
      };
      const result = evaluator.evaluate(snapshot, { thresholdPct: 5 });
      expect(result.triggered).toBe(false);
    });

    it("triggers just above the threshold (thresholdPct = 10, drawdown = 10.001%)", () => {
      const snapshot: PortfolioRiskSnapshot = {
        ...SNAPSHOT_DIVERSIFIED,
        maxDrawdownPct: 0.10001,
      };
      const result = evaluator.evaluate(snapshot, { thresholdPct: 10 });
      expect(result.triggered).toBe(true);
    });
  });
});

// =============================================================================
// TIER 2: ConcentrationRuleEvaluator
// =============================================================================

describe("ConcentrationRuleEvaluator", () => {
  const evaluator = new ConcentrationRuleEvaluator();

  it("has alertType = PORTFOLIO_REBALANCE", () => {
    expect(evaluator.alertType).toBe(AlertType.PORTFOLIO_REBALANCE);
  });

  describe("asset-level concentration", () => {
    it("does not trigger when all assets below limit (30% limit, max = 25%)", () => {
      const condition: ConcentrationCondition = { maxAssetWeightPct: 30 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
    });

    it("triggers when an asset exceeds the limit (20% limit, RELIANCE = 25%)", () => {
      const condition: ConcentrationCondition = { maxAssetWeightPct: 20 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(true);
      expect(result.violationMessage).toContain("RELIANCE");
      expect(result.violationMessage).toContain("25.00%");
      expect(result.violationMessage).toContain("20%");
    });

    it("triggers for multiple asset violations and reports count", () => {
      // 15% limit → RELIANCE (25%) + INFY (20%) + TCS (20%) + HDFC (20%) all violate
      const condition: ConcentrationCondition = { maxAssetWeightPct: 15 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(true);
      const violations = result.triggeredValues["violations"] as Array<{ type: string }>;
      expect(violations.filter((v) => v.type === "asset").length).toBeGreaterThan(1);
    });

    it("reports AAPL (80%) as the worst violator in concentrated snapshot", () => {
      const condition: ConcentrationCondition = { maxAssetWeightPct: 20 };
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.triggered).toBe(true);
      expect(result.violationMessage).toContain("AAPL");
      expect(result.violationMessage).toContain("80.00%");
    });
  });

  describe("sector-level concentration", () => {
    it("does not trigger when all sectors below limit (50% limit)", () => {
      const condition: ConcentrationCondition = { maxSectorWeightPct: 50 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
    });

    it("triggers when Technology sector (40%) exceeds 35% limit", () => {
      const condition: ConcentrationCondition = { maxSectorWeightPct: 35 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(true);
      expect(result.violationMessage?.toLowerCase()).toContain("technology");
    });

    it("triggers for 100% single-sector portfolio vs 40% limit", () => {
      const condition: ConcentrationCondition = { maxSectorWeightPct: 40 };
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.triggered).toBe(true);
      expect(result.violationMessage).toContain("Technology");
      expect(result.violationMessage).toContain("100.00%");
    });
  });

  describe("combined asset + sector limits", () => {
    it("triggers when either asset or sector limit is breached", () => {
      const condition: ConcentrationCondition = {
        maxAssetWeightPct: 30, // not breached by diversified portfolio
        maxSectorWeightPct: 35, // Technology 40% breaches this
      };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(true);
    });

    it("does not trigger when both limits are comfortably within bounds", () => {
      const condition: ConcentrationCondition = {
        maxAssetWeightPct: 30,
        maxSectorWeightPct: 50,
      };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
    });
  });

  describe("no sector data available", () => {
    it("skips sector check gracefully when sectorWeights is undefined", () => {
      const snapshot: PortfolioRiskSnapshot = {
        ...SNAPSHOT_DIVERSIFIED,
        sectorWeights: undefined,
      };
      const condition: ConcentrationCondition = {
        maxAssetWeightPct: 30,
        maxSectorWeightPct: 35, // would breach if sector data existed
      };
      const result = evaluator.evaluate(snapshot, condition);
      // Should NOT trigger because no sector data
      expect(result.triggered).toBe(false);
    });
  });

  describe("violation details structure", () => {
    it("includes excessPpt in violation objects", () => {
      const condition: ConcentrationCondition = { maxAssetWeightPct: 20 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      const violations = result.triggeredValues["violations"] as Array<{
        excessPpt: number;
        identifier: string;
      }>;
      const relianceViolation = violations.find((v) => v.identifier === "RELIANCE");
      expect(relianceViolation).toBeDefined();
      expect(relianceViolation!.excessPpt).toBeCloseTo(5.0, 2); // 25% - 20% = 5pp
    });
  });
});

// =============================================================================
// TIER 3: VolatilityRuleEvaluator
// =============================================================================

describe("VolatilityRuleEvaluator", () => {
  const evaluator = new VolatilityRuleEvaluator();

  it("has alertType = RISK_SCORE_SPIKE", () => {
    expect(evaluator.alertType).toBe(AlertType.RISK_SCORE_SPIKE);
  });

  describe("when volatility is BELOW threshold", () => {
    it("does not trigger for 18% volatility vs 25% threshold", () => {
      const condition: VolatilityCondition = { thresholdPct: 25 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
      expect(result.violationMessage).toBeUndefined();
    });

    it("reports accurate currentVolatilityPct in triggeredValues", () => {
      const condition: VolatilityCondition = { thresholdPct: 25 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggeredValues["currentVolatilityPct"]).toBeCloseTo(18.0, 2);
    });
  });

  describe("when volatility EQUALS threshold", () => {
    it("does NOT trigger when exactly at threshold (strictly >)", () => {
      const snapshot: PortfolioRiskSnapshot = {
        ...SNAPSHOT_DIVERSIFIED,
        volatilityAnnual: 0.25,
      };
      const condition: VolatilityCondition = { thresholdPct: 25 };
      const result = evaluator.evaluate(snapshot, condition);
      expect(result.triggered).toBe(false);
    });
  });

  describe("when volatility EXCEEDS threshold", () => {
    it("triggers for 35% volatility vs 25% threshold", () => {
      const condition: VolatilityCondition = { thresholdPct: 25 };
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.triggered).toBe(true);
    });

    it("produces a human-readable violation message", () => {
      const condition: VolatilityCondition = { thresholdPct: 25 };
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.violationMessage).toContain("35.00%");
      expect(result.violationMessage).toContain("25%");
      expect(result.violationMessage?.toLowerCase()).toContain("volatility");
    });

    it("includes accurate triggeredValues", () => {
      const condition: VolatilityCondition = { thresholdPct: 25 };
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.triggeredValues["currentVolatilityPct"]).toBeCloseTo(35.0, 2);
      expect(result.triggeredValues["thresholdPct"]).toBe(25);
    });
  });
});

// =============================================================================
// TIER 4: TargetDriftRuleEvaluator
// =============================================================================

describe("TargetDriftRuleEvaluator", () => {
  const evaluator = new TargetDriftRuleEvaluator();

  it("has alertType = PORTFOLIO_REBALANCE", () => {
    expect(evaluator.alertType).toBe(AlertType.PORTFOLIO_REBALANCE);
  });

  describe("when all assets are within tolerance band", () => {
    it("does not trigger for 5pp tolerance with 5pp drift — strict >", () => {
      // RELIANCE: current=25%, target=20% → drift=5pp; tolerance=5pp → NOT triggered (5 > 5 is false)
      const condition: TargetDriftCondition = { tolerancePpt: 5 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
    });

    it("does not trigger for 10pp tolerance (all drifts ≤ 5pp)", () => {
      const condition: TargetDriftCondition = { tolerancePpt: 10 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(false);
    });
  });

  describe("when assets drift outside tolerance", () => {
    it("triggers for 3pp tolerance when RELIANCE has 5pp drift", () => {
      const condition: TargetDriftCondition = { tolerancePpt: 3 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      expect(result.triggered).toBe(true);
    });

    it("produces a human-readable message identifying the worst offender", () => {
      const condition: TargetDriftCondition = { tolerancePpt: 3 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      // RELIANCE (5pp) and ICICI (5pp) are tied as worst; either could be reported
      expect(result.violationMessage).toContain("5.00pp");
      expect(result.violationMessage).toContain("±3pp");
    });

    it("reports overweight direction for RELIANCE (25% current vs 20% target)", () => {
      const condition: TargetDriftCondition = { tolerancePpt: 3 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      const violations = result.triggeredValues["violations"] as Array<{
        identifier: string;
        direction: string;
        driftPpt: number;
      }>;
      const relianceViolation = violations.find((v) => v.identifier === "asset-reliance");
      expect(relianceViolation?.direction).toBe("overweight");
      expect(relianceViolation?.driftPpt).toBeCloseTo(5.0, 2);
    });

    it("reports underweight direction for ICICI (15% current vs 20% target)", () => {
      const condition: TargetDriftCondition = { tolerancePpt: 3 };
      const result = evaluator.evaluate(SNAPSHOT_DIVERSIFIED, condition);
      const violations = result.triggeredValues["violations"] as Array<{
        identifier: string;
        direction: string;
      }>;
      const icicciViolation = violations.find((v) => v.identifier === "asset-icici");
      expect(icicciViolation?.direction).toBe("underweight");
    });
  });

  describe("concentrated portfolio with large drift", () => {
    it("triggers for AAPL with 47pp drift above 5pp tolerance", () => {
      // AAPL: current=80%, target=33% → drift=47pp > 5pp
      const condition: TargetDriftCondition = { tolerancePpt: 5 };
      const result = evaluator.evaluate(SNAPSHOT_CONCENTRATED, condition);
      expect(result.triggered).toBe(true);
      const violations = result.triggeredValues["violations"] as Array<{
        identifier: string;
        driftPpt: number;
        direction: string;
      }>;
      const aaplViolation = violations.find((v) => v.identifier === "asset-aapl");
      expect(aaplViolation).toBeDefined();
      expect(aaplViolation!.driftPpt).toBeCloseTo(47.0, 0);
      expect(aaplViolation!.direction).toBe("overweight");
    });
  });

  describe("edge cases", () => {
    it("returns not-triggered with informational message when no targetWeights", () => {
      const snapshot: PortfolioRiskSnapshot = {
        ...SNAPSHOT_DIVERSIFIED,
        targetWeights: undefined,
      };
      const condition: TargetDriftCondition = { tolerancePpt: 5 };
      const result = evaluator.evaluate(snapshot, condition);
      expect(result.triggered).toBe(false);
      expect(result.triggeredValues["message"]).toContain("No target weights");
    });

    it("returns not-triggered for empty targetWeights", () => {
      const snapshot: PortfolioRiskSnapshot = {
        ...SNAPSHOT_DIVERSIFIED,
        targetWeights: {},
      };
      const condition: TargetDriftCondition = { tolerancePpt: 5 };
      const result = evaluator.evaluate(snapshot, condition);
      expect(result.triggered).toBe(false);
    });

    it("treats a completely missing asset as 100% underweight", () => {
      const snapshot: PortfolioRiskSnapshot = {
        ...SNAPSHOT_DIVERSIFIED,
        assetWeights: {}, // no current allocation at all
        targetWeights: { "asset-reliance": 0.2 },
      };
      const condition: TargetDriftCondition = { tolerancePpt: 5 };
      const result = evaluator.evaluate(snapshot, condition);
      expect(result.triggered).toBe(true);
      const violations = result.triggeredValues["violations"] as Array<{
        currentWeightPct: number;
        direction: string;
      }>;
      expect(violations[0].currentWeightPct).toBeCloseTo(0.0, 2);
      expect(violations[0].direction).toBe("underweight");
    });
  });
});

// =============================================================================
// TIER 5: AlertEvaluatorEngine (orchestration + cooldown + persistence)
// =============================================================================

/** Minimal mock of PrismaService for engine tests. */
function buildMockPrisma() {
  const mockLogId = "log-" + Math.random().toString(36).slice(2, 9);
  return {
    alertLog: {
      create: jest.fn().mockResolvedValue({ id: mockLogId }),
    },
    alertRule: {
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function buildEngine(prisma: ReturnType<typeof buildMockPrisma>) {
  return new AlertEvaluatorEngine(
    prisma as any,
    new DrawdownRuleEvaluator(),
    new ConcentrationRuleEvaluator(),
    new VolatilityRuleEvaluator(),
    new TargetDriftRuleEvaluator(),
  );
}

describe("AlertEvaluatorEngine", () => {
  describe("cooldown suppression", () => {
    it("suppresses a rule that was triggered within its cooldown window", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 5 }, // would trigger (drawdown = 22%)
        cooldownDurationMinutes: 60,
        lastTriggeredAt: new Date(Date.now() - 10 * 60 * 1000), // triggered 10 min ago
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);

      expect(summary.suppressed).toBe(true);
      expect(summary.evaluated).toBe(false);
      expect(summary.triggered).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("does NOT suppress a rule whose cooldown has expired", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 5 },
        cooldownDurationMinutes: 60,
        lastTriggeredAt: new Date(Date.now() - 90 * 60 * 1000), // 90 min ago — expired
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);

      expect(summary.suppressed).toBe(false);
      expect(summary.evaluated).toBe(true);
    });

    it("never suppresses a rule that has never been triggered", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 5 },
        lastTriggeredAt: null,
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(summary.suppressed).toBe(false);
    });
  });

  describe("evaluator dispatch", () => {
    it("dispatches DRAWDOWN_LIMIT rules to DrawdownRuleEvaluator", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 15 }, // 22% drawdown triggers this
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(summary.evaluated).toBe(true);
      expect(summary.triggered).toBe(true);
    });

    it("dispatches RISK_SCORE_SPIKE rules to VolatilityRuleEvaluator", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.RISK_SCORE_SPIKE,
        condition: { thresholdPct: 25 }, // 35% vol triggers this
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(summary.evaluated).toBe(true);
      expect(summary.triggered).toBe(true);
    });

    it("dispatches PORTFOLIO_REBALANCE with maxAssetWeightPct to ConcentrationRuleEvaluator", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.PORTFOLIO_REBALANCE,
        condition: { maxAssetWeightPct: 20 }, // AAPL 80% triggers this
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(summary.evaluated).toBe(true);
      expect(summary.triggered).toBe(true);
      expect(summary.violationMessage).toContain("AAPL");
    });

    it("dispatches PORTFOLIO_REBALANCE with tolerancePpt to TargetDriftRuleEvaluator", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.PORTFOLIO_REBALANCE,
        condition: { tolerancePpt: 3 }, // 5pp drift on RELIANCE triggers this
      });

      const summary = await engine.evaluateRule(SNAPSHOT_DIVERSIFIED, rule);
      expect(summary.evaluated).toBe(true);
      expect(summary.triggered).toBe(true);
    });

    it("returns evaluated=false for an unknown AlertType", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.PRICE_THRESHOLD, // no evaluator registered
        condition: {},
      });

      const summary = await engine.evaluateRule(SNAPSHOT_DIVERSIFIED, rule);
      expect(summary.evaluated).toBe(false);
      expect(summary.triggered).toBe(false);
    });
  });

  describe("AlertLog persistence", () => {
    it("persists an AlertLog when a rule triggers", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 15 },
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);

      expect(summary.triggered).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("does NOT persist an AlertLog when a rule does NOT trigger", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 50 }, // 22% drawdown does not breach 50%
      });

      await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("does NOT persist an AlertLog when rule is suppressed by cooldown", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 5 },
        cooldownDurationMinutes: 60,
        lastTriggeredAt: new Date(Date.now() - 5 * 60 * 1000),
      });

      await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns the logId from the persisted AlertLog", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 15 },
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(summary.logId).toBeDefined();
      expect(typeof summary.logId).toBe("string");
    });
  });

  describe("evaluateAll orchestration", () => {
    it("skips inactive rules", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rules: AlertRuleRecord[] = [
        makeRule({
          alertType: AlertType.DRAWDOWN_LIMIT,
          condition: { thresholdPct: 15 },
          isActive: false,
        }),
      ];

      const summaries = await engine.evaluateAll(SNAPSHOT_CONCENTRATED, rules);
      expect(summaries).toHaveLength(0);
    });

    it("evaluates all active rules and returns one summary per rule", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rules: AlertRuleRecord[] = [
        makeRule({ alertType: AlertType.DRAWDOWN_LIMIT, condition: { thresholdPct: 15 } }),
        makeRule({ alertType: AlertType.RISK_SCORE_SPIKE, condition: { thresholdPct: 25 } }),
        makeRule({
          alertType: AlertType.PORTFOLIO_REBALANCE,
          condition: { maxAssetWeightPct: 20 },
        }),
      ];

      const summaries = await engine.evaluateAll(SNAPSHOT_CONCENTRATED, rules);
      expect(summaries).toHaveLength(3);
    });

    it("counts triggered, suppressed, and evaluated rules correctly", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rules: AlertRuleRecord[] = [
        // triggers (drawdown 22% > 15%)
        makeRule({ alertType: AlertType.DRAWDOWN_LIMIT, condition: { thresholdPct: 15 } }),
        // triggers (vol 35% > 25%)
        makeRule({ alertType: AlertType.RISK_SCORE_SPIKE, condition: { thresholdPct: 25 } }),
        // does not trigger (drawdown 22% < 50%)
        makeRule({ alertType: AlertType.DRAWDOWN_LIMIT, condition: { thresholdPct: 50 } }),
        // suppressed (recently fired)
        makeRule({
          alertType: AlertType.DRAWDOWN_LIMIT,
          condition: { thresholdPct: 5 },
          lastTriggeredAt: new Date(Date.now() - 5 * 60 * 1000),
          cooldownDurationMinutes: 60,
        }),
      ];

      const summaries = await engine.evaluateAll(SNAPSHOT_CONCENTRATED, rules);

      expect(summaries.filter((s) => s.triggered).length).toBe(2);
      expect(summaries.filter((s) => s.suppressed).length).toBe(1);
      expect(summaries.filter((s) => s.evaluated && !s.triggered).length).toBe(1);
    });

    it("handles evaluator errors gracefully without crashing the loop", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      // PRICE_THRESHOLD has no evaluator — should return evaluated=false silently
      const rules: AlertRuleRecord[] = [
        makeRule({ alertType: AlertType.PRICE_THRESHOLD, condition: {} }),
        makeRule({ alertType: AlertType.DRAWDOWN_LIMIT, condition: { thresholdPct: 15 } }),
      ];

      const summaries = await engine.evaluateAll(SNAPSHOT_CONCENTRATED, rules);
      expect(summaries).toHaveLength(2);
      expect(summaries[1].triggered).toBe(true); // second rule still evaluated
    });
  });

  describe("summary fields", () => {
    it("summary always contains ruleId, ruleName, and alertType", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        name: "My Test Rule",
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 15 },
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(summary.ruleId).toBe(rule.id);
      expect(summary.ruleName).toBe("My Test Rule");
      expect(summary.alertType).toBe(AlertType.DRAWDOWN_LIMIT);
    });

    it("summary includes violationMessage when triggered", async () => {
      const prisma = buildMockPrisma();
      const engine = buildEngine(prisma);

      const rule = makeRule({
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 15 },
      });

      const summary = await engine.evaluateRule(SNAPSHOT_CONCENTRATED, rule);
      expect(summary.triggered).toBe(true);
      expect(summary.violationMessage).toBeDefined();
      expect(typeof summary.violationMessage).toBe("string");
    });
  });
});
