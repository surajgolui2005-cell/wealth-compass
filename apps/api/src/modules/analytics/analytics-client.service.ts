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
  AllocationComputeRequest,
  AllocationRequestDto,
  AllocationResponseDto,
  RebalanceComputeRequest,
  RebalanceRequestDto,
  RebalanceResponseDto,
  DiversificationComputeRequest,
  DiversificationRequestDto,
  DiversificationResponseDto,
} from "./dto/analytics.dto";

/**
 * AnalyticsClientService
 * ======================
 *
 * HTTP client that bridges the NestJS API Gateway to the internal Python
 * FastAPI quant-engine microservice. Analytics endpoints exposed here:
 *
 *   computeTwr()          →  POST quant-engine/api/v1/performance/twr
 *   computeXirr()         →  POST quant-engine/api/v1/performance/xirr
 *   computeBenchmark()    →  POST quant-engine/api/v1/performance/benchmark
 *   computeAllocation()   →  POST quant-engine/api/v1/allocation/breakdown
 *   computeRebalance()    →  POST quant-engine/api/v1/allocation/rebalance
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

  // ── Allocation ────────────────────────────────────────────────────────────────────

  /**
   * Computes multi-dimensional portfolio allocation breakdown.
   *
   * Groups positions by the specified dimension (asset_class | sector | geography |
   * currency | provider) and returns allocation buckets whose weight_pct values
   * sum to exactly 100.0. Unclassified positions are bucketed under
   * "Unassigned / Other".
   *
   * @param request - NestJS-facing camelCase allocation request
   * @returns AllocationResponseDto with buckets sorted descending by weight_pct
   * @throws ServiceUnavailableException if the quant-engine is unreachable
   * @throws BadGatewayException if the quant-engine returns a 4xx/5xx error
   */
  async computeAllocation(request: AllocationComputeRequest): Promise<AllocationResponseDto> {
    const payload: AllocationRequestDto = {
      portfolio_id: request.portfolioId,
      group_by: request.groupBy,
      positions: request.positions.map((p) => ({
        position_id: p.positionId,
        market_value: p.marketValue,
        asset_class: p.assetClass ?? null,
        sector: p.sector ?? null,
        geography: p.geography ?? null,
        currency: p.currency ?? null,
        provider: p.provider ?? null,
      })),
    };

    this.logger.log(
      `[Allocation] portfolio=${request.portfolioId} group_by=${request.groupBy} ` +
        `positions=${payload.positions.length}`,
    );

    return this.post<AllocationResponseDto>("/api/v1/allocation/breakdown", payload);
  }

  // ── Rebalance ────────────────────────────────────────────────────────────────────

  /**
   * Computes portfolio rebalance drift and required buy/sell adjustments.
   *
   * Accepts current allocation weights and target model weights, and returns
   * per-bucket drift (current − target) and the monetary buy/sell amounts
   * needed to reach the model weights given the total portfolio value.
   *
   * Drift sign convention:
   *   Positive drift → over-weight → sell required
   *   Negative drift → under-weight → buy required
   *
   * @param request - NestJS-facing camelCase rebalance request
   * @returns RebalanceResponseDto with per-bucket drift, buy/sell, and requires_rebalance flag
   */
  async computeRebalance(request: RebalanceComputeRequest): Promise<RebalanceResponseDto> {
    const payload: RebalanceRequestDto = {
      portfolio_id: request.portfolioId,
      total_portfolio_value: request.totalPortfolioValue,
      current_allocation: request.currentAllocation.map((w) => ({
        label: w.label,
        current_pct: w.currentPct,
        target_pct: w.targetPct,
      })),
      ...(request.tolerancePct !== undefined && {
        tolerance_pct: request.tolerancePct,
      }),
    };

    this.logger.log(
      `[Rebalance] portfolio=${request.portfolioId} total_value=${request.totalPortfolioValue} ` +
        `buckets=${payload.current_allocation.length}`,
    );

    return this.post<RebalanceResponseDto>("/api/v1/allocation/rebalance", payload);
  }

  // ── Diversification ─────────────────────────────────────────────────────────

  /**
   * Computes portfolio diversification and concentration analytics.
   *
   * Returns HHI, Effective N, Top-N concentration ratios, and a composite
   * 0–100 Diversification Score blending weight concentration (60%) with
   * weight-averaged pairwise correlation penalty (40%).
   *
   * Correlation data is optional. When omitted, Component B of the score
   * defaults to 50 (neutral — uncorrelated assumption).
   *
   * @param request - NestJS-facing camelCase diversification request
   * @returns DiversificationResponseDto with HHI, Effective N, concentration
   *          ratios, and composite score
   * @throws ServiceUnavailableException if the quant-engine is unreachable
   * @throws BadGatewayException if the quant-engine returns a 4xx/5xx error
   */
  async computeDiversification(
    request: DiversificationComputeRequest,
  ): Promise<DiversificationResponseDto> {
    const payload: DiversificationRequestDto = {
      portfolio_id: request.portfolioId,
      asset_weights: request.assetWeights.map((aw) => ({
        asset_id: aw.assetId,
        weight: aw.weight,
      })),
      ...(request.sectorWeights != null && {
        sector_weights: request.sectorWeights.map((sw) => ({
          asset_id: sw.assetId,
          weight: sw.weight,
        })),
      }),
      ...(request.correlationMatrix != null && {
        correlation_matrix: request.correlationMatrix,
      }),
      ...(request.correlationAssetIds != null && {
        correlation_asset_ids: request.correlationAssetIds,
      }),
      ...(request.topNRatios != null && {
        top_n_ratios: request.topNRatios,
      }),
    };

    this.logger.log(
      `[Diversification] portfolio=${request.portfolioId} ` +
        `n_assets=${payload.asset_weights.length} ` +
        `has_sector=${payload.sector_weights != null} ` +
        `has_corr=${payload.correlation_matrix != null}`,
    );

    return this.post<DiversificationResponseDto>("/api/v1/risk/diversification", payload);
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
