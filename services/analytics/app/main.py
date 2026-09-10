"""
Analytics Service — AI Portfolio Copilot
=========================================

FastAPI application entry point for the Wealth Compass AI Copilot microservice.

This service is internal-only (not publicly routed). The NestJS API Gateway
calls POST /copilot/chat over the private container network, passing:
  - The investor's natural-language query
  - A live PortfolioContext snapshot (pre-fetched from the DB by the gateway)
  - Optional conversation history for multi-turn dialogue

The copilot grounds every response in the caller-supplied live portfolio data
(zero database calls from this service). All responses include the mandatory
SEBI disclaimer regardless of LLM model output.
"""

from __future__ import annotations

import time
import logging

from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.routers.copilot import router as copilot_router

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Wealth Compass — AI Portfolio Copilot",
    description=(
        "RAG-powered AI portfolio assistant. "
        "Grounds every response in live multi-broker portfolio data "
        "(holdings, risk metrics, allocation drift) supplied by the NestJS API gateway. "
        "Generates SEBI-compliant trade rebalancing suggestions and supports "
        "multi-turn contextual conversation. "
        "All monetary values are expressed in INR (Lakhs / Crores)."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:8001",
        "http://api:3000",
        "*",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request latency middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def log_request_latency(request: Request, call_next) -> Response:
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "HTTP %s %s → %d  (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(copilot_router)

# ── Health & Metrics ───────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Liveness probe for container orchestration."""
    return {
        "status": "ok",
        "service": "analytics-copilot",
        "version": "1.0.0",
    }
