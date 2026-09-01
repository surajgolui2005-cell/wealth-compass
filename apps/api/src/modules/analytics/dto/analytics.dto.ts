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

// ── Allocation DTOs ─────────────────────────────────────────────────────────────────

/** Supported allocation grouping dimensions. */
export type AllocationGroupBy = "asset_class" | "sector" | "geography" | "currency" | "provider";

/**
 * A single portfolio position as sent to the Python quant-engine (snake_case).
 * Used inside AllocationRequestDto.
 */
export interface PositionItemDto {
  position_id: string;
  /** Market value in portfolio home currency (INR). Must be > 0. */
  market_value: number;
  asset_class?: string | null;
  sector?: string | null;
  geography?: string | null;
  currency?: string | null;
  provider?: string | null;
}

/** Request body sent to POST /api/v1/allocation/breakdown on the Python service. */
export interface AllocationRequestDto {
  portfolio_id: string;
  positions: PositionItemDto[];
  group_by: AllocationGroupBy;
}

/** A single allocation bucket in the breakdown response. */
export interface AllocationBucketDto {
  /** Bucket label (e.g. "Equity", "Technology", "India", "INR", "ZERODHA") */
  label: string;
  /** Aggregate market value of positions in this bucket (INR) */
  market_value: number;
  /** Percentage weight. All buckets sum to exactly 100.0. */
  weight_pct: number;
  /** Number of positions in this bucket */
  position_count: number;
}

/** Response from POST /api/v1/allocation/breakdown. */
export interface AllocationResponseDto {
  portfolio_id: string;
  /** The dimension used for grouping */
  group_by: AllocationGroupBy;
  /** Sum of all position market values (100% denominator) */
  total_value: number;
  /** Allocation buckets, sorted descending by weight_pct. Sum = 100.0. */
  buckets: AllocationBucketDto[];
  /** Total number of positions processed */
  position_count: number;
}

// ── Rebalance DTOs ─────────────────────────────────────────────────────────────────

/** A single (current, target) weight pair as sent to Python (snake_case). */
export interface AllocationWeightItemDto {
  label: string;
  /** Current portfolio weight (%) */
  current_pct: number;
  /** Target model weight (%) */
  target_pct: number;
}

/** Request body sent to POST /api/v1/allocation/rebalance on the Python service. */
export interface RebalanceRequestDto {
  portfolio_id: string;
  current_allocation: AllocationWeightItemDto[];
  /** Total portfolio market value (INR). Used to compute monetary buy/sell amounts. */
  total_portfolio_value: number;
  /** Drift tolerance band in percentage points (default 2.0 = ±2%). */
  tolerance_pct?: number;
}

/** Per-bucket rebalance result. */
export interface RebalanceBucketDto {
  label: string;
  /** Current weight (%) */
  current_pct: number;
  /** Target model weight (%) */
  target_pct: number;
  /** Drift = current_pct − target_pct. Positive = over-weight (sell). Negative = under-weight (buy). */
  drift_pct: number;
  /** Monetary amount to buy to reach target (0 if not under-weight) */
  buy_amount: number;
  /** Monetary amount to sell to reach target (0 if not over-weight) */
  sell_amount: number;
  /** True when |drift_pct| <= tolerance_pct */
  in_tolerance: boolean;
}

/** Response from POST /api/v1/allocation/rebalance. */
export interface RebalanceResponseDto {
  portfolio_id: string;
  total_portfolio_value: number;
  tolerance_pct: number;
  buckets: RebalanceBucketDto[];
  /** True if any bucket has |drift_pct| > tolerance_pct */
  requires_rebalance: boolean;
  /** Sum of absolute drift values across all buckets */
  total_drift_pct: number;
  /** Total monetary value of all required buy trades */
  total_buy_amount: number;
  /** Total monetary value of all required sell trades */
  total_sell_amount: number;
}

// ── Convenience NestJS-facing allocation/rebalance request types (camelCase) ───
// These are the shapes NestJS controllers receive from the frontend.
// AnalyticsClientService maps these to snake_case before calling Python.

/** A single position item in camelCase for NestJS controllers. */
export interface PositionItem {
  positionId: string;
  /** Market value in portfolio home currency (INR). Must be > 0. */
  marketValue: number;
  assetClass?: string | null;
  sector?: string | null;
  geography?: string | null;
  currency?: string | null;
  provider?: string | null;
}

export interface AllocationComputeRequest {
  portfolioId: string;
  positions: PositionItem[];
  groupBy: AllocationGroupBy;
}

/** A single (current, target) weight pair in camelCase. */
export interface AllocationWeightItem {
  label: string;
  currentPct: number;
  targetPct: number;
}

export interface RebalanceComputeRequest {
  portfolioId: string;
  currentAllocation: AllocationWeightItem[];
  /** Total portfolio market value (INR) */
  totalPortfolioValue: number;
  /** Drift tolerance band in percentage points (default 2.0) */
  tolerancePct?: number;
}

// ── Diversification DTOs ───────────────────────────────────────────────────────

/**
 * A single asset weight entry sent to the Python quant-engine (snake_case).
 * Used inside DiversificationRequestDto.
 */
