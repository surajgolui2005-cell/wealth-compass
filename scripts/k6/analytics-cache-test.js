import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom Metrics
const coldCacheDuration = new Trend("cold_cache_duration", true);
const warmCacheDuration = new Trend("warm_cache_duration", true);
const cacheHitRate = new Rate("cache_hit_rate");
const invalidationSuccess = new Rate("invalidation_success");
const totalTransactions = new Counter("total_transactions_recorded");

export const options = {
  scenarios: {
    cache_verification: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 20,
      maxDuration: "1m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<100"],
    cold_cache_duration: ["p(95)<200"],
    warm_cache_duration: ["p(95)<25"],
    cache_hit_rate: ["rate>0.80"],
    invalidation_success: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const PORTFOLIO_ID = "p-seed-001";

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer mock-jwt-token-access",
  };

  // ── 1. Cold Cache Valuation Request ─────────────────────────────────────────
  // First iteration in a run may trigger cold read
  const res1 = http.get(`${BASE_URL}/api/v1/portfolios/${PORTFOLIO_ID}/valuation?method=FIFO`, {
    headers,
  });
  const isColdHit = res1.headers["X-Cache"] === "HIT";

  check(res1, {
    "Valuation status is 200": (r) => r.status === 200,
    "Valuation has totalNetWorth": (r) => JSON.parse(r.body).data.totalNetWorth > 0,
    "Valuation has X-Cache header": (r) => r.headers["X-Cache"] !== undefined,
  });

  if (isColdHit) {
    warmCacheDuration.add(res1.timings.duration);
    cacheHitRate.add(1);
  } else {
    coldCacheDuration.add(res1.timings.duration);
    cacheHitRate.add(0);
  }

  sleep(0.05);

  // ── 2. Warm Cache Subsequent Reads (expect 100% HIT) ────────────────────────
  for (let i = 0; i < 4; i++) {
    const warmRes = http.get(
      `${BASE_URL}/api/v1/portfolios/${PORTFOLIO_ID}/valuation?method=FIFO`,
      { headers },
    );
    const isWarmHit = warmRes.headers["X-Cache"] === "HIT";

    check(warmRes, {
      "Warm read status is 200": (r) => r.status === 200,
      "Warm read returned X-Cache: HIT": (r) => r.headers["X-Cache"] === "HIT",
    });

    warmCacheDuration.add(warmRes.timings.duration);
    cacheHitRate.add(isWarmHit ? 1 : 0);
  }

  sleep(0.05);

  // ── 3. Write Event: Record New Transaction (Triggers Invalidation) ──────────
  const txPayload = JSON.stringify({
    portfolioId: PORTFOLIO_ID,
    holdingId: "h-001",
    type: "BUY",
    quantity: 10,
    pricePerUnit: 2950.0,
  });

  const txRes = http.post(`${BASE_URL}/api/v1/transactions`, txPayload, { headers });

  const isTxSuccess = check(txRes, {
    "Transaction created (201)": (r) => r.status === 201,
    "Cache Invalidation triggered": (r) => r.headers["X-Cache-Invalidated"] === "true",
  });

  invalidationSuccess.add(isTxSuccess ? 1 : 0);
  totalTransactions.add(1);

  // ── 4. Verify Immediate Post-Invalidation Read is MISS ──────────────────────
  const postInvalidateRes = http.get(
    `${BASE_URL}/api/v1/portfolios/${PORTFOLIO_ID}/valuation?method=FIFO`,
    { headers },
  );
  const isPostMiss = postInvalidateRes.headers["X-Cache"] === "MISS";

  check(postInvalidateRes, {
    "Post-invalidation read status is 200": (r) => r.status === 200,
    "Post-invalidation resulted in fresh MISS": () => isPostMiss,
  });

  if (isPostMiss) {
    coldCacheDuration.add(postInvalidateRes.timings.duration);
    cacheHitRate.add(0);
  } else {
    warmCacheDuration.add(postInvalidateRes.timings.duration);
    cacheHitRate.add(1);
  }

  // ── 5. Subsequent Read is Re-warmed (HIT) ────────────────────────────────────
  const rewarmedRes = http.get(
    `${BASE_URL}/api/v1/portfolios/${PORTFOLIO_ID}/valuation?method=FIFO`,
    { headers },
  );
  check(rewarmedRes, {
    "Rewarmed read returned X-Cache: HIT": (r) => r.headers["X-Cache"] === "HIT",
  });

  warmCacheDuration.add(rewarmedRes.timings.duration);
  cacheHitRate.add(rewarmedRes.headers["X-Cache"] === "HIT" ? 1 : 0);

  sleep(0.1);
}
