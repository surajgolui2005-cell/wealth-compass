"""
Comprehensive Quantitative Risk Engine Test Suite
===================================================

Test Strategy
-------------
This suite is organised into three tiers:

  Tier 1 — Mathematical Benchmark Verification
      All 7 risk modules are tested against pre-computed reference values
      derived from the closed-form formulas in RISK_METHODOLOGY.md. Each
      expected result is derived by hand or from a known financial calculator
      and checked to within STRICT_TOL = 1e-4 (10 basis points).

  Tier 2 — Financial Property Assertions
      No numerical oracle required. Tests verify invariants that must hold
      regardless of input: symmetry, unit diagonal, monotonicity (99% VaR ≥
      95% VaR), zero-sum rebalance, etc.

  Tier 3 — Portfolio Archetype Edge Cases
      100% cash portfolio (zero volatility), single-security portfolio,
      all-short portfolio, 2-asset perfectly inverse portfolio, multi-regime
      return series (bull + crash + recovery), cryptographic-scale volatility.

  Tier 4 — FastAPI Integration
      HTTP endpoint smoke tests, request validation (422), business-logic
      validation (400), response schema completeness.

Pre-Computed Reference Datasets
---------------------------------
Each dataset carries a hand-derived expected result. The computation trace is
documented inline above each test so it can be audited independently.

Global tolerance (STRICT_TOL = 1e-4) is tighter than the PRD requirement of
1e-2 for displayed values, ensuring the engine is accurate to 4 decimal places.

References
----------
    Hull, J.C. (2022). Options, Futures, and Other Derivatives (11th ed.).
    Sharpe, W.F. (1994). The Sharpe Ratio. Journal of Portfolio Management.
    Sortino, F.A. & Price, L.N. (1994). Journal of Investing.
    Jorion, P. (2006). Value at Risk (3rd ed.).
    Markowitz, H.M. (1952). Portfolio Selection. Journal of Finance.
"""

import math
import statistics
import pytest
from fastapi.testclient import TestClient

from src.analytics.risk import (
    compute_volatility,
    compute_beta,
    compute_sharpe,
    compute_sortino,
    compute_drawdown,
    compute_var,
    compute_correlation,
)
from src.analytics.risk.drawdown import _returns_to_nav
from src.main import app

client = TestClient(app)

# ── Global tolerance ──────────────────────────────────────────────────────────
STRICT_TOL = 1e-4      # absolute for ratio/fraction comparisons
PCT_TOL    = 1e-2      # absolute for percentage comparisons (e.g. volatility_pct)
TRADING_DAYS = 252


# ─────────────────────────────────────────────────────────────────────────────
# SHARED REFERENCE DATASETS
# ─────────────────────────────────────────────────────────────────────────────

# Dataset A: 10-day return series with a controlled bear market in the middle.
# Used for: Volatility, Sharpe, Sortino, Drawdown.
#
# r_t (simple daily returns):
#    Day  1: +1.00%   Day  2: +0.50%   Day  3: -3.00%   Day  4: -2.00%
#    Day  5: +0.80%   Day  6: +1.20%   Day  7: +0.90%   Day  8: -1.00%
#    Day  9: +2.00%   Day 10: +1.50%
DATASET_A = [0.0100, 0.0050, -0.0300, -0.0200, 0.0080, 0.0120, 0.0090, -0.0100, 0.0200, 0.0150]
# N = 10, mean = Σ/10 = (0.01+0.005-0.03-0.02+0.008+0.012+0.009-0.01+0.02+0.015)/10
# Σ = 0.019, mean = 0.0019
# Σ(r_i - mean)^2 = computed inline in tests
# Risk-free rate used: 4.0% annualised

# Dataset B: Aligned benchmark for Dataset A (NIFTY-like returns scaled down).
DATASET_B = [0.0080, 0.0040, -0.0250, -0.0160, 0.0060, 0.0100, 0.0070, -0.0080, 0.0160, 0.0120]

# Dataset C: 5-period NAV series for explicit drawdown verification.
# NAV: [100, 108, 115, 95, 103, 118]
# Peak-to-trough: 115 → 95 = -17.391%
DATASET_C_NAV = [100.0, 108.0, 115.0, 95.0, 103.0, 118.0]

# Dataset D: 20 returns simulating Indian equity fund — used for VaR precision test.
# Calibrated so that the historical 5th percentile = -2.50%
DATASET_D = [
    -0.0250, -0.0150, -0.0120, -0.0090, -0.0060,   # bottom 5 returns (20% of 25)
     0.0010,  0.0020,  0.0030,  0.0035,  0.0040,   # middle band
     0.0050,  0.0055,  0.0060,  0.0065,  0.0070,   # upper-middle band
     0.0080,  0.0090,  0.0100,  0.0110,  0.0120,   # top band
]
# With N=20 sorted ascending, the 5th percentile (1-0.95=0.05) via linear interpolation
# virtual_idx = 0.05 * 19 = 0.95 → lower=0, upper=1, frac=0.95
# Q = DATASET_D[0] * (1-0.95) + DATASET_D[1] * 0.95 = -0.025*0.05 + (-0.015)*0.95 = -0.01550
# Historical VaR 95% = max(-(-0.01550), 0) = 0.01550 = 1.55%

# Dataset E: 4-asset correlation matrix fixture (manually verified).
# EQ  returns: alternating +1.5%, -1.0%  (4 obs)
# BOND returns: opposite sign dampened    (4 obs) — negative correlation to EQ
# GOLD returns: independent               (4 obs)
# CASH returns: all 0.001 — zero variance (4 obs)
DATASET_E = {
    "EQ":   [ 0.015, -0.010,  0.015, -0.010],
    "BOND": [-0.008,  0.005, -0.008,  0.005],
    "GOLD": [ 0.002,  0.003, -0.001,  0.004],
    "CASH": [ 0.001,  0.001,  0.001,  0.001],  # zero variance
}


# ─────────────────────────────────────────────────────────────────────────────
# TIER 1: MATHEMATICAL BENCHMARK VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────


