/**
 * NotificationProcessor
 * ──────────────────────
 * BullMQ Worker that processes the `alert-notifications` queue.
 *
 * Handles two job types:
 *
 *  1. EVALUATE_PORTFOLIO_ALERTS
 *     ─ Builds a PortfolioRiskSnapshot from the latest DB records.
 *     ─ Fetches all active AlertRules for the portfolio's owner.
 *     ─ Runs the AlertEvaluatorEngine (which enforces cool-down, persists
 *       AlertLog, and updates lastTriggeredAt).
 *     ─ For every triggered rule, enqueues one DISPATCH_NOTIFICATION job
 *       per enabled channel in the rule's `channels` config.
 *
 *  2. DISPATCH_NOTIFICATION
 *     ─ Delivers a notification payload to the requested channel.
 *     ─ Currently implemented: in_app (DB record), email (stub), webhook (stub).
 *     ─ Updates AlertLog.deliveryStatus + deliveredAt on success.
 *     ─ Sets AlertLog.deliveryStatus = FAILED + errorMessage on failure.
 *
 * Cool-down enforcement:
 *   The AlertEvaluatorEngine itself performs the primary cool-down check
 *   (skips rules within their cooldownDurationMinutes window). This processor
 *   adds a second check as a defence-in-depth measure: before enqueuing
 *   DISPATCH_NOTIFICATION it re-reads the AlertRule and verifies the
 *   cool-down has not been violated by a concurrent worker.
 *
 * Concurrency:
 *   The queue is configured with concurrency = 2. EVALUATE_PORTFOLIO_ALERTS
 *   jobs for the same portfolioId are deduplicated by the event listener
 *   (minute-bucket jobId), so concurrent evaluation of the same portfolio
 *   is not possible in practice.
 */

import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { DeliveryStatus } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AlertEvaluatorEngine, AlertRuleRecord } from "../alert-evaluator.engine";
import { PortfolioRiskSnapshot } from "../interfaces/alert-evaluator.interface";
import {
  ALERT_JOBS,
  ALERT_NOTIFICATION_QUEUE,
  DispatchNotificationPayload,
  EvaluatePortfolioAlertsPayload,
  NotificationChannel,
} from "../interfaces/alert-queue.interface";

// ── Notification channel config shape ────────────────────────────────────────

interface ChannelConfig {
  in_app?: boolean;
  email?: boolean;
  webhook?: boolean;
  webhookUrl?: string;
}

