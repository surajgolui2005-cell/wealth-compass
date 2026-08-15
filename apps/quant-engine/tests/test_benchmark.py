"""
Unit tests for benchmark.py — Benchmark Comparison Analytics.

All expected values are independently verified using:
  - NumPy reference implementations
  - Hand-worked examples for β, α, and ρ
"""

import math

import numpy as np
import pytest

from src.analytics.benchmark import (
    BenchmarkMetrics,
    _daily_returns,
    _downside_std,
    compute_benchmark_metrics,
)


class TestHelpers:
    """Unit tests for internal helper functions."""

    def test_daily_returns_basic(self):
        """r_t = (P_t - P_{t-1}) / P_{t-1}"""
        prices = [100.0, 102.0, 101.0, 105.0]
        returns = _daily_returns(prices)
        assert len(returns) == 3
        assert returns[0] == pytest.approx(0.02, rel=1e-9)
        assert returns[1] == pytest.approx(-1.0 / 102.0, rel=1e-9)
        assert returns[2] == pytest.approx(4.0 / 101.0, rel=1e-9)

    def test_daily_returns_requires_min_two_prices(self):
        """Single price cannot yield any return."""
        with pytest.raises(ValueError, match="at least 2"):
            _daily_returns([100.0])

    def test_daily_returns_raises_on_zero_price(self):
        """Zero price would cause division by zero."""
        with pytest.raises(ValueError, match="strictly positive"):
            _daily_returns([100.0, 0.0, 105.0])

    def test_downside_std_ignores_positive_returns(self):
        """Downside std must only consider returns < daily_rf."""
        returns = np.array([-0.05, 0.10, -0.03, 0.08, -0.01, 0.15])
        # With daily_rf = 0, downside = [-0.05, -0.03, -0.01]
        ds = _downside_std(returns, daily_rf=0.0)
        expected = float(np.std([-0.05, -0.03, -0.01], ddof=1))
        assert ds == pytest.approx(expected, rel=1e-9)

    def test_downside_std_nan_when_fewer_than_two_downside(self):
        """Not enough downside observations → return NaN."""
        returns = np.array([0.10, 0.20, 0.05])  # All above 0
        ds = _downside_std(returns, daily_rf=0.0)
        assert math.isnan(ds)


