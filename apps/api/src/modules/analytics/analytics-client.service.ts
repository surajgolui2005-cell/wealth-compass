import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BenchmarkComputeRequest,
  BenchmarkRequestDto,
  BenchmarkResponseDto,
  TwrComputeRequest,
  TwrRequestDto,
  TwrResponseDto,
  XirrComputeRequest,
  XirrRequestDto,
  XirrResultDto,
} from "./dto/analytics.dto";

/**
 * AnalyticsClientService
 * ======================
 *
 * HTTP client that bridges the NestJS API Gateway to the internal Python
 * FastAPI quant-engine microservice. All three analytics endpoints are
 * exposed here:
 *
 *   computeTwr()       →  POST quant-engine/api/v1/performance/twr
 *   computeXirr()      →  POST quant-engine/api/v1/performance/xirr
 *   computeBenchmark() →  POST quant-engine/api/v1/performance/benchmark
 *
 * Responsibilities:
 *  - camelCase → snake_case DTO mapping before sending to Python.
 *  - Raw HTTP using native `fetch` (available Node 18+). No Axios dependency
 *    added — NestJS HttpModule is available but this avoids extra boilerplate
 *    for internal-only service calls.
 *  - Timeout handling: each call is bounded by QUANT_ENGINE_TIMEOUT_MS (default 15s).
 *  - Structured error propagation: Python 4xx → NestJS BadGatewayException,
 *    network failure → ServiceUnavailableException.
 *
 * Configuration (env vars):
 *   QUANT_ENGINE_URL        — Base URL of the Python service (default: http://localhost:8001)
 *   QUANT_ENGINE_TIMEOUT_MS — Per-request timeout in ms (default: 15000)
 */
@Injectable()
export class AnalyticsClientService {
  private readonly logger = new Logger(AnalyticsClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config
      .get<string>("QUANT_ENGINE_URL", "http://localhost:8001")
      .replace(/\/$/, ""); // strip trailing slash

    this.timeoutMs = this.config.get<number>("QUANT_ENGINE_TIMEOUT_MS", 15_000);
  }

  // ── TWR ────────────────────────────────────────────────────────────────────

  /**
   * Computes Time-Weighted Return for a portfolio.
   *
   * Maps camelCase NestJS request → snake_case Python payload.
   * The caller is responsible for splitting the evaluation window into
   * sub-periods at every external cash flow date before calling this method.
   *
   * @param request - NestJS-facing camelCase TWR request
   * @returns TwrResponseDto with cumulative and annualised TWR, and per-period returns
   * @throws ServiceUnavailableException if the quant-engine is unreachable
   * @throws BadGatewayException if the quant-engine returns a 4xx/5xx error
   */
  async computeTwr(request: TwrComputeRequest): Promise<TwrResponseDto> {
    const payload: TwrRequestDto = {
      portfolio_id: request.portfolioId,
      sub_periods: request.subPeriods.map((sp) => ({
        start_date: sp.startDate,
        end_date: sp.endDate,
        bmv: sp.bmv,
        emv: sp.emv,
        cash_flows: (sp.cashFlows ?? []).map((cf) => ({
          flow_date: cf.flowDate,
          amount: cf.amount,
        })),
      })),
    };

    this.logger.log(
      `[TWR] portfolio=${request.portfolioId} sub_periods=${payload.sub_periods.length}`,
    );

    return this.post<TwrResponseDto>("/api/v1/performance/twr", payload);
  }

  // ── XIRR ───────────────────────────────────────────────────────────────────

  /**
   * Computes XIRR for a portfolio's non-periodic cash flows.
   *
   * Returns a discriminated union: check `result.twr_fallback` before reading
   * XIRR fields. If `twr_fallback === true`, neither solver converged and the
   * UI should display TWR instead (see PRD US-RISK-01 Scenario 4).
   *
   * Cash flow sign convention (MUST be respected by the caller):
   *   Negative = outflow (BUY, DEPOSIT)
   *   Positive = inflow (SELL, DIVIDEND, current portfolio market value)
   *
   * @param request - NestJS-facing camelCase XIRR request
   * @returns XirrResultDto (success or TWR-fallback variant)
   */
  async computeXirr(request: XirrComputeRequest): Promise<XirrResultDto> {
    const payload: XirrRequestDto = {
      portfolio_id: request.portfolioId,
      cash_flows: request.cashFlows.map((cf) => ({
        flow_date: cf.flowDate,
        amount: cf.amount,
      })),
      ...(request.guess !== undefined && { guess: request.guess }),
    };

    this.logger.log(
      `[XIRR] portfolio=${request.portfolioId} cash_flows=${payload.cash_flows.length}`,
    );

    return this.post<XirrResultDto>("/api/v1/performance/xirr", payload);
  }

  // ── Benchmark ──────────────────────────────────────────────────────────────

  /**
   * Computes the full suite of benchmark-relative metrics.
   *
   * Both price series must be aligned on the same dates before calling.
   * The TimescaleDB query that fetches portfolio NAV and benchmark close prices
   * must join on date to ensure alignment.
   *
   * @param request - NestJS-facing camelCase benchmark request
   * @returns BenchmarkResponseDto with β, α, Sharpe, Sortino, TE, IR, ρ
   */
  async computeBenchmark(request: BenchmarkComputeRequest): Promise<BenchmarkResponseDto> {
    const payload: BenchmarkRequestDto = {
      portfolio_id: request.portfolioId,
      benchmark_id: request.benchmarkId,
      portfolio_prices: request.portfolioPrices,
      benchmark_prices: request.benchmarkPrices,
      ...(request.riskFreeRateAnnual !== undefined && {
        risk_free_rate_annual: request.riskFreeRateAnnual,
      }),
    };

    this.logger.log(
      `[Benchmark] portfolio=${request.portfolioId} benchmark=${request.benchmarkId} ` +
        `observations=${request.portfolioPrices.length}`,
    );

    return this.post<BenchmarkResponseDto>("/api/v1/performance/benchmark", payload);
  }

  // ── Internal HTTP helper ───────────────────────────────────────────────────

  /**
   * Makes a POST request to the Python quant-engine with timeout enforcement.
   *
   * Error handling:
   *   - Network failure / timeout  → ServiceUnavailableException (503)
   *   - Python 400 (bad input)     → BadGatewayException (502) with detail
   *   - Python 422 (validation)    → BadGatewayException (502) with detail
   *   - Python 5xx (server error)  → InternalServerErrorException (500)
   *   - Python 200 with fallback   → returned as-is (caller inspects twr_fallback)
   */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const message = isTimeout
        ? `Quant engine timed out after ${this.timeoutMs}ms (${url})`
        : `Quant engine unreachable at ${url}: ${String(err)}`;
      this.logger.error(message);
      throw new ServiceUnavailableException(
        "Performance analytics service is temporarily unavailable. Please try again.",
      );
    } finally {
      clearTimeout(timer);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail =
        typeof data === "object" && data !== null && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : `HTTP ${response.status}`;

      this.logger.warn(`[Quant engine] ${response.status} from ${url}: ${detail}`);

      if (response.status >= 500) {
        throw new InternalServerErrorException(`Quant engine server error: ${detail}`);
      }

      throw new BadGatewayException(`Analytics computation failed: ${detail}`);
    }

    return data as T;
  }
}
