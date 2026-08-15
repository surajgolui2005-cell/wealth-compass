import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, NotImplementedException } from "@nestjs/common";
import { AssetClassCode, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { ValuationEngine } from "../valuation.engine";
import { FifoCalculator } from "../fifo-calculator";
import { WeightedAvgCalculator } from "../weighted-avg-calculator";
import { CurrencyConverterService } from "../currency-converter";
import { PrismaService } from "../../../prisma/prisma.service";
import { MarketDataService } from "../../market-data/services/market-data.service";
import { CalcMethod } from "../interfaces/calculator.interface";
import { PriceQuote } from "../../market-data/interfaces/market-data-provider.interface";

describe("ValuationEngine", () => {
  let engine: ValuationEngine;
  let prisma: any;
  let marketDataService: any;

  beforeEach(async () => {
    prisma = {
      holding: {
        findFirst: jest.fn(),
      },
      portfolio: {
        findFirst: jest.fn(),
      },
    };

    marketDataService = {
      getPrice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValuationEngine,
        FifoCalculator,
        WeightedAvgCalculator,
        CurrencyConverterService,
        { provide: PrismaService, useValue: prisma },
        { provide: MarketDataService, useValue: marketDataService },
      ],
    }).compile();

    engine = module.get<ValuationEngine>(ValuationEngine);
  });

  describe("valuateHolding", () => {
    const mockHolding = {
      id: "holding-infy",
      symbol: "INFY",
      currentPrice: new Decimal("1400.00"),
      portfolio: {
        id: "port-1",
        currency: "INR",
      },
      asset: {
        id: "asset-infy",
        symbol: "INFY",
        assetClass: {
          code: AssetClassCode.STOCKS,
        },
      },
      transactions: [
        {
          id: "tx-1",
          type: TransactionType.BUY,
          quantity: new Decimal("10"),
          pricePerUnit: new Decimal("1000"),
          fees: new Decimal("10"),
          currency: "INR",
          fxRateToHome: new Decimal("1"),
          transactedAt: new Date("2025-01-01"),
        },
        {
          id: "tx-2",
          type: TransactionType.BUY,
          quantity: new Decimal("10"),
          pricePerUnit: new Decimal("1500"),
          fees: new Decimal("20"),
          currency: "INR",
          fxRateToHome: new Decimal("1"),
          transactedAt: new Date("2025-06-01"),
        },
        {
          id: "tx-3",
          type: TransactionType.SELL,
          quantity: new Decimal("5"),
          pricePerUnit: new Decimal("1800"),
          fees: new Decimal("5"),
          currency: "INR",
          fxRateToHome: new Decimal("1"),
          transactedAt: new Date("2026-02-01"),
        },
      ],
    };

    it("evaluates holding with FIFO cost basis and live price quote", async () => {
      prisma.holding.findFirst.mockResolvedValue(mockHolding);

      const liveQuote: PriceQuote = {
        symbol: "INFY",
        price: 2000,
        currency: "INR",
        priceTimestamp: new Date(),
        source: "alpha_vantage",
        isStale: false,
        isMarketClosed: false,
      };
      marketDataService.getPrice.mockResolvedValue(liveQuote);

      const result = await engine.valuateHolding("user-1", "holding-infy", CalcMethod.FIFO);

      // Buy 1: 10 @ 1000 + 10 fees = 10010 (1001/unit)
      // Buy 2: 10 @ 1500 + 20 fees = 15020 (1502/unit)
      // Sell: 5 @ 1800 from Lot 1 (cost 1001/unit)
      // Realized Gain = 5 * (1800 - 1001) = 3995
      // Remaining open: 5 from Lot 1 (cost 5005) + 10 from Lot 2 (cost 15020) = 15 units, Total Cost = 20025
      // Avg Cost Basis = 20025 / 15 = 1335
      // Current Value = 15 * 2000 = 30000
      // Unrealized P&L = 30000 - 20025 = 9975
      // Unrealized % = (9975 / 20025) * 100 = 49.8127%
      expect(result.symbol).toBe("INFY");
      expect(result.openQuantity).toBe("15.00000000");
      expect(result.avgCostBasisPerUnit).toBe("1335.00000000");
      expect(result.totalCostBasis).toBe("20025.0000");
      expect(result.currentPrice).toBe("2000.00000000");
      expect(result.currentValue).toBe("30000.0000");
      expect(result.unrealizedPnL).toBe("9975.0000");
      expect(result.unrealizedPnLPct).toBe("49.8127");
      expect(result.realizedPnL).toBe("3995.0000");
      expect(result.priceSource).toBe("alpha_vantage");
      expect(result.isPriceStale).toBe(false);
      expect(result.totalRealizedGains).toHaveLength(1);
      expect(result.totalRealizedGains[0].isLongTerm).toBe(true); // > 365 days
    });

    it("evaluates holding with Weighted Average cost basis", async () => {
      prisma.holding.findFirst.mockResolvedValue(mockHolding);
      marketDataService.getPrice.mockResolvedValue({
        symbol: "INFY",
        price: 2000,
        currency: "INR",
        priceTimestamp: new Date(),
        source: "alpha_vantage",
      });

      const result = await engine.valuateHolding("user-1", "holding-infy", CalcMethod.AVERAGE_COST);

      // Buy 1: 10 @ 10010
      // Buy 2: 10 @ 15020 -> Total 20 @ 25030 -> Avg Cost = 1251.5
      // Sell 5 @ 1800 -> Realized = 5 * (1800 - 1251.5) = 2742.5
      // Remaining: 15 @ 1251.5 = 18772.5
      // Current Value: 15 * 2000 = 30000
      // Unrealized P&L = 30000 - 18772.5 = 11227.5
      expect(result.openQuantity).toBe("15.00000000");
      expect(result.avgCostBasisPerUnit).toBe("1251.50000000");
      expect(result.totalCostBasis).toBe("18772.5000");
      expect(result.currentValue).toBe("30000.0000");
      expect(result.unrealizedPnL).toBe("11227.5000");
      expect(result.realizedPnL).toBe("2742.5000");
    });

    it("throws NotImplementedException when LIFO method is requested", async () => {
      prisma.holding.findFirst.mockResolvedValue(mockHolding);

      await expect(
        engine.valuateHolding("user-1", "holding-infy", CalcMethod.LIFO),
      ).rejects.toThrow(NotImplementedException);
    });

    it("throws NotFoundException if holding does not exist", async () => {
      prisma.holding.findFirst.mockResolvedValue(null);

      await expect(
        engine.valuateHolding("user-1", "non-existent", CalcMethod.FIFO),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("valuatePortfolio", () => {
    it("evaluates entire multi-asset portfolio with live prices, stale detection, and allocation", async () => {
      const mockPortfolio = {
        id: "port-1",
        name: "Growth Portfolio",
        currency: "INR",
        holdings: [
          {
            id: "h-infy",
            symbol: "INFY",
            currentPrice: new Decimal("1500"),
            asset: {
              symbol: "INFY",
              assetClass: { code: AssetClassCode.STOCKS },
            },
            transactions: [
              {
                id: "tx-1",
                type: TransactionType.BUY,
                quantity: new Decimal("10"),
                pricePerUnit: new Decimal("1000"),
                fees: new Decimal("0"),
                currency: "INR",
                fxRateToHome: new Decimal("1"),
                transactedAt: new Date("2026-01-01"),
              },
            ],
          },
          {
            id: "h-btc",
            symbol: "BTC",
            currentPrice: new Decimal("6000000"),
            asset: {
              symbol: "BTC",
              assetClass: { code: AssetClassCode.CRYPTO },
            },
            transactions: [
              {
                id: "tx-2",
                type: TransactionType.BUY,
                quantity: new Decimal("0.5"),
                pricePerUnit: new Decimal("5000000"),
                fees: new Decimal("0"),
                currency: "INR",
                fxRateToHome: new Decimal("1"),
                transactedAt: new Date("2026-01-01"),
              },
            ],
          },
          {
            id: "h-cash",
            symbol: "CASH",
            currentPrice: new Decimal("1"),
            asset: {
              symbol: "CASH",
              assetClass: { code: AssetClassCode.CASH },
            },
            transactions: [
              {
                id: "tx-3",
                type: TransactionType.DEPOSIT,
                quantity: new Decimal("50000"),
                pricePerUnit: new Decimal("1"),
                fees: new Decimal("0"),
                currency: "INR",
                fxRateToHome: new Decimal("1"),
                transactedAt: new Date("2026-01-01"),
              },
            ],
          },
        ],
      };

      prisma.portfolio.findFirst.mockResolvedValue(mockPortfolio);

      // INFY: live quote 1500 -> Value = 15,000 (Cost = 10,000)
      marketDataService.getPrice.mockImplementation(async (symbol: string) => {
        if (symbol === "INFY") {
          return {
            symbol: "INFY",
            price: 1500,
            currency: "INR",
            source: "alpha_vantage",
            isStale: false,
          };
        }
        if (symbol === "BTC") {
          // BTC: stale quote 7,000,000 -> Value = 3,500,000 (Cost = 2,500,000)
          return {
            symbol: "BTC",
            price: 7000000,
            currency: "INR",
            source: "coingecko:db_fallback",
            isStale: true,
          };
        }
        return null;
      });

      const summary = await engine.valuatePortfolio("user-1", "port-1", CalcMethod.FIFO);

      // Total Cost Basis = 10,000 (INFY) + 2,500,000 (BTC) + 50,000 (CASH) = 2,560,000
      // Total Net Worth = 15,000 (INFY) + 3,500,000 (BTC) + 50,000 (CASH) = 3,565,000
      // Unrealized P&L = 3,565,000 - 2,560,000 = 1,005,000
      // Unrealized % = (1,005,000 / 2,560,000) * 100 = 39.2578%
      expect(summary.portfolioId).toBe("port-1");
      expect(summary.totalCostBasis).toBe("2560000.0000");
      expect(summary.totalNetWorth).toBe("3565000.0000");
      expect(summary.totalUnrealizedPnL).toBe("1005000.0000");
      expect(summary.totalUnrealizedPnLPct).toBe("39.2578");
      expect(summary.positions).toHaveLength(3);

      // Stale symbol tracking
      expect(summary.stalePositions).toEqual(["BTC"]);

      // Asset Allocation
      expect(summary.assetAllocation).toHaveLength(3);
      expect(summary.assetAllocation[0].assetClass).toBe(AssetClassCode.CRYPTO);
      expect(summary.assetAllocation[0].currentValue).toBe("3500000.0000");
      expect(summary.assetAllocation[1].assetClass).toBe(AssetClassCode.CASH);
      expect(summary.assetAllocation[1].currentValue).toBe("50000.0000");
      expect(summary.assetAllocation[2].assetClass).toBe(AssetClassCode.STOCKS);
      expect(summary.assetAllocation[2].currentValue).toBe("15000.0000");
    });

    it("throws NotFoundException if portfolio not found", async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(
        engine.valuatePortfolio("user-1", "invalid-port", CalcMethod.FIFO),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
