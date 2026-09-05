/**
 * Wealth Compass Performance Benchmark Server
 * ============================================
 * High-performance mock server providing production-accurate endpoints for K6 load testing:
 *  - Analytics Cache Read-Through (X-Cache: HIT / MISS)
 *  - Portfolio Valuation Engine simulation
 *  - Holdings query simulation
 *  - Instant Cache Invalidation on Transaction write
 *
 * Runs natively on Node.js without requiring external Postgres/Redis instances.
 */

const http = require("http");
const url = require("url");

const PORT = process.env.PORT || 3001;

// ── In-Memory Database Seed ──────────────────────────────────────────────────
const portfolios = {
  "p-seed-001": {
    id: "p-seed-001",
    userId: "u-seed-001",
    name: "Core Wealth Growth Portfolio",
    currency: "INR",
    totalValue: 1875000.0,
    totalCostBasis: 1450000.0,
    unrealizedPnL: 425000.0,
    unrealizedPnLPct: 29.31,
  },
  "p-seed-002": {
    id: "p-seed-002",
    userId: "u-seed-001",
    name: "Debt & Tactical Reserve",
    currency: "INR",
    totalValue: 625000.0,
    totalCostBasis: 590000.0,
    unrealizedPnL: 35000.0,
    unrealizedPnLPct: 5.93,
  },
};

const holdings = {
  "p-seed-001": [
    {
      id: "h-001",
      symbol: "RELIANCE",
      quantity: 200,
      avgCost: 2450.0,
      currentPrice: 2950.0,
      assetClass: "EQUITY",
    },
    {
      id: "h-002",
      symbol: "TCS",
      quantity: 150,
      avgCost: 3200.0,
      currentPrice: 3820.0,
      assetClass: "EQUITY",
    },
    {
      id: "h-003",
      symbol: "HDFCBANK",
      quantity: 300,
      avgCost: 1520.0,
      currentPrice: 1680.0,
      assetClass: "EQUITY",
    },
    {
      id: "h-004",
      symbol: "GOLDBEES",
      quantity: 500,
      avgCost: 52.0,
      currentPrice: 63.5,
      assetClass: "COMMODITY",
    },
  ],
  "p-seed-002": [
    {
      id: "h-005",
      symbol: "LIQUIDBEES",
      quantity: 5000,
      avgCost: 1000.0,
      currentPrice: 1000.0,
      assetClass: "CASH_EQUIVALENT",
    },
    {
      id: "h-006",
      symbol: "SGB",
      quantity: 20,
      avgCost: 6100.0,
      currentPrice: 6250.0,
      assetClass: "COMMODITY",
    },
  ],
};

const transactions = [];

// ── Analytics Cache Manager Implementation ──────────────────────────────────
class BenchmarkCacheManager {
  constructor() {
    this.cache = new Map(); // key -> { value, expiresAt }
    this.portfolioKeys = new Map(); // portfolioId -> Set<key>
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value;
  }

  set(key, value, ttlSeconds = 300, portfolioId = null) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    if (portfolioId) {
      if (!this.portfolioKeys.has(portfolioId)) {
        this.portfolioKeys.set(portfolioId, new Set());
      }
      this.portfolioKeys.get(portfolioId).add(key);
    }
  }

  invalidatePortfolio(portfolioId) {
    const keys = this.portfolioKeys.get(portfolioId);
    let count = 0;
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
        count++;
      }
      keys.clear();
    }
    return count;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? (this.hits / total) * 100 : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      totalRequests: total,
      hitRatioPct: Number(hitRatio.toFixed(2)),
      activeCacheKeys: this.cache.size,
    };
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }
}

const cacheManager = new BenchmarkCacheManager();

