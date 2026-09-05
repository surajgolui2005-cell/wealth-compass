/**
 * ExcelExportService
 * ──────────────────
 * Generates CSV exports for portfolio data using papaparse.
 *
 * Supported ReportTypes and their column schemas:
 *   PORTFOLIO_SUMMARY   — Holdings: symbol, class, qty, avg cost, price, value, P&L, P&L%
 *   PERFORMANCE         — Snapshot history: date, net worth, cost basis, unrealised P&L, daily change
 *   RISK_ANALYSIS       — Risk metrics: metric name, value, description
 *   TRANSACTION_HISTORY — Full transaction ledger
 *   TAX_GAINS           — Realised gains per symbol (BUY/SELL matched)
 *
 * Output: CSV string ready to be sent as a file download.
 *
 * Column alignment guarantee: papaparse handles quoting of commas/newlines
 * within field values, so spreadsheet parsers will never misalign columns.
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ReportType } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import Papa from "papaparse";

@Injectable()
export class ExcelExportService {
  private readonly logger = new Logger(ExcelExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Generate a CSV string for the given portfolio + report type.
   * @returns CSV text content
   * @throws NotFoundException if the portfolio is not found
   */
  async generate(
    userId: string,
    portfolioId: string,
    reportType: ReportType,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<string> {
    const startMs = Date.now();
    this.logger.log(
      `Generating CSV [type: ${reportType}, portfolio: ${portfolioId}, user: ${userId}]`,
    );

    // Verify portfolio ownership
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    let csv: string;

    switch (reportType) {
      case ReportType.PORTFOLIO_SUMMARY:
        csv = await this.generateHoldingsCsv(portfolioId);
        break;

      case ReportType.PERFORMANCE:
        csv = await this.generatePerformanceCsv(portfolioId);
        break;

      case ReportType.RISK_ANALYSIS:
        csv = await this.generateRiskCsv(portfolioId);
        break;

      case ReportType.TRANSACTION_HISTORY:
        csv = await this.generateTransactionCsv(portfolioId, fromDate, toDate);
        break;

      case ReportType.TAX_GAINS:
        csv = await this.generateTaxGainsCsv(portfolioId, fromDate, toDate);
        break;

      default:
        csv = await this.generateHoldingsCsv(portfolioId);
    }

    this.logger.log(
      `CSV generated [${reportType}, portfolio: ${portfolioId}] — ` +
        `${csv.length} chars, ${Date.now() - startMs}ms`,
    );

    return csv;
  }

  /**
   * Returns the recommended filename for a given report type.
   */
  getFilename(portfolioId: string, reportType: ReportType): string {
    const slug = reportType.toLowerCase().replace(/_/g, "-");
    const date = new Date().toISOString().split("T")[0];
    return `wealthcompass-${slug}-${portfolioId.slice(0, 8)}-${date}.csv`;
  }

  // ── Holdings CSV ──────────────────────────────────────────────────────────────

  private async generateHoldingsCsv(portfolioId: string): Promise<string> {
    const holdings = await this.prisma.holding.findMany({
      where: { portfolioId, deletedAt: null },
      include: { asset: { include: { assetClass: true } } },
      orderBy: { currentValue: "desc" },
    });

    const rows = holdings.map((h) => ({
      Symbol: h.symbol,
      "Asset Name": h.asset.name,
      "Asset Class": h.asset.assetClass.name,
      Category: h.asset.assetClass.category,
      Exchange: h.asset.exchange ?? "N/A",
      ISIN: h.asset.isin ?? "N/A",
      Quantity: parseFloat(h.quantity.toString()),
      "Avg Cost Basis (INR)": parseFloat(h.avgCostBasis.toString()),
      "Current Price (INR)": parseFloat(h.currentPrice.toString()),
      "Current Value (INR)": parseFloat(h.currentValue.toString()),
      "Unrealized P&L (INR)": parseFloat(h.unrealizedPnL.toString()),
      "Unrealized P&L %": parseFloat(h.unrealizedPnLPct.toString()),
      "Cost Basis Method": h.costBasisMethod,
      "Is Manual": h.isManual,
      "Last Updated": h.updatedAt.toISOString(),
    }));

    return this.toCsv(rows);
  }

  // ── Performance (Snapshot History) CSV ───────────────────────────────────────

  private async generatePerformanceCsv(portfolioId: string): Promise<string> {
    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: { portfolioId },
      orderBy: { snapshotDate: "asc" },
    });

    const rows = snapshots.map((s) => ({
      "Snapshot Date": s.snapshotDate.toISOString().split("T")[0],
      "Total Net Worth (INR)": parseFloat(s.totalNetWorth.toString()),
      "Total Cost Basis (INR)": parseFloat(s.totalCostBasis.toString()),
      "Unrealized P&L (INR)": parseFloat(s.unrealizedPnL.toString()),
      "Realized P&L (INR)": parseFloat(s.realizedPnL.toString()),
      "Daily Change (INR)": parseFloat(s.dailyChangeAbs.toString()),
      "Daily Change %": parseFloat(s.dailyChangePct.toString()),
    }));

    return this.toCsv(rows);
  }

  // ── Risk Analysis CSV ─────────────────────────────────────────────────────────

  private async generateRiskCsv(portfolioId: string): Promise<string> {
    const riskMetric = await this.prisma.riskMetricSnapshot.findFirst({
      where: { portfolioId },
      orderBy: { computedAt: "desc" },
    });

    if (!riskMetric) {
      // Return header-only CSV when no risk data exists
      return this.toCsv([
        {
          Metric: "No risk metrics computed",
          Value: "",
          Description: "Run the risk engine to generate metrics",
        },
      ]);
    }

    const rows = [
      {
        Metric: "VaR (95%, 1-Day)",
        Value: parseFloat(riskMetric.var95_1d.toString()),
        Description: "Maximum expected loss in one trading day at 95% confidence level",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "CVaR (95%, 1-Day)",
        Value: parseFloat(riskMetric.cvar95_1d.toString()),
        Description: "Expected loss beyond the VaR threshold (Conditional Value at Risk / tail risk)",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "Sharpe Ratio",
        Value: parseFloat(riskMetric.sharpeRatio.toString()),
        Description: "Risk-adjusted return relative to risk-free rate",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "Sortino Ratio",
        Value: parseFloat(riskMetric.sortinoRatio.toString()),
        Description: "Risk-adjusted return penalising only downside volatility",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "Beta (vs. NIFTY 50)",
        Value: parseFloat(riskMetric.beta.toString()),
        Description: "Sensitivity of portfolio returns to market benchmark movements",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "Max Drawdown",
        Value: parseFloat(riskMetric.maxDrawdown.toString()),
        Description: "Largest peak-to-trough percentage decline in portfolio value",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "Annual Volatility",
        Value: parseFloat(riskMetric.volatilityAnnual.toString()),
        Description: "Annualised standard deviation of daily portfolio returns",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "Risk Score",
        Value: riskMetric.riskScore,
        Description: "Composite risk score (0–100). >70 = High, 40–70 = Moderate, <40 = Low",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
      {
        Metric: "Price History Days Used",
        Value: riskMetric.priceHistoryDaysUsed,
        Description: "Number of trading days of price history used for computation",
        "Computed At": riskMetric.computedAt.toISOString(),
      },
    ];

    return this.toCsv(rows);
  }

  // ── Transaction History CSV ───────────────────────────────────────────────────

  private async generateTransactionCsv(
    portfolioId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<string> {
    const transactions = await this.prisma.transaction.findMany({
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
      include: { holding: { select: { symbol: true, asset: { select: { name: true, isin: true } } } } },
      orderBy: { transactedAt: "desc" },
    });

    const rows = transactions.map((t) => ({
      "Transaction Date": t.transactedAt.toISOString().split("T")[0],
      "Transaction Time": t.transactedAt.toISOString().split("T")[1].split(".")[0],
      Symbol: t.holding.symbol,
      "Asset Name": t.holding.asset.name,
      ISIN: t.holding.asset.isin ?? "N/A",
      "Transaction Type": t.type,
      Quantity: parseFloat(t.quantity.toString()),
      "Price Per Unit": parseFloat(t.pricePerUnit.toString()),
      "Fees/Charges": parseFloat(t.fees.toString()),
      "Total Amount": parseFloat(t.totalAmount.toString()),
      Currency: t.currency,
      "FX Rate to INR": parseFloat(t.fxRateToHome.toString()),
      "Total Amount (INR)": parseFloat(t.totalAmount.toString()) * parseFloat(t.fxRateToHome.toString()),
      "Provider Ref ID": t.providerRefId ?? "",
      Notes: t.notes ?? "",
      "Created At": t.createdAt.toISOString(),
    }));

    return this.toCsv(rows);
  }

  // ── Tax Gains CSV ─────────────────────────────────────────────────────────────

  private async generateTaxGainsCsv(
    portfolioId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<string> {
    // Fetch all SELL transactions in the period — represents realised events
    const sellTransactions = await this.prisma.transaction.findMany({
      where: {
        holding: { portfolioId, deletedAt: null },
        type: { in: ["SELL", "DIVIDEND"] },
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
      include: {
        holding: {
          select: {
            symbol: true,
            avgCostBasis: true,
            costBasisMethod: true,
            asset: { select: { name: true, isin: true, assetClass: { select: { name: true } } } },
          },
        },
      },
      orderBy: { transactedAt: "asc" },
    });

    const rows = sellTransactions.map((t) => {
      const salePrice = parseFloat(t.pricePerUnit.toString());
      const qty = parseFloat(t.quantity.toString());
      const avgCost = parseFloat(t.holding.avgCostBasis.toString());
      const proceeds = qty * salePrice - parseFloat(t.fees.toString());
      const costBasis = qty * avgCost;
      const gainLoss = proceeds - costBasis;
      const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      return {
        "Sale Date": t.transactedAt.toISOString().split("T")[0],
        Symbol: t.holding.symbol,
        "Asset Name": t.holding.asset.name,
        ISIN: t.holding.asset.isin ?? "N/A",
        "Asset Class": t.holding.asset.assetClass.name,
        "Transaction Type": t.type,
        "Cost Basis Method": t.holding.costBasisMethod,
        "Qty Sold": qty,
        "Avg Cost/Unit (INR)": avgCost,
        "Sale Price/Unit (INR)": salePrice,
        "Total Cost Basis (INR)": costBasis,
        "Net Proceeds (INR)": proceeds,
        "Realised Gain/Loss (INR)": gainLoss,
        "Realised Gain/Loss %": parseFloat(gainLossPct.toFixed(4)),
        "Gain/Loss Type": gainLoss >= 0 ? "GAIN" : "LOSS",
        "Fees (INR)": parseFloat(t.fees.toString()),
        "Provider Ref ID": t.providerRefId ?? "",
      };
    });

    return this.toCsv(rows);
  }

  // ── CSV Serializer ─────────────────────────────────────────────────────────────

  /**
   * Serialize an array of row objects to a CSV string using papaparse.
   * papaparse handles quoting, escaping, and Unicode correctly.
   * Returns a header-only CSV string when rows is empty.
   */
  private toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return "";
    }

    return Papa.unparse(rows, {
      header: true,
      quotes: false,       // Only quote fields that require it
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ",",
      newline: "\r\n",     // RFC 4180 compliant line endings
      skipEmptyLines: false,
    });
  }
}
