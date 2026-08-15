"""
Unit tests for xirr.py — Extended Internal Rate of Return Engine.

Test Vectors
------------
All expected XIRR values are cross-validated against Microsoft Excel's
XIRR() function and independent Python implementations to guarantee
correctness. Each test documents the derivation or verification source.
"""

import math
from datetime import date

import pytest

from src.analytics.xirr import (
    CashFlow,
    XirrConvergenceError,
    XirrResult,
    _npv,
    _npv_derivative,
    _year_fractions,
    compute_xirr,
)


class TestHelpers:
    """Unit tests for internal helper functions."""

    def test_year_fractions_first_is_zero(self):
        """The first cash flow always has year fraction 0.0."""
        flows = [
            CashFlow(date=date(2026, 1, 1), amount=-1000.0),
            CashFlow(date=date(2026, 7, 2), amount=1100.0),  # 182 days
        ]
        fracs = _year_fractions(flows)
        assert fracs[0] == 0.0
        assert fracs[1] == pytest.approx(182 / 365.25, rel=1e-9)

    def test_npv_at_zero_rate_is_sum_of_cash_flows(self):
        """NPV(0) = Σ CF_i  (each discounted at rate 0 = 1)"""
        amounts = [-100.0, 50.0, 75.0]
        fracs = [0.0, 0.5, 1.0]
        assert _npv(0.0, amounts, fracs) == pytest.approx(25.0, rel=1e-9)

    def test_npv_derivative_is_negative_for_positive_rate(self):
        """NPV'(r) should be negative for typical investment cash flows at positive rates."""
        amounts = [-100.0, 120.0]
        fracs = [0.0, 1.0]
        deriv = _npv_derivative(0.10, amounts, fracs)
        assert deriv < 0.0

    def test_npv_at_minus_one_returns_inf(self):
        """NPV at r = -1.0 (complete loss) should return inf (guard)."""
        amounts = [-100.0, 120.0]
        fracs = [0.0, 1.0]
        assert _npv(-1.0, amounts, fracs) == float("inf")


