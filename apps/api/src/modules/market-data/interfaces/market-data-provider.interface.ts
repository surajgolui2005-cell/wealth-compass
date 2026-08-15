import { AssetClassCode } from "@prisma/client";

/**
 * Canonical price quote returned by every market data provider adapter.
 * All monetary values are in the specified `currency` (default: INR).
 */
export interface PriceQuote {
  /** Normalised uppercase symbol, e.g. "INFY", "BTC", "HDFC0001" */
  symbol: string;
  /** Current/last traded price */
  price: number;
  /** ISO 4217 currency code, e.g. "INR", "USD" */
  currency: string;
  /** Exact UTC timestamp of the price observation */
  priceTimestamp: Date;
  /** Provider name for auditing, e.g. "alpha_vantage", "coingecko" */
  source: string;
  /** OHLCV fields — optional, available for equity/crypto tick data */
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  /** 24-hour trading volume */
  volume?: number;
  /** True when price is from a non-live fallback (DB or cache beyond TTL) */
  isStale?: boolean;
  /** True when the relevant exchange is closed (weekends, holidays) */
  isMarketClosed?: boolean;
  /** Age of this price in seconds at the time of response */
  ageSeconds?: number;
}

/**
 * Result from a batch price fetch. Maps symbol → PriceQuote.
 * Symbols not found in the provider are omitted from the map.
 */
export type BatchPriceResult = Map<string, PriceQuote>;

/**
 * Adapter interface every market data provider must implement.
 * Each adapter is responsible for one data source (e.g. Alpha Vantage, CoinGecko).
 */
export interface MarketDataProvider {
  /** Human-readable provider name used in logging and `PriceQuote.source` */
  getProviderName(): string;

  /** The asset class codes this adapter can serve prices for */
  getSupportedAssetClasses(): AssetClassCode[];

  /**
   * Fetches a single price quote for the given symbol.
   * Throws `ProviderUnavailableException` when circuit is open.
   */
  fetchPrice(symbol: string, currency?: string): Promise<PriceQuote>;

  /**
   * Batch-fetches price quotes. Preferred over repeated single fetches.
   * Missing symbols are silently omitted from the result.
   */
  fetchBatchPrices(symbols: string[], currency?: string): Promise<BatchPriceResult>;

  /**
   * Returns true if the relevant exchange is currently within trading hours.
   * Crypto adapters always return true (24/7 market).
   * Equity adapters check IST 09:15–15:30 Mon–Fri.
   */
  isMarketOpen(): boolean;

  /**
   * Returns the current circuit breaker state for this provider.
   */
  getCircuitState(): CircuitBreakerState;
}

/**
 * Circuit breaker states following the standard finite-state-machine pattern.
 */
export enum CircuitBreakerState {
  /** Normal operation — requests flow through */
  CLOSED = "CLOSED",
  /** Provider is failing — all requests short-circuit to fallback immediately */
  OPEN = "OPEN",
  /** Cooldown elapsed — single probe request allowed to test recovery */
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit breaker configuration injected into each provider adapter.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Milliseconds the circuit stays OPEN before transitioning to HALF_OPEN */
  cooldownMs: number;
  /** Consecutive successes in HALF_OPEN state needed to close the circuit */
  successThreshold: number;
}

/**
 * Exception thrown by provider adapters when the circuit breaker is open
 * or when all retry attempts are exhausted.
 */
export class ProviderUnavailableException extends Error {
  constructor(
    public readonly providerName: string,
    public readonly reason: string,
  ) {
    super(`[${providerName}] Provider unavailable: ${reason}`);
    this.name = "ProviderUnavailableException";
  }
}
