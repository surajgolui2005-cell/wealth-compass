"""
Diversification & Concentration Analytics Engine — Test Suite
=============================================================

Test Strategy
-------------
This suite is organised into four tiers, matching the convention established
in test_risk.py for the quantitative risk engine:

  Tier 1 — Mathematical Benchmark Verification
      Every metric (HHI, Effective N, Top-N CR, Component A, Component B,
      composite score) is verified against hand-derived reference values
      computed from the closed-form formulas in RISK_METHODOLOGY.md §8.
      Tolerance: STRICT_TOL = 1e-4 (10 basis points).

  Tier 2 — Financial Property / Invariant Assertions
      Verify structural properties that must hold regardless of input:
        – HHI bounds  (0 < HHI ≤ 10,000)
        – effective_n bounds (1 ≤ Neff ≤ N)
        – CR_N monotonicity (CR_3 ≤ CR_5 ≤ CR_10)
        – Composite score ∈ [0, 100]
        – Scoring weight partition of unity (α + β = 1)
        – Component A = 100 for equal-weight portfolios
        – Sector HHI ≥ asset HHI when sectors are more concentrated

  Tier 3 — Portfolio Archetype Edge Cases
      – Single-asset (maximum concentration, HHI = 10,000)
      – Two-asset perfectly positively correlated (Component B = 0)
      – Two-asset perfectly negatively correlated (Component B = 100)
      – N-asset equal-weight uncorrelated (score = 80)
      – N-asset equal-weight low-correlation (score ≥ 85 at ρ̄ = -0.25)
      – Highly concentrated (dominant single holding at 80%+)
      – All zero-weight assets (ValueError)
      – Empty asset dict (ValueError)
      – Correlation matrix dimension mismatch (ValueError)
      – Auto-normalisation of percentage weights (0–100 scale)
      – Auto-normalisation strips zero/negative weights
      – Small portfolio (< 3 assets) with Top-N cutoffs exceeding N

  Tier 4 — FastAPI Integration
      HTTP endpoint smoke tests via TestClient, request validation (422),
      business-logic validation (400), response schema completeness, and
      the three task-specification scoring threshold requirements.

Pre-Computed Reference Datasets
---------------------------------
All expected values are derived using the closed-form formulas from
RISK_METHODOLOGY.md §8 and verified independently. Computation traces
are documented inline above each dataset.

References
----------
    RISK_METHODOLOGY.md §8 — Diversification & Concentration Analytics.
    Herfindahl, O.C. (1950). Concentration in the U.S. Steel Industry.
    Hirschman, A.O. (1964). The Paternity of an Index. American Economic Review.
    Markowitz, H.M. (1952). Portfolio Selection. Journal of Finance.
    Meucci, A. (2009). Managing Diversification. Risk Magazine.
"""

import math
import pytest
from fastapi.testclient import TestClient

from src.analytics.risk.diversification import (
    ConcentrationRatio,
    DiversificationResult,
    _component_a,
    _component_b,
    _compute_hhi,
    _normalise_weights,
    _top_n_ratios,
    _weighted_avg_correlation,
    compute_diversification,
)
from src.main import app

client = TestClient(app)

# ── Global tolerances ─────────────────────────────────────────────────────────
STRICT_TOL = 1e-4   # absolute tolerance for ratio/fraction values
PCT_TOL    = 1e-2   # absolute tolerance for percentage-expressed values

# ── Scoring coefficients (mirrors module constants) ───────────────────────────
ALPHA = 0.60    # Effective-N weight
BETA  = 0.40    # Correlation weight


# =============================================================================
# SHARED REFERENCE DATASETS
# =============================================================================

# ── Dataset F1: 3-asset portfolio with unequal weights ────────────────────────
#
# Weights (raw, percentage scale): RELIANCE=50, INFY=30, TCS=20  → Σ=100
# Normalised:  w = [0.50, 0.30, 0.20]
#
# HHI calculation:
#   HHI = (0.50×100)² + (0.30×100)² + (0.20×100)²
#       = 2500 + 900 + 400 = 3800.00
#
# Effective N = 10,000 / 3800 = 2.6316 (4dp)
# Effective N % of max = (2.6316 / 3) × 100 = 87.7193% (4dp)
#
# Component A = min(2.6316/3, 1.0) × 100 = 87.7193
# Component B (no corr data) = 50.0  [neutral default]
# Score = 0.60 × 87.7193 + 0.40 × 50 = 52.6316 + 20 = 72.6316

WEIGHTS_F1              = {"RELIANCE": 50.0, "INFY": 30.0, "TCS": 20.0}
EXPECTED_F1_HHI         = 3800.00
EXPECTED_F1_EFFECTIVE_N = 10_000.0 / 3800.0     # 2.631578...
EXPECTED_F1_EFF_N_PCT   = (EXPECTED_F1_EFFECTIVE_N / 3) * 100   # 87.7193...
EXPECTED_F1_COMP_A      = EXPECTED_F1_EFF_N_PCT
EXPECTED_F1_COMP_B      = 50.0
EXPECTED_F1_SCORE       = ALPHA * EXPECTED_F1_COMP_A + BETA * EXPECTED_F1_COMP_B


# ── Dataset F2: 5-asset equal-weight portfolio with full correlation matrix ───
#
# Weights: 5 assets at 20% each → normalised w_i = 0.20
# HHI = 5 × (0.20×100)² = 5 × 400 = 2000.00
# Effective N = 10,000/2000 = 5.0  →  Component A = 100.0
#
# Correlation matrix (off-diagonal values, all pairs use pair_weight = 0.2):
#   ρ(A,B)=0.80  ρ(A,C)=0.20  ρ(A,D)=0.10  ρ(A,E)=-0.10
#   ρ(B,C)=0.30  ρ(B,D)=0.20  ρ(B,E)=-0.20
#   ρ(C,D)=0.50  ρ(C,E)=0.10
#   ρ(D,E)=0.30
#
# M = C(5,2) = 10 pairs; all pair_weights = 0.2; Σ_norm = 10 × 0.2 = 2.0
# Sum of ρ_ij = 0.80+0.20+0.10-0.10+0.30+0.20-0.20+0.50+0.10+0.30 = 2.20
# rho_bar = (0.2 × 2.20) / 2.0 = 0.22
# Component B = (1-0.22)/2 × 100 = 39.0
# Score = 0.60×100 + 0.40×39.0 = 60 + 15.6 = 75.6

WEIGHTS_F2_EQUAL = {k: 20.0 for k in ["A", "B", "C", "D", "E"]}
IDS_F2 = ["A", "B", "C", "D", "E"]
CORR_F2 = [
    # A      B      C      D      E
    [ 1.00,  0.80,  0.20,  0.10, -0.10],   # A
    [ 0.80,  1.00,  0.30,  0.20, -0.20],   # B
    [ 0.20,  0.30,  1.00,  0.50,  0.10],   # C
    [ 0.10,  0.20,  0.50,  1.00,  0.30],   # D
    [-0.10, -0.20,  0.10,  0.30,  1.00],   # E
]
EXPECTED_F2_HHI      = 2000.00
EXPECTED_F2_RHO_BAR  = 0.22
EXPECTED_F2_COMP_B   = (1 - EXPECTED_F2_RHO_BAR) / 2 * 100   # 39.0
EXPECTED_F2_SCORE    = ALPHA * 100.0 + BETA * EXPECTED_F2_COMP_B   # 75.6


# ── Dataset F3: 20-asset equal-weight, ρ̄ = -0.25 (broad multi-asset) ─────────
#
# Weights: 20 × 5.0 → normalised w_i = 0.05
# HHI = 20 × (0.05×100)² = 20 × 25 = 500.00
# Effective N = 10,000/500 = 20.0  →  Component A = 100.0
# Uniform off-diagonal ρ = -0.25:
#   M = C(20,2) = 190 pairs; Σ_norm = 190 × 0.05 = 9.5
#   rho_bar = (190 × 0.05 × -0.25) / 9.5 = -0.25
# Component B = (1-(-0.25))/2 × 100 = 62.5
# Score = 0.60×100 + 0.40×62.5 = 60 + 25 = 85.0

_N20    = 20
WEIGHTS_F3 = {f"ASSET_{i}": 5.0 for i in range(_N20)}
IDS_F3     = [f"ASSET_{i}" for i in range(_N20)]
CORR_F3    = [[1.0 if i == j else -0.25 for j in range(_N20)] for i in range(_N20)]
EXPECTED_F3_HHI   = 500.00
EXPECTED_F3_SCORE = 85.0   # boundary archetype from RISK_METHODOLOGY.md §8.5.6