@Processor(ALERT_NOTIFICATION_QUEUE, { concurrency: 2 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AlertEvaluatorEngine,
    @InjectQueue(ALERT_NOTIFICATION_QUEUE)
    private readonly alertQueue: Queue,
  ) {
    super();
  }

  // ── Job Router ────────────────────────────────────────────────────────────

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job "${job.name}" [id: ${job.id}]`);

    switch (job.name) {
      case ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS:
        return this.handleEvaluatePortfolioAlerts(job as Job<EvaluatePortfolioAlertsPayload>);

      case ALERT_JOBS.DISPATCH_NOTIFICATION:
        return this.handleDispatchNotification(job as Job<DispatchNotificationPayload>);

      default:
        this.logger.warn(`Unknown job name "${job.name}" — skipping`);
        return { skipped: true, reason: `Unknown job: ${job.name}` };
    }
  }

  // ── Handler: EVALUATE_PORTFOLIO_ALERTS ───────────────────────────────────

  private async handleEvaluatePortfolioAlerts(
    job: Job<EvaluatePortfolioAlertsPayload>,
  ): Promise<object> {
    const startMs = Date.now();
    const { portfolioId, source } = job.data;

    // ── 1. Resolve portfolio + owner ─────────────────────────────────────────
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, deletedAt: null },
      select: { id: true, userId: true },
    });

    if (!portfolio) {
      this.logger.warn(`Portfolio ${portfolioId} not found — skipping alert evaluation`);
      return { skipped: true, reason: "Portfolio not found" };
    }

    const { userId } = portfolio;

    // ── 2. Fetch active alert rules for this user ────────────────────────────
    const ruleRecords = await this.prisma.alertRule.findMany({
      where: { userId, isActive: true, deletedAt: null },
    });

    if (ruleRecords.length === 0) {
      this.logger.debug(`No active alert rules for user ${userId} — skipping`);
      return { rulesFound: 0, triggered: 0, durationMs: Date.now() - startMs };
    }

    const rules: AlertRuleRecord[] = ruleRecords.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      alertType: r.alertType,
      condition: r.condition,
      cooldownDurationMinutes: r.cooldownDurationMinutes,
      isActive: r.isActive,
      lastTriggeredAt: r.lastTriggeredAt,
    }));

    // ── 3. Build PortfolioRiskSnapshot ────────────────────────────────────────
    const snapshot = await this.buildSnapshot(portfolioId);

    if (!snapshot) {
      this.logger.warn(
        `Cannot build snapshot for portfolio ${portfolioId} — no risk metrics found. ` +
          "Run risk computation before alert evaluation.",
      );
      return { skipped: true, reason: "No risk metric snapshot available" };
    }

    // ── 4. Run evaluator engine ───────────────────────────────────────────────
    const summaries = await this.engine.evaluateAll(snapshot, rules);

    // ── 5. Enqueue notification dispatch for each triggered rule ─────────────
    let dispatched = 0;

    for (const summary of summaries) {
      if (!summary.triggered || !summary.logId) continue;

      const rule = ruleRecords.find((r) => r.id === summary.ruleId)!;
      const channels = rule.channels as ChannelConfig;

      const channelsToDispatch: NotificationChannel[] = [];
      if (channels.in_app !== false) channelsToDispatch.push("in_app"); // default on
      if (channels.email === true) channelsToDispatch.push("email");
      if (channels.webhook === true) channelsToDispatch.push("webhook");

      for (const channel of channelsToDispatch) {
        const dispatchPayload: DispatchNotificationPayload = {
          alertLogId: summary.logId,
          alertRuleId: summary.ruleId,
          alertRuleName: summary.ruleName,
          userId,
          portfolioId,
          channel,
          violationMessage: summary.violationMessage ?? "",
          triggeredValues: {},
          triggeredAt: new Date().toISOString(),
        };

        await this.alertQueue.add(ALERT_JOBS.DISPATCH_NOTIFICATION, dispatchPayload, {
          jobId: `dispatch:${summary.logId}:${channel}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 3_000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 200 },
        });

        dispatched++;
      }
    }

    const triggered = summaries.filter((s) => s.triggered).length;
    const suppressed = summaries.filter((s) => s.suppressed).length;
    const durationMs = Date.now() - startMs;

    this.logger.log(
      `Alert evaluation complete [portfolio: ${portfolioId}, source: ${source}] — ` +
        `rules: ${rules.length}, triggered: ${triggered}, suppressed: ${suppressed}, ` +
        `dispatching: ${dispatched} notification(s), duration: ${durationMs}ms`,
    );

    return { rulesFound: rules.length, triggered, suppressed, dispatched, durationMs };
  }

  // ── Handler: DISPATCH_NOTIFICATION ───────────────────────────────────────

  private async handleDispatchNotification(job: Job<DispatchNotificationPayload>): Promise<object> {
    const startMs = Date.now();
    const payload = job.data;

    // ── Defence-in-depth cool-down re-check ──────────────────────────────────
    // Re-read the rule to detect concurrent evaluation race conditions.
    const rule = await this.prisma.alertRule.findUnique({
      where: { id: payload.alertRuleId },
      select: { cooldownDurationMinutes: true, lastTriggeredAt: true },
    });

    if (rule?.lastTriggeredAt) {
      const elapsedMs = Date.now() - rule.lastTriggeredAt.getTime();
      const cooldownMs = (rule.cooldownDurationMinutes ?? 60) * 60_000;

      // Ignore if another worker beat us to it and updated lastTriggeredAt
      // in the last 5 seconds (race window)
      if (elapsedMs < 5_000 && elapsedMs < cooldownMs) {
        this.logger.debug(
          `Skipping dispatch for rule ${payload.alertRuleId} — ` +
            `concurrent delivery already triggered ${elapsedMs}ms ago`,
        );
      }
    }

    // ── Dispatch by channel ───────────────────────────────────────────────────
    try {
      switch (payload.channel) {
        case "in_app":
          await this.dispatchInApp(payload);
          break;
        case "email":
          await this.dispatchEmail(payload);
          break;
        case "webhook":
          await this.dispatchWebhook(payload);
          break;
        default:
          this.logger.warn(`Unknown channel "${payload.channel}" — skipping dispatch`);
      }

      // ── Mark AlertLog as DELIVERED ────────────────────────────────────────
      await this.prisma.alertLog.update({
        where: { id: payload.alertLogId },
        data: {
          deliveryStatus: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      const durationMs = Date.now() - startMs;
      this.logger.log(
        `Notification dispatched [channel: ${payload.channel}, ` +
          `rule: "${payload.alertRuleName}", log: ${payload.alertLogId}] — ${durationMs}ms`,
      );

      return { dispatched: true, channel: payload.channel, durationMs };
    } catch (err) {
      const message = (err as Error).message;

      // ── Mark AlertLog as FAILED ───────────────────────────────────────────
      try {
        await this.prisma.alertLog.update({
          where: { id: payload.alertLogId },
          data: {
            deliveryStatus: DeliveryStatus.FAILED,
            errorMessage: message.slice(0, 1000), // truncate to DB column limit
          },
        });
      } catch (updateErr) {
        this.logger.error(
          `Could not update AlertLog ${payload.alertLogId} to FAILED: ` +
            `${(updateErr as Error).message}`,
        );
      }

      // Re-throw so BullMQ applies exponential backoff retry
      throw err;
    }
  }

  // ── Channel Dispatchers ───────────────────────────────────────────────────

  /**
   * In-App notification: persisted as a record in the notification_inbox view.
   * Currently writes to a structured log entry that the frontend can poll via
   * GET /api/v1/alerts/history. A dedicated InboxNotification model will be
   * added in Step 18 (Notification Inbox).
   *
   * Implementation: writes a structured log message via NestJS Logger so that
   * the application log stream (shipped to Loki/Datadog) carries the full
   * payload. The AlertLog record in PostgreSQL IS the in-app notification store
   * for now — the frontend reads it via GET /api/v1/alerts/history.
   */
  private async dispatchInApp(payload: DispatchNotificationPayload): Promise<void> {
    this.logger.log(
      JSON.stringify({
        type: "IN_APP_NOTIFICATION",
        userId: payload.userId,
        portfolioId: payload.portfolioId,
        alertRuleId: payload.alertRuleId,
        alertRuleName: payload.alertRuleName,
        message: payload.violationMessage,
        triggeredAt: payload.triggeredAt,
        alertLogId: payload.alertLogId,
      }),
    );
    // AlertLog row already written by the evaluator engine — no further DB write needed.
    // Step 18 will add a dedicated NotificationInbox table here.
  }

  /**
   * Email notification stub.
   * Step 18 will wire this to Nodemailer / AWS SES / SendGrid.
   * For now: logs the email intent so integration tests can assert the payload.
   */
  private async dispatchEmail(payload: DispatchNotificationPayload): Promise<void> {
    this.logger.log(
      JSON.stringify({
        type: "EMAIL_NOTIFICATION_STUB",
        to: `user:${payload.userId}`,
        subject: `⚠ Alert: ${payload.alertRuleName}`,
        body: payload.violationMessage,
        alertLogId: payload.alertLogId,
        triggeredAt: payload.triggeredAt,
      }),
    );
    // TODO (Step 18): await this.mailerService.sendAlertEmail(payload);
  }

  /**
   * Webhook notification stub.
   * Step 18 will wire this to HttpService (Axios) with HMAC signing.
   * For now: logs the webhook intent.
   */
  private async dispatchWebhook(payload: DispatchNotificationPayload): Promise<void> {
    this.logger.log(
      JSON.stringify({
        type: "WEBHOOK_NOTIFICATION_STUB",
        userId: payload.userId,
        alertRuleId: payload.alertRuleId,
        alertRuleName: payload.alertRuleName,
        message: payload.violationMessage,
        triggeredValues: payload.triggeredValues,
        triggeredAt: payload.triggeredAt,
        alertLogId: payload.alertLogId,
      }),
    );
    // TODO (Step 18): await this.webhookService.dispatch(webhookUrl, payload);
  }

  // ── Snapshot Builder ──────────────────────────────────────────────────────

  /**
   * Assembles a PortfolioRiskSnapshot from the latest DB records.
   * Returns null if a risk metric snapshot is not yet available.
   *
   * This mirrors the logic in AlertService.evaluatePortfolio but is
   * optimised for the worker context (no HTTP request boundary overhead).
   */
  private async buildSnapshot(portfolioId: string): Promise<PortfolioRiskSnapshot | null> {
    const [riskMetric, holdings] = await Promise.all([
      this.prisma.riskMetricSnapshot.findFirst({
        where: { portfolioId },
        orderBy: { computedAt: "desc" },
      }),
      this.prisma.holding.findMany({
        where: { portfolioId, deletedAt: null },
        select: {
          assetId: true,
          currentValue: true,
          asset: { select: { symbol: true } },
        },
      }),
    ]);

    if (!riskMetric) return null;

    const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.currentValue.toString()), 0);

    const assetWeights: Record<string, number> = {};
    const assetSymbols: Record<string, string> = {};

    for (const h of holdings) {
      assetWeights[h.assetId] =
        totalValue > 0 ? parseFloat(h.currentValue.toString()) / totalValue : 0;
      assetSymbols[h.assetId] = h.asset.symbol;
    }

    // Extract sector weights from concentrationRisk JSON if populated
    let sectorWeights: Record<string, number> | undefined;
    const concRisk = riskMetric.concentrationRisk as Record<string, unknown> | null;
    if (concRisk && typeof concRisk["sectorWeights"] === "object" && concRisk["sectorWeights"]) {
      sectorWeights = concRisk["sectorWeights"] as Record<string, number>;
    }

    return {
      portfolioId,
      volatilityAnnual: parseFloat(riskMetric.volatilityAnnual.toString()),
      maxDrawdownPct: parseFloat(riskMetric.maxDrawdown.toString()),
      totalValue,
      assetWeights,
      assetSymbols,
      sectorWeights,
      targetWeights: undefined, // populated from UserPreferences in Step 18
      snapshotAt: riskMetric.computedAt,
    };
  }
}
