import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface CurrencyAmount {
  amount: Decimal;
  /** ISO 4217 currency code (e.g. "USD", "EUR", "INR") */
  currency: string;
  /**
   * Historical FX rate stored at transaction time.
   * Semantics: 1 unit of `currency` = `fxRateToHome` units of `homeCurrency`.
   * e.g. If homeCurrency = "INR" and currency = "USD", fxRateToHome ≈ 83.5
   */
  fxRateToHome: Decimal;
}

/**
 * Deterministic multi-currency converter for the valuation engine.
 *
 * Design principles:
 *  - Uses the FX rate stored at transaction time (historical rate), NOT a live rate.
 *    This guarantees deterministic, reproducible P&L calculations.
 *  - For the home currency itself (e.g. INR → INR), returns the amount unchanged.
 *  - All arithmetic is Decimal.js — zero floating-point error.
 *
 * Future enhancement: a separate live-rate lookup can be layered on top
 * for unrealized P&L denominated in a foreign currency — but cost basis
 * and realized P&L always use the historical rate by convention.
 */
@Injectable()
export class CurrencyConverterService {
  /**
   * Converts a monetary amount from a source currency to the home currency
   * using the historically stored FX rate.
   *
   * @param amount       — Monetary value in the source currency
   * @param currency     — Source currency code (e.g. "USD")
   * @param fxRateToHome — Historical exchange rate (stored on the Transaction row)
   * @param homeCurrency — Portfolio's base currency (default: "INR")
   * @returns Amount converted to home currency, full Decimal precision.
   *
   * @example
   * // 100 USD * 83.50 = INR 8350.00
   * converter.convertToHome(new Decimal(100), 'USD', new Decimal('83.50'))
   */
  convertToHome(
    amount: Decimal,
    currency: string,
    fxRateToHome: Decimal,
    homeCurrency = "INR",
  ): Decimal {
    if (currency.toUpperCase() === homeCurrency.toUpperCase()) {
      // Same currency — no conversion needed
      return amount;
    }
    return amount.times(fxRateToHome);
  }

  /**
   * Converts and sums a heterogeneous batch of currency amounts to the home currency.
   * Uses a single Decimal.js reduce — zero intermediate JS number coercion.
   *
   * @param amounts      — Array of CurrencyAmount (may contain mixed currencies)
   * @param homeCurrency — Portfolio base currency (default: "INR")
   * @returns Single Decimal total in home currency.
   */
  sumInHome(amounts: CurrencyAmount[], homeCurrency = "INR"): Decimal {
    return amounts.reduce(
      (sum, item) =>
        sum.plus(this.convertToHome(item.amount, item.currency, item.fxRateToHome, homeCurrency)),
      new Decimal(0),
    );
  }

  /**
   * Returns the effective FX rate for a given currency pair.
   * If the source equals home, returns 1.0 (identity rate).
   *
   * Useful for displaying the rate used in valuation reports.
   */
  getEffectiveRate(currency: string, fxRateToHome: Decimal, homeCurrency = "INR"): Decimal {
    if (currency.toUpperCase() === homeCurrency.toUpperCase()) {
      return new Decimal(1);
    }
    return fxRateToHome;
  }
}
