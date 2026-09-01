"""Routers sub-package — FastAPI router modules for all analytics endpoints."""

from .allocation import router as allocation_router
from .risk import router as risk_router

__all__ = ["allocation_router", "risk_router"]

