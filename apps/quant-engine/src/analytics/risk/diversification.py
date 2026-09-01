"""
Diversification & Concentration Analytics Engine
=================================================

Pure-math module for computing portfolio diversification and concentration metrics
from asset weights and optionally an inter-asset correlation matrix.

Three complementary measures are computed:

1. Herfindahl-Hirschman Index (HHI)
   ─────────────────────────────────
   A classical concentration measure adopted from industrial economics.
   For N assets with weight w_i (w_i ≥ 0, Σw_i = 1):

       HHI = Σ (w_i × 100)²          [scaled to 10,000-point range]

   Range interpretation:
     HHI > 8,000  → Highly concentrated / monopolistic
     2,500–8,000  → Moderate concentration
     < 2,500      → Competitive / diversified

   Effective N (equivalent equal-weight portfolio size):
       Effective_N = 10,000 / HHI

2. Top-N Concentration Ratios
   ───────────────────────────
   The fraction of the portfolio held by the largest N positions:

       CR_N = Σ_{top-N} w_i × 100    [as a percentage]

   Thresholds:
     CR_3  > 60%  → Very concentrated (3-stock risk)
     CR_5  > 70%  → Significant single-factor risk
     CR_10 > 80%  → Insufficient breadth for institutional mandates

3. Diversification Score (0–100)
   ───────────────────────────────
   A composite score that blends two independent signals:

   Component A — Effective-N Score (weight: 0.60)
   ───────────────────────────────────────────────
   Rewards portfolios whose weight distribution is spread across many
   positions, penalising high-HHI concentration:

       eff_n_raw   = 10,000 / HHI              (= 1 / Σw_i²)
       eff_n_score = min(eff_n_raw / N, 1.0)   (caps at 1.0 for equal-weight)
       component_a = eff_n_score × 100          [0–100]

   Where N is the total number of assets in the portfolio.

   Component B — Correlation Penalty Score (weight: 0.40)
   ───────────────────────────────────────────────────────
   Captures pairwise linear co-movement of returns.

   Let rho_{i,j} be the Pearson correlation between assets i and j.
   The weight-averaged pairwise correlation across all M = N(N-1)/2 pairs:

       w_bar_{i,j} = (w_i + w_j) / 2
       Sigma_norm  = Σ_{i<j} w_bar_{i,j}
       rho_bar     = Σ_{i<j} [w_bar_{i,j} × rho_{i,j}] / Sigma_norm

   Maps to 0–100 score:
       component_b = (1 − rho_bar) / 2 × 100

   Defaults to 50 (neutral) when correlation data is unavailable.

   Final Score:
       diversification_score = 0.60 × component_a + 0.40 × component_b

References
──────────
    Herfindahl, O.C. (1950). Concentration in the U.S. Steel Industry (PhD thesis).
    Hirschman, A.O. (1964). The Paternity of an Index. American Economic Review, 54(5).
    Markowitz, H.M. (1952). Portfolio Selection. Journal of Finance, 7(1), 77-91.
    Meucci, A. (2009). Managing Diversification. Risk Magazine, 22(5), 74-79.
    PRD US-RISK-02 — Diversification & Concentration Analytics.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ── Scoring coefficients ───────────────────────────────────────────────────────

#: Weight of the Effective-N concentration component in the final score.
_WEIGHT_CONCENTRATION: float = 0.60

#: Weight of the correlation penalty component in the final score.
_WEIGHT_CORRELATION: float = 0.40

# Sanity guard — must sum to 1.0
assert math.isclose(_WEIGHT_CONCENTRATION + _WEIGHT_CORRELATION, 1.0), (
    "Scoring weights must sum to 1.0"
)

#: HHI scale factor — weights expressed in percentage points before squaring,
#: so maximum HHI = 100^2 = 10,000 (single-asset portfolio).
_HHI_SCALE: float = 10_000.0

#: Minimum valid weight fraction; positions at or below this threshold are
#: treated as zero-weight and excluded from calculations.
_MIN_WEIGHT_THRESHOLD: float = 1e-9

# ── Result types ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ConcentrationRatio:
    """
    Single Top-N concentration ratio result.

    Attributes
    ----------
    n          : The top-N cut-off (e.g. 3, 5, 10).
    asset_ids  : Identifiers of the top-N assets, sorted by weight descending.
    weight_pct : Combined weight of top-N assets as a percentage (0–100).
    actual_n   : Actual count included (may be < n for small portfolios).
    """

    n: int
    asset_ids: list[str]
    weight_pct: float
    actual_n: int


@dataclass(frozen=True)
class DiversificationResult:
    """
    Comprehensive diversification and concentration analytics output.

    Attributes
    ----------
    portfolio_id            : Identifier echoed from the request.
    n_assets                : Total number of assets in the portfolio.

    hhi                     : Asset-level HHI on the 0–10,000 scale.
    hhi_sector              : Sector-level HHI (None if not provided).
    effective_n             : Equivalent equal-weight portfolio size = 10,000 / HHI.
    effective_n_pct_of_max  : effective_n as a % of n_assets (0–100).

    concentration_ratios    : ConcentrationRatio records for each requested N.

    weighted_avg_correlation : Weight-averaged pairwise Pearson correlation.
                               None if correlation data was unavailable.

    diversification_score   : Composite 0–100 score.
    component_a_score       : Effective-N sub-score (0–100) before weighting.
    component_b_score       : Correlation penalty sub-score (0–100) before weighting.
    correlation_data_used   : True if actual correlation data was used for component_b.
    """

    portfolio_id: str
    n_assets: int

    # Concentration
    hhi: float
    hhi_sector: float | None
    effective_n: float
    effective_n_pct_of_max: float

    # Top-N ratios
    concentration_ratios: list[ConcentrationRatio] = field(default_factory=list)

    # Correlation
    weighted_avg_correlation: float | None = None

    # Composite score
    diversification_score: float = 0.0
    component_a_score: float = 0.0
    component_b_score: float = 0.0
    correlation_data_used: bool = False


# ── Internal helpers ───────────────────────────────────────────────────────────


def _normalise_weights(weights: dict[str, float]) -> dict[str, float]:
    """
    Validate and normalise asset weights to sum exactly to 1.0.

    Accepts fractions (0–1) or percentages (0–100). Zero/negative entries
    are stripped. The remaining positive weights are re-normalised.

    Raises
    ------
    ValueError
        If weights is empty, or all entries are zero/negative.
    """
    if not weights:
        raise ValueError("weights must contain at least one asset.")

    cleaned = {k: v for k, v in weights.items() if v > _MIN_WEIGHT_THRESHOLD}
    if not cleaned:
        raise ValueError("All asset weights are zero or negative.")

    total = sum(cleaned.values())
    if total < _MIN_WEIGHT_THRESHOLD:
        raise ValueError(
            "Total portfolio weight is effectively zero; cannot normalise."
        )

    return {k: v / total for k, v in cleaned.items()}


def _compute_hhi(weights_fraction: dict[str, float]) -> float:
    """
    Compute HHI on the 10,000-point scale.

    HHI = Σ (w_i × 100)²

    Parameters
    ----------
    weights_fraction : Fractional weights (sum = 1.0).
    """
    return sum((w * 100.0) ** 2 for w in weights_fraction.values())


def _top_n_ratios(
    weights_fraction: dict[str, float],
    ns: list[int],
) -> list[ConcentrationRatio]:
    """
    Compute Top-N concentration ratios for each requested cut-off.

    Assets are sorted by weight descending. If N exceeds available assets,
    actual_n reflects the actual count included.
    """
    sorted_assets = sorted(weights_fraction.items(), key=lambda x: x[1], reverse=True)
    n_available = len(sorted_assets)

    ratios: list[ConcentrationRatio] = []
    for n in ns:
        actual_n = min(n, n_available)
        top_slice = sorted_assets[:actual_n]
        combined_weight_pct = round(sum(w for _, w in top_slice) * 100.0, 4)
        ratios.append(
            ConcentrationRatio(
                n=n,
                asset_ids=[aid for aid, _ in top_slice],
                weight_pct=combined_weight_pct,
                actual_n=actual_n,
            )
        )
    return ratios


def _weighted_avg_correlation(
    weights_fraction: dict[str, float],
    correlation_matrix: list[list[float]],
    asset_ids: list[str],
) -> float | None:
    """
    Compute weight-averaged pairwise Pearson correlation across all asset pairs.

    For each distinct pair (i, j) with i < j:
        pair_weight  = (w_i + w_j) / 2
        contribution = pair_weight × rho_{i,j}

    Weighted average:
        rho_bar = Σ contribution / Σ pair_weight

    Returns None if fewer than 2 assets have non-trivial weights.
    """
    n = len(asset_ids)
    if n < 2:
        return None

    weight_lookup = {aid: weights_fraction.get(aid, 0.0) for aid in asset_ids}

    weighted_sum = 0.0
    weight_total = 0.0

    for i in range(n):
        for j in range(i + 1, n):
            aid_i = asset_ids[i]
            aid_j = asset_ids[j]
            w_i = weight_lookup[aid_i]
            w_j = weight_lookup[aid_j]

            if w_i < _MIN_WEIGHT_THRESHOLD and w_j < _MIN_WEIGHT_THRESHOLD:
                continue

            pair_weight = (w_i + w_j) / 2.0
            rho = correlation_matrix[i][j]
            weighted_sum += pair_weight * rho
            weight_total += pair_weight

    if weight_total < _MIN_WEIGHT_THRESHOLD:
        return None

    avg_rho = weighted_sum / weight_total
    return max(-1.0, min(1.0, avg_rho))


def _component_a(effective_n: float, n_assets: int) -> float:
    """
    Effective-N sub-score (0–100).

    Expresses how close effective_n is to the theoretical maximum (n_assets):
        score = min(effective_n / n_assets, 1.0) × 100
    """
    if n_assets <= 0:
        return 0.0
    ratio = effective_n / n_assets
    return min(ratio, 1.0) * 100.0


def _component_b(weighted_avg_corr: float | None) -> float:
    """
    Correlation penalty sub-score (0–100).

    Maps rho_bar in [-1, 1] to [100, 0]:
        score = (1 - rho_bar) / 2 × 100

    Defaults to 50 (neutral) when no correlation data is available.
    """
    if weighted_avg_corr is None:
        return 50.0
    return (1.0 - weighted_avg_corr) / 2.0 * 100.0


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_diversification(
    portfolio_id: str,
    asset_weights: dict[str, float],
    *,
    sector_weights: dict[str, float] | None = None,
    correlation_matrix: list[list[float]] | None = None,
    correlation_asset_ids: list[str] | None = None,
    top_n_ratios: list[int] | None = None,
) -> DiversificationResult:
    """
    Compute portfolio diversification and concentration metrics.

    Parameters
    ----------
    portfolio_id : str
        Portfolio identifier (echoed in output).

    asset_weights : dict[str, float]
        Mapping of asset_id to weight. Accepts fractions (0–1) or percentages
        (0–100). Auto-normalised to sum to 1.0. Zero/negative assets excluded.

    sector_weights : dict[str, float] | None
        Optional sector-label to aggregate weight mapping. If provided, a
        second HHI is computed at sector level (hhi_sector).

    correlation_matrix : list[list[float]] | None
        N×N Pearson correlation matrix. Must be provided with correlation_asset_ids.
        If omitted, component_b defaults to 50 (neutral / no-correlation assumption).

    correlation_asset_ids : list[str] | None
        Ordered asset IDs corresponding to matrix rows/columns. Must match
        the dimension of correlation_matrix.

    top_n_ratios : list[int] | None
        N values for Top-N concentration ratios. Defaults to [3, 5, 10].

    Returns
    -------
    DiversificationResult

    Raises
    ------
    ValueError
        If asset_weights is empty, all weights are zero, or correlation inputs
        are inconsistent.
    """
    if top_n_ratios is None:
        top_n_ratios = [3, 5, 10]

    # ── Step 1: Normalise weights ──────────────────────────────────────────────
    norm_weights = _normalise_weights(asset_weights)
    n_assets = len(norm_weights)

    # ── Step 2: Asset-level HHI and Effective N ────────────────────────────────
    hhi_raw = _compute_hhi(norm_weights)
    hhi = round(hhi_raw, 2)

    effective_n_raw = _HHI_SCALE / hhi_raw
    effective_n = round(effective_n_raw, 4)
    effective_n_pct_of_max = round(min(effective_n_raw / n_assets, 1.0) * 100.0, 4)

    # ── Step 3: Sector-level HHI (optional) ───────────────────────────────────
    hhi_sector: float | None = None
    if sector_weights is not None:
        norm_sector = _normalise_weights(sector_weights)
        hhi_sector = round(_compute_hhi(norm_sector), 2)

    # ── Step 4: Top-N concentration ratios ────────────────────────────────────
    cr_list = _top_n_ratios(norm_weights, sorted(set(top_n_ratios)))

    # ── Step 5: Weighted average pairwise correlation ─────────────────────────
    weighted_corr: float | None = None
    correlation_data_used = False

    if correlation_matrix is not None and correlation_asset_ids is not None:
        n_corr = len(correlation_asset_ids)
        if len(correlation_matrix) != n_corr or any(
            len(row) != n_corr for row in correlation_matrix
        ):
            raise ValueError(
                f"correlation_matrix dimensions do not match "
                f"correlation_asset_ids length ({n_corr})."
            )
        weighted_corr = _weighted_avg_correlation(
            norm_weights, correlation_matrix, correlation_asset_ids
        )
        correlation_data_used = weighted_corr is not None

    # ── Step 6: Component scores ───────────────────────────────────────────────
    comp_a = round(_component_a(effective_n_raw, n_assets), 4)
    comp_b = round(_component_b(weighted_corr), 4)

    # ── Step 7: Final composite score ─────────────────────────────────────────
    raw_score = _WEIGHT_CONCENTRATION * comp_a + _WEIGHT_CORRELATION * comp_b
    diversification_score = round(max(0.0, min(100.0, raw_score)), 4)

    result = DiversificationResult(
        portfolio_id=portfolio_id,
        n_assets=n_assets,
        hhi=hhi,
        hhi_sector=hhi_sector,
        effective_n=effective_n,
        effective_n_pct_of_max=effective_n_pct_of_max,
        concentration_ratios=cr_list,
        weighted_avg_correlation=(
            round(weighted_corr, 6) if weighted_corr is not None else None
        ),
        diversification_score=diversification_score,
        component_a_score=comp_a,
        component_b_score=comp_b,
        correlation_data_used=correlation_data_used,
    )

    logger.info(
        "Diversification computed: portfolio_id=%s n_assets=%d hhi=%.2f "
        "effective_n=%.4f score=%.4f (comp_a=%.4f comp_b=%.4f corr_used=%s)",
        portfolio_id,
        n_assets,
        hhi,
        effective_n,
        diversification_score,
        comp_a,
        comp_b,
        correlation_data_used,
    )
    return result
