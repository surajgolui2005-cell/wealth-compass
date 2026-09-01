"""
Tests for the rebalance analytics engine and HTTP router.
=========================================================

Test strategy
-------------
1. Unit tests for compute_rebalance() — verify drift math, buy/sell amounts,
   zero-sum property, tolerance flags, and requires_rebalance signal.
2. Integration tests for POST /api/v1/allocation/rebalance — full HTTP pipeline.

Key invariants tested
---------------------
- Perfectly balanced portfolio → all drifts = 0, no buy/sell required.
- sum(buy_amounts) ≈ sum(sell_amounts) for pure redistribution.
- requires_rebalance = True only when at least one bucket is outside tolerance.
- Drift sign: positive = over-weight (sell), negative = under-weight (buy).
"""

import pytest
from fastapi.testclient import TestClient

from src.analytics.rebalance import AllocationWeight, compute_rebalance
from src.main import app

client = TestClient(app)

URL = "/api/v1/allocation/rebalance"


def _post(payload: dict) -> dict:
    return client.post(URL, json=payload)


# ── Unit: compute_rebalance() ─────────────────────────────────────────────────


class TestComputeRebalanceUnit:
    """Direct math engine unit tests (no HTTP layer)."""

    def test_perfectly_balanced_no_rebalance_needed(self):
        """
        Current weights == target weights → zero drift, no buy/sell,
        requires_rebalance = False.
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=60.0, target_pct=60.0),
            AllocationWeight(label="Fixed Income", current_pct=30.0, target_pct=30.0),
            AllocationWeight(label="Gold", current_pct=10.0, target_pct=10.0),
        ]
        result = compute_rebalance("port-1", weights, total_portfolio_value=1_000_000.0)

        assert result.requires_rebalance is False
        assert result.total_buy_amount == pytest.approx(0.0, abs=1e-6)
        assert result.total_sell_amount == pytest.approx(0.0, abs=1e-6)
        assert result.total_drift_pct == pytest.approx(0.0, abs=1e-6)

        for bucket in result.buckets:
            assert bucket.drift_pct == pytest.approx(0.0, abs=1e-9)
            assert bucket.buy_amount == pytest.approx(0.0)
            assert bucket.sell_amount == pytest.approx(0.0)

    def test_under_weight_equity_requires_buy(self):
        """
        Equity currently 50%, target 60% → under-weight by 10%.
        Buy amount = 10% × 1,000,000 = 100,000.
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=50.0, target_pct=60.0),
            AllocationWeight(label="Fixed Income", current_pct=30.0, target_pct=20.0),
            AllocationWeight(label="Gold", current_pct=20.0, target_pct=20.0),
        ]
        result = compute_rebalance("port-2", weights, total_portfolio_value=1_000_000.0)

        equity_bucket = next(b for b in result.buckets if b.label == "Equity")
        fi_bucket = next(b for b in result.buckets if b.label == "Fixed Income")

        # Equity: under-weight (buy)
        assert equity_bucket.drift_pct == pytest.approx(-10.0, rel=1e-6)
        assert equity_bucket.buy_amount == pytest.approx(100_000.0, rel=1e-6)
        assert equity_bucket.sell_amount == pytest.approx(0.0)

        # Fixed Income: over-weight (sell)
        assert fi_bucket.drift_pct == pytest.approx(10.0, rel=1e-6)
        assert fi_bucket.sell_amount == pytest.approx(100_000.0, rel=1e-6)
        assert fi_bucket.buy_amount == pytest.approx(0.0)

    def test_over_weight_crypto_requires_sell(self):
        """
        Crypto at 30%, target 15% → over-weight by 15%.
        Sell = 15% × 500,000 = 75,000.
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=70.0, target_pct=85.0),
            AllocationWeight(label="Crypto", current_pct=30.0, target_pct=15.0),
        ]
        result = compute_rebalance("port-3", weights, total_portfolio_value=500_000.0)

        crypto = next(b for b in result.buckets if b.label == "Crypto")
        assert crypto.drift_pct == pytest.approx(15.0, rel=1e-6)
        assert crypto.sell_amount == pytest.approx(75_000.0, rel=1e-6)
        assert crypto.buy_amount == pytest.approx(0.0)
        assert result.requires_rebalance is True

    def test_zero_sum_property(self):
        """
        Total buy amount must equal total sell amount (pure redistribution).
        Validated across a 4-bucket portfolio.
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=45.0, target_pct=60.0),       # buy 15%
            AllocationWeight(label="Fixed Income", current_pct=35.0, target_pct=25.0),  # sell 10%
            AllocationWeight(label="Gold", current_pct=15.0, target_pct=10.0),          # sell 5%
            AllocationWeight(label="Crypto", current_pct=5.0, target_pct=5.0),          # flat
        ]
        result = compute_rebalance("port-4", weights, total_portfolio_value=1_000_000.0)

        assert result.total_buy_amount == pytest.approx(result.total_sell_amount, abs=1e-4)

    def test_within_tolerance_no_rebalance_required(self):
        """
        All drifts within ±2% tolerance → requires_rebalance = False,
        all buckets in_tolerance = True.
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=61.0, target_pct=60.0),       # +1%
            AllocationWeight(label="Fixed Income", current_pct=29.0, target_pct=30.0), # -1%
            AllocationWeight(label="Gold", current_pct=10.0, target_pct=10.0),         # 0%
        ]
        result = compute_rebalance(
            "port-5", weights, total_portfolio_value=1_000_000.0, tolerance_pct=2.0
        )

        assert result.requires_rebalance is False
        assert all(b.in_tolerance for b in result.buckets)

    def test_outside_tolerance_triggers_rebalance(self):
        """
        One bucket outside 2% tolerance → requires_rebalance = True.
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=55.0, target_pct=60.0),       # -5% (outside)
            AllocationWeight(label="Fixed Income", current_pct=30.0, target_pct=30.0), # 0%
            AllocationWeight(label="Gold", current_pct=15.0, target_pct=10.0),         # +5% (outside)
        ]
        result = compute_rebalance(
            "port-6", weights, total_portfolio_value=1_000_000.0, tolerance_pct=2.0
        )

        assert result.requires_rebalance is True
        equity = next(b for b in result.buckets if b.label == "Equity")
        gold = next(b for b in result.buckets if b.label == "Gold")
        assert equity.in_tolerance is False
        assert gold.in_tolerance is False

    def test_tolerance_boundary_exactly_at_edge(self):
        """
        Drift exactly equal to tolerance_pct → in_tolerance = True (inclusive).
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=62.0, target_pct=60.0),       # +2% exactly
            AllocationWeight(label="Fixed Income", current_pct=38.0, target_pct=40.0), # -2% exactly
        ]
        result = compute_rebalance(
            "port-7", weights, total_portfolio_value=1_000_000.0, tolerance_pct=2.0
        )

        assert all(b.in_tolerance for b in result.buckets)
        assert result.requires_rebalance is False

    def test_large_portfolio_buy_sell_amounts(self):
        """
        ₹10,00,00,000 portfolio (10 Cr) — verify monetary calculations at scale.
        Equity: 40% current, 50% target → buy 10% = ₹1,000,000.
        """
        weights = [
            AllocationWeight(label="Equity", current_pct=40.0, target_pct=50.0),
            AllocationWeight(label="Fixed Income", current_pct=60.0, target_pct=50.0),
        ]
        total_value = 10_000_000.0  # ₹1 Crore
        result = compute_rebalance("port-8", weights, total_portfolio_value=total_value)

        equity = next(b for b in result.buckets if b.label == "Equity")
        fi = next(b for b in result.buckets if b.label == "Fixed Income")

        assert equity.buy_amount == pytest.approx(1_000_000.0, rel=1e-6)
        assert fi.sell_amount == pytest.approx(1_000_000.0, rel=1e-6)

    def test_total_drift_pct_is_sum_of_absolute_drifts(self):
        """total_drift_pct = sum(|drift| for each bucket)."""
        weights = [
            AllocationWeight(label="Equity", current_pct=55.0, target_pct=60.0),   # |-5| = 5
            AllocationWeight(label="Fixed Income", current_pct=35.0, target_pct=30.0),  # |+5| = 5
            AllocationWeight(label="Gold", current_pct=10.0, target_pct=10.0),     # |0| = 0
        ]
        result = compute_rebalance("port-9", weights, total_portfolio_value=1_000_000.0)
        assert result.total_drift_pct == pytest.approx(10.0, rel=1e-6)

    def test_empty_weights_raises_value_error(self):
        """Empty weights must raise ValueError."""
        with pytest.raises(ValueError, match="At least one allocation weight bucket is required"):
            compute_rebalance("port-x", [], total_portfolio_value=1_000_000.0)

    def test_negative_portfolio_value_raises_value_error(self):
        """Negative total_portfolio_value must raise ValueError."""
        weights = [
            AllocationWeight(label="Equity", current_pct=100.0, target_pct=100.0),
        ]
        with pytest.raises(ValueError, match="total_portfolio_value must be positive"):
            compute_rebalance("port-x", weights, total_portfolio_value=-1_000.0)

    def test_current_pct_not_summing_to_100_raises_value_error(self):
        """Invalid current_pct sum → ValueError."""
        weights = [
            AllocationWeight(label="Equity", current_pct=50.0, target_pct=60.0),
            AllocationWeight(label="Gold", current_pct=10.0, target_pct=40.0),  # current sums to 60
        ]
        with pytest.raises(ValueError, match="current_pct values must sum to 100"):
            compute_rebalance("port-x", weights, total_portfolio_value=1_000_000.0)

    def test_target_pct_not_summing_to_100_raises_value_error(self):
        """Invalid target_pct sum → ValueError."""
        weights = [
            AllocationWeight(label="Equity", current_pct=60.0, target_pct=70.0),
            AllocationWeight(label="Gold", current_pct=40.0, target_pct=40.0),  # target sums to 110
        ]
        with pytest.raises(ValueError, match="target_pct values must sum to 100"):
            compute_rebalance("port-x", weights, total_portfolio_value=1_000_000.0)

    def test_negative_tolerance_raises_value_error(self):
        """Negative tolerance_pct must raise ValueError."""
        weights = [
            AllocationWeight(label="Equity", current_pct=100.0, target_pct=100.0),
        ]
        with pytest.raises(ValueError, match="tolerance_pct must be non-negative"):
            compute_rebalance("port-x", weights, total_portfolio_value=1_000_000.0, tolerance_pct=-1.0)


# ── Integration: POST /api/v1/allocation/rebalance ────────────────────────────


class TestRebalanceRouterHappyPath:
    """Full HTTP integration tests for the rebalance endpoint."""

    def test_balanced_portfolio_no_rebalance(self):
        """All current == target → requires_rebalance = False."""
        payload = {
            "portfolio_id": "port-201",
            "total_portfolio_value": 1_000_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 60.0, "target_pct": 60.0},
                {"label": "Fixed Income", "current_pct": 30.0, "target_pct": 30.0},
                {"label": "Gold", "current_pct": 10.0, "target_pct": 10.0},
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["portfolio_id"] == "port-201"
        assert data["requires_rebalance"] is False
        assert data["total_buy_amount"] == pytest.approx(0.0, abs=1e-6)
        assert data["total_sell_amount"] == pytest.approx(0.0, abs=1e-6)

    def test_equity_under_weight_correct_buy_amount(self):
        """Equity 50% → 60%: buy = 10% × 500,000 = 50,000."""
        payload = {
            "portfolio_id": "port-202",
            "total_portfolio_value": 500_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 50.0, "target_pct": 60.0},
                {"label": "Fixed Income", "current_pct": 50.0, "target_pct": 40.0},
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["requires_rebalance"] is True

        equity = next(b for b in data["buckets"] if b["label"] == "Equity")
        fi = next(b for b in data["buckets"] if b["label"] == "Fixed Income")

        assert equity["drift_pct"] == pytest.approx(-10.0, rel=1e-6)
        assert equity["buy_amount"] == pytest.approx(50_000.0, rel=1e-6)
        assert fi["sell_amount"] == pytest.approx(50_000.0, rel=1e-6)

    def test_zero_sum_buy_equals_sell(self):
        """HTTP response: total_buy_amount must equal total_sell_amount."""
        payload = {
            "portfolio_id": "port-203",
            "total_portfolio_value": 2_000_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 40.0, "target_pct": 55.0},
                {"label": "Bonds", "current_pct": 40.0, "target_pct": 35.0},
                {"label": "Gold", "current_pct": 20.0, "target_pct": 10.0},
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_buy_amount"] == pytest.approx(data["total_sell_amount"], abs=1e-4)

    def test_custom_tolerance_pct(self):
        """Tolerance of 5% — drifts within 5% are in_tolerance."""
        payload = {
            "portfolio_id": "port-204",
            "total_portfolio_value": 1_000_000.0,
            "tolerance_pct": 5.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 63.0, "target_pct": 60.0},  # +3% within 5%
                {"label": "Fixed Income", "current_pct": 37.0, "target_pct": 40.0},  # -3% within 5%
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["requires_rebalance"] is False
        assert all(b["in_tolerance"] for b in data["buckets"])

    def test_response_contains_all_required_fields(self):
        """Schema completeness — all expected response fields present."""
        payload = {
            "portfolio_id": "port-205",
            "total_portfolio_value": 100_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 100.0, "target_pct": 100.0},
            ],
        }
        resp = _post(payload)
        data = resp.json()

        required_top = {
            "portfolio_id", "total_portfolio_value", "tolerance_pct",
            "buckets", "requires_rebalance", "total_drift_pct",
            "total_buy_amount", "total_sell_amount",
        }
        assert required_top.issubset(data.keys())

        required_bucket = {
            "label", "current_pct", "target_pct", "drift_pct",
            "buy_amount", "sell_amount", "in_tolerance",
        }
        assert required_bucket.issubset(data["buckets"][0].keys())

    def test_default_tolerance_is_2_percent(self):
        """Default tolerance is 2% when not specified."""
        payload = {
            "portfolio_id": "port-206",
            "total_portfolio_value": 1_000_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 100.0, "target_pct": 100.0},
            ],
        }
        resp = _post(payload)
        data = resp.json()
        assert data["tolerance_pct"] == pytest.approx(2.0)


class TestRebalanceRouterValidation:
    """HTTP validation (422/400) tests for the rebalance endpoint."""

    def test_empty_allocation_returns_422(self):
        """Pydantic min_length=1 → 422 when current_allocation is empty."""
        payload = {
            "portfolio_id": "port-x",
            "total_portfolio_value": 1_000_000.0,
            "current_allocation": [],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_negative_total_portfolio_value_returns_422(self):
        """total_portfolio_value must be > 0."""
        payload = {
            "portfolio_id": "port-x",
            "total_portfolio_value": -100_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 100.0, "target_pct": 100.0},
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_weights_not_summing_to_100_returns_400(self):
        """Pydantic model_validator catches weight sums != 100 → 422."""
        payload = {
            "portfolio_id": "port-x",
            "total_portfolio_value": 1_000_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 50.0, "target_pct": 60.0},
                {"label": "Gold", "current_pct": 10.0, "target_pct": 20.0},  # sum=60, 80 not 100
            ],
        }
        resp = _post(payload)
        assert resp.status_code in (400, 422)

    def test_missing_portfolio_id_returns_422(self):
        """portfolio_id is required."""
        payload = {
            "total_portfolio_value": 1_000_000.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 100.0, "target_pct": 100.0},
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_negative_tolerance_returns_422(self):
        """tolerance_pct must be non-negative."""
        payload = {
            "portfolio_id": "port-x",
            "total_portfolio_value": 1_000_000.0,
            "tolerance_pct": -5.0,
            "current_allocation": [
                {"label": "Equity", "current_pct": 100.0, "target_pct": 100.0},
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 422
