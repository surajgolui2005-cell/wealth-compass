import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../../prisma/prisma.service";
import { MarketDataService } from "../services/market-data.service";
import { AssetClassCode } from "@prisma/client";
import { MARKET_DATA_QUEUE, MARKET_DATA_JOBS } from "../interfaces/price-cache.interface";

/**
 * Payload shapes for each job type dispatched to the market-data queue.
 */
export interface FetchCryptoPricesJobPayload {
  /** Optional subset of symbols to refresh. If empty, refreshes all active crypto holdings. */
  symbols?: string[];
}

export interface FetchEquityPricesJobPayload {
  symbols?: string[];
}

export interface FetchSinglePriceJobPayload {
  symbol: string;
  assetClass: AssetClassCode;
  assetId: string;
}

/**
 * BullMQ Processor for the `market-data` queue.
 *
 * Handles three recurring job types dispatched by MarketDataScheduler:
 *  - FETCH_CRYPTO_PRICES  — every 5 minutes, 24/7
 *  - FETCH_EQUITY_PRICES  — every 15 minutes, weekdays Mon–Fri
 *  - FETCH_MF_NAV         — daily at 21:30 IST (EOD NAV update)
 *  - FETCH_SINGLE_PRICE   — on-demand for individual symbol refresh
 *
 * Error handling:
 *  - Individual job failures are logged and re-thrown so BullMQ can apply
 *    its retry/backoff policy (configured in MarketDataScheduler).
 *  - Partial batch failures are surfaced in the job result but do NOT
 *    fail the entire job — we log stale symbols and continue.
 */
@Processor(MARKET_DATA_QUEUE)
export class MarketDataProcessor extends WorkerHost {
  private readonly logger = new Logger(MarketDataProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
  ) {
    super();
  }

  /**
   * Job dispatch router. Delegates to specific handlers based on job name.
   */
  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job: ${job.name} (id: ${job.id})`);

    switch (job.name) {
      case MARKET_DATA_JOBS.FETCH_CRYPTO_PRICES:
        return this.handleFetchCryptoPrices(job as Job<FetchCryptoPricesJobPayload>);

      case MARKET_DATA_JOBS.FETCH_EQUITY_PRICES:
        return this.handleFetchEquityPrices(job as Job<FetchEquityPricesJobPayload>);

      case MARKET_DATA_JOBS.FETCH_MF_NAV:
        return this.handleFetchMfNav(job);

      case MARKET_DATA_JOBS.FETCH_SINGLE_PRICE:
        return this.handleFetchSinglePrice(job as Job<FetchSinglePriceJobPayload>);

      default:
        this.logger.warn(`Unknown job name: ${job.name} — skipping`);
        return { skipped: true, reason: `Unknown job: ${job.name}` };
    }
  }

  // ── Job Handlers ───────────────────────────────────────────────────────────

  private async handleFetchCryptoPrices(job: Job<FetchCryptoPricesJobPayload>): Promise<object> {
    const startMs = Date.now();

    // Resolve crypto symbols from job payload or query DB for all active crypto holdings
    const symbols = job.data?.symbols?.length
      ? job.data.symbols
      : await this.getActiveSymbolsByAssetClass(AssetClassCode.CRYPTO);

    if (symbols.length === 0) {
      this.logger.log("No active crypto holdings found — skipping FETCH_CRYPTO_PRICES");
      return { updated: 0, failed: 0, stale: [], durationMs: Date.now() - startMs };
    }

    const holdings = symbols.map((symbol) => ({
      symbol,
      assetClass: AssetClassCode.CRYPTO,
      assetId: "",
    }));

    const result = await this.marketDataService.batchUpdatePrices(holdings);

    const durationMs = Date.now() - startMs;
    this.logger.log(
      `FETCH_CRYPTO_PRICES complete — updated: ${result.updated}, failed: ${result.failed}, ` +
        `stale: [${result.stale.join(", ")}], duration: ${durationMs}ms`,
    );

    if (result.stale.length > 0) {
      this.logger.warn(`Stale crypto symbols after refresh: ${result.stale.join(", ")}`);
    }

    return { ...result, durationMs };
  }

  private async handleFetchEquityPrices(job: Job<FetchEquityPricesJobPayload>): Promise<object> {
    const startMs = Date.now();

    // Skip if weekend — NSE is closed Sat/Sun
    if (this.isWeekend()) {
      this.logger.log("FETCH_EQUITY_PRICES skipped — weekend (NSE closed)");
      return { skipped: true, reason: "weekend", durationMs: 0 };
    }

    const symbols = job.data?.symbols?.length
      ? job.data.symbols
      : await this.getActiveSymbolsByAssetClass(AssetClassCode.STOCKS);

    // Also include ETFs in the same run
    const etfSymbols = await this.getActiveSymbolsByAssetClass(AssetClassCode.ETFS);
    const allSymbols = [...new Set([...symbols, ...etfSymbols])];

    if (allSymbols.length === 0) {
      this.logger.log("No active equity/ETF holdings found — skipping FETCH_EQUITY_PRICES");
      return { updated: 0, failed: 0, stale: [], durationMs: Date.now() - startMs };
    }

    const holdings = [
      ...symbols.map((s) => ({ symbol: s, assetClass: AssetClassCode.STOCKS, assetId: "" })),
      ...etfSymbols.map((s) => ({ symbol: s, assetClass: AssetClassCode.ETFS, assetId: "" })),
    ];

    const result = await this.marketDataService.batchUpdatePrices(holdings);

    const durationMs = Date.now() - startMs;
    this.logger.log(
      `FETCH_EQUITY_PRICES complete — updated: ${result.updated}, failed: ${result.failed}, ` +
        `duration: ${durationMs}ms`,
    );

    return { ...result, durationMs };
  }

  private async handleFetchMfNav(job: Job): Promise<object> {
    const startMs = Date.now();
    // AMFI NAV parsing is a planned Phase 5.2 feature.
    // Placeholder: logs intent, returns informational result.
    this.logger.log(
      "FETCH_MF_NAV triggered — AMFI NAV parsing will be implemented in Phase 5.2. " +
        "Skipping MF NAV update.",
    );
    return {
      skipped: true,
      reason: "AMFI NAV parser not yet implemented (Phase 5.2)",
      durationMs: Date.now() - startMs,
    };
  }

  private async handleFetchSinglePrice(job: Job<FetchSinglePriceJobPayload>): Promise<object> {
    const { symbol, assetClass } = job.data;
    const startMs = Date.now();

    const quote = await this.marketDataService.getPrice(symbol, assetClass);
    const durationMs = Date.now() - startMs;

    if (!quote) {
      this.logger.warn(`FETCH_SINGLE_PRICE: No price found for ${symbol}`);
      return { symbol, found: false, durationMs };
    }

    this.logger.log(
      `FETCH_SINGLE_PRICE: ${symbol} = ₹${quote.price} (${quote.source}, ${durationMs}ms)`,
    );

    return { symbol, price: quote.price, source: quote.source, isStale: quote.isStale, durationMs };
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Queries the DB for all distinct symbols of active holdings for a given asset class.
   */
  private async getActiveSymbolsByAssetClass(assetClass: AssetClassCode): Promise<string[]> {
    const holdings = await this.prisma.holding.findMany({
      where: {
        deletedAt: null,
        asset: {
          assetClass: { code: assetClass },
          isActive: true,
        },
      },
      select: { symbol: true },
      distinct: ["symbol"],
    });

    return holdings.map((h) => h.symbol);
  }

  private isWeekend(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day = ist.getDay();
    return day === 0 || day === 6;
  }
}
