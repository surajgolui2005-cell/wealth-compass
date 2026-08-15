"""
Analytics math package for the Wealth Compass Quant Engine.

Public API:
    twr     — Time-Weighted Return (sub-period compounding, Modified Dietz)
    xirr    — Extended Internal Rate of Return (Newton-Raphson + Brent fallback)
    benchmark — Benchmark comparison utilities (alpha, beta, tracking error)
"""

from .twr import compute_twr, SubPeriod, TwrResult
from .xirr import compute_xirr, CashFlow, XirrResult
from .benchmark import compute_benchmark_metrics, BenchmarkMetrics

__all__ = [
    "compute_twr",
    "SubPeriod",
    "TwrResult",
    "compute_xirr",
    "CashFlow",
    "XirrResult",
    "compute_benchmark_metrics",
    "BenchmarkMetrics",
]
