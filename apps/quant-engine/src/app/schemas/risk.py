"""
Pydantic request/response schemas for the risk analytics router.

All monetary values are accepted as plain floats — the quant engine receives
pre-computed values from the NestJS valuation layer and returns risk metrics
as Python IEEE 754 doubles.

Schemas
-------
    RiskSummaryRequest       — Input for POST /api/v1/risk/summary
    VaREstimateDto           — Single VaR estimate (one method, one confidence level)
    VaRDto                   — All four VaR estimates (parametric/historical × 95%/99%)
    DrawdownDto              — Max drawdown result fields
    RiskSummaryResponse      — Full risk summary response (all metrics)

    DrawdownSeriesRequest    — Input for POST /api/v1/risk/drawdown-series
    DrawdownSeriesResponse   — Drawdown curve (one value per NAV observation)

    CorrelationRequest       — Input for POST /api/v1/risk/correlation
    CorrelationResponse      — Pairwise correlation matrix response
"""

# Note: NO `from __future__ import annotations` — Pydantic v2 on Python 3.13
# has a known conflict when field names match imported types under deferred
# annotation evaluation. We use explicit Optional / Union types instead.

import math
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Shared input primitives ────────────────────────────────────────────────────


class AssetReturnSeries(BaseModel):
    """A named daily return series for a single asset."""

    asset_id: str = Field(
        ...,
        description="Asset or portfolio identifier (used as row/column label in the output matrix).",
    )
    daily_returns: Annotated[
        list[float],
        Field(
            min_length=2,
            description=(
                "Ordered sequence of simple daily periodic returns (r_t = P_t/P_{t-1} - 1). "
                "Minimum 2 observations required."
            ),
        ),
    ]


# ── Risk Summary Schemas ───────────────────────────────────────────────────────


class RiskSummaryRequest(BaseModel):
    """
    Request body for POST /api/v1/risk/summary.

    Computes the full suite of risk metrics for a single portfolio/asset
    from its daily return history plus an optional benchmark return series.
    """

    portfolio_id: str = Field(
        ...,
        description="Portfolio or asset UUID (echoed in response for tracing).",
    )
    daily_returns: Annotated[
        list[float],
        Field(
            min_length=2,
            description=(
                "Ordered daily simple returns for the portfolio/asset "
                "(r_t = P_t / P_{t-1} − 1). Minimum 2 observations. "
                "Recommended ≥ 252 for statistically robust annual metrics."
            ),
        ),
    ]
    benchmark_returns: list[float] | None = Field(
        default=None,
        description=(
            "Optional: aligned daily benchmark returns (same length as daily_returns). "
            "Required for Beta computation. When omitted, beta is excluded from the response."
        ),
    )
    portfolio_value: float = Field(
        ...,
        gt=0,
        description=(
            "Current total portfolio market value in INR. "
            "Used to compute monetary Value at Risk amounts."
        ),
    )
    risk_free_rate_annual: float = Field(
        default=0.04,
        ge=0.0,
        le=1.0,
        description=(
            "Annualised risk-free rate as a decimal fraction (default 0.04 = 4.0%). "
            "Used for Sharpe Ratio and Sortino Ratio excess-return calculations. "
            "Should reflect the prevailing RBI Repo Rate or 91-day T-bill yield."
        ),
    )
    benchmark_id: str | None = Field(
        default=None,
        description=(
            "Optional: benchmark identifier (e.g. 'NIFTY_50', 'SENSEX'). "
            "Echoed in the beta section of the response. "
            "Ignored when benchmark_returns is None."
        ),
    )

    @model_validator(mode="after")
    def validate_benchmark_alignment(self) -> "RiskSummaryRequest":
        """Benchmark returns must be aligned (same length) with portfolio returns."""
        if self.benchmark_returns is not None:
            if len(self.benchmark_returns) != len(self.daily_returns):
                raise ValueError(
                    f"benchmark_returns must have the same length as daily_returns. "
                    f"Got portfolio={len(self.daily_returns)}, benchmark={len(self.benchmark_returns)}."
                )
        return self

    @field_validator("daily_returns", "benchmark_returns", mode="before")
    @classmethod
    def no_nan_or_inf(cls, v: list[float] | None) -> list[float] | None:
        """Reject NaN or infinite return values — they produce undefined risk metrics."""
        if v is None:
            return v
        bad = [
            i for i, r in enumerate(v)
            if not isinstance(r, (int, float)) or not math.isfinite(r)
        ]
        if bad:
            raise ValueError(
                f"Return series contains {len(bad)} non-finite or non-numeric value(s) "
                f"at indices {bad[:5]}. All return values must be finite real numbers."
            )
        return v