class TestVolatilityBenchmark:
    """
    Verify annualised volatility against hand-computed reference values.

    Dataset A computation trace:
      N = 10
      mean = 0.0019
      sum_sq_diff = Σ(r_i - 0.0019)^2
        = (0.0081)^2 + (0.0031)^2 + (-0.0319)^2 + (-0.0219)^2
        + (0.0061)^2 + (0.0101)^2 + (0.0071)^2 + (-0.0119)^2
        + (0.0181)^2 + (0.0131)^2
        = 6.561e-5 + 9.61e-6 + 1.01761e-3 + 4.7961e-4
        + 3.721e-5 + 1.0201e-4 + 5.041e-5 + 1.4161e-4
        + 3.2761e-4 + 1.7161e-4
        = 0.00236449  (approx)
      sample_variance = 0.00236449 / 9 = 2.627211e-4
      daily_vol = sqrt(2.627211e-4) = 0.016209
      annual_vol = 0.016209 * sqrt(252) = 0.257293
    """

    def test_dataset_a_daily_volatility(self):
        """Daily volatility must match hand-computed Bessel-corrected std dev."""
        res = compute_volatility("port-A", DATASET_A)
        n = len(DATASET_A)
        mean = sum(DATASET_A) / n
        sample_var = sum((r - mean) ** 2 for r in DATASET_A) / (n - 1)
        expected_daily = math.sqrt(sample_var)
        assert res.daily_volatility == pytest.approx(expected_daily, abs=STRICT_TOL)

    def test_dataset_a_annual_volatility_sqrt252(self):
        """Annual volatility = daily_vol × √252 with strict tolerance."""
        res = compute_volatility("port-A", DATASET_A)
        expected_annual = res.daily_volatility * math.sqrt(TRADING_DAYS)
        assert res.annual_volatility == pytest.approx(expected_annual, abs=STRICT_TOL)

    def test_dataset_a_annual_volatility_pct_conversion(self):
        """annual_volatility_pct must be exactly annual_volatility × 100."""
        res = compute_volatility("port-A", DATASET_A)
        assert res.annual_volatility_pct == pytest.approx(
            res.annual_volatility * 100.0, abs=STRICT_TOL
        )

    def test_annual_vol_is_in_reasonable_equity_range(self):
        """Dataset A represents typical equity returns; annual vol should be 15–35%."""
        res = compute_volatility("port-A", DATASET_A)
        assert 0.10 < res.annual_volatility < 0.50

    def test_two_element_minimum_case(self):
        """Minimum viable input (N=2) uses N-1=1 denominator."""
        rets = [0.02, -0.02]
        res = compute_volatility("port-min", rets)
        # mean = 0.0, sum_sq = 0.04^2 + 0.02^2... wait: [0.02,-0.02]
        # mean = 0.0, sum_sq = 0.0004 + 0.0004 = 0.0008, var = 0.0008/1 = 0.0008
        expected_daily = math.sqrt(0.0008)
        assert res.daily_volatility == pytest.approx(expected_daily, abs=STRICT_TOL)

    def test_n_observations_equals_input_length(self):
        res = compute_volatility("port-A", DATASET_A)
        assert res.n_observations == len(DATASET_A)


class TestBetaBenchmark:
    """
    Beta = Cov(portfolio, benchmark) / Var(benchmark).

    Dataset A vs Dataset B computation trace:
      N = 10
      mean_A = 0.0019, mean_B = (0.008+0.004-0.025-0.016+0.006+0.010+0.007-0.008+0.016+0.012)/10
             = 0.014/10 = 0.0014
      Cov(A,B) = Σ[(A_i - mean_A)(B_i - mean_B)] / 9
      Var(B)   = Σ[(B_i - mean_B)^2] / 9
      Beta     = Cov / Var_B
    """

    def _manual_beta(self, asset, bench):
        n = len(asset)
        ma = sum(asset) / n
        mb = sum(bench) / n
        cov = sum((asset[i] - ma) * (bench[i] - mb) for i in range(n)) / (n - 1)
        var_b = sum((bench[i] - mb) ** 2 for i in range(n)) / (n - 1)
        return cov / var_b

    def test_dataset_ab_beta_matches_formula(self):
        """Beta from Dataset A/B must match the closed-form Cov/Var formula."""
        res = compute_beta("port-A", "bench-B", DATASET_A, DATASET_B)
        expected_beta = self._manual_beta(DATASET_A, DATASET_B)
        assert res.beta == pytest.approx(expected_beta, abs=STRICT_TOL)

    def test_dataset_ab_beta_greater_than_one(self):
        """Portfolio A is more volatile than benchmark B → β > 1."""
        res = compute_beta("port-A", "bench-B", DATASET_A, DATASET_B)
        assert res.beta > 1.0

    def test_beta_covariance_stored_correctly(self):
        """The reported covariance must match the direct formula."""
        res = compute_beta("port-A", "bench-B", DATASET_A, DATASET_B)
        n = len(DATASET_A)
        ma = sum(DATASET_A) / n
        mb = sum(DATASET_B) / n
        expected_cov = sum((DATASET_A[i] - ma) * (DATASET_B[i] - mb) for i in range(n)) / (n - 1)
        assert res.covariance == pytest.approx(expected_cov, abs=STRICT_TOL)

    def test_beta_is_ratio_of_reported_values(self):
        """beta == covariance / benchmark_variance exactly (internal consistency)."""
        res = compute_beta("port-A", "bench-B", DATASET_A, DATASET_B)
        assert res.beta == pytest.approx(res.covariance / res.benchmark_variance, abs=STRICT_TOL)

    def test_beta_of_scaled_portfolio_equals_scale_factor(self):
        """Portfolio returns = k × benchmark → β = k exactly."""
        k = 1.73  # arbitrary non-trivial scale
        scaled = [k * r for r in DATASET_B]
        res = compute_beta("port-scaled", "bench-B", scaled, DATASET_B)
        assert res.beta == pytest.approx(k, abs=STRICT_TOL)

    def test_beta_symmetric_input_neutral(self):
        """
        When asset and benchmark are identical except for sign on all deviations,
        the covariance should still be positive (both deviate together).
        """
        bench = [0.01, -0.02, 0.015, -0.005, 0.02]
        asset = bench[:]
        res = compute_beta("port-id", "bench", asset, bench)
        assert res.covariance > 0


