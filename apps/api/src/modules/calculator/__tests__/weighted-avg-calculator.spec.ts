import Decimal from "decimal.js";
import { TransactionType } from "@prisma/client";
import { WeightedAvgCalculator } from "../weighted-avg-calculator";
import { TxLot } from "../interfaces/calculator.interface";

describe("WeightedAvgCalculator", () => {
  let calculator: WeightedAvgCalculator;

  beforeEach(() => {
    calculator = new WeightedAvgCalculator();
  });

  const createTxLot = (partial: Partial<TxLot>): TxLot => ({
    id: partial.id || "tx-" + Math.random().toString(36).substring(2, 9),
    type: partial.type || TransactionType.BUY,
    quantity: partial.quantity || new Decimal(10),
    pricePerUnit: partial.pricePerUnit || new Decimal(100),
    fees: partial.fees || new Decimal(0),
    currency: partial.currency || "INR",
    fxRateToHome: partial.fxRateToHome || new Decimal(1),
    transactedAt: partial.transactedAt || new Date("2026-01-01"),
    splitRatio: partial.splitRatio,
  });

  describe("Weighted Average Cost Calculations", () => {
    it("calculates weighted average cost basis across multiple BUYs", () => {
      // Buy 1: 10 units @ 100 + 10 fees = 1010
      // Buy 2: 20 units @ 160 + 20 fees = 3220
      // Total Qty = 30, Total Cost = 4230
      // Avg Cost = 4230 / 30 = 141
      const lots: TxLot[] = [
        createTxLot({
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(100),
          fees: new Decimal(10),
        }),
        createTxLot({
          quantity: new Decimal(20),
          pricePerUnit: new Decimal(160),
          fees: new Decimal(20),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("30");
      expect(result.totalCostBasis.toString()).toBe("4230");
      expect(result.avgCostBasisPerUnit.toString()).toBe("141");
      expect(result.totalRealizedPnL.toString()).toBe("0");
    });

    it("preserves unit average cost basis on partial SELL and computes realized P&L", () => {
      // 30 units @ avg cost 141 (Total 4230)
      // SELL: 10 units @ 200
      // Realized Gain = (200 - 141) * 10 = 590
      // Remaining = 20 units @ avg cost 141 = 2820
      const lots: TxLot[] = [
        createTxLot({
          type: TransactionType.BUY,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(100),
          fees: new Decimal(10),
        }),
        createTxLot({
          type: TransactionType.BUY,
          quantity: new Decimal(20),
          pricePerUnit: new Decimal(160),
          fees: new Decimal(20),
        }),
        createTxLot({
          id: "sell-1",
          type: TransactionType.SELL,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(200),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("20");
      expect(result.avgCostBasisPerUnit.toString()).toBe("141");
      expect(result.totalCostBasis.toString()).toBe("2820");
      expect(result.totalRealizedPnL.toString()).toBe("590");
      expect(result.realizedGainRecords).toHaveLength(1);
      expect(result.realizedGainRecords[0].costBasisPerUnit.toString()).toBe("141");
      expect(result.realizedGainRecords[0].realizedGainLoss.toString()).toBe("590");
    });

    it("resets cost basis to 0 when entire position is SOLD", () => {
      const lots: TxLot[] = [
        createTxLot({
          type: TransactionType.BUY,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(100),
        }),
        createTxLot({
          type: TransactionType.SELL,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(150),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("0");
      expect(result.avgCostBasisPerUnit.toString()).toBe("0");
      expect(result.totalCostBasis.toString()).toBe("0");
      expect(result.totalRealizedPnL.toString()).toBe("500");
    });
  });

  describe("Corporate Actions", () => {
    it("adjusts quantity and average cost on stock split", () => {
      // 10 units @ 100 = 1000
      // 5-for-1 split -> 50 units @ 20 = 1000
      const lots: TxLot[] = [
        createTxLot({
          type: TransactionType.BUY,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(100),
        }),
        createTxLot({
          type: TransactionType.SPLIT,
          quantity: new Decimal(5),
          splitRatio: new Decimal(5),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("50");
      expect(result.avgCostBasisPerUnit.toString()).toBe("20");
      expect(result.totalCostBasis.toString()).toBe("1000");
    });

    it("dilutes average cost basis on BONUS share issuance", () => {
      // 100 units @ 60 = 6000
      // Bonus: 50 units @ 0 = 0
      // Total Qty = 150, Total Cost = 6000, Avg Cost = 6000 / 150 = 40
      const lots: TxLot[] = [
        createTxLot({
          type: TransactionType.BUY,
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(60),
        }),
        createTxLot({
          type: TransactionType.BONUS,
          quantity: new Decimal(50),
          pricePerUnit: new Decimal(0),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("150");
      expect(result.avgCostBasisPerUnit.toString()).toBe("40");
      expect(result.totalCostBasis.toString()).toBe("6000");
    });
  });

  describe("Multi-Currency & High Precision", () => {
    it("correctly handles multi-currency transactions with historical FX rates", () => {
      // Buy 10 @ $50 FX 80 = ₹40,000 (Cost basis = ₹4,000)
      // Buy 10 @ $60 FX 85 = ₹51,000 (Total cost = ₹91,000 / 20 = ₹4,550)
      const lots: TxLot[] = [
        createTxLot({
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(50),
          currency: "USD",
          fxRateToHome: new Decimal(80),
        }),
        createTxLot({
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(60),
          currency: "USD",
          fxRateToHome: new Decimal(85),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("20");
      expect(result.totalCostBasis.toString()).toBe("91000");
      expect(result.avgCostBasisPerUnit.toString()).toBe("4550");
    });

    it("verifies 10,000 transactions aggregation without drift", () => {
      const lots: TxLot[] = [];
      const qty = new Decimal("0.0054321");
      const price = new Decimal("1234.5678");
      const fee = new Decimal("0.05");

      const N = 10000;
      for (let i = 0; i < N; i++) {
        lots.push(createTxLot({ quantity: qty, pricePerUnit: price, fees: fee }));
      }

      const result = calculator.calculate(lots);

      const expectedTotalQty = qty.times(N);
      const expectedTotalCost = qty.times(price).plus(fee).times(N);
      const expectedAvgCost = expectedTotalCost.div(expectedTotalQty);

      expect(result.openQuantity.equals(expectedTotalQty)).toBe(true);
      expect(result.totalCostBasis.equals(expectedTotalCost)).toBe(true);
      expect(result.avgCostBasisPerUnit.equals(expectedAvgCost)).toBe(true);
    });
  });
});
