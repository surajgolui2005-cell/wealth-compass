import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsCacheManager } from "../../common/cache/analytics-cache.manager";

export interface ComponentHealth {
  status: "up" | "down";
  latencyMs: number;
  error?: string;
  statusCode?: number;
  url?: string;
}

export interface ReadinessResult {
  status: "ok" | "degraded";
  isHealthy: boolean;
  timestamp: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    python_analytics: ComponentHealth;
  };
}

export interface LivenessResult {
  status: "ok";
  uptime: number;
  timestamp: string;
  service: string;
}

@Injectable()
export class HealthService {
  private readonly quantEngineUrl: string;
  private readonly redisUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly cacheManager?: AnalyticsCacheManager,
  ) {
    this.quantEngineUrl = this.configService
      .get<string>("QUANT_ENGINE_URL", "http://localhost:8001")
      .replace(/\/$/, "");

    this.redisUrl =
      this.configService.get<string>("REDIS_URL") ||
      process.env.REDIS_URL ||
      "redis://localhost:6379";
  }

  /**
   * Fast, lightweight liveness probe indicating container process viability.
   */
  public checkLiveness(): LivenessResult {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: "wealthcompass-api",
    };
  }

  /**
   * Deep readiness probe validating database, Redis, and Python Quant Engine connectivity.
   */
  public async checkReadiness(): Promise<ReadinessResult> {
    let isHealthy = true;

    // 1. Check PostgreSQL via Prisma
    const dbStart = Date.now();
    let dbHealth: ComponentHealth;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbHealth = {
        status: "up",
        latencyMs: Date.now() - dbStart,
      };
    } catch (err: any) {
      isHealthy = false;
      dbHealth = {
        status: "down",
        latencyMs: Date.now() - dbStart,
        error: err?.message || "Database connection failed",
      };
    }

    // 2. Check Redis
    const redisStart = Date.now();
    let redisHealth: ComponentHealth;
    try {
      let isUp = false;
      if (this.cacheManager) {
        isUp = await this.cacheManager.ping();
      }

      if (!isUp) {
        const client = new Redis(this.redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 1000,
          lazyConnect: true,
        });
        await client.connect();
        const pong = await client.ping();
        await client.quit().catch(() => {});
        isUp = pong === "PONG";
      }

      if (isUp) {
        redisHealth = {
          status: "up",
          latencyMs: Date.now() - redisStart,
        };
      } else {
        isHealthy = false;
        redisHealth = {
          status: "down",
          latencyMs: Date.now() - redisStart,
          error: "Redis ping failed",
        };
      }
    } catch (err: any) {
      isHealthy = false;
      redisHealth = {
        status: "down",
        latencyMs: Date.now() - redisStart,
        error: err?.message || "Redis connection failed",
      };
    }

    // 3. Check Python Quant Analytics Engine
    const pythonStart = Date.now();
    const pythonEndpoint = `${this.quantEngineUrl}/health`;
    let pythonHealth: ComponentHealth;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(pythonEndpoint, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        pythonHealth = {
          status: "up",
          latencyMs: Date.now() - pythonStart,
          url: pythonEndpoint,
        };
      } else {
        isHealthy = false;
        pythonHealth = {
          status: "down",
          statusCode: response.status,
          latencyMs: Date.now() - pythonStart,
          url: pythonEndpoint,
          error: `Service returned HTTP ${response.status}`,
        };
      }
    } catch (err: any) {
      isHealthy = false;
      pythonHealth = {
        status: "down",
        latencyMs: Date.now() - pythonStart,
        url: pythonEndpoint,
        error:
          err?.name === "AbortError"
            ? "Health check timed out (2000ms)"
            : err?.message || "Connection refused",
      };
    }

    return {
      status: isHealthy ? "ok" : "degraded",
      isHealthy,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbHealth,
        redis: redisHealth,
        python_analytics: pythonHealth,
      },
    };
  }
}