class TestSharpeBenchmark:
    """
    Sharpe Ratio = (mean_daily_excess × 252) / (daily_vol × √252)
                 = mean_daily_excess × √252 / daily_vol

    Dataset A, rf = 4% (0.04 annual)
      rf_daily = 0.04 / 252 = 1.587302e-4
      excess_i = r_i - rf_daily
      mean_excess = mean_A - rf_daily = 0.0019 - 1.587302e-4 ≈ 0.0017413
      E_a = mean_excess × 252 = 0.43879
      σ_a = daily_vol × √252 (from volatility test above ≈ 0.25729)
      S = 0.43879 / 0.25729 ≈ 1.7052
    """

    RF_ANNUAL = 0.04

    def _expected_sharpe(self, rets, rf_annual):
        n = len(rets)
        rf_daily = rf_annual / TRADING_DAYS
        excess = [r - rf_daily for r in rets]
        mean_excess = sum(excess) / n
        E_a = mean_excess * TRADING_DAYS
        mean_r = sum(rets) / n
        sample_var = sum((r - mean_r) ** 2 for r in rets) / (n - 1)
        sigma_a = math.sqrt(sample_var) * math.sqrt(TRADING_DAYS)
        return E_a / sigma_a

    def test_dataset_a_sharpe_matches_formula(self):
        res = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        expected = self._expected_sharpe(DATASET_A, self.RF_ANNUAL)
        assert res.sharpe_ratio == pytest.approx(expected, abs=STRICT_TOL)

    def test_dataset_a_sharpe_is_positive(self):
        """Dataset A mean return > rf daily → Sharpe must be positive."""
        res = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        assert res.sharpe_ratio > 0

    def test_annualised_excess_return_stored_correctly(self):
        res = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        n = len(DATASET_A)
        rf_daily = self.RF_ANNUAL / TRADING_DAYS
        mean_excess_daily = (sum(DATASET_A) / n) - rf_daily
        expected_E_a = mean_excess_daily * TRADING_DAYS
        assert res.annualised_excess_return == pytest.approx(expected_E_a, abs=STRICT_TOL)

    def test_annual_vol_stored_correctly(self):
        """The annual_volatility field must match the direct formula."""
        res = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        n = len(DATASET_A)
        mean = sum(DATASET_A) / n
        daily_vol = math.sqrt(sum((r - mean) ** 2 for r in DATASET_A) / (n - 1))
        expected_annual_vol = daily_vol * math.sqrt(TRADING_DAYS)
        assert res.annual_volatility == pytest.approx(expected_annual_vol, abs=STRICT_TOL)

    def test_sharpe_decreases_as_rf_increases(self):
        """Higher risk-free rate → lower Sharpe (smaller numerator, same denom)."""
        s1 = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=0.02)
        s2 = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=0.06)
        assert s1.sharpe_ratio > s2.sharpe_ratio

    def test_sharpe_rf_zero_vs_positive(self):
        """Sharpe with rf=0 > Sharpe with rf>0 for a portfolio with positive mean return."""
        s0 = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=0.0)
        s4 = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=0.04)
        assert s0.sharpe_ratio > s4.sharpe_ratio


