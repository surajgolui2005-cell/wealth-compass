import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { InsufficientHoldingException } from '../exceptions/insufficient-holding.exception';

@Injectable()
export class HoldingService {
  constructor(private readonly prisma: PrismaService) {}

  async getHoldingsByPortfolio(userId: string, portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId, deletedAt: null },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio not found`);
    }

    return this.prisma.holding.findMany({
      where: {
        portfolioId,
        deletedAt: null,
      },
      include: {
        asset: true,
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { currentValue: 'desc' },
    });
  }

  async getHoldingById(userId: string, holdingId: string) {
    const holding = await this.prisma.holding.findFirst({
      where: {
        id: holdingId,
        deletedAt: null,
        portfolio: {
          userId,
          deletedAt: null,
        },
      },
      include: {
        asset: true,
        portfolio: true,
        transactions: {
          where: { deletedAt: null },
          orderBy: { transactedAt: 'desc' },
        },
      },
    });

    if (!holding) {
      throw new NotFoundException(`Holding with ID ${holdingId} not found`);
    }

    return holding;
  }

  /**
   * Calculates new position state after a transaction using Decimal.js for precise financial math
   */
  calculateNewHoldingState(
    currentQuantityStr: string,
    currentAvgCostBasisStr: string,
    type: TransactionType,
    quantityNum: number | string,
    pricePerUnitNum: number | string,
    feesNum: number | string = 0,
    symbol: string,
    splitRatioNum: number | string = 1,
    existingCurrentPriceStr?: string,
  ) {
    const q = new Decimal(currentQuantityStr || '0');
    const c = new Decimal(currentAvgCostBasisStr || '0');
    const tq = new Decimal(quantityNum?.toString() || '0');
    const tp = new Decimal(pricePerUnitNum?.toString() || '0');
    const tf = new Decimal(feesNum?.toString() || '0');
    const ratio = new Decimal(splitRatioNum?.toString() || '1');
    const oldPrice = new Decimal(existingCurrentPriceStr || '0');

    let newQuantity = q;
    let newAvgCostBasis = c;
    let currentPrice = tp.gt(0) ? tp : oldPrice;

    switch (type) {
      case TransactionType.BUY: {
        newQuantity = q.plus(tq);
        if (newQuantity.gt(0)) {
          const currentCostTotal = q.times(c);
          const newTxCostTotal = tq.times(tp).plus(tf);
          newAvgCostBasis = currentCostTotal.plus(newTxCostTotal).div(newQuantity);
        }
        break;
      }

      case TransactionType.SELL: {
        if (q.lt(tq)) {
          throw new InsufficientHoldingException(symbol, tq.toString(), q.toString());
        }
        newQuantity = q.minus(tq);
        if (newQuantity.equals(0)) {
          newAvgCostBasis = new Decimal(0);
        }
        break;
      }

      case TransactionType.DIVIDEND:
      case TransactionType.INTEREST: {
        // Holdings quantity and cost basis do not change on dividend/interest distribution
        newQuantity = q;
        newAvgCostBasis = c;
        if (oldPrice.gt(0) && tp.equals(0)) {
          currentPrice = oldPrice;
        }
        break;
      }

      case TransactionType.FEE: {
        newQuantity = q;
        newAvgCostBasis = c;
        break;
      }

      case TransactionType.DEPOSIT: {
        newQuantity = q.plus(tq);
        if (symbol.toUpperCase() === 'CASH') {
          newAvgCostBasis = new Decimal(1.0);
          currentPrice = new Decimal(1.0);
        } else if (newQuantity.gt(0)) {
          const currentCostTotal = q.times(c);
          const newTxCostTotal = tq.times(tp).plus(tf);
          newAvgCostBasis = currentCostTotal.plus(newTxCostTotal).div(newQuantity);
        }
        break;
      }

      case TransactionType.WITHDRAWAL: {
        if (q.lt(tq)) {
          throw new InsufficientHoldingException(symbol, tq.toString(), q.toString());
        }
        newQuantity = q.minus(tq);
        if (newQuantity.equals(0)) {
          newAvgCostBasis = symbol.toUpperCase() === 'CASH' ? new Decimal(1.0) : new Decimal(0);
        }
        break;
      }

      case TransactionType.SPLIT: {
        const effectiveRatio = ratio.gt(0) ? ratio : tq.gt(0) ? tq : new Decimal(1);
        newQuantity = q.times(effectiveRatio);
        newAvgCostBasis = effectiveRatio.gt(0) ? c.div(effectiveRatio) : c;
        if (currentPrice.gt(0) && effectiveRatio.gt(0)) {
          currentPrice = currentPrice.div(effectiveRatio);
        }
        break;
      }

      case TransactionType.BONUS: {
        newQuantity = q.plus(tq);
        if (newQuantity.gt(0)) {
          // Bonus shares add 0 cost, so total cost basis remains unchanged, diluting avg cost basis
          const totalCostBasis = q.times(c);
          newAvgCostBasis = totalCostBasis.div(newQuantity);
        }
        break;
      }

      default: {
        newQuantity = q;
        newAvgCostBasis = c;
      }
    }

    const currentValue = newQuantity.times(currentPrice);
    const totalCostBasis = newQuantity.times(newAvgCostBasis);
    const unrealizedPnL = currentValue.minus(totalCostBasis);
    const unrealizedPnLPct = totalCostBasis.gt(0)
      ? unrealizedPnL.div(totalCostBasis).times(100)
      : new Decimal(0);

    return {
      quantity: newQuantity.toFixed(8),
      avgCostBasis: newAvgCostBasis.toFixed(8),
      currentPrice: currentPrice.toFixed(8),
      currentValue: currentValue.toFixed(4),
      unrealizedPnL: unrealizedPnL.toFixed(4),
      unrealizedPnLPct: unrealizedPnLPct.toFixed(4),
    };
  }
}