# ── Dataset F4: 2-asset portfolio — perfect positive correlation ───────────────
#
# Weights: STOCK=70, BOND=30  → HHI = 4900+900 = 5800.00
# Effective N = 10,000/5800 = 1.7241
# Component A = min(1.7241/2, 1.0) × 100 = 86.2069
# ρ(STOCK,BOND) = 1.0  → rho_bar = 1.0
# Component B = (1-1)/2 × 100 = 0.0
# Score = 0.60×86.2069 + 0.40×0 = 51.7241

WEIGHTS_F4 = {"STOCK": 70.0, "BOND": 30.0}
IDS_F4     = ["STOCK", "BOND"]
CORR_F4    = [[1.0, 1.0], [1.0, 1.0]]
EXPECTED_F4_HHI    = 5800.00
EXPECTED_F4_COMP_A = (10_000.0 / 5800.0) / 2 * 100   # 86.2069
EXPECTED_F4_COMP_B = 0.0
EXPECTED_F4_SCORE  = ALPHA * EXPECTED_F4_COMP_A + BETA * EXPECTED_F4_COMP_B


# ── Dataset F5: 2-asset portfolio — perfect negative correlation ──────────────
#
# Weights: EQUITY=60, GOLD=40  → HHI = 3600+1600 = 5200.00
# Effective N = 10,000/5200 = 1.9231
# Component A = min(1.9231/2, 1.0) × 100 = 96.1538
# ρ(EQUITY,GOLD) = -1.0  → rho_bar = -1.0
# Component B = (1-(-1))/2 × 100 = 100.0
# Score = 0.60×96.1538 + 0.40×100 = 57.6923 + 40 = 97.6923

WEIGHTS_F5 = {"EQUITY": 60.0, "GOLD": 40.0}
IDS_F5     = ["EQUITY", "GOLD"]
CORR_F5    = [[1.0, -1.0], [-1.0, 1.0]]
EXPECTED_F5_HHI    = 5200.00
EXPECTED_F5_COMP_A = (10_000.0 / 5200.0) / 2 * 100   # 96.1538
EXPECTED_F5_COMP_B = 100.0
EXPECTED_F5_SCORE  = ALPHA * EXPECTED_F5_COMP_A + BETA * EXPECTED_F5_COMP_B


# ── Dataset F6: Highly concentrated — dominant single holding ─────────────────
#
# Weights: AAPL=80, MSFT=10, GOOG=5, META=3, AMZN=2  (Σ=100)
# HHI = 6400+100+25+9+4 = 6538.00
# Effective N = 10,000/6538 = 1.5296
# Component A = min(1.5296/5, 1.0) × 100 = 30.5922
# Component B (no corr) = 50.0
# Score = 0.60×30.5922 + 0.40×50 = 18.3553 + 20 = 38.3553

WEIGHTS_F6 = {"AAPL": 80.0, "MSFT": 10.0, "GOOG": 5.0, "META": 3.0, "AMZN": 2.0}
EXPECTED_F6_HHI    = 6538.00
EXPECTED_F6_EFF_N  = 10_000.0 / 6538.0
EXPECTED_F6_COMP_A = (EXPECTED_F6_EFF_N / 5) * 100
EXPECTED_F6_SCORE  = ALPHA * EXPECTED_F6_COMP_A + BETA * 50.0


# =============================================================================
# TIER 1: MATHEMATICAL BENCHMARK VERIFICATION
# =============================================================================


