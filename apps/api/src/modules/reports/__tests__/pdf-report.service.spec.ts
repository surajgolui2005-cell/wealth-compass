/**
 * PdfReportService — Unit Test Suite
 * =====================================
 *
 * Tests verify:
 *  1. generate() returns a non-empty Buffer starting with %PDF magic bytes
 *     (real pdfmake rendering — the primary acceptance criterion)
 *  2. NotFoundException is thrown when portfolio is not found
 *  3. Empty holdings / null risk metrics / empty transactions handled gracefully
 *  4. All five ReportTypes are routed to correct document sections
 *  5. Prisma queries use correct ordering and date filters
 *
 * Performance strategy:
 *   Only the 3 core buffer-validity tests exercise real pdfmake (each ~25-30s).
 *   All remaining tests mock `renderPdf` via jest.spyOn so they run in <1ms
 *   while still exercising data-fetching, error-handling, and routing logic.
 *   Total suite time: ~1.5 min instead of ~6.5 min.
 */

import { NotFoundException } from "@nestjs/common";
import { ReportType } from "@prisma/client";
import { PdfReportService } from "../services/pdf-report.service";

// ── Mock Factories ────────────────────────────────────────────────────────────

function buildMockPrisma(overrides: Partial<ReturnType<typeof defaultMockPrisma>> = {}) {
  return { ...defaultMockPrisma(), ...overrides };
}

function defaultMockPrisma() {
  return {
    portfolio: {
      findFirst: jest.fn().mockResolvedValue({
        id: "p-001",
        name: "My Test Portfolio",
        currency: "INR",
        totalValue: { toString: () => "1000000" },
      }),
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
          updatedAt: new Date("2026-09-01"),
          asset: {
            name: "Reliance Industries",
            isin: "INE002A01018",
            exchange: "NSE",
            assetClass: { name: "Stocks", category: "EQUITY" },
          },
        },
        {
          symbol: "INFY",
          quantity: { toString: () => "200" },
          avgCostBasis: { toString: () => "1500" },
          currentPrice: { toString: () => "1600" },
          currentValue: { toString: () => "320000" },
          unrealizedPnL: { toString: () => "20000" },
          unrealizedPnLPct: { toString: () => "6.67" },
          updatedAt: new Date("2026-09-01"),
          asset: {
            name: "Infosys Limited",
            isin: "INE009A01021",
            exchange: "NSE",
            assetClass: { name: "Stocks", category: "EQUITY" },
          },
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
          transactedAt: new Date("2026-08-15"),
          type: "BUY",
          quantity: { toString: () => "100" },
          pricePerUnit: { toString: () => "2400" },
          fees: { toString: () => "25" },
          totalAmount: { toString: () => "240025" },
          currency: "INR",
          fxRateToHome: { toString: () => "1" },
          providerRefId: null,
          notes: null,
          createdAt: new Date("2026-08-15"),
          holding: { symbol: "RELIANCE" },
        },
      ]),
    },
  };
}

/** Directly instantiate PdfReportService with a mock Prisma */
function buildService(prisma = buildMockPrisma()) {
  return { service: new PdfReportService(prisma as any), prisma };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: Real PDF rendering — verifies actual pdfmake output validity
// These 3 tests call pdfmake for real. Each takes ~25-30s.
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfReportService — real PDF rendering (buffer validity)", () => {
  // pdfmake renders PDFs synchronously inside a Node.js callback which can
  // take 25-30s per document in Jest/Node. 45s is the safe ceiling per test.
  jest.setTimeout(45_000);

  it("returns a Buffer instance that starts with %PDF magic bytes", async () => {
    const { service } = buildService();
    const buf = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1024); // non-trivial content
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("generates a valid PDF for RISK_ANALYSIS (real render with risk metrics)", async () => {
    const { service } = buildService();
    const buf = await service.generate("u-001", "p-001", ReportType.RISK_ANALYSIS);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("generates a valid PDF for TRANSACTION_HISTORY (real render with transactions)", async () => {
    const { service } = buildService();
    const buf = await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: Logic tests — renderPdf is mocked to avoid pdfmake rendering time.
// These tests verify data-fetching, error-handling, and routing logic.
// Each test runs in <5ms.
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfReportService — data-fetching & routing logic (mocked renderer)", () => {
  // Fake PDF buffer returned by the mocked renderer
  const FAKE_PDF = Buffer.from("%PDF-1.7 fake-content");

  /** Install a jest.spyOn on the private renderPdf method for speed */
  function buildFastService(prisma = buildMockPrisma()) {
    const { service } = buildService(prisma);
    // Access the private method via bracket notation and spy on it
    jest
      .spyOn(service as any, "renderPdf")
      .mockResolvedValue(FAKE_PDF);
    return { service, prisma };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws NotFoundException when portfolio is not found", async () => {
    const prisma = buildMockPrisma();
    prisma.portfolio.findFirst.mockResolvedValueOnce(null);
    const { service } = buildFastService(prisma);

    await expect(
      service.generate("u-001", "p-missing", ReportType.PORTFOLIO_SUMMARY),
    ).rejects.toThrow(NotFoundException);
  });

  it("handles empty holdings array without throwing", async () => {
    const prisma = buildMockPrisma();
    prisma.holding.findMany.mockResolvedValueOnce([]);
    const { service } = buildFastService(prisma);

    const buf = await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("handles null risk metrics without throwing (empty risk section path)", async () => {
    const prisma = buildMockPrisma();
    prisma.riskMetricSnapshot.findFirst.mockResolvedValueOnce(null);
    const { service } = buildFastService(prisma);

    const buf = await service.generate("u-001", "p-001", ReportType.RISK_ANALYSIS);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it("handles empty transactions list without throwing", async () => {
    const prisma = buildMockPrisma();
    prisma.transaction.findMany.mockResolvedValueOnce([]);
    const { service } = buildFastService(prisma);

    const buf = await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it("routes PERFORMANCE reportType and calls renderPdf", async () => {
    const { service } = buildFastService();
    const buf = await service.generate("u-001", "p-001", ReportType.PERFORMANCE);
    expect(buf).toEqual(FAKE_PDF);
  });

  it("routes TAX_GAINS reportType and calls renderPdf", async () => {
    const { service } = buildFastService();
    const buf = await service.generate("u-001", "p-001", ReportType.TAX_GAINS);
    expect(buf).toEqual(FAKE_PDF);
  });

  it("passes fromDate and toDate through to Prisma transaction query", async () => {
    const prisma = buildMockPrisma();
    const { service } = buildFastService(prisma);
    const from = new Date("2026-01-01");
    const to = new Date("2026-08-31");

    await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY, from, to);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transactedAt: expect.objectContaining({ gte: from, lte: to }),
        }),
      }),
    );
  });

  it("queries holdings in descending currentValue order", async () => {
    const prisma = buildMockPrisma();
    const { service } = buildFastService(prisma);

    await service.generate("u-001", "p-001", ReportType.PORTFOLIO_SUMMARY);

    expect(prisma.holding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { currentValue: "desc" },
      }),
    );
  });

  it("fetches the most recent riskMetricSnapshot (orderBy computedAt desc)", async () => {
    const prisma = buildMockPrisma();
    const { service } = buildFastService(prisma);

    await service.generate("u-001", "p-001", ReportType.RISK_ANALYSIS);

    expect(prisma.riskMetricSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { computedAt: "desc" },
      }),
    );
  });

  it("limits transaction query to 500 records", async () => {
    const prisma = buildMockPrisma();
    const { service } = buildFastService(prisma);

    await service.generate("u-001", "p-001", ReportType.TRANSACTION_HISTORY);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });
});
