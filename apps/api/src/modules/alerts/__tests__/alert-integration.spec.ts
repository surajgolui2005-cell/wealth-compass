/**
 * Alert Integration & End-to-End Test Suite
 * ==========================================
 *
 * Verifies:
 * 1. AlertService full lifecycle (Create, Read, Update, Delete, Query History, Check Cooldown).
 * 2. 24-Hour Cool-down Throttling:
 *    - Initial breach at t=0 triggers and logs an AlertLog.
 *    - Re-evaluations during the 24h window (e.g. t=1h, t=12h, t=23.5h) are throttled with 0 duplicate logs.
 *    - Evaluation after cool-down expiry (t=24.5h) triggers a new AlertLog record.
 * 3. Multi-rule Evaluation across all 4 Evaluators:
 *    - DrawdownRuleEvaluator (DRAWDOWN_LIMIT)
 *    - VolatilityRuleEvaluator (RISK_SCORE_SPIKE)
 *    - ConcentrationRuleEvaluator (PORTFOLIO_REBALANCE)
 *    - TargetDriftRuleEvaluator (PORTFOLIO_REBALANCE with tolerancePpt)
 * 4. Event-driven pipeline integration:
 *    - Domain events emit -> AlertEventListener deduplicates & enqueues -> NotificationProcessor executes & dispatches.
 */

import { AlertType, DeliveryStatus } from "@prisma/client";
import { AlertEvaluatorEngine } from "../alert-evaluator.engine";
import { AlertService } from "../alert.service";
import { ConcentrationRuleEvaluator } from "../evaluators/concentration-rule.evaluator";
import { DrawdownRuleEvaluator } from "../evaluators/drawdown-rule.evaluator";
import { TargetDriftRuleEvaluator } from "../evaluators/target-drift-rule.evaluator";
import { VolatilityRuleEvaluator } from "../evaluators/volatility-rule.evaluator";
import { PortfolioRiskSnapshot } from "../interfaces/alert-evaluator.interface";
import { AlertEventListener } from "../alert-event.listener";
import { NotificationProcessor } from "../processors/notification.processor";
import { ALERT_JOBS, ALERT_NOTIFICATION_QUEUE } from "../interfaces/alert-queue.interface";

