import { MetricsService } from "../metrics.service";

describe("MetricsService", () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
    service.onModuleInit();
  });

  it("should initialize default Prometheus metrics with prefix", async () => {
    const metrics = await service.getMetrics();
    expect(metrics).toContain("wealthcompass_");
    expect(metrics).toContain("wealthcompass_http_requests_total");
    expect(metrics).toContain("wealthcompass_http_request_duration_seconds");
  });

  it("should record HTTP requests and latency observations", async () => {
    service.recordHttpRequest("GET", "/api/v1/portfolios", 200, 0.045);
    service.recordHttpRequest("POST", "/api/v1/transactions", 201, 0.12);

    const metrics = await service.getMetrics();

    expect(metrics).toContain('method="GET",route="/api/v1/portfolios",status_code="200"');
    expect(metrics).toContain('method="POST",route="/api/v1/transactions",status_code="201"');
  });

  it("should track database connection pool and query latencies", async () => {
    service.setDbPoolActive(8, "prisma_postgres");
    service.recordDbQuery("findMany", "Portfolio", 0.012);

    const metrics = await service.getMetrics();

    expect(metrics).toContain('wealthcompass_db_connection_pool_active{pool="prisma_postgres"} 8');
    expect(metrics).toContain("wealthcompass_db_query_duration_seconds");
  });

  it("should record BullMQ queue depth and cache telemetry", async () => {
    service.setQueueDepth("reports", "waiting", 15);
    service.recordCacheOp("redis", "get", "hit");

    const metrics = await service.getMetrics();

    expect(metrics).toContain(
      'wealthcompass_bullmq_queue_depth{queue_name="reports",status="waiting"} 15',
    );
    expect(metrics).toContain(
      'wealthcompass_cache_operations_total{store="redis",operation="get",result="hit"} 1',
    );
  });

  it("should return valid Prometheus Content-Type header string", () => {
    const contentType = service.getContentType();
    expect(contentType).toContain("text/plain");
  });
});
