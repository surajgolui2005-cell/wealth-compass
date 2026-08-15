"""
Unit tests for twr.py — Time-Weighted Return Engine.

Test Vectors
------------
All expected values are independently verified using the GIPS Modified Dietz
formula. Each test documents the manual derivation in comments.
"""

import math
from datetime import date

import pytest

from src.analytics.twr import (
    CashFlowEvent,
    SubPeriod,
    TwrResult,
    _modified_dietz,
    compute_twr,
)


class TestModifiedDietz:
    """Unit tests for the _modified_dietz helper function."""

    def test_no_cash_flows_simple_return(self):
        """
        Single period, no cash flows.
        R = (EMV - BMV) / BMV = (110 - 100) / 100 = 10%
        """
        r = _modified_dietz(
            bmv=100.0,
            emv=110.0,
            cash_flows=[],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        assert round(r, 10) == pytest.approx(0.10, rel=1e-9)

    def test_single_deposit_midperiod(self):
        """
        BMV = 100, EMV = 215, deposit 100 on day 182 of 365-day period.
        W = (365 - 182) / 365 = 0.5 (approximately)
        Weighted CF = 100 * 0.5 = 50
        Denominator = 100 + 50 = 150
        Numerator = 215 - 100 - 100 = 15
        R = 15 / 150 = 10%
        """
        cf = CashFlowEvent(date=date(2026, 7, 2), amount=100.0)  # day 182
        r = _modified_dietz(
            bmv=100.0,
            emv=215.0,
            cash_flows=[cf],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        # The return should be close to 10% (exact value depends on day count)
        assert r == pytest.approx(0.10, abs=0.01)

    def test_zero_denominator_returns_zero(self):
        """
        When BMV = 0 and no cash flows, denominator = 0.
        Should return 0.0 instead of raising ZeroDivisionError.
        """
        r = _modified_dietz(
            bmv=0.0,
            emv=50.0,
            cash_flows=[],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
        )
        assert r == 0.0

    def test_end_before_start_raises_value_error(self):
        """Sub-period with end_date < start_date must raise ValueError."""
        with pytest.raises(ValueError, match="end_date"):
            _modified_dietz(
                bmv=100.0,
                emv=110.0,
                cash_flows=[],
                start_date=date(2026, 6, 30),
                end_date=date(2026, 1, 1),
            )

    def test_withdrawal_reduces_denominator(self):
        """
        Withdrawal reduces the time-weighted denominator.
        BMV=100, EMV=45, withdrawal -50 on day 1 of 30.
        W = (30 - 1) / 30 = 29/30 ≈ 0.9667
        Weighted CF = -50 * 0.9667 = -48.33
        Denominator = 100 - 48.33 = 51.67
        Numerator = 45 - 100 - (-50) = -5
        R = -5 / 51.67 ≈ -9.68%
        """
        cf = CashFlowEvent(date=date(2026, 1, 2), amount=-50.0)
        r = _modified_dietz(
            bmv=100.0,
            emv=45.0,
            cash_flows=[cf],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
        )
        assert r == pytest.approx(-5.0 / (100.0 + (-50.0 * 29 / 30)), rel=1e-6)


class TestComputeTwr:
    """Integration tests for compute_twr chain-linking."""

    def test_two_subperiods_no_cash_flows(self):
        """
        Sub-period 1: 100 → 110 (R1 = 10%)
        Sub-period 2: 110 → 121 (R2 = 10%)
        TWR = (1.10 × 1.10) - 1 = 21%
        """
        sp1 = SubPeriod(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            bmv=100.0,
            emv=110.0,
            cash_flows=[],
        )
        sp2 = SubPeriod(
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            bmv=110.0,
            emv=121.0,
            cash_flows=[],
        )
        result = compute_twr([sp1, sp2])
        assert result.twr_cumulative == pytest.approx(0.21, rel=1e-9)
        assert result.n_sub_periods == 2
        assert len(result.sub_period_returns) == 2
        assert result.sub_period_returns[0] == pytest.approx(0.10, rel=1e-9)
        assert result.sub_period_returns[1] == pytest.approx(0.10, rel=1e-9)

    def test_twr_neutralises_cash_flow_timing_bias(self):
        """
        Demonstrates that TWR is independent of the timing of external cash flows.

        Scenario:
            Jan 1: Portfolio = 100
            Jul 1: Portfolio grows to 150. Investor deposits 100. New BMV = 250.
            Dec 31: Portfolio = 275.

        WRONG (simple return): (275 - 100 - 100) / 100 = 75%
        CORRECT TWR: (1 + 0.50) * (1 + 0.10) - 1 = 65%

        SP1: 100 → 150 (R1 = 50%, no cash flows)
        SP2: 250 → 275 (R2 = 10%, no cash flows — deposit absorbed into BMV)
        """
        sp1 = SubPeriod(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            bmv=100.0,
            emv=150.0,
            cash_flows=[],
        )
        sp2 = SubPeriod(
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            bmv=250.0,    # 150 + 100 deposit at period start
            emv=275.0,
            cash_flows=[],
        )
        result = compute_twr([sp1, sp2])
        assert result.twr_cumulative == pytest.approx(0.65, rel=1e-9)
        assert result.sub_period_returns[0] == pytest.approx(0.50, rel=1e-9)
        assert result.sub_period_returns[1] == pytest.approx(0.10, rel=1e-9)

    def test_single_subperiod_annualisation(self):
        """
        Single sub-period: 100 → 120, exactly 365 days.
        TWR cumulative = 20%
        TWR annualised ≈ (1.20)^(365.25/365) - 1 ≈ 20.02%
        """
        sp = SubPeriod(
            start_date=date(2025, 1, 1),
            end_date=date(2026, 1, 1),  # 365 days
            bmv=100.0,
            emv=120.0,
            cash_flows=[],
        )
        result = compute_twr([sp])
        assert result.twr_cumulative == pytest.approx(0.20, rel=1e-9)
        assert result.twr_annualised is not None
        # Annualised ≈ (1.20)^(365.25/365) - 1
        expected_ann = math.pow(1.20, 365.25 / 365) - 1.0
        assert result.twr_annualised == pytest.approx(expected_ann, rel=1e-6)

    def test_negative_return_sub_period(self):
        """
        SP1: Loss period: 100 → 80 (R1 = -20%)
        SP2: Recovery: 80 → 104 (R2 = 30%)
        TWR = (0.80 × 1.30) - 1 = 4%
        """
        sp1 = SubPeriod(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            bmv=100.0,
            emv=80.0,
            cash_flows=[],
        )
        sp2 = SubPeriod(
            start_date=date(2026, 4, 1),
            end_date=date(2026, 12, 31),
            bmv=80.0,
            emv=104.0,
            cash_flows=[],
        )
        result = compute_twr([sp1, sp2])
        assert result.twr_cumulative == pytest.approx(0.04, rel=1e-9)

    def test_empty_subperiods_raises_value_error(self):
        """Empty sub-period list must raise ValueError."""
        with pytest.raises(ValueError, match="at least one"):
            compute_twr([])

    def test_out_of_order_raises_value_error(self):
        """Non-chronological sub-periods must raise ValueError."""
        sp1 = SubPeriod(
            start_date=date(2026, 7, 1),
            end_date=date(2026, 12, 31),
            bmv=100.0,
            emv=110.0,
        )
        sp2 = SubPeriod(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            bmv=90.0,
            emv=100.0,
        )
        with pytest.raises(ValueError, match="chronological"):
            compute_twr([sp1, sp2])

    def test_many_subperiods_chain_link_precision(self):
        """
        Chain-link 12 monthly sub-periods each returning exactly 1%.
        TWR = (1.01)^12 - 1 = 12.6825%
        """
        months = [
            (date(2026, m, 1), date(2026, m % 12 + 1, 1) if m < 12 else date(2027, 1, 1))
            for m in range(1, 13)
        ]
        sub_periods = [
            SubPeriod(
                start_date=start,
                end_date=end,
                bmv=100.0,
                emv=101.0,
                cash_flows=[],
            )
            for start, end in months
        ]
        result = compute_twr(sub_periods)
        expected = math.pow(1.01, 12) - 1.0
        assert result.twr_cumulative == pytest.approx(expected, rel=1e-9)
        assert result.n_sub_periods == 12
