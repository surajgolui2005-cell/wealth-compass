"""
Pydantic request/response schemas for the allocation analytics router.

All monetary values are accepted as plain floats — the quant engine receives
pre-computed totals from the NestJS valuation layer (which applies Decimal.js
precision) and returns percentage metrics as Python IEEE 754 doubles.

Schemas
-------
    PositionItem         — Single position with market value + classification labels
    AllocationRequest    — Input for POST /api/v1/allocation/breakdown
    AllocationBucketDto  — One allocation bucket in the response
    AllocationResponse   — Full allocation breakdown response

    AllocationWeightItem — Single (current, target) weight pair for rebalance
    RebalanceRequest     — Input for POST /api/v1/allocation/rebalance
    RebalanceBucketDto   — Per-bucket drift + buy/sell in the response
    RebalanceResponse    — Full rebalance response
"""

# Note: NO `from __future__ import annotations` — Pydantic v2 on Python 3.13
# has a known conflict when field names match imported types under deferred
# annotation evaluation. We use explicit Optional / Union types instead.

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from src.analytics.allocation import GroupBy


# ── Shared primitives ──────────────────────────────────────────────────────────


class PositionItem(BaseModel):
    """A single portfolio position used as input for allocation aggregation."""

    position_id: str = Field(..., description="Unique position identifier (for tracing)")
    market_value: float = Field(
        ...,
        gt=0,
        description="Current market value of this position in portfolio home currency (INR). Must be > 0.",
    )
    asset_class: str | None = Field(
        None,
        description=(
            "Asset class label, e.g. 'Equity', 'Fixed Income', 'Crypto', 'Gold'. "
            "Null or empty → grouped under 'Unassigned / Other'."
        ),
    )
    sector: str | None = Field(
        None,
        description=(
            "Sector label, e.g. 'Technology', 'Banking', 'Energy'. "
            "Null or empty → 'Unassigned / Other'."
        ),
    )
    geography: str | None = Field(
        None,
        description=(
            "Geographic region, e.g. 'India', 'US', 'Global', 'Europe'. "
            "Null or empty → 'Unassigned / Other'."
        ),
    )
    currency: str | None = Field(
        None,
        description=(
            "Position currency code, e.g. 'INR', 'USD', 'BTC'. "
            "Null or empty → 'Unassigned / Other'."
        ),
    )
    provider: str | None = Field(
        None,
        description=(
            "Provider/broker identifier, e.g. 'ZERODHA', 'BINANCE', 'MANUAL'. "
            "Null or empty → 'Unassigned / Other'."
        ),
    )


# ── Allocation Schemas ─────────────────────────────────────────────────────────


class AllocationRequest(BaseModel):
    """Request body for POST /api/v1/allocation/breakdown."""

    portfolio_id: str = Field(..., description="Portfolio UUID (for logging/tracing)")
    positions: Annotated[
        list[PositionItem],
        Field(min_length=1, description="Non-empty list of portfolio positions"),
    ]
    group_by: GroupBy = Field(
        ...,
        description=(
            "Dimension to group positions by. "
            "One of: asset_class | sector | geography | currency | provider."
        ),
    )


class AllocationBucketDto(BaseModel):
    """A single allocation bucket in the breakdown response."""

    label: str = Field(
        ...,
        description="Bucket label (e.g. 'Equity', 'Technology', 'India', 'INR', 'ZERODHA')",
    )
    market_value: float = Field(
        ...,
        description="Aggregate market value of all positions in this bucket (home currency)",
    )
    weight_pct: float = Field(
        ...,
        description=(
            "Percentage weight of this bucket in the total portfolio. "
            "All buckets sum to exactly 100.0."
        ),
    )
    position_count: int = Field(
        ...,
        description="Number of positions contributing to this bucket",
    )


class AllocationResponse(BaseModel):
    """Full allocation breakdown response for POST /api/v1/allocation/breakdown."""

    portfolio_id: str
    group_by: str = Field(..., description="The dimension used for grouping")
    total_value: float = Field(
        ...,
        description="Sum of all position market values (the 100% denominator)",
    )
    buckets: list[AllocationBucketDto] = Field(
        ...,
        description="Allocation buckets sorted descending by weight_pct. Sum of weight_pct = 100.0.",
    )
    position_count: int = Field(..., description="Total number of positions processed")


