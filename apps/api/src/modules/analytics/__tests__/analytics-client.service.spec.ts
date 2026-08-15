import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  BadGatewayException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AnalyticsClientService } from "../analytics-client.service";
import {
  BenchmarkComputeRequest,
  TwrComputeRequest,
  XirrComputeRequest,
} from "../dto/analytics.dto";

describe("AnalyticsClientService", () => {
  let service: AnalyticsClientService;
  let configService: ConfigService;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === "QUANT_ENGINE_URL") return "http://localhost:8001";
              if (key === "QUANT_ENGINE_TIMEOUT_MS") return 5000;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsClientService>(AnalyticsClientService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe("computeTwr", () => {
    it("should map camelCase input to snake_case and return TWR result", async () => {
      const mockResponse = {
        portfolio_id: "port-123",
        twr_cumulative: 0.21,
        twr_annualised: 0.21,
        twr_cumulative_pct: 21.0,
        twr_annualised_pct: 21.0,
        sub_period_returns: [0.1, 0.1],
        total_days: 365,
        n_sub_periods: 2,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const request: TwrComputeRequest = {
        portfolioId: "port-123",
        subPeriods: [
          {
            startDate: "2026-01-01",
            endDate: "2026-06-30",
            bmv: 100000,
            emv: 110000,
            cashFlows: [{ flowDate: "2026-03-15", amount: 5000 }],
          },
          {
            startDate: "2026-07-01",
            endDate: "2026-12-31",
            bmv: 115000,
            emv: 126500,
          },
        ],
      };

      const result = await service.computeTwr(request);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/performance/twr",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            portfolio_id: "port-123",
            sub_periods: [
              {
                start_date: "2026-01-01",
                end_date: "2026-06-30",
                bmv: 100000,
                emv: 110000,
                cash_flows: [{ flow_date: "2026-03-15", amount: 5000 }],
              },
              {
                start_date: "2026-07-01",
                end_date: "2026-12-31",
                bmv: 115000,
                emv: 126500,
                cash_flows: [],
              },
            ],
          }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("computeXirr", () => {
    it("should map camelCase input to snake_case and return XIRR result", async () => {
      const mockResponse = {
        portfolio_id: "port-456",
        xirr: 0.198,
        xirr_pct: 19.8,
        npv_at_solution: 0.000001,
        solver_used: "newton_raphson",
        iterations: 8,
        n_cash_flows: 3,
        twr_fallback: false,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const request: XirrComputeRequest = {
        portfolioId: "port-456",
        cashFlows: [
          { flowDate: "2025-01-01", amount: -100000 },
          { flowDate: "2025-07-01", amount: -50000 },
          { flowDate: "2026-01-01", amount: 180000 },
        ],
        guess: 0.15,
      };

      const result = await service.computeXirr(request);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/performance/xirr",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            portfolio_id: "port-456",
            cash_flows: [
              { flow_date: "2025-01-01", amount: -100000 },
              { flow_date: "2025-07-01", amount: -50000 },
              { flow_date: "2026-01-01", amount: 180000 },
            ],
            guess: 0.15,
          }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });

    it("should return fallback payload directly when twr_fallback is true", async () => {
      const mockFallbackResponse = {
        portfolio_id: "port-456",
        twr_fallback: true,
        error: "Failed to converge after max iterations",
        suggestion: "XIRR could not be calculated. Please display TWR instead.",
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockFallbackResponse,
      });

      const request: XirrComputeRequest = {
        portfolioId: "port-456",
        cashFlows: [
          { flowDate: "2025-01-01", amount: -100000 },
          { flowDate: "2026-01-01", amount: 120000 },
        ],
      };

      const result = await service.computeXirr(request);
      expect(result.twr_fallback).toBe(true);
      expect(result).toEqual(mockFallbackResponse);
    });
  });

  describe("computeBenchmark", () => {
    it("should map benchmark metrics request and return response", async () => {
      const mockResponse = {
        portfolio_id: "port-789",
        benchmark_id: "NIFTY50",
        beta: 1.15,
        alpha_annualised: 0.045,
        alpha_annualised_pct: 4.5,
        correlation: 0.88,
        tracking_error_annualised: 0.08,
        tracking_error_annualised_pct: 8.0,
        information_ratio: 0.56,
        sharpe_ratio: 1.45,
        sortino_ratio: 1.82,
        portfolio_volatility_annualised_pct: 16.5,
        benchmark_volatility_annualised_pct: 14.2,
        n_observations: 250,
        risk_free_rate_annual_pct: 6.5,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const request: BenchmarkComputeRequest = {
        portfolioId: "port-789",
        benchmarkId: "NIFTY50",
        portfolioPrices: [100, 102, 105, 108],
        benchmarkPrices: [100, 101, 103, 105],
        riskFreeRateAnnual: 0.065,
      };

      const result = await service.computeBenchmark(request);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8001/api/v1/performance/benchmark",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            portfolio_id: "port-789",
            benchmark_id: "NIFTY50",
            portfolio_prices: [100, 102, 105, 108],
            benchmark_prices: [100, 101, 103, 105],
            risk_free_rate_annual: 0.065,
          }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("Error handling", () => {
    it("should throw BadGatewayException on 400 bad request from quant engine", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "XIRR requires at least 2 cash flows." }),
      });

      await expect(
        service.computeXirr({
          portfolioId: "port-1",
          cashFlows: [{ flowDate: "2026-01-01", amount: -100 }],
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it("should throw InternalServerErrorException on 500 from quant engine", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Internal computation crash" }),
      });

      await expect(
        service.computeXirr({
          portfolioId: "port-1",
          cashFlows: [
            { flowDate: "2025-01-01", amount: -100 },
            { flowDate: "2026-01-01", amount: 120 },
          ],
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it("should throw ServiceUnavailableException on network fetch failure", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        service.computeTwr({
          portfolioId: "port-1",
          subPeriods: [
            {
              startDate: "2026-01-01",
              endDate: "2026-06-30",
              bmv: 100,
              emv: 110,
            },
          ],
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
