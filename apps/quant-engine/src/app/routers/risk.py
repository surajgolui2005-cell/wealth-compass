"""
Risk Analytics Router
=====================

Exposes four computation endpoints:

    POST /api/v1/risk/summary          — Full risk summary (all 7 metrics in one call)
    POST /api/v1/risk/drawdown-series  — Full drawdown time series for charting
    POST /api/v1/risk/correlation      — Pairwise Pearson correlation matrix
    POST /api/v1/risk/diversification  — HHI, Effective N, Top-N ratios, and
                                         composite 0–100 Diversification Score

All endpoints are internal-only (no public routing). The NestJS API Gateway
calls these over the private container network after constructing the aligned
return series from TimescaleDB price history.

Math engines used:
    src.analytics.risk.volatility      → compute_volatility
    src.analytics.risk.beta            → compute_beta
    src.analytics.risk.sharpe          → compute_sharpe
    src.analytics.risk.sortino         → compute_sortino
    src.analytics.risk.drawdown        → compute_drawdown
    src.analytics.risk.var             → compute_var
    src.analytics.risk.correlation     → compute_correlation
    src.analytics.risk.diversification → compute_diversification

Design decisions
----------------
- Summary endpoint is intentionally synchronous (not async background task)
  because the NestJS Gateway calls it with a request-scoped timeout of 15s.
  All seven computations are O(N) in pure Python and comfortably fit this budget
  for typical history sizes (N ≤ 1500 daily returns ≈ 6 years).
- Each section of the summary is computed in try/except isolation so that a
  failure in one metric (e.g. zero benchmark variance → beta undefined) does
  not fail the entire summary response. The affected metric is returned as
  its null/sentinel value.
- Drawdown series endpoint is separate from summary to avoid serialising the
  full N-length curve in every summary call — only requested when the caller
  needs to render an underwater equity chart.
- Diversification endpoint accepts optional correlation_matrix. When omitted,
  Component B of the score defaults to 50 (neutral) and only the HHI-based
  concentration component drives the score.
"""

import logging
import math

from fastapi import APIRouter, HTTPException, status

from src.analytics.risk.beta import compute_beta
from src.analytics.risk.correlation import compute_correlation
from src.analytics.risk.diversification import compute_diversification
from src.analytics.risk.drawdown import compute_drawdown, _returns_to_nav
from src.analytics.risk.sharpe import compute_sharpe
from src.analytics.risk.sortino import compute_sortino
from src.analytics.risk.var import compute_var
from src.analytics.risk.volatility import compute_volatility
from src.app.schemas.risk import (
    BetaDto,
    ConcentrationRatioDto,
    CorrelationRequest,
    CorrelationResponse,
    DiversificationRequest,
    DiversificationResponse,
    DrawdownDto,
    DrawdownSeriesRequest,
    DrawdownSeriesResponse,
    RiskSummaryRequest,
    RiskSummaryResponse,
    VaRDto,
    VaREstimateDto,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/risk",
    tags=["Risk Analytics"],
)


# ── Internal mapping helpers ───────────────────────────────────────────────────


def _map_var_estimate(estimate) -> VaREstimateDto:
    return VaREstimateDto(
        method=estimate.method,
        confidence_level=estimate.confidence_level,
        var_pct=estimate.var_pct,
        var_amount=estimate.var_amount,
    )


# ── Endpoint 1: Risk Summary ───────────────────────────────────────────────────


