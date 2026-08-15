import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { MARKET_DATA_QUEUE, MARKET_DATA_JOBS } from "../interfaces/price-cache.interface";

/**
 * Cron job schedule definitions for each price fetch job.
 *
 * IST timezone handling: BullMQ cron runs in UTC by default.
 * We convert IST times to UTC for FETCH_MF_NAV:
 *   21:30 IST = 16:00 UTC (IST is UTC+5:30)
 */
const CRON_SCHEDULES = {
  /** Every 5 minutes, 24/7 — crypto is always open */
  CRYPTO: "*/5 * * * *",
  /** Every 15 minutes on Mon–Fri — NSE trading hours */
  EQUITY: "*/15 * * * 1-5",
  /** Daily at 16:00 UTC (21:30 IST), Mon–Fri — AMFI NAV EOD */
  MF_NAV: "0 16 * * 1-5",
} as const;

/**
 * BullMQ job retry configuration.
 * Exponential backoff with a cap at 5 attempts before moving to dead-letter.
 */
const JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5_000, // 5s base → 10s → 20s
  },
  removeOnComplete: { count: 50 }, // keep last 50 completed jobs per type
  removeOnFail: { count: 100 }, // keep last 100 failed jobs for inspection
};

/**
 * BullMQ cron job scheduler.
 *
 * Registers all recurring price fetch jobs into the `market-data` queue
 * on application startup. Uses `jobId` for deduplication — BullMQ guarantees
 * that only one instance of a named cron job runs at a time across all workers.
 *
 * Design notes:
 *  - All jobs are idempotent — safe to run even if the previous run is still
 *    in progress (BullMQ deduplicates by jobId).
 *  - We use `add()` with `repeat.pattern` instead of `Queue.addBulk()` so that
 *    each schedule is independently controllable.
 *  - Jobs are registered with a fixed `jobId` prefix to allow targeted removal
 *    via the BullMQ UI or admin API without affecting other jobs.
 */
@Injectable()
export class MarketDataScheduler implements OnModuleInit {
  private readonly logger = new Logger(MarketDataScheduler.name);

  constructor(
    @InjectQueue(MARKET_DATA_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerCronJobs();
  }

  /**
   * Registers all scheduled market data jobs.
   * Uses `upsert` behaviour — existing repeatable jobs with the same key
   * are replaced if the schedule has changed.
   */
  private async registerCronJobs(): Promise<void> {
    this.logger.log("Registering market data cron jobs...");

    try {
      // ── Crypto Price Refresh (every 5 min) ──────────────────────────────
      await this.queue.upsertJobScheduler(
        `repeatable:${MARKET_DATA_JOBS.FETCH_CRYPTO_PRICES}`,
        { pattern: CRON_SCHEDULES.CRYPTO },
        {
          name: MARKET_DATA_JOBS.FETCH_CRYPTO_PRICES,
          data: {},
          opts: JOB_OPTIONS,
        },
      );

      this.logger.log(
        `Registered ${MARKET_DATA_JOBS.FETCH_CRYPTO_PRICES} — cron: ${CRON_SCHEDULES.CRYPTO}`,
      );

      // ── Equity Price Refresh (every 15 min, weekdays) ───────────────────
      await this.queue.upsertJobScheduler(
        `repeatable:${MARKET_DATA_JOBS.FETCH_EQUITY_PRICES}`,
        { pattern: CRON_SCHEDULES.EQUITY },
        {
          name: MARKET_DATA_JOBS.FETCH_EQUITY_PRICES,
          data: {},
          opts: JOB_OPTIONS,
        },
      );

      this.logger.log(
        `Registered ${MARKET_DATA_JOBS.FETCH_EQUITY_PRICES} — cron: ${CRON_SCHEDULES.EQUITY}`,
      );

      // ── Mutual Fund NAV (EOD, weekdays) ─────────────────────────────────
      await this.queue.upsertJobScheduler(
        `repeatable:${MARKET_DATA_JOBS.FETCH_MF_NAV}`,
        { pattern: CRON_SCHEDULES.MF_NAV },
        {
          name: MARKET_DATA_JOBS.FETCH_MF_NAV,
          data: {},
          opts: JOB_OPTIONS,
        },
      );

      this.logger.log(
        `Registered ${MARKET_DATA_JOBS.FETCH_MF_NAV} — cron: ${CRON_SCHEDULES.MF_NAV} (UTC = 21:30 IST)`,
      );

      // Log the current queue state
      const schedulers = await this.queue.getJobSchedulers();
      this.logger.log(
        `Market data queue has ${schedulers.length} scheduled job(s): ` +
          schedulers.map((s) => s.name || s.id).join(", "),
      );
    } catch (err: any) {
      this.logger.error(`Failed to register cron jobs: ${err.message}`, err.stack);
      // Non-fatal — app still starts but scheduled jobs won't run.
      // Alert should be fired here in production (Sentry/OTel).
    }
  }

  /**
   * Enqueues a one-off immediate job to refresh a single symbol's price.
   * Used by the REST controller's manual refresh endpoint.
   */
  async enqueueSinglePriceRefresh(symbol: string, assetClass: string): Promise<{ jobId: string }> {
    const job = await this.queue.add(
      MARKET_DATA_JOBS.FETCH_SINGLE_PRICE,
      { symbol, assetClass },
      {
        jobId: `single:${symbol}:${Date.now()}`,
        attempts: 2,
        backoff: { type: "fixed", delay: 2_000 },
        removeOnComplete: { count: 10 },
      },
    );
    this.logger.log(`Enqueued single price refresh for ${symbol} (job: ${job.id})`);
    return { jobId: job.id! };
  }

  /**
   * Returns a summary of all currently registered repeatable jobs.
   * Used by the /status endpoint.
   */
  async getScheduledJobs(): Promise<Array<{ name: string; cron: string; next: string }>> {
    const schedulers = await this.queue.getJobSchedulers();
    return schedulers.map((s) => ({
      name: s.name || s.id,
      cron: s.pattern ?? "unknown",
      next: s.next ? new Date(s.next).toISOString() : "pending",
    }));
  }
}
