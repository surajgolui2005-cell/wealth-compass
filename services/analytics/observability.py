"""
Services Analytics Observability Module
=======================================
Mirrors quant-engine observability for centralized service monitoring.
"""

from apps.quant_engine_proxy import *  # noqa: F401, F403
import os
import sys

# Add apps/quant-engine to sys.path if not present
current_dir = os.path.dirname(os.path.abspath(__file__))
quant_engine_src = os.path.abspath(os.path.join(current_dir, "..", "..", "apps", "quant-engine", "src"))
if quant_engine_src not in sys.path:
    sys.path.insert(0, quant_engine_src)

from observability import (
    redact_sensitive_data,
    StructuredJsonFormatter,
    setup_observability_logging,
    QuantEngineMetrics,
    quant_metrics,
)

__all__ = [
    "redact_sensitive_data",
    "StructuredJsonFormatter",
    "setup_observability_logging",
    "QuantEngineMetrics",
    "quant_metrics",
]
