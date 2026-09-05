/**
 * PdfReportService
 * ─────────────────
 * Generates branded executive PDF reports using pdfmake.
 *
 * Supported ReportTypes:
 *   PORTFOLIO_SUMMARY   — Holdings table + allocation breakdown + risk metrics
 *   PERFORMANCE         — Snapshot history, P&L over time
 *   RISK_ANALYSIS       — Full risk metrics + concentration breakdown
 *   TRANSACTION_HISTORY — Paginated transaction ledger
 *   TAX_GAINS           — Realised P&L for tax reporting
 *
 * Output: Buffer containing a valid PDF binary.
 *
 * Layout sections:
 *   1. Branded header  — app name, report title, portfolio name, generated date
 *   2. Executive summary cards — total value, total P&L, risk score
 *   3. Holdings table  — symbol | qty | avg cost | price | value | P&L%
 *   4. Allocation breakdown — asset-class allocation table
 *   5. Risk metrics    — VaR, CVaR, Sharpe, Sortino, Beta, Max DD, Volatility
 *   6. Page footer     — page number + disclaimer
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ReportType } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

// pdfmake ships CommonJS; we use dynamic require to stay compatible with
// ts-node and Jest without esModuleInterop issues.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMake = require("pdfmake/build/pdfmake");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfFonts = require("pdfmake/build/vfs_fonts");
pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs ?? pdfFonts;

// ── Colour palette ─────────────────────────────────────────────────────────────
const BRAND_DARK = "#0F172A"; // slate-900
const BRAND_BLUE = "#2563EB"; // blue-600
const BRAND_LIGHT_BG = "#F1F5F9"; // slate-100
const GREY_TEXT = "#64748B"; // slate-500
const GREEN = "#16A34A";
const RED = "#DC2626";
const WHITE = "#FFFFFF";
const TABLE_HEADER_BG = "#1E3A5F";

// ── Helper utilities ──────────────────────────────────────────────────────────

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function pnlColor(value: number): string {
  return value >= 0 ? GREEN : RED;
}

// ── Portfolio data shape ──────────────────────────────────────────────────────

interface HoldingRow {
  symbol: string;
  assetClass: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

interface RiskMetrics {
  var95_1d: number;
  cvar95_1d: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  maxDrawdown: number;
  volatilityAnnual: number;
  riskScore: number;
  computedAt: Date;
}

interface AllocationEntry {
  assetClass: string;
  value: number;
  pct: number;
}

interface TransactionRow {
  date: string;
  symbol: string;
  type: string;
  quantity: number;
  pricePerUnit: number;
  fees: number;
  totalAmount: number;
  currency: string;
}

interface PortfolioReportData {
  portfolioName: string;
  portfolioCurrency: string;
  totalValue: number;
  totalCostBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  holdings: HoldingRow[];
  allocation: AllocationEntry[];
  riskMetrics: RiskMetrics | null;
  transactions: TransactionRow[];
  generatedAt: Date;
}

@Injectable()
export class PdfReportService {
  private readonly logger = new Logger(PdfReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Generate a PDF buffer for the given portfolio + report type.
   * @throws NotFoundException if the portfolio is not found
   */
  async generate(
    userId: string,
    portfolioId: string,
    reportType: ReportType,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<Buffer> {
    const startMs = Date.now();
    this.logger.log(
      `Generating PDF [type: ${reportType}, portfolio: ${portfolioId}, user: ${userId}]`,
    );

    const data = await this.fetchPortfolioData(userId, portfolioId, fromDate, toDate);
    const docDefinition = this.buildDocDefinition(data, reportType);
    const buffer = await this.renderPdf(docDefinition);

    this.logger.log(
      `PDF generated [${reportType}, portfolio: ${portfolioId}] — ` +
        `${buffer.length} bytes, ${Date.now() - startMs}ms`,
    );

    return buffer;
  }

  // ── Data Fetching ─────────────────────────────────────────────────────────────

  private async fetchPortfolioData(
    userId: string,
    portfolioId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<PortfolioReportData> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        currency: true,
        totalValue: true,
      },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    const [holdings, riskMetric, transactions] = await Promise.all([
      this.prisma.holding.findMany({
        where: { portfolioId, deletedAt: null },
        include: {
          asset: { include: { assetClass: true } },
        },
        orderBy: { currentValue: "desc" },
      }),
      this.prisma.riskMetricSnapshot.findFirst({
        where: { portfolioId },
        orderBy: { computedAt: "desc" },
      }),
      this.prisma.transaction.findMany({
        where: {
          holding: { portfolioId, deletedAt: null },
          ...(fromDate || toDate
            ? {
                transactedAt: {
                  ...(fromDate ? { gte: fromDate } : {}),
                  ...(toDate ? { lte: toDate } : {}),
                },
              }
            : {}),
          deletedAt: null,
        },
        include: { holding: { select: { symbol: true } } },
        orderBy: { transactedAt: "desc" },
        take: 500,
      }),
    ]);

    // Compute totals from holdings
    const totalValue = holdings.reduce(
      (sum, h) => sum + parseFloat(h.currentValue.toString()),
      0,
    );
    const totalCostBasis = holdings.reduce(
      (sum, h) => sum + parseFloat(h.quantity.toString()) * parseFloat(h.avgCostBasis.toString()),
      0,
    );
    const unrealizedPnL = holdings.reduce(
      (sum, h) => sum + parseFloat(h.unrealizedPnL.toString()),
      0,
    );
    const unrealizedPnLPct = totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;

    // Build holdings rows
    const holdingRows: HoldingRow[] = holdings.map((h) => ({
      symbol: h.symbol,
      assetClass: h.asset.assetClass.name,
      quantity: parseFloat(h.quantity.toString()),
      avgCostBasis: parseFloat(h.avgCostBasis.toString()),
      currentPrice: parseFloat(h.currentPrice.toString()),
      currentValue: parseFloat(h.currentValue.toString()),
      unrealizedPnL: parseFloat(h.unrealizedPnL.toString()),
      unrealizedPnLPct: parseFloat(h.unrealizedPnLPct.toString()),
    }));

    // Build allocation breakdown
    const allocationMap = new Map<string, number>();
    for (const h of holdingRows) {
      allocationMap.set(h.assetClass, (allocationMap.get(h.assetClass) ?? 0) + h.currentValue);
    }
    const allocation: AllocationEntry[] = [...allocationMap.entries()]
      .map(([assetClass, value]) => ({
        assetClass,
        value,
        pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    // Build risk metrics
    let riskMetrics: RiskMetrics | null = null;
    if (riskMetric) {
      riskMetrics = {
        var95_1d: parseFloat(riskMetric.var95_1d.toString()),
        cvar95_1d: parseFloat(riskMetric.cvar95_1d.toString()),
        sharpeRatio: parseFloat(riskMetric.sharpeRatio.toString()),
        sortinoRatio: parseFloat(riskMetric.sortinoRatio.toString()),
        beta: parseFloat(riskMetric.beta.toString()),
        maxDrawdown: parseFloat(riskMetric.maxDrawdown.toString()),
        volatilityAnnual: parseFloat(riskMetric.volatilityAnnual.toString()),
        riskScore: riskMetric.riskScore,
        computedAt: riskMetric.computedAt,
      };
    }

    // Build transaction rows
    const transactionRows: TransactionRow[] = transactions.map((t) => ({
      date: t.transactedAt.toISOString().split("T")[0],
      symbol: t.holding.symbol,
      type: t.type,
      quantity: parseFloat(t.quantity.toString()),
      pricePerUnit: parseFloat(t.pricePerUnit.toString()),
      fees: parseFloat(t.fees.toString()),
      totalAmount: parseFloat(t.totalAmount.toString()),
      currency: t.currency,
    }));

    return {
      portfolioName: portfolio.name,
      portfolioCurrency: portfolio.currency,
      totalValue,
      totalCostBasis,
      unrealizedPnL,
      unrealizedPnLPct,
      holdings: holdingRows,
      allocation,
      riskMetrics,
      transactions: transactionRows,
      generatedAt: new Date(),
    };
  }

  // ── Document Definition Builder ───────────────────────────────────────────────

  private buildDocDefinition(data: PortfolioReportData, reportType: ReportType): object {
    const reportTitle = this.getReportTitle(reportType);
    const sections: object[] = [
      this.buildHeader(data, reportTitle),
      this.buildExecutiveSummary(data),
    ];

    switch (reportType) {
      case ReportType.PORTFOLIO_SUMMARY:
        sections.push(
          this.buildHoldingsTable(data),
          this.buildAllocationTable(data),
          this.buildRiskMetricsSection(data),
        );
        break;

      case ReportType.RISK_ANALYSIS:
        sections.push(
          this.buildRiskMetricsSection(data),
          this.buildAllocationTable(data),
          this.buildHoldingsTable(data),
        );
        break;

      case ReportType.PERFORMANCE:
        sections.push(this.buildHoldingsTable(data), this.buildAllocationTable(data));
        break;

      case ReportType.TRANSACTION_HISTORY:
        sections.push(this.buildTransactionTable(data));
        break;

      case ReportType.TAX_GAINS:
        sections.push(this.buildTransactionTable(data), this.buildHoldingsTable(data));
        break;

      default:
        sections.push(
          this.buildHoldingsTable(data),
          this.buildAllocationTable(data),
          this.buildRiskMetricsSection(data),
        );
    }

    return {
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [40, 60, 40, 60],
      content: sections,
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: "WealthCompass — Confidential. For personal use only.",
            style: "footer",
            alignment: "left",
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            style: "footer",
            alignment: "right",
          },
        ],
        margin: [40, 0],
      }),
      styles: this.buildStyles(),
      defaultStyle: {
        font: "Roboto",
        fontSize: 9,
        color: BRAND_DARK,
      },
    };
  }

  // ── Section Builders ──────────────────────────────────────────────────────────

  private buildHeader(data: PortfolioReportData, title: string): object {
    return {
      stack: [
        {
          columns: [
            {
              stack: [
                { text: "WealthCompass", style: "brandName" },
                { text: "Investor Portfolio Intelligence", style: "brandTagline" },
              ],
            },
            {
              stack: [
                { text: title, style: "reportTitle", alignment: "right" },
                {
                  text: `Portfolio: ${data.portfolioName}`,
                  style: "reportSubtitle",
                  alignment: "right",
                },
                {
                  text: `Generated: ${data.generatedAt.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`,
                  style: "reportDate",
                  alignment: "right",
                },
              ],
            },
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: BRAND_BLUE }], margin: [0, 8, 0, 0] },
      ],
      margin: [0, 0, 0, 16],
    };
  }

  private buildExecutiveSummary(data: PortfolioReportData): object {
    const pnlColor = data.unrealizedPnL >= 0 ? GREEN : RED;
    const pnlSign = data.unrealizedPnL >= 0 ? "▲" : "▼";

    return {
      stack: [
        { text: "Executive Summary", style: "sectionTitle", margin: [0, 0, 0, 8] },
        {
          columns: [
            this.buildSummaryCard("Total Portfolio Value", formatINR(data.totalValue), BRAND_BLUE),
            this.buildSummaryCard(
              "Unrealized P&L",
              `${pnlSign} ${formatINR(Math.abs(data.unrealizedPnL))}\n${formatPct(data.unrealizedPnLPct)}`,
              pnlColor,
            ),
            this.buildSummaryCard(
              "Risk Score",
              data.riskMetrics ? `${data.riskMetrics.riskScore} / 100` : "N/A",
              data.riskMetrics
                ? data.riskMetrics.riskScore > 70
                  ? RED
                  : data.riskMetrics.riskScore > 40
                    ? "#D97706"
                    : GREEN
                : GREY_TEXT,
            ),
            this.buildSummaryCard("Total Holdings", `${data.holdings.length}`, BRAND_DARK),
          ],
          columnGap: 8,
          margin: [0, 0, 0, 16],
        },
      ],
    };
  }

  private buildSummaryCard(label: string, value: string, valueColor: string): object {
    return {
      stack: [
        { text: label, style: "cardLabel" },
        { text: value, style: "cardValue", color: valueColor },
      ],
      fillColor: BRAND_LIGHT_BG,
      margin: [0, 0, 0, 0],
      padding: 8,
      border: [false, false, false, false],
    };
  }

  private buildHoldingsTable(data: PortfolioReportData): object {
    if (data.holdings.length === 0) {
      return {
        stack: [
          { text: "Holdings", style: "sectionTitle" },
          { text: "No holdings found.", style: "emptyState", margin: [0, 8, 0, 16] },
        ],
      };
    }

    const headers = [
      { text: "Symbol", style: "tableHeader" },
      { text: "Asset Class", style: "tableHeader" },
      { text: "Quantity", style: "tableHeader", alignment: "right" },
      { text: "Avg Cost", style: "tableHeader", alignment: "right" },
      { text: "Current Price", style: "tableHeader", alignment: "right" },
      { text: "Current Value", style: "tableHeader", alignment: "right" },
      { text: "P&L", style: "tableHeader", alignment: "right" },
      { text: "P&L %", style: "tableHeader", alignment: "right" },
    ];

    const rows = data.holdings.map((h, idx) => [
      { text: h.symbol, style: "tableCell", fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG },
      { text: h.assetClass, style: "tableCell", fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG },
      {
        text: h.quantity.toFixed(4),
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatINR(h.avgCostBasis),
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatINR(h.currentPrice),
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatINR(h.currentValue),
        style: "tableCellBold",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatINR(h.unrealizedPnL),
        style: "tableCell",
        alignment: "right",
        color: pnlColor(h.unrealizedPnL),
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatPct(h.unrealizedPnLPct),
        style: "tableCell",
        alignment: "right",
        color: pnlColor(h.unrealizedPnLPct),
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
    ]);

    return {
      stack: [
        { text: "Holdings", style: "sectionTitle", margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "*", "*", "*", "*", "*", "auto"],
            body: [headers, ...rows],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#CBD5E1",
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
      ],
      margin: [0, 0, 0, 16],
    };
  }

  private buildAllocationTable(data: PortfolioReportData): object {
    if (data.allocation.length === 0) {
      return {
        stack: [
          { text: "Asset Allocation", style: "sectionTitle" },
          { text: "No allocation data.", style: "emptyState", margin: [0, 8, 0, 16] },
        ],
      };
    }

    const headers = [
      { text: "Asset Class", style: "tableHeader" },
      { text: "Value (INR)", style: "tableHeader", alignment: "right" },
      { text: "Allocation %", style: "tableHeader", alignment: "right" },
      { text: "Weight Bar", style: "tableHeader" },
    ];

    const rows = data.allocation.map((a, idx) => {
      const barWidth = Math.max(1, Math.round(a.pct * 1.2)); // scale to ~120px max
      return [
        { text: a.assetClass, style: "tableCell", fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG },
        {
          text: formatINR(a.value),
          style: "tableCell",
          alignment: "right",
          fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
        },
        {
          text: `${a.pct.toFixed(2)}%`,
          style: "tableCellBold",
          alignment: "right",
          fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
        },
        {
          canvas: [
            {
              type: "rect",
              x: 0,
              y: 2,
              w: barWidth,
              h: 8,
              color: BRAND_BLUE,
              r: 2,
            },
          ],
          fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
        },
      ];
    });

    return {
      stack: [
        { text: "Asset Allocation Breakdown", style: "sectionTitle", margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: ["*", "*", "auto", 130],
            body: [headers, ...rows],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#CBD5E1",
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
      ],
      margin: [0, 0, 0, 16],
    };
  }

  private buildRiskMetricsSection(data: PortfolioReportData): object {
    if (!data.riskMetrics) {
      return {
        stack: [
          { text: "Risk Metrics", style: "sectionTitle" },
          {
            text: "Risk metrics not yet computed. Run the risk engine to populate this section.",
            style: "emptyState",
            margin: [0, 8, 0, 16],
          },
        ],
      };
    }

    const rm = data.riskMetrics;

    const metrics = [
      ["VaR (95%, 1-Day)", formatINR(rm.var95_1d), "Maximum expected loss in one day at 95% confidence"],
      ["CVaR (95%, 1-Day)", formatINR(rm.cvar95_1d), "Expected loss beyond VaR threshold (tail risk)"],
      ["Sharpe Ratio", rm.sharpeRatio.toFixed(4), "Risk-adjusted return vs. risk-free rate"],
      ["Sortino Ratio", rm.sortinoRatio.toFixed(4), "Risk-adjusted return vs. downside volatility only"],
      ["Beta (vs. NIFTY 50)", rm.beta.toFixed(4), "Portfolio sensitivity to market movements"],
      ["Max Drawdown", formatPct(rm.maxDrawdown * 100), "Largest peak-to-trough decline in portfolio value"],
      ["Annual Volatility", formatPct(rm.volatilityAnnual * 100), "Annualised standard deviation of portfolio returns"],
      [
        "Risk Score",
        `${rm.riskScore} / 100`,
        rm.riskScore > 70 ? "HIGH RISK" : rm.riskScore > 40 ? "MODERATE RISK" : "LOW RISK",
      ],
    ];

    const rows = metrics.map(([label, value, desc], idx) => [
      { text: label, style: "tableCellBold", fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG },
      {
        text: value,
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
        color:
          label === "Risk Score"
            ? rm.riskScore > 70
              ? RED
              : rm.riskScore > 40
                ? "#D97706"
                : GREEN
            : label === "Max Drawdown"
              ? RED
              : BRAND_DARK,
      },
      { text: desc, style: "metricDesc", fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG },
    ]);

    return {
      stack: [
        { text: "Risk Metrics", style: "sectionTitle", margin: [0, 0, 0, 8] },
        {
          text: `Computed at: ${rm.computedAt.toLocaleDateString("en-IN")}`,
          style: "metricDesc",
          margin: [0, 0, 0, 6],
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", "auto", "*"],
            body: [
              [
                { text: "Metric", style: "tableHeader" },
                { text: "Value", style: "tableHeader", alignment: "right" },
                { text: "Description", style: "tableHeader" },
              ],
              ...rows,
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#CBD5E1",
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
      ],
      margin: [0, 0, 0, 16],
    };
  }

  private buildTransactionTable(data: PortfolioReportData): object {
    if (data.transactions.length === 0) {
      return {
        stack: [
          { text: "Transaction History", style: "sectionTitle" },
          { text: "No transactions found.", style: "emptyState", margin: [0, 8, 0, 16] },
        ],
      };
    }

    const headers = [
      { text: "Date", style: "tableHeader" },
      { text: "Symbol", style: "tableHeader" },
      { text: "Type", style: "tableHeader" },
      { text: "Quantity", style: "tableHeader", alignment: "right" },
      { text: "Price/Unit", style: "tableHeader", alignment: "right" },
      { text: "Fees", style: "tableHeader", alignment: "right" },
      { text: "Total", style: "tableHeader", alignment: "right" },
    ];

    const rows = data.transactions.map((t, idx) => [
      { text: t.date, style: "tableCell", fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG },
      { text: t.symbol, style: "tableCellBold", fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG },
      {
        text: t.type,
        style: "tableCell",
        color: t.type === "SELL" || t.type === "WITHDRAWAL" ? RED : GREEN,
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: t.quantity.toFixed(4),
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatINR(t.pricePerUnit),
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatINR(t.fees),
        style: "tableCell",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
      {
        text: formatINR(t.totalAmount),
        style: "tableCellBold",
        alignment: "right",
        fillColor: idx % 2 === 0 ? WHITE : BRAND_LIGHT_BG,
      },
    ]);

    return {
      stack: [
        {
          text: `Transaction History (${data.transactions.length} records)`,
          style: "sectionTitle",
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "auto", "*", "*", "*", "*"],
            body: [headers, ...rows],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#CBD5E1",
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
      ],
      margin: [0, 0, 0, 16],
    };
  }

  // ── Style Definitions ─────────────────────────────────────────────────────────

  private buildStyles(): Record<string, object> {
    return {
      brandName: {
        fontSize: 20,
        bold: true,
        color: BRAND_BLUE,
        letterSpacing: 1,
      },
      brandTagline: {
        fontSize: 8,
        color: GREY_TEXT,
        margin: [0, 2, 0, 0],
      },
      reportTitle: {
        fontSize: 14,
        bold: true,
        color: BRAND_DARK,
      },
      reportSubtitle: {
        fontSize: 10,
        color: BRAND_DARK,
        margin: [0, 2, 0, 0],
      },
      reportDate: {
        fontSize: 8,
        color: GREY_TEXT,
        margin: [0, 2, 0, 0],
      },
      sectionTitle: {
        fontSize: 12,
        bold: true,
        color: BRAND_DARK,
        margin: [0, 0, 0, 4],
      },
      cardLabel: {
        fontSize: 8,
        color: GREY_TEXT,
        margin: [4, 4, 4, 2],
      },
      cardValue: {
        fontSize: 11,
        bold: true,
        margin: [4, 0, 4, 4],
      },
      tableHeader: {
        fontSize: 8,
        bold: true,
        color: WHITE,
        fillColor: TABLE_HEADER_BG,
        margin: [0, 2, 0, 2],
      },
      tableCell: {
        fontSize: 8,
        color: BRAND_DARK,
      },
      tableCellBold: {
        fontSize: 8,
        bold: true,
        color: BRAND_DARK,
      },
      metricDesc: {
        fontSize: 7.5,
        color: GREY_TEXT,
        italics: true,
      },
      emptyState: {
        fontSize: 9,
        color: GREY_TEXT,
        italics: true,
      },
      footer: {
        fontSize: 7,
        color: GREY_TEXT,
      },
    };
  }

  // ── pdfmake Renderer ──────────────────────────────────────────────────────────

  private async renderPdf(docDefinition: object): Promise<Buffer> {
    const pdfDoc = pdfMake.createPdf(docDefinition);
    const result = pdfDoc.getBuffer();
    if (result && typeof result.then === "function") {
      const buf = await result;
      return Buffer.from(buf);
    }
    return new Promise((resolve, reject) => {
      try {
        pdfDoc.getBuffer((buffer: Buffer) => {
          resolve(Buffer.from(buffer));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private getReportTitle(reportType: ReportType): string {
    const titles: Record<ReportType, string> = {
      [ReportType.PORTFOLIO_SUMMARY]: "Portfolio Summary Report",
      [ReportType.PERFORMANCE]: "Performance Report",
      [ReportType.RISK_ANALYSIS]: "Risk Analysis Report",
      [ReportType.TRANSACTION_HISTORY]: "Transaction History Report",
      [ReportType.TAX_GAINS]: "Tax Gains Report",
    };
    return titles[reportType] ?? "Portfolio Report";
  }
}
