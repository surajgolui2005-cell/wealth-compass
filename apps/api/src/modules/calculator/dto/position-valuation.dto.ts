import { AssetClassCode } from "@prisma/client";
import { CalcMethod } from "../interfaces/calculator.interface";

/**
 * A single realized gain/loss record in the HTTP response.
 * Serialized from the internal RealizedGain domain object.
 * Monetary values are strings to preserve Decimal precision across JSON.
 */
export class RealizedGainDto {
  /** DB UUID of the SELL transaction */
  sellTransactionId: string;
  /** DB UUID of the matched BUY lot (FIFO only; undefined for WA) */
  buyTransactionId?: string;
  sellDate: string; // ISO 8601
  buyDate?: string; // ISO 8601 (FIFO only)
  /** Quantity of units matched in this gain record (8dp string) */
  quantityMatched: string;
  /** Cost per unit at acquisition, home currency (8dp string) */
  costBasisPerUnit: string;
  /** Net proceeds per unit at sale, home currency (8dp string) */
  proceedsPerUnit: string;
  /** Realized gain/loss = (proceeds - cost) × qty (4dp string) */
  realizedGainLoss: string;
  /** Calendar days between buy and sell dates */
  holdingPeriodDays: number;
  /**
   * Indian tax classification:
   *  true  → LTCG (>365 days for listed equity, >24 months for debt)
   *  false → STCG
   *  Note: WA method always returns false (holding period not tracked per-lot)
   */
  isLongTerm: boolean;
  currency: string;
}

/**
 * Full valuation of a single holding position.
 *
 * All monetary values are serialized as fixed-precision decimal strings
 * (not JS numbers) to prevent floating-point corruption in JSON transport.
 *
 * precision guide:
 *  - quantities:         8dp  (e.g. "10.00000000")
 *  - prices / per-unit:  8dp  (e.g. "1500.75000000")
 *  - totals / P&L:       4dp  (e.g. "250000.0000")
 *  - percentages:        4dp  (e.g. "16.6667")
 */
export class PositionValuationDto {
  /** Holding UUID */
  holdingId: string;
  /** Normalised uppercase ticker symbol (e.g. "INFY", "BTC") */
  symbol: string;
  assetClass: AssetClassCode;

  // ── Open Position ──────────────────────────────────────────────────────────
  /** Un-sold quantity after processing all transactions */
  openQuantity: string;
  /** Weighted average cost per unit of the open position (home currency, 8dp) */
  avgCostBasisPerUnit: string;
  /** Total cost of the open position = openQty × avgCostBasis (4dp) */
  totalCostBasis: string;

  // ── Current Valuation ──────────────────────────────────────────────────────
  /** Live price fetched from MarketDataService (8dp) */
  currentPrice: string;
  /** Current market value = openQty × currentPrice (4dp) */
  currentValue: string;

  // ── Unrealized P&L ─────────────────────────────────────────────────────────
  /** Unrealized P&L = currentValue − totalCostBasis (4dp) */
  unrealizedPnL: string;
  /** Unrealized P&L as percentage of cost basis (4dp) */
  unrealizedPnLPct: string;

  // ── Realized P&L ──────────────────────────────────────────────────────────
  /** Net realized gain/loss across all historical SELL transactions (4dp) */
  realizedPnL: string;
  /** Granular per-lot (FIFO) or per-sell (WA) realized gain records */
  totalRealizedGains: RealizedGainDto[];

  // ── Metadata ───────────────────────────────────────────────────────────────
  /** Portfolio home currency (ISO 4217) */
  currency: string;
  /** Which tier of the 3-tier resolution provided the price: 'cache', 'provider', 'db_fallback', 'unavailable' */
  priceSource: string;
  /** True when the price is from cache/DB beyond the staleness threshold */
  isPriceStale: boolean;
  /** True when the relevant exchange is closed (weekend / holiday) */
  isMarketClosed: boolean;
  /** ISO 8601 UTC timestamp when this valuation was computed */
  computedAt: string;
  costBasisMethod: CalcMethod;
}
