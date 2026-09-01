/**
 * NotificationProcessor & AlertEventListener — Test Suite
 * =========================================================
 *
 * Tier 1 — AlertEventListener (via NestJS TestingModule for DI)
 * Tier 2 — NotificationProcessor: EVALUATE_PORTFOLIO_ALERTS (direct instantiation)
 * Tier 3 — NotificationProcessor: DISPATCH_NOTIFICATION (direct instantiation)
 *
 * The processor is tested via direct `new NotificationProcessor(...)` to avoid
 * NestJS DI resolution overhead and PrismaService token mismatches in test context.
 * The event listener IS tested via TestingModule because it uses @InjectQueue.
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { AlertEventListener } from "../alert-event.listener";
import { NotificationProcessor } from "../processors/notification.processor";
import { AlertEvaluatorEngine, RuleEvaluationSummary } from "../alert-evaluator.engine";
import {
  ALERT_JOBS,
  ALERT_NOTIFICATION_QUEUE,
  DispatchNotificationPayload,
  EvaluatePortfolioAlertsPayload,
} from "../interfaces/alert-queue.interface";
import { AlertType, DeliveryStatus } from "@prisma/client";

// ── Shared mock factories ─────────────────────────────────────────────────────

function buildMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: "job-" + Math.random().toString(36).slice(2, 8) }),
    getJob: jest.fn().mockResolvedValue(null),
  };
}

function buildMockPrisma() {
  return {
    portfolio: {
      findFirst: jest.fn().mockResolvedValue({ id: "p-001", userId: "u-001" }),
    },
    alertRule: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        cooldownDurationMinutes: 60,
        lastTriggeredAt: null,
      }),
    },
    riskMetricSnapshot: {
      findFirst: jest.fn().mockResolvedValue({
        id: "rms-001",
        portfolioId: "p-001",
        volatilityAnnual: { toString: () => "0.18" },
        maxDrawdown: { toString: () => "0.08" },
        computedAt: new Date("2026-09-01T10:00:00Z"),
        concentrationRisk: null,
      }),
    },
    holding: {
      findMany: jest.fn().mockResolvedValue([
        {
          assetId: "a-001",
          currentValue: { toString: () => "500000" },
          asset: { symbol: "RELIANCE" },
        },
        { assetId: "a-002", currentValue: { toString: () => "500000" }, asset: { symbol: "INFY" } },
      ]),
    },
    alertLog: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function buildMockEngine(summaries: Partial<RuleEvaluationSummary>[] = []) {
  return {
    evaluateAll: jest.fn().mockResolvedValue(
      summaries.map((s) => ({
        ruleId: "rule-001",
        ruleName: "Test Rule",
        alertType: AlertType.DRAWDOWN_LIMIT,
        evaluated: true,
        suppressed: false,
        triggered: false,
        ...s,
      })),
    ),
  };
}

/** Helper: build a minimal Job-like object for process() calls */
function mockJob<T>(name: string, data: T) {
  return { name, data, id: "job-test-" + Math.random().toString(36).slice(2) };
}

/** Construct a NotificationProcessor directly (no NestJS DI) */
function buildProcessor(
  prisma = buildMockPrisma(),
  engine = buildMockEngine(),
  queue = buildMockQueue(),
) {
  return {
    processor: new NotificationProcessor(prisma as any, engine as any, queue as any),
    prisma,
    engine,
    queue,
  };
}

// ── Shared rule fixture ───────────────────────────────────────────────────────

function makeAlertRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    userId: "u-001",
    name: "Test Rule",
    alertType: AlertType.DRAWDOWN_LIMIT,
    condition: { thresholdPct: 15 },
    channels: { in_app: true },
    cooldownDurationMinutes: 60,
    isActive: true,
    lastTriggeredAt: null,
    ...overrides,
  };
}

function makeEvalJobPayload(
  overrides: Partial<EvaluatePortfolioAlertsPayload> = {},
): EvaluatePortfolioAlertsPayload {
  return {
    portfolioId: "p-001",
    userId: "",
    triggeredAt: new Date().toISOString(),
    source: "portfolio.updated",
    ...overrides,
  };
}

