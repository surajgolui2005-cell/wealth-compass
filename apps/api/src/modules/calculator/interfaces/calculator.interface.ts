import Decimal from "decimal.js";
import { TransactionType } from "@prisma/client";

/**
 * A single transaction lot fed into a cost basis calculator.
 * All monetary fields are Decimal.js instances — zero floating-point drift guaranteed.
 *
 * Lots must be sorted by `transactedAt ASC` before being passed to any calculator.
 */
export interface TxLot {
  /** DB transaction UUID — carried through for audit trail in RealizedGain records */
  id: string;
  type: TransactionType;
  /** Quantity in the asset's native unit (e.g. shares, BTC, units) */
  quantity: Decimal;
  /** Price per unit at the time of the transaction */
  pricePerUnit: Decimal;
  /** Brokerage / exchange fees charged on this transaction */
  fees: Decimal;
  /** ISO 4217 currency code for this transaction (e.g. "INR", "USD") */
  currency: string;
  /** Exchange rate: 1 unit of `currency` = `fxRateToHome` units of the portfolio's home currency */
  fxRateToHome: Decimal;
  /** Exact execution timestamp (DB: transacted_at) */
  transactedAt: Date;
  /**
   * Only relevant for TransactionType.SPLIT.
   * e.g. a 2-for-1 split has splitRatio = Decimal(2).
   * Stored in the `quantity` column for SPLIT records in the DB.
   */
  splitRatio?: Decimal;
}

/**
 * A single realized gain/loss record produced when a SELL lot is matched
 * against one or more BUY lots (FIFO) or against the running average (WA).
 * Used for capital gains tax reporting (STCG / LTCG under Indian income tax rules).
 */
export interface RealizedGain {
  /** DB ID of the SELL transaction that triggered this gain event */
  sellTransactionId: string;
  /** DB ID of the matched BUY lot (present for FIFO; undefined for Weighted Average) */
  buyTransactionId?: string;
  sellDate: Date;
  /** Date of the matched BUY lot (present for FIFO) */
  buyDate?: Date;
  /** Quantity matched between this buy lot and the sell order */
  quantityMatched: Decimal;
  /** Effective cost per unit (home currency) for this matched lot */
  costBasisPerUnit: Decimal;
  /** Net sell proceeds per unit (home currency, after FX conversion) */
  proceedsPerUnit: Decimal;
  /**
   * realizedGainLoss = (proceedsPerUnit - costBasisPerUnit) * quantityMatched
   * Positive = profit; negative = loss.
   */
  realizedGainLoss: Decimal;
  /** Calendar days between buyDate and sellDate */
  holdingPeriodDays: number;
  /**
   * Indian STCG/LTCG classification for listed equity:
   *   > 12 months (365 days) → Long-Term (LTCG, 10% above ₹1L)
   *   ≤ 12 months             → Short-Term (STCG, 15%)
   * Note: crypto and debt instruments have different thresholds.
   * WA method sets isLongTerm = false (holding period not tracked per lot).
   */
  isLongTerm: boolean;
  currency: string;
}

/**
 * The canonical output from any cost basis calculator (FIFO or Weighted Average).
 * All Decimal fields carry the full 28-digit precision from Decimal.js.
 */
export interface CostBasisResult {
  /** Remaining open (un-sold) quantity after processing all transactions */
  openQuantity: Decimal;
  /** Weighted average cost basis per unit for the open position (home currency) */
  avgCostBasisPerUnit: Decimal;
  /** Total cost of the open position: openQuantity × avgCostBasisPerUnit */
  totalCostBasis: Decimal;
  /** Net sum of all realized gain/loss records */
  totalRealizedPnL: Decimal;
  /** Granular realized gain records (one entry per lot matched or per SELL for WA) */
  realizedGainRecords: RealizedGain[];
}

/**
 * Supported cost basis calculation methods.
 * Mirrors the CostBasisMethod enum in the Prisma schema.
 */
export enum CalcMethod {
  /** First-In, First-Out — legally required for equity CGT in most jurisdictions */
  FIFO = "FIFO",
  /** Weighted Average Cost — accepted for equity in India under IT Act */
  AVERAGE_COST = "AVERAGE_COST",
  /** Last-In, First-Out — stub only; not supported under Indian taxation standards */
  LIFO = "LIFO",
}
