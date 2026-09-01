"""
Risk Analytics Sub-Package for the Wealth Compass Quant Engine.

This package provides isolated, pure-math quantitative risk modules.
All modules are dependency-free (stdlib only, no numpy/scipy) to ensure
maximum portability, deterministic behaviour, and fast unit test execution.

Public API
----------
    volatility      — Annualised standard deviation of returns (sqrt(252) scaling).
    beta            — Systematic risk: Cov(portfolio, benchmark) / Var(benchmark).
    sharpe          — Risk-adjusted return: annualised excess return / annual volatility.
    sortino         — Downside-adjusted return: excess return / downside deviation.
    drawdown        — Historical Maximum Drawdown: peak-to-trough worst-case loss.
    var             — Value at Risk: Parametric (normal) and Historical Simulation.
    correlation     — Pairwise Pearson correlation matrix across assets.
    diversification — HHI, Effective N, Top-N ratios, and composite 0–100 Diversification Score.

Usage example
-------------
    from src.analytics.risk import (
        compute_volatility,
        compute_beta,
        compute_sharpe,
        compute_sortino,
        compute_drawdown,
        compute_var,
        compute_correlation,
        compute_diversification,
    )

Methodology documentation
--------------------------
    See docs/analytics/RISK_METHODOLOGY.md for formal mathematical definitions,
    financial conventions, and known limitations for each risk measure.
"""

from .volatility import compute_volatility, VolatilityResult
from .beta import compute_beta, BetaResult
from .sharpe import compute_sharpe, SharpeResult
from .sortino import compute_sortino, SortinoResult
from .drawdown import compute_drawdown, DrawdownResult
from .var import compute_var, VaRResult, VaREstimate
from .correlation import compute_correlation, CorrelationResult
from .diversification import compute_diversification, DiversificationResult, ConcentrationRatio

__all__ = [
    # Volatility
    "compute_volatility",
    "VolatilityResult",
    # Beta
    "compute_beta",
    "BetaResult",
    # Sharpe
    "compute_sharpe",
    "SharpeResult",
    # Sortino
    "compute_sortino",
    "SortinoResult",
    # Drawdown
    "compute_drawdown",
    "DrawdownResult",
    # VaR
    "compute_var",
    "VaRResult",
    "VaREstimate",
    # Correlation
    "compute_correlation",
    "CorrelationResult",
    # Diversification
    "compute_diversification",
    "DiversificationResult",
    "ConcentrationRatio",
]
