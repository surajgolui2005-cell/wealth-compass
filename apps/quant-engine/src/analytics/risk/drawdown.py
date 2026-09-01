"""
Maximum Drawdown Calculator
=============================

Pure-math module for computing the historical Maximum Drawdown (MDD) of a
portfolio from a time series of returns or NAV (Net Asset Value) levels.

Mathematical definition
-----------------------
Given a cumulative equity/NAV curve {V_0, V_1, ..., V_T}:

    Running peak:  P_t = max(V_0, V_1, ..., V_t)
    Drawdown:      D_t = (V_t − P_t) / P_t             [always ≤ 0]

    Maximum Drawdown:  MDD = min(D_0, D_1, ..., D_T)   [most negative D_t]

If the input is a series of daily returns rather than levels:
    Cumulative value:  V_t = V_0 × Π(1 + r_i) for i in 1..t   [V_0 = 1.0]

The function accepts BOTH returns series and pre-computed NAV/price levels.

Key metrics reported
---------------------
- max_drawdown        : The MDD as a decimal fraction (e.g. -0.35 = -35%).
- max_drawdown_pct    : The MDD expressed as a percentage (e.g. -35.0).
- peak_index          : Index of the portfolio peak before the worst drawdown.
- trough_index        : Index of the portfolio trough (worst point of drawdown).
- recovery_index      : Index when the portfolio recovered to the pre-drawdown peak.
                        None if recovery has not occurred yet.
- drawdown_duration   : Number of periods from peak to trough.
- recovery_duration   : Number of periods from trough to recovery. None if unrecovered.

Interpretation
--------------
    MDD = 0.0  : Portfolio never fell below its starting value.
    MDD = -0.5 : Portfolio lost 50% from its peak at its worst point.
    Longer drawdown durations indicate structural underperformance or sustained
    bear market conditions.

Limitation
----------
- MDD captures worst-case historical loss but makes no probabilistic statement
  about future drawdowns. Combine with VaR for forward-looking risk estimates.
- For intra-day data the metric requires tick-level data which this module does
  not support; it assumes end-of-day observations.

References
----------
    Magdon-Ismail, M. et al. (2004). On the Maximum Drawdown of a Brownian Motion.
    Journal of Applied Probability, 41, 147-161.
    PRD US-RISK-01 — Portfolio Volatility & Risk Metrics.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# ── Result type ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class DrawdownResult:
    """
    Maximum Drawdown computation output.

    Attributes
    ----------
    asset_id          : Portfolio or security identifier.
    max_drawdown      : Maximum drawdown as a decimal fraction (≤ 0).
    max_drawdown_pct  : ``max_drawdown`` expressed as a percentage.
    peak_index        : Index of the portfolio peak before the worst drawdown.
    trough_index      : Index of the portfolio trough.
    recovery_index    : Index of first recovery to prior peak, or None if unrecovered.
    drawdown_duration : Periods from peak to trough.
    recovery_duration : Periods from trough to recovery, or None if unrecovered.
    n_observations    : Total number of NAV observations (including the starting value).
    """

    asset_id: str
    max_drawdown: float
    max_drawdown_pct: float
    peak_index: int
    trough_index: int
    recovery_index: int | None
    drawdown_duration: int
    recovery_duration: int | None
    n_observations: int


# ── Internal helpers ───────────────────────────────────────────────────────────


def _returns_to_nav(daily_returns: list[float], starting_value: float = 1.0) -> list[float]:
    """Convert a series of simple daily returns to a cumulative NAV curve."""
    nav = [starting_value]
    for r in daily_returns:
        nav.append(nav[-1] * (1.0 + r))
    return nav


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_drawdown(
    asset_id: str,
    returns: list[float] | None = None,
    nav_series: list[float] | None = None,
) -> DrawdownResult:
    """
    Compute the Maximum Drawdown from either a daily return series or a NAV series.

    Exactly one of ``returns`` or ``nav_series`` must be provided.

    Algorithm
    ---------
    1. Build NAV curve if returns are provided (V_0 = 1.0, V_t = V_{t-1} × (1+r_t)).
    2. Iterate through the NAV series, maintaining a running peak P_t.
    3. At each step compute D_t = (V_t − P_t) / P_t.
    4. Track the minimum D_t (most negative) → MDD.
    5. Record peak_index (last index where V = P before trough) and trough_index.
    6. Scan forward from trough_index for the first index where V_t ≥ P_peak
       to determine recovery_index.

    Parameters
    ----------
    asset_id : str
        Portfolio or security identifier (for logging / tracing).
    returns : list[float], optional
        Series of daily simple returns. Mutually exclusive with ``nav_series``.
    nav_series : list[float], optional
        Pre-computed NAV / price levels. Must have at least 2 values.
        Mutually exclusive with ``returns``.

    Returns
    -------
    DrawdownResult

    Raises
    ------
    ValueError
        If neither or both of ``returns`` / ``nav_series`` are provided, or
        if fewer than 2 observations exist.
    """
    if (returns is None) == (nav_series is None):
        raise ValueError(
            "Exactly one of 'returns' or 'nav_series' must be provided, not both or neither."
        )

    # ── Build NAV series ───────────────────────────────────────────────────────
    if returns is not None:
        if len(returns) < 1:
            raise ValueError(
                f"At least 1 return observation is required; got 0 for asset_id='{asset_id}'."
            )
        nav = _returns_to_nav(returns)  # length = len(returns) + 1
    else:
        nav = nav_series  # type: ignore[assignment]

    if len(nav) < 2:
        raise ValueError(
            f"NAV series must have at least 2 values; got {len(nav)} for asset_id='{asset_id}'."
        )

    # ── Pass 1: find MDD, peak_index, trough_index ─────────────────────────────
    running_peak = nav[0]
    running_peak_idx = 0

    mdd = 0.0
    peak_idx = 0
    trough_idx = 0

    for t, v in enumerate(nav):
        if v > running_peak:
            running_peak = v
            running_peak_idx = t

        if running_peak > 0.0:
            drawdown_t = (v - running_peak) / running_peak
        else:
            drawdown_t = 0.0

        if drawdown_t < mdd:
            mdd = drawdown_t
            peak_idx = running_peak_idx
            trough_idx = t

    # ── Pass 2: find recovery index (first t > trough where V_t ≥ nav[peak_idx]) ─
    peak_value = nav[peak_idx]
    recovery_idx: int | None = None

    for t in range(trough_idx + 1, len(nav)):
        if nav[t] >= peak_value:
            recovery_idx = t
            break

    drawdown_duration = trough_idx - peak_idx
    recovery_duration = (recovery_idx - trough_idx) if recovery_idx is not None else None

    result = DrawdownResult(
        asset_id=asset_id,
        max_drawdown=mdd,
        max_drawdown_pct=mdd * 100.0,
        peak_index=peak_idx,
        trough_index=trough_idx,
        recovery_index=recovery_idx,
        drawdown_duration=drawdown_duration,
        recovery_duration=recovery_duration,
        n_observations=len(nav),
    )

    logger.info(
        "Drawdown computed: asset_id=%s mdd=%.4f%% peak_idx=%d trough_idx=%d "
        "recovery_idx=%s duration=%d",
        asset_id,
        mdd * 100.0,
        peak_idx,
        trough_idx,
        recovery_idx,
        drawdown_duration,
    )
    return result
