"""
Portfolio Rebalance Drift Calculation Engine
=============================================

Computes the deviation between a portfolio's current allocation weights and
a target model portfolio, and calculates the exact buy/sell amounts (in home
currency) required to return the portfolio to its target weights.

Drift convention
----------------
    drift_pct = current_pct - target_pct

    positive drift → over-weight  → sell required
    negative drift → under-weight → buy required

Zero-sum guarantee
------------------
For a portfolio with total value V and no external cash flows, the sum of
all buy amounts must equal the sum of all sell amounts (capital is merely
redistributed):

    sum(buy_amounts) == sum(sell_amounts)

This holds exactly when:
    sum(current_pct) == 100  and  sum(target_pct) == 100

The module validates both input sums and raises ``ValueError`` otherwise.

Tolerance window
----------------
Each bucket has an ``in_tolerance`` flag that is ``True`` when:

    |drift_pct| <= tolerance_pct

``requires_rebalance`` on the result is ``True`` if *any* bucket is outside
tolerance. A portfolio can have non-zero drift and still not require
rebalancing if all drift values are within the tolerance window.

References
----------
    PRD US-ALT-05, US-ALT-06 — Rebalancing & Drift Alerts
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Acceptable floating-point tolerance when validating that input percentages
# sum to 100 (accounts for representation error across many buckets).
_SUM_TOLERANCE: float = 0.01  # 0.01 percentage points


# ── Domain types ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class AllocationWeight:
    """
    A single bucket weight entry for rebalance input.

    Attributes
    ----------
    label       : Bucket label matching the allocation breakdown dimension
    current_pct : Current portfolio weight in percentage (e.g. 45.0 = 45%)
    target_pct  : Target model weight in percentage
    """

    label: str
    current_pct: float
    target_pct: float


@dataclass(frozen=True)
class RebalanceBucket:
    """
    Rebalance calculation result for a single allocation bucket.

    Attributes
    ----------
    label         : Bucket label
    current_pct   : Current weight (%)
    target_pct    : Target model weight (%)
    drift_pct     : current_pct - target_pct
    buy_amount    : Monetary amount to buy (0 if not under-weight)
    sell_amount   : Monetary amount to sell (0 if not over-weight)
    in_tolerance  : True when |drift_pct| <= tolerance_pct
    """

    label: str
    current_pct: float
    target_pct: float
    drift_pct: float
    buy_amount: float
    sell_amount: float
    in_tolerance: bool


@dataclass
class RebalanceResult:
    """
    Complete rebalance calculation result.

    Attributes
    ----------
    portfolio_id        : Portfolio identifier
    total_portfolio_value : Total value used for monetary calculations
    tolerance_pct       : Tolerance band applied (±)
    buckets             : Per-bucket drift and adjustment amounts
    requires_rebalance  : True if any bucket is outside the tolerance band
    total_drift_pct     : Sum of absolute drift values (overall deviation)
    total_buy_amount    : Total monetary value of all required buys
    total_sell_amount   : Total monetary value of all required sells
    """

    portfolio_id: str
    total_portfolio_value: float
    tolerance_pct: float
    buckets: list[RebalanceBucket] = field(default_factory=list)
    requires_rebalance: bool = False
    total_drift_pct: float = 0.0
    total_buy_amount: float = 0.0
    total_sell_amount: float = 0.0


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_rebalance(
    portfolio_id: str,
    weights: list[AllocationWeight],
    total_portfolio_value: float,
    tolerance_pct: float = 2.0,
) -> RebalanceResult:
    """
    Compute portfolio drift and required buy/sell amounts to reach target weights.

    Parameters
    ----------
    portfolio_id : str
        Portfolio identifier (echoed in response for tracing).
    weights : list[AllocationWeight]
        List of buckets each with ``current_pct`` and ``target_pct``.
        Sum of current_pct must be 100 (±0.01) and sum of target_pct must be
        100 (±0.01). At least one bucket is required.
    total_portfolio_value : float
        Total portfolio market value in home currency (must be > 0).
    tolerance_pct : float
        Drift tolerance in percentage points (default 2.0 = ±2%).
        Buckets within this band are flagged ``in_tolerance=True`` and
        excluded from the ``requires_rebalance`` determination.

    Returns
    -------
    RebalanceResult

    Raises
    ------
    ValueError
        - If ``weights`` is empty.
        - If ``total_portfolio_value`` <= 0.
        - If ``tolerance_pct`` < 0.
        - If ``current_pct`` values do not sum to 100 ± 0.01.
        - If ``target_pct`` values do not sum to 100 ± 0.01.
    """
    if not weights:
        raise ValueError("At least one allocation weight bucket is required.")

    if total_portfolio_value <= 0.0:
        raise ValueError(
            f"total_portfolio_value must be positive; got {total_portfolio_value}."
        )

    if tolerance_pct < 0.0:
        raise ValueError(
            f"tolerance_pct must be non-negative; got {tolerance_pct}."
        )

    # ── Validate input sums ──────────────────────────────────────────────────────
    current_sum = sum(w.current_pct for w in weights)
    if not math.isclose(current_sum, 100.0, abs_tol=_SUM_TOLERANCE):
        raise ValueError(
            f"current_pct values must sum to 100.0 ± {_SUM_TOLERANCE}; "
            f"got {current_sum:.6f}."
        )

    target_sum = sum(w.target_pct for w in weights)
    if not math.isclose(target_sum, 100.0, abs_tol=_SUM_TOLERANCE):
        raise ValueError(
            f"target_pct values must sum to 100.0 ± {_SUM_TOLERANCE}; "
            f"got {target_sum:.6f}."
        )

    # ── Compute per-bucket drift and adjustments ─────────────────────────────────
    buckets: list[RebalanceBucket] = []
    total_buy = 0.0
    total_sell = 0.0
    total_abs_drift = 0.0

    for w in weights:
        drift = w.current_pct - w.target_pct  # + = over-weight, - = under-weight
        monetary_change = abs(drift) / 100.0 * total_portfolio_value

        if drift > 0:
            buy_amount = 0.0
            sell_amount = round(monetary_change, 6)
        elif drift < 0:
            buy_amount = round(monetary_change, 6)
            sell_amount = 0.0
        else:
            buy_amount = 0.0
            sell_amount = 0.0

        in_tolerance = abs(drift) <= tolerance_pct

        buckets.append(
            RebalanceBucket(
                label=w.label,
                current_pct=round(w.current_pct, 6),
                target_pct=round(w.target_pct, 6),
                drift_pct=round(drift, 6),
                buy_amount=buy_amount,
                sell_amount=sell_amount,
                in_tolerance=in_tolerance,
            )
        )

        total_buy += buy_amount
        total_sell += sell_amount
        total_abs_drift += abs(drift)

    requires_rebalance = any(not b.in_tolerance for b in buckets)

    result = RebalanceResult(
        portfolio_id=portfolio_id,
        total_portfolio_value=total_portfolio_value,
        tolerance_pct=tolerance_pct,
        buckets=buckets,
        requires_rebalance=requires_rebalance,
        total_drift_pct=round(total_abs_drift, 6),
        total_buy_amount=round(total_buy, 6),
        total_sell_amount=round(total_sell, 6),
    )

    logger.info(
        "Rebalance computed: portfolio_id=%s total_value=%.2f "
        "requires_rebalance=%s total_drift=%.2f%% buy=%.2f sell=%.2f",
        portfolio_id,
        total_portfolio_value,
        requires_rebalance,
        total_abs_drift,
        total_buy,
        total_sell,
    )
    return result
