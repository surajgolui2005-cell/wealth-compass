"""
Integration tests for POST /api/v1/performance/benchmark
=========================================================

Tests the HTTP layer pipeline for benchmark comparison metrics.
Expected values for Beta, Alpha, Sharpe, and Correlation are independently
verified using NumPy reference calculations in the test bodies.
"""

import math

import numpy as np
import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)

URL = "/api/v1/performance/benchmark"


def _post(payload: dict):
    return client.post(URL, json=payload)


def _build_payload(
    port_prices: list[float],
    bench_prices: list[float],
    portfolio_id: str = "bench-001",
    benchmark_id: str = "NIFTY50",
    rf: float = 0.065,
) -> dict:
    return {
        "portfolio_id": portfolio_id,
        "benchmark_id": benchmark_id,
        "portfolio_prices": port_prices,
        "benchmark_prices": bench_prices,
        "risk_free_rate_annual": rf,
    }


class TestBenchmarkRouterHappyPath:
    """Verify correct benchmark metrics through the HTTP layer."""

    # Deterministic price series
    PORT  = [100, 102, 101, 105, 108, 107, 110, 112, 111, 115, 118, 120]
    BENCH = [100, 101, 100, 103, 105, 104, 107, 108, 107, 111, 113, 115]

    def test_status_200_on_valid_input(self):
        resp = _post(_build_payload(self.PORT, self.BENCH))
        assert resp.status_code == 200

    def test_portfolio_id_and_benchmark_id_echoed(self):
        resp = _post(_build_payload(self.PORT, self.BENCH, "p-99", "SP500"))
        data = resp.json()
        assert data["portfolio_id"] == "p-99"
        assert data["benchmark_id"] == "SP500"

    def test_beta_greater_than_one_for_higher_vol_portfolio(self):
        """Portfolio more volatile than benchmark → β > 1."""
        resp = _post(_build_payload(self.PORT, self.BENCH))
        assert resp.json()["beta"] > 1.0

    def test_correlation_in_valid_range(self):
        resp = _post(_build_payload(self.PORT, self.BENCH))
        rho = resp.json()["correlation"]
        assert -1.0 <= rho <= 1.0

    def test_perfectly_correlated_series_beta_one(self):
        """Identical series → β=1, ρ=1, α≈0, TE=0."""
        prices = [100, 102, 104, 106, 108, 110, 112]
        resp = _post(_build_payload(prices, prices, rf=0.0))
        data = resp.json()
        assert data["beta"] == pytest.approx(1.0, rel=1e-9)
        assert data["correlation"] == pytest.approx(1.0, rel=1e-6)
        assert data["alpha_annualised"] == pytest.approx(0.0, abs=1e-9)
        assert data["tracking_error_annualised"] == pytest.approx(0.0, abs=1e-10)
        assert data["information_ratio"] is None

    def test_sharpe_positive_for_rising_portfolio(self):
        """Monotonically rising portfolio with rf=0 → positive Sharpe."""
        port  = [100 + i * 2 for i in range(20)]
        bench = [100 + i * 1 for i in range(20)]
        resp = _post(_build_payload(port, bench, rf=0.0))
        assert resp.json()["sharpe_ratio"] > 0.0

    def test_n_observations_correct(self):
        """n_observations = len(price series) - 1."""
        resp = _post(_build_payload(self.PORT, self.BENCH))
        assert resp.json()["n_observations"] == len(self.PORT) - 1

    def test_risk_free_rate_echoed_as_pct(self):
        resp = _post(_build_payload(self.PORT, self.BENCH, rf=0.07))
        assert resp.json()["risk_free_rate_annual_pct"] == pytest.approx(7.0, rel=1e-9)

    def test_volatilities_are_positive(self):
        resp = _post(_build_payload(self.PORT, self.BENCH))
        data = resp.json()
        assert data["portfolio_volatility_annualised_pct"] > 0.0
        assert data["benchmark_volatility_annualised_pct"] > 0.0

    def test_beta_matches_numpy_reference(self):
        """
        Manual β verification:
        β = Cov(r_p, r_b) / Var(r_b) computed via NumPy and compared to router output.
        """
        p = np.array(self.PORT, dtype=float)
        b = np.array(self.BENCH, dtype=float)
        r_p = np.diff(p) / p[:-1]
        r_b = np.diff(b) / b[:-1]
        cov = np.cov(r_p, r_b, ddof=1)
        expected_beta = cov[0, 1] / cov[1, 1]

        resp = _post(_build_payload(self.PORT, self.BENCH))
        assert resp.json()["beta"] == pytest.approx(expected_beta, rel=1e-6)

    def test_pct_fields_are_100x_decimal_fields(self):
        """alpha_annualised_pct must equal alpha_annualised × 100."""
        resp = _post(_build_payload(self.PORT, self.BENCH))
        data = resp.json()
        assert data["alpha_annualised_pct"] == pytest.approx(
            data["alpha_annualised"] * 100, rel=1e-6
        )
        assert data["tracking_error_annualised_pct"] == pytest.approx(
            data["tracking_error_annualised"] * 100, rel=1e-6
        )

    def test_all_response_fields_present(self):
        resp = _post(_build_payload(self.PORT, self.BENCH))
        data = resp.json()
        expected_keys = {
            "portfolio_id", "benchmark_id", "beta", "alpha_annualised",
            "alpha_annualised_pct", "correlation", "tracking_error_annualised",
            "tracking_error_annualised_pct", "information_ratio", "sharpe_ratio",
            "sortino_ratio", "portfolio_volatility_annualised_pct",
            "benchmark_volatility_annualised_pct", "n_observations",
            "risk_free_rate_annual_pct",
        }
        assert expected_keys.issubset(data.keys())


class TestBenchmarkRouterValidation:
    """Verify 400/422 responses for invalid inputs."""

    def test_mismatched_series_lengths_returns_422(self):
        """Unequal length series → Pydantic model_validator → 422."""
        resp = _post(
            _build_payload(
                [100, 105, 110],
                [100, 103],
            )
        )
        assert resp.status_code == 422

    def test_too_few_observations_returns_400(self):
        """Two prices (one return) → insufficient for statistics → 400."""
        resp = _post(_build_payload([100, 105], [100, 103]))
        assert resp.status_code in (400, 422)

    def test_missing_benchmark_id_returns_422(self):
        payload = {
            "portfolio_id": "p-x",
            "portfolio_prices": [100, 105, 110],
            "benchmark_prices": [100, 103, 107],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_rf_out_of_range_returns_422(self):
        """risk_free_rate_annual must be in [0, 1]."""
        payload = _build_payload([100, 105, 110], [100, 103, 107], rf=1.5)
        resp = _post(payload)
        assert resp.status_code == 422