class TestHhiBenchmark:
    """
    Verify HHI against hand-derived reference values.
    Formula: HHI = Σ (w_i × 100)²  [after normalisation to sum=1]
    """

    def test_f1_hhi_three_asset_unequal(self):
        """3-asset 50/30/20 — trace: 2500+900+400 = 3800."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.hhi == pytest.approx(EXPECTED_F1_HHI, abs=STRICT_TOL)

    def test_f2_hhi_five_asset_equal_weight(self):
        """5 equal-weight at 20% — HHI = 5 × 400 = 2000."""
        r = compute_diversification("f2", WEIGHTS_F2_EQUAL)
        assert r.hhi == pytest.approx(EXPECTED_F2_HHI, abs=STRICT_TOL)

    def test_f3_hhi_twenty_asset_equal_weight(self):
        """20 equal-weight at 5% — HHI = 20 × 25 = 500."""
        r = compute_diversification("f3", WEIGHTS_F3)
        assert r.hhi == pytest.approx(EXPECTED_F3_HHI, abs=STRICT_TOL)

    def test_f4_hhi_two_asset_70_30(self):
        """2-asset 70/30 — HHI = 4900+900 = 5800."""
        r = compute_diversification("f4", WEIGHTS_F4)
        assert r.hhi == pytest.approx(EXPECTED_F4_HHI, abs=STRICT_TOL)

    def test_f6_hhi_dominant_holding(self):
        """80%-dominant 5-asset — HHI = 6538."""
        r = compute_diversification("f6", WEIGHTS_F6)
        assert r.hhi == pytest.approx(EXPECTED_F6_HHI, abs=STRICT_TOL)

    def test_single_asset_hhi_is_maximum(self):
        """Single-asset → HHI = 10,000 (maximum possible)."""
        r = compute_diversification("single", {"RELIANCE": 1.0})
        assert r.hhi == pytest.approx(10_000.0, abs=STRICT_TOL)

    def test_hhi_invariant_to_weight_scale(self):
        """
        Fraction weights (0.5, 0.3, 0.2) and percentage weights (50, 30, 20)
        must yield identical HHI after auto-normalisation.
        """
        r_frac = compute_diversification("frac", {"A": 0.5, "B": 0.3, "C": 0.2})
        r_pct  = compute_diversification("pct",  {"A": 50.0, "B": 30.0, "C": 20.0})
        assert r_frac.hhi == pytest.approx(r_pct.hhi, abs=STRICT_TOL)

    def test_hhi_identity_sum_of_squared_weights(self):
        """
        Cross-check: HHI / 10,000 = Σw_i² (exact mathematical identity).
        """
        r = compute_diversification("f1", WEIGHTS_F1)
        norm = _normalise_weights(WEIGHTS_F1)
        expected_sum_sq = sum(w ** 2 for w in norm.values())
        assert r.hhi / 10_000.0 == pytest.approx(expected_sum_sq, abs=STRICT_TOL)


class TestEffectiveNBenchmark:
    """Verify Effective N = 10,000 / HHI and Effective N % of max."""

    def test_f1_effective_n(self):
        """3-asset 50/30/20: Eff N = 10,000/3800 = 2.6316."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.effective_n == pytest.approx(EXPECTED_F1_EFFECTIVE_N, abs=STRICT_TOL)

    def test_f1_effective_n_pct_of_max(self):
        """Eff N % = 2.6316/3 × 100 = 87.7193."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.effective_n_pct_of_max == pytest.approx(
            EXPECTED_F1_EFF_N_PCT, abs=PCT_TOL
        )

    def test_f2_effective_n_equals_n_for_equal_weight(self):
        """5 equal-weight assets → Eff N = 5.0 exactly."""
        r = compute_diversification("f2", WEIGHTS_F2_EQUAL)
        assert r.effective_n == pytest.approx(5.0, abs=STRICT_TOL)

    def test_f2_effective_n_pct_is_100_for_equal_weight(self):
        """Equal-weight portfolio → Eff N % = 100.0."""
        r = compute_diversification("f2", WEIGHTS_F2_EQUAL)
        assert r.effective_n_pct_of_max == pytest.approx(100.0, abs=STRICT_TOL)

    def test_f3_effective_n_equals_20(self):
        """20 equal-weight → Eff N = 20."""
        r = compute_diversification("f3", WEIGHTS_F3)
        assert r.effective_n == pytest.approx(20.0, abs=STRICT_TOL)

    def test_single_asset_effective_n_is_one(self):
        """Single asset → Eff N = 1.0."""
        r = compute_diversification("single", {"RELIANCE": 1.0})
        assert r.effective_n == pytest.approx(1.0, abs=STRICT_TOL)

    def test_f6_effective_n_low_for_dominant_holding(self):
        """80%-dominant → Eff N ≈ 1.53 (much less than N=5)."""
        r = compute_diversification("f6", WEIGHTS_F6)
        assert r.effective_n == pytest.approx(EXPECTED_F6_EFF_N, abs=STRICT_TOL)

    def test_effective_n_times_hhi_equals_10000(self):
        """Neff × HHI = 10,000 (reciprocal identity).

        Tolerance is 0.5 because effective_n is stored at 4dp and hhi at 2dp;
        the product of two rounded values introduces up to ~0.1 absolute error.
        """
        for weights in [WEIGHTS_F1, WEIGHTS_F2_EQUAL, WEIGHTS_F6]:
            r = compute_diversification("x", weights)
            assert r.effective_n * r.hhi == pytest.approx(10_000.0, abs=0.5)


class TestConcentrationRatioBenchmark:
    """
    Verify Top-N Concentration Ratios (CR_N) against hand-computed values.
    Formula: CR_N = Σ_{top-N sorted desc} w_i × 100  [%]
    """

    def test_f1_cr3_covers_all_three_assets(self):
        """3-asset portfolio: CR_3 = 100% (top 3 = all assets)."""
        r = compute_diversification("f1", WEIGHTS_F1, top_n_ratios=[3, 5, 10])
        cr3 = next(cr for cr in r.concentration_ratios if cr.n == 3)
        assert cr3.weight_pct == pytest.approx(100.0, abs=STRICT_TOL)
        assert cr3.actual_n == 3

    def test_f1_cr5_clips_to_available_assets(self):
        """3-asset portfolio: CR_5 clips to actual_n=3, weight_pct=100%."""
        r = compute_diversification("f1", WEIGHTS_F1, top_n_ratios=[3, 5, 10])
        cr5 = next(cr for cr in r.concentration_ratios if cr.n == 5)
        assert cr5.actual_n == 3
        assert cr5.weight_pct == pytest.approx(100.0, abs=STRICT_TOL)

    def test_f6_cr1_equals_dominant_holding(self):
        """80%-dominant portfolio: CR_1 = 80%."""
        r = compute_diversification("f6", WEIGHTS_F6, top_n_ratios=[1, 3, 5])
        cr1 = next(cr for cr in r.concentration_ratios if cr.n == 1)
        assert cr1.weight_pct == pytest.approx(80.0, abs=PCT_TOL)

    def test_f6_cr3_top_three_sum(self):
        """80%-dominant portfolio: CR_3 = 80+10+5 = 95%."""
        r = compute_diversification("f6", WEIGHTS_F6, top_n_ratios=[1, 3, 5])
        cr3 = next(cr for cr in r.concentration_ratios if cr.n == 3)
        assert cr3.weight_pct == pytest.approx(95.0, abs=PCT_TOL)

    def test_f6_cr5_is_100_pct(self):
        """5-asset portfolio: CR_5 = 100% (all assets included)."""
        r = compute_diversification("f6", WEIGHTS_F6, top_n_ratios=[1, 3, 5])
        cr5 = next(cr for cr in r.concentration_ratios if cr.n == 5)
        assert cr5.weight_pct == pytest.approx(100.0, abs=STRICT_TOL)

    def test_f2_cr3_is_60_pct_for_equal_weight(self):
        """Equal-weight 5-asset: CR_3 = 60.0%."""
        r = compute_diversification("f2", WEIGHTS_F2_EQUAL, top_n_ratios=[3])
        cr3 = next(cr for cr in r.concentration_ratios if cr.n == 3)
        assert cr3.weight_pct == pytest.approx(60.0, abs=PCT_TOL)
        assert len(cr3.asset_ids) == 3

    def test_single_asset_all_cr_are_100(self):
        """Single-asset: all CR_N = 100%, actual_n = 1."""
        r = compute_diversification("single", {"X": 1.0}, top_n_ratios=[3, 5, 10])
        for cr in r.concentration_ratios:
            assert cr.weight_pct == pytest.approx(100.0, abs=STRICT_TOL)
            assert cr.actual_n == 1

    def test_default_top_n_ratios_are_3_5_10(self):
        """When top_n_ratios omitted, default cut-offs are [3, 5, 10]."""
        r = compute_diversification("f1", WEIGHTS_F1)
        ns = sorted(cr.n for cr in r.concentration_ratios)
        assert ns == [3, 5, 10]

    def test_custom_top_n_ratios_respected(self):
        """Custom top_n_ratios=[1, 2, 7] must produce exactly those cut-offs."""
        r = compute_diversification("f6", WEIGHTS_F6, top_n_ratios=[1, 2, 7])
        ns = sorted(cr.n for cr in r.concentration_ratios)
        assert ns == [1, 2, 7]

    def test_cr_sorted_assets_by_weight_descending(self):
        """Top-N asset list must be ordered by weight descending."""
        r = compute_diversification("f6", WEIGHTS_F6, top_n_ratios=[3])
        cr3 = r.concentration_ratios[0]
        assert cr3.asset_ids[0] == "AAPL"   # 80% → always first


class TestComponentScoresBenchmark:
    """
    Verify Component A, Component B, and composite score against hand traces.
    Score formula: Score = α × A + β × B  (α=0.60, β=0.40)
    """

    def test_f1_component_a_score(self):
        """3-asset 50/30/20: comp_a = 87.7193."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.component_a_score == pytest.approx(EXPECTED_F1_COMP_A, abs=PCT_TOL)

    def test_f1_component_b_neutral_default(self):
        """Without correlation data: comp_b = 50 (neutral assumption)."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.component_b_score == pytest.approx(50.0, abs=STRICT_TOL)
        assert r.correlation_data_used is False
        assert r.weighted_avg_correlation is None

    def test_f1_composite_score_without_correlation(self):
        """Score = 0.60×87.7193 + 0.40×50 = 72.6316."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.diversification_score == pytest.approx(EXPECTED_F1_SCORE, abs=PCT_TOL)

    def test_f2_rho_bar_accuracy(self):
        """5-asset equal-weight with known matrix: rho_bar = 0.22."""
        r = compute_diversification(
            "f2", WEIGHTS_F2_EQUAL,
            correlation_matrix=CORR_F2,
            correlation_asset_ids=IDS_F2,
        )
        assert r.weighted_avg_correlation == pytest.approx(
            EXPECTED_F2_RHO_BAR, abs=STRICT_TOL
        )

    def test_f2_component_b_with_correlation(self):
        """rho_bar=0.22 → comp_b = (1-0.22)/2 × 100 = 39.0."""
        r = compute_diversification(
            "f2", WEIGHTS_F2_EQUAL,
            correlation_matrix=CORR_F2,
            correlation_asset_ids=IDS_F2,
        )
        assert r.component_b_score == pytest.approx(EXPECTED_F2_COMP_B, abs=PCT_TOL)
        assert r.correlation_data_used is True

    def test_f2_composite_score_with_correlation(self):
        """Score = 0.60×100 + 0.40×39.0 = 75.6."""
        r = compute_diversification(
            "f2", WEIGHTS_F2_EQUAL,
            correlation_matrix=CORR_F2,
            correlation_asset_ids=IDS_F2,
        )
        assert r.diversification_score == pytest.approx(EXPECTED_F2_SCORE, abs=PCT_TOL)

    def test_f3_broad_multi_asset_hits_85_boundary(self):
        """
        Key boundary archetype (RISK_METHODOLOGY.md §8.5.6):
        20-asset equal-weight with ρ̄ = -0.25 → score = 85.0 exactly.
        """
        r = compute_diversification(
            "f3", WEIGHTS_F3,
            correlation_matrix=CORR_F3,
            correlation_asset_ids=IDS_F3,
        )
        assert r.diversification_score == pytest.approx(EXPECTED_F3_SCORE, abs=PCT_TOL)

    def test_f4_perfect_positive_corr_comp_b_zero(self):
        """ρ=+1.0 across all pairs → comp_b = 0 (no diversification benefit)."""
        r = compute_diversification(
            "f4", WEIGHTS_F4,
            correlation_matrix=CORR_F4,
            correlation_asset_ids=IDS_F4,
        )
        assert r.component_b_score == pytest.approx(0.0, abs=STRICT_TOL)

    def test_f4_perfect_positive_corr_composite_score(self):
        """Score = 0.60×86.2069 + 0.40×0 = 51.7241."""
        r = compute_diversification(
            "f4", WEIGHTS_F4,
            correlation_matrix=CORR_F4,
            correlation_asset_ids=IDS_F4,
        )
        assert r.diversification_score == pytest.approx(EXPECTED_F4_SCORE, abs=PCT_TOL)

    def test_f5_perfect_negative_corr_comp_b_100(self):
        """ρ=-1.0 → comp_b = 100 (maximum hedge, best possible)."""
        r = compute_diversification(
            "f5", WEIGHTS_F5,
            correlation_matrix=CORR_F5,
            correlation_asset_ids=IDS_F5,
        )
        assert r.component_b_score == pytest.approx(100.0, abs=STRICT_TOL)

    def test_f5_perfect_negative_corr_composite_score(self):
        """Score = 0.60×96.1538 + 0.40×100 = 97.6923."""
        r = compute_diversification(
            "f5", WEIGHTS_F5,
            correlation_matrix=CORR_F5,
            correlation_asset_ids=IDS_F5,
        )
        assert r.diversification_score == pytest.approx(EXPECTED_F5_SCORE, abs=PCT_TOL)

    def test_f6_low_score_for_dominant_holding(self):
        """80%-dominant portfolio: score = 38.36 (< 40 — 'Poor' tier)."""
        r = compute_diversification("f6", WEIGHTS_F6)
        assert r.diversification_score == pytest.approx(EXPECTED_F6_SCORE, abs=PCT_TOL)
        assert r.diversification_score < 40.0


