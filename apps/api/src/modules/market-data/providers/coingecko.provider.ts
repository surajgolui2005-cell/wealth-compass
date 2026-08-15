import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, AxiosError } from "axios";
import { AssetClassCode } from "@prisma/client";
import {
  MarketDataProvider,
  PriceQuote,
  BatchPriceResult,
  CircuitBreakerState,
  CircuitBreakerConfig,
  ProviderUnavailableException,
} from "../interfaces/market-data-provider.interface";

/**
 * CoinGecko API response shape for /simple/price endpoint.
 * Example: { bitcoin: { inr: 6800000, usd: 81000, inr_24h_vol: 120000000 } }
 */
type CoinGeckoPriceResponse = Record<
  string,
  { inr?: number; usd?: number; inr_24h_vol?: number; usd_24h_vol?: number }
>;

/**
 * Mapping of common crypto symbols to their CoinGecko coin IDs.
 * CoinGecko's /simple/price endpoint requires coin IDs, not ticker symbols.
 * Extend this map as new assets are added.
 */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  ADA: "cardano",
  XRP: "ripple",
  DOT: "polkadot",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  POL: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ALGO: "algorand",
  XLM: "stellar",
  VET: "vechain",
  FIL: "filecoin",
  NEAR: "near",
  SHIB: "shiba-inu",
  TRX: "tron",
  FTM: "fantom",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AAVE: "aave",
  CRO: "crypto-com-chain",
  USDT: "tether",
  USDC: "usd-coin",
  BUSD: "binance-usd",
};

/**
 * CoinGecko market data adapter.
 *
 * Provides crypto asset prices via CoinGecko Simple Price API.
 * Supports INR and USD simultaneously per request — no separate FX conversion needed.
 * Max 250 coin IDs per request (free tier: ~10–30 req/min, Pro: 500/min).
 *
 * Circuit breaker FSM identical to AlphaVantageProvider:
 *   CLOSED → (3 failures) → OPEN → (30s cooldown) → HALF_OPEN → (1 success) → CLOSED
 *
 * Crypto is 24/7 — isMarketOpen() always returns true.
 */
