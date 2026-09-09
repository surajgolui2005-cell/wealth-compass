import { Injectable, NotFoundException } from "@nestjs/common";
import { TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { PrismaService } from "../../../prisma/prisma.service";
import { InsufficientHoldingException } from "../exceptions/insufficient-holding.exception";

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
        asset: {
          include: {
            assetClass: true,
          },
        },
        providerAccount: {
          select: {
            id: true,
            providerCode: true,
            accountName: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { currentValue: "desc" },
    });
  }

  async getPortfolioSummary(userId: string, portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId, deletedAt: null },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio not found`);
    }

    const holdings = await this.prisma.holding.findMany({
      where: {
        portfolioId,
        deletedAt: null,
      },
      include: {
        asset: {
          include: {
            assetClass: true,
          },
        },
        providerAccount: {
          select: {
            id: true,
            providerCode: true,
            accountName: true,
          },
        },
      },
    });

    let totalValueDec = new Decimal(0);
    let totalCostDec = new Decimal(0);
    const platformMap = new Map<
      string,
      {
        providerCode: string;
        accountName: string;
        totalValue: Decimal;
        totalCost: Decimal;
        count: number;
      }
    >();
    const assetClassMap = new Map<
      string,
      { code: string; name: string; totalValue: Decimal; count: number }
    >();

    for (const h of holdings) {
      const q = new Decimal(h.quantity?.toString() || "0");
      const c = new Decimal(h.avgCostBasis?.toString() || "0");
      const v = new Decimal(h.currentValue?.toString() || "0");
      const cost = q.times(c);

      totalValueDec = totalValueDec.plus(v);
      totalCostDec = totalCostDec.plus(cost);

      const providerKey = h.providerAccount?.providerCode
        ? String(h.providerAccount.providerCode)
        : h.isManual
          ? "MANUAL"
          : "OTHER";
      const providerLabel =
        h.providerAccount?.accountName ||
        (h.providerAccount?.providerCode ? String(h.providerAccount.providerCode) : "Manual");
      const existingPlat = platformMap.get(providerKey) || {
        providerCode: providerKey,
        accountName: providerLabel,
        totalValue: new Decimal(0),
        totalCost: new Decimal(0),
        count: 0,
      };
      existingPlat.totalValue = existingPlat.totalValue.plus(v);
      existingPlat.totalCost = existingPlat.totalCost.plus(cost);
      existingPlat.count += 1;
      platformMap.set(providerKey, existingPlat);

      const classCode = h.asset?.assetClass?.code ? String(h.asset.assetClass.code) : "STOCKS";
      const className = h.asset?.assetClass?.name || "Equities";
      const existingClass = assetClassMap.get(classCode) || {
        code: classCode,
        name: className,
        totalValue: new Decimal(0),
        count: 0,
      };
      existingClass.totalValue = existingClass.totalValue.plus(v);
      existingClass.count += 1;
      assetClassMap.set(classCode, existingClass);
    }

    const totalPnlDec = totalValueDec.minus(totalCostDec);
    const totalPnlPctDec = totalCostDec.gt(0)
      ? totalPnlDec.div(totalCostDec).times(100)
      : new Decimal(0);

    const platformBreakdown = Array.from(platformMap.values()).map((p) => {
      const pnl = p.totalValue.minus(p.totalCost);
      const pnlPct = p.totalCost.gt(0) ? pnl.div(p.totalCost).times(100) : new Decimal(0);
      const pctOfPortfolio = totalValueDec.gt(0)
        ? p.totalValue.div(totalValueDec).times(100)
        : new Decimal(0);
      return {
        providerCode: p.providerCode,
        accountName: p.accountName,
        totalValue: Number(p.totalValue.toFixed(2)),
        totalCost: Number(p.totalCost.toFixed(2)),
        pnl: Number(pnl.toFixed(2)),
        pnlPct: Number(pnlPct.toFixed(2)),
        count: p.count,
        percentage: Number(pctOfPortfolio.toFixed(2)),
      };
    });

    const assetClassBreakdown = Array.from(assetClassMap.values()).map((ac) => {
      const pctOfPortfolio = totalValueDec.gt(0)
        ? ac.totalValue.div(totalValueDec).times(100)
        : new Decimal(0);
      return {
        code: ac.code,
        name: ac.name,
        totalValue: Number(ac.totalValue.toFixed(2)),
        count: ac.count,
        percentage: Number(pctOfPortfolio.toFixed(2)),
      };
    });

    return {
      id: portfolio.id,
      name: portfolio.name,
      currency: portfolio.currency,
      totalValue: Number(totalValueDec.toFixed(2)),
      totalCost: Number(totalCostDec.toFixed(2)),
      totalPnl: Number(totalPnlDec.toFixed(2)),
      totalPnlPct: Number(totalPnlPctDec.toFixed(2)),
      holdingsCount: holdings.length,
      platformBreakdown,
      assetClassBreakdown,
    };
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
          orderBy: { transactedAt: "desc" },
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
    const q = new Decimal(currentQuantityStr || "0");
    const c = new Decimal(currentAvgCostBasisStr || "0");
    const tq = new Decimal(quantityNum?.toString() || "0");
    const tp = new Decimal(pricePerUnitNum?.toString() || "0");
    const tf = new Decimal(feesNum?.toString() || "0");
    const ratio = new Decimal(splitRatioNum?.toString() || "1");
    const oldPrice = new Decimal(existingCurrentPriceStr || "0");

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
        if (symbol.toUpperCase() === "CASH") {
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
          newAvgCostBasis = symbol.toUpperCase() === "CASH" ? new Decimal(1.0) : new Decimal(0);
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
