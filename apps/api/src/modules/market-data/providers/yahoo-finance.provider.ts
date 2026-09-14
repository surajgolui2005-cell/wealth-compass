import { Injectable, Logger } from "@nestjs/common";
import { AssetClassCode } from "@prisma/client";
import axios, { AxiosInstance } from "axios";
import {
  BatchPriceResult,
  CircuitBreakerConfig,
  CircuitBreakerState,
  MarketDataProvider,
  PriceQuote,
  ProviderUnavailableException,
} from "../interfaces/market-data-provider.interface";
import { SymbolResolver } from "../utils/symbol-resolver.util";

/**
 * Yahoo Finance live market data provider adapter.
 * Provides real-time and closing quotes for NSE/BSE equities, ETFs, and indices without requiring an API key.
 */
@Injectable()
export class YahooFinanceProvider implements MarketDataProvider {
  private readonly logger = new Logger(YahooFinanceProvider.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl = "https://query1.finance.yahoo.com/v8/finance/chart";

  // In-memory short-lived quote cache (5-second TTL)
  private readonly localCache = new Map<string, { quote: PriceQuote; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5000;

  // Circuit Breaker State
  private circuitState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private circuitOpenedAt: number | null = null;

  private readonly cbConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    cooldownMs: 15_000, // 15 seconds cooldown
    successThreshold: 1,
  };

  constructor() {
    this.http = axios.create({
      timeout: 6000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
  }

  getProviderName(): string {
    return "yahoo_finance";
  }

  getSupportedAssetClasses(): AssetClassCode[] {
    return [AssetClassCode.STOCKS, AssetClassCode.ETFS];
  }

  getCircuitState(): CircuitBreakerState {
    this.checkCircuitTransition();
    return this.circuitState;
  }

  /**
   * Returns true if Indian markets (NSE/BSE) are currently in regular trading hours.
   * Mon–Fri, 09:15 to 15:30 IST (UTC+05:30).
   */
  isMarketOpen(): boolean {
    const now = new Date();
    // Convert to IST
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);

    const day = istDate.getUTCDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) return false;

    const hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 09:15 IST = 555 mins, 15:30 IST = 930 mins
    return totalMinutes >= 555 && totalMinutes <= 930;
  }

  /**
   * Fetches a single live price quote for a symbol.
   */
  async fetchPrice(rawSymbol: string, _currency = "INR"): Promise<PriceQuote> {
    const resolvedSymbol = SymbolResolver.resolve(rawSymbol);
    const cacheKey = resolvedSymbol.toUpperCase();

    // Check in-memory 5s TTL cache
    const cached = this.localCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.quote;
    }

    this.checkCircuitBreaker();

    try {
      const url = `${this.baseUrl}/${encodeURIComponent(resolvedSymbol)}?interval=1m&range=1d`;
      const response = await this.http.get(url);

      const result = response.data?.chart?.result?.[0];
      if (!result || !result.meta) {
        throw new Error(`No chart data returned for symbol: ${resolvedSymbol}`);
      }

      const meta = result.meta;
      const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
      const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const currency = meta.currency?.toUpperCase() || "INR";
      const timestamp = meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000)
        : new Date();

      const quote: PriceQuote = {
        symbol: rawSymbol.trim().toUpperCase(),
        price: Number(price.toFixed(2)),
        currency,
        priceTimestamp: timestamp,
        source: this.getProviderName(),
        openPrice: meta.regularMarketDayHigh ? meta.regularMarketDayLow : undefined,
        highPrice: meta.regularMarketDayHigh,
        lowPrice: meta.regularMarketDayLow,
        closePrice: prevClose,
        volume: meta.regularMarketVolume,
        isStale: false,
        isMarketClosed: !this.isMarketOpen(),
        ageSeconds: 0,
      };

      // Store in memory cache
      this.localCache.set(cacheKey, {
        quote,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      this.onSuccess();
      return quote;
    } catch (err: any) {
      this.onFailure(err);
      throw new ProviderUnavailableException(
        this.getProviderName(),
        `Failed to fetch quote for ${resolvedSymbol}: ${err.message}`,
      );
    }
  }

  /**
   * Fetches historical OHLCV chart data for a symbol.
   */
  async fetchHistoricalData(
    rawSymbol: string,
    range = "1mo",
    interval = "1d",
  ): Promise<{
    symbol: string;
    resolvedSymbol: string;
    currency: string;
    currentPrice: number;
    previousClose: number;
    change: number;
    changePercent: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    range: string;
    interval: string;
    points: Array<{
      time: string;
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  }> {
    const resolvedSymbol = SymbolResolver.resolve(rawSymbol);

    try {
      const url = `${this.baseUrl}/${encodeURIComponent(resolvedSymbol)}?range=${encodeURIComponent(
        range,
      )}&interval=${encodeURIComponent(interval)}`;
      const response = await this.http.get(url);

      const result = response.data?.chart?.result?.[0];
      if (!result || !result.meta) {
        throw new Error(`No chart data returned for symbol: ${resolvedSymbol}`);
      }

      const meta = result.meta;
      const currentPrice = meta.regularMarketPrice ?? meta.previousClose ?? 0;
      const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;
      const change = currentPrice - prevClose;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;
      const currency = meta.currency?.toUpperCase() || "INR";

      const timestamps: number[] = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens: (number | null)[] = quote.open || [];
      const highs: (number | null)[] = quote.high || [];
      const lows: (number | null)[] = quote.low || [];
      const closes: (number | null)[] = quote.close || [];
      const volumes: (number | null)[] = quote.volume || [];

      const points: Array<{
        time: string;
        timestamp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }> = [];

      for (let i = 0; i < timestamps.length; i++) {
        const c = closes[i];
        if (c === null || c === undefined || isNaN(c)) continue;
        const o = opens[i] ?? c;
        const h = highs[i] ?? Math.max(o, c);
        const l = lows[i] ?? Math.min(o, c);
        const v = volumes[i] ?? 0;
        const ts = timestamps[i];
        const dateObj = new Date(ts * 1000);

        let timeStr = dateObj.toISOString().split("T")[0];
        if (range === "5d") {
          timeStr = dateObj.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          });
        }

        points.push({
          time: timeStr,
          timestamp: ts,
          open: Number(o.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          close: Number(c.toFixed(2)),
          volume: Math.round(v),
        });
      }

      return {
        symbol: rawSymbol.trim().toUpperCase(),
        resolvedSymbol,
        currency,
        currentPrice: Number(currentPrice.toFixed(2)),
        previousClose: Number(prevClose.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        regularMarketDayHigh: meta.regularMarketDayHigh,
        regularMarketDayLow: meta.regularMarketDayLow,
        regularMarketVolume: meta.regularMarketVolume,
        range,
        interval,
        points,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to fetch history for ${resolvedSymbol}: ${err.message}`);
      throw new ProviderUnavailableException(
        this.getProviderName(),
        `Failed to fetch historical chart data for ${resolvedSymbol}: ${err.message}`,
      );
    }
  }

  /**
   * Batch fetches live quotes for multiple symbols concurrently.
   */
  async fetchBatchPrices(symbols: string[], currency = "INR"): Promise<BatchPriceResult> {
    const result: BatchPriceResult = new Map();
    if (!symbols || symbols.length === 0) return result;

    const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));

    const promises = uniqueSymbols.map(async (sym) => {
      try {
        const quote = await this.fetchPrice(sym, currency);
        result.set(sym.toUpperCase(), quote);
      } catch (err: any) {
        this.logger.debug(`Batch quote missed for ${sym}: ${err.message}`);
      }
    });

    await Promise.all(promises);
    return result;
  }

  // ── Circuit Breaker Logic ──────────────────────────────────────────────────

  private checkCircuitBreaker(): void {
    this.checkCircuitTransition();
    if (this.circuitState === CircuitBreakerState.OPEN) {
      throw new ProviderUnavailableException(
        this.getProviderName(),
        `Circuit breaker is OPEN. Cooldown remaining: ${this.getRemainingCooldown()}ms`,
      );
    }
  }

  private checkCircuitTransition(): void {
    if (this.circuitState === CircuitBreakerState.OPEN && this.circuitOpenedAt) {
      const elapsed = Date.now() - this.circuitOpenedAt;
      if (elapsed >= this.cbConfig.cooldownMs) {
        this.circuitState = CircuitBreakerState.HALF_OPEN;
        this.consecutiveSuccesses = 0;
        this.logger.log(`[${this.getProviderName()}] Circuit transitioned OPEN → HALF_OPEN`);
      }
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.circuitState === CircuitBreakerState.HALF_OPEN) {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.cbConfig.successThreshold) {
        this.circuitState = CircuitBreakerState.CLOSED;
        this.circuitOpenedAt = null;
        this.logger.log(`[${this.getProviderName()}] Circuit transitioned HALF_OPEN → CLOSED`);
      }
    }
  }

  private onFailure(err: any): void {
    this.consecutiveFailures++;
    this.logger.warn(
      `[${this.getProviderName()}] Request failed (${this.consecutiveFailures}/${this.cbConfig.failureThreshold}): ${err.message}`,
    );

    if (
      this.circuitState === CircuitBreakerState.CLOSED &&
      this.consecutiveFailures >= this.cbConfig.failureThreshold
    ) {
      this.circuitState = CircuitBreakerState.OPEN;
      this.circuitOpenedAt = Date.now();
      this.logger.error(`[${this.getProviderName()}] Circuit transitioned CLOSED → OPEN`);
    } else if (this.circuitState === CircuitBreakerState.HALF_OPEN) {
      this.circuitState = CircuitBreakerState.OPEN;
      this.circuitOpenedAt = Date.now();
      this.logger.error(`[${this.getProviderName()}] Probe failed in HALF_OPEN → OPEN`);
    }
  }

  private getRemainingCooldown(): number {
    if (!this.circuitOpenedAt) return 0;
    return Math.max(0, this.cbConfig.cooldownMs - (Date.now() - this.circuitOpenedAt));
  }
}
