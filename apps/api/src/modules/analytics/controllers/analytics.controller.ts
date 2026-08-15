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
} from "../dto/analytics.dto";

/**
 * AnalyticsController
 * ===================
 * Exposes REST endpoints for performance analytics proxying to the Python quant-engine.
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
}
