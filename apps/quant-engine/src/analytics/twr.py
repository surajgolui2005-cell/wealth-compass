"""
Time-Weighted Return (TWR) — Sub-Period Compounding Engine
===========================================================

Mathematical Foundation
-----------------------

TWR eliminates the distortion caused by the timing and magnitude of external cash
flows (deposits/withdrawals) by dividing the performance history into sub-periods,
computing a return for each sub-period, and chain-linking them multiplicatively.

                    n
    TWR = ∏ (1 + R_i) - 1
                   i=1

Where each sub-period return R_i is calculated using the Modified Dietz method:

                        EMV_i - BMV_i - CF_i
    R_i = ─────────────────────────────────────────────────────────
               BMV_i + Σ [CF_j × W_j]     (for cash flows within period i)

Where:
    BMV_i  = Beginning Market Value of sub-period i
    EMV_i  = Ending Market Value of sub-period i
    CF_i   = Net external cash flows during sub-period i (+ deposit, - withdrawal)
    CF_j   = Individual cash flow j within period i
    W_j    = Weight of cash flow j = (D_i - d_j) / D_i
             D_i = total calendar days in sub-period i
             d_j = calendar days elapsed since start of sub-period to CF_j

Sub-Period Boundary Rule
------------------------
A new sub-period is ALWAYS started on any day with an external cash flow.
This ensures that large deposits/withdrawals do not contaminate the return
calculation by artificially inflating or deflating period performance.

Annualisation
-------------
To express TWR as an annualised rate, given total_days = (end_date - start_date).days:

    TWR_annualised = (1 + TWR_cumulative) ^ (365.25 / total_days) - 1

References
----------
    - Global Investment Performance Standards (GIPS), CFA Institute (2020)
    - Bacon, C., Practical Risk-Adjusted Performance Measurement (2012)
    - Modified Dietz Method: GIPS 2.A.2
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Sequence


@dataclass(frozen=True)
class CashFlowEvent:
    """
    An external cash flow event within a sub-period.

    Attributes
    ----------
    date:
        Date of the cash flow.
    amount:
        Net amount of cash flow. Positive = deposit, negative = withdrawal.
    """

    date: date
    amount: float


@dataclass(frozen=True)
class SubPeriod:
    """
    A single measurement sub-period bracketed by external cash flow events.

    Attributes
    ----------
    start_date:
        First day of the sub-period (inclusive).
    end_date:
        Last day of the sub-period (inclusive).
    bmv:
        Beginning Market Value of the portfolio at the start of the sub-period
        (after any cash flows have been applied on the start_date).
    emv:
        Ending Market Value of the portfolio at the end of the sub-period
        (before any cash flows on the end_date are applied).
    cash_flows:
        All external cash flow events that occurred WITHIN this sub-period
        (i.e., strictly after start_date and on or before end_date).
        Cash flows that triggered the sub-period break (on start_date) are NOT
        included here — they are captured in the *next* sub-period's bmv.
    """

    start_date: date
    end_date: date
    bmv: float
    emv: float
    cash_flows: Sequence[CashFlowEvent] = field(default_factory=list)


@dataclass
class TwrResult:
    """
    Output of the TWR computation.

    Attributes
    ----------
    twr_cumulative:
        Cumulative TWR over the full evaluation period, expressed as a decimal.
        e.g., 0.15 = +15% total return.
    twr_annualised:
        TWR converted to a per-annum figure using the actual calendar days in the
        evaluation window. None if the window is zero days or a single sub-period
        with fewer than 2 days.
    sub_period_returns:
        Individual Modified Dietz return for each sub-period, in chronological order.
    total_days:
        Calendar days between first sub-period start and last sub-period end.
    n_sub_periods:
        Total number of sub-periods used in the chain-linking.
    """

    twr_cumulative: float
    twr_annualised: float | None
    sub_period_returns: list[float]
    total_days: int
    n_sub_periods: int


def _modified_dietz(
    bmv: float,
    emv: float,
    cash_flows: Sequence[CashFlowEvent],
    start_date: date,
    end_date: date,
) -> float:
    """
    Computes the Modified Dietz return for a single sub-period.

    Formula:
        R = (EMV - BMV - CF) / (BMV + Σ[CF_j × W_j])

    Where W_j = (D - d_j) / D
        D   = total calendar days in the sub-period
        d_j = days elapsed from start_date to the date of CF_j

    Parameters
    ----------
    bmv:
        Beginning Market Value (after applying any start-of-period cash flows).
    emv:
        Ending Market Value (before applying any end-of-period cash flows).
    cash_flows:
        Cash flow events occurring WITHIN the sub-period.
    start_date:
        Start date of the sub-period.
    end_date:
        End date of the sub-period.

    Returns
    -------
    float
        Modified Dietz sub-period return. Returns 0.0 if the denominator is 0
        (empty period with no capital deployed).

    Raises
    ------
    ValueError
        If end_date is before start_date.
    """
    if end_date < start_date:
        raise ValueError(
            f"end_date ({end_date}) must be >= start_date ({start_date})"
        )

    total_days = (end_date - start_date).days

    # Net cash flows (unweighted sum)
    net_cf = sum(cf.amount for cf in cash_flows)

    # Time-weighted cash flow: Σ[CF_j × W_j]
    weighted_cf = 0.0
    if total_days > 0:
        for cf in cash_flows:
            days_elapsed = (cf.date - start_date).days
            # W_j = (D - d_j) / D — fraction of period remaining after the flow
            weight = (total_days - days_elapsed) / total_days
            weighted_cf += cf.amount * weight
    else:
        # Intra-day: treat all flows as arriving at end (weight 0)
        weighted_cf = 0.0

    denominator = bmv + weighted_cf

    if denominator == 0.0:
        # No capital deployed: return 0 to avoid division by zero
        return 0.0

    return (emv - bmv - net_cf) / denominator


def compute_twr(sub_periods: Sequence[SubPeriod]) -> TwrResult:
    """
    Computes the Time-Weighted Return (TWR) via sub-period chain-linking.

    The caller is responsible for:
      1. Identifying all days with external cash flows (deposits/withdrawals).
      2. Splitting the full evaluation window into SubPeriod objects at those
         cash-flow break points.
      3. Providing accurate BMV and EMV for each sub-period.

    TWR is then:
        cumulative_return = ∏(1 + R_i) - 1   for i in [0, n)
        annualised_return = (1 + cumulative)^(365.25 / total_days) - 1

    Parameters
    ----------
    sub_periods:
        Chronologically ordered sequence of SubPeriod objects.
        Must contain at least one element.

    Returns
    -------
    TwrResult
        Full TWR result with cumulative return, annualised return, and
        per-sub-period returns.

    Raises
    ------
    ValueError
        If sub_periods is empty or sub-periods are not in chronological order.

    Examples
    --------
    >>> from datetime import date
    >>> sp1 = SubPeriod(
    ...     start_date=date(2025, 1, 1),
    ...     end_date=date(2025, 6, 30),
    ...     bmv=100_000.0,
    ...     emv=110_000.0,
    ...     cash_flows=[],
    ... )
    >>> sp2 = SubPeriod(
    ...     start_date=date(2025, 7, 1),
    ...     end_date=date(2025, 12, 31),
    ...     bmv=160_000.0,   # 110_000 + 50_000 deposit
    ...     emv=180_000.0,
    ...     cash_flows=[],
    ... )
    >>> result = compute_twr([sp1, sp2])
    >>> round(result.twr_cumulative, 6)
    0.238095    # (1.1 * 1.125) - 1 ≈ 23.81%
    """
    if not sub_periods:
        raise ValueError("sub_periods must contain at least one SubPeriod")

    # Validate chronological ordering
    for i in range(1, len(sub_periods)):
        prev, curr = sub_periods[i - 1], sub_periods[i]
        if curr.start_date < prev.end_date:
            raise ValueError(
                f"Sub-periods are not in chronological order: "
                f"sub_period[{i}].start_date ({curr.start_date}) < "
                f"sub_period[{i-1}].end_date ({prev.end_date})"
            )

    sub_period_returns: list[float] = []
    chain_product = 1.0

    for sp in sub_periods:
        r_i = _modified_dietz(
            bmv=sp.bmv,
            emv=sp.emv,
            cash_flows=sp.cash_flows,
            start_date=sp.start_date,
            end_date=sp.end_date,
        )
        sub_period_returns.append(r_i)
        chain_product *= 1.0 + r_i

    twr_cumulative = chain_product - 1.0

    # Annualise using the full calendar span
    total_days = (sub_periods[-1].end_date - sub_periods[0].start_date).days
    twr_annualised: float | None = None
    if total_days >= 2:
        try:
            twr_annualised = math.pow(1.0 + twr_cumulative, 365.25 / total_days) - 1.0
        except (ValueError, ZeroDivisionError):
            twr_annualised = None

    return TwrResult(
        twr_cumulative=twr_cumulative,
        twr_annualised=twr_annualised,
        sub_period_returns=sub_period_returns,
        total_days=total_days,
        n_sub_periods=len(sub_periods),
    )
