"""
Beta Calculator
===============

Pure-math module for computing the systematic risk (beta) of a portfolio or
asset against a benchmark index.

Mathematical definition
-----------------------
Given N aligned daily returns for the portfolio (r_p) and benchmark (r_b):

    Covariance:  Cov(r_p, r_b) = Σ[(r_p,i − r̄_p)(r_b,i − r̄_b)] / (N − 1)
    Variance:    Var(r_b)       = Σ[(r_b,i − r̄_b)²] / (N − 1)
    Beta:        β              = Cov(r_p, r_b) / Var(r_b)

Interpretation
--------------
    β < 0    : Portfolio moves inversely to the benchmark.
    β = 0    : Portfolio return is uncorrelated with the benchmark.
    β = 1    : Portfolio mirrors benchmark volatility perfectly.
    β > 1    : Portfolio amplifies benchmark movements (higher systematic risk).

Note: Beta is a purely RELATIVE measure — it captures how much of the portfolio's
variance is explained by the benchmark's movement (systematic risk). Idiosyncratic
(non-systematic) risk is captured by alpha and residual returns.

References
----------
    Sharpe, W.F. (1964). Capital Asset Prices: A Theory of Market Equilibrium.
    Journal of Finance, 19(3), 425-442.
    PRD US-RISK-01 — Portfolio Volatility & Risk Metrics.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# ── Result type ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class BetaResult:
    """
    Beta computation output.

    Attributes
    ----------
    asset_id        : Portfolio or security identifier.
    benchmark_id    : Benchmark identifier.
    beta            : Systematic risk coefficient (Cov / Var_benchmark).
    covariance      : Sample covariance between asset and benchmark returns.
    benchmark_variance : Sample variance of benchmark returns.
    n_observations  : Number of aligned return pairs used.
    """

    asset_id: str
    benchmark_id: str
    beta: float
    covariance: float
    benchmark_variance: float
    n_observations: int


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_beta(
    asset_id: str,
    benchmark_id: str,
    asset_returns: list[float],
    benchmark_returns: list[float],
) -> BetaResult:
    """
    Compute the portfolio beta against a benchmark.

    Algorithm
    ---------
    1. Validate: both series must have identical length, minimum 2 observations.
    2. Compute sample means for asset (r̄_p) and benchmark (r̄_b).
    3. Compute sample covariance:   Cov(r_p, r_b) = Σ[(r_p,i − r̄_p)(r_b,i − r̄_b)] / (N−1).
    4. Compute benchmark variance:  Var(r_b) = Σ[(r_b,i − r̄_b)²] / (N−1).
    5. Beta: β = Cov(r_p, r_b) / Var(r_b).
    6. Guard: if benchmark_variance ≈ 0 (benchmark is a flat line), raise ValueError.

    Parameters
    ----------
    asset_id : str
        Identifier for the portfolio or security being evaluated.
    benchmark_id : str
        Identifier for the benchmark index (e.g. \"NIFTY_50\", \"SENSEX\").
    asset_returns : list[float]
        Daily simple returns of the portfolio/asset. Must be aligned with benchmark_returns.
    benchmark_returns : list[float]
        Daily simple returns of the benchmark. Must have the same length as asset_returns.

    Returns
    -------
    BetaResult

    Raises
    ------
    ValueError
        If series lengths differ, fewer than 2 observations, or benchmark has zero variance.
    """
    n_asset = len(asset_returns)
    n_bench = len(benchmark_returns)

    if n_asset != n_bench:
        raise ValueError(
            f"asset_returns and benchmark_returns must have the same length; "
            f"got asset={n_asset}, benchmark={n_bench}."
        )
    if n_asset < 2:
        raise ValueError(
            f"At least 2 return observations are required to compute beta; "
            f"got {n_asset} for asset_id='{asset_id}'."
        )

    n = n_asset
    mean_asset = sum(asset_returns) / n
    mean_bench = sum(benchmark_returns) / n

    # ── Covariance and benchmark variance (Bessel corrected) ───────────────────
    cov = sum(
        (asset_returns[i] - mean_asset) * (benchmark_returns[i] - mean_bench)
        for i in range(n)
    ) / (n - 1)

    bench_var = sum(
        (benchmark_returns[i] - mean_bench) ** 2 for i in range(n)
    ) / (n - 1)

    if abs(bench_var) < 1e-14:
        raise ValueError(
            f"Benchmark variance is effectively zero for benchmark_id='{benchmark_id}'. "
            "Cannot compute beta against a flat benchmark return series."
        )

    beta = cov / bench_var

    result = BetaResult(
        asset_id=asset_id,
        benchmark_id=benchmark_id,
        beta=beta,
        covariance=cov,
        benchmark_variance=bench_var,
        n_observations=n,
    )

    logger.info(
        "Beta computed: asset_id=%s benchmark_id=%s n=%d beta=%.4f cov=%.8f bench_var=%.8f",
        asset_id,
        benchmark_id,
        n,
        beta,
        cov,
        bench_var,
    )
    return result