export interface DiversificationAssetWeightDto {
  /** Asset or position identifier */
  asset_id: string;
  /**
   * Weight. Accepts fractions (0–1) or percentages (0–100).
   * Engine auto-normalises to sum = 1.0.
   */
  weight: number;
}

/** Request body sent to POST /api/v1/risk/diversification on the Python service. */
export interface DiversificationRequestDto {
  portfolio_id: string;
  /** Asset weight list — auto-normalised by the engine. */
  asset_weights: DiversificationAssetWeightDto[];
  /** Optional sector weights for sector-level HHI. When omitted, hhi_sector = null. */
  sector_weights?: DiversificationAssetWeightDto[] | null;
  /**
   * Optional N×N Pearson correlation matrix (list of rows).
   * Must be provided together with correlation_asset_ids.
   */
  correlation_matrix?: number[][] | null;
  /**
   * Ordered asset IDs corresponding to rows/columns of correlation_matrix.
   * Must match the matrix dimension exactly.
   */
  correlation_asset_ids?: string[] | null;
  /**
   * N values for Top-N concentration ratio cut-offs (e.g. [3, 5, 10]).
   * Defaults to [3, 5, 10] when not provided.
   */
  top_n_ratios?: number[] | null;
}

/** A single Top-N concentration ratio in the response. */
export interface ConcentrationRatioDto {
  /** The top-N cut-off value (e.g. 3, 5, 10). */
  n: number;
  /** Identifiers of the top-N assets, sorted by weight descending. */
  asset_ids: string[];
  /**
   * Combined weight of the top-N assets as a percentage (0–100).
   * E.g. 45.23 means the top-N assets hold 45.23% of the portfolio.
   */
  weight_pct: number;
  /** Actual count included (may be < n for small portfolios). */
  actual_n: number;
}

/** Full diversification and concentration response from the Python service. */
export interface DiversificationResponseDto {
  portfolio_id: string;
  /** Number of assets with non-zero weight. */
  n_assets: number;

  // ── HHI & Effective N ────────────────────────────────────────────────────────
  /**
   * Asset-level Herfindahl-Hirschman Index (0–10,000 scale).
   * HHI = Σ(w_i × 100)². 10,000 = single-stock; < 2,500 = diversified.
   */
  hhi: number;
  /** Sector-level HHI. null when sector_weights were not provided. */
  hhi_sector: number | null;
  /**
   * Equivalent equal-weight portfolio size = 10,000 / HHI.
   * A portfolio of 20 equal-weight uncorrelated assets has Effective N = 20.
   */
  effective_n: number;
  /** effective_n expressed as a percentage of n_assets (0–100). */
  effective_n_pct_of_max: number;

  // ── Concentration ─────────────────────────────────────────────────────────────
  /** Top-N concentration ratios for each requested N, sorted ascending. */
  concentration_ratios: ConcentrationRatioDto[];

  // ── Correlation ───────────────────────────────────────────────────────────────
  /**
   * Weight-averaged pairwise Pearson correlation across all asset pairs.
   * null when no correlation data was provided.
   */
  weighted_avg_correlation: number | null;

  // ── Composite Score ───────────────────────────────────────────────────────────
  /**
   * Composite diversification score in [0, 100].
   * = 0.60 × component_a_score + 0.40 × component_b_score.
   * < 10: highly concentrated; 10–50: moderate; 50–85: good; > 85: excellent.
   */
  diversification_score: number;
  /**
   * Effective-N sub-score in [0, 100] (weight: 60%).
   * 100 = perfectly equal-weighted. Penalises top-heavy portfolios.
   */
  component_a_score: number;
  /**
   * Correlation penalty sub-score in [0, 100] (weight: 40%).
   * 100 = max hedge; 50 = uncorrelated (default when no data); 0 = lockstep.
   */
  component_b_score: number;
  /**
   * True when actual correlation data was used to compute component_b_score.
   * False when component_b_score defaulted to 50 (neutral / no-data assumption).
   */
  correlation_data_used: boolean;
}

// ── Convenience NestJS-facing diversification request type (camelCase) ─────────
// This is the shape NestJS controllers receive from the frontend/caller.
// AnalyticsClientService maps this to snake_case before calling Python.

/** A single asset weight entry in camelCase (NestJS controller-facing). */
export interface DiversificationAssetWeight {
  assetId: string;
  /** Weight fraction (0–1) or percentage (0–100). Auto-normalised by the engine. */
  weight: number;
}

export interface DiversificationComputeRequest {
  portfolioId: string;
  /** Asset weights — auto-normalised to sum = 1.0. */
  assetWeights: DiversificationAssetWeight[];
  /** Optional sector weights for sector-level HHI. */
  sectorWeights?: DiversificationAssetWeight[] | null;
  /**
   * Optional N×N Pearson correlation matrix.
   * Must be provided together with correlationAssetIds.
   */
  correlationMatrix?: number[][] | null;
  /**
   * Ordered asset IDs corresponding to rows/columns of correlationMatrix.
   */
  correlationAssetIds?: string[] | null;
  /**
   * N values for Top-N concentration ratio cut-offs.
   * Defaults to [3, 5, 10] when not provided.
   */
  topNRatios?: number[] | null;
}
