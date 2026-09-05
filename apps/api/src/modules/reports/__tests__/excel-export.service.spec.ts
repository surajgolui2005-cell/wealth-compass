/**
 * ExcelExportService — Unit Test Suite
 * =======================================
 *
 * Tests verify:
 *  1. generate() returns a non-empty string for all five ReportTypes
 *  2. CSV output parses into valid rows with correct column count (papaparse)
 *  3. No column misalignment for holdings with null/undefined optional fields
 *  4. Empty datasets produce header-only CSV (or graceful empty message)
 *  5. NotFoundException thrown when portfolio is not found
 *  6. RFC 4180 compliance (CRLF line endings)
 *  7. getFilename() returns a valid filename string
 *
 * Strategy:
 *   ExcelExportService is tested via direct instantiation with a mock PrismaService.
 *   papaparse is NOT mocked — real parsing is used to verify column alignment.
 */

import { NotFoundException } from "@nestjs/common";
import { ReportType } from "@prisma/client";
import { ExcelExportService } from "../services/excel-export.service";
import Papa from "papaparse";

// ── Mock Factories ─────────────────────────────────────────────────────────────

function buildMockPrisma(overrides: Partial<ReturnType<typeof defaultMockPrisma>> = {}) {
  return { ...defaultMockPrisma(), ...overrides };
}

function defaultMockPrisma() {
  return {
    portfolio: {
      findFirst: jest.fn().mockResolvedValue({ id: "p-001", name: "Test Portfolio" }),
    },
    holding: {
      findMany: jest.fn().mockResolvedValue([
        {
          symbol: "RELIANCE",
          quantity: { toString: () => "100" },
          avgCostBasis: { toString: () => "2400" },
          currentPrice: { toString: () => "2600" },
          currentValue: { toString: () => "260000" },
          unrealizedPnL: { toString: () => "20000" },
          unrealizedPnLPct: { toString: () => "8.33" },
          costBasisMethod: "AVERAGE_COST",
          isManual: false,
          updatedAt: new Date("2026-09-01"),
          asset: {
            name: "Reliance Industries",
            isin: "INE002A01018",
            exchange: "NSE",
            assetClass: { name: "Stocks", category: "EQUITY" },
          },
        },
        {
          symbol: "USDT",
          quantity: { toString: () => "500" },
          avgCostBasis: { toString: () => "83.5" },
          currentPrice: { toString: () => "84.2" },
          currentValue: { toString: () => "42100" },
          unrealizedPnL: { toString: () => "350" },
          unrealizedPnLPct: { toString: () => "0.84" },
          costBasisMethod: "FIFO",
          isManual: true,
          updatedAt: new Date("2026-09-01"),
          asset: {
            name: "Tether USD",
            isin: null,           // optional field is null
            exchange: null,       // optional field is null
            assetClass: { name: "Crypto", category: "ALTERNATIVE" },
          },
        },
      ]),
    },
    portfolioSnapshot: {
      findMany: jest.fn().mockResolvedValue([
        {
          snapshotDate: new Date("2026-08-01"),
          totalNetWorth: { toString: () => "950000" },
          totalCostBasis: { toString: () => "900000" },
          unrealizedPnL: { toString: () => "50000" },
          realizedPnL: { toString: () => "0" },
          dailyChangeAbs: { toString: () => "1200" },
          dailyChangePct: { toString: () => "0.13" },
        },
        {
          snapshotDate: new Date("2026-09-01"),
          totalNetWorth: { toString: () => "1020000" },
          totalCostBasis: { toString: () => "900000" },
          unrealizedPnL: { toString: () => "120000" },
          realizedPnL: { toString: () => "5000" },
          dailyChangeAbs: { toString: () => "800" },
          dailyChangePct: { toString: () => "0.08" },
        },
      ]),
    },
    riskMetricSnapshot: {
      findFirst: jest.fn().mockResolvedValue({
        var95_1d: { toString: () => "15000" },
        cvar95_1d: { toString: () => "22000" },
        sharpeRatio: { toString: () => "1.45" },
        sortinoRatio: { toString: () => "1.82" },
        beta: { toString: () => "0.95" },
        maxDrawdown: { toString: () => "0.12" },
        volatilityAnnual: { toString: () => "0.18" },
        riskScore: 42,
        priceHistoryDaysUsed: 252,
        computedAt: new Date("2026-09-01T10:00:00Z"),
      }),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue([
        {
          transactedAt: new Date("2026-08-15T09:30:00Z"),
          type: "BUY",
          quantity: { toString: () => "100" },
          pricePerUnit: { toString: () => "2400" },
          fees: { toString: () => "25" },
          totalAmount: { toString: () => "240025" },
          currency: "INR",
          fxRateToHome: { toString: () => "1" },
          providerRefId: "TXN-001",
          notes: "Initial purchase",
          createdAt: new Date("2026-08-15"),
          holding: {
            symbol: "RELIANCE",
            avgCostBasis: { toString: () => "2400" },
            costBasisMethod: "AVERAGE_COST",
            asset: {
              name: "Reliance Industries",
              isin: "INE002A01018",
              assetClass: { name: "Stocks" },
            },
          },
        },
        {
          transactedAt: new Date("2026-08-20T14:15:00Z"),
          type: "SELL",
          quantity: { toString: () => "50" },
          pricePerUnit: { toString: () => "2600" },
          fees: { toString: () => "30" },
          totalAmount: { toString: () => "129970" },
          currency: "INR",
          fxRateToHome: { toString: () => "1" },
          providerRefId: null,
          notes: null,
          createdAt: new Date("2026-08-20"),
          holding: {
            symbol: "RELIANCE",
            avgCostBasis: { toString: () => "2400" },
            costBasisMethod: "AVERAGE_COST",
            asset: {
              name: "Reliance Industries",
              isin: "INE002A01018",
              assetClass: { name: "Stocks" },
            },
          },
        },
      ]),
    },
  };
}

