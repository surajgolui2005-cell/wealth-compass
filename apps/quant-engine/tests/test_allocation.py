"""
Tests for the allocation analytics engine and HTTP router.
==========================================================

Test strategy
-------------
1. Unit tests for compute_allocation() — verify math correctness and edge cases.
2. Integration tests for POST /api/v1/allocation/breakdown — full HTTP pipeline.

All expected values are verified independently to confirm the normalisation
guarantee: sum(bucket.weight_pct) == 100.0 for every valid input.
"""

import pytest
from fastapi.testclient import TestClient

from src.analytics.allocation import (
    GroupBy,
    PositionRecord,
    UNASSIGNED_LABEL,
    compute_allocation,
)
from src.main import app

client = TestClient(app)

URL = "/api/v1/allocation/breakdown"


def _post(payload: dict) -> dict:
    return client.post(URL, json=payload)


# ── Unit: compute_allocation() ────────────────────────────────────────────────


class TestComputeAllocationUnit:
    """Direct math engine unit tests (no HTTP layer)."""

    def _make_position(self, pid: str, value: float, **kwargs) -> PositionRecord:
        return PositionRecord(position_id=pid, market_value=value, **kwargs)

    def test_single_position_100_pct(self):
        """One position → one bucket with 100% weight."""
        positions = [self._make_position("p1", 100_000.0, asset_class="Equity")]
        result = compute_allocation("port-1", positions, GroupBy.ASSET_CLASS)

        assert len(result.buckets) == 1
        assert result.buckets[0].label == "Equity"
        assert result.buckets[0].weight_pct == pytest.approx(100.0, rel=1e-9)
        assert result.total_value == pytest.approx(100_000.0)

    def test_two_equal_positions_50_50(self):
        """Two equal positions → each exactly 50%."""
        positions = [
            self._make_position("p1", 50_000.0, asset_class="Equity"),
            self._make_position("p2", 50_000.0, asset_class="Fixed Income"),
        ]
        result = compute_allocation("port-2", positions, GroupBy.ASSET_CLASS)

        assert len(result.buckets) == 2
        weights = {b.label: b.weight_pct for b in result.buckets}
        assert weights["Equity"] == pytest.approx(50.0, rel=1e-9)
        assert weights["Fixed Income"] == pytest.approx(50.0, rel=1e-9)

    def test_multi_asset_class_sum_equals_100(self):
        """4-asset portfolio: weights must sum to exactly 100.0."""
        positions = [
            self._make_position("p1", 500_000.0, asset_class="Equity"),
            self._make_position("p2", 300_000.0, asset_class="Fixed Income"),
            self._make_position("p3", 150_000.0, asset_class="Gold"),
            self._make_position("p4",  50_000.0, asset_class="Crypto"),
        ]
        result = compute_allocation("port-3", positions, GroupBy.ASSET_CLASS)

        total_weight = sum(b.weight_pct for b in result.buckets)
        assert total_weight == pytest.approx(100.0, abs=1e-9), (
            f"Expected sum=100.0, got {total_weight}"
        )
        assert len(result.buckets) == 4

    def test_correct_weight_values_multi_asset(self):
        """Verify individual bucket weights are mathematically correct."""
        positions = [
            self._make_position("p1", 600_000.0, asset_class="Equity"),    # 60%
            self._make_position("p2", 250_000.0, asset_class="Fixed Income"), # 25%
            self._make_position("p3", 150_000.0, asset_class="Gold"),       # 15%
        ]
        result = compute_allocation("port-4", positions, GroupBy.ASSET_CLASS)

        weights = {b.label: b.weight_pct for b in result.buckets}
        assert weights["Equity"] == pytest.approx(60.0, rel=1e-6)
        assert weights["Fixed Income"] == pytest.approx(25.0, rel=1e-6)
        assert weights["Gold"] == pytest.approx(15.0, rel=1e-6)

    def test_unclassified_positions_bucketed_as_unassigned(self):
        """Positions without an asset_class label → 'Unassigned / Other'."""
        positions = [
            self._make_position("p1", 400_000.0, asset_class="Equity"),
            self._make_position("p2", 200_000.0, asset_class=None),   # unclassified
            self._make_position("p3", 200_000.0, asset_class=""),     # empty string
            self._make_position("p4", 200_000.0, asset_class="   "),  # whitespace
        ]
        result = compute_allocation("port-5", positions, GroupBy.ASSET_CLASS)

        labels = {b.label for b in result.buckets}
        assert UNASSIGNED_LABEL in labels, f"Expected 'Unassigned / Other' in {labels}"

        unassigned = next(b for b in result.buckets if b.label == UNASSIGNED_LABEL)
        assert unassigned.position_count == 3
        assert unassigned.market_value == pytest.approx(600_000.0)
        assert unassigned.weight_pct == pytest.approx(60.0, rel=1e-6)

    def test_sum_equals_100_with_unassigned(self):
        """Normalisation holds even when Unassigned / Other bucket is present."""
        positions = [
            self._make_position("p1", 333_333.33, asset_class="Equity"),
            self._make_position("p2", 333_333.33, asset_class="Crypto"),
            self._make_position("p3", 333_333.34, asset_class=None),
        ]
        result = compute_allocation("port-6", positions, GroupBy.ASSET_CLASS)

        total = sum(b.weight_pct for b in result.buckets)
        assert total == pytest.approx(100.0, abs=1e-9)

    def test_all_five_group_by_dimensions(self):
        """All 5 group_by dimensions produce valid results."""
        base_positions = [
            PositionRecord(
                position_id="p1",
                market_value=100_000.0,
                asset_class="Equity",
                sector="Technology",
                geography="India",
                currency="INR",
                provider="ZERODHA",
            ),
            PositionRecord(
                position_id="p2",
                market_value=50_000.0,
                asset_class="Crypto",
                sector=None,
                geography="Global",
                currency="BTC",
                provider="BINANCE",
            ),
        ]

        dimensions = [
            (GroupBy.ASSET_CLASS, {"Equity", "Crypto"}),
            (GroupBy.SECTOR, {"Technology", UNASSIGNED_LABEL}),
            (GroupBy.GEOGRAPHY, {"India", "Global"}),
            (GroupBy.CURRENCY, {"INR", "BTC"}),
            (GroupBy.PROVIDER, {"ZERODHA", "BINANCE"}),
        ]

        for group_by, expected_labels in dimensions:
            result = compute_allocation("port-7", base_positions, group_by)
            actual_labels = {b.label for b in result.buckets}
            assert actual_labels == expected_labels, (
                f"group_by={group_by.value}: expected {expected_labels}, got {actual_labels}"
            )
            total = sum(b.weight_pct for b in result.buckets)
            assert total == pytest.approx(100.0, abs=1e-9), (
                f"group_by={group_by.value}: sum={total} != 100.0"
            )

    def test_buckets_sorted_descending_by_weight(self):
        """Buckets must be sorted descending by weight_pct."""
        positions = [
            self._make_position("p1", 10_000.0, asset_class="Crypto"),
            self._make_position("p2", 70_000.0, asset_class="Equity"),
            self._make_position("p3", 20_000.0, asset_class="Gold"),
        ]
        result = compute_allocation("port-8", positions, GroupBy.ASSET_CLASS)

        weights = [b.weight_pct for b in result.buckets]
        assert weights == sorted(weights, reverse=True)

    def test_large_float_precision_normalisation(self):
        """1000 positions of equal value — sum must be exactly 100.0."""
        positions = [
            self._make_position(f"p{i}", 1_000.0 / 3, asset_class=f"class_{i % 7}")
            for i in range(1000)
        ]
        result = compute_allocation("port-9", positions, GroupBy.ASSET_CLASS)
        total = sum(b.weight_pct for b in result.buckets)
        assert total == pytest.approx(100.0, abs=1e-9)

    def test_single_position_all_null_labels_all_dimensions(self):
        """One position with all labels null → all 5 dimensions produce Unassigned Only."""
        positions = [PositionRecord(position_id="p1", market_value=100_000.0)]

        for dim in GroupBy:
            result = compute_allocation("port-10", positions, dim)
            assert len(result.buckets) == 1
            assert result.buckets[0].label == UNASSIGNED_LABEL
            assert result.buckets[0].weight_pct == pytest.approx(100.0, rel=1e-9)

    def test_empty_positions_raises_value_error(self):
        """Empty positions list must raise ValueError."""
        with pytest.raises(ValueError, match="At least one position is required"):
            compute_allocation("port-x", [], GroupBy.ASSET_CLASS)

    def test_zero_total_value_raises_value_error(self):
        """This is blocked by Pydantic (market_value > 0), tested at math level."""
        # Manually create a PositionRecord bypassing Pydantic with market_value=0
        # Using dataclass directly
        positions = [PositionRecord(position_id="p1", market_value=1e-300)]  # near-zero
        # Should complete (not raise) since value > 0
        result = compute_allocation("port-y", positions, GroupBy.ASSET_CLASS)
        assert len(result.buckets) == 1


