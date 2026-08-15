"""
Benchmark Comparison Analytics
===============================

Mathematical Foundation
-----------------------

This module computes portfolio performance metrics relative to a benchmark
index (e.g., Nifty 50, S&P 500, Bitcoin). All metrics are derived from the
time series of daily portfolio returns (r_p) and daily benchmark returns (r_b).

Daily Return
------------
For a given day t:

    r_t = (V_t - V_{t-1}) / V_{t-1}

Where V_t is the portfolio or benchmark value on day t.

Portfolio Beta
--------------
Beta measures the portfolio's sensitivity to benchmark movements.

                   Cov(r_p, r_b)
    β = ─────────────────────────────────
                   Var(r_b)

Where:
    Cov(r_p, r_b) = sample covariance of portfolio and benchmark daily returns
    Var(r_b)      = sample variance of benchmark daily returns

A β > 1 means the portfolio moves more than the benchmark;
β < 1 means it moves less; β < 0 means it tends to move inversely.

Jensen's Alpha (Daily, Annualised)
------------------------------------
Alpha is the excess return above what the CAPM model predicts given the
portfolio's beta:

    α = E[r_p] - [r_f + β × (E[r_b] - r_f)]

Where r_f is the daily risk-free rate (derived from annual rate: r_f = (1 + R_f)^(1/252) - 1).

To annualise the daily alpha:
    α_annualised = (1 + α_daily)^252 - 1

Tracking Error (TE)
-------------------
Tracking Error is the standard deviation of the active return (portfolio minus benchmark):

    TE = std(r_p - r_b)

Annualised TE is scaled by the square root of the number of trading days:
    TE_annualised = TE_daily × √252

Information Ratio (IR)
-----------------------
The Information Ratio is the ratio of annualised active return to tracking error:

               mean(r_p - r_b) × 252
    IR = ────────────────────────────────
                TE_annualised

A high positive IR indicates consistent outperformance relative to the benchmark.

Sharpe Ratio
------------
Measures excess return per unit of total risk:

               E[r_p] - r_f
    Sharpe = ──────────────────  × √252
               std(r_p)

Sortino Ratio
-------------
Like Sharpe but only penalises downside volatility:

               E[r_p] - r_f
    Sortino = ──────────────────  × √252
               std(r_p | r_p < r_f)

Where the denominator is the standard deviation of returns below r_f only
(the "downside deviation").

Correlation (Pearson)
---------------------
    ρ = Cor(r_p, r_b) = Cov(r_p, r_b) / (σ_p × σ_b)

Ranges in [-1.0, +1.0]. Values near +1 indicate the portfolio moves in lockstep
with the benchmark.

References
----------
    - Jensen, M. (1968), "The Performance of Mutual Funds in the Period 1945–64"
    - Sharpe, W. (1994), "The Sharpe Ratio"
    - Sortino, F. & van der Meer, R. (1991), "Downside Risk"
    - Grinold & Kahn, "Active Portfolio Management" (2000)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

import numpy as np


# ── Constants ─────────────────────────────────────────────────────────────────

_TRADING_DAYS_PER_YEAR: int = 252          # Standard annualisation factor for equities
_DEFAULT_RISK_FREE_RATE: float = 0.065     # 6.5% p.a. (approx. 2026 Indian 10Y G-Sec)
_MIN_OBSERVATIONS: int = 2                # Minimum data points for any statistic


# ── Domain Types ──────────────────────────────────────────────────────────────

@dataclass
class BenchmarkMetrics:
    """
    Full set of benchmark-relative performance metrics.

    All return metrics are expressed as annualised decimal fractions.
    e.g., sharpe_ratio = 1.25 (dimensionless), alpha = 0.05 = 5% p.a.

    Attributes
    ----------
    beta:
        Portfolio beta relative to benchmark.
    alpha_annualised:
        Jensen's Alpha annualised. Positive means outperformance beyond CAPM.
    correlation:
        Pearson correlation between portfolio and benchmark daily returns.
    tracking_error_annualised:
        Annualised tracking error (std of active returns × √252).
    information_ratio:
        Active return / tracking error. None if tracking_error is 0.
    sharpe_ratio:
        Annualised Sharpe ratio of the portfolio.
    sortino_ratio:
        Annualised Sortino ratio of the portfolio (downside deviation).
    portfolio_volatility_annualised:
        Annualised standard deviation of portfolio daily returns.
    benchmark_volatility_annualised:
        Annualised standard deviation of benchmark daily returns.
    n_observations:
        Number of aligned daily return observations used.
    risk_free_rate_annual:
        Risk-free rate used in Sharpe/Sortino/Alpha calculations.
    """

    beta: float
    alpha_annualised: float
    correlation: float
    tracking_error_annualised: float
    information_ratio: float | None
    sharpe_ratio: float
    sortino_ratio: float
    portfolio_volatility_annualised: float
    benchmark_volatility_annualised: float
    n_observations: int
    risk_free_rate_annual: float


# ── Internal Helpers ──────────────────────────────────────────────────────────

def _daily_returns(prices: Sequence[float]) -> np.ndarray:
    """
    Converts a price series into a series of daily simple returns.

    r_t = (P_t - P_{t-1}) / P_{t-1}

    Parameters
    ----------
    prices:
        Chronologically ordered price series (length N >= 2).

    Returns
    -------
    np.ndarray of shape (N-1,) with daily return values.

    Raises
    ------
    ValueError
        If any price is <= 0 or the series has fewer than 2 elements.
    """
    arr = np.asarray(prices, dtype=float)
    if len(arr) < 2:
        raise ValueError("Price series must have at least 2 observations.")
    if np.any(arr <= 0):
        raise ValueError("All prices must be strictly positive (> 0).")
    return np.diff(arr) / arr[:-1]


def _annualised_std(returns: np.ndarray, trading_days: int = _TRADING_DAYS_PER_YEAR) -> float:
    """Annualised standard deviation of a daily return series."""
    if len(returns) < 2:
        return float("nan")
    return float(np.std(returns, ddof=1)) * math.sqrt(trading_days)


def _downside_std(returns: np.ndarray, daily_rf: float = 0.0) -> float:
    """
    Downside standard deviation: std of returns strictly below the daily risk-free rate.
    Returns NaN if there are fewer than 2 downside observations.
    """
    below = returns[returns < daily_rf]
    if len(below) < 2:
        return float("nan")
    return float(np.std(below, ddof=1))


# ── Public API ────────────────────────────────────────────────────────────────

def compute_benchmark_metrics(
    portfolio_prices: Sequence[float],
    benchmark_prices: Sequence[float],
    risk_free_rate_annual: float = _DEFAULT_RISK_FREE_RATE,
) -> BenchmarkMetrics:
    """
    Computes the full suite of benchmark-relative performance metrics.

    Both price series must be aligned on the same dates (caller responsibility).
    All computations are vectorised via NumPy for performance on large windows.

    Parameters
    ----------
    portfolio_prices:
        Chronologically ordered portfolio NAV or total-value time series.
        Must be the same length as benchmark_prices.
    benchmark_prices:
        Chronologically ordered benchmark index close price series.
        Must be the same length as portfolio_prices.
    risk_free_rate_annual:
        Annualised risk-free rate as decimal (default: 6.5%, Indian 10Y G-Sec).

    Returns
    -------
    BenchmarkMetrics
        Full suite of benchmark-relative and standalone risk/return metrics.

    Raises
    ------
    ValueError
        If price series lengths differ, or if there are fewer than
        ``_MIN_OBSERVATIONS + 1`` aligned observations (need at least 2 returns).

    Examples
    --------
    >>> portfolio = [100, 102, 101, 105, 108, 107, 110]
    >>> benchmark  = [100, 101, 100, 103, 105, 104, 107]
    >>> metrics = compute_benchmark_metrics(portfolio, benchmark)
    >>> round(metrics.beta, 2)
    1.12       # Portfolio moves ~12% more than benchmark per 1% move
    """
    p_prices = list(portfolio_prices)
    b_prices = list(benchmark_prices)

    if len(p_prices) != len(b_prices):
        raise ValueError(
            f"portfolio_prices (len={len(p_prices)}) and "
            f"benchmark_prices (len={len(b_prices)}) must have the same length."
        )
    if len(p_prices) < _MIN_OBSERVATIONS + 1:
        raise ValueError(
            f"At least {_MIN_OBSERVATIONS + 1} price observations are required "
            f"(got {len(p_prices)})."
        )

    r_p = _daily_returns(p_prices)     # Portfolio daily returns
    r_b = _daily_returns(b_prices)     # Benchmark daily returns
    n = len(r_p)

    # ── Daily risk-free rate ───────────────────────────────────────────────────
    # Convert annual rate to daily compound equivalent
    daily_rf = math.pow(1.0 + risk_free_rate_annual, 1.0 / _TRADING_DAYS_PER_YEAR) - 1.0

    # ── Beta: Cov(r_p, r_b) / Var(r_b) ───────────────────────────────────────
    cov_matrix = np.cov(r_p, r_b, ddof=1)          # 2×2 covariance matrix
    cov_pb = float(cov_matrix[0, 1])
    var_b = float(cov_matrix[1, 1])
    beta = cov_pb / var_b if var_b != 0.0 else float("nan")

    # ── Jensen's Alpha (daily, then annualised) ────────────────────────────────
    mean_rp = float(np.mean(r_p))
    mean_rb = float(np.mean(r_b))
    alpha_daily = mean_rp - (daily_rf + beta * (mean_rb - daily_rf))
    # Compound annualisation: (1 + α_daily)^252 - 1
    try:
        alpha_annualised = math.pow(1.0 + alpha_daily, _TRADING_DAYS_PER_YEAR) - 1.0
    except (ValueError, OverflowError):
        alpha_annualised = float("nan")

    # ── Correlation ────────────────────────────────────────────────────────────
    std_p = float(np.std(r_p, ddof=1))
    std_b = float(np.std(r_b, ddof=1))
    correlation = cov_pb / (std_p * std_b) if (std_p > 0 and std_b > 0) else float("nan")
    # Clamp to [-1, 1] for floating point safety
    correlation = max(-1.0, min(1.0, correlation)) if not math.isnan(correlation) else correlation

    # ── Tracking Error ────────────────────────────────────────────────────────
    active_returns = r_p - r_b
    te_daily = float(np.std(active_returns, ddof=1)) if n >= 2 else float("nan")
    te_annualised = te_daily * math.sqrt(_TRADING_DAYS_PER_YEAR)

    # ── Information Ratio ─────────────────────────────────────────────────────
    mean_active = float(np.mean(active_returns))
    annualised_active = mean_active * _TRADING_DAYS_PER_YEAR
    information_ratio: float | None = (
        annualised_active / te_annualised
        if te_annualised > 0 and not math.isnan(te_annualised)
        else None
    )

    # ── Sharpe Ratio ──────────────────────────────────────────────────────────
    excess_rp = r_p - daily_rf
    mean_excess = float(np.mean(excess_rp))
    sharpe_ratio = (
        (mean_excess / std_p) * math.sqrt(_TRADING_DAYS_PER_YEAR)
        if std_p > 0
        else float("nan")
    )

    # ── Sortino Ratio (downside volatility only) ──────────────────────────────
    ds_std_daily = _downside_std(r_p, daily_rf)
    sortino_ratio = (
        (mean_excess / ds_std_daily) * math.sqrt(_TRADING_DAYS_PER_YEAR)
        if not math.isnan(ds_std_daily) and ds_std_daily > 0
        else float("nan")
    )

    # ── Annualised volatilities ───────────────────────────────────────────────
    port_vol_annual = std_p * math.sqrt(_TRADING_DAYS_PER_YEAR)
    bench_vol_annual = std_b * math.sqrt(_TRADING_DAYS_PER_YEAR)

    return BenchmarkMetrics(
        beta=beta,
        alpha_annualised=alpha_annualised,
        correlation=correlation,
        tracking_error_annualised=te_annualised,
        information_ratio=information_ratio,
        sharpe_ratio=sharpe_ratio,
        sortino_ratio=sortino_ratio,
        portfolio_volatility_annualised=port_vol_annual,
        benchmark_volatility_annualised=bench_vol_annual,
        n_observations=n,
        risk_free_rate_annual=risk_free_rate_annual,
    )
