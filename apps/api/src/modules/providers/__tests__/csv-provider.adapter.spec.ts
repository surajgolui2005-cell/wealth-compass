import { TransactionType } from "@prisma/client";
import { CsvProviderAdapter } from "../adapters/csv-provider.adapter";

describe("CsvProviderAdapter", () => {
  let adapter: CsvProviderAdapter;

  beforeEach(() => {
    adapter = new CsvProviderAdapter();
  });

  it("should be defined", () => {
    expect(adapter).toBeDefined();
  });

  describe("parseCsvContent", () => {
    it("should parse standard CSV format correctly", () => {
      const csv = `Symbol,Date,Type,Quantity,Price,Fees\nRELIANCE,2026-01-15,BUY,10,2450.50,12.50\nTCS,2026-02-01,SELL,5,3800.00,10.00`;

      const result = adapter.parseCsvContent(csv);

      expect(result.totalRowsParsed).toBe(2);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].symbol).toBe("RELIANCE");
      expect(result.transactions[0].type).toBe(TransactionType.BUY);
      expect(result.transactions[0].quantity).toBe(10);
      expect(result.transactions[0].pricePerUnit).toBe(2450.5);
      expect(result.transactions[0].fees).toBe(12.5);

      expect(result.transactions[1].symbol).toBe("TCS");
      expect(result.transactions[1].type).toBe(TransactionType.SELL);
      expect(result.transactions[1].quantity).toBe(5);
    });

    it("should match alias column headers (Ticker, Trade Date, Action, Shares, Rate, Commission)", () => {
      const csv = `Ticker,Trade Date,Action,Shares,Rate,Commission\nINFY,15/01/2026,BOUGHT,25,1600.00,15.00\nWIPRO,20/01/2026,DIVIDEND,25,12.00,0`;

      const result = adapter.parseCsvContent(csv);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].symbol).toBe("INFY");
      expect(result.transactions[0].type).toBe(TransactionType.BUY);
      expect(result.transactions[0].quantity).toBe(25);
      expect(result.transactions[0].pricePerUnit).toBe(1600);

      expect(result.transactions[1].symbol).toBe("WIPRO");
      expect(result.transactions[1].type).toBe(TransactionType.DIVIDEND);
    });

    it("should handle custom column header mappings", () => {
      const csv = `CustomSym,CustomDt,CustomAct,CustomQty,CustomPx\nBTC,2026-03-01,BUY,0.5,4500000`;

      const result = adapter.parseCsvContent(csv, {
        symbolHeader: "CustomSym",
        dateHeader: "CustomDt",
        typeHeader: "CustomAct",
        quantityHeader: "CustomQty",
        priceHeader: "CustomPx",
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].symbol).toBe("BTC");
      expect(result.transactions[0].quantity).toBe(0.5);
      expect(result.transactions[0].pricePerUnit).toBe(4500000);
    });

    it("should parse real-life broker statement with client metadata and summary headers (Groww / Angel One)", () => {
      const growwCsv = `Name,Krishna Dolai,,,,,,
Unique Client Code,2774408925,,,,,,
,,,,,,
Holdings statement for stocks as on 11-09-2026,,,,,,,
,,,,,,
Summary,,,,,,,
Invested Value, 2257.22,,,,,,,
Current Value, 2600.50,,,,,,,
Total P&L, 343.28,,,,,,,
,,,,,,
Stock name, Symbol, ISIN, Quantity, Avg cost price, LTP, Cur value, P&L, % P&L
Tata Motors Ltd, TATAMOTORS, INE155A01022, 10, 950.00, 1020.00, 10200.00, 700.00, 7.37
State Bank of India, SBIN, INE062A01020, 15, 780.00, 815.00, 12225.00, 525.00, 4.49
ITC Ltd, ITC, INE154A01025, 20, 420.00, 450.00, 9000.00, 600.00, 7.14
Total, 3 stocks,, 45,, 31425.00, 1825.00, 6.17`;

      const result = adapter.parseCsvContent(growwCsv);

      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].symbol).toBe("TATAMOTORS");
      expect(result.transactions[0].quantity).toBe(10);
      expect(result.transactions[0].pricePerUnit).toBe(950);

      expect(result.transactions[1].symbol).toBe("SBIN");
      expect(result.transactions[1].quantity).toBe(15);
      expect(result.transactions[1].pricePerUnit).toBe(780);

      expect(result.transactions[2].symbol).toBe("ITC");
      expect(result.transactions[2].quantity).toBe(20);
      expect(result.transactions[2].pricePerUnit).toBe(420);
    });

    it("should return error for empty CSV string", () => {
      const result = adapter.parseCsvContent("");
      expect(result.errors).toContain("CSV file contains no data rows.");
    });
  });
});
