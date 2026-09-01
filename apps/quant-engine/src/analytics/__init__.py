"""
Analytics math package for the Wealth Compass Quant Engine.

Public API:
    twr        — Time-Weighted Return (sub-period compounding, Modified Dietz)
    xirr       — Extended Internal Rate of Return (Newton-Raphson + Brent fallback)
    benchmark  — Benchmark comparison utilities (alpha, beta, tracking error)
    allocation — Multi-dimensional allocation aggregation (asset class, sector, geography, currency, provider)
    rebalance  — Portfolio drift calculation and buy/sell rebalance amounts
    risk       — Quantitative risk engine (volatility, beta, Sharpe, Sortino, drawdown, VaR, correlation,
                 diversification score, HHI, concentration ratios)
"""

from .twr import compute_twr, SubPeriod, TwrResult
from .xirr import compute_xirr, CashFlow, XirrResult
from .benchmark import compute_benchmark_metrics, BenchmarkMetrics
from .allocation import compute_allocation, AllocationResult, AllocationBucket, GroupBy, PositionRecord
from .rebalance import compute_rebalance, RebalanceResult, RebalanceBucket, AllocationWeight
from .risk import (
    compute_volatility, VolatilityResult,
    compute_beta, BetaResult,
    compute_sharpe, SharpeResult,
    compute_sortino, SortinoResult,
    compute_drawdown, DrawdownResult,
    compute_var, VaRResult, VaREstimate,
    compute_correlation, CorrelationResult,
    compute_diversification, DiversificationResult, ConcentrationRatio,
)

__all__ = [
    # Performance
    "compute_twr",
    "SubPeriod",
    "TwrResult",
    "compute_xirr",
    "CashFlow",
    "XirrResult",
    "compute_benchmark_metrics",
    "BenchmarkMetrics",
    # Allocation
    "compute_allocation",
    "AllocationResult",
    "AllocationBucket",
    "GroupBy",
    "PositionRecord",
    # Rebalance
    "compute_rebalance",
    "RebalanceResult",
    "RebalanceBucket",
    "AllocationWeight",
    # Risk
    "compute_volatility",
    "VolatilityResult",
    "compute_beta",
    "BetaResult",
    "compute_sharpe",
    "SharpeResult",
    "compute_sortino",
    "SortinoResult",
    "compute_drawdown",
    "DrawdownResult",
    "compute_var",
    "VaRResult",
    "VaREstimate",
    "compute_correlation",
    "CorrelationResult",
    # Diversification
    "compute_diversification",
    "DiversificationResult",
    "ConcentrationRatio",
]
