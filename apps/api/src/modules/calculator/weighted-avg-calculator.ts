import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import { TransactionType } from "@prisma/client";
import { TxLot, CostBasisResult, RealizedGain } from "./interfaces/calculator.interface";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Weighted Average Cost (WAC) basis calculator.
 *
 * Accepted by SEBI and the Indian Income Tax Act for:
 *   - Mutual fund units (mandatory for MFs under Section 48)
 *   - Equities where broker/investor opts for WAC over FIFO
 *
 * Algorithm summary:
 *  BUY     → newAvg = (totalCost + newLotCost) / newTotalQty
 *  SELL    → realizedGain = (sellPriceHome - avgCost) × qty; avgCost unchanged for remaining
 *  SPLIT   → qty × ratio; avgCost ÷ ratio  (total cost invariant)
 *  BONUS   → qty += bonusQty; totalCost unchanged → avgCost diluted
 *  DEPOSIT → identical to BUY
 *  WITHDRAWAL → identical to SELL
 *  DIVIDEND / INTEREST / FEE → no-op
 *
 * Note on holding period:
 *   WAC does not track individual lot purchase dates. Therefore holdingPeriodDays
 *   and isLongTerm are set to 0 / false in RealizedGain records.
 *   For precise STCG/LTCG classification, use FifoCalculator instead.
 *
 * All arithmetic uses Decimal.js (28-digit precision, ROUND_HALF_UP).
 */
@Injectable()
export class WeightedAvgCalculator {
  /**
   * Processes a chronologically sorted list of transaction lots.
   *
   * @param lots — TxLot[] sorted by transactedAt ASC.
   * @returns CostBasisResult with full precision Decimal fields.
   */
  calculate(lots: TxLot[]): CostBasisResult {
    let openQty = new Decimal(0);
    /** Cumulative cost of the open position in home currency */
    let totalCost = new Decimal(0);
    const realizedGainRecords: RealizedGain[] = [];
    let totalRealizedPnL = new Decimal(0);

    for (const lot of lots) {
      // Running average cost basis per unit (re-computed after each BUY)
      const currentAvgCost = openQty.gt(0) ? totalCost.div(openQty) : new Decimal(0);

      switch (lot.type) {
        case TransactionType.BUY:
        case TransactionType.DEPOSIT: {
          if (lot.quantity.lte(0)) break;
          // Convert to home currency and amortise fees into cost
          const lotCostHome = lot.quantity
            .times(lot.pricePerUnit)
            .plus(lot.fees)
            .times(lot.fxRateToHome);

          openQty = openQty.plus(lot.quantity);
          totalCost = totalCost.plus(lotCostHome);
          break;
        }

        case TransactionType.SELL:
        case TransactionType.WITHDRAWAL: {
          if (lot.quantity.lte(0)) break;
          const proceedsPerUnit = lot.pricePerUnit.times(lot.fxRateToHome);
          const gainLoss = proceedsPerUnit.minus(currentAvgCost).times(lot.quantity);

          realizedGainRecords.push({
            sellTransactionId: lot.id,
            // WAC has no specific buy lot — buyTransactionId is omitted
            sellDate: lot.transactedAt,
            quantityMatched: lot.quantity,
            costBasisPerUnit: currentAvgCost,
            proceedsPerUnit,
            realizedGainLoss: gainLoss,
            // WAC does not track per-lot holding periods
            holdingPeriodDays: 0,
            isLongTerm: false,
            currency: lot.currency,
          } satisfies RealizedGain);

          totalRealizedPnL = totalRealizedPnL.plus(gainLoss);

          // Reduce open position; avgCost per unit remains unchanged
          const costReduction = currentAvgCost.times(lot.quantity);
          openQty = openQty.minus(lot.quantity);
          totalCost = totalCost.minus(costReduction);

          // Guard against floating residuals reaching negative zero
          if (openQty.lte(0)) {
            openQty = new Decimal(0);
            totalCost = new Decimal(0);
          }
          break;
        }

        case TransactionType.SPLIT: {
          const ratio = lot.splitRatio ?? lot.quantity;
          if (ratio.lte(0)) break;
          // qty multiplied by ratio; totalCost unchanged → avgCost divided by ratio
          openQty = openQty.times(ratio);
          // totalCost stays the same, so the new avgCost = totalCost / newQty = old avgCost / ratio
          break;
        }

        case TransactionType.BONUS: {
          if (lot.quantity.lte(0)) break;
          // Bonus shares carry 0 cost → totalCost unchanged, qty increases
          // New avgCost = totalCost / (openQty + bonusQty)  [diluted]
          openQty = openQty.plus(lot.quantity);
          break;
        }

        // DIVIDEND, INTEREST, FEE → no position impact
        default:
          break;
      }
    }

    const finalAvgCost = openQty.gt(0) ? totalCost.div(openQty) : new Decimal(0);

    return {
      openQuantity: openQty,
      avgCostBasisPerUnit: finalAvgCost,
      totalCostBasis: totalCost,
      totalRealizedPnL,
      realizedGainRecords,
    };
  }
}
