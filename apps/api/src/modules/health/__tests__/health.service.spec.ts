import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HealthService } from "../health.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AnalyticsCacheManager } from "../../../common/cache/analytics-cache.manager";

describe("HealthService", () => {
  let service: HealthService;
  let mockPrisma: any;
  let mockCacheManager: any;
  let mockConfig: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    };

    mockCacheManager = {
      ping: jest.fn().mockResolvedValue(true),
    };

    mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === "QUANT_ENGINE_URL") return "http://localhost:8001";
        if (key === "REDIS_URL") return "redis://localhost:6379";
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AnalyticsCacheManager, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("checkLiveness", () => {
    it("should return ok status with uptime and service identifier", () => {
      const result = service.checkLiveness();
      expect(result.status).toBe("ok");
      expect(typeof result.uptime).toBe("number");
      expect(result.service).toBe("wealthcompass-api");
      expect(result.timestamp).toBeDefined();
    });
  });

  describe("checkReadiness", () => {
    it("should return ok status when DB, Redis, and Python service are UP", async () => {
      // Mock successful fetch for Python service
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      } as any);

      const result = await service.checkReadiness();

      expect(result.status).toBe("ok");
      expect(result.isHealthy).toBe(true);
      expect(result.checks.database.status).toBe("up");
      expect(result.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.checks.redis.status).toBe("up");
      expect(result.checks.python_analytics.status).toBe("up");
    });

    it("should mark health degraded if database query fails", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("Database connection refused"));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      const result = await service.checkReadiness();

      expect(result.status).toBe("degraded");
      expect(result.isHealthy).toBe(false);
      expect(result.checks.database.status).toBe("down");
      expect(result.checks.database.error).toContain("Database connection refused");
      expect(result.checks.redis.status).toBe("up");
      expect(result.checks.python_analytics.status).toBe("up");
    });

    it("should mark health degraded if Redis ping fails", async () => {
      mockCacheManager.ping.mockResolvedValue(false);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      const result = await service.checkReadiness();

      expect(result.status).toBe("degraded");
      expect(result.isHealthy).toBe(false);
      expect(result.checks.database.status).toBe("up");
      expect(result.checks.redis.status).toBe("down");
    });

    it("should mark health degraded if Python service times out or returns error", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Connection to quant-engine refused"));

      const result = await service.checkReadiness();

      expect(result.status).toBe("degraded");
      expect(result.isHealthy).toBe(false);
      expect(result.checks.database.status).toBe("up");
      expect(result.checks.redis.status).toBe("up");
      expect(result.checks.python_analytics.status).toBe("down");
      expect(result.checks.python_analytics.error).toContain("Connection to quant-engine refused");
    });
  });
});