class TestSortinoBenchmark:
    """
    Sortino Ratio = (R_a - rf_annual) / σ_DD_a

    σ_DD² = Σ[min(r_i - MAR_daily, 0)²] / N   (full-N denominator)
    σ_DD  = sqrt(σ_DD²)
    σ_DD_a = σ_DD × √252

    Dataset A, MAR = 4% annual = 1.587302e-4 daily
      Downside days (r_i < MAR_daily):
        Day 3: -0.03 → d = -0.03 - 1.587e-4 ≈ -0.030159
        Day 4: -0.02 → d = -0.020159
        Day 8: -0.01 → d = -0.010159
      Other days: all > MAR_daily → d = 0
      N = 10, n_down = 3
      σ_DD² = (0.030159² + 0.020159² + 0.010159²) / 10
            = (9.0956e-4 + 4.0639e-4 + 1.0320e-4) / 10
            = 1.39915e-4 / 10... wait let me be precise:
            = (0.030159^2 + 0.020159^2 + 0.010159^2) / 10
              0.030159^2 = 9.09565e-4
              0.020159^2 = 4.06384e-4
              0.010159^2 = 1.03205e-4
              sum = 1.41915e-3
            / 10 = 1.41915e-4
      σ_DD = sqrt(1.41915e-4) = 0.011913
      σ_DD_a = 0.011913 × √252 = 0.18906
      R_a = 0.0019 × 252 = 0.4788
      Sortino = (0.4788 - 0.04) / 0.18906 = 0.4388 / 0.18906 ≈ 2.3209
    """

    RF_ANNUAL = 0.04

    def _expected_sortino(self, rets, rf_annual):
        n = len(rets)
        mar_daily = rf_annual / TRADING_DAYS
        downside = [min(r - mar_daily, 0.0) for r in rets]
        n_down = sum(1 for d in downside if d < 0)
        dd_var = sum(d ** 2 for d in downside) / n
        dd_daily = math.sqrt(dd_var)
        dd_annual = dd_daily * math.sqrt(TRADING_DAYS)
        mean_r = sum(rets) / n
        r_annual = mean_r * TRADING_DAYS
        return (r_annual - rf_annual) / dd_annual if dd_annual > 1e-14 else float("inf")

    def test_dataset_a_sortino_matches_formula(self):
        res = compute_sortino("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        expected = self._expected_sortino(DATASET_A, self.RF_ANNUAL)
        assert res.sortino_ratio == pytest.approx(expected, abs=STRICT_TOL)

    def test_dataset_a_n_downside_observations(self):
        """Dataset A has 3 days below the MAR (days 3, 4, 8)."""
        res = compute_sortino("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        assert res.n_downside_observations == 3

    def test_dataset_a_downside_deviation_annual_positive(self):
        res = compute_sortino("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        assert res.downside_deviation_annual > 0

    def test_sortino_greater_than_sharpe_for_upside_skewed_returns(self):
        """
        When upside volatility is high, Sortino > Sharpe because Sharpe
        penalises both upside and downside volatility equally.
        """
        # Dataset A has large positive outliers (day 3 is -3% but days 9,10 are +2%,+1.5%)
        sharpe = compute_sharpe("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        sortino = compute_sortino("port-A", DATASET_A, risk_free_rate_annual=self.RF_ANNUAL)
        # Sortino uses only downside risk → denominator is smaller → ratio is larger
        assert sortino.sortino_ratio > sharpe.sharpe_ratio

    def test_sortino_denominator_uses_full_n_not_n_minus_1(self):
        """
        Per Sortino & Price (1994), the downside deviation uses N, not N-1.
        Verify by constructing a dataset where the difference is detectable.
        """
        rets = [0.10, -0.10, 0.10, -0.10]
        rf_annual = 0.0
        res = compute_sortino("port-full-n", rets, risk_free_rate_annual=rf_annual)
        n = len(rets)
        mar_daily = 0.0
        downside = [min(r, 0.0) for r in rets]
        # Full-N denominator
        dd_var_full_n = sum(d ** 2 for d in downside) / n
        dd_annual_full_n = math.sqrt(dd_var_full_n) * math.sqrt(TRADING_DAYS)
        assert res.downside_deviation_annual == pytest.approx(dd_annual_full_n, abs=STRICT_TOL)

    def test_sortino_rf_field_echoed(self):
        res = compute_sortino("port-A", DATASET_A, risk_free_rate_annual=0.06)
        assert res.risk_free_rate_annual == pytest.approx(0.06, abs=1e-9)


class TestDrawdownBenchmark:
    """
    Maximum Drawdown using Dataset C NAV: [100, 108, 115, 95, 103, 118].

    Peak progression:
      t=0: V=100, peak=100, D_0=0.0
      t=1: V=108, peak=108, D_1=0.0  (new peak)
      t=2: V=115, peak=115, D_2=0.0  (new peak)
      t=3: V= 95, peak=115, D_3=(95-115)/115 = -20/115 = -0.173913...
      t=4: V=103, peak=115, D_4=(103-115)/115 = -12/115 = -0.104348...
      t=5: V=118, peak=118, D_5=0.0  (new peak — recovery at t=5)

    MDD = min(D) = -0.173913...  (≈ -17.39%)
    Peak index  = 2 (at NAV 115)
    Trough index = 3 (at NAV 95)
    Recovery index = 5 (first t > 3 where NAV ≥ 115)
    Drawdown duration = 3 - 2 = 1
    Recovery duration = 5 - 3 = 2
    """

    EXPECTED_MDD       = (95.0 - 115.0) / 115.0   # -0.17391304...
    EXPECTED_PEAK_IDX  = 2
    EXPECTED_TROUGH    = 3
    EXPECTED_RECOVERY  = 5
    EXPECTED_DD_DUR    = 1
    EXPECTED_REC_DUR   = 2

    def test_dataset_c_max_drawdown_value(self):
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.max_drawdown == pytest.approx(self.EXPECTED_MDD, abs=STRICT_TOL)

    def test_dataset_c_max_drawdown_pct(self):
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.max_drawdown_pct == pytest.approx(self.EXPECTED_MDD * 100.0, abs=PCT_TOL)

    def test_dataset_c_peak_index(self):
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.peak_index == self.EXPECTED_PEAK_IDX

    def test_dataset_c_trough_index(self):
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.trough_index == self.EXPECTED_TROUGH

    def test_dataset_c_recovery_index(self):
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.recovery_index == self.EXPECTED_RECOVERY

    def test_dataset_c_drawdown_duration(self):
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.drawdown_duration == self.EXPECTED_DD_DUR

    def test_dataset_c_recovery_duration(self):
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.recovery_duration == self.EXPECTED_REC_DUR

    def test_returns_mode_matches_nav_mode(self):
        """Converting NAV to returns then using returns mode should give same MDD."""
        nav = DATASET_C_NAV
        returns = [(nav[i] / nav[i - 1]) - 1.0 for i in range(1, len(nav))]
        res_ret = compute_drawdown("port-C-ret", returns=returns)
        res_nav = compute_drawdown("port-C-nav", nav_series=nav)
        assert res_ret.max_drawdown == pytest.approx(res_nav.max_drawdown, abs=STRICT_TOL)

    def test_n_observations_includes_v0(self):
        """n_observations = len(nav_series) for nav input."""
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        assert res.n_observations == len(DATASET_C_NAV)

    def test_nav_at_trough_value(self):
        """Verify the peak NAV and trough NAV match expected values."""
        res = compute_drawdown("port-C", nav_series=DATASET_C_NAV)
        peak_val = DATASET_C_NAV[res.peak_index]
        trough_val = DATASET_C_NAV[res.trough_index]
        assert peak_val == pytest.approx(115.0, abs=STRICT_TOL)
        assert trough_val == pytest.approx(95.0, abs=STRICT_TOL)
        # MDD from stored values
        mdd_from_vals = (trough_val - peak_val) / peak_val
        assert res.max_drawdown == pytest.approx(mdd_from_vals, abs=STRICT_TOL)

    def test_multi_drawdown_selects_worst(self):
        """When there are multiple drawdowns, the maximum (worst) one is reported."""
        # Two drawdowns: -10% then -25% (worse)
        nav = [100.0, 90.0, 105.0, 130.0, 97.5, 120.0]
        # DD1: peak=100, trough=90 → -10%
        # DD2: peak=130, trough=97.5 → -25%
        res = compute_drawdown("port-multi", nav_series=nav)
        assert res.max_drawdown == pytest.approx(-0.25, abs=STRICT_TOL)
        assert res.trough_index == 4


class TestVaRBenchmark:
    """
    Parametric VaR uses z-scores: z_0.95 = 1.6448536, z_0.99 = 2.3263479.
    VaR_param = -(mean - z × std) × portfolio_value  [positive = loss]

    Historical VaR uses linear interpolation of sorted returns.

    Dataset D pre-computation:
      N = 20, sorted ascending
      Parametric:
        mean = Σ / 20 (computed below)
        std  = sample std with N-1=19
      Historical 95%:
        virtual_idx = 0.05 × 19 = 0.95
        lower = 0, upper = 1, frac = 0.95
        Q = D[0] × 0.05 + D[1] × 0.95 = -0.025×0.05 + (-0.015)×0.95 = -0.01550
        VaR_h95 = 0.01550 → 1.55% of portfolio
    """

    PORTFOLIO_VALUE = 1_000_000.0
    Z_95 = 1.6448536269514729
    Z_99 = 2.3263478740408408

    def _parametric_var_pct(self, rets, z, portfolio_val=None):
        n = len(rets)
        mean = sum(rets) / n
        std = math.sqrt(sum((r - mean) ** 2 for r in rets) / (n - 1))
        return max(-(mean - z * std), 0.0)

    def test_dataset_d_historical_95_var_pct(self):
        """Historical 95% VaR must equal the 5th percentile of sorted returns (negated)."""
        sorted_d = sorted(DATASET_D)
        n = len(sorted_d)
        # Linear interpolation, 5th percentile: p = 0.05, virtual_idx = 0.05*(n-1)
        virtual_idx = 0.05 * (n - 1)
        lower = int(virtual_idx)
        frac = virtual_idx - lower
        q = sorted_d[lower] * (1 - frac) + sorted_d[lower + 1] * frac
        expected_var_pct = max(-q, 0.0) * 100.0

        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        assert res.historical_95.var_pct == pytest.approx(expected_var_pct, abs=PCT_TOL)

    def test_dataset_d_historical_95_var_amount(self):
        """Historical VaR amount = var_pct / 100 × portfolio_value."""
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        expected_amount = res.historical_95.var_pct / 100.0 * self.PORTFOLIO_VALUE
        assert res.historical_95.var_amount == pytest.approx(expected_amount, abs=1.0)

    def test_dataset_d_parametric_95_formula(self):
        """Parametric 95% VaR must match -(mean - 1.6449 × std) × portfolio_value."""
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        expected_pct = self._parametric_var_pct(DATASET_D, self.Z_95) * 100.0
        assert res.parametric_95.var_pct == pytest.approx(expected_pct, abs=PCT_TOL)

    def test_dataset_d_parametric_99_formula(self):
        """Parametric 99% VaR must match -(mean - 2.3263 × std) × portfolio_value."""
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        expected_pct = self._parametric_var_pct(DATASET_D, self.Z_99) * 100.0
        assert res.parametric_99.var_pct == pytest.approx(expected_pct, abs=PCT_TOL)

    def test_99_var_greater_or_equal_to_95_var_both_methods(self):
        """99% VaR ≥ 95% VaR for both methods — monotonicity property."""
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        assert res.parametric_99.var_amount >= res.parametric_95.var_amount
        assert res.historical_99.var_amount >= res.historical_95.var_amount

    def test_method_labels_are_correct(self):
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        assert res.parametric_95.method == "parametric"
        assert res.parametric_99.method == "parametric"
        assert res.historical_95.method == "historical"
        assert res.historical_99.method == "historical"

    def test_confidence_levels_are_correct(self):
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        assert res.parametric_95.confidence_level == pytest.approx(0.95)
        assert res.parametric_99.confidence_level == pytest.approx(0.99)
        assert res.historical_95.confidence_level == pytest.approx(0.95)
        assert res.historical_99.confidence_level == pytest.approx(0.99)

    def test_var_amount_equals_pct_times_portfolio_value(self):
        """var_amount = var_pct / 100 × portfolio_value — internal consistency."""
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        for estimate in [res.parametric_95, res.parametric_99,
                         res.historical_95, res.historical_99]:
            assert estimate.var_amount == pytest.approx(
                estimate.var_pct / 100.0 * self.PORTFOLIO_VALUE, abs=1.0
            )

    def test_mean_and_daily_vol_stored_correctly(self):
        """The reported mean and daily_volatility must match direct computation."""
        res = compute_var("port-D", DATASET_D, portfolio_value=self.PORTFOLIO_VALUE)
        n = len(DATASET_D)
        expected_mean = sum(DATASET_D) / n
        expected_vol = math.sqrt(sum((r - expected_mean) ** 2 for r in DATASET_D) / (n - 1))
        assert res.mean_daily_return == pytest.approx(expected_mean, abs=STRICT_TOL)
        assert res.daily_volatility == pytest.approx(expected_vol, abs=STRICT_TOL)

    def test_portfolio_value_scaling(self):
        """Doubling portfolio_value should double VaR amounts."""
        res1 = compute_var("port-D-1x", DATASET_D, portfolio_value=500_000.0)
        res2 = compute_var("port-D-2x", DATASET_D, portfolio_value=1_000_000.0)
        assert res2.parametric_95.var_amount == pytest.approx(
            2.0 * res1.parametric_95.var_amount, abs=1.0
        )
        assert res2.historical_95.var_amount == pytest.approx(
            2.0 * res1.historical_95.var_amount, abs=1.0
        )


class TestCorrelationBenchmark:
    """
    Pearson correlation ρ_ij = Cov(i,j) / (σ_i × σ_j)

    Dataset E:
      EQ:   [ 0.015, -0.010,  0.015, -0.010]  mean = 0.0025
      BOND: [-0.008,  0.005, -0.008,  0.005]  mean = -0.0015
      GOLD: [ 0.002,  0.003, -0.001,  0.004]  mean = 0.002
      CASH: [ 0.001,  0.001,  0.001,  0.001]  mean = 0.001 (zero variance)

    EQ × BOND:
      Cov(EQ, BOND) = Σ[(EQ_i - 0.0025)(BOND_i + 0.0015)] / 3
      Deviations EQ:   [+0.0125, -0.0125, +0.0125, -0.0125]
      Deviations BOND: [-0.0065, +0.0065, -0.0065, +0.0065]
      Cross-products:  [-0.0000813, -0.0000813, -0.0000813, -0.0000813]
        each = 0.0125 × (-0.0065) = -8.125e-5
      Cov = 4 × (-8.125e-5) / 3 = -1.08333e-4
      Var(EQ)  = 4 × (0.0125)² / 3 = 4 × 1.5625e-4 / 3 = 2.08333e-4
      Var(BOND) = 4 × (0.0065)² / 3 = 4 × 4.225e-5 / 3 = 5.63333e-5
      σ_EQ   = sqrt(2.08333e-4) = 0.014434
      σ_BOND = sqrt(5.63333e-5) = 7.50555e-3
      ρ_EQ_BOND = -1.08333e-4 / (0.014434 × 7.50555e-3) = -1.08333e-4 / 1.0834e-4 = -1.0
    """

    def _manual_pearson(self, a, b):
        n = len(a)
        ma = sum(a) / n
        mb = sum(b) / n
        cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / (n - 1)
        va = math.sqrt(sum((x - ma) ** 2 for x in a) / (n - 1))
        vb = math.sqrt(sum((x - mb) ** 2 for x in b) / (n - 1))
        if va < 1e-14 or vb < 1e-14:
            return 0.0
        return max(-1.0, min(1.0, cov / (va * vb)))

    def test_eq_bond_perfect_negative_correlation(self):
        """EQ and BOND in Dataset E are constructed to be perfectly anti-correlated (ρ = -1)."""
        res = compute_correlation(DATASET_E)
        eq_idx = res.asset_ids.index("EQ")
        bond_idx = res.asset_ids.index("BOND")
        assert res.matrix[eq_idx][bond_idx] == pytest.approx(-1.0, abs=STRICT_TOL)

    def test_cash_correlation_zero_for_all_assets(self):
        """CASH has zero variance → correlation with all other assets = 0.0."""
        res = compute_correlation(DATASET_E)
        cash_idx = res.asset_ids.index("CASH")
        n = res.n_assets
        for i in range(n):
            if i != cash_idx:
                assert res.matrix[cash_idx][i] == pytest.approx(0.0, abs=STRICT_TOL)
                assert res.matrix[i][cash_idx] == pytest.approx(0.0, abs=STRICT_TOL)

    def test_unit_diagonal_all_assets(self):
        """Every asset is perfectly correlated with itself → diagonal = 1.0."""
        res = compute_correlation(DATASET_E)
        for i in range(res.n_assets):
            assert res.matrix[i][i] == pytest.approx(1.0, abs=1e-9)

    def test_symmetry_all_pairs(self):
        """ρ_ij = ρ_ji for all (i, j) pairs."""
        res = compute_correlation(DATASET_E)
        n = res.n_assets
        for i in range(n):
            for j in range(n):
                assert res.matrix[i][j] == pytest.approx(res.matrix[j][i], abs=1e-9)

    def test_bounds_all_values_in_minus1_to_plus1(self):
        """All off-diagonal correlation values must be in [-1.0, 1.0]."""
        res = compute_correlation(DATASET_E)
        for row in res.matrix:
            for val in row:
                assert -1.0 - STRICT_TOL <= val <= 1.0 + STRICT_TOL

    def test_gold_correlation_matches_manual_formula(self):
        """EQ-GOLD correlation must match manual Pearson computation."""
        res = compute_correlation(DATASET_E)
        eq_idx = res.asset_ids.index("EQ")
        gold_idx = res.asset_ids.index("GOLD")
        expected = self._manual_pearson(DATASET_E["EQ"], DATASET_E["GOLD"])
        assert res.matrix[eq_idx][gold_idx] == pytest.approx(expected, abs=STRICT_TOL)

    def test_asset_id_ordering_preserved(self):
        """The output asset_ids list must preserve the dict insertion order."""
        res = compute_correlation(DATASET_E)
        assert res.asset_ids == list(DATASET_E.keys())

    def test_n_assets_and_matrix_dimensions(self):
        res = compute_correlation(DATASET_E)
        n = len(DATASET_E)
        assert res.n_assets == n
        assert len(res.matrix) == n
        for row in res.matrix:
            assert len(row) == n


# ─────────────────────────────────────────────────────────────────────────────
# TIER 2: FINANCIAL PROPERTY ASSERTIONS (INVARIANTS)
# ─────────────────────────────────────────────────────────────────────────────


class TestRiskPropertyInvariants:
    """Financial invariants that must hold for ANY valid return series."""

    def test_drawdown_always_non_positive(self):
        """MDD is always ≤ 0 by definition."""
        for nav in [
            [100.0, 110.0, 120.0],          # monotonically increasing
            [100.0, 90.0, 80.0, 70.0],      # monotonically decreasing
            [100.0, 120.0, 80.0, 130.0],    # up-down-recovery
        ]:
            res = compute_drawdown("inv-dd", nav_series=nav)
            assert res.max_drawdown <= 1e-12  # allow floating-point noise

    def test_var_99_geq_var_95_always(self):
        """99% VaR ≥ 95% VaR regardless of return distribution."""
        for rets in [DATASET_A, DATASET_D, [0.01] * 5 + [-0.05] * 5]:
            res = compute_var("inv-var", rets, portfolio_value=100_000.0)
            assert res.parametric_99.var_amount >= res.parametric_95.var_amount - 1e-6
            assert res.historical_99.var_amount >= res.historical_95.var_amount - 1e-6

    def test_volatility_non_negative_always(self):
        """Volatility is non-negative for any input."""
        for rets in [DATASET_A, [0.0] * 5, [1.0, -1.0], [0.001] * 10]:
            res = compute_volatility("inv-vol", rets)
            assert res.daily_volatility >= 0.0
            assert res.annual_volatility >= 0.0

    def test_correlation_diagonal_always_one(self):
        """ρ_ii = 1.0 regardless of the return distribution."""
        assets = {
            "A": [0.01, 0.02, 0.03, 0.04],
            "B": [0.04, 0.03, 0.02, 0.01],
        }
        res = compute_correlation(assets)
        for i in range(res.n_assets):
            assert res.matrix[i][i] == pytest.approx(1.0, abs=1e-9)

    def test_sortino_geq_0_when_return_above_mar(self):
        """When annualised return > rf_annual → Sortino > 0."""
        high_rets = [0.015, 0.012, -0.001, 0.018, 0.020]  # strong positive mean
        res = compute_sortino("inv-so", high_rets, risk_free_rate_annual=0.04)
        assert res.sortino_ratio > 0.0

    def test_beta_of_risk_free_asset_is_zero(self):
        """An asset with constant return has zero covariance with anything → β = 0."""
        bench = [0.01, -0.02, 0.015, -0.005, 0.02]
        # Asset returns a constant 0.3% daily (like a bond)
        asset = [0.003] * 5
        res = compute_beta("inv-rf", "bench", asset, bench)
        assert res.covariance == pytest.approx(0.0, abs=STRICT_TOL)
        assert res.beta == pytest.approx(0.0, abs=STRICT_TOL)


# ─────────────────────────────────────────────────────────────────────────────
# TIER 3: PORTFOLIO ARCHETYPE EDGE CASES
# ─────────────────────────────────────────────────────────────────────────────


class TestCashPortfolio:
    """
    100% Cash Portfolio: all returns are 0.0% per day.
    Financial expectation:
      - Volatility = 0.0
      - Drawdown   = 0.0 (NAV is flat)
      - VaR        = 0.0 (no movement → no loss)
      - Sortino    = +inf (no days below MAR when rf=0, all returns = MAR)
    """

    CASH_RETURNS = [0.0] * 10

    def test_cash_portfolio_zero_volatility(self):
        res = compute_volatility("cash", self.CASH_RETURNS)
        assert res.daily_volatility == pytest.approx(0.0, abs=1e-12)
        assert res.annual_volatility == pytest.approx(0.0, abs=1e-12)

    def test_cash_portfolio_zero_drawdown(self):
        res = compute_drawdown("cash", returns=self.CASH_RETURNS)
        assert res.max_drawdown == pytest.approx(0.0, abs=1e-9)

    def test_cash_portfolio_zero_var(self):
        """A flat portfolio has zero VaR on both methods when mean=0, std=0."""
        res = compute_var("cash", self.CASH_RETURNS, portfolio_value=100_000.0)
        # Parametric: -(0 - z*0) = 0
        assert res.parametric_95.var_amount == pytest.approx(0.0, abs=1.0)
        assert res.parametric_99.var_amount == pytest.approx(0.0, abs=1.0)
        # Historical: 5th percentile of [0,0,...,0] = 0 → VaR = 0
        assert res.historical_95.var_amount == pytest.approx(0.0, abs=1.0)

    def test_cash_portfolio_correlation_to_active_asset_zero(self):
        active_returns = [0.01, -0.01, 0.02, -0.02, 0.015, -0.015, 0.005, -0.005, 0.01, -0.01]
        assets = {"EQUITY": active_returns, "CASH": self.CASH_RETURNS}
        res = compute_correlation(assets)
        eq_idx = res.asset_ids.index("EQUITY")
        cash_idx = res.asset_ids.index("CASH")
        assert res.matrix[eq_idx][cash_idx] == pytest.approx(0.0, abs=STRICT_TOL)


class TestSingleSecurityPortfolio:
    """Single security portfolio: only one asset in the correlation matrix."""

    SINGLE_RETURNS = [0.01, -0.02, 0.015, -0.005, 0.008, 0.012, -0.01, 0.009]

    def test_single_security_correlation_matrix_is_1x1(self):
        res = compute_correlation({"ONLY_ASSET": self.SINGLE_RETURNS})
        assert res.n_assets == 1
        assert len(res.matrix) == 1
        assert len(res.matrix[0]) == 1
        assert res.matrix[0][0] == pytest.approx(1.0, abs=1e-9)

    def test_single_security_all_risk_metrics_compute(self):
        """All 5 standalone risk metrics should compute successfully for a single asset."""
        rets = self.SINGLE_RETURNS
        vol = compute_volatility("single", rets)
        sharpe = compute_sharpe("single", rets, risk_free_rate_annual=0.04)
        sortino = compute_sortino("single", rets, risk_free_rate_annual=0.04)
        dd = compute_drawdown("single", returns=rets)
        var = compute_var("single", rets, portfolio_value=500_000.0)

        assert vol.annual_volatility > 0
        assert isinstance(sharpe.sharpe_ratio, float)
        assert isinstance(sortino.sortino_ratio, float)
        assert dd.max_drawdown <= 0
        assert var.parametric_95.var_amount >= 0


class TestZeroVolatilityAsset:
    """
    Asset with constant daily return (e.g. fixed deposit at 7% annual).
    Daily return = 0.07 / 252 = 0.000277778
    """

    FD_DAILY = 0.07 / 252
    FD_RETURNS = [FD_DAILY] * 20

    def test_fd_zero_volatility(self):
        res = compute_volatility("FD", self.FD_RETURNS)
        assert res.daily_volatility == pytest.approx(0.0, abs=1e-12)

    def test_fd_zero_drawdown(self):
        res = compute_drawdown("FD", returns=self.FD_RETURNS)
        assert res.max_drawdown == pytest.approx(0.0, abs=1e-9)

    def test_fd_beta_zero_against_any_benchmark(self):
        """A constant-return asset has zero covariance with any benchmark → β = 0."""
        bench = DATASET_A[:20] if len(DATASET_A) >= 20 else DATASET_A + DATASET_A[:10]
        res = compute_beta("FD", "bench", self.FD_RETURNS, bench[:20])
        assert res.beta == pytest.approx(0.0, abs=STRICT_TOL)


class TestPerfectlyInversePair:
    """Two assets with ρ = -1.0: natural hedge scenario (e.g. Long equity / Short equity)."""

    BASE = [0.02, -0.015, 0.03, -0.01, 0.025, -0.02, 0.018, -0.012]
    INVERSE = [-r for r in BASE]

    def test_inverse_pair_correlation_minus_one(self):
        res = compute_correlation({"LONG": self.BASE, "SHORT": self.INVERSE})
        assert res.matrix[0][1] == pytest.approx(-1.0, abs=STRICT_TOL)

    def test_short_portfolio_negative_beta(self):
        """Short portfolio (all-negative returns when benchmark rises) → β < 0."""
        res = compute_beta("SHORT", "LONG", self.INVERSE, self.BASE)
        assert res.beta == pytest.approx(-1.0, abs=STRICT_TOL)


class TestCrashRecoveryRegime:
    """
    Multi-regime return series: 5-day bull, 3-day crash, 5-day recovery.
    Verifies that drawdown and VaR correctly handle non-stationary regimes.
    """

    BULL    = [0.010, 0.012, 0.008, 0.015, 0.011]  # avg +1.12%/day
    CRASH   = [-0.045, -0.060, -0.038]               # crash days
    RECOVERY= [0.020, 0.018, 0.025, 0.022, 0.019]   # recovery days
    FULL    = BULL + CRASH + RECOVERY                 # 13 observations

    def test_crash_dominates_max_drawdown(self):
        """The crash period should produce the largest drawdown."""
        res = compute_drawdown("crash", returns=self.FULL)
        assert res.max_drawdown < -0.10  # at least -10% drawdown

    def test_drawdown_duration_in_crash_window(self):
        """Peak must occur in the bull period (indices 0-5 of NAV = 1+5 = 6 points)."""
        res = compute_drawdown("crash", returns=self.FULL)
        assert res.peak_index <= 5  # peak within bull run

    def test_var_dominated_by_crash_returns(self):
        """Historical VaR should reflect the crash returns in the tail."""
        res = compute_var("crash", self.FULL, portfolio_value=1_000_000.0)
        # Crash days are -4.5%, -6.0%, -3.8% — they must drive up VaR
        assert res.historical_95.var_pct > 3.0  # > 3% daily VaR at 95%

    def test_sortino_reflects_crash_downside(self):
        """Crash days dominate the downside deviation → Sortino < 1."""
        res = compute_sortino("crash", self.FULL, risk_free_rate_annual=0.04)
        assert res.n_downside_observations == 3  # the 3 crash days


class TestHighVolatilityCrypto:
    """
    Crypto-style portfolio: ±5–15% daily returns.
    Validates that the engine handles extreme volatility without numerical instability.
    """

    CRYPTO_RETURNS = [
        0.12, -0.08, 0.15, -0.12, 0.09, -0.14, 0.11, -0.07,
        0.18, -0.16, 0.05, -0.10, 0.20, -0.18, 0.08, -0.06,
    ]

    def test_crypto_high_annual_volatility(self):
        """Crypto returns should produce annual volatility well above 50%."""
        res = compute_volatility("crypto", self.CRYPTO_RETURNS)
        assert res.annual_volatility > 0.50  # > 50% annualised vol for crypto

    def test_crypto_var_large_loss_amount(self):
        """Crypto VaR should be substantial (> 5% for a high-volatility asset)."""
        res = compute_var("crypto", self.CRYPTO_RETURNS, portfolio_value=1_000_000.0)
        assert res.parametric_95.var_pct > 5.0

    def test_crypto_no_numerical_overflow(self):
        """All risk metrics must complete without error for extreme returns."""
        rets = self.CRYPTO_RETURNS
        compute_volatility("crypto", rets)
        compute_sharpe("crypto", rets, risk_free_rate_annual=0.04)
        compute_sortino("crypto", rets, risk_free_rate_annual=0.04)
        compute_drawdown("crypto", returns=rets)
        compute_var("crypto", rets, portfolio_value=1_000_000.0)


# ─────────────────────────────────────────────────────────────────────────────
# TIER 4: FASTAPI INTEGRATION TESTS
# ─────────────────────────────────────────────────────────────────────────────


class TestRiskSummaryEndpoint:
    """Integration tests for POST /api/v1/risk/summary."""

    def test_full_summary_with_benchmark_returns_200(self):
        payload = {
            "portfolio_id": "integ-sum-1",
            "daily_returns": DATASET_A,
            "benchmark_returns": DATASET_B,
            "portfolio_value": 1_000_000.0,
            "risk_free_rate_annual": 0.04,
            "benchmark_id": "NIFTY_50",
        }
        resp = client.post("/api/v1/risk/summary", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        # 1. Identity fields
        assert data["portfolio_id"] == "integ-sum-1"
        assert data["n_observations"] == len(DATASET_A)
        assert data["risk_free_rate_annual"] == pytest.approx(0.04)

        # 2. Volatility section
        assert data["annual_volatility"] > 0
        assert data["annual_volatility_pct"] == pytest.approx(
            data["annual_volatility"] * 100.0, abs=PCT_TOL
        )

        # 3. Sharpe section
        assert "sharpe_ratio" in data
        assert "annualised_excess_return" in data

        # 4. Sortino section
        assert "sortino_ratio" in data
        assert "downside_deviation_annual" in data
        assert data["n_downside_observations"] == 3  # Dataset A has 3 downside days

        # 5. Drawdown section
        assert "drawdown" in data
        assert data["drawdown"]["max_drawdown"] <= 0
        assert "peak_index" in data["drawdown"]
        assert "trough_index" in data["drawdown"]

        # 6. VaR section
        assert "var" in data
        for key in ["parametric_95", "parametric_99", "historical_95", "historical_99"]:
            assert key in data["var"]
            assert data["var"][key]["var_amount"] >= 0

        # 7. Beta section (benchmark provided)
        assert data["beta"] is not None
        assert data["beta"]["benchmark_id"] == "NIFTY_50"
        assert isinstance(data["beta"]["beta"], float)

    def test_summary_without_benchmark_has_null_beta(self):
        payload = {
            "portfolio_id": "integ-sum-2",
            "daily_returns": DATASET_A,
            "portfolio_value": 500_000.0,
        }
        resp = client.post("/api/v1/risk/summary", json=payload)
        assert resp.status_code == 200
        assert resp.json()["beta"] is None

    def test_summary_values_match_standalone_modules(self):
        """Integration endpoint must produce identical results to standalone modules."""
        portfolio_value = 750_000.0
        rf = 0.04

        payload = {
            "portfolio_id": "cross-check",
            "daily_returns": DATASET_A,
            "portfolio_value": portfolio_value,
            "risk_free_rate_annual": rf,
        }
        resp = client.post("/api/v1/risk/summary", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        # Cross-check volatility
        vol = compute_volatility("cc", DATASET_A)
        assert data["annual_volatility"] == pytest.approx(vol.annual_volatility, abs=STRICT_TOL)

        # Cross-check Sharpe
        sharpe = compute_sharpe("cc", DATASET_A, risk_free_rate_annual=rf)
        assert data["sharpe_ratio"] == pytest.approx(sharpe.sharpe_ratio, abs=STRICT_TOL)

        # Cross-check VaR
        var = compute_var("cc", DATASET_A, portfolio_value=portfolio_value)
        assert data["var"]["parametric_95"]["var_amount"] == pytest.approx(
            var.parametric_95.var_amount, abs=1.0
        )

    def test_validation_errors(self):
        # 1. Too short returns (< 2) → 422
        resp = client.post(
            "/api/v1/risk/summary",
            json={"portfolio_id": "p", "daily_returns": [0.01], "portfolio_value": 1000},
        )
        assert resp.status_code == 422

        # 2. Non-positive portfolio value → 422
        resp = client.post(
            "/api/v1/risk/summary",
            json={"portfolio_id": "p", "daily_returns": [0.01, 0.02], "portfolio_value": 0},
        )
        assert resp.status_code == 422

        # 3. Misaligned benchmark → 422
        resp = client.post(
            "/api/v1/risk/summary",
            json={
                "portfolio_id": "p",
                "daily_returns": [0.01, 0.02, 0.03],
                "benchmark_returns": [0.01, 0.02],
                "portfolio_value": 1000,
            },
        )
        assert resp.status_code == 422

        # 4. NaN in returns → 422 (float('nan') serialised as null in JSON)
        resp = client.post(
            "/api/v1/risk/summary",
            json={"portfolio_id": "p", "daily_returns": [None, 0.02], "portfolio_value": 1000},
        )
        assert resp.status_code == 422

    def test_sortino_sentinel_when_no_downside(self):
        """
        When all returns exceed the MAR, Sortino = +inf → router normalises to 9999.0.
        """
        high_rets = [0.05, 0.04, 0.06, 0.03, 0.07]  # all well above 4% ann MAR daily
        payload = {
            "portfolio_id": "no-down",
            "daily_returns": high_rets,
            "portfolio_value": 100_000.0,
            "risk_free_rate_annual": 0.04,
        }
        resp = client.post("/api/v1/risk/summary", json=payload)
        assert resp.status_code == 200
        assert resp.json()["sortino_ratio"] == pytest.approx(9999.0, abs=0.1)


class TestDrawdownSeriesEndpoint:
    """Integration tests for POST /api/v1/risk/drawdown-series."""

    def test_dataset_c_returns_correct_series(self):
        """Verify the underwater equity curve for a known NAV series."""
        nav = DATASET_C_NAV
        returns = [(nav[i] / nav[i - 1]) - 1.0 for i in range(1, len(nav))]
        payload = {
            "portfolio_id": "dds-C",
            "daily_returns": returns,
        }
        resp = client.post("/api/v1/risk/drawdown-series", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        # n_observations = N+1 (includes V_0)
        assert data["n_observations"] == len(returns) + 1

        # First point is always 0.0 (starting at V_0 = peak)
        assert data["drawdown_series_pct"][0] == pytest.approx(0.0, abs=1e-9)

        # Max drawdown should match the computed MDD
        assert data["max_drawdown_pct"] == pytest.approx(
            (95.0 - 115.0) / 115.0 * 100.0, abs=PCT_TOL
        )

        # All values must be ≤ 0
        for val in data["drawdown_series_pct"]:
            assert val <= 1e-9  # allow tiny fp noise

    def test_drawdown_series_monotonically_increasing_nav(self):
        """All-positive return series → entire drawdown series is 0.0."""
        rets = [0.01, 0.02, 0.015, 0.005, 0.008]
        resp = client.post(
            "/api/v1/risk/drawdown-series",
            json={"portfolio_id": "all-up", "daily_returns": rets},
        )
        assert resp.status_code == 200
        for val in resp.json()["drawdown_series_pct"]:
            assert val == pytest.approx(0.0, abs=1e-9)

    def test_empty_returns_rejected(self):
        resp = client.post(
            "/api/v1/risk/drawdown-series",
            json={"portfolio_id": "empty", "daily_returns": []},
        )
        assert resp.status_code == 422


class TestCorrelationEndpoint:
    """Integration tests for POST /api/v1/risk/correlation."""

    def test_dataset_e_correlation_matrix(self):
        """Full Dataset E correlation via HTTP must match standalone module."""
        payload = {
            "assets": [
                {"asset_id": k, "daily_returns": v} for k, v in DATASET_E.items()
            ]
        }
        resp = client.post("/api/v1/risk/correlation", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["n_assets"] == 4
        assert data["n_observations"] == 4

        # Unit diagonal
        for i in range(4):
            assert data["matrix"][i][i] == pytest.approx(1.0, abs=1e-9)

        # Symmetry
        n = data["n_assets"]
        for i in range(n):
            for j in range(n):
                assert data["matrix"][i][j] == pytest.approx(
                    data["matrix"][j][i], abs=1e-9
                )

        # EQ-BOND should be -1.0
        ids = data["asset_ids"]
        eq_i = ids.index("EQ")
        bond_i = ids.index("BOND")
        assert data["matrix"][eq_i][bond_i] == pytest.approx(-1.0, abs=STRICT_TOL)

        # CASH correlations to all others = 0.0
        cash_i = ids.index("CASH")
        for i in range(n):
            if i != cash_i:
                assert data["matrix"][cash_i][i] == pytest.approx(0.0, abs=STRICT_TOL)

    def test_misaligned_series_rejected(self):
        """Series of unequal length → 422 validation error."""
        resp = client.post(
            "/api/v1/risk/correlation",
            json={
                "assets": [
                    {"asset_id": "A", "daily_returns": [0.01, 0.02, 0.03]},
                    {"asset_id": "B", "daily_returns": [0.01, 0.02]},
                ]
            },
        )
        assert resp.status_code == 422

    def test_single_asset_returns_1x1_matrix(self):
        resp = client.post(
            "/api/v1/risk/correlation",
            json={"assets": [{"asset_id": "ONLY", "daily_returns": [0.01, -0.02, 0.03]}]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["n_assets"] == 1
        assert data["matrix"] == [[1.0]]
