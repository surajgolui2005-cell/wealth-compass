import Decimal from "decimal.js";
import { CurrencyConverterService } from "../currency-converter";

describe("CurrencyConverterService", () => {
  let converter: CurrencyConverterService;

  beforeEach(() => {
    converter = new CurrencyConverterService();
  });

  describe("convertToHome", () => {
    it("bypasses conversion if currency matches home currency", () => {
      const amount = new Decimal("5000.50");
      const result = converter.convertToHome(amount, "INR", new Decimal("83.5"), "INR");

      expect(result.toString()).toBe("5000.5");
    });

    it("converts foreign currency amount using fxRateToHome", () => {
      const amount = new Decimal("100.00"); // $100
      const fxRate = new Decimal("83.5432");
      const result = converter.convertToHome(amount, "USD", fxRate, "INR");

      expect(result.toString()).toBe("8354.32");
    });
  });

  describe("sumInHome", () => {
    it("aggregates mixed currency amounts into single home currency total", () => {
      const items = [
        { amount: new Decimal("1000"), currency: "INR", fxRateToHome: new Decimal("1") },
        { amount: new Decimal("100"), currency: "USD", fxRateToHome: new Decimal("80") }, // 8000
        { amount: new Decimal("50"), currency: "EUR", fxRateToHome: new Decimal("90") }, // 4500
      ];

      const total = converter.sumInHome(items, "INR");

      // 1000 + 8000 + 4500 = 13500
      expect(total.toString()).toBe("13500");
    });
  });

  describe("getEffectiveRate", () => {
    it("returns 1 for home currency and fxRate for foreign", () => {
      expect(converter.getEffectiveRate("INR", new Decimal("80"), "INR").toString()).toBe("1");
      expect(converter.getEffectiveRate("USD", new Decimal("80"), "INR").toString()).toBe("80");
    });
  });
});
