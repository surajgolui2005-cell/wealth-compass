/**
 * AlertEventListener
 * ──────────────────
 * Listens to domain events emitted by the Portfolio and Calculator modules
 * and enqueues asynchronous alert evaluation jobs into the BullMQ queue.
 *
 * This is the ONLY coupling point between the portfolio write-path and the
 * alert engine. By decoupling via events + queue:
 *   – The API request that triggered the portfolio update returns immediately.
 *   – Alert evaluation runs fully in a background worker thread.
 *   – Failures in alert evaluation never affect core portfolio operations.
 *
 * Events Listened:
 *   'portfolio.updated'   — emitted by TransactionService after any transaction
 *   'holding.updated'     — emitted by TransactionService after holding state change
 *
 * Job Deduplication:
 *   A stable jobId of `alert-eval:{portfolioId}:{minuteBucket}` means that if
 *   multiple transactions fire within the same minute, only ONE evaluation job
 *   is enqueued (BullMQ deduplicates by jobId). This prevents evaluation storms
 *   when a bulk import touches many holdings rapidly.
 */

import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  ALERT_JOBS,
  ALERT_NOTIFICATION_QUEUE,
  EvaluatePortfolioAlertsPayload,
} from "./interfaces/alert-queue.interface";

/** Payload shape emitted by TransactionService for 'portfolio.updated' */
interface PortfolioUpdatedEvent {
  portfolioId: string;
  totalValue: string;
}

/** Payload shape emitted by TransactionService for 'holding.updated' */
interface HoldingUpdatedEvent {
  holdingId: string;
  portfolioId: string;
  symbol: string;
  quantity: unknown;
  currentValue: unknown;
}

@Injectable()
export class AlertEventListener {
  private readonly logger = new Logger(AlertEventListener.name);

  constructor(
    @InjectQueue(ALERT_NOTIFICATION_QUEUE)
    private readonly alertQueue: Queue,
  ) {}

  // ── portfolio.updated ─────────────────────────────────────────────────────

  /**
   * Handles 'portfolio.updated' — the primary trigger for alert evaluation.
   *
   * Fired by TransactionService after every recordTransaction() call.
   * We resolve the userId from the portfolio's owner via the queue payload
   * (the processor queries DB for active alert rules scoped to the owner).
   *
   * Deduplication: one evaluation per portfolio per minute.
   */
  @OnEvent("portfolio.updated", { async: true })
  async onPortfolioUpdated(event: PortfolioUpdatedEvent): Promise<void> {
    const { portfolioId } = event;
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const jobId = `alert-eval:${portfolioId}:${minuteBucket}`;

    try {
      const existing = await this.alertQueue.getJob(jobId);
      if (existing) {
        this.logger.debug(
          `Alert evaluation already queued for portfolio ${portfolioId} this minute — skipping`,
        );
        return;
      }

      const payload: EvaluatePortfolioAlertsPayload = {
        portfolioId,
        userId: "", // resolved inside the processor from the portfolio owner
        triggeredAt: new Date().toISOString(),
        source: "portfolio.updated",
      };

      await this.alertQueue.add(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, payload, {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
        // Delay by 2 seconds to allow the DB transaction to fully commit
        // before the processor tries to read the latest snapshot.
        delay: 2_000,
      });

      this.logger.log(
        `Enqueued alert evaluation for portfolio ${portfolioId} ` +
          `[job: ${jobId}, source: portfolio.updated]`,
      );
    } catch (err) {
      // Never let event listener failure propagate back to the caller
      this.logger.error(
        `Failed to enqueue alert evaluation for portfolio ${portfolioId}: ` +
          `${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ── holding.updated ───────────────────────────────────────────────────────

  /**
   * Handles 'holding.updated' — secondary trigger for concentration checks.
   *
   * Weight rebalancing alerts care about individual holding changes, not just
   * the total portfolio value. We queue the same job type (the processor
   * evaluates ALL active rules anyway), with a separate source tag for
   * observability.
   *
   * The same minute-bucket deduplication applies — if portfolio.updated also
   * fired (which it always does for transactions), this is a no-op.
   */
  @OnEvent("holding.updated", { async: true })
  async onHoldingUpdated(event: HoldingUpdatedEvent): Promise<void> {
    const { portfolioId } = event;
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const jobId = `alert-eval:${portfolioId}:${minuteBucket}`;

    try {
      const existing = await this.alertQueue.getJob(jobId);
      if (existing) {
        // Already queued this minute (from portfolio.updated or a prior holding update)
        return;
      }

      const payload: EvaluatePortfolioAlertsPayload = {
        portfolioId,
        userId: "",
        triggeredAt: new Date().toISOString(),
        source: "holding.updated",
      };

      await this.alertQueue.add(ALERT_JOBS.EVALUATE_PORTFOLIO_ALERTS, payload, {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
        delay: 2_000,
      });

      this.logger.debug(
        `Enqueued alert evaluation for portfolio ${portfolioId} [source: holding.updated]`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue holding-update alert evaluation: ${(err as Error).message}`,
      );
    }
  }
}