class VaREstimateDto(BaseModel):
    """A single Value at Risk estimate for one method and one confidence level."""

    method: str = Field(
        ...,
        description="Computation method: 'parametric' (normal distribution) or 'historical' (empirical quantile).",
    )
    confidence_level: float = Field(
        ...,
        description="Confidence level as a decimal (e.g. 0.95 = 95%).",
    )
    var_pct: float = Field(
        ...,
        description=(
            "VaR expressed as a percentage of portfolio value (positive). "
            "E.g. 2.5 means the portfolio may lose up to 2.5% in one trading day "
            "at this confidence level."
        ),
    )
    var_amount: float = Field(
        ...,
        description=(
            "VaR in home currency (INR). Positive number = maximum expected 1-day loss. "
            "E.g. 50000 means the portfolio may lose up to ₹50,000."
        ),
    )


class VaRDto(BaseModel):
    """All four Value at Risk estimates (2 methods × 2 confidence levels)."""

    parametric_95: VaREstimateDto = Field(..., description="Parametric VaR at 95% confidence.")
    parametric_99: VaREstimateDto = Field(..., description="Parametric VaR at 99% confidence.")
    historical_95: VaREstimateDto = Field(..., description="Historical Simulation VaR at 95% confidence.")
    historical_99: VaREstimateDto = Field(..., description="Historical Simulation VaR at 99% confidence.")


class DrawdownDto(BaseModel):
    """Maximum Drawdown metrics."""

    max_drawdown: float = Field(
        ...,
        description=(
            "Maximum peak-to-trough drawdown as a decimal fraction (≤ 0). "
            "E.g. -0.35 = the portfolio fell 35% from its peak at worst."
        ),
    )
    max_drawdown_pct: float = Field(
        ...,
        description="Maximum drawdown expressed as a percentage (e.g. -35.0).",
    )
    peak_index: int = Field(
        ...,
        description="Index in the return series of the portfolio peak before the worst drawdown.",
    )
    trough_index: int = Field(
        ...,
        description="Index of the portfolio's worst point (trough) during the maximum drawdown.",
    )
    recovery_index: int | None = Field(
        ...,
        description=(
            "Index where the portfolio first recovered to its pre-drawdown peak. "
            "Null if the portfolio had not recovered by the end of the observation window."
        ),
    )
    drawdown_duration: int = Field(
        ...,
        description="Number of trading days from the peak to the trough.",
    )
    recovery_duration: int | None = Field(
        ...,
        description=(
            "Number of trading days from the trough to recovery. "
            "Null if not yet recovered."
        ),
    )


class BetaDto(BaseModel):
    """Beta (systematic risk) metrics against the benchmark."""

    beta: float = Field(
        ...,
        description=(
            "Systematic risk coefficient. β=1.0 mirrors the benchmark exactly. "
            "β>1.0 amplifies benchmark movements. β<1.0 is defensive."
        ),
    )
    benchmark_id: str = Field(..., description="Benchmark identifier.")
    covariance: float = Field(
        ...,
        description="Sample covariance between portfolio and benchmark daily returns.",
    )
    benchmark_variance: float = Field(
        ...,
        description="Sample variance of benchmark daily returns.",
    )


