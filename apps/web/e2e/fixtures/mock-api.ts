import { Page } from "@playwright/test";
import {
  SEED_USER,
  SEED_PORTFOLIOS,
  SEED_HOLDINGS,
  SEED_ANALYTICS,
  SEED_RISK,
  SEED_ALERTS,
  SEED_REPORTS,
} from "./seed-data";

function successEnvelope(data: any, metaExtra: Record<string, any> = {}) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...metaExtra,
    },
  };
}

function errorEnvelope(code: string, message: string, details?: any) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Configure deterministic route mocking on the given Playwright Page.
 * Intercepts all calls to /api/v1/* and returns seeded fixtures.
 */
export async function setupMockApi(
  page: Page,
  options: { isAuthenticated?: boolean } = { isAuthenticated: true },
) {
  let isAuthed = options.isAuthenticated ?? true;
  const portfolios = [...SEED_PORTFOLIOS];
  const alertRules = [...SEED_ALERTS.rules];
  const reports: any[] = [...SEED_REPORTS];

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    // ── AUTH ENDPOINTS ────────────────────────────────────────────────────────
    if (path.endsWith("/auth/me")) {
      if (isAuthed) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(successEnvelope(SEED_USER)),
        });
      } else {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify(errorEnvelope("UNAUTHORIZED", "Session invalid or expired")),
        });
      }
    }

    if (path.endsWith("/auth/login") && method === "POST") {
      const body = route.request().postDataJSON();
      if (body?.email === SEED_USER.email && body?.password === SEED_USER.password) {
        isAuthed = true;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            successEnvelope({
              user: SEED_USER,
              accessToken: "mock-jwt-token-access",
            }),
          ),
        });
      } else {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify(errorEnvelope("INVALID_CREDENTIALS", "Invalid email or password")),
        });
      }
    }

    if (path.endsWith("/auth/register") && method === "POST") {
      const body = route.request().postDataJSON();
      isAuthed = true;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(
          successEnvelope({
            user: { ...SEED_USER, email: body.email, name: body.name },
            accessToken: "mock-jwt-token-access",
          }),
        ),
      });
    }

    if (path.endsWith("/auth/logout") && method === "POST") {
      isAuthed = false;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope({ loggedOut: true })),
      });
    }

    // Guard all subsequent endpoints with auth check
    if (!isAuthed) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify(errorEnvelope("UNAUTHORIZED", "Authentication required")),
      });
    }

    // ── PORTFOLIOS ENDPOINTS ──────────────────────────────────────────────────
    if (path.endsWith("/portfolios") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(portfolios)),
      });
    }

    if (path.endsWith("/portfolios") && method === "POST") {
      const payload = route.request().postDataJSON();
      const newPortfolio = {
        id: `p-new-${Date.now()}`,
        userId: SEED_USER.id,
        name: payload.name || "New Portfolio",
        description: payload.description || "",
        currency: payload.currency || "INR",
        totalValue: 0,
        totalCostBasis: 0,
        unrealizedPnL: 0,
        unrealizedPnLPct: 0,
        holdingCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      portfolios.push(newPortfolio);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(newPortfolio)),
      });
    }

    if (path.includes("/summary") && method === "GET") {
      const p = portfolios[0];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successEnvelope({
            ...p,
            totalPnl: p.unrealizedPnL,
            totalPnlPct: p.unrealizedPnLPct,
          }),
        ),
      });
    }

    if (path.includes("/holdings") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successEnvelope({
            data: SEED_HOLDINGS.map((h) => ({
              ...h,
              avgCost: h.avgCostBasis,
              pnl: h.unrealizedPnL,
              pnlPct: h.unrealizedPnLPct,
              assetType: h.assetClass,
            })),
          }),
        ),
      });
    }

    const portfolioDetailMatch = path.match(/\/portfolios\/([^/]+)$/);
    if (portfolioDetailMatch && method === "GET") {
      const portfolioId = portfolioDetailMatch[1];
      const p = portfolios.find((item) => item.id === portfolioId) || portfolios[0];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successEnvelope({
            ...p,
            holdings: SEED_HOLDINGS,
          }),
        ),
      });
    }

    // ── ANALYTICS ENDPOINTS ───────────────────────────────────────────────────
    if (path.includes("/analytics/twr") || path.includes("/analytics/performance")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(SEED_ANALYTICS)),
      });
    }

    if (path.includes("/analytics")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(SEED_ANALYTICS)),
      });
    }

    // ── RISK ENDPOINTS ────────────────────────────────────────────────────────
    if (path.includes("/risk")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(SEED_RISK)),
      });
    }

    // ── ALERTS ENDPOINTS ──────────────────────────────────────────────────────
    if (path.endsWith("/alerts/rules") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successEnvelope(
            alertRules.map((r: any) => ({
              ...r,
              alertType:
                r.alertType || (r.ruleType === "DRAWDOWN" ? "DRAWDOWN_LIMIT" : "RISK_SCORE_SPIKE"),
              condition: r.condition || { thresholdPct: r.thresholdValue },
              cooldownDurationMinutes: r.cooldownDurationMinutes || r.cooldownMinutes || 1440,
              triggerCount: r.triggerCount ?? 1,
            })),
          ),
        ),
      });
    }

    if (path.endsWith("/alerts/rules") && method === "POST") {
      const payload = route.request().postDataJSON();
      const newRule = {
        id: `rule-${Date.now()}`,
        portfolioId: payload.portfolioId || "p-seed-001",
        name: payload.name || "New Alert Rule",
        alertType: payload.alertType || "DRAWDOWN_LIMIT",
        ruleType: payload.alertType || "DRAWDOWN_LIMIT",
        condition: { thresholdPct: payload.thresholdPct },
        thresholdValue: payload.thresholdPct || 5.0,
        comparisonOperator: "GREATER_THAN",
        severity: "MEDIUM",
        channels: ["IN_APP"],
        isActive: true,
        lastTriggeredAt: null,
        cooldownDurationMinutes: payload.cooldownDurationMinutes || 1440,
        cooldownMinutes: payload.cooldownDurationMinutes || 1440,
        triggerCount: 0,
      };
      alertRules.push(newRule);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(newRule)),
      });
    }

    if (path.includes("/alerts/rules/") && method === "DELETE") {
      const ruleId = path.split("/").pop();
      const index = alertRules.findIndex((r) => r.id === ruleId);
      if (index !== -1) alertRules.splice(index, 1);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope({ deleted: true })),
      });
    }

    if (path.endsWith("/alerts/logs") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(SEED_ALERTS.logs)),
      });
    }

    // ── REPORTS ENDPOINTS ─────────────────────────────────────────────────────
    if (path.endsWith("/reports") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(reports)),
      });
    }

    if (path.endsWith("/reports/pdf") && method === "POST") {
      const newReport = {
        id: `rpt-${Date.now()}`,
        userId: SEED_USER.id,
        portfolioId: "p-seed-001",
        reportType: "PORTFOLIO_SUMMARY",
        format: "PDF",
        status: "PENDING",
        fileUrl: null,
        fileSizeBytes: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      reports.unshift(newReport);
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify(
          successEnvelope({
            reportId: newReport.id,
            status: "PENDING",
          }),
        ),
      });
    }

    const reportStatusMatch = path.match(/\/reports\/([^/]+)\/status$/);
    if (reportStatusMatch && method === "GET") {
      const reportId = reportStatusMatch[1];
      const r = reports.find((item) => item.id === reportId) || reports[0];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          successEnvelope({
            id: r.id,
            status: "COMPLETED",
            completedAt: new Date().toISOString(),
          }),
        ),
      });
    }

    if (path.endsWith("/reports/csv") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "text/csv",
        headers: {
          "Content-Disposition":
            'attachment; filename="wealthcompass-portfolio-summary-p-seed-001.csv"',
          "X-Report-Id": "rpt-csv-001",
        },
        body: "Symbol,Asset Name,Quantity,Avg Cost,Current Price,Current Value,Unrealized P&L\r\nRELIANCE,Reliance Industries,200,2450.00,3020.00,604000.00,114000.00\r\n",
      });
    }

    // Default fallback
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(successEnvelope({})),
    });
  });
}
