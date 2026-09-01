import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { AnalyticsClientService } from "../analytics-client.service";
import {
  BenchmarkComputeRequest,
  BenchmarkResponseDto,
  TwrComputeRequest,
  TwrResponseDto,
  XirrComputeRequest,
  XirrResultDto,
  AllocationComputeRequest,
  AllocationResponseDto,
  RebalanceComputeRequest,
  RebalanceResponseDto,
  DiversificationComputeRequest,
  DiversificationResponseDto,
} from "../dto/analytics.dto";

/**
 * AnalyticsController
 * ===================
 * Exposes REST endpoints for performance and allocation analytics proxying to the Python quant-engine.
 */
@UseGuards(JwtAuthGuard)
@Controller("api/v1/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsClientService: AnalyticsClientService) {}

  /**
   * POST /api/v1/analytics/twr
   * Computes Time-Weighted Return (Modified Dietz sub-period chain linking).
   */
  @Post("twr")
  @HttpCode(HttpStatus.OK)
  async computeTwr(@Body() body: TwrComputeRequest): Promise<TwrResponseDto> {
    return this.analyticsClientService.computeTwr(body);
  }

  /**
   * POST /api/v1/analytics/xirr
   * Computes Extended Internal Rate of Return (Newton-Raphson + Brent fallback).
   */
  @Post("xirr")
  @HttpCode(HttpStatus.OK)
  async computeXirr(@Body() body: XirrComputeRequest): Promise<XirrResultDto> {
    return this.analyticsClientService.computeXirr(body);
  }

  /**
   * POST /api/v1/analytics/benchmark
   * Computes Beta, Alpha, Sharpe, Sortino, Tracking Error, Information Ratio, and Correlation.
   */
  @Post("benchmark")
  @HttpCode(HttpStatus.OK)
  async computeBenchmark(@Body() body: BenchmarkComputeRequest): Promise<BenchmarkResponseDto> {
    return this.analyticsClientService.computeBenchmark(body);
  }

  /**
   * POST /api/v1/analytics/allocation
   * Aggregates portfolio positions by the specified dimension (asset_class | sector |
   * geography | currency | provider). Returns allocation buckets summing to exactly
   * 100%. Unclassified assets are grouped under 'Unassigned / Other'.
   */
  @Post("allocation")
  @HttpCode(HttpStatus.OK)
  async computeAllocation(@Body() body: AllocationComputeRequest): Promise<AllocationResponseDto> {
    return this.analyticsClientService.computeAllocation(body);
  }

  /**
   * POST /api/v1/analytics/rebalance
   * Computes portfolio drift vs target model weights and returns the exact buy/sell
   * amounts (in home currency) required to return to the target allocation.
   */
  @Post("rebalance")
  @HttpCode(HttpStatus.OK)
  async computeRebalance(@Body() body: RebalanceComputeRequest): Promise<RebalanceResponseDto> {
    return this.analyticsClientService.computeRebalance(body);
  }

  /**
   * POST /api/v1/analytics/diversification
   *
   * Computes a multi-signal diversification and concentration profile for a portfolio:
   *   - HHI (Herfindahl-Hirschman Index) at asset-level and optional sector-level
   *   - Effective N (equivalent equal-weight portfolio size)
   *   - Top-N Concentration Ratios (cumulative weight of the N largest holdings)
   *   - Composite 0–100 Diversification Score:
   *       Component A (60%): Effective-N weight-concentration score
   *       Component B (40%): Weight-averaged pairwise correlation penalty
   *
   * Correlation data is optional. When omitted, Component B defaults to 50
   * (neutral — uncorrelated assumption). The score is still meaningful without
   * correlation data; it will be driven entirely by weight concentration (HHI).
   *
   * @example Request (minimal — weights only):
   * ```json
   * {
   *   "portfolioId": "p-123",
   *   "assetWeights": [
   *     { "assetId": "RELIANCE", "weight": 40 },
   *     { "assetId": "INFY",     "weight": 30 },
   *     { "assetId": "TCS",      "weight": 30 }
   *   ]
   * }
   * ```
   */
  @Post("diversification")
  @HttpCode(HttpStatus.OK)
  async computeDiversification(
    @Body() body: DiversificationComputeRequest,
  ): Promise<DiversificationResponseDto> {
    return this.analyticsClientService.computeDiversification(body);
  }
}