@Injectable()
export class CoinGeckoProvider implements MarketDataProvider {
  private readonly logger = new Logger(CoinGeckoProvider.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.coingecko.com/api/v3";

  // ── Circuit Breaker State ──────────────────────────────────────────────────
  private circuitState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private circuitOpenedAt: number | null = null;

  private readonly cbConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    cooldownMs: 30_000,
    successThreshold: 1,
  };

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("COINGECKO_API_KEY", "");
    const headers: Record<string, string> = { "User-Agent": "investor-pm/1.0" };
    if (this.apiKey) {
      headers["x-cg-demo-api-key"] = this.apiKey;
    }
    this.http = axios.create({ timeout: 10_000, headers });
  }

  getProviderName(): string {
    return "coingecko";
  }

  getSupportedAssetClasses(): AssetClassCode[] {
    return [AssetClassCode.CRYPTO];
  }

  getCircuitState(): CircuitBreakerState {
    return this.circuitState;
  }

  /** Crypto never closes — returns true 24/7 */
  isMarketOpen(): boolean {
    return true;
  }

  async fetchPrice(symbol: string, currency = "INR"): Promise<PriceQuote> {
    const batchResult = await this.fetchBatchPrices([symbol], currency);
    const quote = batchResult.get(symbol.toUpperCase());
    if (!quote) {
      throw new Error(`CoinGecko returned no data for symbol "${symbol}"`);
    }
    return quote;
  }

  async fetchBatchPrices(symbols: string[], currency = "INR"): Promise<BatchPriceResult> {
    if (symbols.length === 0) return new Map();

    this.checkCircuit();

    // Map symbols → CoinGecko IDs, skipping unknown symbols with a warning
    const coinIdMap: Record<string, string> = {}; // coinId → originalSymbol
    const unknownSymbols: string[] = [];

    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const coinId = SYMBOL_TO_COINGECKO_ID[upper];
      if (coinId) {
        coinIdMap[coinId] = upper;
      } else {
        unknownSymbols.push(upper);
      }
    }

    if (unknownSymbols.length > 0) {
      this.logger.warn(
        `CoinGecko: No coin ID mapping for symbols: ${unknownSymbols.join(", ")} — skipping`,
      );
    }

    const coinIds = Object.keys(coinIdMap);
    if (coinIds.length === 0) return new Map();

    try {
      const result = await this.fetchWithRetry(coinIds);
      this.recordSuccess();
      return this.mapToQuotes(result, coinIdMap);
    } catch (err: any) {
      this.recordFailure(err);
      throw err;
    }
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async fetchWithRetry(coinIds: string[]): Promise<CoinGeckoPriceResponse> {
    const maxAttempts = 3;
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.http.get<CoinGeckoPriceResponse>(
          `${this.baseUrl}/simple/price`,
          {
            params: {
              ids: coinIds.join(","),
              vs_currencies: "inr,usd",
              include_24hr_vol: true,
              precision: 8,
            },
          },
        );
        return response.data;
      } catch (err: any) {
        lastError = err;
        const status = (err as AxiosError)?.response?.status;
        const isRateLimit = status === 429 || status === 503;

        if (attempt < maxAttempts && isRateLimit) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          this.logger.warn(
            `CoinGecko rate limited (HTTP ${status}) — retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`,
          );
          await this.sleep(backoffMs);
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  private mapToQuotes(
    raw: CoinGeckoPriceResponse,
    coinIdMap: Record<string, string>,
  ): BatchPriceResult {
    const result: BatchPriceResult = new Map();
    const now = new Date();

    for (const [coinId, symbol] of Object.entries(coinIdMap)) {
      const data = raw[coinId];
      if (!data || data.inr === undefined) {
        this.logger.warn(`CoinGecko: No INR price in response for ${coinId} (${symbol})`);
        continue;
      }

      const quote: PriceQuote = {
        symbol,
        price: data.inr,
        currency: "INR",
        priceTimestamp: now,
        source: this.getProviderName(),
        volume: data.inr_24h_vol,
        isMarketClosed: false, // crypto never closes
      };
      result.set(symbol, quote);
    }

    return result;
  }

  // ── Circuit Breaker FSM ────────────────────────────────────────────────────

  private checkCircuit(): void {
    if (this.circuitState === CircuitBreakerState.OPEN) {
      const elapsed = Date.now() - (this.circuitOpenedAt ?? 0);
      if (elapsed >= this.cbConfig.cooldownMs) {
        this.logger.log("CoinGecko circuit transitioning to HALF_OPEN");
        this.circuitState = CircuitBreakerState.HALF_OPEN;
        this.consecutiveSuccesses = 0;
      } else {
        throw new ProviderUnavailableException(
          this.getProviderName(),
          `Circuit OPEN — ${Math.round((this.cbConfig.cooldownMs - elapsed) / 1000)}s until probe`,
        );
      }
    }
  }

  private recordSuccess(): void {
    if (this.circuitState === CircuitBreakerState.HALF_OPEN) {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.cbConfig.successThreshold) {
        this.logger.log("CoinGecko circuit CLOSED — recovered");
        this.circuitState = CircuitBreakerState.CLOSED;
        this.consecutiveFailures = 0;
        this.circuitOpenedAt = null;
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  private recordFailure(err: Error): void {
    if (this.circuitState === CircuitBreakerState.HALF_OPEN) {
      this.logger.warn("CoinGecko probe failed — circuit back to OPEN");
      this.circuitState = CircuitBreakerState.OPEN;
      this.circuitOpenedAt = Date.now();
      return;
    }

    this.consecutiveFailures++;
    this.logger.warn(
      `CoinGecko failure ${this.consecutiveFailures}/${this.cbConfig.failureThreshold}: ${err.message}`,
    );

    if (this.consecutiveFailures >= this.cbConfig.failureThreshold) {
      this.logger.error("CoinGecko circuit OPEN — exceeded failure threshold");
      this.circuitState = CircuitBreakerState.OPEN;
      this.circuitOpenedAt = Date.now();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
