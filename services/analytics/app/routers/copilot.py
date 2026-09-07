"""
AI Portfolio Copilot Router
============================

Exposes:
    POST /copilot/chat  — RAG-grounded portfolio Q&A with trade suggestions

Pipeline for each request:
    1. Build portfolio summary string from caller-supplied PortfolioContext
    2. Run rule-based drift detection → SuggestedTradeAction list
    3. Assemble grounded LLM system prompt
    4. Call LLM (or rule-based fallback) with the grounded messages
    5. Append mandatory SEBI disclaimer
    6. Return CopilotResponse

Design notes
------------
- The copilot is intentionally stateless: conversation history is client-managed
  and passed in the request body. This avoids server-side session storage and
  makes every request independently reproducible.
- The SEBI disclaimer is appended at the router layer, not by the LLM, so it
  cannot be omitted or altered by model output.
- All monetary computations use the exact values from PortfolioContext — the LLM
  is instructed to echo numbers verbatim from the system prompt.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.copilot.context_builder import (
    build_messages,
    build_portfolio_summary,
    build_system_prompt,
    detect_allocation_drift,
    get_context_sources,
)
from app.copilot.llm_adapter import LLMAdapter
from app.schemas.copilot import (
    CopilotQueryRequest,
    CopilotResponse,
    SEBI_DISCLAIMER,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/copilot",
    tags=["AI Portfolio Copilot"],
)

# Single shared adapter instance (reuses httpx connection pool across requests)
_llm_adapter = LLMAdapter()


@router.post(
    "/chat",
    response_model=CopilotResponse,
    summary="AI Portfolio Copilot Chat",
    description=(
        "RAG-powered portfolio Q&A endpoint. "
        "Accepts a user query and a live PortfolioContext payload, then returns "
        "a mathematically grounded answer with optional rebalancing suggestions. "
        "Every response includes the mandatory SEBI disclaimer. "
        "Supports multi-turn conversation via client-managed history."
    ),
    responses={
        400: {
            "description": (
                "Invalid portfolio context (e.g. allocation weights don't sum to 100, "
                "empty user message, or malformed holdings data)."
            )
        },
        503: {"description": "LLM API unavailable after retries — rule-based fallback used."},
    },
)
async def copilot_chat(body: CopilotQueryRequest) -> CopilotResponse:
    """
    POST /copilot/chat

    Grounded AI portfolio assistant. All responses reference only the exact
    live numbers supplied in `portfolio_context` — zero hallucination.

    **RAG pipeline:**
    1. Fetch context: portfolio_context is the pre-fetched "retrieved document".
    2. Drift detection: rule-based engine scans for allocation drift > 5pp,
       single-holding concentration > 20%, and Sharpe < 0.5.
    3. Prompt injection: grounded system prompt is assembled with exact numbers.
    4. LLM call: OpenAI-compatible API (or rule-based fallback if no API key).
    5. Disclaimer: SEBI disclaimer appended unconditionally.

    **Conversation memory:**
    Pass `conversation_history` with prior turns (up to 10 kept; older silently dropped).
    The service is stateless — history management is the caller's responsibility.
    """
    ctx = body.portfolio_context
    portfolio_id = ctx.portfolio_id

    logger.info(
        "Copilot chat request: portfolio_id=%s holdings=%d history_turns=%d "
        "message_len=%d",
        portfolio_id,
        len(ctx.holdings),
        len(body.conversation_history),
        len(body.user_message),
    )

    # ── Step 1: Build portfolio summary (the "retrieved context") ─────────────
    try:
        portfolio_summary = build_portfolio_summary(ctx)
    except Exception as exc:
        logger.error("Failed to build portfolio summary: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid portfolio context: {exc}",
        ) from exc

    # ── Step 2: Rule-based drift & risk detection ──────────────────────────────
    drift_actions = detect_allocation_drift(ctx)

    logger.info(
        "Drift detection: portfolio_id=%s actions=%d",
        portfolio_id,
        len(drift_actions),
    )

    # ── Step 3: Assemble grounded system prompt ────────────────────────────────
    system_prompt = build_system_prompt(ctx, portfolio_summary, drift_actions)

    # ── Step 4: Build OpenAI-format messages array ─────────────────────────────
    messages = build_messages(
        system_prompt,
        body.conversation_history,
        body.user_message,
    )

    # ── Step 5: Call LLM (or rule-based fallback) ──────────────────────────────
    try:
        answer = await _llm_adapter.chat(messages, system_prompt, body.user_message)
    except RuntimeError as exc:
        # LLM API failed after retries — return a graceful error
        logger.error("LLM API error for portfolio_id=%s: %s", portfolio_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The AI model is temporarily unavailable. "
                "Please retry in a few seconds."
            ),
        ) from exc

    # ── Step 6: Determine context sources used ─────────────────────────────────
    context_sources = get_context_sources(ctx, has_history=len(body.conversation_history) > 0)

    # ── Step 7: Conversation turn counter ─────────────────────────────────────
    # Turn = number of prior user messages + 1 (this message)
    prior_user_turns = sum(
        1 for t in body.conversation_history if t.role == "user"
    )
    conversation_turn = prior_user_turns + 1

    logger.info(
        "Copilot response ready: portfolio_id=%s model=%s turn=%d "
        "drift_actions=%d answer_len=%d",
        portfolio_id,
        _llm_adapter.model_name,
        conversation_turn,
        len(drift_actions),
        len(answer),
    )

    return CopilotResponse(
        answer=answer,
        suggested_trades=drift_actions,
        context_sources=context_sources,
        disclaimer=SEBI_DISCLAIMER,
        model_used=_llm_adapter.model_name,
        conversation_turn=conversation_turn,
    )
