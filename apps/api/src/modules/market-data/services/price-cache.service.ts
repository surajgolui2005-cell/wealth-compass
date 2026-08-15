import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { AssetClassCode } from "@prisma/client";
import { PriceQuote } from "../interfaces/market-data-provider.interface";
import {
  buildPriceCacheKey,
  buildPriceMetaKey,
  CachedPriceEntry,
  PriceCacheMetadata,
  resolveTtlForAssetClass,
  STALENESS_THRESHOLD,
} from "../interfaces/price-cache.interface";

/**
 * Redis-backed price cache service.
 *
 * Responsibilities:
 *  - Write price quotes into Redis with asset-class-appropriate TTLs
 *  - Read single and batch price quotes from Redis (MGET for O(1) fan-out)
 *  - Report price staleness age without requiring a full cache miss
 *  - Detect IST market hours for dynamic TTL decisions
 *
 * Key design choices:
 *  - All values stored as JSON strings (compact, human-readable in Redis CLI)
 *  - Staleness metadata stored as separate lightweight key to avoid deserialising full quote
 *  - ioredis connection is owned by this service (not shared NestJS BullMQ connection)
 *    because cache reads are latency-critical and should not compete with BullMQ job I/O
 */
@Injectable()
export class PriceCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceCacheService.name);
  private redis: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>("REDIS_URL", "redis://localhost:6379");
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      reconnectOnError: (err) => {
        this.logger.error(`Redis reconnect triggered: ${err.message}`);
        return true; // always reconnect
      },
    });

    this.redis.on("connect", () => this.logger.log("PriceCacheService: Redis connected"));
    this.redis.on("error", (err) => this.logger.error(`Redis error: ${err.message}`));

    try {
      await this.redis.connect();
    } catch (err: any) {
      this.logger.error(
        `Failed to connect to Redis on init: ${err.message}. Cache will be unavailable.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  // ── Write Operations ───────────────────────────────────────────────────────

  /**
   * Persists a PriceQuote to Redis with the appropriate TTL for the given asset class.
   * Always overwrites the existing cached value (latest price wins).
   */
  async setPrice(quote: PriceQuote, assetClass: AssetClassCode): Promise<void> {
    const key = buildPriceCacheKey(quote.symbol);
    const metaKey = buildPriceMetaKey(quote.symbol);
    const now = new Date().toISOString();
    const ttl = resolveTtlForAssetClass(assetClass, this.isMarketHours());

    const entry: CachedPriceEntry = {
      symbol: quote.symbol,
      price: quote.price,
      currency: quote.currency,
      priceTimestamp: quote.priceTimestamp.toISOString(),
      source: quote.source,
      openPrice: quote.openPrice,
      highPrice: quote.highPrice,
      lowPrice: quote.lowPrice,
      closePrice: quote.closePrice,
      volume: quote.volume,
      cachedAt: now,
    };

    const meta: PriceCacheMetadata = {
      symbol: quote.symbol,
      cachedAt: now,
      ageSeconds: 0,
      ttlSeconds: ttl,
      source: quote.source,
    };

    const pipeline = this.redis.pipeline();
    pipeline.set(key, JSON.stringify(entry), "EX", ttl);
    pipeline.set(metaKey, JSON.stringify(meta), "EX", ttl + 60); // meta slightly longer TTL
    await pipeline.exec();

    this.logger.debug(`Cached price for ${quote.symbol}: ₹${quote.price} (TTL: ${ttl}s)`);
  }

  /**
   * Sets multiple prices in a single Redis pipeline — O(1) RTT regardless of batch size.
   */
  async setBatchPrices(quotes: PriceQuote[], assetClass: AssetClassCode): Promise<void> {
    if (quotes.length === 0) return;

    const now = new Date().toISOString();
    const ttl = resolveTtlForAssetClass(assetClass, this.isMarketHours());
    const pipeline = this.redis.pipeline();

    for (const quote of quotes) {
      const key = buildPriceCacheKey(quote.symbol);
      const metaKey = buildPriceMetaKey(quote.symbol);

      const entry: CachedPriceEntry = {
        symbol: quote.symbol,
        price: quote.price,
        currency: quote.currency,
        priceTimestamp: quote.priceTimestamp.toISOString(),
        source: quote.source,
        openPrice: quote.openPrice,
        highPrice: quote.highPrice,
        lowPrice: quote.lowPrice,
        closePrice: quote.closePrice,
        volume: quote.volume,
        cachedAt: now,
      };

      const meta: PriceCacheMetadata = {
        symbol: quote.symbol,
        cachedAt: now,
        ageSeconds: 0,
        ttlSeconds: ttl,
        source: quote.source,
      };

      pipeline.set(key, JSON.stringify(entry), "EX", ttl);
      pipeline.set(metaKey, JSON.stringify(meta), "EX", ttl + 60);
    }

    await pipeline.exec();
    this.logger.log(`Batch cached ${quotes.length} prices (TTL: ${ttl}s)`);
  }

  // ── Read Operations ────────────────────────────────────────────────────────

  /**
   * Returns a PriceQuote from Redis cache, or null on cache miss.
   * Never throws — cache unavailability is treated as a miss.
   */
  async getPrice(symbol: string): Promise<PriceQuote | null> {
    try {
      const raw = await this.redis.get(buildPriceCacheKey(symbol));
      if (!raw) return null;

      const entry: CachedPriceEntry = JSON.parse(raw);
      return this.entryToQuote(entry);
    } catch (err: any) {
      this.logger.warn(`Cache read failed for ${symbol}: ${err.message}`);
      return null;
    }
  }

  /**
   * Batch cache lookup using Redis MGET — single round-trip for N symbols.
   * Returns a Map from symbol → PriceQuote. Missing symbols are omitted.
   */
  async getBatchPrices(symbols: string[]): Promise<Map<string, PriceQuote>> {
    const result = new Map<string, PriceQuote>();
    if (symbols.length === 0) return result;

    try {
      const keys = symbols.map(buildPriceCacheKey);
      const values = await this.redis.mget(...keys);

      for (let i = 0; i < symbols.length; i++) {
        const raw = values[i];
        if (raw) {
          const entry: CachedPriceEntry = JSON.parse(raw);
          result.set(symbols[i].toUpperCase(), this.entryToQuote(entry));
        }
      }
    } catch (err: any) {
      this.logger.warn(`Batch cache read failed: ${err.message}`);
    }

    return result;
  }

  // ── Staleness & TTL Operations ─────────────────────────────────────────────

  /**
   * Returns price staleness metadata without deserialising the full quote.
   * Returns null if the symbol has no cache entry.
   */
  async getPriceStaleness(symbol: string): Promise<{
    ageSeconds: number;
    isFresh: boolean;
    cachedAt: Date | null;
    source: string | null;
  }> {
    try {
      const raw = await this.redis.get(buildPriceMetaKey(symbol));
      if (!raw) {
        return { ageSeconds: Infinity, isFresh: false, cachedAt: null, source: null };
      }

      const meta: PriceCacheMetadata = JSON.parse(raw);
      const ageSeconds = (Date.now() - new Date(meta.cachedAt).getTime()) / 1000;
      const staleThreshold = this.isMarketHours()
        ? STALENESS_THRESHOLD.ACTIVE_MARKET_SECONDS
        : STALENESS_THRESHOLD.NON_TRADED_SECONDS;

      return {
        ageSeconds: Math.round(ageSeconds),
        isFresh: ageSeconds <= staleThreshold,
        cachedAt: new Date(meta.cachedAt),
        source: meta.source,
      };
    } catch (err: any) {
      this.logger.warn(`Staleness check failed for ${symbol}: ${err.message}`);
      return { ageSeconds: Infinity, isFresh: false, cachedAt: null, source: null };
    }
  }

  /**
   * Force-removes a symbol's cached price — used for manual refresh triggers.
   */
  async invalidatePrice(symbol: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(buildPriceCacheKey(symbol));
    pipeline.del(buildPriceMetaKey(symbol));
    await pipeline.exec();
    this.logger.log(`Cache invalidated for ${symbol}`);
  }

  /**
   * Returns all symbols currently resident in the price cache.
   * Uses SCAN (non-blocking) instead of KEYS.
   */
  async getCachedSymbols(): Promise<string[]> {
    const symbols: string[] = [];
    let cursor = "0";
    const prefix = "price:v1:";

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = nextCursor;
      for (const key of keys) {
        // Filter out :meta keys
        if (!key.endsWith(":meta")) {
          symbols.push(key.replace(prefix, ""));
        }
      }
    } while (cursor !== "0");

    return symbols;
  }

  // ── Market Hours Detection ─────────────────────────────────────────────────

  /**
   * Returns true during NSE market hours: Mon–Fri, 09:15–15:30 IST.
   * Used for TTL selection — shorter TTL during active trading hours.
   */
  isMarketHours(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day = ist.getDay();
    if (day === 0 || day === 6) return false; // weekend

    const totalMinutes = ist.getHours() * 60 + ist.getMinutes();
    return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private entryToQuote(entry: CachedPriceEntry): PriceQuote {
    const ageSeconds = Math.round((Date.now() - new Date(entry.cachedAt).getTime()) / 1000);
    const staleThreshold = this.isMarketHours()
      ? STALENESS_THRESHOLD.ACTIVE_MARKET_SECONDS
      : STALENESS_THRESHOLD.NON_TRADED_SECONDS;

    return {
      symbol: entry.symbol,
      price: entry.price,
      currency: entry.currency,
      priceTimestamp: new Date(entry.priceTimestamp),
      source: entry.source,
      openPrice: entry.openPrice,
      highPrice: entry.highPrice,
      lowPrice: entry.lowPrice,
      closePrice: entry.closePrice,
      volume: entry.volume,
      isStale: ageSeconds > staleThreshold,
      ageSeconds,
    };
  }
}
