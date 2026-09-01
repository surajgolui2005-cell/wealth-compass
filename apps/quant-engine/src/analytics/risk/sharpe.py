"""
Sharpe Ratio Calculator
========================

Pure-math module for computing the annualised Sharpe Ratio of a portfolio.

Mathematical definition
-----------------------
Given N daily returns {r_1, ..., r_N} and an annualised risk-free rate r_f:

    Excess daily return:  e_i   = r_i − (r_f / 252)
    Mean excess return:   ē     = Σe_i / N
    Annualised excess return:   E_a = ē × 252
    Annual volatility:    σ_a   = std(r_i) × sqrt(252)      [Bessel-corrected]

    Sharpe Ratio:         S = E_a / σ_a
                            = (ē × 252) / (σ_d × sqrt(252))
                            = (ē × sqrt(252)) / σ_d

Interpretation
--------------
    S > 1.0 : Acceptable risk-adjusted return.
    S > 2.0 : Very good risk-adjusted return.
    S > 3.0 : Excellent — rarely achieved consistently.
    S < 0.0 : Portfolio underperformed the risk-free rate; risk taken was unrewarded.

Limitations
-----------
- Assumes normally distributed returns. Fat-tailed (leptokurtic) distributions
  cause the Sharpe Ratio to overstate risk-adjusted performance.
- Uses the full time-series standard deviation (total volatility), not just
  downside volatility. Use Sortino Ratio for asymmetric risk measurement.
- Sensitive to the return frequency chosen. This module uses daily returns
  with sqrt(252) annualisation for consistency with industry convention.

References
----------
    Sharpe, W.F. (1994). The Sharpe Ratio. Journal of Portfolio Management, 21(1), 49-58.
    PRD US-RISK-01 — Portfolio Volatility & Risk Metrics.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

TRADING_DAYS_PER_YEAR: int = 252
_SQRT_252: float = math.sqrt(TRADING_DAYS_PER_YEAR)


# ── Result type ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class SharpeResult:
    """
    Sharpe Ratio computation output.

    Attributes
    ----------
    asset_id                : Portfolio or security identifier.
    sharpe_ratio            : Annualised Sharpe Ratio = E_a / σ_a.
    annualised_excess_return: Mean daily excess return scaled to annual.
    annual_volatility       : Annualised standard deviation of daily returns.
    risk_free_rate_annual   : Annualised risk-free rate used (as a decimal, e.g. 0.04).
    n_observations          : Number of daily return observations used.
    """

    asset_id: str
    sharpe_ratio: float
    annualised_excess_return: float
    annual_volatility: float
    risk_free_rate_annual: float
    n_observations: int


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_sharpe(
    asset_id: str,
    daily_returns: list[float],
    risk_free_rate_annual: float = 0.04,
) -> SharpeResult:
    """
    Compute the annualised Sharpe Ratio from a series of daily returns.

    Algorithm
    ---------
    1. Validate: minimum 2 return observations required.
    2. Convert annual risk-free rate to daily: r_f_d = r_f_a / 252.
    3. Compute excess daily returns: e_i = r_i − r_f_d.
    4. Mean excess return: ē = Σe_i / N.
    5. Annualised excess return: E_a = ē × 252.
    6. Daily volatility (Bessel): σ_d = std(r_i) with N-1 denominator.
    7. Annual volatility: σ_a = σ_d × sqrt(252).
    8. Sharpe Ratio: S = E_a / σ_a = (ē × sqrt(252)) / σ_d.
    9. Guard: if annual_volatility ≈ 0, the Sharpe Ratio is undefined.

    Parameters
    ----------
    asset_id : str
        Portfolio or security identifier (for logging / tracing).
    daily_returns : list[float]
        Sequence of daily simple (or log) periodic returns.
    risk_free_rate_annual : float
        Annualised risk-free rate as a decimal fraction (default: 0.04 = 4%).
        Should match the prevailing government treasury / RBI repo rate for Indian portfolios.

    Returns
    -------
    SharpeResult

    Raises
    ------
    ValueError
        If fewer than 2 return observations are provided or if annual
        volatility is zero (all returns identical).
    """
    n = len(daily_returns)
    if n < 2:
        raise ValueError(
            f"At least 2 return observations are required to compute Sharpe Ratio; "
            f"got {n} for asset_id='{asset_id}'."
        )

    # ── Daily risk-free rate ───────────────────────────────────────────────────
    rf_daily = risk_free_rate_annual / TRADING_DAYS_PER_YEAR

    # ── Excess daily returns ───────────────────────────────────────────────────
    excess_returns = [r - rf_daily for r in daily_returns]
    mean_excess = sum(excess_returns) / n

    # ── Annualised excess return ───────────────────────────────────────────────
    annualised_excess = mean_excess * TRADING_DAYS_PER_YEAR

    # ── Annualised volatility (Bessel corrected on raw daily returns) ──────────
    mean_r = sum(daily_returns) / n
    sum_sq = sum((r - mean_r) ** 2 for r in daily_returns)
    daily_vol = math.sqrt(sum_sq / (n - 1))
    annual_vol = daily_vol * _SQRT_252

    if annual_vol < 1e-14:
        raise ValueError(
            f"Annual volatility is effectively zero for asset_id='{asset_id}'. "
            "Sharpe Ratio is undefined when all returns are identical."
        )

    sharpe = annualised_excess / annual_vol

    result = SharpeResult(
        asset_id=asset_id,
        sharpe_ratio=sharpe,
        annualised_excess_return=annualised_excess,
        annual_volatility=annual_vol,
        risk_free_rate_annual=risk_free_rate_annual,
        n_observations=n,
    )

    logger.info(
        "Sharpe Ratio computed: asset_id=%s n=%d rf=%.4f E_a=%.4f σ_a=%.4f sharpe=%.4f",
        asset_id,
        n,
        risk_free_rate_annual,
        annualised_excess,
        annual_vol,
        sharpe,
    )
    return result
