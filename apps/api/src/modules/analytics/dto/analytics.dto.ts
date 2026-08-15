/**
 * DTOs for the Analytics module — request and response types for the
 * Performance Analytics REST endpoints that proxy to the Python quant-engine.
 *
 * TypeScript-side mirrors of the Pydantic schemas defined in:
 *   apps/quant-engine/src/app/schemas/performance.py
 */

// ── Shared primitives ──────────────────────────────────────────────────────────

/** A single cash flow event for TWR/XIRR computation. */
export interface CashFlowItemDto {
  /** ISO 8601 date string, e.g. "2025-01-01" */
  flow_date: string;
  /**
   * Signed cash flow amount in portfolio home currency.
   * Negative = outflow (BUY/DEPOSIT). Positive = inflow (SELL/DIVIDEND/current value).
   */
  amount: number;
}

// ── TWR DTOs ──────────────────────────────────────────────────────────────────

/** A single sub-period in the TWR calculation, bounded by cash-flow break points. */
export interface SubPeriodItemDto {
  /** Start date of the sub-period (inclusive), ISO 8601 */
  start_date: string;
  /** End date of the sub-period (inclusive), ISO 8601 */
  end_date: string;
  /** Beginning Market Value (after applying start-of-period cash flows) */
  bmv: number;
  /** Ending Market Value (before applying end-of-period cash flows) */
  emv: number;
  /** Cash flows WITHIN this sub-period (after start_date, on or before end_date) */
  cash_flows: CashFlowItemDto[];
}

/** Request body sent to POST /api/v1/performance/twr on the Python service. */
export interface TwrRequestDto {
  portfolio_id: string;
  sub_periods: SubPeriodItemDto[];
}

/** Response from POST /api/v1/performance/twr. */
export interface TwrResponseDto {
  portfolio_id: string;
  /** Cumulative TWR as decimal (e.g. 0.15 = 15%) */
  twr_cumulative: number;
  /** Annualised TWR as decimal. null if window < 2 days. */
  twr_annualised: number | null;
  /** twr_cumulative × 100 (e.g. 15.0) */
  twr_cumulative_pct: number;
  /** twr_annualised × 100. null if not computable. */
  twr_annualised_pct: number | null;
  /** Modified Dietz return per sub-period, in chronological order */
  sub_period_returns: number[];
  /** Calendar days in the full evaluation window */
  total_days: number;
  /** Number of sub-periods used in chain-linking */
  n_sub_periods: number;
}

// ── XIRR DTOs ─────────────────────────────────────────────────────────────────

/** Request body sent to POST /api/v1/performance/xirr on the Python service. */
export interface XirrRequestDto {
  portfolio_id: string;
  /** Non-periodic cash flows sorted chronologically. Min 2 required. */
  cash_flows: CashFlowItemDto[];
  /** Initial Newton-Raphson seed rate (default 0.10 = 10%) */
  guess?: number;
}

/** Successful XIRR computation result. */
export interface XirrResponseDto {
  portfolio_id: string;
  /** Annualised XIRR as decimal (e.g. 0.198 = 19.8%) */
  xirr: number;
  /** xirr × 100 (e.g. 19.8) */
  xirr_pct: number;
  /** NPV value at the solved rate — should be near 0 */
  npv_at_solution: number;
  /** Which numerical solver converged */
  solver_used: "newton_raphson" | "brent_dekker";
  /** Newton-Raphson iterations consumed */
  iterations: number;
  /** Number of cash flow events processed */
  n_cash_flows: number;
  /** false when XIRR converged successfully */
  twr_fallback: false;
}

/** Returned when XIRR fails to converge (HTTP 200, but twr_fallback = true). */
export interface XirrFallbackResponseDto {
  portfolio_id: string;
  /** Always true in this variant */
  twr_fallback: true;
  /** Human-readable convergence failure message */
  error: string;
  /** Guidance for the frontend — display TWR instead */
  suggestion: string;
}

/** Union of both XIRR response variants. Discriminate via `twr_fallback`. */
export type XirrResultDto = XirrResponseDto | XirrFallbackResponseDto;

// ── Benchmark DTOs ────────────────────────────────────────────────────────────

/** Request body sent to POST /api/v1/performance/benchmark on the Python service. */
export interface BenchmarkRequestDto {
  portfolio_id: string;
  /** Benchmark identifier, e.g. "NIFTY50", "SP500" */
  benchmark_id: string;
  /** Chronologically ordered portfolio NAV/value series (min 3 required) */
  portfolio_prices: number[];
  /** Chronologically ordered benchmark price series (same length as portfolio_prices) */
  benchmark_prices: number[];
  /** Annual risk-free rate as decimal (default 0.065 = 6.5% Indian 10Y G-Sec) */
  risk_free_rate_annual?: number;
}

/** Full benchmark comparison metrics response. */
export interface BenchmarkResponseDto {
  portfolio_id: string;
  benchmark_id: string;
  /** Portfolio beta relative to benchmark */
  beta: number;
  /** Jensen's Alpha, annualised (decimal) */
  alpha_annualised: number;
  /** Jensen's Alpha as percentage */
  alpha_annualised_pct: number;
  /** Pearson correlation in [-1, 1] */
  correlation: number;
  /** Annualised tracking error (decimal) */
  tracking_error_annualised: number;
  /** Annualised tracking error as percentage */
  tracking_error_annualised_pct: number;
  /** Information ratio. null when tracking error = 0. */
  information_ratio: number | null;
  /** Annualised Sharpe ratio */
  sharpe_ratio: number;
  /** Annualised Sortino ratio */
  sortino_ratio: number;
  /** Annualised portfolio volatility % */
  portfolio_volatility_annualised_pct: number;
  /** Annualised benchmark volatility % */
  benchmark_volatility_annualised_pct: number;
  /** Number of daily return observations used */
  n_observations: number;
  /** Risk-free rate used, as percentage */
  risk_free_rate_annual_pct: number;
}

// ── Convenience NestJS-facing request types (camelCase) ───────────────────────
// These are the shapes that NestJS controllers receive from the frontend.
// The AnalyticsClientService maps these to snake_case before calling Python.

export interface TwrComputeRequest {
  portfolioId: string;
  subPeriods: Array<{
    startDate: string; // ISO 8601
    endDate: string;
    bmv: number;
    emv: number;
    cashFlows?: Array<{ flowDate: string; amount: number }>;
  }>;
}

export interface XirrComputeRequest {
  portfolioId: string;
  cashFlows: Array<{ flowDate: string; amount: number }>;
  guess?: number;
}

export interface BenchmarkComputeRequest {
  portfolioId: string;
  benchmarkId: string;
  portfolioPrices: number[];
  benchmarkPrices: number[];
  riskFreeRateAnnual?: number;
}