function makeDispatchPayload(channel = "in_app"): DispatchNotificationPayload {
  return {
    alertLogId: "log-001",
    alertRuleId: "rule-001",
    alertRuleName: "Test Rule",
    userId: "u-001",
    portfolioId: "p-001",
    channel: channel as any,
    violationMessage: "Portfolio drawdown 22% exceeds 15%",
    triggeredValues: { currentDrawdownPct: 22 },
    triggeredAt: new Date().toISOString(),
  };
}

// =============================================================================
// TIER 1: AlertEventListener
// =============================================================================

describe("AlertEventListener", () => {
  let listener: AlertEventListener;
  let mockQueue: ReturnType<typeof buildMockQueue>;

  beforeEach(async () => {
    mockQueue = buildMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertEventListener,
        { provide: getQueueToken(ALERT_NOTIFICATION_QUEUE), useValue: mockQueue },
      ],
    })
      .setLogger(new Logger())
      .compile();

    listener = module.get<AlertEventListener>(AlertEventListener);
  });

  describe("onPortfolioUpdated", () => {
    it("enqueues an EVALUATE_PORTFOLIO_ALERTS job", async () => {
      await listener.onPortfolioUpdated({ portfolioId: "p-001", totalValue: "1000000" });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS,
        expect.objectContaining({ portfolioId: "p-001", source: "portfolio.updated" }),
        expect.objectContaining({ delay: 2_000, attempts: 3 }),
      );
    });

    it("uses a stable minute-bucket jobId for deduplication", async () => {
      await listener.onPortfolioUpdated({ portfolioId: "p-002", totalValue: "500000" });
      const opts = mockQueue.add.mock.calls[0][2] as { jobId: string };
      expect(opts.jobId).toMatch(/^alert-eval:p-002:\d+$/);
    });

    it("skips enqueue when a job already exists for this portfolio this minute", async () => {
      mockQueue.getJob.mockResolvedValueOnce({ id: "existing-job" });
      await listener.onPortfolioUpdated({ portfolioId: "p-001", totalValue: "1000000" });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("does NOT throw when queue.add fails", async () => {
      mockQueue.add.mockRejectedValueOnce(new Error("Redis connection refused"));
      await expect(
        listener.onPortfolioUpdated({ portfolioId: "p-err", totalValue: "0" }),
      ).resolves.not.toThrow();
    });

    it("includes portfolioId in the job payload", async () => {
      await listener.onPortfolioUpdated({ portfolioId: "p-xyz", totalValue: "999" });
      const payload = mockQueue.add.mock.calls[0][1] as EvaluatePortfolioAlertsPayload;
      expect(payload.portfolioId).toBe("p-xyz");
    });

    it("sets triggeredAt as a valid ISO timestamp", async () => {
      await listener.onPortfolioUpdated({ portfolioId: "p-ts", totalValue: "1" });
      const payload = mockQueue.add.mock.calls[0][1] as EvaluatePortfolioAlertsPayload;
      expect(new Date(payload.triggeredAt).toISOString()).toBe(payload.triggeredAt);
    });
  });

  describe("onHoldingUpdated", () => {
    it("enqueues a job with source=holding.updated", async () => {
      await listener.onHoldingUpdated({
        holdingId: "h-001",
        portfolioId: "p-001",
        symbol: "RELIANCE",
        quantity: 100,
        currentValue: 500000,
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS,
        expect.objectContaining({ source: "holding.updated" }),
        expect.any(Object),
      );
    });

    it("is a no-op if a job is already queued this minute", async () => {
      mockQueue.getJob.mockResolvedValueOnce({ id: "already-queued" });
      await listener.onHoldingUpdated({
        holdingId: "h-001",
        portfolioId: "p-001",
        symbol: "TCS",
        quantity: 50,
        currentValue: 300000,
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("does NOT throw on queue failure", async () => {
      mockQueue.add.mockRejectedValueOnce(new Error("Redis timeout"));
      await expect(
        listener.onHoldingUpdated({
          holdingId: "h-002",
          portfolioId: "p-err",
          symbol: "INFY",
          quantity: 20,
          currentValue: 100000,
        }),
      ).resolves.not.toThrow();
    });

    it("uses the same minute-bucket jobId as portfolio.updated (preventing double-queue)", async () => {
      await listener.onHoldingUpdated({
        holdingId: "h-001",
        portfolioId: "p-bucket",
        symbol: "X",
        quantity: 1,
        currentValue: 1,
      });
      const opts = mockQueue.add.mock.calls[0][2] as { jobId: string };
      const minuteBucket = Math.floor(Date.now() / 60_000);
      expect(opts.jobId).toBe(`alert-eval:p-bucket:${minuteBucket}`);
    });
  });
});

// =============================================================================
// TIER 2: NotificationProcessor — EVALUATE_PORTFOLIO_ALERTS
// =============================================================================

describe("NotificationProcessor — EVALUATE_PORTFOLIO_ALERTS", () => {
  it("returns skipped=true when portfolio is not found", async () => {
    const prisma = buildMockPrisma();
    prisma.portfolio.findFirst.mockResolvedValueOnce(null);
    const { processor } = buildProcessor(prisma);

    const result = (await processor.process(
      mockJob(
        ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS,
        makeEvalJobPayload({ portfolioId: "p-missing" }),
      ) as any,
    )) as any;

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("not found");
  });

  it("returns rulesFound=0 and skips engine when no active rules exist", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([]);
    const { processor, engine } = buildProcessor(prisma);

    const result = (await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    )) as any;

    expect(result.rulesFound).toBe(0);
    expect(engine.evaluateAll).not.toHaveBeenCalled();
  });

  it("returns skipped=true when no risk snapshot is available", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([makeAlertRule()]);
    prisma.riskMetricSnapshot.findFirst.mockResolvedValueOnce(null);
    const { processor } = buildProcessor(prisma);

    const result = (await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    )) as any;

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("No risk metric snapshot");
  });

  it("calls evaluateAll with all active rules", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([makeAlertRule()]);
    const engine = buildMockEngine([{ triggered: false }]);
    const { processor } = buildProcessor(prisma, engine);

    await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    );

    expect(engine.evaluateAll).toHaveBeenCalledTimes(1);
    expect(engine.evaluateAll).toHaveBeenCalledWith(
      expect.objectContaining({ portfolioId: "p-001" }),
      expect.arrayContaining([expect.objectContaining({ id: "r-1" })]),
    );
  });

  it("enqueues one DISPATCH_NOTIFICATION job for a triggered rule with in_app channel", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([
      makeAlertRule({ channels: { in_app: true } }),
    ]);
    const engine = buildMockEngine([
      {
        triggered: true,
        logId: "log-abc",
        ruleId: "r-1",
        ruleName: "Drawdown Rule",
        violationMessage: "Drawdown 22% > 15%",
      },
    ]);
    const { processor, queue } = buildProcessor(prisma, engine);

    const result = (await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    )) as any;

    expect(result.triggered).toBe(1);
    expect(result.dispatched).toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      ALERT_JOBS.DISPATCH_NOTIFICATION,
      expect.objectContaining({ channel: "in_app", alertLogId: "log-abc" }),
      expect.objectContaining({ jobId: "dispatch:log-abc:in_app" }),
    );
  });

  it("enqueues two dispatch jobs when both in_app and email are enabled", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([
      makeAlertRule({ channels: { in_app: true, email: true } }),
    ]);
    const engine = buildMockEngine([
      {
        triggered: true,
        logId: "log-xyz",
        ruleId: "r-1",
        ruleName: "Vol Rule",
        violationMessage: "Vol 35% > 25%",
      },
    ]);
    const { processor, queue } = buildProcessor(prisma, engine);

    const result = (await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    )) as any;

    expect(result.dispatched).toBe(2);
    const channels = (queue.add.mock.calls as any[][]).map(
      (c) => (c[1] as { channel: string }).channel,
    );
    expect(channels).toContain("in_app");
    expect(channels).toContain("email");
  });

  it("enqueues three dispatch jobs when in_app, email, and webhook all enabled", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([
      makeAlertRule({ channels: { in_app: true, email: true, webhook: true } }),
    ]);
    const engine = buildMockEngine([
      {
        triggered: true,
        logId: "log-all",
        ruleId: "r-1",
        ruleName: "All Channels Rule",
      },
    ]);
    const { processor, queue } = buildProcessor(prisma, engine);

    const result = (await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    )) as any;

    expect(result.dispatched).toBe(3);
    const channels = (queue.add.mock.calls as any[][]).map(
      (c) => (c[1] as { channel: string }).channel,
    );
    expect(channels).toContain("in_app");
    expect(channels).toContain("email");
    expect(channels).toContain("webhook");
  });

  it("enqueues no dispatch jobs for suppressed rules", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([
      makeAlertRule({ lastTriggeredAt: new Date(Date.now() - 10 * 60_000) }),
    ]);
    const engine = buildMockEngine([{ triggered: false, suppressed: true }]);
    const { processor, queue } = buildProcessor(prisma, engine);

    const result = (await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    )) as any;

    expect(result.dispatched).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("handles unknown job names gracefully", async () => {
    const { processor } = buildProcessor();
    const result = (await processor.process(mockJob("some.unknown.job", {}) as any)) as any;
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("Unknown job");
  });

  it("snapshot correctly computes asset weights from holding currentValues", async () => {
    const prisma = buildMockPrisma();
    // 3 holdings: 500k + 300k + 200k = 1M total
    prisma.holding.findMany.mockResolvedValueOnce([
      {
        assetId: "a-001",
        currentValue: { toString: () => "500000" },
        asset: { symbol: "RELIANCE" },
      },
      { assetId: "a-002", currentValue: { toString: () => "300000" }, asset: { symbol: "TCS" } },
      { assetId: "a-003", currentValue: { toString: () => "200000" }, asset: { symbol: "INFY" } },
    ]);
    prisma.alertRule.findMany.mockResolvedValueOnce([makeAlertRule()]);
    const engine = buildMockEngine([{ triggered: false }]);
    const { processor } = buildProcessor(prisma, engine);

    await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    );

    const snapshot = engine.evaluateAll.mock.calls[0][0] as any;
    expect(snapshot.assetWeights["a-001"]).toBeCloseTo(0.5, 4);
    expect(snapshot.assetWeights["a-002"]).toBeCloseTo(0.3, 4);
    expect(snapshot.assetWeights["a-003"]).toBeCloseTo(0.2, 4);
    expect(snapshot.totalValue).toBeCloseTo(1_000_000, 0);
  });

  it("extracts sectorWeights from concentrationRisk JSON when present", async () => {
    const prisma = buildMockPrisma();
    prisma.riskMetricSnapshot.findFirst.mockResolvedValueOnce({
      id: "rms-001",
      volatilityAnnual: { toString: () => "0.18" },
      maxDrawdown: { toString: () => "0.08" },
      computedAt: new Date(),
      concentrationRisk: {
        sectorWeights: { Technology: 0.6, Finance: 0.4 },
      },
    });
    prisma.alertRule.findMany.mockResolvedValueOnce([makeAlertRule()]);
    const engine = buildMockEngine([{ triggered: false }]);
    const { processor } = buildProcessor(prisma, engine);

    await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    );

    const snapshot = engine.evaluateAll.mock.calls[0][0] as any;
    expect(snapshot.sectorWeights).toEqual({ Technology: 0.6, Finance: 0.4 });
  });

  it("returns summary counts (triggered, suppressed, dispatched) in result", async () => {
    const prisma = buildMockPrisma();
    prisma.alertRule.findMany.mockResolvedValueOnce([
      makeAlertRule({ id: "r-1" }),
      makeAlertRule({ id: "r-2", name: "Rule 2" }),
    ]);
    const engine = buildMockEngine([
      { triggered: true, logId: "log-1", ruleId: "r-1", ruleName: "Rule 1" },
      { triggered: false, suppressed: true, ruleId: "r-2", ruleName: "Rule 2" },
    ]);
    const { processor } = buildProcessor(prisma, engine);

    const result = (await processor.process(
      mockJob(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, makeEvalJobPayload()) as any,
    )) as any;

    expect(result.rulesFound).toBe(2);
    expect(result.triggered).toBe(1);
    expect(result.suppressed).toBe(1);
    expect(result.dispatched).toBe(1);
  });
});

