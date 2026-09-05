import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import Redis from "ioredis";

export interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
  hitRatio: number;
  store: "redis" | "memory";
}

interface MemoryEntry {
  value: string;
  expiresAt: number;
  portfolioId?: string;
}

@Injectable()
export class AnalyticsCacheManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsCacheManager.name);
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private readonly defaultTtlSeconds = 300; // 5 minutes

  // In-memory fallback cache
  private readonly memoryStore = new Map<string, MemoryEntry>();
  private readonly portfolioKeyIndex = new Map<string, Set<string>>();

  // Cache telemetry
  private hits = 0;
  private misses = 0;
  private invalidations = 0;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() customRedis?: Redis,
  ) {
    if (customRedis) {
      this.redis = customRedis;
      this.isRedisConnected = true;
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.redis) return;

    const redisUrl =
      this.configService?.get<string>("REDIS_URL") ||
      process.env.REDIS_URL ||
      "redis://localhost:6379";

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 2000,
        lazyConnect: true,
        enableReadyCheck: true,
      });

      this.redis.on("connect", () => {
        this.isRedisConnected = true;
        this.logger.log("AnalyticsCacheManager: Connected to Redis");
      });

      this.redis.on("error", (err) => {
        if (this.isRedisConnected) {
          this.logger.warn(
            `AnalyticsCacheManager: Redis error: ${err.message}. Falling back to in-memory.`,
          );
        }
        this.isRedisConnected = false;
      });

      await this.redis.connect();
      this.isRedisConnected = true;
    } catch (err: any) {
      this.logger.warn(
        `AnalyticsCacheManager: Redis unavailable (${err.message}). Using in-memory fallback cache.`,
      );
      this.isRedisConnected = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.quit();
      } catch {
        // ignore on teardown
      }
    }
  }

  /**
   * Retrieves a cached entry by key, deserializing from JSON.
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw !== null) {
          this.hits++;
          return JSON.parse(raw) as T;
        }
      } catch (err: any) {
        this.logger.warn(`Redis get failed (${err.message}), checking memory store.`);
      }
    }

    // Check in-memory store
    const entry = this.memoryStore.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        this.misses++;
        return null;
      }
      this.hits++;
      return JSON.parse(entry.value) as T;
    }

    this.misses++;
    return null;
  }

  /**
   * Stores a value in cache with TTL and associates it with portfolioId for bulk invalidation.
   */
  async set(
    key: string,
    data: any,
    ttlSeconds = this.defaultTtlSeconds,
    portfolioId?: string,
  ): Promise<void> {
    const serialized = JSON.stringify(data);

    if (this.isRedisConnected && this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        pipeline.set(key, serialized, "EX", ttlSeconds);

        if (portfolioId) {
          const indexKey = `analytics:portfolio:${portfolioId}:keys`;
          pipeline.sadd(indexKey, key);
          pipeline.expire(indexKey, ttlSeconds * 2); // Keep index longer than entry
        }

        await pipeline.exec();
        return;
      } catch (err: any) {
        this.logger.warn(`Redis set failed (${err.message}), using memory store.`);
      }
    }

    // In-memory store
    this.memoryStore.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
      portfolioId,
    });

    if (portfolioId) {
      let keysSet = this.portfolioKeyIndex.get(portfolioId);
      if (!keysSet) {
        keysSet = new Set<string>();
        this.portfolioKeyIndex.set(portfolioId, keysSet);
      }
      keysSet.add(key);
    }
  }

  /**
   * Immediately invalidates all analytics caches for a given portfolio.
   * O(N) where N is the number of keys for that portfolio (zero KEYS * scan).
   */
  async invalidatePortfolio(portfolioId: string): Promise<number> {
    this.invalidations++;
    let deletedCount = 0;

    if (this.isRedisConnected && this.redis) {
      try {
        const indexKey = `analytics:portfolio:${portfolioId}:keys`;
        const keys = await this.redis.smembers(indexKey);

        if (keys && keys.length > 0) {
          const pipeline = this.redis.pipeline();
          for (const k of keys) {
            pipeline.del(k);
          }
          pipeline.del(indexKey);
          await pipeline.exec();
          deletedCount += keys.length;
        }
      } catch (err: any) {
        this.logger.warn(`Redis invalidation failed: ${err.message}`);
      }
    }

    // Invalidate in-memory keys
    const memoryKeys = this.portfolioKeyIndex.get(portfolioId);
    if (memoryKeys) {
      for (const k of memoryKeys) {
        this.memoryStore.delete(k);
        deletedCount++;
      }
      this.portfolioKeyIndex.delete(portfolioId);
    }

    this.logger.log(
      `[Cache Invalidation] Flushed ${deletedCount} cache entries for portfolio "${portfolioId}"`,
    );
    return deletedCount;
  }

  /**
   * Event Listener: Invalidate portfolio cache when a transaction is recorded.
   */
  @OnEvent("transaction.recorded", { async: true })
  async handleTransactionRecorded(event: { portfolioId: string }): Promise<void> {
    if (event?.portfolioId) {
      await this.invalidatePortfolio(event.portfolioId);
    }
  }

  /**
   * Event Listener: Invalidate portfolio cache when a holding is updated.
   */
  @OnEvent("holding.updated", { async: true })
  async handleHoldingUpdated(event: { portfolioId: string }): Promise<void> {
    if (event?.portfolioId) {
      await this.invalidatePortfolio(event.portfolioId);
    }
  }

  /**
   * Event Listener: Invalidate portfolio cache when portfolio net worth changes.
   */
  @OnEvent("portfolio.updated", { async: true })
  async handlePortfolioUpdated(event: { portfolioId: string }): Promise<void> {
    if (event?.portfolioId) {
      await this.invalidatePortfolio(event.portfolioId);
    }
  }

  /**
   * Clears all cache entries (used in testing and maintenance).
   */
  async clear(): Promise<void> {
    this.memoryStore.clear();
    this.portfolioKeyIndex.clear();

    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.flushdb();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Returns cache metrics and hit ratio.
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
      hitRatio: parseFloat(hitRatio.toFixed(4)),
      store: this.isRedisConnected ? "redis" : "memory",
    };
  }
}
