import { Injectable, Logger, NotFoundException, NotImplementedException } from "@nestjs/common";
import { AssetClassCode, CostBasisMethod } from "@prisma/client";
import Decimal from "decimal.js";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketDataService } from "../market-data/services/market-data.service";
import { CurrencyConverterService } from "./currency-converter";
import { FifoCalculator } from "./fifo-calculator";
import { WeightedAvgCalculator } from "./weighted-avg-calculator";
import {
  CalcMethod,
  CostBasisResult,
  RealizedGain,
  TxLot,
} from "./interfaces/calculator.interface";
import { PositionValuationDto, RealizedGainDto } from "./dto/position-valuation.dto";
import {
  AssetAllocationDto,
  PortfolioValuationSummaryDto,
} from "./dto/portfolio-valuation-summary.dto";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Deterministic Valuation Engine
 *
 * Core computation engine for portfolio valuation, cost basis tracking,
 * and P&L analytics (realized & unrealized).
 *
 * Key principles:
 * - 100% Decimal.js arithmetic — zero floating point rounding errors.
 * - Pure read-only computation on request — never writes to database.
 * - Supports FIFO and Weighted Average cost basis methods.
 * - Integrates with MarketDataService for 3-tier price lookup (Redis -> API -> DB).
 */
@Injectable()
export class ValuationEngine {
  private readonly logger = new Logger(ValuationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly fifoCalculator: FifoCalculator,
    private readonly weightedAvgCalculator: WeightedAvgCalculator,
    private readonly currencyConverter: CurrencyConverterService,
  ) {}