function buildService(prisma = buildMockPrisma()) {
  return { service: new ExcelExportService(prisma as any), prisma };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseCsv(csv: string): { data: Record<string, string>[]; errors: Papa.ParseError[] } {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  return { data: result.data, errors: result.errors };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("ExcelExportService — PORTFOLIO_SUMMARY (Holdings CSV)", () => {
  it("returns a non-empty CSV string", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    expect(typeof csv).toBe("string");
    expect(csv.length).toBeGreaterThan(0);
  });

  it("parses into 2 data rows (one per holding)", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    const { data, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(2);
  });

  it("includes the correct column headers", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    const { data } = parseCsv(csv);
    expect(data[0]).toHaveProperty("Symbol");
    expect(data[0]).toHaveProperty("Quantity");
    expect(data[0]).toHaveProperty("Current Value (INR)");
    expect(data[0]).toHaveProperty("Unrealized P&L (INR)");
    expect(data[0]).toHaveProperty("Unrealized P&L %");
  });

  it("maps holding symbol correctly to the Symbol column", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    const { data } = parseCsv(csv);
    expect(data[0]["Symbol"]).toBe("RELIANCE");
    expect(data[1]["Symbol"]).toBe("USDT");
  });

  it("handles null isin and exchange without column misalignment", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    const { data, errors } = parseCsv(csv);
    // USDT row has null isin and exchange
    const usdtRow = data.find((r) => r["Symbol"] === "USDT");
    expect(errors).toHaveLength(0);
    expect(usdtRow).toBeDefined();
    // null → "N/A" substitution
    expect(usdtRow!["ISIN"]).toBe("N/A");
    expect(usdtRow!["Exchange"]).toBe("N/A");
    // Despite null substitution, every row has the same number of columns
    const expectedCols = Object.keys(data[0]).length;
    data.forEach((row) => expect(Object.keys(row).length).toBe(expectedCols));
  });

  it("produces empty string when holdings list is empty", async () => {
    const prisma = buildMockPrisma();
    prisma.holding.findMany.mockResolvedValueOnce([]);
    const { service } = buildService(prisma);
    const csv = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    expect(csv).toBe("");
  });

  it("throws NotFoundException when portfolio is not found", async () => {
    const prisma = buildMockPrisma();
    prisma.portfolio.findFirst.mockResolvedValueOnce(null);
    const { service } = buildService(prisma);
    await expect(
      service.generate("u-001", "p-missing", ReportType.PORTFOLIO_SUMMARY),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ExcelExportService — PERFORMANCE (Snapshot CSV)", () => {
  it("returns a CSV with 2 snapshot rows", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.PERFORMANCE);
    const { data, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(2);
  });

  it("includes performance-specific column headers", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.PERFORMANCE);
    const { data } = parseCsv(csv);
    expect(data[0]).toHaveProperty("Snapshot Date");
    expect(data[0]).toHaveProperty("Total Net Worth (INR)");
    expect(data[0]).toHaveProperty("Daily Change %");
  });

  it("returns empty string when no snapshots exist", async () => {
    const prisma = buildMockPrisma();
    prisma.portfolioSnapshot.findMany.mockResolvedValueOnce([]);
    const { service } = buildService(prisma);
    const csv = await service.generate("u-001", "p-001", ReportType.PERFORMANCE);
    expect(csv).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ExcelExportService — RISK_ANALYSIS", () => {
  it("returns CSV with 9 risk metric rows", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.RISK_ANALYSIS);
    const { data, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(9); // 9 metrics defined
  });

  it("includes Metric, Value, Description columns", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.RISK_ANALYSIS);
    const { data } = parseCsv(csv);
    expect(data[0]).toHaveProperty("Metric");
    expect(data[0]).toHaveProperty("Value");
    expect(data[0]).toHaveProperty("Description");
  });

  it("returns 1-row CSV with message when no risk data exists", async () => {
    const prisma = buildMockPrisma();
    prisma.riskMetricSnapshot.findFirst.mockResolvedValueOnce(null);
    const { service } = buildService(prisma);
    const csv = await service.generate("u-001", "p-001", ReportType.RISK_ANALYSIS);
    const { data } = parseCsv(csv);
    expect(data).toHaveLength(1);
    expect(data[0]["Metric"]).toContain("No risk metrics");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ExcelExportService — TRANSACTION_HISTORY", () => {
  it("returns CSV with 2 transaction rows", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY);
    const { data, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(2);
  });

  it("includes transaction-specific columns", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY);
    const { data } = parseCsv(csv);
    expect(data[0]).toHaveProperty("Transaction Date");
    expect(data[0]).toHaveProperty("Transaction Type");
    expect(data[0]).toHaveProperty("Price Per Unit");
    expect(data[0]).toHaveProperty("Total Amount (INR)");
  });

  it("handles null providerRefId and notes without column misalignment", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY);
    const { data, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    // SELL row has null providerRefId and notes
    const sellRow = data.find((r) => r["Transaction Type"] === "SELL");
    expect(sellRow).toBeDefined();
    expect(sellRow!["Provider Ref ID"]).toBe("");
    expect(sellRow!["Notes"]).toBe("");
    // All rows must have same column count
    const expectedCols = Object.keys(data[0]).length;
    data.forEach((row) => expect(Object.keys(row).length).toBe(expectedCols));
  });

  it("uses RFC 4180 CRLF line endings", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY);
    expect(csv).toMatch(/\r\n/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ExcelExportService — TAX_GAINS", () => {
  it("returns CSV with realised P&L rows for sell transactions", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.TAX_GAINS);
    const { data, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    // Only SELL transactions in mock data
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("includes Realised Gain/Loss column", async () => {
    const { service } = buildService();
    const csv = await service.generate("u-001", "p-001", ReportType.TAX_GAINS);
    const { data } = parseCsv(csv);
    expect(data[0]).toHaveProperty("Realised Gain/Loss (INR)");
    expect(data[0]).toHaveProperty("Gain/Loss Type");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ExcelExportService — getFilename()", () => {
  it("returns a string containing the report type slug", () => {
    const { service } = buildService();
    const filename = service.getFilename("p-001-aaa-bbb", ReportType.PORTFOLIO_SUMMARY);
    expect(filename).toContain("portfolio-summary");
    expect(filename).toMatch(/\.csv$/);
  });

  it("includes the first 8 chars of portfolioId", () => {
    const { service } = buildService();
    const filename = service.getFilename("abcdef12-xxxx-yyyy", ReportType.RISK_ANALYSIS);
    expect(filename).toContain("abcdef12");
  });

  it("includes today's date in YYYY-MM-DD format", () => {
    const { service } = buildService();
    const filename = service.getFilename("p-001", ReportType.PERFORMANCE);
    const today = new Date().toISOString().split("T")[0];
    expect(filename).toContain(today);
  });
});