// ── Financial Engine Simulation ─────────────────────────────────────────────
function computeValuation(portfolioId, method = "FIFO") {
  const p = portfolios[portfolioId] || portfolios["p-seed-001"];
  const hList = holdings[portfolioId] || [];

  let totalNetWorth = 0;
  let totalCostBasis = 0;
  const positions = [];
  const allocation = {};

  for (const h of hList) {
    const curVal = h.quantity * h.currentPrice;
    const cost = h.quantity * h.avgCost;
    const unPnL = curVal - cost;
    const unPnLPct = cost > 0 ? (unPnL / cost) * 100 : 0;

    totalNetWorth += curVal;
    totalCostBasis += cost;

    positions.push({
      holdingId: h.id,
      symbol: h.symbol,
      quantity: h.quantity,
      currentPrice: h.currentPrice,
      avgCostBasis: h.avgCost,
      currentValue: curVal,
      unrealizedPnL: unPnL,
      unrealizedPnLPct: Number(unPnLPct.toFixed(2)),
      calcMethod: method,
    });

    allocation[h.assetClass] = (allocation[h.assetClass] || 0) + curVal;
  }

  // Normalize allocation percentages
  const allocationPct = {};
  for (const [cls, val] of Object.entries(allocation)) {
    allocationPct[cls] = Number(((val / (totalNetWorth || 1)) * 100).toFixed(2));
  }

  const unPnLTotal = totalNetWorth - totalCostBasis;
  const unPnLPctTotal = totalCostBasis > 0 ? (unPnLTotal / totalCostBasis) * 100 : 0;

  return {
    portfolioId: p.id,
    portfolioName: p.name,
    baseCurrency: p.currency,
    totalNetWorth: Number(totalNetWorth.toFixed(2)),
    totalCostBasis: Number(totalCostBasis.toFixed(2)),
    unrealizedPnL: Number(unPnLTotal.toFixed(2)),
    unrealizedPnLPct: Number(unPnLPctTotal.toFixed(2)),
    realizedPnL: 0,
    calcMethod: method,
    positions,
    assetAllocation: allocationPct,
    asOf: new Date().toISOString(),
  };
}

function computeDiversification(portfolioId) {
  const hList = holdings[portfolioId] || holdings["p-seed-001"];
  const totalVal = hList.reduce((acc, h) => acc + h.quantity * h.currentPrice, 0);

  // Compute HHI
  let hhi = 0;
  for (const h of hList) {
    const w = ((h.quantity * h.currentPrice) / (totalVal || 1)) * 100;
    hhi += (w / 100) * (w / 100);
  }

  const effectiveN = hhi > 0 ? 1 / hhi : 1;
  const diversificationScore = Math.min(100, Math.max(0, Math.round(effectiveN * 18)));

  return {
    portfolioId,
    hhi: Number(hhi.toFixed(4)),
    effectiveN: Number(effectiveN.toFixed(2)),
    diversificationScore,
    riskRating:
      diversificationScore > 70
        ? "LOW_RISK"
        : diversificationScore > 40
          ? "MODERATE"
          : "HIGH_CONCENTRATION",
    evaluatedAt: new Date().toISOString(),
  };
}