// =============================================================================
// TIER 3: NotificationProcessor — DISPATCH_NOTIFICATION
// =============================================================================

describe("NotificationProcessor — DISPATCH_NOTIFICATION", () => {
  it("marks AlertLog as DELIVERED with deliveredAt after in_app dispatch", async () => {
    const { processor, prisma } = buildProcessor();
    await processor.process(
      mockJob(ALERT_JOBS.DISPATCH_NOTIFICATION, makeDispatchPayload("in_app")) as any,
    );

    expect(prisma.alertLog.update).toHaveBeenCalledWith({
      where: { id: "log-001" },
      data: expect.objectContaining({
        deliveryStatus: DeliveryStatus.DELIVERED,
        deliveredAt: expect.any(Date),
      }),
    });
  });

  it("marks AlertLog as DELIVERED after email dispatch", async () => {
    const { processor, prisma } = buildProcessor();
    await processor.process(
      mockJob(ALERT_JOBS.DISPATCH_NOTIFICATION, makeDispatchPayload("email")) as any,
    );
    expect(prisma.alertLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryStatus: DeliveryStatus.DELIVERED }),
      }),
    );
  });

  it("marks AlertLog as DELIVERED after webhook dispatch", async () => {
    const { processor, prisma } = buildProcessor();
    await processor.process(
      mockJob(ALERT_JOBS.DISPATCH_NOTIFICATION, makeDispatchPayload("webhook")) as any,
    );
    expect(prisma.alertLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryStatus: DeliveryStatus.DELIVERED }),
      }),
    );
  });

  it("returns dispatched=true and channel in result on success", async () => {
    const { processor } = buildProcessor();
    const result = (await processor.process(
      mockJob(ALERT_JOBS.DISPATCH_NOTIFICATION, makeDispatchPayload("in_app")) as any,
    )) as any;
    expect(result.dispatched).toBe(true);
    expect(result.channel).toBe("in_app");
    expect(typeof result.durationMs).toBe("number");
  });

  it("marks AlertLog as FAILED and re-throws when the DELIVERED update fails", async () => {
    const prisma = buildMockPrisma();
    // First call (DELIVERED update) throws; second call (FAILED update) succeeds
    prisma.alertLog.update
      .mockRejectedValueOnce(new Error("Network partition"))
      .mockResolvedValueOnce({});

    const { processor } = buildProcessor(prisma);
    await expect(
      processor.process(
        mockJob(ALERT_JOBS.DISPATCH_NOTIFICATION, makeDispatchPayload("in_app")) as any,
      ),
    ).rejects.toThrow("Network partition");

    expect(prisma.alertLog.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryStatus: DeliveryStatus.FAILED,
          errorMessage: expect.stringContaining("Network partition"),
        }),
      }),
    );
  });

  it("truncates errorMessage to 1000 chars to fit DB column", async () => {
    const prisma = buildMockPrisma();
    const longError = "E".repeat(2000);
    prisma.alertLog.update.mockRejectedValueOnce(new Error(longError)).mockResolvedValueOnce({});

    const { processor } = buildProcessor(prisma);
    await expect(
      processor.process(
        mockJob(ALERT_JOBS.DISPATCH_NOTIFICATION, makeDispatchPayload("email")) as any,
      ),
    ).rejects.toThrow();

    const failedUpdate = prisma.alertLog.update.mock.calls.find(
      (call: any[]) => call[0].data?.deliveryStatus === DeliveryStatus.FAILED,
    );
    expect(failedUpdate![0].data.errorMessage.length).toBeLessThanOrEqual(1000);
  });
});
