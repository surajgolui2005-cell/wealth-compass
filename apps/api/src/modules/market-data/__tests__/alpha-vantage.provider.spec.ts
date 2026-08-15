import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AlphaVantageProvider } from "../providers/alpha-vantage.provider";
import {
  CircuitBreakerState,
  ProviderUnavailableException,
} from "../interfaces/market-data-provider.interface";
import { AssetClassCode } from "@prisma/client";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_ALPHA_RESPONSE = {
  "Global Quote": {
    "01. symbol": "NSE:INFY",
    "02. open": "1490.00",
    "03. high": "1525.50",
    "04. low": "1485.00",
    "05. price": "1500.75",
    "06. volume": "2000000",
    "07. latest trading day": "2026-08-14",
    "08. previous close": "1495.00",
    "09. change": "5.75",
    "10. change percent": "0.3847%",
  },
};

const buildAxiosInstance = () => ({
  get: jest.fn(),
});

describe("AlphaVantageProvider", () => {
  let provider: AlphaVantageProvider;
  let mockAxiosInstance: ReturnType<typeof buildAxiosInstance>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAxiosInstance = buildAxiosInstance();
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlphaVantageProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("test-api-key") },
        },
      ],
    }).compile();

    provider = module.get<AlphaVantageProvider>(AlphaVantageProvider);
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe("metadata", () => {
    it("reports provider name as alpha_vantage", () => {
      expect(provider.getProviderName()).toBe("alpha_vantage");
    });

    it("supports STOCKS and ETFS asset classes", () => {
      const classes = provider.getSupportedAssetClasses();
      expect(classes).toContain(AssetClassCode.STOCKS);
      expect(classes).toContain(AssetClassCode.ETFS);
      expect(classes).not.toContain(AssetClassCode.CRYPTO);
    });

    it("starts with circuit CLOSED", () => {
      expect(provider.getCircuitState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  // ── fetchPrice ────────────────────────────────────────────────────────────

  describe("fetchPrice", () => {
    it("successfully maps Alpha Vantage response to PriceQuote", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: VALID_ALPHA_RESPONSE });

      const quote = await provider.fetchPrice("INFY");

      expect(quote.symbol).toBe("INFY");
      expect(quote.price).toBe(1500.75);
      expect(quote.currency).toBe("INR");
      expect(quote.source).toBe("alpha_vantage");
      expect(quote.openPrice).toBe(1490);
      expect(quote.highPrice).toBe(1525.5);
      expect(quote.volume).toBe(2_000_000);
      expect(quote.priceTimestamp).toBeInstanceOf(Date);
    });

    it("prefixes bare symbol with NSE: when calling Alpha Vantage", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: VALID_ALPHA_RESPONSE });

      await provider.fetchPrice("RELIANCE");

      const callArgs = mockAxiosInstance.get.mock.calls[0];
      expect(callArgs[1].params.symbol).toBe("NSE:RELIANCE");
    });

    it("passes already-prefixed symbol (NSE:INFY) as-is", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: VALID_ALPHA_RESPONSE });

      await provider.fetchPrice("NSE:INFY");

      expect(mockAxiosInstance.get.mock.calls[0][1].params.symbol).toBe("NSE:INFY");
    });

    it("throws when Alpha Vantage returns rate limit Note", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          Note: "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.",
        },
      });

      await expect(provider.fetchPrice("INFY")).rejects.toThrow("Rate limit");
    });

    it("throws when Global Quote is empty", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { "Global Quote": {} } });
      await expect(provider.fetchPrice("INFY")).rejects.toThrow();
    });
  });

  // ── Retry Logic ───────────────────────────────────────────────────────────

  describe("retry logic", () => {
    it("retries on 429 rate limit response up to 3 attempts", async () => {
      const rateLimitError = {
        response: { status: 429 },
        message: "Request failed with status code 429",
      };
      // Fail twice, succeed on third attempt
      mockAxiosInstance.get
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: VALID_ALPHA_RESPONSE });

      const quote = await provider.fetchPrice("INFY");

      expect(quote.price).toBe(1500.75);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it("gives up after 3 failed attempts and throws", async () => {
      const networkError = new Error("ECONNREFUSED");
      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(provider.fetchPrice("INFY")).rejects.toThrow("ECONNREFUSED");
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });
  });

  // ── Circuit Breaker ───────────────────────────────────────────────────────

  describe("circuit breaker", () => {
    it("opens circuit after 3 consecutive failures", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Server error"));

      for (let i = 0; i < 3; i++) {
        try {
          await provider.fetchPrice("INFY");
        } catch {
          /* expected */
        }
      }

      expect(provider.getCircuitState()).toBe(CircuitBreakerState.OPEN);
    });

    it("throws ProviderUnavailableException immediately when circuit is open", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Server error"));

      // Trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await provider.fetchPrice("INFY");
        } catch {
          /* expected */
        }
      }

      expect(provider.getCircuitState()).toBe(CircuitBreakerState.OPEN);

      // Next call should fail immediately without calling HTTP
      mockAxiosInstance.get.mockClear();
      await expect(provider.fetchPrice("INFY")).rejects.toBeInstanceOf(
        ProviderUnavailableException,
      );
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it("transitions to HALF_OPEN after cooldown period", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Server error"));

      for (let i = 0; i < 3; i++) {
        try {
          await provider.fetchPrice("INFY");
        } catch {
          /* expected */
        }
      }

      // Manually set circuitOpenedAt to simulate cooldown elapsed
      (provider as any).circuitOpenedAt = Date.now() - 35_000; // 35 seconds ago

      mockAxiosInstance.get.mockResolvedValue({ data: VALID_ALPHA_RESPONSE });

      // This probe should succeed and close the circuit
      const quote = await provider.fetchPrice("INFY");
      expect(quote.price).toBe(1500.75);
      expect(provider.getCircuitState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  // ── fetchBatchPrices ──────────────────────────────────────────────────────

  describe("fetchBatchPrices", () => {
    it("fetches each symbol individually and returns BatchPriceResult map", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: VALID_ALPHA_RESPONSE });

      const result = await provider.fetchBatchPrices(["INFY", "RELIANCE"]);

      expect(result.size).toBe(2);
      expect(result.has("INFY")).toBe(true);
      expect(result.has("RELIANCE")).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it("returns empty map for empty symbols array", async () => {
      const result = await provider.fetchBatchPrices([]);
      expect(result.size).toBe(0);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it("aborts batch on circuit open mid-batch", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Server error"));

      // Trip circuit
      for (let i = 0; i < 3; i++) {
        try {
          await provider.fetchPrice("TEST");
        } catch {
          /* expected */
        }
      }

      mockAxiosInstance.get.mockClear();

      // Batch should abort immediately without calling the HTTP client
      const result = await provider.fetchBatchPrices(["INFY", "TCS", "WIPRO"]);
      expect(result.size).toBe(0);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });
  });
});
