import { Test, TestingModule } from "@nestjs/testing";
import { HttpStatus } from "@nestjs/common";
import { HealthController } from "../health.controller";
import { HealthService } from "../health.service";
import { MetricsService } from "../../../common/observability/metrics.service";

describe("HealthController", () => {
  let controller: HealthController;
  let mockHealthService: any;
  let mockMetricsService: any;

  beforeEach(async () => {
    mockHealthService = {
      checkLiveness: jest.fn().mockReturnValue({
        status: "ok",
        uptime: 100,
        timestamp: "2026-09-06T12:00:00.000Z",
        service: "wealthcompass-api",
      }),
      checkReadiness: jest.fn().mockResolvedValue({
        status: "ok",
        isHealthy: true,
        timestamp: "2026-09-06T12:00:00.000Z",
        uptime: 100,
        checks: {
          database: { status: "up", latencyMs: 2 },
          redis: { status: "up", latencyMs: 1 },
          python_analytics: { status: "up", latencyMs: 3 },
        },
      }),
    };

    mockMetricsService = {
      getMetrics: jest.fn().mockResolvedValue("# HELP wealthcompass_http_requests_total ..."),
      getContentType: jest.fn().mockReturnValue("text/plain; version=0.0.4; charset=utf-8"),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: mockHealthService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe("GET /health", () => {
    it("should return liveness result", () => {
      const res = controller.getLiveness();
      expect(res.status).toBe("ok");
      expect(mockHealthService.checkLiveness).toHaveBeenCalled();
    });
  });

  describe("GET /health/readiness", () => {
    it("should return readiness result with HTTP 200 when healthy", async () => {
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getReadiness(mockRes);

      expect(result.status).toBe("ok");
      expect(result.isHealthy).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should set HTTP 503 status when dependencies are degraded", async () => {
      mockHealthService.checkReadiness.mockResolvedValue({
        status: "degraded",
        isHealthy: false,
        checks: {
          database: { status: "down", error: "Connection refused" },
          redis: { status: "up" },
          python_analytics: { status: "up" },
        },
      });

      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getReadiness(mockRes);

      expect(result.status).toBe("degraded");
      expect(result.isHealthy).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe("GET /metrics", () => {
    it("should return Prometheus exposition format with header", async () => {
      const mockRes: any = {
        setHeader: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      await controller.getMetrics(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/plain; version=0.0.4; charset=utf-8",
      );
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockRes.send).toHaveBeenCalledWith("# HELP wealthcompass_http_requests_total ...");
    });
  });
});