class TestComputeBenchmarkMetrics:
    """Integration tests for the full benchmark metrics computation."""

    # Fixed reproducible price series for deterministic tests
    _PORTFOLIO = [100, 102, 101, 105, 108, 107, 110, 112, 111, 115, 118, 120]
    _BENCHMARK = [100, 101, 100, 103, 105, 104, 107, 108, 107, 111, 113, 115]

    def test_beta_direction_high_volatility_portfolio(self):
        """
        Portfolio with higher variance than benchmark should have β > 1.
        Manual check: portfolio returns more volatile ⟹ β > 1.
        """
        metrics = compute_benchmark_metrics(self._PORTFOLIO, self._BENCHMARK)
        assert metrics.beta > 1.0

    def test_correlation_in_valid_range(self):
        """Pearson correlation must lie in [-1, 1]."""
        metrics = compute_benchmark_metrics(self._PORTFOLIO, self._BENCHMARK)
        assert -1.0 <= metrics.correlation <= 1.0

    def test_n_observations_is_len_minus_one(self):
        """n_observations = len(price_series) - 1 (one fewer return than prices)."""
        metrics = compute_benchmark_metrics(self._PORTFOLIO, self._BENCHMARK)
        assert metrics.n_observations == len(self._PORTFOLIO) - 1

    def test_risk_free_rate_stored_in_result(self):
        """risk_free_rate_annual must be echoed back to the caller."""
        metrics = compute_benchmark_metrics(
            self._PORTFOLIO, self._BENCHMARK, risk_free_rate_annual=0.07
        )
        assert metrics.risk_free_rate_annual == 0.07

    def test_mismatched_lengths_raise_value_error(self):
        """Portfolio and benchmark series with different lengths must fail."""
        with pytest.raises(ValueError, match="same length"):
            compute_benchmark_metrics([100, 105, 110], [100, 103])

    def test_too_few_observations_raise_value_error(self):
        """Need at least 3 prices (2 returns) to compute any statistic."""
        with pytest.raises(ValueError, match="observations"):
            compute_benchmark_metrics([100, 105], [100, 103])

    def test_perfectly_correlated_portfolio_has_beta_near_one(self):
        """
        If portfolio prices = benchmark prices, β = 1.0, ρ = 1.0, α ≈ 0.
        """
        prices = [100, 102, 104, 106, 108, 110, 112]
        metrics = compute_benchmark_metrics(prices, prices, risk_free_rate_annual=0.0)
        assert metrics.beta == pytest.approx(1.0, rel=1e-9)
        assert metrics.correlation == pytest.approx(1.0, rel=1e-6)
        # Alpha = E[r_p] - β * E[r_b] = E[r_p] - 1.0 * E[r_p] = 0
        # (approximately 0, with floating point tolerance)
        assert metrics.alpha_annualised == pytest.approx(0.0, abs=1e-9)

    def test_sharpe_positive_when_portfolio_beats_risk_free(self):
        """
        Portfolio with consistently positive returns should have positive Sharpe.
        """
        # Monotonically rising portfolio with rf=0
        portfolio = [100 + i * 2 for i in range(12)]
        benchmark = [100 + i * 1 for i in range(12)]
        metrics = compute_benchmark_metrics(portfolio, benchmark, risk_free_rate_annual=0.0)
        assert metrics.sharpe_ratio > 0.0

    def test_tracking_error_zero_for_identical_series(self):
        """
        TE = std(r_p - r_b). When portfolio = benchmark, all active returns = 0
        and TE = 0. Information Ratio should be None (0/0).
        """
        prices = [100.0, 103.0, 107.0, 112.0, 118.0]
        metrics = compute_benchmark_metrics(prices, prices, risk_free_rate_annual=0.0)
        assert metrics.tracking_error_annualised == pytest.approx(0.0, abs=1e-10)
        assert metrics.information_ratio is None

    def test_beta_computed_correctly_manual_derivation(self):
        """
        Manual derivation for simple 3-point series:
        Portfolio prices: [100, 110, 121]  → returns [0.10, 0.10]
        Benchmark prices: [100, 105, 112]  → returns [0.05, 0.0667]
        Cov(r_p, r_b) and Var(r_b) computed by hand.
        """
        port = [100.0, 110.0, 121.0]
        bench = [100.0, 105.0, 112.0]
        r_p = np.array([0.10, 0.10])
        r_b = np.array([0.05, 0.0667])

        cov_mat = np.cov(r_p, r_b, ddof=1)
        expected_beta = cov_mat[0, 1] / cov_mat[1, 1]

        metrics = compute_benchmark_metrics(port, bench)
        assert metrics.beta == pytest.approx(expected_beta, rel=1e-6)

    def test_all_metrics_are_finite_on_normal_input(self):
        """No metric should be NaN/Inf on a clean monotonic price series."""
        portfolio = [100 + i * 1.5 for i in range(30)]
        benchmark = [100 + i * 1.0 for i in range(30)]
        metrics = compute_benchmark_metrics(portfolio, benchmark, risk_free_rate_annual=0.065)

        assert math.isfinite(metrics.beta)
        assert math.isfinite(metrics.alpha_annualised)
        assert math.isfinite(metrics.correlation)
        assert math.isfinite(metrics.tracking_error_annualised)
        assert math.isfinite(metrics.sharpe_ratio)
        assert math.isfinite(metrics.portfolio_volatility_annualised)
        assert math.isfinite(metrics.benchmark_volatility_annualised)
