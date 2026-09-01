"""
Value at Risk (VaR) Calculator
================================

Pure-math module for computing portfolio Value at Risk (VaR) using two methods:

    1. Parametric VaR (Variance-Covariance method)
    2. Historical Simulation VaR

Both methods are computed at 95% and 99% confidence levels by default.

──────────────────────────────────────────────────────────────────────────────
Method 1: Parametric VaR
──────────────────────────────────────────────────────────────────────────────
Assumes returns are normally distributed.

    VaR_p(α) = −(μ_d + z_α × σ_d) × P

Where:
    μ_d   = Mean daily return
    σ_d   = Daily standard deviation (Bessel corrected)
    z_α   = Standard normal quantile at confidence level α:
              z_0.95 = 1.6449   (one-tailed, 95% confidence)
              z_0.99 = 2.3263   (one-tailed, 99% confidence)
    P     = Portfolio value (in INR)

The sign convention returns VaR as a POSITIVE number representing the maximum
expected loss at the given confidence level over one trading day.

──────────────────────────────────────────────────────────────────────────────
Method 2: Historical Simulation VaR
──────────────────────────────────────────────────────────────────────────────
Makes no distributional assumptions. Uses the empirical return distribution
directly.

    VaR_h(α) = −Q(1−α) × P

Where:
    Q(1−α) = The (1-α) quantile of the observed daily return distribution.
               At 95% confidence: 5th percentile of daily returns.
               At 99% confidence: 1st percentile of daily returns.
    P       = Portfolio value (in INR)

Quantile is computed via linear interpolation (type 7 interpolation, consistent
with NumPy/Excel PERCENTILE).

──────────────────────────────────────────────────────────────────────────────
Interpretation
──────────────────────────────────────────────────────────────────────────────
VaR_95 = ₹50,000 means: with 95% confidence, the portfolio will not lose
more than ₹50,000 in a single trading day. There is a 5% chance the loss
exceeds this amount.

──────────────────────────────────────────────────────────────────────────────
Limitations
──────────────────────────────────────────────────────────────────────────────
- Parametric VaR underestimates tail risk for fat-tailed return distributions
  (crash regimes, volatile crypto/small-cap portfolios).
- Historical VaR is limited to the quality and length of the return history.
  Rare events (black swans) not in the sample window are not captured.
- Both 1-day VaR estimates do not scale linearly to multi-day horizons when
  returns are auto-correlated. The common √T scaling is an approximation.
- Neither method captures liquidity risk (inability to exit a position at the
  theoretical price).

References
----------
    Jorion, P. (2006). Value at Risk: The New Benchmark for Managing Financial Risk (3rd ed.).
    Basel III Framework — Internal Models Approach for Market Risk.
    PRD US-RISK-01 — Portfolio Volatility & Risk Metrics.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ── Standard normal z-scores for common confidence levels ─────────────────────
# Derived from the inverse normal CDF for one-tailed tests:
#   z_0.95 = scipy.stats.norm.ppf(0.95) = 1.6448536269514729
#   z_0.99 = scipy.stats.norm.ppf(0.99) = 2.3263478740408408
_Z_SCORES: dict[float, float] = {
    0.90: 1.2815515655446004,
    0.95: 1.6448536269514729,
    0.99: 2.3263478740408408,
    0.999: 3.0902323061678132,
}


# ── Result types ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class VaREstimate:
    """
    A single VaR estimate at one confidence level using one method.

    Attributes
    ----------
    method          : \"parametric\" or \"historical\".
    confidence_level: Confidence level as a decimal (e.g. 0.95 = 95%).
    var_pct         : VaR expressed as a percentage of portfolio value (positive).
    var_amount      : VaR in portfolio home currency (INR). Positive = max expected loss.
    """

    method: str
    confidence_level: float
    var_pct: float
    var_amount: float


@dataclass(frozen=True)
class VaRResult:
    """
    Full VaR computation output covering both methods and both confidence levels.

    Attributes
    ----------
    asset_id        : Portfolio or security identifier.
    portfolio_value : Total portfolio value used for monetary VaR calculation (INR).
    n_observations  : Number of daily return observations used.
    parametric_95   : Parametric VaR at 95% confidence.
    parametric_99   : Parametric VaR at 99% confidence.
    historical_95   : Historical Simulation VaR at 95% confidence.
    historical_99   : Historical Simulation VaR at 99% confidence.
    mean_daily_return: Mean of the daily return series.
    daily_volatility : Sample standard deviation of the daily return series.
    """

    asset_id: str
    portfolio_value: float
    n_observations: int
    parametric_95: VaREstimate
    parametric_99: VaREstimate
    historical_95: VaREstimate
    historical_99: VaREstimate
    mean_daily_return: float
    daily_volatility: float


# ── Internal helpers ───────────────────────────────────────────────────────────


def _quantile(sorted_data: list[float], p: float) -> float:
    """
    Compute the p-th quantile of a pre-sorted list using linear interpolation
    (consistent with NumPy default / Excel PERCENTILE behaviour — type 7).

    Parameters
    ----------
    sorted_data : list[float]
        Pre-sorted (ascending) sequence of values.
    p : float
        Quantile level in [0, 1].
    """
    n = len(sorted_data)
    if n == 0:
        raise ValueError("Cannot compute quantile of an empty sequence.")
    if n == 1:
        return sorted_data[0]

    # Virtual index (type 7): index = p × (n − 1)
    virtual_idx = p * (n - 1)
    lower = int(virtual_idx)
    upper = lower + 1
    frac = virtual_idx - lower

    if upper >= n:
        return sorted_data[-1]

    return sorted_data[lower] * (1.0 - frac) + sorted_data[upper] * frac


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_var(
    asset_id: str,
    daily_returns: list[float],
    portfolio_value: float,
    confidence_levels: list[float] | None = None,
) -> VaRResult:
    """
    Compute Value at Risk using both Parametric and Historical Simulation methods.

    Always computes VaR at 95% and 99% confidence. Additional confidence levels
    may be requested via ``confidence_levels`` (the 95%/99% results are always
    returned in the structured result object regardless).

    Algorithm — Parametric
    -----------------------
    1. Compute mean (μ_d) and Bessel-corrected std (σ_d) of daily returns.
    2. For each confidence level α:
       a. Retrieve z_α from pre-computed z-scores.
       b. Daily VaR (fraction) = −(μ_d − z_α × σ_d).
       c. Daily VaR (INR) = daily_var_pct × portfolio_value.

    Algorithm — Historical
    -----------------------
    1. Sort daily returns ascending.
    2. For each confidence level α:
       a. Percentile threshold = 1 − α (e.g. α=0.95 → 5th percentile).
       b. Interpolated quantile Q = _quantile(sorted_returns, 1 - α).
       c. Daily VaR (fraction) = −Q (negate: losses are negative returns).
       d. Daily VaR (INR) = max(VaR_pct, 0) × portfolio_value.

    Parameters
    ----------
    asset_id : str
        Portfolio or security identifier (for logging / tracing).
    daily_returns : list[float]
        Sequence of daily simple (or log) periodic returns. Minimum 20 observations
        recommended; at least 2 required.
    portfolio_value : float
        Current total portfolio value in INR. Used to compute monetary VaR.
    confidence_levels : list[float], optional
        Additional confidence levels for which VaR should be logged (in addition
        to the always-computed 95% and 99%). Values must be in (0, 1).

    Returns
    -------
    VaRResult

    Raises
    ------
    ValueError
        If fewer than 2 return observations are provided, or portfolio_value ≤ 0.
    """
    n = len(daily_returns)
    if n < 2:
        raise ValueError(
            f"At least 2 return observations are required to compute VaR; "
            f"got {n} for asset_id='{asset_id}'."
        )
    if portfolio_value <= 0.0:
        raise ValueError(
            f"portfolio_value must be positive; got {portfolio_value} for asset_id='{asset_id}'."
        )

    # ── Parametric inputs ──────────────────────────────────────────────────────
    mean_r = sum(daily_returns) / n
    sum_sq = sum((r - mean_r) ** 2 for r in daily_returns)
    daily_vol = math.sqrt(sum_sq / (n - 1))

    def _parametric_var(alpha: float) -> VaREstimate:
        z = _Z_SCORES.get(alpha)
        if z is None:
            raise ValueError(
                f"Unsupported confidence level {alpha} for parametric VaR. "
                f"Supported: {sorted(_Z_SCORES.keys())}"
            )
        # One-day loss at confidence α (positive = loss)
        var_pct = max(-(mean_r - z * daily_vol), 0.0)
        return VaREstimate(
            method="parametric",
            confidence_level=alpha,
            var_pct=var_pct * 100.0,
            var_amount=var_pct * portfolio_value,
        )

    # ── Historical inputs ──────────────────────────────────────────────────────
    sorted_returns = sorted(daily_returns)

    def _historical_var(alpha: float) -> VaREstimate:
        # Percentile at (1 − α): 5th percentile for 95% VaR
        quantile_level = 1.0 - alpha
        q = _quantile(sorted_returns, quantile_level)
        # Negate: the quantile is a negative return; VaR is the magnitude of the loss
        var_pct = max(-q, 0.0)
        return VaREstimate(
            method="historical",
            confidence_level=alpha,
            var_pct=var_pct * 100.0,
            var_amount=var_pct * portfolio_value,
        )

    p95 = _parametric_var(0.95)
    p99 = _parametric_var(0.99)
    h95 = _historical_var(0.95)
    h99 = _historical_var(0.99)

    result = VaRResult(
        asset_id=asset_id,
        portfolio_value=portfolio_value,
        n_observations=n,
        parametric_95=p95,
        parametric_99=p99,
        historical_95=h95,
        historical_99=h99,
        mean_daily_return=mean_r,
        daily_volatility=daily_vol,
    )

    logger.info(
        "VaR computed: asset_id=%s n=%d portfolio_value=%.2f "
        "P95=%.2f P99=%.2f H95=%.2f H99=%.2f",
        asset_id,
        n,
        portfolio_value,
        p95.var_amount,
        p99.var_amount,
        h95.var_amount,
        h99.var_amount,
    )
    return result