# ── Rebalance Schemas ──────────────────────────────────────────────────────────


class AllocationWeightItem(BaseModel):
    """A single (current, target) allocation weight pair for rebalance input."""

    label: str = Field(
        ...,
        description="Bucket label (must match the allocation breakdown labels)",
    )
    current_pct: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Current portfolio weight for this bucket, as percentage (e.g. 45.0 = 45%)",
    )
    target_pct: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Target model weight for this bucket, as percentage",
    )


class RebalanceRequest(BaseModel):
    """Request body for POST /api/v1/allocation/rebalance."""

    portfolio_id: str = Field(..., description="Portfolio UUID (for logging/tracing)")
    current_allocation: Annotated[
        list[AllocationWeightItem],
        Field(min_length=1, description="Non-empty list of allocation weight buckets"),
    ]
    total_portfolio_value: float = Field(
        ...,
        gt=0,
        description="Total portfolio market value in home currency (used to compute monetary amounts)",
    )
    tolerance_pct: float = Field(
        default=2.0,
        ge=0.0,
        le=50.0,
        description=(
            "Drift tolerance band in percentage points (default 2.0 = ±2%). "
            "Buckets within this band are flagged in_tolerance=true."
        ),
    )

    @model_validator(mode="after")
    def validate_weight_sums(self) -> "RebalanceRequest":
        """Validate current_pct and target_pct each sum to 100 ± 0.1."""
        import math

        current_sum = sum(w.current_pct for w in self.current_allocation)
        target_sum = sum(w.target_pct for w in self.current_allocation)

        tol = 0.1  # Slightly looser than math engine; Pydantic catches gross errors

        if not math.isclose(current_sum, 100.0, abs_tol=tol):
            raise ValueError(
                f"current_pct values must sum to 100.0 ± {tol}; got {current_sum:.4f}."
            )
        if not math.isclose(target_sum, 100.0, abs_tol=tol):
            raise ValueError(
                f"target_pct values must sum to 100.0 ± {tol}; got {target_sum:.4f}."
            )
        return self


class RebalanceBucketDto(BaseModel):
    """Per-bucket drift and adjustment amounts in the rebalance response."""

    label: str = Field(..., description="Bucket label")
    current_pct: float = Field(..., description="Current portfolio weight (%)")
    target_pct: float = Field(..., description="Target model weight (%)")
    drift_pct: float = Field(
        ...,
        description=(
            "Drift = current_pct − target_pct. "
            "Positive = over-weight (sell). Negative = under-weight (buy)."
        ),
    )
    buy_amount: float = Field(
        ...,
        description="Monetary amount to buy to reach target weight (0 if not under-weight)",
    )
    sell_amount: float = Field(
        ...,
        description="Monetary amount to sell to reach target weight (0 if not over-weight)",
    )
    in_tolerance: bool = Field(
        ...,
        description="True when |drift_pct| <= tolerance_pct (no action required for this bucket)",
    )


class RebalanceResponse(BaseModel):
    """Full rebalance calculation response for POST /api/v1/allocation/rebalance."""

    portfolio_id: str
    total_portfolio_value: float = Field(
        ...,
        description="Total portfolio value used for monetary calculations",
    )
    tolerance_pct: float = Field(
        ...,
        description="Tolerance band applied (±percentage points)",
    )
    buckets: list[RebalanceBucketDto] = Field(
        ...,
        description="Per-bucket drift and adjustment amounts",
    )
    requires_rebalance: bool = Field(
        ...,
        description="True if any bucket has |drift_pct| > tolerance_pct",
    )
    total_drift_pct: float = Field(
        ...,
        description="Sum of absolute drift values across all buckets (overall portfolio deviation)",
    )
    total_buy_amount: float = Field(
        ...,
        description="Total monetary value of all required buy trades (home currency)",
    )
    total_sell_amount: float = Field(
        ...,
        description="Total monetary value of all required sell trades (home currency)",
    )
