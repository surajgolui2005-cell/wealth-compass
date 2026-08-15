import { CalcMethod } from "../interfaces/calculator.interface";
import { PositionValuationDto } from "./position-valuation.dto";

/**
 * Per-asset-class allocation entry in the portfolio valuation summary.
 */
export class AssetAllocationDto {
  /** AssetClassCode string (e.g. "STOCKS", "CRYPTO", "BONDS") */
  assetClass: string;
  /** Current market value of all holdings in this class (4dp string) */
  currentValue: string;
  /** Percentage of total portfolio allocated to this class (4dp string) */
  allocationPct: string;
}

/**
 * Complete portfolio valuation summary — the primary response DTO for
 * GET /api/v1/portfolios/:id/valuation
 *
 * Contract guarantees:
 *  - Pure read-only: nothing is persisted to the DB during this request.
 *  - PortfolioSnapshot persistence is handled exclusively by scheduled EOD cron jobs.
 *  - All monetary values are fixed-precision decimal strings.
 *  - totalNetWorth = sum of position.currentValue across all non-zero positions.
 *  - totalCostBasis = sum of position.totalCostBasis.
 *  - totalUnrealizedPnL = totalNetWorth − totalCostBasis.
 *  - assetAllocation percentages sum to 100 (within rounding tolerance).
 */
export class PortfolioValuationSummaryDto {
  /** Portfolio UUID */
  portfolioId: string;
  /** Human-readable portfolio name */
  portfolioName: string;
  /** ISO 4217 home currency (e.g. "INR") */
  currency: string;

  // ── Portfolio-Level Aggregates ─────────────────────────────────────────────
  /** Sum of currentValue across all active holdings (4dp string) */
  totalNetWorth: string;
  /** Sum of totalCostBasis across all active holdings (4dp string) */
  totalCostBasis: string;
  /** Aggregate unrealized P&L = totalNetWorth − totalCostBasis (4dp string) */
  totalUnrealizedPnL: string;
  /** Aggregate unrealized P&L as % of totalCostBasis (4dp string) */
  totalUnrealizedPnLPct: string;
  /** Aggregate realized P&L from all historical sells across all holdings (4dp string) */
  totalRealizedPnL: string;

  // ── Individual Positions ───────────────────────────────────────────────────
  /** Full position details for each active holding */
  positions: PositionValuationDto[];

  // ── Allocation Breakdown ───────────────────────────────────────────────────
  /** Asset class breakdown sorted by currentValue DESC */
  assetAllocation: AssetAllocationDto[];

  // ── Data Quality ───────────────────────────────────────────────────────────
  /**
   * Symbols whose price could not be refreshed and is serving a stale cached
   * or DB fallback value. Clients should display a stale indicator for these.
   */
  stalePositions: string[];

  // ── Metadata ───────────────────────────────────────────────────────────────
  /** ISO 8601 UTC timestamp of this valuation snapshot */
  computedAt: string;
  /** Cost basis method used for all positions in this valuation */
  costBasisMethod: CalcMethod;
}