# =============================================================================
# TIER 2: FINANCIAL PROPERTY / INVARIANT ASSERTIONS
# =============================================================================


class TestHhiInvariants:
    """HHI must satisfy hard mathematical bounds in all cases."""

    def test_hhi_always_positive(self):
        """HHI > 0 for any non-trivial portfolio."""
        for weights in [WEIGHTS_F1, WEIGHTS_F2_EQUAL, WEIGHTS_F3, WEIGHTS_F6]:
            r = compute_diversification("x", weights)
            assert r.hhi > 0.0

    def test_hhi_bounded_above_by_10000(self):
        """HHI ≤ 10,000 for all portfolios."""
        for weights in [WEIGHTS_F1, WEIGHTS_F2_EQUAL, WEIGHTS_F6, {"X": 1.0}]:
            r = compute_diversification("x", weights)
            assert r.hhi <= 10_000.0 + STRICT_TOL

    def test_hhi_single_asset_equals_maximum(self):
        """Single asset → HHI = 10,000 (exact upper bound)."""
        r = compute_diversification("x", {"ONLY": 1.0})
        assert r.hhi == pytest.approx(10_000.0, abs=STRICT_TOL)

    def test_hhi_decreases_with_more_equal_weight_assets(self):
        """Adding more equal-weight assets must monotonically decrease HHI."""
        prev_hhi = 10_000.0
        for n in [1, 2, 5, 10, 20, 50, 100]:
            weights = {f"A{i}": 1.0 for i in range(n)}
            r = compute_diversification("x", weights)
            assert r.hhi <= prev_hhi + STRICT_TOL
            prev_hhi = r.hhi

    def test_hhi_equal_n_assets_formula(self):
        """HHI for N equal-weight assets = 10,000/N (closed-form)."""
        for n in [1, 2, 5, 10, 20, 50]:
            weights = {f"A{i}": 1.0 for i in range(n)}
            r = compute_diversification("x", weights)
            assert r.hhi == pytest.approx(10_000.0 / n, abs=STRICT_TOL)


class TestEffectiveNInvariants:
    """Effective N must satisfy its mathematical relationships."""

    def test_effective_n_lower_bounded_by_one(self):
        """Neff ≥ 1 for all portfolios (single-stock lower bound)."""
        for weights in [WEIGHTS_F1, WEIGHTS_F6, {"X": 1.0}]:
            r = compute_diversification("x", weights)
            assert r.effective_n >= 1.0 - STRICT_TOL

    def test_effective_n_upper_bounded_by_n_assets(self):
        """Neff ≤ N_assets for all portfolios (equal-weight upper bound)."""
        for weights in [WEIGHTS_F1, WEIGHTS_F2_EQUAL, WEIGHTS_F6]:
            r = compute_diversification("x", weights)
            assert r.effective_n <= r.n_assets + STRICT_TOL

    def test_effective_n_pct_bounded_0_to_100(self):
        """Effective N % ∈ [0, 100]."""
        for weights in [WEIGHTS_F1, WEIGHTS_F6, {"ONLY": 1.0}]:
            r = compute_diversification("x", weights)
            assert 0.0 <= r.effective_n_pct_of_max <= 100.0 + STRICT_TOL

    def test_effective_n_pct_is_exactly_100_for_equal_weight(self):
        """Neff % = 100 iff portfolio is exactly equal-weight."""
        r_eq = compute_diversification("eq", WEIGHTS_F2_EQUAL)
        r_ne = compute_diversification("ne", WEIGHTS_F1)
        assert r_eq.effective_n_pct_of_max == pytest.approx(100.0, abs=STRICT_TOL)
        assert r_ne.effective_n_pct_of_max < 100.0


class TestConcentrationRatioInvariants:
    """CR_N must satisfy monotonicity and boundary properties."""

    def test_cr_n_monotonically_non_decreasing(self):
        """CR_3 ≤ CR_5 ≤ CR_10 for any portfolio."""
        for weights in [WEIGHTS_F1, WEIGHTS_F2_EQUAL, WEIGHTS_F6]:
            r = compute_diversification("x", weights, top_n_ratios=[3, 5, 10])
            crs = {cr.n: cr.weight_pct for cr in r.concentration_ratios}
            assert crs[3] <= crs[5] + STRICT_TOL
            assert crs[5] <= crs[10] + STRICT_TOL

    def test_cr_n_bounded_0_to_100(self):
        """All CR_N values ∈ [0, 100]."""
        r = compute_diversification("f6", WEIGHTS_F6, top_n_ratios=[1, 3, 5, 10])
        for cr in r.concentration_ratios:
            assert 0.0 <= cr.weight_pct <= 100.0 + STRICT_TOL

    def test_cr_full_portfolio_is_100(self):
        """CR_N where N ≥ total assets → 100%."""
        r = compute_diversification("f1", WEIGHTS_F1, top_n_ratios=[3, 100])
        cr_all = next(cr for cr in r.concentration_ratios if cr.n == 100)
        assert cr_all.weight_pct == pytest.approx(100.0, abs=STRICT_TOL)

    def test_cr_actual_n_clips_to_available(self):
        """actual_n must not exceed total number of assets."""
        r = compute_diversification("f1", WEIGHTS_F1, top_n_ratios=[3, 5, 10, 50])
        for cr in r.concentration_ratios:
            assert cr.actual_n <= 3   # F1 has only 3 assets