  /**
   * Evaluates a single holding position.
   */
  async valuateHolding(
    userId: string,
    holdingId: string,
    method: CalcMethod = CalcMethod.FIFO,
  ): Promise<PositionValuationDto> {
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
        asset: {
          include: {
            assetClass: true,
          },
        },
        portfolio: true,
        transactions: {
          where: { deletedAt: null },
          orderBy: { transactedAt: "asc" },
        },
      },
    });

    if (!holding) {
      throw new NotFoundException(`Holding with ID "${holdingId}" not found`);
    }

    const assetClass = holding.asset.assetClass.code as AssetClassCode;
    const homeCurrency = holding.portfolio.currency || "INR";

    return this.calculatePositionValuation(
      holding,
      holding.transactions,
      assetClass,
      homeCurrency,
      method,
    );
  }

  /**
   * Evaluates an entire portfolio across all active holdings.
   */
  async valuatePortfolio(
    userId: string,
    portfolioId: string,
    method: CalcMethod = CalcMethod.FIFO,
  ): Promise<PortfolioValuationSummaryDto> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId,
        deletedAt: null,
      },
      include: {
        holdings: {
          where: { deletedAt: null },
          include: {
            asset: {
              include: {
                assetClass: true,
              },
            },
            transactions: {
              where: { deletedAt: null },
              orderBy: { transactedAt: "asc" },
            },
          },
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio with ID "${portfolioId}" not found`);
    }

    const homeCurrency = portfolio.currency || "INR";
    const computedAt = new Date().toISOString();

    // Valuate all holdings in parallel
    const positionPromises = portfolio.holdings.map((holding) => {
      const assetClass = holding.asset.assetClass.code as AssetClassCode;
      return this.calculatePositionValuation(
        holding,
        holding.transactions,
        assetClass,
        homeCurrency,
        method,
      );
    });

    const positions = await Promise.all(positionPromises);

    // Aggregate portfolio-level metrics using Decimal.js
    let totalNetWorthDec = new Decimal(0);
    let totalCostBasisDec = new Decimal(0);
    let totalRealizedPnLDec = new Decimal(0);
    const stalePositions: string[] = [];

    // Class-wise allocation aggregation
    const classAllocationMap = new Map<string, Decimal>();

    for (const pos of positions) {
      const valDec = new Decimal(pos.currentValue);
      const costDec = new Decimal(pos.totalCostBasis);
      const realDec = new Decimal(pos.realizedPnL);

      totalNetWorthDec = totalNetWorthDec.plus(valDec);
      totalCostBasisDec = totalCostBasisDec.plus(costDec);
      totalRealizedPnLDec = totalRealizedPnLDec.plus(realDec);

      if (pos.isPriceStale && pos.symbol !== "CASH") {
        stalePositions.push(pos.symbol);
      }

      // Group for asset allocation (only positions with value)
      const currentClassTotal = classAllocationMap.get(pos.assetClass) || new Decimal(0);
      classAllocationMap.set(pos.assetClass, currentClassTotal.plus(valDec));
    }

    const totalUnrealizedPnLDec = totalNetWorthDec.minus(totalCostBasisDec);
    const totalUnrealizedPnLPctDec = totalCostBasisDec.gt(0)
      ? totalUnrealizedPnLDec.div(totalCostBasisDec).times(100)
      : new Decimal(0);

    // Build asset allocation breakdown list sorted by value DESC
    const assetAllocation: AssetAllocationDto[] = [];
    for (const [assetClass, valueDec] of classAllocationMap.entries()) {
      const pctDec = totalNetWorthDec.gt(0)
        ? valueDec.div(totalNetWorthDec).times(100)
        : new Decimal(0);

      assetAllocation.push({
        assetClass,
        currentValue: valueDec.toFixed(4),
        allocationPct: pctDec.toFixed(4),
      });
    }

    assetAllocation.sort((a, b) =>
      new Decimal(b.currentValue).minus(new Decimal(a.currentValue)).toNumber(),
    );

    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      currency: homeCurrency,
      totalNetWorth: totalNetWorthDec.toFixed(4),
      totalCostBasis: totalCostBasisDec.toFixed(4),
      totalUnrealizedPnL: totalUnrealizedPnLDec.toFixed(4),
      totalUnrealizedPnLPct: totalUnrealizedPnLPctDec.toFixed(4),
      totalRealizedPnL: totalRealizedPnLDec.toFixed(4),
      positions,
      assetAllocation,
      stalePositions,
      computedAt,
      costBasisMethod: method,
    };
  }

  /**
   * Internal calculator subroutine for a single position.
   */
  private async calculatePositionValuation(
    holding: any,
    transactions: any[],
    assetClass: AssetClassCode,
    homeCurrency: string,
    method: CalcMethod,
  ): Promise<PositionValuationDto> {
    const symbolUpper = holding.symbol.toUpperCase();
    const computedAt = new Date().toISOString();

    // 1. Transform raw DB transactions into TxLot model
    const txLots: TxLot[] = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      quantity: new Decimal(tx.quantity.toString()),
      pricePerUnit: new Decimal(tx.pricePerUnit.toString()),
      fees: new Decimal(tx.fees ? tx.fees.toString() : "0"),
      currency: tx.currency,
      fxRateToHome: new Decimal(tx.fxRateToHome ? tx.fxRateToHome.toString() : "1"),
      transactedAt: tx.transactedAt,
      splitRatio: tx.splitRatio ? new Decimal(tx.splitRatio.toString()) : undefined,
    }));

    // 2. Compute cost basis and realized gains using chosen algorithm
    let costResult: CostBasisResult;
    if (method === CalcMethod.FIFO) {
      costResult = this.fifoCalculator.calculate(txLots);
    } else if (method === CalcMethod.AVERAGE_COST) {
      costResult = this.weightedAvgCalculator.calculate(txLots);
    } else if (method === CalcMethod.LIFO) {
      throw new NotImplementedException(
        "LIFO is not currently supported for Indian taxation standards",
      );
    } else {
      costResult = this.fifoCalculator.calculate(txLots);
    }

    const {
      openQuantity,
      avgCostBasisPerUnit,
      totalCostBasis,
      totalRealizedPnL,
      realizedGainRecords,
    } = costResult;

    // 3. Resolve Current Market Price
    let currentPriceDec = new Decimal(0);
    let priceSource = "none";
    let isPriceStale = false;
    let isMarketClosed = false;

    if (symbolUpper === "CASH") {
      currentPriceDec = new Decimal(1);
      priceSource = "fiat_cash";
      isPriceStale = false;
      isMarketClosed = false;
    } else {
      const quote = await this.marketDataService.getPrice(symbolUpper, assetClass);
      if (quote) {
        currentPriceDec = new Decimal(quote.price);
        priceSource = quote.source || "market_data";
        isPriceStale = quote.isStale ?? false;
        isMarketClosed = quote.isMarketClosed ?? false;
      } else {
        // Fallback to holding's last known price from DB
        const fallbackPrice = holding.currentPrice
          ? new Decimal(holding.currentPrice.toString())
          : new Decimal(0);
        currentPriceDec = fallbackPrice;
        priceSource = "holding_last_known";
        isPriceStale = true;
      }
    }

    // 4. Compute valuation and unrealized P&L
    const currentValueDec = openQuantity.times(currentPriceDec);
    const unrealizedPnLDec = currentValueDec.minus(totalCostBasis);
    const unrealizedPnLPctDec = totalCostBasis.gt(0)
      ? unrealizedPnLDec.div(totalCostBasis).times(100)
      : new Decimal(0);

    // 5. Format realized gains
    const formattedRealizedGains: RealizedGainDto[] = realizedGainRecords.map((rg) => ({
      sellTransactionId: rg.sellTransactionId,
      buyTransactionId: rg.buyTransactionId,
      sellDate: rg.sellDate.toISOString(),
      buyDate: rg.buyDate?.toISOString(),
      quantityMatched: rg.quantityMatched.toFixed(8),
      costBasisPerUnit: rg.costBasisPerUnit.toFixed(8),
      proceedsPerUnit: rg.proceedsPerUnit.toFixed(8),
      realizedGainLoss: rg.realizedGainLoss.toFixed(4),
      holdingPeriodDays: rg.holdingPeriodDays,
      isLongTerm: rg.isLongTerm,
      currency: rg.currency,
    }));

    return {
      holdingId: holding.id,
      symbol: symbolUpper,
      assetClass,
      openQuantity: openQuantity.toFixed(8),
      avgCostBasisPerUnit: avgCostBasisPerUnit.toFixed(8),
      totalCostBasis: totalCostBasis.toFixed(4),
      currentPrice: currentPriceDec.toFixed(8),
      currentValue: currentValueDec.toFixed(4),
      unrealizedPnL: unrealizedPnLDec.toFixed(4),
      unrealizedPnLPct: unrealizedPnLPctDec.toFixed(4),
      realizedPnL: totalRealizedPnL.toFixed(4),
      totalRealizedGains: formattedRealizedGains,
      currency: homeCurrency,
      priceSource,
      isPriceStale,
      isMarketClosed,
      computedAt,
      costBasisMethod: method,
    };
  }
}
