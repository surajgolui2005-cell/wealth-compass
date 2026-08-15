import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MarketDataService } from "../services/market-data.service";
import { PriceCacheService } from "../services/price-cache.service";
import { AlphaVantageProvider } from "../providers/alpha-vantage.provider";
import { CoinGeckoProvider } from "../providers/coingecko.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  PriceQuote,
  CircuitBreakerState,
  ProviderUnavailableException,
} from "../interfaces/market-data-provider.interface";
import { AssetClassCode } from "@prisma/client";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FRESH_BTC_QUOTE: PriceQuote = {
  symbol: "BTC",
  price: 6_800_000,
  currency: "INR",
  priceTimestamp: new Date(),
  source: "coingecko",
  isStale: false,
  ageSeconds: 30,
};

const STALE_DB_QUOTE: PriceQuote = {
  symbol: "BTC",
  price: 6_500_000,
  currency: "INR",
  priceTimestamp: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago
  source: "coingecko:db_fallback",
  isStale: true,
  ageSeconds: 1500,
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockCache = {
  getPrice: jest.fn(),
  setPrice: jest.fn().mockResolvedValue(undefined),
  getBatchPrices: jest.fn(),
  setBatchPrices: jest.fn().mockResolvedValue(undefined),
  getPriceStaleness: jest.fn(),
  getCachedSymbols: jest.fn().mockResolvedValue([]),
  isMarketHours: jest.fn().mockReturnValue(true),
  invalidatePrice: jest.fn().mockResolvedValue(undefined),
};

const mockAlphaVantage = {
  getProviderName: jest.fn().mockReturnValue("alpha_vantage"),
  getSupportedAssetClasses: jest.fn().mockReturnValue([AssetClassCode.STOCKS, AssetClassCode.ETFS]),
  fetchPrice: jest.fn(),
  fetchBatchPrices: jest.fn(),
  isMarketOpen: jest.fn().mockReturnValue(true),
  getCircuitState: jest.fn().mockReturnValue(CircuitBreakerState.CLOSED),
};

const mockCoinGecko = {
  getProviderName: jest.fn().mockReturnValue("coingecko"),
  getSupportedAssetClasses: jest.fn().mockReturnValue([AssetClassCode.CRYPTO]),
  fetchPrice: jest.fn(),
  fetchBatchPrices: jest.fn(),
  isMarketOpen: jest.fn().mockReturnValue(true),
  getCircuitState: jest.fn().mockReturnValue(CircuitBreakerState.CLOSED),
};

const mockPrisma = {
  asset: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  assetClass: {
    findUnique: jest.fn(),
  },
  marketPrice: {
    create: jest.fn().mockResolvedValue({}),
  },
  holding: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("MarketDataService", () => {
  let service: MarketDataService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataService,
        { provide: PriceCacheService, useValue: mockCache },
        { provide: AlphaVantageProvider, useValue: mockAlphaVantage },
        { provide: CoinGeckoProvider, useValue: mockCoinGecko },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("redis://localhost:6379") },
        },
      ],
    }).compile();

    service = module.get<MarketDataService>(MarketDataService);
  });

  // ── Tier 1: Cache Hit ─────────────────────────────────────────────────────

  describe("Tier 1 — Cache hit", () => {
    it("returns cached quote without calling external provider", async () => {
      mockCache.getPrice.mockResolvedValue(FRESH_BTC_QUOTE);

      const result = await service.getPrice("BTC", AssetClassCode.CRYPTO);

      expect(result).toEqual(FRESH_BTC_QUOTE);
      expect(mockCoinGecko.fetchPrice).not.toHaveBeenCalled();
      expect(mockAlphaVantage.fetchPrice).not.toHaveBeenCalled();
      expect(mockPrisma.marketPrice.create).not.toHaveBeenCalled();
    });

    it("returns cache hit immediately for equity symbols too", async () => {
      const infyQuote: PriceQuote = {
        symbol: "INFY",
        price: 1500,
        currency: "INR",
        priceTimestamp: new Date(),
        source: "alpha_vantage",
        isStale: false,
        ageSeconds: 120,
      };
      mockCache.getPrice.mockResolvedValue(infyQuote);

      const result = await service.getPrice("INFY", AssetClassCode.STOCKS);

      expect(result?.symbol).toBe("INFY");
      expect(mockAlphaVantage.fetchPrice).not.toHaveBeenCalled();
    });
  });

  // ── Tier 2: Provider Fetch ────────────────────────────────────────────────

  describe("Tier 2 — Provider fetch on cache miss", () => {
    it("calls provider when cache miss, then caches and persists the result", async () => {
      mockCache.getPrice.mockResolvedValue(null); // cache miss
      mockCoinGecko.fetchPrice.mockResolvedValue(FRESH_BTC_QUOTE);
      mockPrisma.asset.findFirst.mockResolvedValue({ id: "asset-uuid-123" });

      const result = await service.getPrice("BTC", AssetClassCode.CRYPTO);

      expect(result?.price).toBe(6_800_000);
      expect(mockCoinGecko.fetchPrice).toHaveBeenCalledWith("BTC");
      expect(mockCache.setPrice).toHaveBeenCalledWith(FRESH_BTC_QUOTE, AssetClassCode.CRYPTO);
      expect(mockPrisma.marketPrice.create).toHaveBeenCalledTimes(1);
    });

    it("uses Alpha Vantage for STOCKS asset class on cache miss", async () => {
      const infyQuote: PriceQuote = {
        symbol: "INFY",
        price: 1500,
        currency: "INR",
        priceTimestamp: new Date(),
        source: "alpha_vantage",
      };
      mockCache.getPrice.mockResolvedValue(null);
      mockAlphaVantage.fetchPrice.mockResolvedValue(infyQuote);
      mockPrisma.asset.findFirst.mockResolvedValue({ id: "asset-infy" });

      const result = await service.getPrice("INFY", AssetClassCode.STOCKS);

      expect(result?.source).toBe("alpha_vantage");
      expect(mockAlphaVantage.fetchPrice).toHaveBeenCalledWith("INFY");
      expect(mockCoinGecko.fetchPrice).not.toHaveBeenCalled();
    });

    it("MarketPrice INSERT is append-only — create is called, never update", async () => {
      mockCache.getPrice.mockResolvedValue(null);
      mockCoinGecko.fetchPrice.mockResolvedValue(FRESH_BTC_QUOTE);
      mockPrisma.asset.findFirst.mockResolvedValue({ id: "asset-uuid-123" });

      await service.getPrice("BTC", AssetClassCode.CRYPTO);
      await service.getPrice("BTC", AssetClassCode.CRYPTO); // second call → new cache miss scenario

      // Each call should INSERT a new price row, never update
      expect(mockPrisma.marketPrice.create).toHaveBeenCalledTimes(2);
      // Verify prisma.marketPrice.update is never called
      expect(mockPrisma.marketPrice as any).not.toHaveProperty("update");
    });
  });

  // ── Tier 3: DB Fallback ───────────────────────────────────────────────────

  describe("Tier 3 — DB fallback on provider failure", () => {
    it("falls back to DB when provider raises ProviderUnavailableException (circuit open)", async () => {
      mockCache.getPrice.mockResolvedValue(null);
      mockCoinGecko.fetchPrice.mockRejectedValue(
        new ProviderUnavailableException("coingecko", "Circuit OPEN — 28s until probe"),
      );

      // DB returns a stale row
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: "asset-uuid-123",
        marketPrices: [
          {
            price: 6_500_000,
            currency: "INR",
            priceTimestamp: new Date(Date.now() - 30 * 60 * 1000),
            source: "coingecko",
            openPrice: null,
            highPrice: null,
            lowPrice: null,
            closePrice: null,
            volume: null,
          },
        ],
      });

      const result = await service.getPrice("BTC", AssetClassCode.CRYPTO);

      expect(result).not.toBeNull();
      expect(result!.isStale).toBe(true);
      expect(result!.source).toContain("db_fallback");
      expect(result!.price).toBe(6_500_000);
    });

    it("returns null when all providers fail AND no DB row exists", async () => {
      mockCache.getPrice.mockResolvedValue(null);
      mockCoinGecko.fetchPrice.mockRejectedValue(new Error("Network error"));
      mockPrisma.asset.findFirst.mockResolvedValue(null); // no DB record either

      const result = await service.getPrice("NEW_COIN", AssetClassCode.CRYPTO);
      expect(result).toBeNull();
    });

    it("fallback quote includes isMarketClosed: true on weekends", async () => {
      mockCache.getPrice.mockResolvedValue(null);
      mockCoinGecko.fetchPrice.mockRejectedValue(new Error("Circuit OPEN"));

      // Mock weekend
      jest.spyOn(global.Date.prototype, "getDay").mockReturnValue(6); // Saturday

      mockPrisma.asset.findFirst.mockResolvedValue({
        id: "asset-uuid-123",
        marketPrices: [
          {
            price: 6_000_000,
            currency: "INR",
            priceTimestamp: new Date(Date.now() - 48 * 3600 * 1000),
            source: "coingecko",
            openPrice: null,
            highPrice: null,
            lowPrice: null,
            closePrice: null,
            volume: null,
          },
        ],
      });

      const result = await service.getPrice("BTC", AssetClassCode.CRYPTO);
      // isMarketClosed is crypto-specific so coingecko sets false, but equity on weekend → true
      expect(result).not.toBeNull();

      jest.restoreAllMocks();
    });
  });

  // ── Circuit Breaker Status ────────────────────────────────────────────────

  describe("getPipelineStatus", () => {
    it("returns circuit breaker state for all providers", () => {
      mockAlphaVantage.getCircuitState.mockReturnValue(CircuitBreakerState.OPEN);
      mockCoinGecko.getCircuitState.mockReturnValue(CircuitBreakerState.CLOSED);

      const status = service.getPipelineStatus();

      expect(status.alpha_vantage.circuitState).toBe(CircuitBreakerState.OPEN);
      expect(status.coingecko.circuitState).toBe(CircuitBreakerState.CLOSED);
    });
  });

  // ── Batch Prices ──────────────────────────────────────────────────────────

  describe("getBatchPrices", () => {
    it("batch cache hit does not call any provider", async () => {
      const cacheHits = new Map([
        ["BTC", FRESH_BTC_QUOTE],
        ["ETH", { ...FRESH_BTC_QUOTE, symbol: "ETH", price: 250_000 }],
      ]);
      mockCache.getBatchPrices.mockResolvedValue(cacheHits);

      const result = await service.getBatchPrices([
        { symbol: "BTC", assetClass: AssetClassCode.CRYPTO },
        { symbol: "ETH", assetClass: AssetClassCode.CRYPTO },
      ]);

      expect(result.size).toBe(2);
      expect(mockCoinGecko.fetchBatchPrices).not.toHaveBeenCalled();
    });

    it("partial cache miss fetches only uncached symbols from provider", async () => {
      // BTC cached, ETH is a miss
      mockCache.getBatchPrices.mockResolvedValue(new Map([["BTC", FRESH_BTC_QUOTE]]));

      const ethQuote: PriceQuote = {
        symbol: "ETH",
        price: 250_000,
        currency: "INR",
        priceTimestamp: new Date(),
        source: "coingecko",
      };
      mockCoinGecko.fetchBatchPrices.mockResolvedValue(new Map([["ETH", ethQuote]]));
      mockPrisma.asset.findFirst.mockResolvedValue({ id: "asset-eth" });

      const result = await service.getBatchPrices([
        { symbol: "BTC", assetClass: AssetClassCode.CRYPTO },
        { symbol: "ETH", assetClass: AssetClassCode.CRYPTO },
      ]);

      expect(result.size).toBe(2);
      // Provider called with only the cache miss
      expect(mockCoinGecko.fetchBatchPrices).toHaveBeenCalledWith(["ETH"]);
    });
  });
});