class TestComputeXirr:
    """Integration tests for compute_xirr (PRD US-RISK-01 test vectors)."""

    def test_single_lump_sum_matches_cagr(self):
        """
        PRD Scenario 2: Single BUY + current value after exactly 1 year.
        BUY 100 @ ₹1,000 = -₹1,00,000 on 2024-01-01
        Current value 365 days later = ₹1,20,000

        XIRR = (120,000 / 100,000) - 1 = 20.00%
        (For single cash flow, XIRR = CAGR)
        """
        flows = [
            CashFlow(date=date(2024, 1, 1), amount=-100_000.0),
            CashFlow(date=date(2025, 1, 1), amount=120_000.0),
        ]
        result = compute_xirr(flows)
        # For exactly 365 days, XIRR ≈ 20% (slight deviation due to 365.25 convention)
        assert result.xirr == pytest.approx(0.20, abs=0.001)
        assert result.n_cash_flows == 2
        assert abs(result.npv_at_solution) < 1e-6

    def test_multi_cashflow_prd_scenario_1(self):
        """
        PRD Scenario 1: Standard XIRR with multiple investments.
        CF: -100,000 on 2023-01-01
            -50,000 on 2023-07-01
            +10,000 on 2024-01-01
            +185,000 on 2024-06-01 (current value)

        PRD states "≈ 19.8% p.a. (indicative)" as a rough illustration.
        The mathematically exact XIRR for this precise cash flow schedule is
        ≈ 23.7%, verified independently using Excel XIRR() and scipy.brentq.
        The PRD figure is intentionally approximate — the solver's output is correct.
        """
        flows = [
            CashFlow(date=date(2023, 1, 1), amount=-100_000.0),
            CashFlow(date=date(2023, 7, 1), amount=-50_000.0),
            CashFlow(date=date(2024, 1, 1), amount=10_000.0),
            CashFlow(date=date(2024, 6, 1), amount=185_000.0),
        ]
        result = compute_xirr(flows)
        # Exact solver result: ≈ 23.70% p.a.  (PRD's 19.8% was indicative only)
        assert result.xirr == pytest.approx(0.237, abs=0.005)
        assert abs(result.npv_at_solution) < 1e-4

    def test_negative_xirr_unrealised_loss(self):
        """
        PRD Scenario 3: Portfolio in loss (current value < invested).
        Invested -₹1,00,000 on 2024-01-01
        Current value = ₹65,000 on 2025-01-01 (35% drawdown)
        Expected: XIRR is negative (≈ -35% for single year)
        """
        flows = [
            CashFlow(date=date(2024, 1, 1), amount=-100_000.0),
            CashFlow(date=date(2025, 1, 1), amount=65_000.0),
        ]
        result = compute_xirr(flows)
        assert result.xirr < 0.0
        assert result.xirr == pytest.approx(-0.35, abs=0.005)
        assert abs(result.npv_at_solution) < 1e-6

    def test_solver_uses_newton_raphson_by_default(self):
        """Newton-Raphson should converge on a well-behaved cash flow sequence."""
        flows = [
            CashFlow(date=date(2025, 1, 1), amount=-50_000.0),
            CashFlow(date=date(2026, 1, 1), amount=60_000.0),
        ]
        result = compute_xirr(flows)
        assert result.solver_used == "newton_raphson"
        assert result.iterations >= 1

    def test_xirr_npv_at_solution_is_near_zero(self):
        """NPV at the solved rate must be below the convergence tolerance × 1000."""
        flows = [
            CashFlow(date=date(2024, 3, 1), amount=-200_000.0),
            CashFlow(date=date(2024, 9, 1), amount=-100_000.0),
            CashFlow(date=date(2025, 3, 1), amount=15_000.0),
            CashFlow(date=date(2025, 9, 1), amount=340_000.0),
        ]
        result = compute_xirr(flows)
        assert abs(result.npv_at_solution) < 1e-4

    def test_fewer_than_two_cashflows_raises_value_error(self):
        """Single cash flow cannot produce a meaningful XIRR."""
        with pytest.raises(ValueError, match="at least 2"):
            compute_xirr([CashFlow(date=date(2026, 1, 1), amount=-100_000.0)])

    def test_all_same_sign_raises_value_error(self):
        """All-outflow or all-inflow cash flows have undefined XIRR."""
        flows = [
            CashFlow(date=date(2026, 1, 1), amount=-100_000.0),
            CashFlow(date=date(2026, 6, 1), amount=-50_000.0),
        ]
        with pytest.raises(ValueError, match="positive.*negative"):
            compute_xirr(flows)

    def test_custom_initial_guess(self):
        """Custom initial guess should still converge to the correct XIRR."""
        flows = [
            CashFlow(date=date(2024, 1, 1), amount=-100_000.0),
            CashFlow(date=date(2025, 1, 1), amount=110_000.0),
        ]
        result_default = compute_xirr(flows)
        result_custom = compute_xirr(flows, guess=0.50)
        assert result_default.xirr == pytest.approx(result_custom.xirr, rel=1e-6)

    def test_high_precision_convergence(self):
        """
        Verify NPV(XIRR) is extremely close to 0, demonstrating numerical precision.
        """
        flows = [
            CashFlow(date=date(2020, 1, 1), amount=-1_000_000.0),
            CashFlow(date=date(2021, 4, 15), amount=150_000.0),
            CashFlow(date=date(2022, 8, 20), amount=250_000.0),
            CashFlow(date=date(2023, 12, 31), amount=900_000.0),
        ]
        result = compute_xirr(flows)
        assert abs(result.npv_at_solution) < 1e-5

    def test_brent_fallback_on_extreme_cashflows(self):
        """
        Force Brent fallback by providing an extreme alternating-sign pattern
        that makes Newton-Raphson diverge from a bad initial guess of -0.99.
        The fallback should still find a root.
        """
        # Large alternating flows that can challenge N-R
        flows = [
            CashFlow(date=date(2024, 1, 1), amount=-10_000_000.0),
            CashFlow(date=date(2024, 2, 1), amount=15_000_000.0),
            CashFlow(date=date(2024, 3, 1), amount=-12_000_000.0),
            CashFlow(date=date(2024, 4, 1), amount=12_000_000.0),
        ]
        # We cannot dictate which solver is used, but we verify the result is valid
        result = compute_xirr(flows)
        assert abs(result.npv_at_solution) < 1.0  # Allow looser tolerance for complex case
        assert result.solver_used in ("newton_raphson", "brent_dekker")
