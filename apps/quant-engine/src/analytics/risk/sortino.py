"""
Sortino Ratio Calculator
=========================

Pure-math module for computing the annualised Sortino Ratio of a portfolio.

The Sortino Ratio improves on the Sharpe Ratio by penalising only downside
(negative) deviations from the target return (MAR), rather than all volatility.
Upside volatility is desirable and should not reduce the risk-adjusted metric.

Mathematical definition
-----------------------
Given N daily returns {r_1, ..., r_N} and a target/threshold return (MAR):

    MAR (daily):    τ_d = r_f_annual / 252

    Downside returns:    d_i = min(r_i − τ_d, 0)        [zero-floored]
    Downside Variance:   σ²_DD = Σd_i² / N               [full-period denominator]
    Downside Deviation:  σ_DD  = sqrt(σ²_DD)
    Annualised DD:       σ_DD_a = σ_DD × sqrt(252)

    Mean portfolio return: r̄_p = Σr_i / N
    Annualised return:     R_a  = r̄_p × 252

    Sortino Ratio:  So = (R_a − r_f_annual) / σ_DD_a

Denominator convention
----------------------
The downside deviation uses N (not N-1) as the denominator. This follows the
original Sortino & Price (1994) specification and the common practice in
the portfolio risk literature, where DD is measured as the semi-standard
deviation of the full observed return distribution rather than a sample estimator.

Default MAR / Risk-Free Rate
-----------------------------
Default risk_free_rate_annual = 0.04 (4.0% annualised) representing
typical Indian government T-bill / RBI repo rate expectations.

Interpretation
--------------
    So < 1.0 : Below acceptable risk-adjusted performance (downside-only).
    So > 1.0 : Good. Portfolio earns more than 1× its downside risk.
    So > 2.0 : Excellent downside-adjusted performance.

References
----------
    Sortino, F.A. & Price, L.N. (1994). Performance Measurement in a
    Downside Risk Framework. Journal of Investing, 3(3), 59-64.
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
DEFAULT_RISK_FREE_RATE: float = 0.04  # 4.0% annualised


# ── Result type ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class SortinoResult:
    """
    Sortino Ratio computation output.

    Attributes
    ----------
    asset_id                  : Portfolio or security identifier.
    sortino_ratio             : Annualised Sortino Ratio = (R_a − r_f) / σ_DD_a.
    annualised_return         : Mean daily return scaled to annual (R_a = r̄ × 252).
    downside_deviation_annual : Annualised downside deviation (σ_DD × sqrt(252)).
    risk_free_rate_annual     : Annualised MAR / risk-free rate used.
    n_observations            : Number of daily return observations.
    n_downside_observations   : Number of observations below the MAR threshold.
    """

    asset_id: str
    sortino_ratio: float
    annualised_return: float
    downside_deviation_annual: float
    risk_free_rate_annual: float
    n_observations: int
    n_downside_observations: int


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_sortino(
    asset_id: str,
    daily_returns: list[float],
    risk_free_rate_annual: float = DEFAULT_RISK_FREE_RATE,
) -> SortinoResult:
    """
    Compute the annualised Sortino Ratio from a series of daily returns.

    Algorithm
    ---------
    1. Validate: minimum 2 return observations required.
    2. Convert annual MAR to daily: τ_d = r_f_annual / 252.
    3. Identify downside deviations: d_i = min(r_i − τ_d, 0).
    4. Downside variance: σ²_DD = Σd_i² / N  (full-N denominator per Sortino 1994).
    5. Annualised downside deviation: σ_DD_a = sqrt(σ²_DD) × sqrt(252).
    6. Annualised portfolio return: R_a = (Σr_i / N) × 252.
    7. Sortino Ratio: So = (R_a − r_f_annual) / σ_DD_a.
    8. Guard: if downside_deviation ≈ 0 (no negative months), ratio is set to +∞
       represented as a large float (float('inf')) — caller should treat this as
       "no downside risk observed" and handle display appropriately.

    Parameters
    ----------
    asset_id : str
        Portfolio or security identifier (for logging / tracing).
    daily_returns : list[float]
        Sequence of daily simple (or log) periodic returns.
    risk_free_rate_annual : float
        Annualised minimum acceptable return / risk-free rate as a decimal
        fraction (default: 0.04 = 4.0%).

    Returns
    -------
    SortinoResult

    Raises
    ------
    ValueError
        If fewer than 2 return observations are provided.
    """
    n = len(daily_returns)
    if n < 2:
        raise ValueError(
            f"At least 2 return observations are required to compute Sortino Ratio; "
            f"got {n} for asset_id='{asset_id}'."
        )

    # ── Daily MAR (Minimum Acceptable Return / threshold) ─────────────────────
    mar_daily = risk_free_rate_annual / TRADING_DAYS_PER_YEAR

    # ── Downside deviations relative to MAR ───────────────────────────────────
    downside_devs = [min(r - mar_daily, 0.0) for r in daily_returns]
    n_downside = sum(1 for d in downside_devs if d < 0.0)

    # ── Downside variance (N denominator, per Sortino 1994) ───────────────────
    downside_variance = sum(d ** 2 for d in downside_devs) / n
    daily_dd = math.sqrt(downside_variance)

    # ── Annualised downside deviation ─────────────────────────────────────────
    annual_dd = daily_dd * _SQRT_252

    # ── Annualised portfolio return ────────────────────────────────────────────
    mean_r = sum(daily_returns) / n
    annual_return = mean_r * TRADING_DAYS_PER_YEAR

    # ── Sortino Ratio ─────────────────────────────────────────────────────────
    if annual_dd < 1e-14:
        # No downside risk observed — all periods exceeded the MAR
        sortino = float("inf")
        logger.warning(
            "Sortino Ratio is +inf for asset_id=%s: no downside deviations below MAR=%.4f%%",
            asset_id,
            risk_free_rate_annual * 100.0,
        )
    else:
        sortino = (annual_return - risk_free_rate_annual) / annual_dd

    result = SortinoResult(
        asset_id=asset_id,
        sortino_ratio=sortino,
        annualised_return=annual_return,
        downside_deviation_annual=annual_dd,
        risk_free_rate_annual=risk_free_rate_annual,
        n_observations=n,
        n_downside_observations=n_downside,
    )

    logger.info(
        "Sortino Ratio computed: asset_id=%s n=%d n_down=%d rf=%.4f R_a=%.4f DD_a=%.4f sortino=%.4f",
        asset_id,
        n,
        n_downside,
        risk_free_rate_annual,
        annual_return,
        annual_dd,
        sortino if sortino != float("inf") else float("nan"),
    )
    return result
