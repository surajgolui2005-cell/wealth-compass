import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PriceCacheService } from "../services/price-cache.service";
import { PriceQuote } from "../interfaces/market-data-provider.interface";
import { AssetClassCode } from "@prisma/client";
import { CACHE_TTL, STALENESS_THRESHOLD } from "../interfaces/price-cache.interface";

// ── Redis Mock ──────────────────────────────────────────────────────────────

const redisMock = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  mget: jest.fn(),
  scan: jest.fn(),
  pipeline: jest.fn(),
};

const pipelineMock = {
  set: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

redisMock.pipeline.mockReturnValue(pipelineMock);

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => redisMock);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const makePriceQuote = (
  symbol: string,
  price: number = 100,
  ageSeconds: number = 0,
): PriceQuote => ({
  symbol,
  price,
  currency: "INR",
  priceTimestamp: new Date(Date.now() - ageSeconds * 1000),
  source: "test_provider",
  openPrice: price * 0.99,
  highPrice: price * 1.02,
  lowPrice: price * 0.98,
  closePrice: price * 1.01,
  volume: 1_000_000,
});

// ── Test Suite ───────────────────────────────────────────────────────────────

describe("PriceCacheService", () => {
  let service: PriceCacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    pipelineMock.set.mockReturnThis();
    pipelineMock.del.mockReturnThis();
    pipelineMock.exec.mockResolvedValue([]);
    redisMock.pipeline.mockReturnValue(pipelineMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceCacheService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("redis://localhost:6379") },
        },
      ],
    }).compile();

    service = module.get<PriceCacheService>(PriceCacheService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // ── getPrice ──────────────────────────────────────────────────────────────

  describe("getPrice", () => {
    it("returns PriceQuote on cache hit", async () => {
      const quote = makePriceQuote("BTC", 6_800_000);
      const cacheEntry = {
        symbol: "BTC",
        price: quote.price,
        currency: "INR",
        priceTimestamp: quote.priceTimestamp.toISOString(),
        source: "test_provider",
        openPrice: quote.openPrice,
        highPrice: quote.highPrice,
        lowPrice: quote.lowPrice,
        closePrice: quote.closePrice,
        volume: quote.volume,
        cachedAt: new Date().toISOString(),
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await service.getPrice("BTC");

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe("BTC");
      expect(result!.price).toBe(6_800_000);
      expect(redisMock.get).toHaveBeenCalledWith("price:v1:BTC");
    });

    it("returns null on cache miss (key not in Redis)", async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getPrice("UNKNOWN_SYMBOL");
      expect(result).toBeNull();
    });

    it("returns null and does not throw when Redis is unavailable", async () => {
      redisMock.get.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(service.getPrice("BTC")).resolves.toBeNull();
    });

    it("correctly computes isStale: false for fresh entry during market hours", async () => {
      // Mock market hours as open (weekday ~10:00 IST)
      jest.spyOn(service, "isMarketHours").mockReturnValue(true);

      const cachedAt = new Date(Date.now() - 60 * 1000); // 60 seconds ago — within 5-min TTL
      const cacheEntry = {
        symbol: "INFY",
        price: 1500,
        currency: "INR",
        priceTimestamp: cachedAt.toISOString(),
        source: "alpha_vantage",
        cachedAt: cachedAt.toISOString(),
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cacheEntry));
      const result = await service.getPrice("INFY");

      expect(result!.isStale).toBe(false);
      expect(result!.ageSeconds).toBeLessThan(STALENESS_THRESHOLD.ACTIVE_MARKET_SECONDS);
    });

    it("correctly computes isStale: true for expired entry during market hours", async () => {
      jest.spyOn(service, "isMarketHours").mockReturnValue(true);

      // Cached 20 minutes ago — beyond 15-min staleness threshold
      const cachedAt = new Date(Date.now() - 20 * 60 * 1000);
      const cacheEntry = {
        symbol: "RELIANCE",
        price: 2800,
        currency: "INR",
        priceTimestamp: cachedAt.toISOString(),
        source: "alpha_vantage",
        cachedAt: cachedAt.toISOString(),
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cacheEntry));
      const result = await service.getPrice("RELIANCE");

      expect(result!.isStale).toBe(true);
    });
  });

  // ── setPrice ──────────────────────────────────────────────────────────────

  describe("setPrice", () => {
    it("sets key in Redis with 5-minute TTL for CRYPTO during market hours", async () => {
      jest.spyOn(service, "isMarketHours").mockReturnValue(true);

      const quote = makePriceQuote("ETH", 250_000);
      await service.setPrice(quote, AssetClassCode.CRYPTO);

      expect(pipelineMock.set).toHaveBeenCalledWith(
        "price:v1:ETH",
        expect.any(String),
        "EX",
        CACHE_TTL.ACTIVE_MARKET_SECONDS, // 300 seconds
      );
      expect(pipelineMock.exec).toHaveBeenCalled();
    });

    it("sets key with 24-hour TTL for FIXED_DEPOSITS", async () => {
      jest.spyOn(service, "isMarketHours").mockReturnValue(false);

      const quote = makePriceQuote("FD_HDFC_001", 100);
      await service.setPrice(quote, AssetClassCode.FIXED_DEPOSITS);

      expect(pipelineMock.set).toHaveBeenCalledWith(
        "price:v1:FD_HDFC_001",
        expect.any(String),
        "EX",
        CACHE_TTL.NON_TRADED_SECONDS, // 86400 seconds
      );
    });

    it("sets key with 24-hour TTL for BONDS", async () => {
      jest.spyOn(service, "isMarketHours").mockReturnValue(true); // Even during market hours

      const quote = makePriceQuote("GOV_BOND_7Y", 1000);
      await service.setPrice(quote, AssetClassCode.BONDS);

      expect(pipelineMock.set).toHaveBeenCalledWith(
        "price:v1:GOV_BOND_7Y",
        expect.any(String),
        "EX",
        CACHE_TTL.NON_TRADED_SECONDS,
      );
    });

    it("extends equity TTL to 24h when market is closed (weekend)", async () => {
      jest.spyOn(service, "isMarketHours").mockReturnValue(false); // weekend

      const quote = makePriceQuote("TCS", 3900);
      await service.setPrice(quote, AssetClassCode.STOCKS);

      expect(pipelineMock.set).toHaveBeenCalledWith(
        "price:v1:TCS",
        expect.any(String),
        "EX",
        CACHE_TTL.NON_TRADED_SECONDS, // Extended after market close
      );
    });
  });

  // ── getBatchPrices ────────────────────────────────────────────────────────

  describe("getBatchPrices", () => {
    it("returns populated Map on batch cache hit", async () => {
      const btcEntry = JSON.stringify({
        symbol: "BTC",
        price: 6_800_000,
        currency: "INR",
        priceTimestamp: new Date().toISOString(),
        source: "coingecko",
        cachedAt: new Date().toISOString(),
      });
      const ethEntry = JSON.stringify({
        symbol: "ETH",
        price: 250_000,
        currency: "INR",
        priceTimestamp: new Date().toISOString(),
        source: "coingecko",
        cachedAt: new Date().toISOString(),
      });

      redisMock.mget.mockResolvedValue([btcEntry, ethEntry]);

      const result = await service.getBatchPrices(["BTC", "ETH"]);

      expect(result.size).toBe(2);
      expect(result.get("BTC")?.price).toBe(6_800_000);
      expect(result.get("ETH")?.price).toBe(250_000);
    });

    it("returns partial Map when some symbols are cache misses", async () => {
      const btcEntry = JSON.stringify({
        symbol: "BTC",
        price: 6_800_000,
        currency: "INR",
        priceTimestamp: new Date().toISOString(),
        source: "coingecko",
        cachedAt: new Date().toISOString(),
      });

      redisMock.mget.mockResolvedValue([btcEntry, null]); // ETH is a miss

      const result = await service.getBatchPrices(["BTC", "ETH"]);
      expect(result.size).toBe(1);
      expect(result.has("BTC")).toBe(true);
      expect(result.has("ETH")).toBe(false);
    });

    it("returns empty Map for empty symbols array", async () => {
      const result = await service.getBatchPrices([]);
      expect(result.size).toBe(0);
      expect(redisMock.mget).not.toHaveBeenCalled();
    });

    it("returns empty Map and does not throw when Redis fails", async () => {
      redisMock.mget.mockRejectedValue(new Error("Redis timeout"));
      await expect(service.getBatchPrices(["BTC"])).resolves.toEqual(new Map());
    });
  });

  // ── invalidatePrice ───────────────────────────────────────────────────────

  describe("invalidatePrice", () => {
    it("deletes both the price key and meta key", async () => {
      await service.invalidatePrice("BTC");
      expect(pipelineMock.del).toHaveBeenCalledWith("price:v1:BTC");
      expect(pipelineMock.del).toHaveBeenCalledWith("price:v1:BTC:meta");
    });
  });

  // ── isMarketHours ─────────────────────────────────────────────────────────

  describe("isMarketHours", () => {
    it("returns false on Saturday", () => {
      // Saturday UTC → need IST Saturday
      const saturday = new Date("2026-08-15T05:00:00Z"); // Saturday 10:30 IST
      jest.spyOn(global, "Date").mockImplementation(() => saturday as any);

      // Saturday IST = day 6
      expect(service.isMarketHours()).toBe(false);
      jest.restoreAllMocks();
    });
  });
});
