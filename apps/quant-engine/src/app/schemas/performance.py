"""
Pydantic request/response schemas for the performance analytics router.

All monetary values are accepted as plain floats — the quant engine receives
pre-computed totals from the NestJS valuation layer (which applies Decimal.js
precision) and returns percentage/ratio metrics as Python IEEE 754 doubles.
"""

# Note: NO `from __future__ import annotations` — Pydantic v2 on Python 3.13
# has a known conflict when field names match imported types under deferred
# annotation evaluation. We use explicit Optional / Union types instead.

from datetime import date as Date
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, model_validator


# ── Shared primitives ──────────────────────────────────────────────────────────

class CashFlowItem(BaseModel):
    """A single dated cash flow for XIRR/TWR computation."""

    flow_date: Date = Field(..., description="ISO 8601 date of the cash flow")
    amount: float = Field(
        ...,
        description=(
            "Signed cash flow amount in home currency. "
            "Negative = outflow (BUY/DEPOSIT). "
            "Positive = inflow (SELL/DIVIDEND/current portfolio value)."
        ),
    )


# ── TWR Schemas ────────────────────────────────────────────────────────────────

class SubPeriodItem(BaseModel):
    """One sub-period in the TWR calculation (bounded by cash-flow break points)."""

    start_date: Date = Field(..., description="Start date of the sub-period (inclusive)")
    end_date: Date = Field(..., description="End date of the sub-period (inclusive)")
    bmv: float = Field(..., description="Beginning Market Value (after start-of-period cash flows)")
    emv: float = Field(..., description="Ending Market Value (before end-of-period cash flows)")
    cash_flows: list[CashFlowItem] = Field(
        default_factory=list,
        description="Cash flow events within the sub-period (after start_date, on or before end_date)",
    )

    @model_validator(mode="after")
    def validate_dates(self) -> "SubPeriodItem":
        if self.end_date < self.start_date:
            raise ValueError(
                f"end_date ({self.end_date}) must be >= start_date ({self.start_date})"
            )
        return self


class TwrRequest(BaseModel):
    """Request body for the TWR computation endpoint."""

    portfolio_id: str = Field(..., description="Portfolio UUID (for logging/tracing)")
    sub_periods: Annotated[
        list[SubPeriodItem],
        Field(min_length=1, description="Chronologically ordered sub-periods"),
    ]


class TwrResponse(BaseModel):
    """Time-Weighted Return computation result."""

    portfolio_id: str
    twr_cumulative: float = Field(
        ..., description="Cumulative TWR over the full period (decimal, e.g. 0.15 = 15%)"
    )
    twr_annualised: Optional[float] = Field(
        None,
        description="Annualised TWR. None if the window is < 2 days.",
    )
    twr_cumulative_pct: float = Field(
        ..., description="twr_cumulative expressed as a percentage (e.g. 15.0)"
    )
    twr_annualised_pct: Optional[float] = Field(
        None, description="twr_annualised expressed as a percentage. None if not computable."
    )
    sub_period_returns: list[float] = Field(
        ..., description="Individual Modified Dietz return per sub-period"
    )
    total_days: int = Field(..., description="Calendar days in the full evaluation window")
    n_sub_periods: int = Field(..., description="Number of sub-periods used in chain-linking")


# ── XIRR Schemas ──────────────────────────────────────────────────────────────

class XirrRequest(BaseModel):
    """Request body for the XIRR computation endpoint."""

    portfolio_id: str = Field(..., description="Portfolio UUID (for logging/tracing)")
    cash_flows: Annotated[
        list[CashFlowItem],
        Field(min_length=2, description="Non-periodic cash flows sorted chronologically"),
    ]
    guess: float = Field(
        default=0.10,
        ge=-0.9999,
        le=10.0,
        description="Initial Newton-Raphson seed rate (default 10%)",
    )


class XirrResponse(BaseModel):
    """XIRR computation result."""

    portfolio_id: str
    xirr: float = Field(..., description="Annualised XIRR as decimal (e.g. 0.198 = 19.8%)")
    xirr_pct: float = Field(..., description="XIRR expressed as a percentage (e.g. 19.8)")
    npv_at_solution: float = Field(
        ..., description="NPV value at the solved rate. Should be near 0."
    )
    solver_used: Literal["newton_raphson", "brent_dekker"] = Field(
        ..., description="Which numerical solver converged"
    )
    iterations: int = Field(..., description="Newton-Raphson iterations consumed")
    n_cash_flows: int = Field(..., description="Number of cash flow events processed")
    twr_fallback: bool = Field(
        default=False,
        description="True when XIRR could not converge and TWR should be displayed instead",
    )


class XirrFallbackResponse(BaseModel):
    """Returned when XIRR fails to converge (both solvers exhausted)."""

    portfolio_id: str
    twr_fallback: bool = Field(default=True)
    error: str = Field(..., description="Human-readable convergence failure message")
    suggestion: str = Field(
        default="XIRR could not be calculated. Please display TWR instead.",
    )


# ── Benchmark Schemas ──────────────────────────────────────────────────────────

class BenchmarkRequest(BaseModel):
    """Request body for the benchmark metrics endpoint."""

    portfolio_id: str = Field(..., description="Portfolio UUID (for logging/tracing)")
    benchmark_id: str = Field(
        ...,
        description="Benchmark identifier (e.g. 'NIFTY50', 'SP500', 'BTC')",
    )
    portfolio_prices: Annotated[
        list[float],
        Field(min_length=3, description="Chronologically ordered portfolio NAV/value series"),
    ]
    benchmark_prices: Annotated[
        list[float],
        Field(min_length=3, description="Chronologically ordered benchmark price series (same length as portfolio_prices)"),
    ]
    risk_free_rate_annual: float = Field(
        default=0.065,
        ge=0.0,
        le=1.0,
        description="Annual risk-free rate as decimal (default 6.5% = Indian 10Y G-Sec)",
    )

    @model_validator(mode="after")
    def validate_series_lengths(self) -> "BenchmarkRequest":
        if len(self.portfolio_prices) != len(self.benchmark_prices):
            raise ValueError(
                f"portfolio_prices (len={len(self.portfolio_prices)}) and "
                f"benchmark_prices (len={len(self.benchmark_prices)}) must have the same length."
            )
        return self


class BenchmarkResponse(BaseModel):
    """Full benchmark comparison metrics response."""

    portfolio_id: str
    benchmark_id: str
    beta: float = Field(..., description="Portfolio beta relative to benchmark")
    alpha_annualised: float = Field(..., description="Jensen's Alpha (annualised decimal)")
    alpha_annualised_pct: float = Field(..., description="Jensen's Alpha as percentage")
    correlation: float = Field(..., description="Pearson correlation [-1, 1]")
    tracking_error_annualised: float = Field(..., description="Annualised tracking error (decimal)")
    tracking_error_annualised_pct: float = Field(..., description="Tracking error as percentage")
    information_ratio: Optional[float] = Field(None, description="Information ratio (None if TE=0)")
    sharpe_ratio: float = Field(..., description="Annualised Sharpe ratio")
    sortino_ratio: float = Field(..., description="Annualised Sortino ratio")
    portfolio_volatility_annualised_pct: float = Field(..., description="Annualised portfolio volatility %")
    benchmark_volatility_annualised_pct: float = Field(..., description="Annualised benchmark volatility %")
    n_observations: int = Field(..., description="Number of daily return observations used")
    risk_free_rate_annual_pct: float = Field(..., description="Risk-free rate used (%)")
