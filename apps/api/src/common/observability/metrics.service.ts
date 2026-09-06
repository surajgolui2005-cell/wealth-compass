import { Injectable, OnModuleInit } from "@nestjs/common";
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // ── Metrics ────────────────────────────────────────────────────────────────
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  public readonly dbConnectionPoolActive: Gauge<string>;
  public readonly dbQueryDuration: Histogram<string>;
  public readonly bullmqQueueDepth: Gauge<string>;
  public readonly riskServiceRequestDuration: Histogram<string>;
  public readonly cacheOperationsTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // Default Node.js runtime metrics
    collectDefaultMetrics({
      register: this.registry,
      prefix: "wealthcompass_",
    });

    // 1. HTTP Request Counter
    this.httpRequestsTotal = new Counter({
      name: "wealthcompass_http_requests_total",
      help: "Total number of HTTP requests processed by the API gateway",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry],
    });

    // 2. HTTP Request Duration Histogram
    this.httpRequestDuration = new Histogram({
      name: "wealthcompass_http_request_duration_seconds",
      help: "HTTP request latency in seconds across endpoints",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // 3. Database Connection Pool Active Gauge
    this.dbConnectionPoolActive = new Gauge({
      name: "wealthcompass_db_connection_pool_active",
      help: "Number of currently active connections in the database pool",
      labelNames: ["pool"],
      registers: [this.registry],
    });

    // 4. Database Query Duration Histogram
    this.dbQueryDuration = new Histogram({
      name: "wealthcompass_db_query_duration_seconds",
      help: "Duration of database queries in seconds",
      labelNames: ["operation", "model"],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [this.registry],
    });

    // 5. BullMQ Queue Depth Gauge
    this.bullmqQueueDepth = new Gauge({
      name: "wealthcompass_bullmq_queue_depth",
      help: "Number of jobs in BullMQ queues categorized by state",
      labelNames: ["queue_name", "status"],
      registers: [this.registry],
    });

    // 6. Risk Engine Latency Histogram
    this.riskServiceRequestDuration = new Histogram({
      name: "wealthcompass_risk_service_request_duration_seconds",
      help: "Roundtrip duration for Python Quant Engine analytics calls",
      labelNames: ["endpoint", "status"],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15],
      registers: [this.registry],
    });

    // 7. Cache Operations Counter
    this.cacheOperationsTotal = new Counter({
      name: "wealthcompass_cache_operations_total",
      help: "Total cache hits, misses, and invalidation operations",
      labelNames: ["store", "operation", "result"],
      registers: [this.registry],
    });
  }

  public onModuleInit(): void {
    // Initialise baseline metrics
    this.dbConnectionPoolActive.labels({ pool: "prisma_postgres" }).set(1);
    this.bullmqQueueDepth.labels({ queue_name: "reports", status: "waiting" }).set(0);
    this.bullmqQueueDepth.labels({ queue_name: "alerts", status: "waiting" }).set(0);
  }

  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route: route || "unknown",
      status_code: String(statusCode),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  public recordDbQuery(operation: string, model: string, durationSeconds: number): void {
    this.dbQueryDuration.observe({ operation, model }, durationSeconds);
  }

  public setDbPoolActive(activeConnections: number, pool: string = "prisma_postgres"): void {
    this.dbConnectionPoolActive.set({ pool }, activeConnections);
  }

  public setQueueDepth(queueName: string, status: string, count: number): void {
    this.bullmqQueueDepth.set({ queue_name: queueName, status }, count);
  }

  public recordRiskServiceLatency(
    endpoint: string,
    status: "success" | "error",
    durationSeconds: number,
  ): void {
    this.riskServiceRequestDuration.observe({ endpoint, status }, durationSeconds);
  }

  public recordCacheOp(
    store: "redis" | "memory",
    operation: "get" | "set" | "del" | "invalidate",
    result: "hit" | "miss" | "ok" | "error",
  ): void {
    this.cacheOperationsTotal.inc({ store, operation, result });
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  public getContentType(): string {
    return this.registry.contentType;
  }

  public getRegistry(): Registry {
    return this.registry;
  }
}
