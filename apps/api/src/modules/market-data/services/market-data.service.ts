import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";
import { AssetClassCode } from "@prisma/client";
import { PriceCacheService } from "./price-cache.service";
import { AlphaVantageProvider } from "../providers/alpha-vantage.provider";
import { CoinGeckoProvider } from "../providers/coingecko.provider";
import {
  MarketDataProvider,
  PriceQuote,
  ProviderUnavailableException,
} from "../interfaces/market-data-provider.interface";

/**
 * Market data orchestration service.
 *
 * Implements the 3-tier price resolution strategy:
 *
 *  Tier 1 — Redis cache hit  →  Return immediately (~1ms)
 *  Tier 2 — Cache miss       →  Fetch from external provider, cache + persist (~200–500ms)
 *  Tier 3 — Provider down    →  Return latest DB row with isStale: true flag (~10–50ms)
 *
 * This guarantees:
 *  - The system always returns a price (graceful degradation)
 *  - Callers can distinguish fresh vs. stale prices via the `isStale` flag
 *  - Historical prices are NEVER overwritten — only new rows are INSERTed
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  /** Ordered list of providers per asset class. First available wins. */
  private readonly providerMap: Partial<Record<AssetClassCode, MarketDataProvider[]>> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PriceCacheService,
    private readonly alphaVantage: AlphaVantageProvider,
    private readonly coinGecko: CoinGeckoProvider,
    private readonly config: ConfigService,
  ) {
    this.providerMap[AssetClassCode.STOCKS] = [this.alphaVantage];
    this.providerMap[AssetClassCode.ETFS] = [this.alphaVantage];
    this.providerMap[AssetClassCode.CRYPTO] = [this.coinGecko];
    // MUTUAL_FUNDS, BONDS, FIXED_DEPOSITS → no external provider yet; DB/manual only
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Primary entry point for price lookups.
   * Executes the 3-tier resolution strategy and returns enriched PriceQuote.
   */
  async getPrice(symbol: string, assetClass: AssetClassCode): Promise<PriceQuote | null> {
    // ── Tier 1: Redis Cache ──────────────────────────────────────────────────
    const cached = await this.cache.getPrice(symbol);
    if (cached) {
      this.logger.debug(`Cache HIT for ${symbol} (age: ${cached.ageSeconds}s)`);
      return cached;
    }

    this.logger.debug(`Cache MISS for ${symbol} — fetching from provider`);

    // ── Tier 2: External Provider ────────────────────────────────────────────
    const providers = this.providerMap[assetClass] ?? [];
    for (const provider of providers) {
      try {
        const quote = await provider.fetchPrice(symbol);
        // Persist + cache concurrently (fire-and-forget for cache, await for DB)
        await Promise.all([
          this.persistPriceSnapshot(symbol, assetClass, quote),
          this.cache.setPrice(quote, assetClass),
        ]);
        return quote;
      } catch (err: any) {
        if (err instanceof ProviderUnavailableException) {
          this.logger.warn(`Provider ${provider.getProviderName()} unavailable: ${err.reason}`);
        } else {
          this.logger.warn(
            `Provider ${provider.getProviderName()} failed for ${symbol}: ${err.message}`,
          );
        }
      }
    }

    // ── Tier 3: Database Fallback ────────────────────────────────────────────
    this.logger.warn(`All providers failed for ${symbol} — falling back to DB`);
    return this.getLatestPriceFromDb(symbol, assetClass);
  }

  /**
   * Batch price resolution — uses MGET for cache, then fans out to providers for misses.
   * Optimised for portfolio valuation which needs N prices in one shot.
   */
  async getBatchPrices(
    requests: Array<{ symbol: string; assetClass: AssetClassCode }>,
  ): Promise<Map<string, PriceQuote>> {
    const result = new Map<string, PriceQuote>();
    if (requests.length === 0) return result;

    // ── Tier 1: Batch Cache Lookup ───────────────────────────────────────────
    const symbols = requests.map((r) => r.symbol);
    const cacheHits = await this.cache.getBatchPrices(symbols);

    const misses: Array<{ symbol: string; assetClass: AssetClassCode }> = [];
    for (const req of requests) {
      const hit = cacheHits.get(req.symbol.toUpperCase());
      if (hit) {
        result.set(req.symbol.toUpperCase(), hit);
      } else {
        misses.push(req);
      }
    }

    if (misses.length === 0) {
      this.logger.debug(`Batch cache 100% hit for ${symbols.length} symbols`);
      return result;
    }

    this.logger.log(
      `Batch cache hit ${result.size}/${requests.length} — fetching ${misses.length} misses`,
    );

    // ── Tier 2: Provider Batch Fetch (grouped by asset class) ────────────────
    const byAssetClass = this.groupByAssetClass(misses);

    for (const [assetClass, items] of byAssetClass.entries()) {
      const providers = this.providerMap[assetClass] ?? [];
      const missSymbols = items.map((i) => i.symbol);

      let providerFetched = false;
      for (const provider of providers) {
        try {
          const quotes = await provider.fetchBatchPrices(missSymbols);
          // Persist + cache the fetched quotes
          const quoteArray = Array.from(quotes.values());
          await Promise.all([
            ...quoteArray.map((q) => this.persistPriceSnapshot(q.symbol, assetClass, q)),
            this.cache.setBatchPrices(quoteArray, assetClass),
          ]);
          quotes.forEach((q, sym) => result.set(sym, q));
          providerFetched = true;
          break;
        } catch (err: any) {
          this.logger.warn(`Batch provider ${provider.getProviderName()} failed: ${err.message}`);
        }
      }

      // ── Tier 3: DB Fallback for remaining misses ──────────────────────────
      if (!providerFetched) {
        for (const item of items) {
          const fallback = await this.getLatestPriceFromDb(item.symbol, item.assetClass);
          if (fallback) result.set(item.symbol.toUpperCase(), fallback);
        }
      }
    }

    return result;
  }

  /**
   * Fetches, caches, and persists prices for a list of active holdings.
   * Called by the BullMQ processor on scheduled cron jobs.
   */
  async batchUpdatePrices(
    holdings: Array<{ symbol: string; assetClass: AssetClassCode; assetId: string }>,
  ): Promise<{ updated: number; failed: number; stale: string[] }> {
    let updated = 0;
    let failed = 0;
    const stale: string[] = [];

    const byAssetClass = this.groupByAssetClass(holdings);

    for (const [assetClass, items] of byAssetClass.entries()) {
      const providers = this.providerMap[assetClass] ?? [];
      if (providers.length === 0) {
        this.logger.debug(`No provider configured for ${assetClass} — skipping batch`);
        continue;
      }

      const symbols = items.map((i) => i.symbol);
      let success = false;

      for (const provider of providers) {
        try {
          const quotes = await provider.fetchBatchPrices(symbols);
          const quoteArr = Array.from(quotes.values());

          await Promise.all([
            ...quoteArr.map((q) => this.persistPriceSnapshot(q.symbol, assetClass, q)),
            this.cache.setBatchPrices(quoteArr, assetClass),
          ]);

          updated += quotes.size;
          const notFetched = symbols.filter((s) => !quotes.has(s.toUpperCase()));
          stale.push(...notFetched);
          success = true;
          break;
        } catch (err: any) {
          this.logger.warn(`batchUpdatePrices provider error (${assetClass}): ${err.message}`);
        }
      }

      if (!success) {
        failed += items.length;
        stale.push(...symbols);
      }
    }

    return { updated, failed, stale };
  }

  /**
   * Returns a staleness report for all actively cached symbols.
   * Used by the controller's /status endpoint.
   */
  async getStaleDataReport(): Promise<
    Array<{
      symbol: string;
      ageSeconds: number;
      isFresh: boolean;
      source: string | null;
    }>
  > {
    const cachedSymbols = await this.cache.getCachedSymbols();
    const report = await Promise.all(
      cachedSymbols.map(async (symbol) => {
        const meta = await this.cache.getPriceStaleness(symbol);
        return { symbol, ...meta };
      }),
    );
    return report.sort((a, b) => b.ageSeconds - a.ageSeconds);
  }

  /**
   * Returns the circuit breaker state for all configured providers.
   */
  getPipelineStatus(): Record<string, { circuitState: string; isMarketOpen: boolean }> {
    return {
      alpha_vantage: {
        circuitState: this.alphaVantage.getCircuitState(),
        isMarketOpen: this.alphaVantage.isMarketOpen(),
      },
      coingecko: {
        circuitState: this.coinGecko.getCircuitState(),
        isMarketOpen: this.coinGecko.isMarketOpen(),
      },
    };
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Reads the most recent MarketPrice row from DB for a given symbol.
   * Returns with isStale: true and isMarketClosed detection.
   */
  private async getLatestPriceFromDb(
    symbol: string,
    assetClass: AssetClassCode,
  ): Promise<PriceQuote | null> {
    try {
      const asset = await this.prisma.asset.findFirst({
        where: { symbol: symbol.toUpperCase(), isActive: true },
        include: {
          marketPrices: {
            orderBy: { priceTimestamp: "desc" },
            take: 1,
          },
        },
      });

      const latest = asset?.marketPrices?.[0];
      if (!latest) return null;

      const ageSeconds = Math.round((Date.now() - latest.priceTimestamp.getTime()) / 1000);

      return {
        symbol: symbol.toUpperCase(),
        price: Number(latest.price),
        currency: latest.currency,
        priceTimestamp: latest.priceTimestamp,
        source: `${latest.source}:db_fallback`,
        openPrice: latest.openPrice ? Number(latest.openPrice) : undefined,
        highPrice: latest.highPrice ? Number(latest.highPrice) : undefined,
        lowPrice: latest.lowPrice ? Number(latest.lowPrice) : undefined,
        closePrice: latest.closePrice ? Number(latest.closePrice) : undefined,
        volume: latest.volume ? Number(latest.volume) : undefined,
        isStale: true,
        ageSeconds,
        isMarketClosed: this.isWeekendOrHoliday(),
      };
    } catch (err: any) {
      this.logger.error(`DB fallback failed for ${symbol}: ${err.message}`);
      return null;
    }
  }

  /**
   * Inserts a new MarketPrice snapshot. Never updates existing rows.
   * Looks up or creates the Asset record by symbol.
   */
  private async persistPriceSnapshot(
    symbol: string,
    assetClass: AssetClassCode,
    quote: PriceQuote,
  ): Promise<void> {
    try {
      // Resolve asset — find by symbol, create if doesn't exist yet
      let asset = await this.prisma.asset.findFirst({
        where: { symbol: symbol.toUpperCase(), isActive: true },
      });

      if (!asset) {
        const assetClassRecord = await this.prisma.assetClass.findUnique({
          where: { code: assetClass },
        });
        if (!assetClassRecord) {
          this.logger.warn(`AssetClass ${assetClass} not seeded — skipping persist for ${symbol}`);
          return;
        }

        asset = await this.prisma.asset.create({
          data: {
            symbol: symbol.toUpperCase(),
            name: symbol.toUpperCase(),
            currency: quote.currency,
            isActive: true,
            assetClassId: assetClassRecord.id,
          },
        });
      }

      // INSERT new price row — never UPDATE
      await this.prisma.marketPrice.create({
        data: {
          assetId: asset.id,
          price: quote.price,
          openPrice: quote.openPrice ?? null,
          highPrice: quote.highPrice ?? null,
          lowPrice: quote.lowPrice ?? null,
          closePrice: quote.closePrice ?? null,
          volume: quote.volume ?? null,
          currency: quote.currency,
          priceTimestamp: quote.priceTimestamp,
          source: quote.source,
        },
      });
    } catch (err: any) {
      // Non-fatal — log and continue. DB persistence failure should not block
      // the price response or cache write.
      this.logger.error(`Failed to persist price for ${symbol}: ${err.message}`);
    }
  }

  private groupByAssetClass<T extends { assetClass: AssetClassCode }>(
    items: T[],
  ): Map<AssetClassCode, T[]> {
    const map = new Map<AssetClassCode, T[]>();
    for (const item of items) {
      const group = map.get(item.assetClass) ?? [];
      group.push(item);
      map.set(item.assetClass, group);
    }
    return map;
  }

  private isWeekendOrHoliday(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day = ist.getDay();
    return day === 0 || day === 6;
  }
}