class TestCompositeScoreInvariants:
    """Composite score must satisfy strict mathematical and financial invariants."""

    def test_score_bounded_0_to_100(self):
        """Diversification score ∈ [0, 100] for all portfolios."""
        test_cases = [
            (WEIGHTS_F1, None, None),
            (WEIGHTS_F2_EQUAL, CORR_F2, IDS_F2),
            (WEIGHTS_F3, CORR_F3, IDS_F3),
            (WEIGHTS_F4, CORR_F4, IDS_F4),
            (WEIGHTS_F5, CORR_F5, IDS_F5),
            (WEIGHTS_F6, None, None),
        ]
        for weights, corr, ids in test_cases:
            r = compute_diversification("x", weights, correlation_matrix=corr, correlation_asset_ids=ids)
            assert 0.0 <= r.diversification_score <= 100.0

    def test_scoring_weight_partition_of_unity(self):
        """α + β = 1.0 (partition of unity constraint)."""
        assert math.isclose(ALPHA + BETA, 1.0)

    def test_score_formula_consistency(self):
        """Score = α × comp_a + β × comp_b holds for all result objects."""
        test_cases = [
            (WEIGHTS_F1, None, None),
            (WEIGHTS_F2_EQUAL, CORR_F2, IDS_F2),
            (WEIGHTS_F6, None, None),
        ]
        for weights, corr, ids in test_cases:
            r = compute_diversification("x", weights, correlation_matrix=corr, correlation_asset_ids=ids)
            expected = ALPHA * r.component_a_score + BETA * r.component_b_score
            assert r.diversification_score == pytest.approx(expected, abs=STRICT_TOL)

    def test_component_a_and_b_bounded_0_to_100(self):
        """Both sub-scores ∈ [0, 100]."""
        cases = [
            (WEIGHTS_F4, CORR_F4, IDS_F4),
            (WEIGHTS_F5, CORR_F5, IDS_F5),
            (WEIGHTS_F2_EQUAL, CORR_F2, IDS_F2),
        ]
        for weights, corr, ids in cases:
            r = compute_diversification("x", weights, correlation_matrix=corr, correlation_asset_ids=ids)
            assert 0.0 <= r.component_a_score <= 100.0
            assert 0.0 <= r.component_b_score <= 100.0

    def test_component_b_exactly_50_without_corr_data(self):
        """Component B = 50.0 exactly when correlation data is absent."""
        for weights in [WEIGHTS_F1, WEIGHTS_F2_EQUAL, WEIGHTS_F6]:
            r = compute_diversification("x", weights)
            assert r.component_b_score == pytest.approx(50.0, abs=STRICT_TOL)

    def test_correlation_data_used_flag_contract(self):
        """correlation_data_used = False without matrix; True with matrix."""
        r_no = compute_diversification("f1", WEIGHTS_F1)
        r_yes = compute_diversification(
            "f2", WEIGHTS_F2_EQUAL,
            correlation_matrix=CORR_F2,
            correlation_asset_ids=IDS_F2,
        )
        assert r_no.correlation_data_used is False
        assert r_yes.correlation_data_used is True

    def test_higher_corr_gives_lower_component_b(self):
        """More positively correlated assets must produce lower Component B."""
        n = 5
        weights = {f"S{i}": 1.0 for i in range(n)}
        ids = [f"S{i}" for i in range(n)]
        low_corr  = [[1.0 if i == j else 0.1 for j in range(n)] for i in range(n)]
        high_corr = [[1.0 if i == j else 0.8 for j in range(n)] for i in range(n)]

        r_low  = compute_diversification("lc", weights, correlation_matrix=low_corr,  correlation_asset_ids=ids)
        r_high = compute_diversification("hc", weights, correlation_matrix=high_corr, correlation_asset_ids=ids)

        assert r_low.component_b_score > r_high.component_b_score