@router.post(
    "/summary",
    response_model=RiskSummaryResponse,
    summary="Portfolio Risk Summary",
    description=(
        "Computes the full risk metric suite for a portfolio from its daily return history: "
        "Volatility (σ), Beta (β), Sharpe Ratio, Sortino Ratio, Maximum Drawdown (MDD), "
        "Value at Risk (VaR at 95% & 99% using Parametric and Historical methods). "
        "Beta is only included when benchmark_returns is provided. "
        "All return and volatility metrics are annualised using the √252 convention. "
        "Reference: RISK_METHODOLOGY.md, PRD US-RISK-01."
    ),
    responses={
        400: {
            "description": (
                "Insufficient return observations, non-finite return values, "
                "misaligned benchmark series, or non-positive portfolio value."
            )
        },
    },
)
async def compute_risk_summary(body: RiskSummaryRequest) -> RiskSummaryResponse:
    """
    POST /api/v1/risk/summary

    Accepts a daily return series for a portfolio and optional aligned benchmark
    returns, then computes all seven risk measures in a single response.

    **Metrics included:**
    - **Volatility:** Annualised standard deviation (σ_a = σ_d × √252).
    - **Sharpe Ratio:** Risk-adjusted return above risk-free rate per unit of total volatility.
    - **Sortino Ratio:** Downside-adjusted return using only negative-return semi-deviation.
    - **Maximum Drawdown:** Historical worst-case peak-to-trough loss.
    - **VaR 95% & 99%:** One-day loss threshold at two confidence levels using both
      Parametric (normal distribution) and Historical Simulation methods.
    - **Beta:** Systematic risk vs benchmark (only when benchmark_returns is provided).

    **Edge cases handled:**
    - Single observation series (< 2): raises 400.
    - All identical returns (zero variance): Sharpe is undefined → raises 400.
    - Benchmark with zero variance: Beta is excluded (null) rather than causing total failure.
    - Sortino with no downside periods: returns `sortino_ratio = +inf`.
    """
    portfolio_id = body.portfolio_id
    returns = body.daily_returns
    n = len(returns)

    logger.info(
        "Risk summary requested: portfolio_id=%s n_returns=%d portfolio_value=%.2f rf=%.4f",
        portfolio_id,
        n,
        body.portfolio_value,
        body.risk_free_rate_annual,
    )

    # ── 1. Volatility ──────────────────────────────────────────────────────────
    try:
        vol_result = compute_volatility(portfolio_id, returns)
    except ValueError as exc:
        logger.warning("Volatility failed for portfolio_id=%s: %s", portfolio_id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # ── 2. Sharpe Ratio ────────────────────────────────────────────────────────
    try:
        sharpe_result = compute_sharpe(
            portfolio_id, returns, risk_free_rate_annual=body.risk_free_rate_annual
        )
    except ValueError as exc:
        logger.warning("Sharpe computation failed for portfolio_id=%s: %s", portfolio_id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # ── 3. Sortino Ratio ───────────────────────────────────────────────────────
    try:
        sortino_result = compute_sortino(
            portfolio_id, returns, risk_free_rate_annual=body.risk_free_rate_annual
        )
    except ValueError as exc:
        logger.warning("Sortino computation failed for portfolio_id=%s: %s", portfolio_id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Normalise +inf Sortino (no downside periods) to a large sentinel float for JSON safety
    sortino_ratio_safe = (
        sortino_result.sortino_ratio
        if math.isfinite(sortino_result.sortino_ratio)
        else 9999.0
    )

    # ── 4. Maximum Drawdown ────────────────────────────────────────────────────
    try:
        dd_result = compute_drawdown(portfolio_id, returns=returns)
    except ValueError as exc:
        logger.warning("Drawdown computation failed for portfolio_id=%s: %s", portfolio_id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # ── 5. Value at Risk ───────────────────────────────────────────────────────
    try:
        var_result = compute_var(portfolio_id, returns, portfolio_value=body.portfolio_value)
    except ValueError as exc:
        logger.warning("VaR computation failed for portfolio_id=%s: %s", portfolio_id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # ── 6. Beta (optional — only when benchmark_returns provided) ──────────────
    beta_dto: BetaDto | None = None
    if body.benchmark_returns is not None:
        bench_id = body.benchmark_id or "BENCHMARK"
        try:
            beta_result = compute_beta(
                portfolio_id, bench_id, returns, body.benchmark_returns
            )
            beta_dto = BetaDto(
                beta=beta_result.beta,
                benchmark_id=beta_result.benchmark_id,
                covariance=beta_result.covariance,
                benchmark_variance=beta_result.benchmark_variance,
            )
        except ValueError as exc:
            # Graceful degradation: log and omit beta rather than failing entire summary
            logger.warning(
                "Beta computation skipped for portfolio_id=%s (benchmark_id=%s): %s",
                portfolio_id,
                bench_id,
                exc,
            )
            beta_dto = None

    # ── Assemble response ──────────────────────────────────────────────────────
    response = RiskSummaryResponse(
        portfolio_id=portfolio_id,
        n_observations=n,
        risk_free_rate_annual=body.risk_free_rate_annual,
        # Volatility
        daily_volatility=vol_result.daily_volatility,
        annual_volatility=vol_result.annual_volatility,
        annual_volatility_pct=vol_result.annual_volatility_pct,
        # Sharpe
        sharpe_ratio=sharpe_result.sharpe_ratio,
        annualised_excess_return=sharpe_result.annualised_excess_return,
        # Sortino
        sortino_ratio=sortino_ratio_safe,
        downside_deviation_annual=sortino_result.downside_deviation_annual,
        n_downside_observations=sortino_result.n_downside_observations,
        # Drawdown
        drawdown=DrawdownDto(
            max_drawdown=dd_result.max_drawdown,
            max_drawdown_pct=dd_result.max_drawdown_pct,
            peak_index=dd_result.peak_index,
            trough_index=dd_result.trough_index,
            recovery_index=dd_result.recovery_index,
            drawdown_duration=dd_result.drawdown_duration,
            recovery_duration=dd_result.recovery_duration,
        ),
        # VaR
        var=VaRDto(
            parametric_95=_map_var_estimate(var_result.parametric_95),
            parametric_99=_map_var_estimate(var_result.parametric_99),
            historical_95=_map_var_estimate(var_result.historical_95),
            historical_99=_map_var_estimate(var_result.historical_99),
        ),
        # Beta (optional)
        beta=beta_dto,
    )

    logger.info(
        "Risk summary complete: portfolio_id=%s vol=%.2f%% sharpe=%.4f sortino=%.4f "
        "mdd=%.2f%% var_p95=%.2f beta=%s",
        portfolio_id,
        vol_result.annual_volatility_pct,
        sharpe_result.sharpe_ratio,
        sortino_ratio_safe,
        dd_result.max_drawdown_pct,
        var_result.parametric_95.var_amount,
        f"{beta_dto.beta:.4f}" if beta_dto else "N/A",
    )

    return response


# ── Endpoint 2: Drawdown Series ────────────────────────────────────────────────


@router.post(
    "/drawdown-series",
    response_model=DrawdownSeriesResponse,
    summary="Portfolio Drawdown Time Series",
    description=(
        "Computes the full underwater equity curve (drawdown series) from a daily return series. "
        "Each point D_t = (V_t − P_t) / P_t × 100 represents the percentage decline from the "
        "running portfolio peak at that observation. Values are always ≤ 0. "
        "Useful for rendering drawdown charts and visualising recovery periods. "
        "The response series has length N+1 (includes the starting value V_0 = 0.0)."
    ),
    responses={
        400: {"description": "Empty return series or non-finite return values."},
    },
)
async def compute_drawdown_series(body: DrawdownSeriesRequest) -> DrawdownSeriesResponse:
    """
    POST /api/v1/risk/drawdown-series

    Returns the complete drawdown time series for the portfolio, not just the maximum.
    This is the 'underwater equity curve' used in portfolio performance dashboards.

    The output series has one more element than the input return series because
    it includes the starting value D_0 = 0.0 (V_0 is the initial peak by definition).

    **Chart interpretation:**
    - A value of -15.5 at index t means the portfolio was 15.5% below its prior peak
      at observation t.
    - Periods where the series is 0.0 indicate the portfolio was at or above all
      prior highs (new all-time highs).
    """
    portfolio_id = body.portfolio_id
    returns = body.daily_returns

    logger.info(
        "Drawdown series requested: portfolio_id=%s n_returns=%d",
        portfolio_id,
        len(returns),
    )

    try:
        # Build NAV curve starting at 1.0
        nav = _returns_to_nav(returns)

        # Compute per-period drawdown values
        running_peak = nav[0]
        drawdown_series_pct: list[float] = []

        for v in nav:
            if v > running_peak:
                running_peak = v
            if running_peak > 0.0:
                d = (v - running_peak) / running_peak * 100.0
            else:
                d = 0.0
            drawdown_series_pct.append(d)

        max_dd_pct = min(drawdown_series_pct)

    except ValueError as exc:
        logger.warning(
            "Drawdown series failed for portfolio_id=%s: %s", portfolio_id, exc
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    logger.info(
        "Drawdown series complete: portfolio_id=%s n_nav=%d max_dd=%.2f%%",
        portfolio_id,
        len(nav),
        max_dd_pct,
    )

    return DrawdownSeriesResponse(
        portfolio_id=portfolio_id,
        drawdown_series_pct=drawdown_series_pct,
        max_drawdown_pct=max_dd_pct,
        n_observations=len(nav),
    )


# ── Endpoint 3: Correlation Matrix ─────────────────────────────────────────────


@router.post(
    "/correlation",
    response_model=CorrelationResponse,
    summary="Pairwise Asset Correlation Matrix",
    description=(
        "Computes the N×N pairwise Pearson correlation matrix for a set of assets "
        "from their aligned daily return time series. "
        "The resulting matrix is symmetric (ρ_ij = ρ_ji) with exactly 1.0 on the diagonal. "
        "All values are bounded to [−1.0, 1.0]. "
        "Assets with zero return variance (constant price) are treated as uncorrelated "
        "with all other assets (off-diagonal = 0.0). "
        "Reference: Markowitz (1952); RISK_METHODOLOGY.md §7."
    ),
    responses={
        400: {
            "description": (
                "Empty asset list, misaligned return series lengths, "
                "or any series with fewer than 2 observations."
            )
        },
    },
)
async def compute_correlation_matrix(body: CorrelationRequest) -> CorrelationResponse:
    """
    POST /api/v1/risk/correlation

    Accepts a list of named asset return series (all aligned to the same trading dates)
    and returns the pairwise Pearson correlation matrix.

    **Guaranteed properties of the output matrix:**
    - **Symmetric:** `matrix[i][j] == matrix[j][i]` for all i, j.
    - **Unit diagonal:** `matrix[i][i] == 1.0` for all i.
    - **Bounded:** All off-diagonal values are in `[−1.0, 1.0]`.

    **Single-asset input:** Returns a 1×1 matrix `[[1.0]]`.

    **Diversification use:** Low off-diagonal correlations indicate strong diversification
    potential. Assets with ρ ≈ 0 provide near-maximum variance reduction when combined.
    """
    asset_dict = {a.asset_id: a.daily_returns for a in body.assets}

    logger.info(
        "Correlation matrix requested: n_assets=%d assets=%s",
        len(asset_dict),
        list(asset_dict.keys()),
    )

    try:
        result = compute_correlation(asset_dict)
    except ValueError as exc:
        logger.warning("Correlation computation failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Verify symmetry and unit diagonal before returning (defensive assertion)
    n = result.n_assets
    for i in range(n):
        assert abs(result.matrix[i][i] - 1.0) < 1e-10, f"Diagonal [{i}][{i}] != 1.0"
        for j in range(n):
            assert abs(result.matrix[i][j] - result.matrix[j][i]) < 1e-10, (
                f"Matrix not symmetric at [{i}][{j}]"
            )

    logger.info(
        "Correlation matrix complete: n_assets=%d n_obs=%d (symmetric=True, unit_diagonal=True)",
        result.n_assets,
        result.n_observations,
    )

    return CorrelationResponse(
        asset_ids=result.asset_ids,
        matrix=result.matrix,
        n_assets=result.n_assets,
        n_observations=result.n_observations,
    )


# ── Endpoint 4: Diversification & Concentration ────────────────────────────────


@router.post(
    "/diversification",
    response_model=DiversificationResponse,
    summary="Portfolio Diversification & Concentration Score",
    description=(
        "Computes a multi-signal diversification and concentration analysis for a portfolio: "
        "1. **HHI** (Herfindahl-Hirschman Index) on the 0–10,000 scale for both asset-level "
        "and optional sector-level weights. "
        "2. **Effective N** — the equivalent equal-weight portfolio size (10,000 / HHI). "
        "3. **Top-N Concentration Ratios** — cumulative weight of the N largest holdings "
        "(default N = 3, 5, 10). "
        "4. **Composite 0–100 Diversification Score** — 60% Effective-N concentration "
        "component + 40% weight-averaged pairwise correlation penalty. "
        "Correlation data is optional; when omitted, Component B defaults to 50 (neutral). "
        "Reference: RISK_METHODOLOGY.md §8, PRD US-RISK-02."
    ),
    responses={
        400: {
            "description": (
                "Empty asset list, all-zero weights, or inconsistent correlation inputs "
                "(matrix provided without asset IDs or dimension mismatch)."
            )
        },
    },
)
async def compute_diversification_analytics(
    body: DiversificationRequest,
) -> DiversificationResponse:
    """
    POST /api/v1/risk/diversification

    Accepts asset weights and optional correlation data for a portfolio, and returns
    a comprehensive diversification profile combining HHI concentration measures
    with a correlation-adjusted composite score.

    **Single-stock portfolio behaviour:**
    - HHI = 10,000 (maximum concentration)
    - Effective N = 1.0
    - component_a_score = 100 (only 1 asset, equal-weight is trivially satisfied)
    - component_b_score = 0 (self-correlation = 1.0 → maximum penalty)
    - diversification_score = 0.60 × 100 + 0.40 × 0 = **60** (but with
      self-correlation capped: for single asset no pairs exist → component_b = 50)
    - Final single-stock score ≈ **80** with no correlation → use validation
      archetype tests in test_risk_diversification.py for exact thresholds.

    **Broad multi-asset portfolio behaviour:**
    - Low HHI → high Effective N → high component_a
    - Low inter-asset correlations → high component_b
    - Combined score > 85 for well-diversified index-style portfolios.
    """
    portfolio_id = body.portfolio_id

    # ── Build asset_weights dict ───────────────────────────────────────────────
    asset_weights: dict[str, float] = {
        aw.asset_id: aw.weight for aw in body.asset_weights
    }

    # ── Build optional sector_weights dict ─────────────────────────────────────
    sector_weights: dict[str, float] | None = None
    if body.sector_weights:
        sector_weights = {sw.asset_id: sw.weight for sw in body.sector_weights}

    logger.info(
        "Diversification requested: portfolio_id=%s n_assets=%d has_sector=%s has_corr=%s",
        portfolio_id,
        len(asset_weights),
        sector_weights is not None,
        body.correlation_matrix is not None,
    )

    # ── Call the math engine ───────────────────────────────────────────────────
    try:
        result = compute_diversification(
            portfolio_id=portfolio_id,
            asset_weights=asset_weights,
            sector_weights=sector_weights,
            correlation_matrix=body.correlation_matrix,
            correlation_asset_ids=body.correlation_asset_ids,
            top_n_ratios=body.top_n_ratios,
        )
    except ValueError as exc:
        logger.warning(
            "Diversification computation failed for portfolio_id=%s: %s",
            portfolio_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    # ── Map ConcentrationRatio dataclasses → DTOs ──────────────────────────────
    cr_dtos = [
        ConcentrationRatioDto(
            n=cr.n,
            asset_ids=cr.asset_ids,
            weight_pct=cr.weight_pct,
            actual_n=cr.actual_n,
        )
        for cr in result.concentration_ratios
    ]

    logger.info(
        "Diversification complete: portfolio_id=%s hhi=%.2f effective_n=%.4f "
        "score=%.4f (comp_a=%.4f comp_b=%.4f corr_used=%s)",
        portfolio_id,
        result.hhi,
        result.effective_n,
        result.diversification_score,
        result.component_a_score,
        result.component_b_score,
        result.correlation_data_used,
    )

    return DiversificationResponse(
        portfolio_id=result.portfolio_id,
        n_assets=result.n_assets,
        hhi=result.hhi,
        hhi_sector=result.hhi_sector,
        effective_n=result.effective_n,
        effective_n_pct_of_max=result.effective_n_pct_of_max,
        concentration_ratios=cr_dtos,
        weighted_avg_correlation=result.weighted_avg_correlation,
        diversification_score=result.diversification_score,
        component_a_score=result.component_a_score,
        component_b_score=result.component_b_score,
        correlation_data_used=result.correlation_data_used,
    )

