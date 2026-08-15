import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseArrayPipe,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { MarketDataService } from "../services/market-data.service";
import { MarketDataScheduler } from "../workers/market-data.scheduler";
import { AssetClassCode } from "@prisma/client";

/**
 * REST controller for the Market Data module.
 * All endpoints are JWT-protected.
 *
 * Base path: /api/v1/market-data
 */
@UseGuards(JwtAuthGuard)
@Controller("api/v1/market-data")
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly scheduler: MarketDataScheduler,
  ) {}

  /**
   * GET /api/v1/market-data/prices?symbols=INFY,BTC&assetClass=STOCKS,CRYPTO
   *
   * Batch price lookup — cache-first.
   * Returns prices for all requested symbols with freshness metadata.
   *
   * Query params:
   *  - symbols: comma-separated list of ticker symbols (required)
   *  - assetClass: comma-separated list of AssetClassCode values (optional, defaults to STOCKS)
   */
  @Get("prices")
  async getBatchPrices(
    @Query("symbols") symbolsParam: string,
    @Query("assetClass") assetClassParam?: string,
  ) {
    if (!symbolsParam) {
      throw new BadRequestException("symbols query param is required");
    }

    const symbols = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const assetClasses = assetClassParam
      ? assetClassParam.split(",").map((c) => c.trim().toUpperCase() as AssetClassCode)
      : symbols.map(() => AssetClassCode.STOCKS);

    if (symbols.length !== assetClasses.length && assetClasses.length !== 1) {
      throw new BadRequestException(
        "assetClass must have the same number of values as symbols, or a single default value",
      );
    }

    const requests = symbols.map((symbol, i) => ({
      symbol,
      assetClass: assetClasses.length === 1 ? assetClasses[0] : assetClasses[i],
    }));

    const priceMap = await this.marketDataService.getBatchPrices(requests);

    const response = symbols.map((symbol) => {
      const quote = priceMap.get(symbol);
      return {
        symbol,
        found: !!quote,
        price: quote?.price ?? null,
        currency: quote?.currency ?? "INR",
        priceTimestamp: quote?.priceTimestamp?.toISOString() ?? null,
        source: quote?.source ?? null,
        isStale: quote?.isStale ?? true,
        isMarketClosed: quote?.isMarketClosed ?? false,
        ageSeconds: quote?.ageSeconds ?? null,
        ohlcv: quote
          ? {
              open: quote.openPrice ?? null,
              high: quote.highPrice ?? null,
              low: quote.lowPrice ?? null,
              close: quote.closePrice ?? null,
              volume: quote.volume ?? null,
            }
          : null,
      };
    });

    return {
      prices: response,
      fetchedAt: new Date().toISOString(),
      cacheHits: response.filter((r) => r.found && !r.isStale).length,
      total: symbols.length,
    };
  }

  /**
   * GET /api/v1/market-data/prices/:symbol
   *
   * Single symbol price with full staleness metadata.
   * Query param: assetClass (default: STOCKS)
   */
  @Get("prices/:symbol")
  async getPrice(
    @Param("symbol") symbol: string,
    @Query("assetClass") assetClass: AssetClassCode = AssetClassCode.STOCKS,
  ) {
    const quote = await this.marketDataService.getPrice(symbol.toUpperCase(), assetClass);

    if (!quote) {
      return {
        symbol: symbol.toUpperCase(),
        found: false,
        message: "No price data available for this symbol",
      };
    }

    return {
      symbol: quote.symbol,
      found: true,
      price: quote.price,
      currency: quote.currency,
      priceTimestamp: quote.priceTimestamp.toISOString(),
      source: quote.source,
      isStale: quote.isStale ?? false,
      isMarketClosed: quote.isMarketClosed ?? false,
      ageSeconds: quote.ageSeconds ?? null,
      ohlcv: {
        open: quote.openPrice ?? null,
        high: quote.highPrice ?? null,
        low: quote.lowPrice ?? null,
        close: quote.closePrice ?? null,
        volume: quote.volume ?? null,
      },
    };
  }

  /**
   * POST /api/v1/market-data/prices/refresh
   *
   * Force-enqueues a price refresh job for a specific symbol.
   * Used by admins/debug tooling to bypass cache and immediately re-fetch.
   *
   * Body: { symbol: string; assetClass: AssetClassCode }
   */
  @Post("prices/refresh")
  @HttpCode(HttpStatus.ACCEPTED)
  async forceRefresh(@Body() body: { symbol: string; assetClass?: AssetClassCode }) {
    if (!body?.symbol) {
      throw new BadRequestException("symbol is required in request body");
    }

    const result = await this.scheduler.enqueueSinglePriceRefresh(
      body.symbol.toUpperCase(),
      body.assetClass ?? AssetClassCode.STOCKS,
    );

    this.logger.log(`Manual refresh enqueued for ${body.symbol} (jobId: ${result.jobId})`);

    return {
      accepted: true,
      symbol: body.symbol.toUpperCase(),
      jobId: result.jobId,
      message: "Price refresh job enqueued. Price will be updated within seconds.",
    };
  }

  /**
   * GET /api/v1/market-data/status
   *
   * Returns the pipeline health status:
   *  - Circuit breaker state per provider
   *  - Scheduled job registry (name, cron, next execution)
   *  - Stale data summary (symbols with stale prices)
   */
  @Get("status")
  async getPipelineStatus() {
    const [providerStatus, scheduledJobs, staleReport] = await Promise.all([
      this.marketDataService.getPipelineStatus(),
      this.scheduler.getScheduledJobs(),
      this.marketDataService.getStaleDataReport(),
    ]);

    const staleSymbols = staleReport.filter((r) => !r.isFresh);

    return {
      providers: providerStatus,
      scheduledJobs,
      cache: {
        totalCached: staleReport.length,
        staleCount: staleSymbols.length,
        staleSymbols: staleSymbols.map((s) => ({
          symbol: s.symbol,
          ageSeconds: s.ageSeconds,
          source: s.source,
        })),
      },
      checkedAt: new Date().toISOString(),
    };
  }
}
