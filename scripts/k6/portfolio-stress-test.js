import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom SLA and performance metrics
const valuationDuration = new Trend("portfolio_valuation_duration", true);
const holdingsDuration = new Trend("portfolio_holdings_duration", true);
const diversificationDuration = new Trend("diversification_duration", true);
const cacheHits = new Counter("cache_hits");
const cacheMisses = new Counter("cache_misses");
const successfulRequests = new Rate("successful_requests");

export const options = {
  stages: [
    { duration: "10s", target: 250 }, // Warm-up ramp
    { duration: "15s", target: 500 }, // Moderate concurrency ramp
    { duration: "20s", target: 1000 }, // Peak load ramp to 1,000 concurrent VUs
    { duration: "20s", target: 1000 }, // Sustained 1,000 concurrent VU peak
    { duration: "10s", target: 0 }, // Cool-down ramp
  ],
  thresholds: {
    // Primary SLA: p95 latency < 200ms under 1,000 concurrent users
    http_req_duration: ["p(90)<150", "p(95)<200", "p(99)<350"],
    portfolio_valuation_duration: ["p(95)<200"],
    portfolio_holdings_duration: ["p(95)<150"],
    diversification_duration: ["p(95)<200"],
    // 0% Server Errors SLA
    http_req_failed: ["rate<0.001"],
    successful_requests: ["rate>0.999"],
    checks: ["rate>0.99"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const PORTFOLIO_IDS = ["p-seed-001", "p-seed-002"];

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer mock-jwt-token-access",
  };

  // Select random portfolio
  const portfolioId = PORTFOLIO_IDS[Math.floor(Math.random() * PORTFOLIO_IDS.length)];

  // Weighted traffic distribution: 60% valuation, 25% holdings, 15% diversification
  const rand = Math.random();

  if (rand < 0.6) {
    // ── 1. Portfolio Valuation (Cached Read-Through) ──────────────────────────
    const res = http.get(`${BASE_URL}/api/v1/portfolios/${portfolioId}/valuation?method=FIFO`, {
      headers,
    });

    const isSuccess = check(res, {
      "Valuation status is 200": (r) => r.status === 200,
      "Valuation response envelope valid": (r) => {
        const body = JSON.parse(r.body);
        return body.success === true && body.data.totalNetWorth > 0;
      },
    });

    valuationDuration.add(res.timings.duration);
    successfulRequests.add(isSuccess ? 1 : 0);

    if (res.headers["X-Cache"] === "HIT") {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
  } else if (rand < 0.85) {
    // ── 2. Portfolio Holdings List ────────────────────────────────────────────
    const res = http.get(`${BASE_URL}/api/v1/portfolios/${portfolioId}/holdings`, { headers });

    const isSuccess = check(res, {
      "Holdings status is 200": (r) => r.status === 200,
      "Holdings response is array": (r) => {
        const body = JSON.parse(r.body);
        return body.success === true && Array.isArray(body.data);
      },
    });

    holdingsDuration.add(res.timings.duration);
    successfulRequests.add(isSuccess ? 1 : 0);

    if (res.headers["X-Cache"] === "HIT") {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
  } else {
    // ── 3. Diversification Analytics ─────────────────────────────────────────
    const payload = JSON.stringify({ portfolioId });
    const res = http.post(`${BASE_URL}/api/v1/analytics/diversification`, payload, { headers });

    const isSuccess = check(res, {
      "Diversification status is 200": (r) => r.status === 200,
      "Diversification score valid": (r) => {
        const body = JSON.parse(r.body);
        return body.success === true && body.data.diversificationScore >= 0;
      },
    });

    diversificationDuration.add(res.timings.duration);
    successfulRequests.add(isSuccess ? 1 : 0);

    if (res.headers["X-Cache"] === "HIT") {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
  }

  // Inter-request pacing to simulate realistic active investor behavior (250ms - 500ms think time)
  sleep(0.25 + Math.random() * 0.25);
}
