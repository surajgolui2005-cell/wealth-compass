"""
Asset Allocation Aggregation Engine
=====================================

Pure-math module for multi-dimensional portfolio allocation analysis.

Given a flat list of position records with market values and classification
labels (asset class, sector, geography, currency, provider), this module
groups them into allocation buckets and computes the weight of each bucket
as a percentage of total portfolio value.

Normalisation guarantee
-----------------------
After grouping, all bucket weights are normalised so they sum to exactly
100.00%. A rounding correction (±epsilon) is applied to the largest bucket
to absorb IEEE 754 floating-point drift. This guarantees:

    sum(bucket.weight_pct for bucket in result.buckets) == 100.0

Unclassified positions
-----------------------
Positions whose classification label for the requested dimension is None,
empty string, or only whitespace are placed in an explicit
``UNASSIGNED_LABEL = "Unassigned / Other"`` bucket rather than being
silently dropped. This ensures every rupee of portfolio value is accounted
for across every analytical dimension.

Supported group-by dimensions
------------------------------
    asset_class  — e.g. "Equity", "Fixed Income", "Crypto", "Gold"
    sector       — e.g. "Technology", "Banking", "Energy"
    geography    — e.g. "India", "US", "Global"
    currency     — e.g. "INR", "USD", "BTC"
    provider     — e.g. "ZERODHA", "BINANCE", "MANUAL"

References
----------
    PRD US-ALT-01 through US-ALT-07 — Asset Allocation Analytics
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

UNASSIGNED_LABEL: str = "Unassigned / Other"


# ── Domain types ───────────────────────────────────────────────────────────────


class GroupBy(str, Enum):
    """Supported portfolio allocation breakdown dimensions."""

    ASSET_CLASS = "asset_class"
    SECTOR = "sector"
    GEOGRAPHY = "geography"
    CURRENCY = "currency"
    PROVIDER = "provider"


@dataclass(frozen=True)
class PositionRecord:
    """
    A single portfolio position with its market value and classification labels.

    All classification fields are optional; None / empty values are mapped to
    ``UNASSIGNED_LABEL`` at aggregation time.
    """

    position_id: str
    market_value: float  # In portfolio home currency (INR)
    asset_class: str | None = None
    sector: str | None = None
    geography: str | None = None
    currency: str | None = None
    provider: str | None = None


@dataclass(frozen=True)
class AllocationBucket:
    """
    A single allocation bucket representing one group within a dimension.

    Attributes
    ----------
    label         : Display name for the bucket (e.g. "Equity", "Technology")
    market_value  : Total market value of positions in this bucket (INR)
    weight_pct    : Percentage weight of this bucket in the total portfolio
    position_count: Number of positions in this bucket
    """

    label: str
    market_value: float
    weight_pct: float
    position_count: int


@dataclass
class AllocationResult:
    """
    Full allocation breakdown result for a portfolio.

    Attributes
    ----------
    portfolio_id  : Portfolio identifier (echoed from request for tracing)
    group_by      : The dimension used for grouping
    total_value   : Sum of all position market values (= 100% denominator)
    buckets       : List of allocation buckets, sorted descending by weight_pct
    position_count: Total number of positions processed
    """

    portfolio_id: str
    group_by: GroupBy
    total_value: float
    buckets: list[AllocationBucket] = field(default_factory=list)
    position_count: int = 0


# ── Helper ─────────────────────────────────────────────────────────────────────


def _resolve_label(position: PositionRecord, group_by: GroupBy) -> str:
    """Return the classification label for the position on the requested dimension."""
    raw: str | None = getattr(position, group_by.value, None)
    if raw is None or not str(raw).strip():
        return UNASSIGNED_LABEL
    return str(raw).strip()


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_allocation(
    portfolio_id: str,
    positions: list[PositionRecord],
    group_by: GroupBy,
) -> AllocationResult:
    """
    Aggregate portfolio positions into allocation buckets by the given dimension.

    Algorithm
    ---------
    1. Validate: at least one position with positive market_value is required.
    2. Sum market values per label (unclassified → ``UNASSIGNED_LABEL``).
    3. Compute raw weight_pct = bucket_value / total_value × 100 per bucket.
    4. Normalise: apply a ±epsilon correction to the largest bucket so the
       sum of all weight_pct values equals exactly 100.0.
    5. Sort buckets descending by weight_pct.

    Parameters
    ----------
    portfolio_id : str
        Identifier for the portfolio (used in logging / response).
    positions : list[PositionRecord]
        Flat list of position records. May be empty (raises ValueError).
    group_by : GroupBy
        Dimension to group by.

    Returns
    -------
    AllocationResult

    Raises
    ------
    ValueError
        If ``positions`` is empty or all market values are zero/negative.
    """
    if not positions:
        raise ValueError("At least one position is required for allocation computation.")

    total_value: float = sum(p.market_value for p in positions)
    if total_value <= 0.0:
        raise ValueError(
            f"Total portfolio value must be positive; got {total_value}. "
            "Ensure at least one position has a positive market_value."
        )

    # ── Step 1: Aggregate market values per label ───────────────────────────────
    bucket_values: dict[str, float] = {}
    bucket_counts: dict[str, int] = {}

    for position in positions:
        label = _resolve_label(position, group_by)
        bucket_values[label] = bucket_values.get(label, 0.0) + position.market_value
        bucket_counts[label] = bucket_counts.get(label, 0) + 1

    # ── Step 2: Compute raw weight percentages ──────────────────────────────────
    raw_weights: dict[str, float] = {
        label: (value / total_value) * 100.0
        for label, value in bucket_values.items()
    }

    # ── Step 3: Normalise to exactly 100.0 ─────────────────────────────────────
    raw_sum = sum(raw_weights.values())
    epsilon = 100.0 - raw_sum  # typically ±1e-12 due to floating-point

    if raw_weights:
        # Apply correction to the largest bucket to maintain maximum precision
        largest_label = max(raw_weights, key=lambda k: raw_weights[k])
        raw_weights[largest_label] += epsilon

    # ── Step 4: Build bucket objects ────────────────────────────────────────────
    buckets: list[AllocationBucket] = [
        AllocationBucket(
            label=label,
            market_value=round(bucket_values[label], 6),
            weight_pct=round(raw_weights[label], 6),
            position_count=bucket_counts[label],
        )
        for label in bucket_values
    ]

    # Sort descending by weight_pct (largest allocation first)
    buckets.sort(key=lambda b: b.weight_pct, reverse=True)

    result = AllocationResult(
        portfolio_id=portfolio_id,
        group_by=group_by,
        total_value=round(total_value, 6),
        buckets=buckets,
        position_count=len(positions),
    )

    logger.info(
        "Allocation computed: portfolio_id=%s group_by=%s total_value=%.2f buckets=%d positions=%d",
        portfolio_id,
        group_by.value,
        total_value,
        len(buckets),
        len(positions),
    )
    return result
