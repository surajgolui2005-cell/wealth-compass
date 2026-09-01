"""
Pairwise Asset Correlation Matrix Calculator
=============================================

Pure-math module for computing the pairwise Pearson correlation matrix for a
set of assets from their aligned daily return time series.

Mathematical definition
-----------------------
For two assets i and j with N aligned daily returns:

    r̄_i  = Σr_{i,t} / N                           (mean return of asset i)
    r̄_j  = Σr_{j,t} / N                           (mean return of asset j)

    Cov(i,j)  = Σ[(r_{i,t} − r̄_i)(r_{j,t} − r̄_j)] / (N − 1)   [Bessel corrected]
    Var(i)    = Cov(i,i) = σ_i²
    Var(j)    = Cov(j,j) = σ_j²

    Pearson ρ_{i,j} = Cov(i,j) / (σ_i × σ_j)

The resulting matrix C is:
    - Symmetric:      C[i,j] = C[j,i]
    - Unit diagonal:  C[i,i] = 1.0    (asset is perfectly correlated with itself)
    - Bounded:        −1.0 ≤ C[i,j] ≤ 1.0

Interpretation
--------------
    ρ ≈ +1.0 : Perfect positive correlation (both assets move in the same direction).
    ρ ≈  0.0 : No linear relationship.
    ρ ≈ −1.0 : Perfect negative correlation (natural hedges, e.g. Gold vs Equity).

Portfolio diversification benefit:
    Low pairwise correlations reduce portfolio variance beyond individual asset risk.
    A correlation matrix with many near-zero or negative values indicates good
    diversification.

Special cases
-------------
- Zero-variance assets (constant return): correlation with other assets is undefined.
  The off-diagonal cells for such assets are set to 0.0 (not NaN) to prevent
  downstream serialisation issues; the diagonal remains 1.0.
- Single-asset portfolios: returns a 1×1 matrix [[1.0]].

References
----------
    Markowitz, H.M. (1952). Portfolio Selection. Journal of Finance, 7(1), 77-91.
    PRD US-RISK-01 — Portfolio Volatility & Risk Metrics.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ── Result type ────────────────────────────────────────────────────────────────


@dataclass
class CorrelationResult:
    """
    Pairwise Pearson correlation matrix output.

    Attributes
    ----------
    asset_ids     : Ordered list of asset identifiers (row/column labels).
    matrix        : N×N correlation matrix as a list of lists.
                    matrix[i][j] = Pearson ρ between asset_ids[i] and asset_ids[j].
    n_assets      : Number of assets included.
    n_observations: Number of aligned daily return observations per asset pair.
    """

    asset_ids: list[str]
    matrix: list[list[float]] = field(default_factory=list)
    n_assets: int = 0
    n_observations: int = 0


# ── Internal helpers ───────────────────────────────────────────────────────────


def _compute_stats(returns: list[float]) -> tuple[float, float]:
    """Compute (mean, sample_std) for a return series. std=0 if all identical."""
    n = len(returns)
    mean = sum(returns) / n
    var = sum((r - mean) ** 2 for r in returns) / (n - 1) if n > 1 else 0.0
    return mean, math.sqrt(var)


def _pearson(
    returns_a: list[float],
    mean_a: float,
    std_a: float,
    returns_b: list[float],
    mean_b: float,
    std_b: float,
) -> float:
    """
    Compute Pearson correlation coefficient between two aligned return series.
    Returns 0.0 if either series has zero standard deviation.
    """
    if std_a < 1e-14 or std_b < 1e-14:
        return 0.0  # correlation undefined; treated as uncorrelated
    n = len(returns_a)
    cov = sum(
        (returns_a[i] - mean_a) * (returns_b[i] - mean_b)
        for i in range(n)
    ) / (n - 1)
    corr = cov / (std_a * std_b)
    # Clamp to [-1, 1] to absorb any floating-point drift beyond valid range
    return max(-1.0, min(1.0, corr))


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_correlation(
    asset_returns: dict[str, list[float]],
) -> CorrelationResult:
    """
    Compute the pairwise Pearson correlation matrix for a set of assets.

    Algorithm
    ---------
    1. Validate: at least 1 asset, minimum 2 observations per asset, all series
       must have identical length (aligned on the same trading dates).
    2. Pre-compute mean and standard deviation for each asset.
    3. Compute upper-triangle of the correlation matrix.
    4. Mirror to lower-triangle (symmetry) and fill diagonal with 1.0.

    Parameters
    ----------
    asset_returns : dict[str, list[float]]
        Mapping of asset identifier → list of aligned daily simple returns.
        All lists must have the same length. Dictionary order is preserved
        (Python 3.7+) as the row/column order of the output matrix.

    Returns
    -------
    CorrelationResult

    Raises
    ------
    ValueError
        If the input is empty, any series has fewer than 2 observations, or
        the series lengths are not all equal.
    """
    if not asset_returns:
        raise ValueError("asset_returns must contain at least one asset.")

    asset_ids = list(asset_returns.keys())
    n_assets = len(asset_ids)

    # ── Validate series lengths ───────────────────────────────────────────────
    series_lengths = {aid: len(returns) for aid, returns in asset_returns.items()}
    unique_lengths = set(series_lengths.values())

    if any(length < 2 for length in series_lengths.values()):
        short_assets = [aid for aid, length in series_lengths.items() if length < 2]
        raise ValueError(
            f"All return series must have at least 2 observations. "
            f"The following assets have insufficient data: {short_assets}"
        )

    if len(unique_lengths) > 1:
        raise ValueError(
            f"All asset return series must have the same length for alignment. "
            f"Found lengths: {series_lengths}"
        )

    n_observations = next(iter(unique_lengths))

    # ── Pre-compute stats ──────────────────────────────────────────────────────
    stats: dict[str, tuple[float, float]] = {
        aid: _compute_stats(list(asset_returns[aid])) for aid in asset_ids
    }

    # ── Build N×N correlation matrix ───────────────────────────────────────────
    # Initialise with zeros
    matrix: list[list[float]] = [[0.0] * n_assets for _ in range(n_assets)]

    for i in range(n_assets):
        matrix[i][i] = 1.0  # diagonal
        aid_i = asset_ids[i]
        mean_i, std_i = stats[aid_i]
        returns_i = list(asset_returns[aid_i])

        for j in range(i + 1, n_assets):
            aid_j = asset_ids[j]
            mean_j, std_j = stats[aid_j]
            returns_j = list(asset_returns[aid_j])

            rho = _pearson(returns_i, mean_i, std_i, returns_j, mean_j, std_j)

            matrix[i][j] = rho
            matrix[j][i] = rho  # symmetry

    result = CorrelationResult(
        asset_ids=asset_ids,
        matrix=matrix,
        n_assets=n_assets,
        n_observations=n_observations,
    )

    logger.info(
        "Correlation matrix computed: n_assets=%d n_observations=%d assets=%s",
        n_assets,
        n_observations,
        asset_ids,
    )
    return result