class RiskSummaryResponse(BaseModel):
    """
    Full risk summary response for POST /api/v1/risk/summary.

    Aggregates all seven risk dimensions into a single response payload:
    volatility, beta (optional), Sharpe, Sortino, max drawdown, VaR, and
    a headline correlation to benchmark (when provided).
    """

    portfolio_id: str = Field(..., description="Portfolio identifier echoed from request.")
    n_observations: int = Field(
        ...,
        description="Number of daily return observations used for all calculations.",
    )
    risk_free_rate_annual: float = Field(
        ...,
        description="Annualised risk-free rate used for Sharpe and Sortino calculations.",
    )

    # ── Volatility ─────────────────────────────────────────────────────────────
    daily_volatility: float = Field(
        ...,
        description="Sample standard deviation of the daily return series (not annualised).",
    )
    annual_volatility: float = Field(
        ...,
        description="Annualised volatility: daily_volatility × √252.",
    )
    annual_volatility_pct: float = Field(
        ...,
        description="Annualised volatility expressed as a percentage (e.g. 18.5 = 18.5%).",
    )

    # ── Sharpe Ratio ───────────────────────────────────────────────────────────
    sharpe_ratio: float = Field(
        ...,
        description=(
            "Annualised Sharpe Ratio = (annualised excess return) / (annualised volatility). "
            "Higher is better. > 1.0 is acceptable; > 2.0 is very good."
        ),
    )
    annualised_excess_return: float = Field(
        ...,
        description="Mean daily excess return (above risk-free rate) scaled to annual.",
    )

    # ── Sortino Ratio ──────────────────────────────────────────────────────────
    sortino_ratio: float = Field(
        ...,
        description=(
            "Annualised Sortino Ratio = (annualised excess return) / (annualised downside deviation). "
            "Uses only downside volatility; ignores upside movements."
        ),
    )
    downside_deviation_annual: float = Field(
        ...,
        description="Annualised downside deviation (semi-standard deviation below the MAR).",
    )
    n_downside_observations: int = Field(
        ...,
        description="Number of trading days where the return was below the MAR threshold.",
    )

    # ── Maximum Drawdown ───────────────────────────────────────────────────────
    drawdown: DrawdownDto = Field(..., description="Maximum Drawdown metrics.")

    # ── Value at Risk ──────────────────────────────────────────────────────────
    var: VaRDto = Field(..., description="Value at Risk estimates (parametric and historical, 95% and 99%).")

    # ── Beta (optional — only present when benchmark_returns is provided) ──────
    beta: BetaDto | None = Field(
        default=None,
        description=(
            "Beta (systematic risk) against the benchmark. "
            "Null when no benchmark_returns were provided in the request."
        ),
    )


# ── Drawdown Series Schemas ────────────────────────────────────────────────────


class DrawdownSeriesRequest(BaseModel):
    """
    Request body for POST /api/v1/risk/drawdown-series.

    Returns the full time series of drawdown values (D_t at each observation),
    not just the maximum. Useful for charting underwater equity curves.
    """

    portfolio_id: str = Field(
        ...,
        description="Portfolio identifier (echoed in response).",
    )
    daily_returns: Annotated[
        list[float],
        Field(
            min_length=1,
            description="Ordered daily simple returns for the portfolio/asset.",
        ),
    ]

    @field_validator("daily_returns", mode="before")
    @classmethod
    def no_nan_or_inf(cls, v: list[float]) -> list[float]:
        bad = [i for i, r in enumerate(v) if not math.isfinite(r)]
        if bad:
            raise ValueError(
                f"Return series contains {len(bad)} non-finite value(s) at indices {bad[:5]}."
            )
        return v


class DrawdownSeriesResponse(BaseModel):
    """
    Drawdown time series response for POST /api/v1/risk/drawdown-series.

    Each value in drawdown_series represents the percentage decline from the
    running portfolio peak at that observation: D_t = (V_t − P_t) / P_t × 100.
    Values are always ≤ 0 (0 = at or above prior peak).
    """

    portfolio_id: str
    drawdown_series_pct: list[float] = Field(
        ...,
        description=(
            "Time series of drawdown percentages (D_t × 100) at each observation. "
            "Values are ≤ 0. Length = len(daily_returns) + 1 (includes V_0 = 0.0)."
        ),
    )
    max_drawdown_pct: float = Field(
        ...,
        description="The minimum (most negative) value in drawdown_series_pct.",
    )
    n_observations: int = Field(..., description="Total NAV observations including the starting value.")


# ── Correlation Matrix Schemas ─────────────────────────────────────────────────


class CorrelationRequest(BaseModel):
    """
    Request body for POST /api/v1/risk/correlation.

    Computes the pairwise Pearson correlation matrix for a set of assets
    from their aligned daily return time series. All series must have
    equal length (aligned on the same trading dates).
    """

    assets: Annotated[
        list[AssetReturnSeries],
        Field(
            min_length=1,
            description=(
                "List of named asset return series. Must have equal-length daily_returns. "
                "Minimum 1 asset (returns 1×1 identity matrix)."
            ),
        ),
    ]

    @model_validator(mode="after")
    def validate_aligned_lengths(self) -> "CorrelationRequest":
        """All asset return series must have the same length."""
        lengths = {a.asset_id: len(a.daily_returns) for a in self.assets}
        unique = set(lengths.values())
        if len(unique) > 1:
            raise ValueError(
                f"All asset return series must have equal length for date alignment. "
                f"Found lengths: {lengths}"
            )
        return self


