import { Injectable, Optional } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AssetClassCode, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTransactionDto } from "../dto/create-transaction.dto";
import { InsufficientCashException } from "../exceptions/insufficient-cash.exception";
import { HoldingService } from "./holding.service";
import { PortfolioService } from "./portfolio.service";

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolioService: PortfolioService,
    private readonly holdingService: HoldingService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Atomically records a financial transaction, updates holding state, updates cash balances,
   * recalculates portfolio total net worth, and emits domain events.
   */
  async recordTransaction(userId: string, dto: CreateTransactionDto) {
    const portfolio = await this.portfolioService.getPortfolioById(userId, dto.portfolioId);

    const symbolUpper = dto.symbol.trim().toUpperCase();
    const assetClassCode =
      dto.assetClassCode || (symbolUpper === "CASH" ? AssetClassCode.CASH : AssetClassCode.STOCKS);

    return this.prisma.$transaction(async (tx) => {
      // 1. Ensure target AssetClass exists
      let assetClass = await tx.assetClass.findUnique({
        where: { code: assetClassCode },
      });

      if (!assetClass) {
        assetClass = await tx.assetClass.create({
          data: {
            code: assetClassCode,
            name: assetClassCode.replace("_", " "),
            category:
              assetClassCode === AssetClassCode.CRYPTO
                ? "ALTERNATIVE"
                : assetClassCode === AssetClassCode.CASH
                  ? "CASH_EQUIVALENT"
                  : "EQUITY",
          },
        });
      }

      // 2. Ensure target Asset exists
      let asset = await tx.asset.findFirst({
        where: { symbol: symbolUpper, deletedAt: null },
      });

      if (!asset) {
        asset = await tx.asset.create({
          data: {
            symbol: symbolUpper,
            name: symbolUpper === "CASH" ? "Cash & Liquid Balance" : symbolUpper,
            assetClassId: assetClass.id,
            currency: dto.currency?.toUpperCase() || portfolio.currency || "INR",
          },
        });
      }

      // 3. Retrieve or create Holding for target asset
      let holding = await tx.holding.findFirst({
        where: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          deletedAt: null,
        },
      });

      if (!holding) {
        holding = await tx.holding.create({
          data: {
            portfolioId: portfolio.id,
            assetId: asset.id,
            providerAccountId: dto.providerAccountId || null,
            symbol: symbolUpper,
            quantity: 0,
            avgCostBasis: symbolUpper === "CASH" ? 1.0 : 0,
            currentPrice: symbolUpper === "CASH" ? 1.0 : dto.pricePerUnit,
            currentValue: 0,
            unrealizedPnL: 0,
            unrealizedPnLPct: 0,
            costCurrency: dto.currency?.toUpperCase() || portfolio.currency || "INR",
            isManual: true,
          },
        });
      }

      // 4. Calculate new target holding state using Decimal.js
      const newState = this.holdingService.calculateNewHoldingState(
        holding.quantity.toString(),
        holding.avgCostBasis.toString(),
        dto.type,
        dto.quantity,
        dto.pricePerUnit,
        dto.fees || 0,
        symbolUpper,
        dto.splitRatio || 1,
        holding.currentPrice.toString(),
      );

      // 5. Calculate transaction total amount using Decimal.js
      const qDec = new Decimal(dto.quantity.toString());
      const pDec = new Decimal(dto.pricePerUnit.toString());
      const feeDec = new Decimal((dto.fees || 0).toString());

      let totalAmountDec: Decimal;
      if (dto.type === TransactionType.DIVIDEND || dto.type === TransactionType.INTEREST) {
        totalAmountDec = qDec.gt(0) ? qDec.times(pDec).minus(feeDec) : pDec.minus(feeDec);
      } else if (dto.type === TransactionType.FEE) {
        totalAmountDec = feeDec.gt(0) ? feeDec : qDec.times(pDec);
      } else {
        totalAmountDec = qDec.times(pDec).plus(feeDec);
      }

      // 6. Update target Holding state in DB
      const updatedHolding = await tx.holding.update({
        where: { id: holding.id },
        data: {
          quantity: newState.quantity,
          avgCostBasis: newState.avgCostBasis,
          currentPrice: newState.currentPrice,
          currentValue: newState.currentValue,
          unrealizedPnL: newState.unrealizedPnL,
          unrealizedPnLPct: newState.unrealizedPnLPct,
          ...(dto.providerAccountId ? { providerAccountId: dto.providerAccountId } : {}),
        },
      });

      // 7. Create Transaction record in DB
      const transactionRecord = await tx.transaction.create({
        data: {
          holdingId: holding.id,
          type: dto.type,
          quantity: dto.quantity,
          pricePerUnit: dto.pricePerUnit,
          fees: dto.fees || 0,
          totalAmount: totalAmountDec.toFixed(4),
          currency: dto.currency?.toUpperCase() || portfolio.currency || "INR",
          fxRateToHome: dto.fxRateToHome || 1.0,
          transactedAt: dto.transactedAt || new Date(),
          notes: dto.notes?.trim() || null,
        },
      });

      // 8. Update CASH account balance if transaction affects cash (and target asset is not CASH itself)
      let cashHoldingUpdated = null;
      if (symbolUpper !== "CASH") {
        const cashDelta = this.calculateCashDelta(dto.type, qDec, pDec, feeDec, totalAmountDec);

        if (!cashDelta.equals(0)) {
          cashHoldingUpdated = await this.updateCashBalance(
            tx,
            portfolio.id,
            portfolio.currency,
            cashDelta,
          );
        }
      }

      // 9. Recalculate total portfolio valuation across all active holdings
      const newTotalValue = await this.portfolioService.recalculatePortfolioTotal(tx, portfolio.id);

      // 10. Emit domain events if EventEmitter is present
      if (this.eventEmitter) {
        this.eventEmitter.emit("transaction.recorded", {
          transactionId: transactionRecord.id,
          portfolioId: portfolio.id,
          holdingId: holding.id,
          type: dto.type,
          symbol: symbolUpper,
          totalAmount: transactionRecord.totalAmount,
          transactedAt: transactionRecord.transactedAt,
        });

        this.eventEmitter.emit("holding.updated", {
          holdingId: updatedHolding.id,
          portfolioId: portfolio.id,
          symbol: symbolUpper,
          quantity: updatedHolding.quantity,
          currentValue: updatedHolding.currentValue,
        });

        this.eventEmitter.emit("portfolio.updated", {
          portfolioId: portfolio.id,
          totalValue: newTotalValue.toFixed(4),
        });
      }

      return {
        transaction: transactionRecord,
        holding: updatedHolding,
        cashHolding: cashHoldingUpdated,
      };
    });
  }

  async getTransactionsByPortfolio(userId: string, portfolioId: string) {
    await this.portfolioService.getPortfolioById(userId, portfolioId);

    return this.prisma.transaction.findMany({
      where: {
        holding: {
          portfolioId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        holding: {
          include: {
            asset: true,
          },
        },
      },
      orderBy: { transactedAt: "desc" },
    });
  }

  async getTransactionsByHolding(userId: string, holdingId: string) {
    await this.holdingService.getHoldingById(userId, holdingId);

    return this.prisma.transaction.findMany({
      where: {
        holdingId,
        deletedAt: null,
      },
      orderBy: { transactedAt: "desc" },
    });
  }

  /**
   * Computes the net cash movement for a transaction type
   */
  private calculateCashDelta(
    type: TransactionType,
    q: Decimal,
    p: Decimal,
    fees: Decimal,
    totalAmount: Decimal,
  ): Decimal {
    switch (type) {
      case TransactionType.BUY:
        // Cash outflow = (q * p) + fees
        return q.times(p).plus(fees).negated();

      case TransactionType.SELL:
        // Cash inflow = (q * p) - fees
        return q.times(p).minus(fees);

      case TransactionType.DIVIDEND:
      case TransactionType.INTEREST:
        // Cash inflow = dividend or interest net amount
        return totalAmount;

      case TransactionType.DEPOSIT:
        // Cash deposit inflow
        return q.gt(0) ? q.times(p.gt(0) ? p : 1) : totalAmount;

      case TransactionType.WITHDRAWAL:
        // Cash withdrawal outflow
        return (q.gt(0) ? q.times(p.gt(0) ? p : 1) : totalAmount).negated();

      case TransactionType.FEE:
        // Cash fee outflow
        return totalAmount.negated();

      case TransactionType.SPLIT:
      case TransactionType.BONUS:
      default:
        return new Decimal(0);
    }
  }

  /**
   * Atomically updates or creates the portfolio's CASH holding
   */
  private async updateCashBalance(
    tx: any,
    portfolioId: string,
    currency: string,
    cashDelta: Decimal,
  ) {
    let cashAssetClass = await tx.assetClass.findUnique({
      where: { code: AssetClassCode.CASH },
    });

    if (!cashAssetClass) {
      cashAssetClass = await tx.assetClass.create({
        data: {
          code: AssetClassCode.CASH,
          name: "Cash",
          category: "CASH_EQUIVALENT",
        },
      });
    }

    let cashAsset = await tx.asset.findFirst({
      where: { symbol: "CASH", deletedAt: null },
    });

    if (!cashAsset) {
      cashAsset = await tx.asset.create({
        data: {
          symbol: "CASH",
          name: "Cash & Liquid Balance",
          assetClassId: cashAssetClass.id,
          currency: currency || "INR",
        },
      });
    }

    let cashHolding = await tx.holding.findFirst({
      where: {
        portfolioId,
        assetId: cashAsset.id,
        deletedAt: null,
      },
    });

    if (!cashHolding) {
      cashHolding = await tx.holding.create({
        data: {
          portfolioId,
          assetId: cashAsset.id,
          symbol: "CASH",
          quantity: 0,
          avgCostBasis: 1.0,
          currentPrice: 1.0,
          currentValue: 0,
          unrealizedPnL: 0,
          unrealizedPnLPct: 0,
          costCurrency: currency || "INR",
          isManual: true,
        },
      });
    }

    const currentCashQty = new Decimal(cashHolding.quantity.toString());
    const newCashQty = currentCashQty.plus(cashDelta);

    if (newCashQty.lt(0)) {
      throw new InsufficientCashException(
        portfolioId,
        cashDelta.abs().toFixed(2),
        currentCashQty.toFixed(2),
      );
    }

    return tx.holding.update({
      where: { id: cashHolding.id },
      data: {
        quantity: newCashQty.toFixed(8),
        avgCostBasis: "1.00000000",
        currentPrice: "1.00000000",
        currentValue: newCashQty.toFixed(4),
        unrealizedPnL: "0.0000",
        unrealizedPnLPct: "0.0000",
      },
    });
  }
}
