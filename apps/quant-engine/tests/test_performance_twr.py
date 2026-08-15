"""
Integration tests for POST /api/v1/performance/twr
===================================================

Tests the full HTTP request → router → math engine → response pipeline.
All expected values are independently verified against the Modified Dietz
formula and GIPS chain-linking rules.
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)

URL = "/api/v1/performance/twr"


def _post(payload: dict) -> dict:
    resp = client.post(URL, json=payload)
    return resp


class TestTwrRouterHappyPath:
    """Verify correct TWR computation through the HTTP layer."""

    def test_two_equal_subperiods_21pct(self):
        """
        Two sub-periods each returning 10%.
        TWR = (1.10 × 1.10) - 1 = 21%
        """
        payload = {
            "portfolio_id": "port-001",
            "sub_periods": [
                {
                    "start_date": "2026-01-01",
                    "end_date": "2026-06-30",
                    "bmv": 100_000.0,
                    "emv": 110_000.0,
                    "cash_flows": [],
                },
                {
                    "start_date": "2026-07-01",
                    "end_date": "2026-12-31",
                    "bmv": 110_000.0,
                    "emv": 121_000.0,
                    "cash_flows": [],
                },
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["portfolio_id"] == "port-001"
        assert data["twr_cumulative"] == pytest.approx(0.21, rel=1e-6)
        assert data["twr_cumulative_pct"] == pytest.approx(21.0, rel=1e-6)
        assert data["n_sub_periods"] == 2
        assert len(data["sub_period_returns"]) == 2

    def test_cash_flow_timing_neutralisation(self):
        """
        Deposit absorbed into BMV of second sub-period.
        SP1: 100 → 150 (50% return)
        SP2: 250 → 275 (10% return, after 100 deposit)
        TWR = (1.50 × 1.10) - 1 = 65%
        """
        payload = {
            "portfolio_id": "port-002",
            "sub_periods": [
                {
                    "start_date": "2026-01-01",
                    "end_date": "2026-06-30",
                    "bmv": 100_000.0,
                    "emv": 150_000.0,
                    "cash_flows": [],
                },
                {
                    "start_date": "2026-07-01",
                    "end_date": "2026-12-31",
                    "bmv": 250_000.0,
                    "emv": 275_000.0,
                    "cash_flows": [],
                },
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["twr_cumulative"] == pytest.approx(0.65, rel=1e-6)

    def test_negative_return_sub_period(self):
        """Loss sub-period followed by recovery: (-20% × +30%) = 4% cumulative."""
        payload = {
            "portfolio_id": "port-003",
            "sub_periods": [
                {
                    "start_date": "2026-01-01",
                    "end_date": "2026-03-31",
                    "bmv": 100_000.0,
                    "emv": 80_000.0,
                    "cash_flows": [],
                },
                {
                    "start_date": "2026-04-01",
                    "end_date": "2026-12-31",
                    "bmv": 80_000.0,
                    "emv": 104_000.0,
                    "cash_flows": [],
                },
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["twr_cumulative"] == pytest.approx(0.04, rel=1e-6)
        assert data["sub_period_returns"][0] == pytest.approx(-0.20, rel=1e-6)
        assert data["sub_period_returns"][1] == pytest.approx(0.30, rel=1e-6)

    def test_annualised_twr_returned(self):
        """twr_annualised must be non-None for multi-day windows."""
        payload = {
            "portfolio_id": "port-004",
            "sub_periods": [
                {
                    "start_date": "2025-01-01",
                    "end_date": "2026-01-01",
                    "bmv": 100_000.0,
                    "emv": 115_000.0,
                    "cash_flows": [],
                },
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["twr_annualised"] is not None
        assert data["twr_annualised_pct"] is not None
        # 15% over ~365 days → annualised ≈ 15% (close)
        assert data["twr_annualised_pct"] == pytest.approx(15.0, abs=0.5)

    def test_intraperiod_deposit_weighted_correctly(self):
        """
        Single sub-period with a mid-period deposit.
        BMV=100, EMV=215, deposit 100 on day ~182/365.
        Modified Dietz R ≈ 10%.
        """
        payload = {
            "portfolio_id": "port-005",
            "sub_periods": [
                {
                    "start_date": "2026-01-01",
                    "end_date": "2026-12-31",
                    "bmv": 100_000.0,
                    "emv": 215_000.0,
                    "cash_flows": [
                        {"flow_date": "2026-07-02", "amount": 100_000.0}
                    ],
                },
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sub_period_returns"][0] == pytest.approx(0.10, abs=0.01)

    def test_response_contains_all_fields(self):
        """Ensure all expected response fields are present."""
        payload = {
            "portfolio_id": "port-006",
            "sub_periods": [
                {
                    "start_date": "2026-01-01",
                    "end_date": "2026-12-31",
                    "bmv": 100_000.0,
                    "emv": 108_000.0,
                    "cash_flows": [],
                },
            ],
        }
        resp = _post(payload)
        data = resp.json()
        required_fields = {
            "portfolio_id", "twr_cumulative", "twr_annualised",
            "twr_cumulative_pct", "twr_annualised_pct",
            "sub_period_returns", "total_days", "n_sub_periods",
        }
        assert required_fields.issubset(data.keys())


class TestTwrRouterValidation:
    """Verify 400 responses for bad inputs."""

    def test_empty_sub_periods_returns_422(self):
        """Pydantic min_length=1 on sub_periods → 422 Unprocessable Entity."""
        payload = {"portfolio_id": "port-x", "sub_periods": []}
        resp = _post(payload)
        assert resp.status_code == 422

    def test_end_before_start_returns_400(self):
        """Sub-period with end_date < start_date must return 400 or 422."""
        payload = {
            "portfolio_id": "port-x",
            "sub_periods": [
                {
                    "start_date": "2026-12-31",
                    "end_date": "2026-01-01",
                    "bmv": 100.0,
                    "emv": 110.0,
                    "cash_flows": [],
                }
            ],
        }
        resp = _post(payload)
        assert resp.status_code in (400, 422)

    def test_missing_portfolio_id_returns_422(self):
        """portfolio_id is required."""
        payload = {
            "sub_periods": [
                {
                    "start_date": "2026-01-01",
                    "end_date": "2026-12-31",
                    "bmv": 100.0,
                    "emv": 110.0,
                    "cash_flows": [],
                }
            ]
        }
        resp = _post(payload)
        assert resp.status_code == 422
