import { AnalyticsCacheManager } from "../analytics-cache.manager";

describe("AnalyticsCacheManager (Redis & Event Invalidation)", () => {
  let manager: AnalyticsCacheManager;

  beforeEach(() => {
    // Instantiate with in-memory mode for deterministic unit testing
    manager = new AnalyticsCacheManager();
  });

  describe("Read-Through Caching Basics", () => {
    it("should return null on cache miss", async () => {
      const result = await manager.get("non_existent_key");
      expect(result).toBeNull();

      const stats = manager.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it("should store and retrieve data with sub-millisecond latency", async () => {
      const sampleValuation = {
        portfolioId: "p-100",
        totalValue: 1542000.5,
        currency: "INR",
        positions: [{ symbol: "RELIANCE", quantity: 50, currentValue: 145000 }],
      };

      await manager.set("analytics:portfolio:p-100:valuation:FIFO", sampleValuation, 60, "p-100");

      const cached = await manager.get<typeof sampleValuation>(
        "analytics:portfolio:p-100:valuation:FIFO",
      );

      expect(cached).toBeDefined();
      expect(cached).toEqual(sampleValuation);

      const stats = manager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.hitRatio).toBe(1.0);
    });

    it("should expire cache entries after TTL", async () => {
      const key = "analytics:temp:p-999";
      // Set with 0 second TTL (immediate expiration)
      await manager.set(key, { test: 123 }, -1);

      const cached = await manager.get(key);
      expect(cached).toBeNull();
    });
  });

  describe("Portfolio-Scoped Cache Invalidation Invariant", () => {
    it("should invalidate all keys for a target portfolio while preserving other portfolios", async () => {
      const p1Valuation = { netWorth: 100000 };
      const p1Allocation = { stocks: 70, cash: 30 };
      const p2Valuation = { netWorth: 500000 };

      // Cache entries for Portfolio 1
      await manager.set("analytics:portfolio:p1:valuation", p1Valuation, 300, "p1");
      await manager.set("analytics:portfolio:p1:allocation", p1Allocation, 300, "p1");

      // Cache entries for Portfolio 2
      await manager.set("analytics:portfolio:p2:valuation", p2Valuation, 300, "p2");

      // Verify both portfolios are cached
      expect(await manager.get("analytics:portfolio:p1:valuation")).toEqual(p1Valuation);
      expect(await manager.get("analytics:portfolio:p1:allocation")).toEqual(p1Allocation);
      expect(await manager.get("analytics:portfolio:p2:valuation")).toEqual(p2Valuation);

      // Invalidate Portfolio 1
      const flushedCount = await manager.invalidatePortfolio("p1");
      expect(flushedCount).toBe(2);

      // Verify Portfolio 1 entries are null (MISS)
      expect(await manager.get("analytics:portfolio:p1:valuation")).toBeNull();
      expect(await manager.get("analytics:portfolio:p1:allocation")).toBeNull();

      // Verify Portfolio 2 entries are still intact (HIT)
      expect(await manager.get("analytics:portfolio:p2:valuation")).toEqual(p2Valuation);
    });

    it("should invalidate portfolio cache immediately on transaction.recorded event", async () => {
      const portfolioId = "portfolio-event-test";
      await manager.set(
        `analytics:portfolio:${portfolioId}:valuation`,
        { totalValue: 250000 },
        300,
        portfolioId,
      );

      expect(await manager.get(`analytics:portfolio:${portfolioId}:valuation`)).toBeDefined();

      // Trigger transaction.recorded event
      await manager.handleTransactionRecorded({ portfolioId });

      // Immediate cache invalidation verification
      const cachedAfterEvent = await manager.get(`analytics:portfolio:${portfolioId}:valuation`);
      expect(cachedAfterEvent).toBeNull();
    });

    it("should invalidate portfolio cache on holding.updated and portfolio.updated events", async () => {
      const portfolioId = "portfolio-holding-test";
      await manager.set(
        `analytics:portfolio:${portfolioId}:allocation`,
        { equity: 80 },
        300,
        portfolioId,
      );

      // Trigger holding.updated
      await manager.handleHoldingUpdated({ portfolioId });
      expect(await manager.get(`analytics:portfolio:${portfolioId}:allocation`)).toBeNull();

      // Reset and trigger portfolio.updated
      await manager.set(
        `analytics:portfolio:${portfolioId}:metrics`,
        { sharpe: 1.8 },
        300,
        portfolioId,
      );
      await manager.handlePortfolioUpdated({ portfolioId });
      expect(await manager.get(`analytics:portfolio:${portfolioId}:metrics`)).toBeNull();
    });
  });

  describe("Redis Mock Pipeline Execution", () => {
    it("should interface properly with Redis client pipeline when available", async () => {
      const mockPipeline = {
        set: jest.fn().mockReturnThis(),
        sadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, "OK"]]),
      };

      const mockRedis: any = {
        get: jest.fn().mockResolvedValue(JSON.stringify({ cachedInRedis: true })),
        pipeline: jest.fn().mockReturnValue(mockPipeline),
        smembers: jest.fn().mockResolvedValue(["key1", "key2"]),
        quit: jest.fn().mockResolvedValue("OK"),
      };

      const redisManager = new AnalyticsCacheManager(undefined, mockRedis);

      // Test Redis GET
      const result = await redisManager.get("test_redis_key");
      expect(result).toEqual({ cachedInRedis: true });
      expect(mockRedis.get).toHaveBeenCalledWith("test_redis_key");

      // Test Redis SET with index set
      await redisManager.set("analytics:portfolio:p9:val", { val: 1 }, 300, "p9");
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.set).toHaveBeenCalledWith(
        "analytics:portfolio:p9:val",
        JSON.stringify({ val: 1 }),
        "EX",
        300,
      );
      expect(mockPipeline.sadd).toHaveBeenCalledWith(
        "analytics:portfolio:p9:keys",
        "analytics:portfolio:p9:val",
      );

      // Test Redis Invalidation
      const count = await redisManager.invalidatePortfolio("p9");
      expect(mockRedis.smembers).toHaveBeenCalledWith("analytics:portfolio:p9:keys");
      expect(count).toBe(2);
    });
  });
});