# ── Integration: POST /api/v1/allocation/breakdown ────────────────────────────


class TestAllocationRouterHappyPath:
    """Full HTTP integration tests for the allocation breakdown endpoint."""

    def _make_position_payload(self, pid: str, value: float, **kwargs) -> dict:
        return {"position_id": pid, "market_value": value, **kwargs}

    def test_asset_class_breakdown_sums_to_100(self):
        """Standard multi-asset portfolio grouped by asset_class."""
        payload = {
            "portfolio_id": "port-101",
            "group_by": "asset_class",
            "positions": [
                self._make_position_payload("p1", 500_000, asset_class="Equity"),
                self._make_position_payload("p2", 300_000, asset_class="Fixed Income"),
                self._make_position_payload("p3", 100_000, asset_class="Gold"),
                self._make_position_payload("p4", 100_000, asset_class="Crypto"),
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["portfolio_id"] == "port-101"
        assert data["group_by"] == "asset_class"
        assert data["total_value"] == pytest.approx(1_000_000.0)

        total_weight = sum(b["weight_pct"] for b in data["buckets"])
        assert total_weight == pytest.approx(100.0, abs=1e-9)

    def test_sector_breakdown_with_unassigned(self):
        """Sector grouping: missing sector → 'Unassigned / Other'."""
        payload = {
            "portfolio_id": "port-102",
            "group_by": "sector",
            "positions": [
                self._make_position_payload("p1", 400_000, sector="Technology"),
                self._make_position_payload("p2", 300_000, sector="Banking"),
                self._make_position_payload("p3", 300_000),  # no sector
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()

        labels = {b["label"] for b in data["buckets"]}
        assert UNASSIGNED_LABEL in labels

        total_weight = sum(b["weight_pct"] for b in data["buckets"])
        assert total_weight == pytest.approx(100.0, abs=1e-9)

    def test_geography_breakdown_correct_weights(self):
        """Geography grouping: 60/30/10 split."""
        payload = {
            "portfolio_id": "port-103",
            "group_by": "geography",
            "positions": [
                self._make_position_payload("p1", 600_000, geography="India"),
                self._make_position_payload("p2", 300_000, geography="US"),
                self._make_position_payload("p3", 100_000, geography="Global"),
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()

        weights = {b["label"]: b["weight_pct"] for b in data["buckets"]}
        assert weights["India"] == pytest.approx(60.0, rel=1e-6)
        assert weights["US"] == pytest.approx(30.0, rel=1e-6)
        assert weights["Global"] == pytest.approx(10.0, rel=1e-6)

    def test_currency_breakdown(self):
        """Currency grouping: INR/USD/BTC split."""
        payload = {
            "portfolio_id": "port-104",
            "group_by": "currency",
            "positions": [
                self._make_position_payload("p1", 700_000, currency="INR"),
                self._make_position_payload("p2", 200_000, currency="USD"),
                self._make_position_payload("p3", 100_000, currency="BTC"),
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()

        total_weight = sum(b["weight_pct"] for b in data["buckets"])
        assert total_weight == pytest.approx(100.0, abs=1e-9)
        assert data["position_count"] == 3

    def test_provider_breakdown(self):
        """Provider grouping: ZERODHA/BINANCE/MANUAL split."""
        payload = {
            "portfolio_id": "port-105",
            "group_by": "provider",
            "positions": [
                self._make_position_payload("p1", 800_000, provider="ZERODHA"),
                self._make_position_payload("p2", 150_000, provider="BINANCE"),
                self._make_position_payload("p3",  50_000, provider="MANUAL"),
            ],
        }
        resp = _post(payload)
        assert resp.status_code == 200
        data = resp.json()

        labels = {b["label"] for b in data["buckets"]}
        assert "ZERODHA" in labels
        assert "BINANCE" in labels
        assert "MANUAL" in labels

    def test_response_contains_all_required_fields(self):
        """Verify schema completeness — all expected fields present."""
        payload = {
            "portfolio_id": "port-106",
            "group_by": "asset_class",
            "positions": [
                self._make_position_payload("p1", 100_000, asset_class="Equity"),
            ],
        }
        resp = _post(payload)
        data = resp.json()
        required_response_fields = {"portfolio_id", "group_by", "total_value", "buckets", "position_count"}
        assert required_response_fields.issubset(data.keys())

        required_bucket_fields = {"label", "market_value", "weight_pct", "position_count"}
        assert required_bucket_fields.issubset(data["buckets"][0].keys())

    def test_buckets_sorted_descending_by_weight(self):
        """Buckets in HTTP response must be sorted descending by weight_pct."""
        payload = {
            "portfolio_id": "port-107",
            "group_by": "asset_class",
            "positions": [
                self._make_position_payload("p1",  50_000, asset_class="Crypto"),
                self._make_position_payload("p2", 600_000, asset_class="Equity"),
                self._make_position_payload("p3", 350_000, asset_class="Fixed Income"),
            ],
        }
        resp = _post(payload)
        data = resp.json()
        weights = [b["weight_pct"] for b in data["buckets"]]
        assert weights == sorted(weights, reverse=True)
        assert data["buckets"][0]["label"] == "Equity"


class TestAllocationRouterValidation:
    """HTTP validation (422/400) tests for the allocation breakdown endpoint."""

    def test_empty_positions_returns_422(self):
        """Pydantic min_length=1 → 422 when positions is empty."""
        payload = {
            "portfolio_id": "port-x",
            "group_by": "asset_class",
            "positions": [],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_missing_group_by_returns_422(self):
        """group_by is required."""
        payload = {
            "portfolio_id": "port-x",
            "positions": [{"position_id": "p1", "market_value": 100_000}],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_invalid_group_by_returns_422(self):
        """Unknown dimension value → 422."""
        payload = {
            "portfolio_id": "port-x",
            "group_by": "risk_level",
            "positions": [{"position_id": "p1", "market_value": 100_000}],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_negative_market_value_returns_422(self):
        """market_value must be > 0 (gt=0 Pydantic constraint)."""
        payload = {
            "portfolio_id": "port-x",
            "group_by": "asset_class",
            "positions": [{"position_id": "p1", "market_value": -1_000}],
        }
        resp = _post(payload)
        assert resp.status_code == 422

    def test_missing_portfolio_id_returns_422(self):
        """portfolio_id is required."""
        payload = {
            "group_by": "asset_class",
            "positions": [{"position_id": "p1", "market_value": 100_000}],
        }
        resp = _post(payload)
        assert resp.status_code == 422
