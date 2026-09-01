"""
Annualised Volatility Calculator
==================================

Pure-math module for computing annualised portfolio / asset return volatility
from a time series of periodic (daily) returns.

Mathematical definition
-----------------------
Given a series of N daily log-returns {r_1, r_2, ..., r_N}:

    Sample Variance:   σ²_d = Σ(r_i − r̄)² / (N − 1)        (Bessel corrected)
    Daily Volatility:  σ_d  = sqrt(σ²_d)
    Annual Volatility: σ_a  = σ_d × sqrt(T)                  T = 252 trading days

Convention
----------
- T = 252 trading days per year is the global market standard for equity returns.
- Bessel correction (N-1 denominator) is applied to produce an unbiased estimate
  of population variance from a sample.
- Input returns must be SIMPLE periodic returns: r_t = (P_t / P_{t-1}) − 1.
  Log-returns may also be provided; the distinction is negligible for short periods.

References
----------
    Hull, J.C. (2022). Options, Futures, and Other Derivatives (11th ed.), §15.4.
    PRD US-RISK-01 — Portfolio Volatility & Risk Metrics.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

TRADING_DAYS_PER_YEAR: int = 252
_ANNUALISATION_FACTOR: float = math.sqrt(TRADING_DAYS_PER_YEAR)


# ── Result type ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class VolatilityResult:
    """
    Annualised volatility output.

    Attributes
    ----------
    asset_id          : Identifier echoed from request (portfolio or security ID).
    daily_volatility  : Sample standard deviation of the daily return series.
    annual_volatility : Daily volatility scaled to annual by sqrt(252).
    annual_volatility_pct: ``annual_volatility`` expressed as a percentage.
    n_observations    : Number of return observations used.
    """

    asset_id: str
    daily_volatility: float
    annual_volatility: float
    annual_volatility_pct: float
    n_observations: int


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_volatility(
    asset_id: str,
    daily_returns: list[float],
) -> VolatilityResult:
    """
    Compute annualised volatility from a series of daily periodic returns.

    Algorithm
    ---------
    1. Validate: minimum 2 return observations required (N ≥ 2).
    2. Compute sample mean:       r̄   = Σr_i / N
    3. Compute sample variance:   σ²_d = Σ(r_i − r̄)² / (N − 1)
    4. Daily volatility:          σ_d  = sqrt(σ²_d)
    5. Annual volatility:         σ_a  = σ_d × sqrt(252)

    Parameters
    ----------
    asset_id : str
        Portfolio or security identifier (for logging / tracing).
    daily_returns : list[float]
        Sequence of daily simple (or log) periodic returns.
        Minimum 2 observations required.

    Returns
    -------
    VolatilityResult

    Raises
    ------
    ValueError
        If fewer than 2 return observations are provided.
    """
    n = len(daily_returns)
    if n < 2:
        raise ValueError(
            f"At least 2 return observations are required to compute volatility; "
            f"got {n} for asset_id='{asset_id}'."
        )

    # ── Step 1: Sample mean ────────────────────────────────────────────────────
    mean_r = sum(daily_returns) / n

    # ── Step 2: Sample variance (Bessel corrected) ─────────────────────────────
    sum_sq_diff = sum((r - mean_r) ** 2 for r in daily_returns)
    sample_variance = sum_sq_diff / (n - 1)

    # ── Step 3: Daily and annual volatility ────────────────────────────────────
    daily_vol = math.sqrt(sample_variance)
    annual_vol = daily_vol * _ANNUALISATION_FACTOR

    result = VolatilityResult(
        asset_id=asset_id,
        daily_volatility=daily_vol,
        annual_volatility=annual_vol,
        annual_volatility_pct=annual_vol * 100.0,
        n_observations=n,
    )

    logger.info(
        "Volatility computed: asset_id=%s n=%d daily_vol=%.6f annual_vol=%.6f (%.2f%%)",
        asset_id,
        n,
        daily_vol,
        annual_vol,
        annual_vol * 100.0,
    )
    return result
