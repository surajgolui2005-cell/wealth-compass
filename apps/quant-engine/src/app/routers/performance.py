"""Performance analytics router.

Exposes three computation endpoints:
    POST /api/v1/performance/twr        — Time-Weighted Return
    POST /api/v1/performance/xirr       — Extended IRR (Newton-Raphson + Brent)
    POST /api/v1/performance/benchmark  — Beta, Alpha, Sharpe, Sortino, TE, IR

All endpoints are internal-only (no public routing). The NestJS API Gateway
calls these endpoints over the private container network, authenticated via
a short-lived RS256 JWT validated by the `verify_internal_token` dependency.

Math engines used:
    src.analytics.twr        → compute_twr, SubPeriod, CashFlowEvent
    src.analytics.xirr       → compute_xirr, CashFlow, XirrConvergenceError
    src.analytics.benchmark  → compute_benchmark_metrics
"""

import logging
import math

from fastapi import APIRouter, HTTPException, status

from src.analytics.benchmark import compute_benchmark_metrics
from src.analytics.twr import CashFlowEvent, SubPeriod, compute_twr
from src.analytics.xirr import CashFlow, XirrConvergenceError, compute_xirr
from src.app.schemas.performance import (
    BenchmarkRequest,
    BenchmarkResponse,
    TwrRequest,
    TwrResponse,
    XirrFallbackResponse,
    XirrRequest,
    XirrResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/performance",
    tags=["Performance Analytics"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pct(value: float | None) -> float | None:
    """Convert a decimal fraction to a percentage. Returns None for None/NaN inputs."""
    if value is None or math.isnan(value):
        return None
    return round(value * 100, 6)


def _safe_pct(value: float) -> float:
    """Convert decimal to percentage, returning NaN-safe float."""
    if math.isnan(value) or math.isinf(value):
        return value
    return value * 100


# ── TWR Endpoint ──────────────────────────────────────────────────────────────

@router.post(
    "/twr",
    response_model=TwrResponse,
    summary="Time-Weighted Return (TWR)",
    description=(
        "Computes the Time-Weighted Return (TWR) for a portfolio using the Modified Dietz "
        "method with sub-period chain-linking. Sub-periods must be split on all days "
        "with external cash flows (deposits/withdrawals). "
        "Reference: GIPS 2020 §2.A.2."
    ),
    responses={
        400: {"description": "Invalid sub-period ordering or date range"},
    },
)
async def compute_twr_endpoint(body: TwrRequest) -> TwrResponse:
    """
    POST /api/v1/performance/twr

    Accepts an ordered list of sub-periods and returns cumulative + annualised TWR.

    **Sub-period boundary rule:** A new sub-period must begin on every day with an
    external cash flow. The NestJS layer is responsible for splitting the evaluation
    window correctly before calling this endpoint.
    """
    try:
        # Map request schema → domain types
        sub_periods: list[SubPeriod] = [
            SubPeriod(
                start_date=sp.start_date,
                end_date=sp.end_date,
                bmv=sp.bmv,
                emv=sp.emv,
                cash_flows=[
                    CashFlowEvent(date=cf.flow_date, amount=cf.amount)
                    for cf in sp.cash_flows
                ],
            )
            for sp in body.sub_periods
        ]

        result = compute_twr(sub_periods)
        logger.info(
            "TWR computed for portfolio_id=%s: cumulative=%.4f%% annualised=%.4f%%",
            body.portfolio_id,
            result.twr_cumulative * 100,
            (result.twr_annualised or 0.0) * 100,
        )

        return TwrResponse(
            portfolio_id=body.portfolio_id,
            twr_cumulative=result.twr_cumulative,
            twr_annualised=result.twr_annualised,
            twr_cumulative_pct=result.twr_cumulative * 100,
            twr_annualised_pct=_pct(result.twr_annualised),
            sub_period_returns=result.sub_period_returns,
            total_days=result.total_days,
            n_sub_periods=result.n_sub_periods,
        )

    except ValueError as exc:
        logger.warning("TWR validation error for portfolio_id=%s: %s", body.portfolio_id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── XIRR Endpoint ─────────────────────────────────────────────────────────────

@router.post(
    "/xirr",
    response_model=XirrResponse | XirrFallbackResponse,
    summary="Extended Internal Rate of Return (XIRR)",
    description=(
        "Computes XIRR for non-periodic cash flows using Newton-Raphson (primary) "
        "and Brent–Dekker fallback solver. Returns a TWR-fallback flag and structured "
        "error when neither solver converges (e.g., pathological alternating cash flows). "
        "Reference: GIPS 2020 §2.A.6; Excel XIRR specification."
    ),
    responses={
        400: {"description": "Invalid cash flows (fewer than 2, or all same sign)"},
        422: {"description": "XIRR could not converge — use TWR instead"},
    },
)
async def compute_xirr_endpoint(body: XirrRequest) -> XirrResponse | XirrFallbackResponse:
    """
    POST /api/v1/performance/xirr

    Cash flow sign convention:
    - **Negative** = money leaving the investor (BUY, DEPOSIT).
    - **Positive** = money entering the investor (SELL, DIVIDEND, current portfolio value).

    The final cash flow should be the current portfolio market value (positive)
    appended to "close" the XIRR equation as of today's date.

    When XIRR cannot converge, returns HTTP 200 with `twr_fallback: true`
    and a human-readable message for the UI to display TWR instead.
    """
    cash_flows = [
        CashFlow(date=cf.flow_date, amount=cf.amount)
        for cf in body.cash_flows
    ]

    try:
        result = compute_xirr(cash_flows, guess=body.guess)
        logger.info(
            "XIRR computed for portfolio_id=%s: xirr=%.4f%% solver=%s iterations=%d",
            body.portfolio_id,
            result.xirr * 100,
            result.solver_used,
            result.iterations,
        )
        return XirrResponse(
            portfolio_id=body.portfolio_id,
            xirr=result.xirr,
            xirr_pct=result.xirr * 100,
            npv_at_solution=result.npv_at_solution,
            solver_used=result.solver_used,
            iterations=result.iterations,
            n_cash_flows=result.n_cash_flows,
            twr_fallback=False,
        )

    except ValueError as exc:
        # Input validation failure (fewer than 2 flows, all same sign)
        logger.warning("XIRR validation error for portfolio_id=%s: %s", body.portfolio_id, exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    except XirrConvergenceError as exc:
        # Solver could not find a root — return structured fallback response
        # (HTTP 200, not 5xx — the math failed, not the server)
        logger.warning(
            "XIRR non-convergence for portfolio_id=%s. Returning TWR fallback. Detail: %s",
            body.portfolio_id,
            exc,
        )
        return XirrFallbackResponse(
            portfolio_id=body.portfolio_id,
            twr_fallback=True,
            error=str(exc),
            suggestion=(
                "XIRR could not be calculated — please display TWR instead. "
                "This typically occurs with highly irregular or alternating cash flows."
            ),
        )


# ── Benchmark Endpoint ────────────────────────────────────────────────────────

@router.post(
    "/benchmark",
    response_model=BenchmarkResponse,
    summary="Benchmark Comparison Metrics",
    description=(
        "Computes the full suite of benchmark-relative metrics: Beta, Jensen's Alpha, "
        "Sharpe Ratio, Sortino Ratio, Tracking Error, Information Ratio, and Pearson "
        "Correlation. Both series must be aligned on the same dates. "
        "All daily metrics are annualised using 252 trading days."
    ),
    responses={
        400: {"description": "Series length mismatch or insufficient observations"},
    },
)
async def compute_benchmark_endpoint(body: BenchmarkRequest) -> BenchmarkResponse:
    """
    POST /api/v1/performance/benchmark

    Accepts aligned portfolio NAV and benchmark price series and returns the full
    suite of risk-adjusted performance metrics.

    - `portfolio_prices`: Portfolio total value series (same frequency as benchmark)
    - `benchmark_prices`: Benchmark index close prices (e.g., Nifty 50 daily close)
    - `risk_free_rate_annual`: Default 6.5% (Indian 10Y G-Sec, 2026)

    Returns `nan` for metrics that cannot be computed (e.g., Sortino when there
    are no downside observations, IR when tracking error is 0).
    """
    try:
        metrics = compute_benchmark_metrics(
            portfolio_prices=body.portfolio_prices,
            benchmark_prices=body.benchmark_prices,
            risk_free_rate_annual=body.risk_free_rate_annual,
        )
        logger.info(
            "Benchmark metrics computed for portfolio_id=%s vs %s: "
            "beta=%.3f alpha=%.2f%% sharpe=%.3f",
            body.portfolio_id,
            body.benchmark_id,
            metrics.beta,
            metrics.alpha_annualised * 100,
            metrics.sharpe_ratio,
        )
        return BenchmarkResponse(
            portfolio_id=body.portfolio_id,
            benchmark_id=body.benchmark_id,
            beta=metrics.beta,
            alpha_annualised=metrics.alpha_annualised,
            alpha_annualised_pct=_safe_pct(metrics.alpha_annualised),
            correlation=metrics.correlation,
            tracking_error_annualised=metrics.tracking_error_annualised,
            tracking_error_annualised_pct=_safe_pct(metrics.tracking_error_annualised),
            information_ratio=metrics.information_ratio,
            sharpe_ratio=metrics.sharpe_ratio,
            sortino_ratio=metrics.sortino_ratio,
            portfolio_volatility_annualised_pct=_safe_pct(metrics.portfolio_volatility_annualised),
            benchmark_volatility_annualised_pct=_safe_pct(metrics.benchmark_volatility_annualised),
            n_observations=metrics.n_observations,
            risk_free_rate_annual_pct=body.risk_free_rate_annual * 100,
        )

    except ValueError as exc:
        logger.warning(
            "Benchmark validation error for portfolio_id=%s: %s", body.portfolio_id, exc
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
