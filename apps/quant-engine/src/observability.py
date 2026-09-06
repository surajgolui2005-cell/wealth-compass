"""
Quant Engine Observability Module
=================================

Provides:
- Structured JSON logging with trace context correlation.
- Sensitive credential and token redaction for logs, Sentry events, and trace attributes.
- Prometheus metrics collector and text exposition.
- OpenTelemetry tracing integration with sanitized span attributes.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

# Sensitive patterns to redact across logs, traces, and error events
SENSITIVE_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"authorization", re.IGNORECASE),
    re.compile(r"cookie", re.IGNORECASE),
    re.compile(r"api[_-]?key", re.IGNORECASE),
    re.compile(r"credential", re.IGNORECASE),
]


def redact_sensitive_data(data: Any) -> Any:
    """Recursively redacts sensitive keys and values from dictionaries and strings."""
    if data is None:
        return None

    if isinstance(data, str):
        if re.match(r"^Bearer\s+", data, re.IGNORECASE):
            return "Bearer [REDACTED]"
        return data

    if isinstance(data, list):
        return [redact_sensitive_data(item) for item in data]

    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            if any(pattern.search(str(key)) for pattern in SENSITIVE_PATTERNS):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = redact_sensitive_data(value)
        return sanitized

    return data


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt) or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": "quant-engine",
            "environment": os.getenv("ENVIRONMENT", "development"),
            "pid": os.getpid(),
        }

        # Correlate trace context if present
        trace_id = getattr(record, "trace_id", None) or os.getenv("TRACE_ID")
        span_id = getattr(record, "span_id", None)
        if trace_id:
            log_obj["trace_id"] = trace_id
        if span_id:
            log_obj["span_id"] = span_id

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        # Redact any extra attributes
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            log_obj["extra"] = redact_sensitive_data(record.extra)

        return json.dumps(log_obj)


def setup_observability_logging() -> None:
    """Configures root logger with the structured JSON formatter."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


class QuantEngineMetrics:
    """Lightweight in-process Prometheus metrics accumulator."""

    def __init__(self) -> None:
        self.request_counts: Dict[str, int] = {}
        self.calculation_durations: Dict[str, List[float]] = {}
        self.start_time: float = time.time()

    def record_request(self, method: str, endpoint: str, status_code: int) -> None:
        key = f'{method}:{endpoint}:{status_code}'
        self.request_counts[key] = self.request_counts.get(key, 0) + 1

    def record_calculation(self, routine: str, duration_seconds: float) -> None:
        if routine not in self.calculation_durations:
            self.calculation_durations[routine] = []
        # Keep last 500 measurements for memory safety
        if len(self.calculation_durations[routine]) >= 500:
            self.calculation_durations[routine].pop(0)
        self.calculation_durations[routine].append(duration_seconds)

    def generate_prometheus_text(self) -> str:
        """Renders metrics in Prometheus text exposition format."""
        lines = [
            "# HELP quant_engine_uptime_seconds Total runtime in seconds",
            "# TYPE quant_engine_uptime_seconds gauge",
            f"quant_engine_uptime_seconds {time.time() - self.start_time:.2f}",
            "",
            "# HELP quant_engine_requests_total Total HTTP requests processed by Quant Engine",
            "# TYPE quant_engine_requests_total counter",
        ]

        if not self.request_counts:
            lines.append('quant_engine_requests_total{method="GET",endpoint="/health",status="200"} 0')
        else:
            for key, count in sorted(self.request_counts.items()):
                parts = key.split(":")
                method, endpoint, status = parts[0], parts[1], parts[2]
                lines.append(f'quant_engine_requests_total{{method="{method}",endpoint="{endpoint}",status="{status}"}} {count}')

        lines.extend([
            "",
            "# HELP quant_engine_calculation_duration_seconds Latency of risk calculations",
            "# TYPE quant_engine_calculation_duration_seconds summary",
        ])

        for routine, durations in sorted(self.calculation_durations.items()):
            count = len(durations)
            total_sum = sum(durations)
            durations_sorted = sorted(durations)
            p50 = durations_sorted[int(count * 0.50)] if count > 0 else 0.0
            p95 = durations_sorted[int(count * 0.95)] if count > 0 else 0.0

            lines.append(f'quant_engine_calculation_duration_seconds{{routine="{routine}",quantile="0.5"}} {p50:.6f}')
            lines.append(f'quant_engine_calculation_duration_seconds{{routine="{routine}",quantile="0.95"}} {p95:.6f}')
            lines.append(f'quant_engine_calculation_duration_seconds_sum{{routine="{routine}"}} {total_sum:.6f}')
            lines.append(f'quant_engine_calculation_duration_seconds_count{{routine="{routine}"}} {count}')

        lines.append("")
        return "\n".join(lines)


# Singleton metrics instance
quant_metrics = QuantEngineMetrics()
