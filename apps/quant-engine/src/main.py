"""
Quant Engine — FastAPI Application Entry Point
===============================================

Internal-only service. Not publicly routed. Accepts calls exclusively from
the NestJS API Gateway over the private container network (RS256 JWT auth).
"""

from __future__ import annotations

import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from src.app.routers.performance import router as performance_router
from src.app.routers.allocation import router as allocation_router
from src.app.routers.risk import router as risk_router
from src.observability import setup_observability_logging, quant_metrics

# Initialize structured JSON logging
setup_observability_logging()

app = FastAPI(
    title="Wealth Compass — Quant Engine",
    description=(
        "Internal quantitative risk and performance analytics service. "
        "Provides TWR, XIRR, benchmark comparison, multi-dimensional asset allocation, "
        "portfolio rebalance calculations, and a full risk engine "
        "(Volatility, Beta, Sharpe, Sortino, Max Drawdown, VaR, Correlation)."
    ),
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS: locked to internal container network only in production.
# In development, the NestJS dev server calls this directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://api:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Metrics Middleware ────────────────────────────────────────────────────────
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    quant_metrics.record_request(request.method, request.url.path, response.status_code)
    return response

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(performance_router)
app.include_router(allocation_router)
app.include_router(risk_router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Liveness probe for container orchestration."""
    return {"status": "ok", "service": "quant-engine", "version": "1.1.0"}


@app.get("/metrics", tags=["Observability"])
async def metrics_endpoint() -> Response:
    """Prometheus metrics exporter for the Quant Engine."""
    content = quant_metrics.generate_prometheus_text()
    return Response(
        content=content,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )

