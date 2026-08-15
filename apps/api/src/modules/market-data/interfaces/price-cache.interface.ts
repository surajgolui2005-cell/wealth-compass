import { AssetClassCode } from "@prisma/client";

/**
 * Redis cache key strategy for market prices.
 * All keys are prefixed with `price:v1:` to allow easy bulk invalidation
 * and version-safe key rotation.
 *
 * Key format: `price:v1:{SYMBOL}`
 * Example:    `price:v1:BTC`, `price:v1:INFY`, `price:v1:HDFC0001`
 */
export const PRICE_CACHE_KEY_PREFIX = "price:v1:";

/**
 * Builds the Redis key for a given symbol.
 */
export const buildPriceCacheKey = (symbol: string): string =>
  `${PRICE_CACHE_KEY_PREFIX}${symbol.toUpperCase()}`;

/**
 * Builds the Redis key for the price metadata (staleness tracking).
 * Stored as a separate key to avoid deserialising the full PriceQuote for staleness checks.
 */
export const buildPriceMetaKey = (symbol: string): string =>
  `${PRICE_CACHE_KEY_PREFIX}${symbol.toUpperCase()}:meta`;

/**
 * Cache TTL constants (in seconds).
 *
 * Design rationale:
 * - Traded assets (STOCKS, CRYPTO, ETFS, MUTUAL_FUNDS) use a short TTL (5 min)
 *   during active market hours to surface near-real-time prices.
 * - Non-traded / slow-moving assets (BONDS, FIXED_DEPOSITS, REAL_ESTATE, CASH)
 *   use a 24-hour TTL because their valuations change infrequently or are
 *   manually entered.
 * - After market close, equity TTL extends to 24 hours to avoid redundant
 *   external API calls overnight.
 */
export const CACHE_TTL = {
  /** 5 minutes — active equities, crypto, ETFs during market hours */
  ACTIVE_MARKET_SECONDS: 5 * 60,
  /** 24 hours — bonds, FDs, real estate, cash, and any equity after market close */
  NON_TRADED_SECONDS: 24 * 60 * 60,
  /** 15 minutes — mutual fund NAVs (EOD update, short window after 21:30 IST) */
  MUTUAL_FUND_NAV_SECONDS: 15 * 60,
  /** 6 hours — FX rates (Open Exchange Rates updates hourly in Pro, daily in Free) */
  FX_RATE_SECONDS: 6 * 60 * 60,
} as const;

/**
 * Staleness thresholds (in seconds). Prices older than these values are
 * considered stale and trigger the `isStale: true` flag in PriceQuote.
 * These are intentionally looser than TTLs to account for brief API outages.
 */
export const STALENESS_THRESHOLD = {
  /** 15 minutes — equity/crypto stale if no fresh price within 15 min of market hours */
  ACTIVE_MARKET_SECONDS: 15 * 60,
  /** 48 hours — bonds/FDs stale if unchanged for 2 days */
  NON_TRADED_SECONDS: 48 * 60 * 60,
} as const;

/**
 * Asset class TTL classification.
 * Maps each AssetClassCode to the appropriate cache TTL bucket.
 */
export const ASSET_CLASS_TTL_MAP: Record<AssetClassCode, keyof typeof CACHE_TTL> = {
  [AssetClassCode.STOCKS]: "ACTIVE_MARKET_SECONDS",
  [AssetClassCode.ETFS]: "ACTIVE_MARKET_SECONDS",
  [AssetClassCode.CRYPTO]: "ACTIVE_MARKET_SECONDS",
  [AssetClassCode.MUTUAL_FUNDS]: "MUTUAL_FUND_NAV_SECONDS",
  [AssetClassCode.BONDS]: "NON_TRADED_SECONDS",
  [AssetClassCode.FIXED_DEPOSITS]: "NON_TRADED_SECONDS",
  [AssetClassCode.REAL_ESTATE]: "NON_TRADED_SECONDS",
  [AssetClassCode.CASH]: "NON_TRADED_SECONDS",
};

/**
 * Resolves the appropriate TTL (seconds) for a given asset class.
 * During active market hours equities use ACTIVE_MARKET_SECONDS.
 * After market close they fall back to NON_TRADED_SECONDS.
 */
export function resolveTtlForAssetClass(assetClass: AssetClassCode, isMarketOpen: boolean): number {
  const bucket = ASSET_CLASS_TTL_MAP[assetClass] ?? "ACTIVE_MARKET_SECONDS";

  // Extend TTL for equities/ETFs when market is closed to avoid redundant calls
  if (
    !isMarketOpen &&
    (assetClass === AssetClassCode.STOCKS || assetClass === AssetClassCode.ETFS)
  ) {
    return CACHE_TTL.NON_TRADED_SECONDS;
  }

  return CACHE_TTL[bucket];
}

/**
 * Serialized form stored in Redis.
 * PriceQuote is stored as a JSON string.
 */
export interface CachedPriceEntry {
  symbol: string;
  price: number;
  currency: string;
  priceTimestamp: string; // ISO 8601 string
  source: string;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  volume?: number;
  cachedAt: string; // ISO 8601 — when this entry was written to Redis
}

/**
 * Metadata key schema stored alongside each cached price entry.
 * Used for quick staleness probes without deserialising the full PriceQuote.
 */
export interface PriceCacheMetadata {
  symbol: string;
  cachedAt: string;
  ageSeconds: number;
  ttlSeconds: number;
  source: string;
}

/** BullMQ queue name for all market data jobs */
export const MARKET_DATA_QUEUE = "market-data";

/** BullMQ job name constants */
export const MARKET_DATA_JOBS = {
  FETCH_CRYPTO_PRICES: "fetch-crypto-prices",
  FETCH_EQUITY_PRICES: "fetch-equity-prices",
  FETCH_MF_NAV: "fetch-mf-nav",
  FETCH_SINGLE_PRICE: "fetch-single-price",
} as const;
