import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CoinGeckoProvider } from "../providers/coingecko.provider";
import {
  CircuitBreakerState,
  ProviderUnavailableException,
} from "../interfaces/market-data-provider.interface";
import { AssetClassCode } from "@prisma/client";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const VALID_COINGECKO_RESPONSE = {
  bitcoin: {
    inr: 6850000.5,
    usd: 82000,
    inr_24h_vol: 1200000000,
    usd_24h_vol: 14500000,
  },
  ethereum: {
    inr: 275000.25,
    usd: 3300,
    inr_24h_vol: 850000000,
    usd_24h_vol: 10200000,
  },
};

const buildAxiosInstance = () => ({
  get: jest.fn(),
});

describe("CoinGeckoProvider", () => {
  let provider: CoinGeckoProvider;
  let mockAxiosInstance: ReturnType<typeof buildAxiosInstance>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAxiosInstance = buildAxiosInstance();
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoinGeckoProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("mock-coingecko-api-key") },
        },
      ],
    }).compile();

    provider = module.get<CoinGeckoProvider>(CoinGeckoProvider);
  });

  describe("metadata & market hours", () => {
    it("reports provider name as coingecko", () => {
      expect(provider.getProviderName()).toBe("coingecko");
    });

    it("supports CRYPTO asset class only", () => {
      const classes = provider.getSupportedAssetClasses();
      expect(classes).toEqual([AssetClassCode.CRYPTO]);
    });

    it("always reports market is open (crypto is 24/7)", () => {
      expect(provider.isMarketOpen()).toBe(true);
    });

    it("starts with circuit CLOSED", () => {
      expect(provider.getCircuitState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe("fetchPrice & fetchBatchPrices", () => {
    it("successfully fetches and maps crypto prices from CoinGecko", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: VALID_COINGECKO_RESPONSE });

      const quote = await provider.fetchPrice("BTC");

      expect(quote.symbol).toBe("BTC");
      expect(quote.price).toBe(6850000.5);
      expect(quote.currency).toBe("INR");
      expect(quote.source).toBe("coingecko");
      expect(quote.volume).toBe(1200000000);
      expect(quote.isMarketClosed).toBe(false);
      expect(quote.priceTimestamp).toBeInstanceOf(Date);
    });

    it("handles batch fetching for multiple crypto assets", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: VALID_COINGECKO_RESPONSE });

      const batch = await provider.fetchBatchPrices(["BTC", "ETH"]);

      expect(batch.size).toBe(2);
      expect(batch.get("BTC")?.price).toBe(6850000.5);
      expect(batch.get("ETH")?.price).toBe(275000.25);
    });

    it("skips unknown crypto symbols and queries known coin IDs", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { bitcoin: VALID_COINGECKO_RESPONSE.bitcoin },
      });

      const batch = await provider.fetchBatchPrices(["BTC", "NON_EXISTENT_COIN_123"]);

      expect(batch.size).toBe(1);
      expect(batch.has("BTC")).toBe(true);
      expect(batch.has("NON_EXISTENT_COIN_123")).toBe(false);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "https://api.coingecko.com/api/v3/simple/price",
        expect.objectContaining({
          params: expect.objectContaining({
            ids: "bitcoin",
          }),
        }),
      );
    });

    it("returns empty map for empty symbol list without HTTP call", async () => {
      const result = await provider.fetchBatchPrices([]);
      expect(result.size).toBe(0);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it("throws error when single fetch gets no data for symbol", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      await expect(provider.fetchPrice("BTC")).rejects.toThrow(
        'CoinGecko returned no data for symbol "BTC"',
      );
    });
  });

  describe("retry and circuit breaker", () => {
    it("retries on rate limit HTTP 429 and succeeds on later attempt", async () => {
      const rateLimitError = {
        response: { status: 429 },
        message: "Too Many Requests",
      };
      mockAxiosInstance.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: VALID_COINGECKO_RESPONSE });

      const quote = await provider.fetchPrice("BTC");
      expect(quote.price).toBe(6850000.5);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it("trips circuit breaker after 3 consecutive failures", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Network error"));

      for (let i = 0; i < 3; i++) {
        try {
          await provider.fetchPrice("BTC");
        } catch {
          // Expected failure
        }
      }

      expect(provider.getCircuitState()).toBe(CircuitBreakerState.OPEN);

      mockAxiosInstance.get.mockClear();
      await expect(provider.fetchPrice("BTC")).rejects.toBeInstanceOf(ProviderUnavailableException);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });
  });
});
