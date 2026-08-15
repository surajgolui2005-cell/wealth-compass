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
 * Alpha Vantage REST API response shape for GLOBAL_QUOTE endpoint.
 */
interface AlphaVantageGlobalQuote {
  "Global Quote": {
    "01. symbol": string;
    "02. open": string;
    "03. high": string;
    "04. low": string;
    "05. price": string;
    "06. volume": string;
    "07. latest trading day": string;
    "08. previous close": string;
    "09. change": string;
    "10. change percent": string;
  };
}

/**
 * Alpha Vantage market data adapter.
 *
 * Provides NSE/BSE equity prices via the GLOBAL_QUOTE endpoint.
 * NSE symbols are prefixed automatically: "INFY" → "NSE:INFY"
 *
 * Circuit breaker FSM:
 *   CLOSED → (3 failures) → OPEN → (30s cooldown) → HALF_OPEN → (1 success) → CLOSED
 *                                                              → (1 failure) → OPEN
 *
 * Retry strategy: exponential backoff — 1s, 2s, 4s (max 3 attempts).
 */
@Injectable()
export class AlphaVantageProvider implements MarketDataProvider {
  private readonly logger = new Logger(AlphaVantageProvider.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl = "https://www.alphavantage.co/query";

  // ── Circuit Breaker State ──────────────────────────────────────────────────
  private circuitState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private circuitOpenedAt: number | null = null;

  private readonly cbConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    cooldownMs: 30_000, // 30 seconds
    successThreshold: 1,
  };

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("ALPHA_VANTAGE_API_KEY", "demo");
    this.http = axios.create({
      timeout: 10_000,
      headers: { "User-Agent": "investor-pm/1.0" },
    });
  }

  getProviderName(): string {
    return "alpha_vantage";
  }

  getSupportedAssetClasses(): AssetClassCode[] {
    return [AssetClassCode.STOCKS, AssetClassCode.ETFS];
  }

  getCircuitState(): CircuitBreakerState {
    return this.circuitState;
  }

  /**
   * NSE market hours: Mon–Fri, 09:15–15:30 IST (UTC+5:30)
   */
  isMarketOpen(): boolean {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dayOfWeek = ist.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15; // 09:15
    const marketClose = 15 * 60 + 30; // 15:30

    return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
  }

  async fetchPrice(symbol: string, currency = "INR"): Promise<PriceQuote> {
    this.checkCircuit();

    const nsSymbol = this.toNseSymbol(symbol);
    try {
      const data = await this.fetchWithRetry<AlphaVantageGlobalQuote>({
        function: "GLOBAL_QUOTE",
        symbol: nsSymbol,
      });

      const quote = data["Global Quote"];
      if (!quote || !quote["05. price"]) {
        throw new Error(`Empty quote response for symbol "${nsSymbol}"`);
      }

      const priceQuote = this.mapToQuote(symbol, quote);
      this.recordSuccess();
      return priceQuote;
    } catch (err: any) {
      this.recordFailure(err);
      throw err;
    }
  }

  async fetchBatchPrices(symbols: string[], currency = "INR"): Promise<BatchPriceResult> {
    const result: BatchPriceResult = new Map();

    // Alpha Vantage free tier has no native batch endpoint — fan out individually
    // but respect the circuit state per call
    for (const symbol of symbols) {
      try {
        const quote = await this.fetchPrice(symbol, currency);
        result.set(symbol.toUpperCase(), quote);
      } catch (err: any) {
        if (err instanceof ProviderUnavailableException) {
          // Circuit opened mid-batch — abort remaining symbols
          this.logger.warn(
            `Circuit open during batch fetch — skipping ${symbols.length} remaining symbols`,
          );
          break;
        }
        this.logger.warn(`Failed to fetch price for ${symbol}: ${err.message}`);
        // Continue with remaining symbols on non-circuit errors
      }
    }

    return result;
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private toNseSymbol(symbol: string): string {
    const upper = symbol.toUpperCase();
    // If already exchange-prefixed (NSE:INFY, BSE:500325) return as-is
    if (upper.includes(":")) return upper;
    return `NSE:${upper}`;
  }

  private mapToQuote(
    originalSymbol: string,
    raw: AlphaVantageGlobalQuote["Global Quote"],
  ): PriceQuote {
    const tradingDay = raw["07. latest trading day"];
    const priceTimestamp = tradingDay ? new Date(`${tradingDay}T15:30:00+05:30`) : new Date();

    return {
      symbol: originalSymbol.toUpperCase(),
      price: parseFloat(raw["05. price"]),
      currency: "INR",
      priceTimestamp,
      source: this.getProviderName(),
      openPrice: parseFloat(raw["02. open"]),
      highPrice: parseFloat(raw["03. high"]),
      lowPrice: parseFloat(raw["04. low"]),
      closePrice: parseFloat(raw["08. previous close"]),
      volume: parseFloat(raw["06. volume"]),
      isMarketClosed: !this.isMarketOpen(),
    };
  }

  private async fetchWithRetry<T>(params: Record<string, string>): Promise<T> {
    const maxAttempts = 3;
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.http.get<T>(this.baseUrl, {
          params: { ...params, apikey: this.apiKey },
        });

        // Alpha Vantage returns 200 even for errors — check for error note
        const data = response.data as any;
        if (data?.Note) {
          // Rate limit note — treat as retriable error
          throw new Error(`Rate limit: ${data.Note}`);
        }
        if (data?.Information) {
          throw new Error(`API limit: ${data.Information}`);
        }

        return response.data;
      } catch (err: any) {
        lastError = err;
        const status = (err as AxiosError)?.response?.status;
        const isRetriable =
          status === 429 ||
          (status !== undefined && status >= 500) ||
          err.message?.includes("Rate limit") ||
          err.message?.includes("API limit") ||
          err.message?.includes("ECONNREFUSED") ||
          err.message?.includes("ECONNRESET") ||
          err.message?.includes("ETIMEDOUT");

        if (attempt < maxAttempts && isRetriable) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          this.logger.warn(
            `Retrying Alpha Vantage request in ${backoffMs}ms (attempt ${attempt}/${maxAttempts}): ${err.message}`,
          );
          await this.sleep(backoffMs);
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  // ── Circuit Breaker FSM ────────────────────────────────────────────────────

  private checkCircuit(): void {
    if (this.circuitState === CircuitBreakerState.OPEN) {
      const elapsed = Date.now() - (this.circuitOpenedAt ?? 0);
      if (elapsed >= this.cbConfig.cooldownMs) {
        this.logger.log("Circuit transitioning to HALF_OPEN — sending probe request");
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
        this.logger.log("Circuit CLOSED — provider recovered");
        this.circuitState = CircuitBreakerState.CLOSED;
        this.consecutiveFailures = 0;
        this.circuitOpenedAt = null;
      }
    } else if (this.circuitState === CircuitBreakerState.CLOSED) {
      this.consecutiveFailures = 0;
    }
  }

  private recordFailure(err: Error): void {
    if (this.circuitState === CircuitBreakerState.HALF_OPEN) {
      this.logger.warn("Probe failed in HALF_OPEN — circuit returning to OPEN");
      this.circuitState = CircuitBreakerState.OPEN;
      this.circuitOpenedAt = Date.now();
      return;
    }

    this.consecutiveFailures++;
    this.logger.warn(
      `Alpha Vantage failure ${this.consecutiveFailures}/${this.cbConfig.failureThreshold}: ${err.message}`,
    );

    if (this.consecutiveFailures >= this.cbConfig.failureThreshold) {
      this.logger.error(`Circuit OPEN — Alpha Vantage exceeded failure threshold`);
      this.circuitState = CircuitBreakerState.OPEN;
      this.circuitOpenedAt = Date.now();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
