import { Controller, Get, Res, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { HealthService } from "./health.service";
import { MetricsService } from "../../common/observability/metrics.service";

@ApiTags("Observability & Health")
@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Fast liveness probe" })
  @ApiResponse({ status: 200, description: "Process is alive and running" })
  public getLiveness() {
    return this.healthService.checkLiveness();
  }

  @Get("health/liveness")
  @ApiOperation({ summary: "Explicit liveness probe endpoint" })
  @ApiResponse({ status: 200, description: "Process is alive and running" })
  public getExplicitLiveness() {
    return this.healthService.checkLiveness();
  }

  @Get("health/readiness")
  @ApiOperation({
    summary: "Deep readiness probe validating PostgreSQL, Redis, and Python Quant Engine",
  })
  @ApiResponse({
    status: 200,
    description: "All backing services are healthy and responsive",
  })
  @ApiResponse({
    status: 503,
    description: "One or more backing services are degraded or unreachable",
  })
  public async getReadiness(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.checkReadiness();

    if (!result.isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }

  @Get("metrics")
  @ApiOperation({ summary: "Prometheus formatted metrics exporter" })
  @ApiResponse({
    status: 200,
    description: "Prometheus text exposition format (version 0.0.4)",
  })
  public async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.setHeader("Content-Type", this.metricsService.getContentType());
    res.status(HttpStatus.OK).send(metrics);
  }
}