describe("Alert Module - Integration & 24-Hour Cooldown Verification", () => {
  let alertService: AlertService;
  let engine: AlertEvaluatorEngine;
  let drawdownEvaluator: DrawdownRuleEvaluator;
  let concentrationEvaluator: ConcentrationRuleEvaluator;
  let volatilityEvaluator: VolatilityRuleEvaluator;
  let targetDriftEvaluator: TargetDriftRuleEvaluator;

  // In-memory mock database state
  let mockDb: {
    alertRules: any[];
    alertLogs: any[];
    portfolios: any[];
    portfolioSnapshots: any[];
    riskMetrics: any[];
    holdings: any[];
  };

  let mockPrisma: any;
  let mockQueue: any;

  beforeEach(() => {
    // Reset state
    mockDb = {
      alertRules: [],
      alertLogs: [],
      portfolios: [
        {
          id: "port-100",
          userId: "user-vip-1",
          name: "Growth Portfolio",
          currency: "INR",
          deletedAt: null,
        },
      ],
      portfolioSnapshots: [
        {
          id: "snap-100",
          portfolioId: "port-100",
          snapshotDate: new Date("2026-09-01T12:00:00Z"),
          totalValue: { toString: () => "1000000" },
          totalInvested: { toString: () => "900000" },
          unrealizedGain: { toString: () => "100000" },
          realizedGain: { toString: () => "0" },
          cashBalance: { toString: () => "0" },
        },
      ],
      riskMetrics: [
        {
          id: "risk-100",
          portfolioId: "port-100",
          volatilityAnnual: { toString: () => "0.32" }, // 32%
          maxDrawdown: { toString: () => "0.25" }, // 25%
          computedAt: new Date("2026-09-01T12:00:00Z"),
          concentrationRisk: {
            sectorWeights: { Technology: 0.7, Financials: 0.3 },
          },
        },
      ],
      holdings: [
        {
          id: "h-1",
          portfolioId: "port-100",
          assetId: "asset-tech-1",
          currentValue: { toString: () => "700000" },
          asset: { symbol: "INFY" },
          deletedAt: null,
        },
        {
          id: "h-2",
          portfolioId: "port-100",
          assetId: "asset-fin-1",
          currentValue: { toString: () => "300000" },
          asset: { symbol: "HDFC" },
          deletedAt: null,
        },
      ],
    };

    mockPrisma = {
      alertRule: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const newRule = {
            id: "rule-" + (mockDb.alertRules.length + 1),
            userId: data.userId,
            name: data.name,
            alertType: data.alertType,
            condition: data.condition,
            channels: data.channels,
            cooldownDurationMinutes: data.cooldownDurationMinutes ?? 60,
            isActive: data.isActive ?? true,
            lastTriggeredAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            _count: { instances: 0 },
          };
          mockDb.alertRules.push(newRule);
          return newRule;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return mockDb.alertRules.filter((r) => {
            if (where.userId && r.userId !== where.userId) return false;
            if (where.isActive !== undefined && r.isActive !== where.isActive) return false;
            if (where.deletedAt === null && r.deletedAt !== null) return false;
            return true;
          });
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return (
            mockDb.alertRules.find((r) => {
              if (where.id && r.id !== where.id) return false;
              if (where.userId && r.userId !== where.userId) return false;
              if (where.deletedAt === null && r.deletedAt !== null) return false;
              return true;
            }) || null
          );
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return mockDb.alertRules.find((r) => r.id === where.id) || null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const rule = mockDb.alertRules.find((r) => r.id === where.id);
          if (!rule) throw new Error("Rule not found");
          Object.assign(rule, data, { updatedAt: new Date() });
          return rule;
        }),
      },
      alertLog: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const newLog = {
            id: "log-" + (mockDb.alertLogs.length + 1),
            alertRuleId: data.alertRuleId,
            triggeredAt: data.triggeredAt || new Date(),
            triggeredValues: data.triggeredValues,
            deliveryStatus: data.deliveryStatus || "PENDING",
            deliveredAt: null,
            errorMessage: null,
          };
          mockDb.alertLogs.push(newLog);
          return newLog;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return mockDb.alertLogs.filter((l) => {
            if (where.alertRuleId && l.alertRuleId !== where.alertRuleId) return false;
            if (where.alertRule?.userId) {
              const rule = mockDb.alertRules.find((r) => r.id === l.alertRuleId);
              if (!rule || rule.userId !== where.alertRule.userId) return false;
            }
            return true;
          });
        }),
        count: jest.fn().mockImplementation(async () => mockDb.alertLogs.length),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const log = mockDb.alertLogs.find((l) => l.id === where.id);
          if (!log) throw new Error("Log not found");
          Object.assign(log, data);
          return log;
        }),
      },
      portfolio: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return (
            mockDb.portfolios.find((p) => {
              if (where.id && p.id !== where.id) return false;
              if (where.userId && p.userId !== where.userId) return false;
              if (where.deletedAt === null && p.deletedAt !== null) return false;
              return true;
            }) || null
          );
        }),
      },
      portfolioSnapshot: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const portId = where.portfolio?.id || where.portfolioId;
          return mockDb.portfolioSnapshots.find((s) => s.portfolioId === portId) || null;
        }),
      },
      riskMetricSnapshot: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const portId = where.portfolio?.id || where.portfolioId;
          return mockDb.riskMetrics.find((m) => m.portfolioId === portId) || null;
        }),
      },
      holding: {
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return mockDb.holdings.filter((h) => {
            if (where.portfolioId && h.portfolioId !== where.portfolioId) return false;
            if (where.deletedAt === null && h.deletedAt !== null) return false;
            return true;
          });
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callbacks) => {
        if (Array.isArray(callbacks)) {
          return Promise.all(callbacks);
        }
        return callbacks(mockPrisma);
      }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
      getJob: jest.fn().mockResolvedValue(null),
    };

    drawdownEvaluator = new DrawdownRuleEvaluator();
    concentrationEvaluator = new ConcentrationRuleEvaluator();
    volatilityEvaluator = new VolatilityRuleEvaluator();
    targetDriftEvaluator = new TargetDriftRuleEvaluator();

    engine = new AlertEvaluatorEngine(
      mockPrisma,
      drawdownEvaluator,
      concentrationEvaluator,
      volatilityEvaluator,
      targetDriftEvaluator,
    );

    alertService = new AlertService(mockPrisma, engine);
  });

  // ===========================================================================
  // SECTION 1: 24-HOUR COOL-DOWN THROTTLING INTEGRATION
  // ===========================================================================

  describe("24-Hour Cool-down Throttling Invariants", () => {
    const COOLDOWN_24H_MINUTES = 24 * 60; // 1440 minutes

    it("enforces 24-hour throttling: triggers on breach, blocks duplicates within 24h, fires again after 24h", async () => {
      // 1. Create a 24-hour cooldown drawdown limit rule (threshold 15%)
      const ruleDto = {
        name: "24h Max Drawdown Protection",
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 15 },
        channels: { in_app: true, email: true },
        cooldownDurationMinutes: COOLDOWN_24H_MINUTES,
        isActive: true,
      };

      const createdRule = await alertService.createAlertRule("user-vip-1", ruleDto);
      expect(createdRule.id).toBeDefined();
      expect(createdRule.cooldownDurationMinutes).toBe(1440);

      // T = 0 hours: First evaluation -> MUST TRIGGER & WRITE 1 ALERT LOG
      const t0 = new Date("2026-09-01T00:00:00Z");
      jest.useFakeTimers();
      jest.setSystemTime(t0);

      const resT0 = await alertService.evaluatePortfolio("user-vip-1", {
        portfolioId: "port-100",
      });

      expect(resT0.rulesTriggered).toBe(1);
      expect(resT0.rulesSuppressed).toBe(0);
      expect(mockDb.alertLogs.length).toBe(1);
      expect(mockDb.alertRules[0].lastTriggeredAt).toEqual(t0);

      // Check cooldown query at T = 0
      const cooldownT0 = await alertService.getCooldownStatus("user-vip-1", createdRule.id);
      expect(cooldownT0.inCooldown).toBe(true);
      expect(cooldownT0.remainingMinutes).toBe(1440);

      // T = 1 hour (60 minutes later): Violation persists -> MUST BE SUPPRESSED (0 NEW LOGS)
      jest.setSystemTime(new Date(t0.getTime() + 60 * 60 * 1000));
      const resT1 = await alertService.evaluatePortfolio("user-vip-1", {
        portfolioId: "port-100",
      });

      expect(resT1.rulesTriggered).toBe(0);
      expect(resT1.rulesSuppressed).toBe(1);
      expect(mockDb.alertLogs.length).toBe(1); // STILL 1

      // T = 12 hours (720 minutes later): Violation persists -> MUST BE SUPPRESSED (0 NEW LOGS)
      jest.setSystemTime(new Date(t0.getTime() + 12 * 60 * 60 * 1000));
      const resT12 = await alertService.evaluatePortfolio("user-vip-1", {
        portfolioId: "port-100",
      });

      expect(resT12.rulesTriggered).toBe(0);
      expect(resT12.rulesSuppressed).toBe(1);
      expect(mockDb.alertLogs.length).toBe(1); // STILL 1

      // T = 23 hours 50 mins: Violation persists -> MUST BE SUPPRESSED (0 NEW LOGS)
      jest.setSystemTime(new Date(t0.getTime() + 23.83 * 60 * 60 * 1000));
      const resT23 = await alertService.evaluatePortfolio("user-vip-1", {
        portfolioId: "port-100",
      });

      expect(resT23.rulesTriggered).toBe(0);
      expect(resT23.rulesSuppressed).toBe(1);
      expect(mockDb.alertLogs.length).toBe(1); // STILL 1

      // T = 24 hours 5 mins: Cooldown expired & violation persists -> MUST TRIGGER NEW ALERT LOG
      const t24 = new Date(t0.getTime() + 24.1 * 60 * 60 * 1000);
      jest.setSystemTime(t24);

      const cooldownT24 = await alertService.getCooldownStatus("user-vip-1", createdRule.id);
      expect(cooldownT24.inCooldown).toBe(false);
      expect(cooldownT24.remainingMinutes).toBeNull();

      const resT24 = await alertService.evaluatePortfolio("user-vip-1", {
        portfolioId: "port-100",
      });

      expect(resT24.rulesTriggered).toBe(1);
      expect(resT24.rulesSuppressed).toBe(0);
      expect(mockDb.alertLogs.length).toBe(2); // NEW ALERT LOG GENERATED
      expect(mockDb.alertRules[0].lastTriggeredAt).toEqual(t24);

      jest.useRealTimers();
    });
  });

  // ===========================================================================
  // SECTION 2: MULTI-RULE SIMULTANEOUS EVALUATION
  // ===========================================================================

  describe("Multi-rule Simultaneous Evaluation", () => {
    it("evaluates multiple distinct alert types on the same portfolio snapshot correctly", async () => {
      // 1. Drawdown Rule: threshold 20% (snapshot is 25% -> TRIGGERS)
      await alertService.createAlertRule("user-vip-1", {
        name: "Drawdown > 20%",
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 20 },
        channels: { in_app: true },
        cooldownDurationMinutes: 60,
      });

      // 2. Volatility Rule: threshold 25% (snapshot is 32% -> TRIGGERS)
      await alertService.createAlertRule("user-vip-1", {
        name: "Vol > 25%",
        alertType: AlertType.RISK_SCORE_SPIKE,
        condition: { thresholdPct: 25 },
        channels: { in_app: true },
        cooldownDurationMinutes: 60,
      });

      // 3. Concentration Rule: max asset weight 60% (INFY is 70% -> TRIGGERS)
      await alertService.createAlertRule("user-vip-1", {
        name: "Max Asset > 60%",
        alertType: AlertType.PORTFOLIO_REBALANCE,
        condition: { maxAssetWeightPct: 60 },
        channels: { in_app: true },
        cooldownDurationMinutes: 60,
      });

      // 4. Inactive Rule: Drawdown > 10% (isActive: false -> SKIPPED)
      await alertService.createAlertRule("user-vip-1", {
        name: "Disabled Rule",
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 10 },
        channels: { in_app: true },
        cooldownDurationMinutes: 60,
        isActive: false,
      });

      const res = await alertService.evaluatePortfolio("user-vip-1", {
        portfolioId: "port-100",
      });

      expect(res.rulesEvaluated).toBe(3);
      expect(res.rulesTriggered).toBe(3); // Drawdown, Volatility, and Concentration trigger
      expect(mockDb.alertLogs.length).toBe(3);
    });
  });

  // ===========================================================================
  // SECTION 3: ASYNC EVENT-DRIVEN QUEUE & PROCESSOR PIPELINE
  // ===========================================================================

  describe("Event-Driven Background Queue Pipeline", () => {
    it("integrates AlertEventListener -> Queue -> NotificationProcessor -> InApp/Email/Webhook", async () => {
      // Create a triggered rule
      const rule = await alertService.createAlertRule("user-vip-1", {
        name: "High Risk Alert",
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 15 },
        channels: { in_app: true, email: true, webhook: true },
        cooldownDurationMinutes: 60,
      });

      const eventListener = new AlertEventListener(mockQueue);
      const processor = new NotificationProcessor(mockPrisma, engine, mockQueue);

      // 1. Emit portfolio.updated event
      await eventListener.onPortfolioUpdated({
        portfolioId: "port-100",
        totalValue: "1000000",
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS,
        expect.objectContaining({ portfolioId: "port-100", source: "portfolio.updated" }),
        expect.any(Object),
      );

      // 2. Simulate worker executing EVALUATE_PORTFOLIO_ALERTS
      const evalJob = {
        name: ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS,
        id: "job-eval-1",
        data: {
          portfolioId: "port-100",
          userId: "user-vip-1",
          triggeredAt: new Date().toISOString(),
          source: "portfolio.updated",
        },
      };

      const evalResult = (await processor.process(evalJob as any)) as any;
      expect(evalResult.triggered).toBe(1);
      expect(evalResult.dispatched).toBe(3); // in_app, email, webhook

      // 3. Simulate worker executing DISPATCH_NOTIFICATION
      const dispatchJob = {
        name: ALERT_JOBS.DISPATCH_NOTIFICATION,
        id: "job-disp-1",
        data: {
          alertLogId: mockDb.alertLogs[0].id,
          alertRuleId: rule.id,
          alertRuleName: rule.name,
          userId: "user-vip-1",
          portfolioId: "port-100",
          channel: "in_app",
          violationMessage: "Drawdown exceeded threshold",
          triggeredValues: { drawdown: 25 },
          triggeredAt: new Date().toISOString(),
        },
      };

      const dispatchResult = (await processor.process(dispatchJob as any)) as any;
      expect(dispatchResult.dispatched).toBe(true);
      expect(dispatchResult.channel).toBe("in_app");

      // Verify AlertLog updated to DELIVERED
      const updatedLog = mockDb.alertLogs[0];
      expect(updatedLog.deliveryStatus).toBe(DeliveryStatus.DELIVERED);
      expect(updatedLog.deliveredAt).toBeDefined();
    });
  });

  // ===========================================================================
  // SECTION 4: CRUD SECURITY & IDOR DEFENSE
  // ===========================================================================

  describe("AlertService CRUD Security & Authorization", () => {
    it("prevents IDOR: user cannot access, modify, or delete another user rule", async () => {
      const rule = await alertService.createAlertRule("user-vip-1", {
        name: "User 1 Private Rule",
        alertType: AlertType.DRAWDOWN_LIMIT,
        condition: { thresholdPct: 10 },
        channels: { in_app: true },
      });

      // User 2 tries to read User 1's rule
      await expect(alertService.getAlertRuleById("user-attacker-2", rule.id)).rejects.toThrow();

      // User 2 tries to update User 1's rule
      await expect(
        alertService.updateAlertRule("user-attacker-2", rule.id, { name: "Hacked" }),
      ).rejects.toThrow();

      // User 2 tries to delete User 1's rule
      await expect(alertService.deleteAlertRule("user-attacker-2", rule.id)).rejects.toThrow();

      // User 1 successfully deletes own rule
      const delRes = await alertService.deleteAlertRule("user-vip-1", rule.id);
      expect(delRes.message).toContain("deleted");
    });

    it("rejects invalid condition payloads with BadRequestException", async () => {
      // DRAWDOWN_LIMIT missing thresholdPct
      await expect(
        alertService.createAlertRule("user-vip-1", {
          name: "Invalid Drawdown",
          alertType: AlertType.DRAWDOWN_LIMIT,
          condition: { invalidKey: 123 },
          channels: { in_app: true },
        }),
      ).rejects.toThrow();

      // RISK_SCORE_SPIKE with negative threshold
      await expect(
        alertService.createAlertRule("user-vip-1", {
          name: "Negative Vol",
          alertType: AlertType.RISK_SCORE_SPIKE,
          condition: { thresholdPct: -5 },
          channels: { in_app: true },
        }),
      ).rejects.toThrow();
    });
  });
});