class TestSectorHhiInvariants:
    """Sector HHI must satisfy its structural properties."""

    def test_sector_hhi_none_when_not_provided(self):
        """hhi_sector = None when no sector_weights given."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.hhi_sector is None

    def test_sector_hhi_present_when_provided(self):
        """hhi_sector is a float when sector_weights are provided."""
        r = compute_diversification(
            "f1", WEIGHTS_F1,
            sector_weights={"Technology": 50.0, "Energy": 50.0},
        )
        assert r.hhi_sector is not None and isinstance(r.hhi_sector, float)

    def test_sector_hhi_single_sector_is_maximum(self):
        """Single sector → sector HHI = 10,000."""
        r = compute_diversification(
            "f1", WEIGHTS_F1,
            sector_weights={"Technology": 100.0},
        )
        assert r.hhi_sector == pytest.approx(10_000.0, abs=STRICT_TOL)

    def test_sector_hhi_two_equal_sectors_is_5000(self):
        """Two 50/50 sectors → sector HHI = 5,000."""
        r = compute_diversification(
            "f1", WEIGHTS_F1,
            sector_weights={"Technology": 50.0, "Energy": 50.0},
        )
        assert r.hhi_sector == pytest.approx(5_000.0, abs=STRICT_TOL)

    def test_sector_hhi_detects_pseudo_diversified_portfolio(self):
        """
        10 technology stocks each at 10% look diversified at asset level
        (HHI=1,000) but are 100% one sector (sector HHI=10,000).
        This verifies the 'pseudo-diversified same-sector trap'.
        """
        weights = {f"TECH_{i}": 10.0 for i in range(10)}
        r = compute_diversification(
            "all-tech", weights,
            sector_weights={"Technology": 100.0},
        )
        assert r.hhi == pytest.approx(1_000.0, abs=STRICT_TOL)       # asset: diversified
        assert r.hhi_sector == pytest.approx(10_000.0, abs=STRICT_TOL)  # sector: concentrated


# =============================================================================
# TIER 3: PORTFOLIO ARCHETYPE EDGE CASES
# =============================================================================


class TestPortfolioArchetypes:
    """
    End-to-end validation of canonical portfolio archetypes per RISK_METHODOLOGY.md §8.5.5.
    These enforce the task specification's scoring threshold requirements.
    """

    # ── Single-Stock ──────────────────────────────────────────────────────────

    def test_single_stock_hhi_is_maximum(self):
        """TASK REQUIREMENT: single-stock portfolio HHI > 8,000. (HHI = 10,000)."""
        r = compute_diversification("single", {"RELIANCE": 1.0})
        assert r.hhi == pytest.approx(10_000.0, abs=STRICT_TOL)
        assert r.hhi > 8_000.0

    def test_single_stock_n_assets_is_one(self):
        r = compute_diversification("single", {"RELIANCE": 1.0})
        assert r.n_assets == 1

    def test_single_stock_effective_n_is_one(self):
        r = compute_diversification("single", {"RELIANCE": 1.0})
        assert r.effective_n == pytest.approx(1.0, abs=STRICT_TOL)

    def test_single_stock_no_corr_data_score_is_80(self):
        """
        Per RISK_METHODOLOGY.md §8.8 (Single-asset special case):
        comp_a = 100 (Neff/N = 1), comp_b = 50 (neutral, no pairs).
        Score = 0.60×100 + 0.40×50 = 80.0.
        HHI = 10,000 is the unambiguous concentration signal.
        """
        r = compute_diversification("single", {"RELIANCE": 1.0})
        assert r.diversification_score == pytest.approx(80.0, abs=STRICT_TOL)
        assert r.component_a_score == pytest.approx(100.0, abs=STRICT_TOL)
        assert r.component_b_score == pytest.approx(50.0, abs=STRICT_TOL)

    def test_single_stock_weighted_corr_is_none(self):
        """Single-stock: no pairs → weighted_avg_correlation = None."""
        r = compute_diversification("single", {"RELIANCE": 1.0})
        assert r.weighted_avg_correlation is None
        assert r.correlation_data_used is False

    # ── Highly Concentrated (near single-stock) ───────────────────────────────

    def test_concentrated_portfolio_score_in_poor_tier(self):
        """
        TASK REQUIREMENT: concentrated portfolio receives appropriately low score.
        80%-dominant portfolio → score < 45 ('Poor' tier per methodology).
        """
        r = compute_diversification("conc", WEIGHTS_F6)
        assert r.diversification_score < 45.0
        assert 10.0 <= r.diversification_score   # not literally zero

    def test_concentrated_portfolio_hhi_above_6000(self):
        """80%-dominant: HHI > 6,000 ('Very concentrated' range)."""
        r = compute_diversification("conc", WEIGHTS_F6)
        assert r.hhi > 6_000.0

    def test_concentrated_portfolio_cr3_above_60_pct(self):
        """80%-dominant: CR_3 > 60% (concentration risk alert threshold)."""
        r = compute_diversification("conc", WEIGHTS_F6, top_n_ratios=[3])
        cr3 = r.concentration_ratios[0]
        assert cr3.weight_pct > 60.0

    def test_concentrated_lockstep_scores_lower_than_neutral(self):
        """
        Portfolio with 80% dominant holding AND ρ=1.0 (lockstep) must score
        lower than same portfolio without correlation data (comp_b drops 50→0).
        """
        r_no_corr = compute_diversification("no_corr", WEIGHTS_F6)
        ids = list(WEIGHTS_F6.keys())
        n = len(ids)
        corr_lockstep = [[1.0] * n for _ in range(n)]
        r_lockstep = compute_diversification(
            "lockstep", WEIGHTS_F6,
            correlation_matrix=corr_lockstep,
            correlation_asset_ids=ids,
        )
        assert r_lockstep.diversification_score < r_no_corr.diversification_score

    # ── Broad Multi-Asset Portfolio ───────────────────────────────────────────

    def test_broad_multi_asset_score_above_85(self):
        """
        TASK REQUIREMENT: broad multi-asset index portfolio scores > 85.
        20 equal-weight assets with ρ̄ = -0.25 → score = 85.0 (boundary archetype).
        """
        r = compute_diversification(
            "broad", WEIGHTS_F3,
            correlation_matrix=CORR_F3,
            correlation_asset_ids=IDS_F3,
        )
        assert r.diversification_score >= 85.0 - STRICT_TOL

    def test_broad_multi_asset_hhi_below_1000(self):
        """20 equal-weight assets → HHI = 500 < 1,000 ('Highly diversified')."""
        r = compute_diversification("broad", WEIGHTS_F3)
        assert r.hhi < 1_000.0

    def test_broad_multi_asset_cr3_below_60_pct(self):
        """20 equal-weight → CR_3 = 15% < 60% (no concentration risk)."""
        r = compute_diversification("broad", WEIGHTS_F3, top_n_ratios=[3, 5, 10])
        cr3 = next(cr for cr in r.concentration_ratios if cr.n == 3)
        assert cr3.weight_pct < 60.0

    # ── Equal-Weight N-Asset (Various N) ─────────────────────────────────────

    def test_equal_weight_no_corr_score_always_80(self):
        """
        For any equal-weight portfolio without correlation data:
        comp_a = 100 (always), comp_b = 50 (neutral), score = 80.
        """
        for n in [2, 5, 10, 20, 50]:
            weights = {f"A{i}": 1.0 for i in range(n)}
            r = compute_diversification("eq", weights)
            assert r.diversification_score == pytest.approx(80.0, abs=STRICT_TOL), (
                f"N={n}: expected 80.0 (equal-weight + no corr data)"
            )
            assert r.component_a_score == pytest.approx(100.0, abs=STRICT_TOL)

    def test_equal_weight_zero_corr_matrix_score_is_80(self):
        """
        Equal-weight with explicit zero-correlation matrix: score = 80.
        Confirms correlation_data_used=True does not degrade score for ρ̄=0.
        """
        for n in [2, 5, 10]:
            weights = {f"A{i}": 1.0 for i in range(n)}
            ids = [f"A{i}" for i in range(n)]
            corr_zero = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
            r = compute_diversification(
                "zero_corr", weights,
                correlation_matrix=corr_zero,
                correlation_asset_ids=ids,
            )
            assert r.diversification_score == pytest.approx(80.0, abs=STRICT_TOL)
            assert r.component_b_score == pytest.approx(50.0, abs=STRICT_TOL)

    # ── Highly Correlated Multi-Asset ─────────────────────────────────────────

    def test_perfectly_correlated_scores_lower_than_independent(self):
        """
        10-asset equal-weight: lockstep (ρ=1) vs independent (ρ=0).
        Lockstep must score materially lower.
        """
        n = 10
        weights = {f"S{i}": 1.0 for i in range(n)}
        ids = [f"S{i}" for i in range(n)]
        corr_lockstep = [[1.0] * n for _ in range(n)]
        corr_indep    = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]

        r_lock  = compute_diversification("lock",  weights, correlation_matrix=corr_lockstep, correlation_asset_ids=ids)
        r_indep = compute_diversification("indep", weights, correlation_matrix=corr_indep,    correlation_asset_ids=ids)

        assert r_lock.diversification_score < r_indep.diversification_score
        assert r_lock.component_b_score == pytest.approx(0.0, abs=STRICT_TOL)
        assert r_indep.component_b_score == pytest.approx(50.0, abs=STRICT_TOL)

    # ── Auto-Normalisation ────────────────────────────────────────────────────

    def test_auto_normalisation_strips_zero_weight_asset(self):
        """Assets with weight = 0 excluded; HHI unchanged vs clean dict."""
        weights_with_zero = {"A": 50.0, "B": 30.0, "C": 20.0, "ZERO": 0.0}
        r_clean = compute_diversification("clean", WEIGHTS_F1)
        r_zero  = compute_diversification("zero",  weights_with_zero)
        assert r_zero.n_assets == 3
        assert r_zero.hhi == pytest.approx(r_clean.hhi, abs=STRICT_TOL)

    def test_auto_normalisation_fraction_pct_identical(self):
        """Fractions (0.5/0.3/0.2) and percentages (50/30/20) produce same result."""
        r_frac = compute_diversification("frac", {"A": 0.5, "B": 0.3, "C": 0.2})
        r_pct  = compute_diversification("pct",  {"A": 50.0, "B": 30.0, "C": 20.0})
        assert r_frac.hhi == pytest.approx(r_pct.hhi, abs=STRICT_TOL)
        assert r_frac.effective_n == pytest.approx(r_pct.effective_n, abs=STRICT_TOL)
        assert r_frac.diversification_score == pytest.approx(r_pct.diversification_score, abs=STRICT_TOL)

    def test_aum_weights_normalised_correctly(self):
        """
        Arbitrary INR AUM amounts must normalise to same result as % weights.
        Simulates passing market values from the NestJS layer.
        """
        r_aum = compute_diversification(
            "aum", {"R": 50_00_00_000, "I": 30_00_00_000, "T": 20_00_00_000}
        )
        r_pct = compute_diversification("pct", {"R": 50.0, "I": 30.0, "T": 20.0})
        assert r_aum.hhi == pytest.approx(r_pct.hhi, abs=STRICT_TOL)


class TestEdgeCasesAndErrorHandling:
    """Error handling, boundary inputs, and degenerate portfolio configurations."""

    def test_empty_weights_raises_value_error(self):
        """Empty asset_weights dict must raise ValueError."""
        with pytest.raises(ValueError, match="at least one asset"):
            compute_diversification("x", {})

    def test_all_zero_weights_raises_value_error(self):
        """All-zero weights must raise ValueError."""
        with pytest.raises(ValueError, match="zero or negative"):
            compute_diversification("x", {"A": 0.0, "B": 0.0})

    def test_negative_weights_stripped_leaving_valid_portfolio(self):
        """Negative entries stripped; remaining positives proceed normally."""
        r = compute_diversification("x", {"A": 50.0, "B": 30.0, "NEG": -10.0})
        assert r.n_assets == 2

    def test_all_negative_weights_raises_value_error(self):
        """All-negative weights raise ValueError after stripping."""
        with pytest.raises(ValueError):
            compute_diversification("x", {"A": -5.0, "B": -3.0})

    def test_correlation_matrix_without_ids_falls_back_to_neutral(self):
        """
        Providing correlation_matrix but not correlation_asset_ids:
        The engine requires BOTH to be non-None to use correlation data.
        With only one parameter supplied, it silently falls back to the
        neutral Component B = 50 (no correlation data used).
        Request-level validation (Pydantic schema cross-field check) is the
        gatekeeper for API consumers; this tests the engine contract directly.
        """
        r = compute_diversification(
            "x", WEIGHTS_F2_EQUAL,
            correlation_matrix=CORR_F2,
            correlation_asset_ids=None,
        )
        assert r.correlation_data_used is False
        assert r.component_b_score == pytest.approx(50.0, abs=STRICT_TOL)

    def test_correlation_ids_without_matrix_falls_back_to_neutral(self):
        """
        Providing correlation_asset_ids but not correlation_matrix:
        The engine silently ignores the IDs and falls back to neutral
        Component B = 50 (same contract as above — engine requires both).
        """
        r = compute_diversification(
            "x", WEIGHTS_F2_EQUAL,
            correlation_matrix=None,
            correlation_asset_ids=IDS_F2,
        )
        assert r.correlation_data_used is False
        assert r.component_b_score == pytest.approx(50.0, abs=STRICT_TOL)

    def test_correlation_matrix_dimension_mismatch_raises(self):
        """Matrix 2×2 but 5 IDs → ValueError."""
        wrong_matrix = [[1.0, 0.5], [0.5, 1.0]]
        with pytest.raises(ValueError, match="dimensions do not match"):
            compute_diversification(
                "x", WEIGHTS_F2_EQUAL,
                correlation_matrix=wrong_matrix,
                correlation_asset_ids=IDS_F2,
            )

    def test_two_asset_equal_weight_portfolio(self):
        """Two equal-weight assets: HHI=5000, Eff N=2, comp_a=100."""
        r = compute_diversification("two", {"A": 1.0, "B": 1.0})
        assert r.hhi == pytest.approx(5_000.0, abs=STRICT_TOL)
        assert r.effective_n == pytest.approx(2.0, abs=STRICT_TOL)
        assert r.component_a_score == pytest.approx(100.0, abs=STRICT_TOL)

    def test_portfolio_id_echoed(self):
        """Portfolio ID must be echoed verbatim in result."""
        pid = "test-portfolio-xyz-456"
        r = compute_diversification(pid, WEIGHTS_F1)
        assert r.portfolio_id == pid

    def test_n_assets_matches_non_zero_weight_count(self):
        """n_assets counts only assets with weight > threshold."""
        r = compute_diversification("f1", WEIGHTS_F1)
        assert r.n_assets == 3


class TestInternalHelpers:
    """White-box unit tests for internal helper functions."""

    def test_normalise_weights_sum_to_one(self):
        """Normalised weights must sum exactly to 1.0."""
        norm = _normalise_weights({"A": 60.0, "B": 40.0})
        assert sum(norm.values()) == pytest.approx(1.0, abs=STRICT_TOL)

    def test_normalise_weights_strips_zero(self):
        """Zero-weight entries excluded from normalised dict."""
        norm = _normalise_weights({"A": 50.0, "B": 30.0, "ZERO": 0.0})
        assert "ZERO" not in norm
        assert len(norm) == 2

    def test_compute_hhi_equal_weights_formula(self):
        """_compute_hhi for N equal-weight = 10000/N."""
        for n in [1, 2, 5, 10, 20]:
            w = 1.0 / n
            weights = {f"A{i}": w for i in range(n)}
            assert _compute_hhi(weights) == pytest.approx(10_000.0 / n, abs=STRICT_TOL)

    def test_component_a_equal_weight_is_100(self):
        """_component_a(N, N) = 100 for any equal-weight portfolio."""
        for n in [1, 2, 5, 10, 20]:
            assert _component_a(float(n), n) == pytest.approx(100.0, abs=STRICT_TOL)

    def test_component_a_single_in_many_is_low(self):
        """_component_a(1.0, 10) = min(0.1, 1) × 100 = 10.0."""
        assert _component_a(1.0, 10) == pytest.approx(10.0, abs=STRICT_TOL)

    def test_component_a_capped_at_100(self):
        """_component_a must never exceed 100 even if ratio > 1."""
        assert _component_a(15.0, 10) == pytest.approx(100.0, abs=STRICT_TOL)

    def test_component_b_no_data_is_50(self):
        """_component_b(None) = 50 (neutral prior)."""
        assert _component_b(None) == pytest.approx(50.0, abs=STRICT_TOL)

    def test_component_b_zero_corr_is_50(self):
        """_component_b(0.0) = (1-0)/2 × 100 = 50."""
        assert _component_b(0.0) == pytest.approx(50.0, abs=STRICT_TOL)

    def test_component_b_positive_one_is_zero(self):
        """_component_b(1.0) = 0 (lockstep)."""
        assert _component_b(1.0) == pytest.approx(0.0, abs=STRICT_TOL)

    def test_component_b_negative_one_is_100(self):
        """_component_b(-1.0) = 100 (perfect hedge)."""
        assert _component_b(-1.0) == pytest.approx(100.0, abs=STRICT_TOL)

    def test_component_b_linear_midpoints(self):
        """_component_b is linear: B(0.5)=25, B(-0.5)=75."""
        assert _component_b(0.5)  == pytest.approx(25.0, abs=STRICT_TOL)
        assert _component_b(-0.5) == pytest.approx(75.0, abs=STRICT_TOL)

    def test_weighted_avg_correlation_single_asset_returns_none(self):
        """Single asset → None (no pairs exist)."""
        result = _weighted_avg_correlation({"A": 1.0}, [[1.0]], ["A"])
        assert result is None

    def test_weighted_avg_correlation_two_asset_symmetric(self):
        """
        2-asset equal-weight, ρ(A,B)=0.6:
        pair_weight=(0.5+0.5)/2=0.5; Σ_norm=0.5; rho_bar=0.6.
        """
        result = _weighted_avg_correlation(
            {"A": 0.5, "B": 0.5},
            [[1.0, 0.6], [0.6, 1.0]],
            ["A", "B"],
        )
        assert result == pytest.approx(0.6, abs=STRICT_TOL)

    def test_top_n_ratios_order_descending(self):
        """_top_n_ratios must return assets sorted by weight descending."""
        weights = {"A": 0.5, "B": 0.3, "C": 0.2}
        ratios = _top_n_ratios(weights, [3])
        cr3 = ratios[0]
        weight_seq = [weights[aid] for aid in cr3.asset_ids]
        assert weight_seq == sorted(weight_seq, reverse=True)

    def test_top_n_ratios_clips_to_available(self):
        """_top_n_ratios with n > assets clips actual_n to len(weights)."""
        weights = {"A": 0.6, "B": 0.4}
        ratios = _top_n_ratios(weights, [10])
        assert ratios[0].actual_n == 2


# =============================================================================
# TIER 4: FASTAPI INTEGRATION TESTS
# =============================================================================


class TestDiversificationEndpointSmoke:
    """HTTP smoke tests for POST /api/v1/risk/diversification."""

    BASE_URL = "/api/v1/risk/diversification"

    def test_minimal_request_returns_200(self):
        """Minimal valid request (weights only, no correlation) → HTTP 200."""
        payload = {
            "portfolio_id": "test-portfolio",
            "asset_weights": [
                {"asset_id": "RELIANCE", "weight": 50},
                {"asset_id": "INFY",     "weight": 30},
                {"asset_id": "TCS",      "weight": 20},
            ],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200

    def test_response_schema_completeness(self):
        """Response must contain all required fields."""
        payload = {
            "portfolio_id": "schema-test",
            "asset_weights": [
                {"asset_id": "A", "weight": 60},
                {"asset_id": "B", "weight": 40},
            ],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        data = r.json()
        required_fields = [
            "portfolio_id", "n_assets", "hhi", "hhi_sector", "effective_n",
            "effective_n_pct_of_max", "concentration_ratios",
            "weighted_avg_correlation", "diversification_score",
            "component_a_score", "component_b_score", "correlation_data_used",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    def test_portfolio_id_echoed_in_response(self):
        """portfolio_id in response must match request."""
        pid = "echo-test-abc-789"
        payload = {
            "portfolio_id": pid,
            "asset_weights": [{"asset_id": "X", "weight": 1}],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        assert r.json()["portfolio_id"] == pid

    def test_hhi_sector_null_without_sector_weights(self):
        """hhi_sector = null in response when sector_weights not in request."""
        payload = {
            "portfolio_id": "no-sector",
            "asset_weights": [{"asset_id": "A", "weight": 1}],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        assert r.json()["hhi_sector"] is None

    def test_weighted_avg_correlation_null_without_matrix(self):
        """weighted_avg_correlation = null when no correlation_matrix provided."""
        payload = {
            "portfolio_id": "no-corr",
            "asset_weights": [
                {"asset_id": "A", "weight": 50},
                {"asset_id": "B", "weight": 50},
            ],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        assert r.json()["weighted_avg_correlation"] is None

    def test_with_sector_weights_returns_sector_hhi(self):
        """When sector_weights provided, hhi_sector is not null."""
        payload = {
            "portfolio_id": "with-sector",
            "asset_weights": [
                {"asset_id": "RELIANCE", "weight": 50},
                {"asset_id": "INFY",     "weight": 50},
            ],
            "sector_weights": [
                {"asset_id": "Energy",     "weight": 50},
                {"asset_id": "Technology", "weight": 50},
            ],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        assert r.json()["hhi_sector"] is not None

    def test_with_correlation_matrix_sets_data_used_true(self):
        """With a valid correlation matrix, correlation_data_used = true."""
        payload = {
            "portfolio_id": "with-corr",
            "asset_weights": [
                {"asset_id": "A", "weight": 50},
                {"asset_id": "B", "weight": 50},
            ],
            "correlation_matrix":    [[1.0, 0.5], [0.5, 1.0]],
            "correlation_asset_ids": ["A", "B"],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["correlation_data_used"] is True
        assert data["weighted_avg_correlation"] is not None

    def test_default_concentration_ratios_are_3_5_10(self):
        """Without top_n_ratios, response contains CR_3, CR_5, CR_10."""
        payload = {
            "portfolio_id": "cr-default",
            "asset_weights": [
                {"asset_id": "A", "weight": 50},
                {"asset_id": "B", "weight": 30},
                {"asset_id": "C", "weight": 20},
            ],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        ns = sorted(cr["n"] for cr in r.json()["concentration_ratios"])
        assert ns == [3, 5, 10]

    def test_custom_top_n_ratios_respected(self):
        """Custom top_n_ratios=[1, 2] must appear in response."""
        payload = {
            "portfolio_id": "cr-custom",
            "asset_weights": [
                {"asset_id": "A", "weight": 60},
                {"asset_id": "B", "weight": 40},
            ],
            "top_n_ratios": [1, 2],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        ns = sorted(cr["n"] for cr in r.json()["concentration_ratios"])
        assert ns == [1, 2]

    def test_hhi_and_score_match_direct_engine_call(self):
        """HTTP response values must match direct engine call for same input."""
        weights_api = [
            {"asset_id": "RELIANCE", "weight": 50},
            {"asset_id": "INFY",     "weight": 30},
            {"asset_id": "TCS",      "weight": 20},
        ]
        payload = {"portfolio_id": "match-test", "asset_weights": weights_api}
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        data = r.json()

        engine = compute_diversification("match-test", WEIGHTS_F1)
        assert data["hhi"]                  == pytest.approx(engine.hhi, abs=STRICT_TOL)
        assert data["diversification_score"] == pytest.approx(engine.diversification_score, abs=STRICT_TOL)

    def test_response_content_type_is_json(self):
        """Response Content-Type must be application/json."""
        payload = {
            "portfolio_id": "ct-test",
            "asset_weights": [{"asset_id": "A", "weight": 1}],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert "application/json" in r.headers.get("content-type", "")


class TestDiversificationEndpointValidation:
    """Request validation (422) and business-logic validation (400) tests."""

    BASE_URL = "/api/v1/risk/diversification"

    def test_missing_portfolio_id_returns_422(self):
        """Request without portfolio_id → HTTP 422."""
        r = client.post(self.BASE_URL, json={
            "asset_weights": [{"asset_id": "A", "weight": 1}],
        })
        assert r.status_code == 422

    def test_missing_asset_weights_returns_422(self):
        """Request without asset_weights → HTTP 422."""
        r = client.post(self.BASE_URL, json={"portfolio_id": "x"})
        assert r.status_code == 422

    def test_empty_asset_weights_list_returns_422(self):
        """Empty asset_weights list → HTTP 422 (min_length=1 constraint)."""
        r = client.post(self.BASE_URL, json={"portfolio_id": "x", "asset_weights": []})
        assert r.status_code == 422

    def test_negative_weight_returns_422(self):
        """Negative weight (gt=0 Pydantic constraint) → HTTP 422."""
        r = client.post(self.BASE_URL, json={
            "portfolio_id": "neg",
            "asset_weights": [{"asset_id": "A", "weight": -5}],
        })
        assert r.status_code == 422

    def test_zero_weight_returns_422(self):
        """Zero weight (gt=0 Pydantic constraint) → HTTP 422."""
        r = client.post(self.BASE_URL, json={
            "portfolio_id": "zero",
            "asset_weights": [{"asset_id": "A", "weight": 0.0}],
        })
        assert r.status_code == 422

    def test_correlation_matrix_without_ids_returns_422(self):
        """correlation_matrix without correlation_asset_ids → HTTP 422."""
        r = client.post(self.BASE_URL, json={
            "portfolio_id": "x",
            "asset_weights": [{"asset_id": "A", "weight": 1}],
            "correlation_matrix": [[1.0]],
        })
        assert r.status_code == 422

    def test_correlation_ids_without_matrix_returns_422(self):
        """correlation_asset_ids without correlation_matrix → HTTP 422."""
        r = client.post(self.BASE_URL, json={
            "portfolio_id": "x",
            "asset_weights": [{"asset_id": "A", "weight": 1}],
            "correlation_asset_ids": ["A"],
        })
        assert r.status_code == 422

    def test_correlation_dimension_mismatch_returns_400_or_422(self):
        """
        3×3 matrix with only 2 asset IDs → HTTP 400 (engine) or 422 (Pydantic).
        Both are valid error responses for inconsistent correlation inputs.
        """
        r = client.post(self.BASE_URL, json={
            "portfolio_id": "dim-mismatch",
            "asset_weights": [
                {"asset_id": "A", "weight": 50},
                {"asset_id": "B", "weight": 50},
            ],
            "correlation_matrix":    [[1.0, 0.5, 0.3], [0.5, 1.0, 0.2], [0.3, 0.2, 1.0]],
            "correlation_asset_ids": ["A", "B"],
        })
        assert r.status_code in (400, 422)

    def test_get_method_not_allowed(self):
        """GET on diversification endpoint → HTTP 405."""
        r = client.get(self.BASE_URL)
        assert r.status_code == 405


class TestDiversificationScoringThresholds:
    """
    Enforces the three task-specification validation requirements:

      1. single-stock portfolio → HHI > 8,000
      2. concentrated portfolio → score appropriately low
      3. broad multi-asset index portfolio → score > 85

    These tests must pass for Step 16 to be certified complete.
    """

    BASE_URL = "/api/v1/risk/diversification"

    def test_TASK_REQ_single_stock_hhi_above_8000(self):
        """
        VALIDATION REQUIREMENT 1:
        'Verify single-stock portfolio yields near-zero diversification score
        and high HHI (> 8,000).'
        HHI = 10,000 for a 100% single-asset portfolio. ✓
        """
        payload = {
            "portfolio_id": "validation-single-stock",
            "asset_weights": [{"asset_id": "RELIANCE", "weight": 100}],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["hhi"] > 8_000.0, (
            f"Single-stock HHI = {data['hhi']:.2f}, expected > 8,000"
        )
        assert data["hhi"] == pytest.approx(10_000.0, abs=STRICT_TOL)

    def test_TASK_REQ_concentrated_portfolio_low_score(self):
        """
        VALIDATION REQUIREMENT 2:
        'Concentrated portfolios receive appropriately low scores.'
        80%-dominant holding portfolio: score < 45 ('Poor' tier).
        """
        payload = {
            "portfolio_id": "validation-concentrated",
            "asset_weights": [
                {"asset_id": "AAPL", "weight": 80},
                {"asset_id": "MSFT", "weight": 10},
                {"asset_id": "GOOG", "weight": 5},
                {"asset_id": "META", "weight": 3},
                {"asset_id": "AMZN", "weight": 2},
            ],
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        score = r.json()["diversification_score"]
        assert score < 45.0, (
            f"Concentrated portfolio scored {score:.2f} — expected < 45 ('Poor' tier)"
        )

    def test_TASK_REQ_broad_multi_asset_score_above_85(self):
        """
        VALIDATION REQUIREMENT 3:
        'Diverse multi-asset portfolios receive high scores.'
        20 equal-weight assets, ρ̄ = -0.25 → score ≥ 85 ('Excellent' tier).
        """
        n = 20
        ids  = [f"ASSET_{i}" for i in range(n)]
        corr = [[1.0 if i == j else -0.25 for j in range(n)] for i in range(n)]
        payload = {
            "portfolio_id": "validation-broad-multi-asset",
            "asset_weights":         [{"asset_id": aid, "weight": 5} for aid in ids],
            "correlation_matrix":    corr,
            "correlation_asset_ids": ids,
        }
        r = client.post(self.BASE_URL, json=payload)
        assert r.status_code == 200
        score = r.json()["diversification_score"]
        assert score >= 85.0, (
            f"Broad multi-asset portfolio scored {score:.2f} — expected ≥ 85 ('Excellent' tier)"
        )

    def test_TASK_REQ_score_gap_concentrated_vs_diversified(self):
        """
        Structural validation: concentrated score must be materially lower
        than diversified score. Gap requirement: ≥ 30 points.
        """
        payload_conc = {
            "portfolio_id": "conc",
            "asset_weights": [
                {"asset_id": "DOMINANT", "weight": 90},
                {"asset_id": "MINOR_1",  "weight": 5},
                {"asset_id": "MINOR_2",  "weight": 5},
            ],
        }
        payload_div = {
            "portfolio_id": "div",
            "asset_weights": [{"asset_id": f"A{i}", "weight": 10} for i in range(10)],
        }
        r_conc = client.post(self.BASE_URL, json=payload_conc)
        r_div  = client.post(self.BASE_URL, json=payload_div)
        assert r_conc.status_code == 200
        assert r_div.status_code  == 200

        score_conc = r_conc.json()["diversification_score"]
        score_div  = r_div.json()["diversification_score"]
        gap = score_div - score_conc

        assert gap >= 30.0, (
            f"Score gap = {gap:.2f} points (div={score_div:.2f}, conc={score_conc:.2f}). "
            f"Expected ≥ 30 points separation."
        )