class CorrelationResponse(BaseModel):
    """
    Pairwise Pearson correlation matrix response for POST /api/v1/risk/correlation.

    The matrix is symmetric with 1.0 on the diagonal.
    matrix[i][j] is the Pearson correlation between assets[i] and assets[j].
    """

    asset_ids: list[str] = Field(
        ...,
        description="Ordered list of asset identifiers (row/column labels of the matrix).",
    )
    matrix: list[list[float]] = Field(
        ...,
        description=(
            "N×N Pearson correlation matrix as a list of rows. "
            "Symmetric (matrix[i][j] == matrix[j][i]). "
            "Diagonal values are exactly 1.0. "
            "Values bounded to [−1.0, 1.0]."
        ),
    )
    n_assets: int = Field(..., description="Number of assets in the correlation matrix.")
    n_observations: int = Field(
        ...,
        description="Number of daily return observations used per asset pair.",
    )


# ── Diversification & Concentration Schemas ────────────────────────────────────


class DiversificationAssetWeight(BaseModel):
    """A single asset weight entry for the diversification request."""

    asset_id: str = Field(
        ...,
        description="Asset or position identifier (must match correlation_asset_ids when provided).",
    )
    weight: float = Field(
        ...,
        gt=0,
        description=(
            "Asset weight. Accepts fractions (0–1) or percentages (0–100). "
            "The engine auto-normalises so all weights sum to 1.0. "
            "Zero and negative values are excluded."
        ),
    )


class DiversificationRequest(BaseModel):
    """
    Request body for POST /api/v1/risk/diversification.

    Computes HHI, Effective N, Top-N concentration ratios, and a composite
    0–100 Diversification Score for a portfolio of weighted assets.

    Correlation data is optional. When provided, it enriches the score's
    Component B (correlation penalty). When omitted, Component B defaults
    to 50 (neutral — uncorrelated assumption).
    """

    portfolio_id: str = Field(
        ...,
        description="Portfolio or asset-set identifier (echoed in response for tracing).",
    )
    asset_weights: Annotated[
        list[DiversificationAssetWeight],
        Field(
            min_length=1,
            description=(
                "List of asset_id / weight pairs. "
                "Minimum 1 asset required. Weights are auto-normalised."
            ),
        ),
    ]
    sector_weights: list[DiversificationAssetWeight] | None = Field(
        default=None,
        description=(
            "Optional: sector-label / weight pairs for sector-level HHI computation. "
            "Uses same normalisation rules as asset_weights. "
            "When omitted, hhi_sector in the response will be null."
        ),
    )
    correlation_matrix: list[list[float]] | None = Field(
        default=None,
        description=(
            "Optional: N×N Pydantic Pearson correlation matrix (list of rows). "
            "Must be provided together with correlation_asset_ids. "
            "When omitted, Component B of the diversification score defaults to 50 (neutral)."
        ),
    )
    correlation_asset_ids: list[str] | None = Field(
        default=None,
        description=(
            "Ordered list of asset IDs corresponding to rows/columns of correlation_matrix. "
            "Must match the matrix dimension exactly."
        ),
    )
    top_n_ratios: list[int] | None = Field(
        default=None,
        description=(
            "N values for Top-N concentration ratio cut-offs (e.g. [3, 5, 10]). "
            "Defaults to [3, 5, 10] when not provided."
        ),
    )

    @model_validator(mode="after")
    def validate_correlation_consistency(self) -> "DiversificationRequest":
        """correlation_matrix and correlation_asset_ids must be both provided or both omitted."""
        has_matrix = self.correlation_matrix is not None
        has_ids = self.correlation_asset_ids is not None
        if has_matrix != has_ids:
            raise ValueError(
                "correlation_matrix and correlation_asset_ids must be provided together. "
                "Either supply both or omit both."
            )
        if has_matrix and has_ids:
            n_ids = len(self.correlation_asset_ids)  # type: ignore[arg-type]
            n_rows = len(self.correlation_matrix)  # type: ignore[arg-type]
            if n_rows != n_ids or any(
                len(row) != n_ids for row in self.correlation_matrix  # type: ignore[union-attr]
            ):
                raise ValueError(
                    f"correlation_matrix must be {n_ids}×{n_ids} to match "
                    f"correlation_asset_ids length ({n_ids}). "
                    f"Got {n_rows} rows."
                )
        return self