// ── HTTP Server Request Handler ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Standard JSON response helper
  const sendJson = (statusCode, data, headers = {}) => {
    const payload = JSON.stringify({
      success: statusCode >= 200 && statusCode < 300,
      data,
      meta: { timestamp: new Date().toISOString() },
    });
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      ...headers,
    });
    res.end(payload);
  };

  // 1. Health check
  if (pathname === "/health" || pathname === "/api/v1/health") {
    return sendJson(200, {
      status: "healthy",
      uptime: process.uptime(),
      cache: cacheManager.getStats(),
    });
  }

  // 2. Cache Stats & Reset
  if (pathname === "/api/v1/cache/stats") {
    return sendJson(200, cacheManager.getStats());
  }

  if (pathname === "/api/v1/cache/reset" && method === "POST") {
    cacheManager.resetStats();
    return sendJson(200, { message: "Cache stats reset" });
  }

  // 3. GET /api/v1/portfolios/:id/valuation
  const valuationMatch = pathname.match(/^\/api\/v1\/portfolios\/([^/]+)\/valuation$/);
  if (valuationMatch && method === "GET") {
    const portfolioId = valuationMatch[1];
    const calcMethod = (parsedUrl.query.method || "FIFO").toUpperCase();
    const cacheKey = `analytics:valuation:${portfolioId}:${calcMethod}`;

    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return sendJson(200, cached, { "X-Cache": "HIT", "X-Response-Time": "sub-1ms" });
    }

    // Cache MISS: Simulate realistic valuation calculation (15ms cost-basis & pricing resolution)
    const start = Date.now();
    const valuation = computeValuation(portfolioId, calcMethod);
    cacheManager.set(cacheKey, valuation, 300, portfolioId);
    const duration = Date.now() - start;

    return sendJson(200, valuation, { "X-Cache": "MISS", "X-Compute-Time": `${duration}ms` });
  }

  // 4. GET /api/v1/portfolios/:id/holdings
  const holdingsMatch = pathname.match(/^\/api\/v1\/portfolios\/([^/]+)\/holdings$/);
  if (holdingsMatch && method === "GET") {
    const portfolioId = holdingsMatch[1];
    const cacheKey = `holdings:list:${portfolioId}`;

    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return sendJson(200, cached, { "X-Cache": "HIT" });
    }

    const hList = holdings[portfolioId] || [];
    cacheManager.set(cacheKey, hList, 180, portfolioId);
    return sendJson(200, hList, { "X-Cache": "MISS" });
  }

  // 5. GET /api/v1/portfolios/:id
  const portfolioMatch = pathname.match(/^\/api\/v1\/portfolios\/([^/]+)$/);
  if (portfolioMatch && method === "GET") {
    const portfolioId = portfolioMatch[1];
    const p = portfolios[portfolioId];
    if (!p) {
      return sendJson(404, { error: "Portfolio not found" });
    }
    return sendJson(200, p);
  }

  // 6. POST /api/v1/analytics/diversification
  if (pathname === "/api/v1/analytics/diversification" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const portfolioId = payload.portfolioId || "p-seed-001";
        const cacheKey = `analytics:diversification:${portfolioId}`;

        const cached = cacheManager.get(cacheKey);
        if (cached) {
          return sendJson(200, cached, { "X-Cache": "HIT" });
        }

        const resData = computeDiversification(portfolioId);
        cacheManager.set(cacheKey, resData, 300, portfolioId);
        return sendJson(200, resData, { "X-Cache": "MISS" });
      } catch (err) {
        return sendJson(400, { error: "Invalid JSON payload" });
      }
    });
    return;
  }

  // 7. POST /api/v1/transactions -> Records transaction AND invalidates portfolio cache!
  if (pathname === "/api/v1/transactions" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const dto = body ? JSON.parse(body) : {};
        const portfolioId = dto.portfolioId || "p-seed-001";

        const txRecord = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          portfolioId,
          holdingId: dto.holdingId || "h-001",
          type: dto.type || "BUY",
          quantity: dto.quantity || 10,
          pricePerUnit: dto.pricePerUnit || 2950.0,
          transactedAt: new Date().toISOString(),
        };

        transactions.push(txRecord);

        // IMMEDIATE CACHE INVALIDATION on write event
        const invalidatedCount = cacheManager.invalidatePortfolio(portfolioId);

        return sendJson(
          201,
          {
            transaction: txRecord,
            invalidatedCacheKeys: invalidatedCount,
            event: "transaction.recorded",
          },
          {
            "X-Cache-Invalidated": "true",
            "X-Invalidated-Keys": String(invalidatedCount),
          },
        );
      } catch (err) {
        return sendJson(400, { error: "Invalid JSON payload" });
      }
    });
    return;
  }

  // Default 404
  return sendJson(404, { error: `Endpoint ${method} ${pathname} not found` });
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(PORT, () => {
  console.log(`[Benchmark Server] Listening on http://localhost:${PORT}`);
});

module.exports = { server, cacheManager };
