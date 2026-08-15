"""
Quant Engine — FastAPI Application Entry Point
===============================================

Internal-only service. Not publicly routed. Accepts calls exclusively from
the NestJS API Gateway over the private container network (RS256 JWT auth).
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.app.routers.performance import router as performance_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="Wealth Compass — Quant Engine",
    description=(
        "Internal quantitative risk and performance analytics service. "
        "Provides TWR, XIRR, VaR, and benchmark comparison metrics."
    ),
    version="1.0.0",
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

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(performance_router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Liveness probe for container orchestration."""
    return {"status": "ok", "service": "quant-engine"}