class ConcentrationRatioDto(BaseModel):
    """A single Top-N concentration ratio result."""

    n: int = Field(..., description="Top-N cut-off value (e.g. 3, 5, 10).")
    asset_ids: list[str] = Field(
        ...,
        description="Identifiers of the top-N assets, sorted by weight descending.",
    )
    weight_pct: float = Field(
        ...,
        description=(
            "Combined weight of the top-N assets expressed as a percentage (0–100). "
            "E.g. 45.23 means the top-N assets hold 45.23% of the portfolio."
        ),
    )
    actual_n: int = Field(
        ...,
        description=(
            "Actual number of assets included in this ratio. "
            "May be less than n for small portfolios."
        ),
    )


class DiversificationResponse(BaseModel):
    """
    Full diversification and concentration analytics response
    for POST /api/v1/risk/diversification.

    Combines three complementary concentration signals:
    1. HHI (asset-level and sector-level)
    2. Top-N concentration ratios
    3. Composite 0–100 Diversification Score
    """

    portfolio_id: str = Field(..., description="Portfolio identifier echoed from request.")
    n_assets: int = Field(
        ...,
        description="Number of assets with non-zero weight in the portfolio.",
    )

    # ── HHI & Effective N ──────────────────────────────────────────────────────
    hhi: float = Field(
        ...,
        description=(
            "Asset-level Herfindahl-Hirschman Index on the 10,000-point scale. "
            "HHI = Σ(w_i × 100)². "
            "Range: 10,000 (single-asset) → approaches 0 (equally dispersed)."
        ),
    )
    hhi_sector: float | None = Field(
        default=None,
        description=(
            "Sector-level HHI (same 10,000-point scale). "
            "Null when sector_weights were not provided in the request."
        ),
    )
    effective_n: float = Field(
        ...,
        description=(
            "Equivalent equal-weight portfolio size = 10,000 / HHI. "
            "Represents the number of equally-weighted uncorrelated assets that "
            "would achieve the same weight concentration as this portfolio."
        ),
    )
    effective_n_pct_of_max: float = Field(
        ...,
        description=(
            "effective_n expressed as a percentage of n_assets (0–100). "
            "100% = perfectly equal-weighted. <50% = materially top-heavy."
        ),
    )

    # ── Top-N Concentration Ratios ─────────────────────────────────────────────
    concentration_ratios: list[ConcentrationRatioDto] = Field(
        ...,
        description=(
            "Top-N concentration ratios for each requested N value. "
            "Sorted by N ascending."
        ),
    )

    # ── Correlation ────────────────────────────────────────────────────────────
    weighted_avg_correlation: float | None = Field(
        default=None,
        description=(
            "Weight-averaged pairwise Pearson correlation across all asset pairs. "
            "Null when no correlation data was provided. "
            "Range: [−1, 1]. Lower values indicate better diversification."
        ),
    )

    # ── Composite Score ────────────────────────────────────────────────────────
    diversification_score: float = Field(
        ...,
        description=(
            "Composite diversification score in [0, 100]. "
            "= 0.60 × component_a_score + 0.40 × component_b_score. "
            "Higher = better diversified. "
            "< 10: highly concentrated; 10–50: moderate; 50–85: good; >85: excellent."
        ),
    )
    component_a_score: float = Field(
        ...,
        description=(
            "Effective-N sub-score in [0, 100] (weight: 60%). "
            "100 = perfectly equal-weighted. Penalises top-heavy portfolios."
        ),
    )
    component_b_score: float = Field(
        ...,
        description=(
            "Correlation penalty sub-score in [0, 100] (weight: 40%). "
            "100 = perfectly negatively correlated (maximum hedge). "
            "50 = uncorrelated (assumed when no data provided). "
            "0 = perfectly positively correlated (no diversification benefit)."
        ),
    )
    correlation_data_used: bool = Field(
        ...,
        description=(
            "True when actual correlation data was used to compute component_b_score. "
            "False when component_b_score defaulted to 50 (neutral / no-data)."
        ),
    )
