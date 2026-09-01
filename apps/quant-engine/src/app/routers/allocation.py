"""Allocation analytics router.

Exposes two computation endpoints:
    POST /api/v1/allocation/breakdown   — Multi-dimensional allocation breakdown
    POST /api/v1/allocation/rebalance   — Drift calculation & buy/sell rebalance

All endpoints are internal-only (no public routing). The NestJS API Gateway
calls these endpoints over the private container network.

Math engines used:
    src.analytics.allocation  → compute_allocation, GroupBy, PositionRecord
    src.analytics.rebalance   → compute_rebalance, AllocationWeight
"""

import logging

from fastapi import APIRouter, HTTPException, status

from src.analytics.allocation import GroupBy, PositionRecord, compute_allocation
from src.analytics.rebalance import AllocationWeight, compute_rebalance
from src.app.schemas.allocation import (
    AllocationBucketDto,
    AllocationRequest,
    AllocationResponse,
    RebalanceBucketDto,
    RebalanceRequest,
    RebalanceResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/allocation",
    tags=["Allocation Analytics"],
)


# ── Allocation Breakdown Endpoint ─────────────────────────────────────────────


@router.post(
    "/breakdown",
    response_model=AllocationResponse,
    summary="Multi-Dimensional Allocation Breakdown",
    description=(
        "Aggregates portfolio positions by the specified dimension "
        "(asset_class | sector | geography | currency | provider) and returns "
        "allocation buckets with percentage weights that sum to exactly 100.0%. "
        "Unclassified positions are grouped under 'Unassigned / Other'."
    ),
    responses={
        400: {"description": "Empty positions list or zero/negative total portfolio value"},
    },
)
async def compute_allocation_endpoint(body: AllocationRequest) -> AllocationResponse:
    """
    POST /api/v1/allocation/breakdown

    Accepts a list of portfolio positions with their market values and
    classification labels, and returns allocation buckets grouped by the
    requested dimension.

    **Normalisation:** The largest bucket absorbs any floating-point rounding
    epsilon so that `sum(bucket.weight_pct) == 100.0` is guaranteed.

    **Unclassified assets:** Positions without a label for the requested
    dimension (null, empty, or whitespace) are grouped under
    ``"Unassigned / Other"`` rather than being silently dropped.
    """
    try:
        position_records = [
            PositionRecord(
                position_id=p.position_id,
                market_value=p.market_value,
                asset_class=p.asset_class,
                sector=p.sector,
                geography=p.geography,
                currency=p.currency,
                provider=p.provider,
            )
            for p in body.positions
        ]

        result = compute_allocation(
            portfolio_id=body.portfolio_id,
            positions=position_records,
            group_by=GroupBy(body.group_by.value),
        )

        logger.info(
            "Allocation breakdown: portfolio_id=%s group_by=%s buckets=%d",
            body.portfolio_id,
            body.group_by.value,
            len(result.buckets),
        )

        return AllocationResponse(
            portfolio_id=result.portfolio_id,
            group_by=result.group_by.value,
            total_value=result.total_value,
            buckets=[
                AllocationBucketDto(
                    label=b.label,
                    market_value=b.market_value,
                    weight_pct=b.weight_pct,
                    position_count=b.position_count,
                )
                for b in result.buckets
            ],
            position_count=result.position_count,
        )

    except ValueError as exc:
        logger.warning(
            "Allocation validation error for portfolio_id=%s: %s", body.portfolio_id, exc
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Rebalance Endpoint ────────────────────────────────────────────────────────


@router.post(
    "/rebalance",
    response_model=RebalanceResponse,
    summary="Portfolio Rebalance Drift Calculation",
    description=(
        "Computes the drift between current allocation weights and a target model "
        "portfolio, and calculates the exact buy/sell amounts required to return "
        "the portfolio to its target weights. Returns a per-bucket breakdown with "
        "in_tolerance flags and the overall requires_rebalance signal. "
        "Reference: PRD US-ALT-05, US-ALT-06."
    ),
    responses={
        400: {
            "description": (
                "Empty weight list, non-positive portfolio value, "
                "or weight sums not equal to 100"
            )
        },
    },
)
async def compute_rebalance_endpoint(body: RebalanceRequest) -> RebalanceResponse:
    """
    POST /api/v1/allocation/rebalance

    Accepts current allocation percentages and target model percentages for each
    bucket, plus the total portfolio value. Returns drift per bucket and the
    monetary buy/sell amounts needed to reach the model.

    **Drift sign convention:**
    - Positive drift (current > target) → over-weight → sell required
    - Negative drift (current < target) → under-weight → buy required

    **Zero-sum property:** `total_buy_amount ≈ total_sell_amount` (capital
    redistribution, no external cash assumed).

    **Tolerance:** `requires_rebalance = True` only when at least one bucket
    has `|drift_pct| > tolerance_pct`.
    """
    try:
        allocation_weights = [
            AllocationWeight(
                label=w.label,
                current_pct=w.current_pct,
                target_pct=w.target_pct,
            )
            for w in body.current_allocation
        ]

        result = compute_rebalance(
            portfolio_id=body.portfolio_id,
            weights=allocation_weights,
            total_portfolio_value=body.total_portfolio_value,
            tolerance_pct=body.tolerance_pct,
        )

        logger.info(
            "Rebalance computed: portfolio_id=%s requires_rebalance=%s "
            "total_drift=%.2f%% buy=%.2f sell=%.2f",
            body.portfolio_id,
            result.requires_rebalance,
            result.total_drift_pct,
            result.total_buy_amount,
            result.total_sell_amount,
        )

        return RebalanceResponse(
            portfolio_id=result.portfolio_id,
            total_portfolio_value=result.total_portfolio_value,
            tolerance_pct=result.tolerance_pct,
            buckets=[
                RebalanceBucketDto(
                    label=b.label,
                    current_pct=b.current_pct,
                    target_pct=b.target_pct,
                    drift_pct=b.drift_pct,
                    buy_amount=b.buy_amount,
                    sell_amount=b.sell_amount,
                    in_tolerance=b.in_tolerance,
                )
                for b in result.buckets
            ],
            requires_rebalance=result.requires_rebalance,
            total_drift_pct=result.total_drift_pct,
            total_buy_amount=result.total_buy_amount,
            total_sell_amount=result.total_sell_amount,
        )

    except ValueError as exc:
        logger.warning(
            "Rebalance validation error for portfolio_id=%s: %s", body.portfolio_id, exc
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
