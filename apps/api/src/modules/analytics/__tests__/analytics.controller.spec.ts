import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsController } from "../controllers/analytics.controller";
import { AnalyticsClientService } from "../analytics-client.service";
import { AnalyticsCacheManager } from "../../../common/cache/analytics-cache.manager";
import {
  BenchmarkComputeRequest,
  TwrComputeRequest,
  XirrComputeRequest,
} from "../dto/analytics.dto";

describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let clientService: AnalyticsClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsClientService,
          useValue: {
            computeTwr: jest.fn(),
            computeXirr: jest.fn(),
            computeBenchmark: jest.fn(),
          },
        },
        {
          provide: AnalyticsCacheManager,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            invalidatePortfolio: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    clientService = module.get<AnalyticsClientService>(AnalyticsClientService);
  });

  it("should forward computeTwr to AnalyticsClientService", async () => {
    const request: TwrComputeRequest = {
      portfolioId: "port-1",
      subPeriods: [
        {
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          bmv: 1000,
          emv: 1200,
        },
      ],
    };
    const expected = {
      portfolio_id: "port-1",
      twr_cumulative: 0.2,
      twr_annualised: 0.2,
      twr_cumulative_pct: 20.0,
      twr_annualised_pct: 20.0,
      sub_period_returns: [0.2],
      total_days: 365,
      n_sub_periods: 1,
    };

    (clientService.computeTwr as jest.Mock).mockResolvedValue(expected);

    const result = await controller.computeTwr(request);
    expect(clientService.computeTwr).toHaveBeenCalledWith(request);
    expect(result).toEqual(expected);
  });

  it("should forward computeXirr to AnalyticsClientService", async () => {
    const request: XirrComputeRequest = {
      portfolioId: "port-1",
      cashFlows: [
        { flowDate: "2025-01-01", amount: -100 },
        { flowDate: "2026-01-01", amount: 120 },
      ],
    };
    const expected = {
      portfolio_id: "port-1",
      xirr: 0.2,
      xirr_pct: 20.0,
      npv_at_solution: 0.0,
      solver_used: "newton_raphson" as const,
      iterations: 5,
      n_cash_flows: 2,
      twr_fallback: false as const,
    };

    (clientService.computeXirr as jest.Mock).mockResolvedValue(expected);

    const result = await controller.computeXirr(request);
    expect(clientService.computeXirr).toHaveBeenCalledWith(request);
    expect(result).toEqual(expected);
  });

  it("should forward computeBenchmark to AnalyticsClientService", async () => {
    const request: BenchmarkComputeRequest = {
      portfolioId: "port-1",
      benchmarkId: "NIFTY50",
      portfolioPrices: [100, 105, 110],
      benchmarkPrices: [100, 102, 104],
    };
    const expected = {
      portfolio_id: "port-1",
      benchmark_id: "NIFTY50",
      beta: 1.0,
      alpha_annualised: 0.0,
      alpha_annualised_pct: 0.0,
      correlation: 1.0,
      tracking_error_annualised: 0.0,
      tracking_error_annualised_pct: 0.0,
      information_ratio: null,
      sharpe_ratio: 1.5,
      sortino_ratio: 2.0,
      portfolio_volatility_annualised_pct: 12.0,
      benchmark_volatility_annualised_pct: 10.0,
      n_observations: 2,
      risk_free_rate_annual_pct: 6.5,
    };

    (clientService.computeBenchmark as jest.Mock).mockResolvedValue(expected);

    const result = await controller.computeBenchmark(request);
    expect(clientService.computeBenchmark).toHaveBeenCalledWith(request);
    expect(result).toEqual(expected);
  });
});
