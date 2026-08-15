import Decimal from "decimal.js";
import { TransactionType } from "@prisma/client";
import { FifoCalculator } from "../fifo-calculator";
import { TxLot } from "../interfaces/calculator.interface";

describe("FifoCalculator", () => {
  let calculator: FifoCalculator;

  beforeEach(() => {
    calculator = new FifoCalculator();
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

  describe("Basic Buy and Sell Cycles", () => {
    it("calculates cost basis for a single BUY", () => {
      const lots: TxLot[] = [
        createTxLot({
          quantity: new Decimal("10.00000000"),
          pricePerUnit: new Decimal("150.00000000"),
          fees: new Decimal("10.0000"),
        }),
      ];

      const result = calculator.calculate(lots);

      // Total cost = (10 * 150) + 10 = 1510
      // avgCostBasis = 1510 / 10 = 151
      expect(result.openQuantity.toString()).toBe("10");
      expect(result.avgCostBasisPerUnit.toString()).toBe("151");
      expect(result.totalCostBasis.toString()).toBe("1510");
      expect(result.totalRealizedPnL.toString()).toBe("0");
      expect(result.realizedGainRecords).toHaveLength(0);
    });

    it("calculates realized P&L on a full SELL (clearing position to 0)", () => {
      const lots: TxLot[] = [
        createTxLot({
          id: "buy-1",
          type: TransactionType.BUY,
          quantity: new Decimal("10.00000000"),
          pricePerUnit: new Decimal("100.00000000"),
          fees: new Decimal("0"),
          transactedAt: new Date("2025-01-01"),
        }),
        createTxLot({
          id: "sell-1",
          type: TransactionType.SELL,
          quantity: new Decimal("10.00000000"),
          pricePerUnit: new Decimal("150.00000000"),
          fees: new Decimal("0"),
          transactedAt: new Date("2026-02-01"),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("0");
      expect(result.avgCostBasisPerUnit.toString()).toBe("0");
      expect(result.totalCostBasis.toString()).toBe("0");
      // Realized gain = (150 - 100) * 10 = 500
      expect(result.totalRealizedPnL.toString()).toBe("500");
      expect(result.realizedGainRecords).toHaveLength(1);
      expect(result.realizedGainRecords[0].buyTransactionId).toBe("buy-1");
      expect(result.realizedGainRecords[0].sellTransactionId).toBe("sell-1");
      expect(result.realizedGainRecords[0].isLongTerm).toBe(true); // > 365 days
      expect(result.realizedGainRecords[0].holdingPeriodDays).toBeGreaterThan(365);
    });

    it("handles partial SELL draining the first lot partially", () => {
      const lots: TxLot[] = [
        createTxLot({
          id: "buy-1",
          type: TransactionType.BUY,
          quantity: new Decimal("100.00000000"),
          pricePerUnit: new Decimal("50.00000000"),
          transactedAt: new Date("2026-01-01"),
        }),
        createTxLot({
          id: "sell-1",
          type: TransactionType.SELL,
          quantity: new Decimal("40.00000000"),
          pricePerUnit: new Decimal("75.00000000"),
          transactedAt: new Date("2026-03-01"),
        }),
      ];

      const result = calculator.calculate(lots);

      // Remaining = 60 @ 50 = 3000
      expect(result.openQuantity.toString()).toBe("60");
      expect(result.avgCostBasisPerUnit.toString()).toBe("50");
      expect(result.totalCostBasis.toString()).toBe("3000");
      // Realized gain = (75 - 50) * 40 = 1000
      expect(result.totalRealizedPnL.toString()).toBe("1000");
      expect(result.realizedGainRecords).toHaveLength(1);
      expect(result.realizedGainRecords[0].quantityMatched.toString()).toBe("40");
      expect(result.realizedGainRecords[0].isLongTerm).toBe(false); // < 365 days
    });
  });

  describe("Multi-Lot FIFO Matching", () => {
    it("matches SELL across multiple BUY lots in FIFO order", () => {
      // Lot 1: 10 units @ 100 on 2025-01-01 (Total: 1000)
      // Lot 2: 20 units @ 150 on 2025-06-01 (Total: 3000)
      // Lot 3: 30 units @ 200 on 2026-01-01 (Total: 6000)
      // SELL: 25 units @ 250 on 2026-02-01
      // Matches:
      // - 10 units from Lot 1 @ 100 -> Gain = (250 - 100) * 10 = 1500 (LTCG > 365d)
      // - 15 units from Lot 2 @ 150 -> Gain = (250 - 150) * 15 = 1500 (Short/Long depending on days)
      // Total Realized = 3000
      // Remaining:
      // - 5 units from Lot 2 @ 150 = 750
      // - 30 units from Lot 3 @ 200 = 6000
      // Open Qty = 35, Total Cost = 6750, Avg Cost = 6750 / 35 = 192.8571428571428571428571429
      const lots: TxLot[] = [
        createTxLot({
          id: "buy-1",
          type: TransactionType.BUY,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(100),
          transactedAt: new Date("2025-01-01"),
        }),
        createTxLot({
          id: "buy-2",
          type: TransactionType.BUY,
          quantity: new Decimal(20),
          pricePerUnit: new Decimal(150),
          transactedAt: new Date("2025-06-01"),
        }),
        createTxLot({
          id: "buy-3",
          type: TransactionType.BUY,
          quantity: new Decimal(30),
          pricePerUnit: new Decimal(200),
          transactedAt: new Date("2026-01-01"),
        }),
        createTxLot({
          id: "sell-1",
          type: TransactionType.SELL,
          quantity: new Decimal(25),
          pricePerUnit: new Decimal(250),
          transactedAt: new Date("2026-02-01"),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("35");
      expect(result.totalCostBasis.toString()).toBe("6750");
      expect(result.avgCostBasisPerUnit.toFixed(4)).toBe("192.8571");
      expect(result.totalRealizedPnL.toString()).toBe("3000");
      expect(result.realizedGainRecords).toHaveLength(2);

      expect(result.realizedGainRecords[0].buyTransactionId).toBe("buy-1");
      expect(result.realizedGainRecords[0].quantityMatched.toString()).toBe("10");
      expect(result.realizedGainRecords[0].realizedGainLoss.toString()).toBe("1500");
      expect(result.realizedGainRecords[0].isLongTerm).toBe(true);

      expect(result.realizedGainRecords[1].buyTransactionId).toBe("buy-2");
      expect(result.realizedGainRecords[1].quantityMatched.toString()).toBe("15");
      expect(result.realizedGainRecords[1].realizedGainLoss.toString()).toBe("1500");
    });
  });

  describe("Corporate Actions (SPLIT & BONUS)", () => {
    it("adjusts open lots on 2-for-1 Stock Split proportionally", () => {
      // Buy 10 @ 100 (Total 1000)
      // Buy 20 @ 200 (Total 4000)
      // SPLIT 2:1 -> Lot 1: 20 @ 50 (Total 1000), Lot 2: 40 @ 100 (Total 4000)
      // Total Open = 60, Total Cost = 5000, Avg = 5000/60 = 83.33333333333333333333333333
      const lots: TxLot[] = [
        createTxLot({
          id: "buy-1",
          type: TransactionType.BUY,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(100),
        }),
        createTxLot({
          id: "buy-2",
          type: TransactionType.BUY,
          quantity: new Decimal(20),
          pricePerUnit: new Decimal(200),
        }),
        createTxLot({
          type: TransactionType.SPLIT,
          quantity: new Decimal(2),
          splitRatio: new Decimal(2),
          pricePerUnit: new Decimal(0),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("60");
      expect(result.totalCostBasis.toString()).toBe("5000");
      expect(result.avgCostBasisPerUnit.toFixed(4)).toBe("83.3333");
    });

    it("correctly allocates BONUS shares with zero cost basis and dilutes average cost", () => {
      // Buy 100 @ 50 (Total: 5000)
      // Bonus: 100 shares (1:1) with price 0
      // Total Open = 200, Total Cost = 5000, Avg Cost = 5000 / 200 = 25
      const lots: TxLot[] = [
        createTxLot({
          id: "buy-1",
          type: TransactionType.BUY,
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(50),
        }),
        createTxLot({
          id: "bonus-1",
          type: TransactionType.BONUS,
          quantity: new Decimal(100),
          pricePerUnit: new Decimal(0),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("200");
      expect(result.totalCostBasis.toString()).toBe("5000");
      expect(result.avgCostBasisPerUnit.toString()).toBe("25");
    });
  });

  describe("Multi-Currency FX Rates", () => {
    it("computes home currency cost basis and realized gain with FX rates", () => {
      // USD Buy: 10 shares @ $100 with FX 80 -> 10 shares @ ₹8,000 cost basis per share (Total ₹80,000)
      // USD Sell: 5 shares @ $120 with FX 82 -> 5 shares @ ₹9,840 proceeds per share
      // Realized gain = 5 * (9,840 - 8,000) = ₹9,200
      // Open position = 5 shares @ ₹8,000 = ₹40,000
      const lots: TxLot[] = [
        createTxLot({
          id: "buy-usd",
          type: TransactionType.BUY,
          quantity: new Decimal(10),
          pricePerUnit: new Decimal(100),
          currency: "USD",
          fxRateToHome: new Decimal(80),
          transactedAt: new Date("2026-01-01"),
        }),
        createTxLot({
          id: "sell-usd",
          type: TransactionType.SELL,
          quantity: new Decimal(5),
          pricePerUnit: new Decimal(120),
          currency: "USD",
          fxRateToHome: new Decimal(82),
          transactedAt: new Date("2026-03-01"),
        }),
      ];

      const result = calculator.calculate(lots);

      expect(result.openQuantity.toString()).toBe("5");
      expect(result.avgCostBasisPerUnit.toString()).toBe("8000");
      expect(result.totalCostBasis.toString()).toBe("40000");
      expect(result.totalRealizedPnL.toString()).toBe("9200");
    });
  });

  describe("Mathematical Exactness & Zero Floating-Point Drift", () => {
    it("aggregates 10,000 micro-transactions with zero floating point drift", () => {
      const lots: TxLot[] = [];
      const qtyPerTx = new Decimal("0.00012345");
      const pricePerTx = new Decimal("87654.321");
      const feePerTx = new Decimal("0.0123");

      const N = 10000;
      for (let i = 0; i < N; i++) {
        lots.push(
          createTxLot({
            type: TransactionType.BUY,
            quantity: qtyPerTx,
            pricePerUnit: pricePerTx,
            fees: feePerTx,
          }),
        );
      }

      const result = calculator.calculate(lots);

      const expectedTotalQty = qtyPerTx.times(N);
      const expectedTotalCost = qtyPerTx.times(pricePerTx).plus(feePerTx).times(N);
      const expectedAvgCost = expectedTotalCost.div(expectedTotalQty);

      expect(result.openQuantity.equals(expectedTotalQty)).toBe(true);
      expect(result.totalCostBasis.equals(expectedTotalCost)).toBe(true);
      expect(result.avgCostBasisPerUnit.equals(expectedAvgCost)).toBe(true);
      // Double check exact string representations
      expect(result.openQuantity.toString()).toBe("1.2345");
    });
  });
});
