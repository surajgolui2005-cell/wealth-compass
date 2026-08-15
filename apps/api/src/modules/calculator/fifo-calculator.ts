import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { TransactionType } from "@prisma/client";
import { TxLot, CostBasisResult, RealizedGain } from "./interfaces/calculator.interface";

// Maximum financial precision: 28 significant digits, ROUND_HALF_UP (banker-safe)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Internal representation of an open buy lot still held in the FIFO queue.
 */
interface FifoLot {
  /** DB transaction ID of the original BUY */
  txId: string;
  purchaseDate: Date;
  /** Units still unsold from this lot */
  remainingQty: Decimal;
  /**
   * Effective cost basis per unit in the portfolio's home currency.
   * = (pricePerUnit * fxRateToHome) + (fees * fxRateToHome / quantity)
   * Fees are amortised across the lot at purchase time.
   */
  costBasisPerUnit: Decimal;
  currency: string;
}

/**
 * FIFO (First-In, First-Out) cost basis calculator.
 *
 * Algorithm summary:
 *  BUY     → push new lot onto the queue tail (oldest-first ordering)
 *  SELL    → drain from queue head; produce a RealizedGain record per lot matched
 *            (partial matching: remaining qty stays on the head lot)
 *  SPLIT   → multiply all open lot quantities by splitRatio; divide costBasis by splitRatio
 *            (total cost position is preserved exactly)
 *  BONUS   → push a new lot with costBasisPerUnit = 0 (zero-cost allocation)
 *  DEPOSIT → treated identically to BUY
 *  WITHDRAWAL → treated identically to SELL
 *  DIVIDEND / INTEREST / FEE → no-op (no impact on cost basis or open position)
 *
 * All arithmetic uses Decimal.js (28-digit precision, ROUND_HALF_UP).
 * Zero standard JavaScript +, *, / operators are applied to any monetary value.
 *
 * @example
 * const calc = new FifoCalculator();
 * const result = calc.calculate(sortedTxLots);
 * console.log(result.openQuantity.toFixed(8));     // "10.00000000"
 * console.log(result.totalRealizedPnL.toFixed(4)); // "5250.0000"
 */
@Injectable()
export class FifoCalculator {
  /**
   * Processes a chronologically sorted list of transaction lots and returns
   * the open position and realized gain history.
   *
   * @param lots — TxLot[] sorted by transactedAt ASC (oldest first).
   *               The caller (ValuationEngine) is responsible for the sort order.
   * @returns CostBasisResult with full precision Decimal fields.
   */
  calculate(lots: TxLot[]): CostBasisResult {
    /** FIFO queue: index 0 = oldest lot (next to sell from) */
    const queue: FifoLot[] = [];
    const realizedGainRecords: RealizedGain[] = [];
    let totalRealizedPnL = new Decimal(0);

    for (const lot of lots) {
      switch (lot.type) {
        case TransactionType.BUY:
        case TransactionType.DEPOSIT: {
          if (lot.quantity.lte(0)) break;

          // Amortise fees into the per-unit cost basis (home currency)
          // totalCostHome = (qty * price + fees) * fxRate
          const totalCostHome = lot.quantity
            .times(lot.pricePerUnit)
            .plus(lot.fees)
            .times(lot.fxRateToHome);
          const costPerUnit = totalCostHome.div(lot.quantity);

          queue.push({
            txId: lot.id,
            purchaseDate: lot.transactedAt,
            remainingQty: lot.quantity,
            costBasisPerUnit: costPerUnit,
            currency: lot.currency,
          });
          break;
        }

        case TransactionType.SELL:
        case TransactionType.WITHDRAWAL: {
          if (lot.quantity.lte(0)) break;

          // Net proceeds per unit in home currency (fees reduce proceeds)
          // proceedsPerUnit = (price * fxRate) — we do NOT subtract fees here
          // because sell fees are already captured in the totalAmount field
          // and we want a gross-per-unit figure consistent with tax reporting.
          const proceedsPerUnit = lot.pricePerUnit.times(lot.fxRateToHome);
          let remainingToSell = lot.quantity;

          while (remainingToSell.gt(0) && queue.length > 0) {
            const head = queue[0];
            // Match as much as possible from the head lot
            const matchedQty = Decimal.min(head.remainingQty, remainingToSell);

            // Realized gain for this matched sub-lot
            const gainLoss = proceedsPerUnit.minus(head.costBasisPerUnit).times(matchedQty);

            const sellDate = lot.transactedAt;
            const buyDate = head.purchaseDate;
            const holdingPeriodDays = Math.floor(
              (sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24),
            );

            realizedGainRecords.push({
              sellTransactionId: lot.id,
              buyTransactionId: head.txId,
              sellDate,
              buyDate,
              quantityMatched: matchedQty,
              costBasisPerUnit: head.costBasisPerUnit,
              proceedsPerUnit,
              realizedGainLoss: gainLoss,
              holdingPeriodDays,
              // India equity LTCG threshold: > 365 days
              isLongTerm: holdingPeriodDays > 365,
              currency: lot.currency,
            } satisfies RealizedGain);

            totalRealizedPnL = totalRealizedPnL.plus(gainLoss);

            // Reduce head lot; drop it if exhausted
            head.remainingQty = head.remainingQty.minus(matchedQty);
            remainingToSell = remainingToSell.minus(matchedQty);

            if (head.remainingQty.isZero()) {
              queue.shift();
            }
          }
          // If remainingToSell > 0 here, the holding is oversold — the transaction
          // service already guards against this via InsufficientHoldingException,
          // so we silently skip; the remaining sell simply has no matched lot.
          break;
        }

        case TransactionType.SPLIT: {
          // splitRatio stored as the `quantity` column of the SPLIT transaction
          const ratio = lot.splitRatio ?? lot.quantity;
          if (ratio.lte(0)) break;

          // Proportional adjustment: more shares, lower cost per share
          // Total cost position is invariant: qty * costPerUnit stays the same
          for (const openLot of queue) {
            openLot.remainingQty = openLot.remainingQty.times(ratio);
            openLot.costBasisPerUnit = openLot.costBasisPerUnit.div(ratio);
          }
          break;
        }

        case TransactionType.BONUS: {
          // Bonus/rights issue shares carry zero acquisition cost.
          // They dilute the effective average cost basis of the total position.
          if (lot.quantity.lte(0)) break;

          queue.push({
            txId: lot.id,
            purchaseDate: lot.transactedAt,
            remainingQty: lot.quantity,
            costBasisPerUnit: new Decimal(0),
            currency: lot.currency,
          });
          break;
        }

        // DIVIDEND, INTEREST, FEE → no position impact
        default:
          break;
      }
    }

    // ── Aggregate open lots into final position ───────────────────────────────
    let openQuantity = new Decimal(0);
    let weightedCostSum = new Decimal(0);

    for (const openLot of queue) {
      openQuantity = openQuantity.plus(openLot.remainingQty);
      weightedCostSum = weightedCostSum.plus(openLot.remainingQty.times(openLot.costBasisPerUnit));
    }

    const avgCostBasisPerUnit = openQuantity.gt(0)
      ? weightedCostSum.div(openQuantity)
      : new Decimal(0);

    return {
      openQuantity,
      avgCostBasisPerUnit,
      totalCostBasis: weightedCostSum,
      totalRealizedPnL,
      realizedGainRecords,
    };
  }
}
