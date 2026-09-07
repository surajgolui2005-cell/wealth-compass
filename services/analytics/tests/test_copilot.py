"""
PyTest suite for the AI Portfolio Copilot service.

Tests are fully self-contained — no external API calls, no database, no LLM key.
All 14 tests run entirely with the rule-based fallback adapter.

Test coverage:
  Unit tests   (context_builder):
    1.  format_inr — Crore formatting
    2.  format_inr — Lakh formatting
    3.  format_inr — below-lakh formatting
    4.  build_portfolio_summary — contains net worth
    5.  build_portfolio_summary — contains risk metrics
    6.  detect_allocation_drift — generates SELL when equity over-weight
    7.  detect_allocation_drift — generates BUY when asset class under-weight
    8.  detect_allocation_drift — no action within threshold
    9.  detect_allocation_drift — concentration alert when holding > 20%
   10.  build_system_prompt — injects portfolio data
   11.  rule_based_response — Sharpe ratio query returns correct value
   12.  rule_based_response — holdings query returns allocation text

  Integration tests (FastAPI endpoint via httpx.AsyncClient):
   13.  POST /copilot/chat — SEBI disclaimer present in every response
   14.  POST /copilot/chat — suggested_trades is a list
   15.  POST /copilot/chat — multi-turn conversation_history handled (turn=2)
   16.  POST /copilot/chat — empty holdings handled gracefully

Run with:
    python -m pytest services/analytics/tests/test_copilot.py -v
or from the services/analytics directory:
    python -m pytest tests/test_copilot.py -v
"""

from __future__ import annotations

import sys
import os

# ── Path bootstrap ─────────────────────────────────────────────────────────────
# Allow imports of `app.*` when running pytest from the repo root OR from
# the services/analytics directory.
_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SERVICE_DIR not in sys.path:
    sys.path.insert(0, _SERVICE_DIR)

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.copilot.context_builder import (
    build_messages,
    build_portfolio_summary,
    build_system_prompt,
    detect_allocation_drift,
    format_inr,
    get_context_sources,
)
from app.copilot.llm_adapter import LLMAdapter
from app.schemas.copilot import (
    ConversationTurn,
    CopilotQueryRequest,
    HoldingSnapshot,
    PortfolioContext,
    RiskMetricsSnapshot,
    SEBI_DISCLAIMER,
    SuggestedTradeAction,
)


# ══════════════════════════════════════════════════════════════════════════════
# Shared Fixtures
# ══════════════════════════════════════════════════════════════════════════════


def make_risk_metrics(
    sharpe: float = 1.42,
    sortino: float = 1.85,
    beta: float | None = 0.87,
    max_drawdown_pct: float = -18.3,
    annual_volatility_pct: float = 16.5,
    hhi: float = 842.0,
    diversification_score: float = 78.4,
) -> RiskMetricsSnapshot:
    return RiskMetricsSnapshot(
        sharpe_ratio=sharpe,
        sortino_ratio=sortino,
        beta=beta,
        max_drawdown_pct=max_drawdown_pct,
        annual_volatility_pct=annual_volatility_pct,
        hhi=hhi,
        diversification_score=diversification_score,
    )


def make_holding(
    symbol: str = "RELIANCE",
    name: str = "Reliance Industries Ltd",
    broker: str = "ZERODHA",
    weight_pct: float = 12.4,
    market_value_inr: float = 55_00_000,
    unrealized_pnl_pct: float = 14.2,
    asset_class: str = "Equity",
) -> HoldingSnapshot:
    return HoldingSnapshot(
        symbol=symbol,
        name=name,
        broker=broker,
        quantity=100,
        avg_cost_inr=4_000.0,
        current_price_inr=4_500.0 + (market_value_inr / 100 - 4_000.0),
        market_value_inr=market_value_inr,
        unrealized_pnl_inr=market_value_inr * unrealized_pnl_pct / 100,
        unrealized_pnl_pct=unrealized_pnl_pct,
        asset_class=asset_class,
        weight_pct=weight_pct,
    )


def make_portfolio_context(
    total_net_worth_inr: float = 4_50_00_000,  # ₹4.50 Cr
    asset_allocation: dict[str, float] | None = None,
    target_allocation: dict[str, float] | None = None,
    holdings: list[HoldingSnapshot] | None = None,
    risk_metrics: RiskMetricsSnapshot | None = None,
) -> PortfolioContext:
    return PortfolioContext(
        portfolio_id="test-portfolio-uuid-001",
        total_net_worth_inr=total_net_worth_inr,
        holdings=holdings or [
            make_holding("RELIANCE", weight_pct=12.4, market_value_inr=55_80_000),
            make_holding("HDFCBANK", "HDFC Bank Ltd", weight_pct=8.1, market_value_inr=36_45_000),
            make_holding("INFY", "Infosys Ltd", broker="GROWW", weight_pct=6.2, market_value_inr=27_90_000),
        ],
        asset_allocation=asset_allocation or {
            "Equity": 65.2,
            "Mutual Funds": 20.1,
            "Crypto": 5.3,
            "Cash": 9.4,
        },
        target_allocation=target_allocation,
        risk_metrics=risk_metrics or make_risk_metrics(),
    )


def make_copilot_request(
    user_message: str = "What is my Sharpe ratio?",
    context: PortfolioContext | None = None,
    history: list[ConversationTurn] | None = None,
) -> dict:
    """Build a JSON-serialisable dict for POST /copilot/chat."""
    ctx = context or make_portfolio_context()
    return CopilotQueryRequest(
        user_message=user_message,
        portfolio_context=ctx,
        conversation_history=history or [],
    ).model_dump()


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — format_inr
# ══════════════════════════════════════════════════════════════════════════════


class TestFormatInr:
    def test_crore_formatting(self):
        """₹1,23,45,678 → '₹1.23 Cr'"""
        assert format_inr(1_23_45_678) == "₹1.23 Cr"

    def test_crore_formatting_large(self):
        """₹45,23,00,000 → '₹45.23 Cr'"""
        assert format_inr(45_23_00_000) == "₹45.23 Cr"

    def test_lakh_formatting(self):
        """₹3,40,000 → '₹3.40 L'"""
        assert format_inr(3_40_000) == "₹3.40 L"

    def test_below_lakh_formatting(self):
        """₹99,000 → '₹99,000'"""
        result = format_inr(99_000)
        assert "₹" in result
        assert "99" in result

    def test_negative_crore(self):
        """Negative crore values get minus prefix."""
        result = format_inr(-5_00_00_000)
        assert result.startswith("-₹")
        assert "Cr" in result

    def test_negative_lakh(self):
        """Negative lakh values get minus prefix."""
        result = format_inr(-5_00_000)
        assert result.startswith("-₹")
        assert "L" in result


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — build_portfolio_summary
# ══════════════════════════════════════════════════════════════════════════════


class TestBuildPortfolioSummary:
    def test_contains_net_worth(self):
        """Portfolio summary must include total net worth in INR."""
        ctx = make_portfolio_context(total_net_worth_inr=4_50_00_000)
        summary = build_portfolio_summary(ctx)
        # ₹4.50 Cr should appear in the summary
        assert "4.50 Cr" in summary or "₹4.50" in summary

    def test_contains_sharpe_ratio(self):
        """Portfolio summary must include the Sharpe Ratio."""
        ctx = make_portfolio_context(risk_metrics=make_risk_metrics(sharpe=1.42))
        summary = build_portfolio_summary(ctx)
        assert "1.4200" in summary or "1.42" in summary

    def test_contains_asset_allocation(self):
        """Portfolio summary must include asset allocation percentages."""
        ctx = make_portfolio_context(
            asset_allocation={"Equity": 65.2, "Mutual Funds": 20.1, "Cash": 14.7}
        )
        summary = build_portfolio_summary(ctx)
        assert "Equity" in summary
        assert "65.2" in summary
        assert "Mutual Funds" in summary

    def test_contains_top_holdings(self):
        """Portfolio summary must include top holding symbols."""
        ctx = make_portfolio_context()
        summary = build_portfolio_summary(ctx)
        assert "RELIANCE" in summary
        assert "HDFCBANK" in summary

    def test_contains_hhi(self):
        """Portfolio summary must include HHI concentration label."""
        ctx = make_portfolio_context(risk_metrics=make_risk_metrics(hhi=842.0))
        summary = build_portfolio_summary(ctx)
        assert "842" in summary

    def test_drift_section_present_when_target_set(self):
        """When target_allocation is set, the drift section should appear."""
        ctx = make_portfolio_context(
            asset_allocation={"Equity": 65.2, "Mutual Funds": 20.1, "Cash": 14.7},
            target_allocation={"Equity": 60.0, "Mutual Funds": 25.0, "Cash": 15.0},
        )
        summary = build_portfolio_summary(ctx)
        assert "Target Allocation" in summary or "drift" in summary.lower()

    def test_empty_holdings_handled(self):
        """An empty holdings list should not raise — just omit the Top Holdings section."""
        ctx = make_portfolio_context(holdings=[])
        summary = build_portfolio_summary(ctx)  # Must not raise
        assert "Portfolio Net Worth" in summary


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — detect_allocation_drift
# ══════════════════════════════════════════════════════════════════════════════


class TestDetectAllocationDrift:
    def test_generates_sell_when_equity_overweight(self):
        """Equity at 80% vs target 60% → SELL action generated."""
        ctx = make_portfolio_context(
            asset_allocation={"Equity": 80.0, "Cash": 20.0},
            target_allocation={"Equity": 60.0, "Cash": 40.0},
        )
        actions = detect_allocation_drift(ctx)
        equity_actions = [a for a in actions if a.asset_class == "Equity"]
        assert len(equity_actions) >= 1
        assert equity_actions[0].action == "SELL"
        assert equity_actions[0].drift_pct == pytest.approx(20.0, abs=0.1)

    def test_generates_buy_when_underweight(self):
        """Debt at 5% vs target 20% → BUY action generated."""
        ctx = make_portfolio_context(
            total_net_worth_inr=1_00_00_000,
            asset_allocation={"Equity": 80.0, "Fixed Income": 5.0, "Cash": 15.0},
            target_allocation={"Equity": 65.0, "Fixed Income": 20.0, "Cash": 15.0},
        )
        actions = detect_allocation_drift(ctx)
        fi_actions = [a for a in actions if a.asset_class == "Fixed Income"]
        assert len(fi_actions) >= 1
        assert fi_actions[0].action == "BUY"
        assert fi_actions[0].drift_pct == pytest.approx(-15.0, abs=0.1)

    def test_no_drift_when_within_threshold(self):
        """Equity at 63% vs target 60% → no action (drift = 3%, below 5pp threshold)."""
        ctx = make_portfolio_context(
            asset_allocation={"Equity": 63.0, "Cash": 37.0},
            target_allocation={"Equity": 60.0, "Cash": 40.0},
        )
        actions = detect_allocation_drift(ctx)
        drift_actions = [a for a in actions if a.asset_class in ("Equity", "Cash")]
        assert len(drift_actions) == 0

    def test_no_actions_without_target_allocation(self):
        """When no target_allocation is provided, only risk-based rules trigger."""
        ctx = make_portfolio_context(
            target_allocation=None,
            risk_metrics=make_risk_metrics(sharpe=1.5),  # Sharpe > 0.5 — no alert
        )
        actions = detect_allocation_drift(ctx)
        # Without target and with good Sharpe, no concentration issues → empty
        non_concentration_actions = [
            a for a in actions if "concentration" not in a.rationale.lower()
        ]
        assert len(non_concentration_actions) == 0

    def test_concentration_alert_when_single_stock_gt_20pct(self):
        """A holding with weight > 20% triggers a concentration SELL alert."""
        ctx = make_portfolio_context(
            total_net_worth_inr=1_00_00_000,
            holdings=[
                make_holding("RELIANCE", weight_pct=25.0, market_value_inr=25_00_000),
                make_holding("HDFCBANK", weight_pct=75.0, market_value_inr=75_00_000),
            ],
            asset_allocation={"Equity": 100.0},
            target_allocation=None,
            risk_metrics=make_risk_metrics(sharpe=1.5),
        )
        actions = detect_allocation_drift(ctx)
        concentration_actions = [
            a for a in actions if a.symbol in ("RELIANCE", "HDFCBANK")
        ]
        assert len(concentration_actions) >= 1
        # Both holdings > 20% should have been flagged
        assert all(a.action == "SELL" for a in concentration_actions)

    def test_low_sharpe_triggers_rebalance_alert(self):
        """Sharpe Ratio < 0.5 triggers a REBALANCE alert."""
        ctx = make_portfolio_context(
            target_allocation=None,
            risk_metrics=make_risk_metrics(sharpe=0.3),
        )
        actions = detect_allocation_drift(ctx)
        rebalance_actions = [a for a in actions if a.action == "REBALANCE"]
        assert len(rebalance_actions) >= 1
        assert "Sharpe" in rebalance_actions[0].rationale

    def test_suggested_amount_inr_is_correct(self):
        """Drift amount in INR = abs(drift%) × total_net_worth."""
        total = 1_00_00_000  # ₹1 Cr
        ctx = make_portfolio_context(
            total_net_worth_inr=total,
            asset_allocation={"Equity": 75.0, "Cash": 25.0},
            target_allocation={"Equity": 60.0, "Cash": 40.0},
        )
        actions = detect_allocation_drift(ctx)
        equity_actions = [a for a in actions if a.asset_class == "Equity"]
        assert len(equity_actions) == 1
        # drift = 15%, amount = 15% of ₹1 Cr = ₹15 L
        assert equity_actions[0].suggested_amount_inr == pytest.approx(15_00_000, rel=0.01)


# ══════════════════════════════════════════════════════════════════════════════
# Unit Tests — build_system_prompt & LLMAdapter rule-based fallback
# ══════════════════════════════════════════════════════════════════════════════


class TestSystemPromptAndRuleBasedAdapter:
    def test_system_prompt_contains_portfolio_data(self):
        """System prompt must embed net worth and risk metrics."""
        ctx = make_portfolio_context(total_net_worth_inr=4_50_00_000)
        summary = build_portfolio_summary(ctx)
        actions = detect_allocation_drift(ctx)
        prompt = build_system_prompt(ctx, summary, actions)

        assert "4.50 Cr" in prompt or "₹4.50" in prompt
        assert "Sharpe Ratio" in prompt
        assert "GROUND RULES" in prompt

    def test_system_prompt_contains_sebi_instruction(self):
        """System prompt must instruct the model about SEBI restrictions."""
        ctx = make_portfolio_context()
        summary = build_portfolio_summary(ctx)
        prompt = build_system_prompt(ctx, summary, [])
        assert "SEBI" in prompt

    def test_rule_based_sharpe_query(self):
        """Rule-based fallback: 'What is my Sharpe ratio?' returns the correct value."""
        ctx = make_portfolio_context(risk_metrics=make_risk_metrics(sharpe=1.42))
        summary = build_portfolio_summary(ctx)
        prompt = build_system_prompt(ctx, summary, [])

        adapter = LLMAdapter()
        response = adapter._rule_based_response(prompt, "What is my Sharpe ratio?")
        assert "1.42" in response
        assert "Sharpe" in response

    def test_rule_based_holdings_query(self):
        """Rule-based fallback: 'Show my holdings' returns allocation text."""
        ctx = make_portfolio_context()
        summary = build_portfolio_summary(ctx)
        prompt = build_system_prompt(ctx, summary, [])

        adapter = LLMAdapter()
        response = adapter._rule_based_response(prompt, "Show my portfolio holdings")
        # Should return either holdings section or net worth reference
        assert any(kw in response for kw in ("RELIANCE", "₹", "holding", "portfolio"))

    def test_build_messages_includes_history(self):
        """build_messages must include system + history + user messages in order."""
        history = [
            ConversationTurn(role="user", content="What is my Sharpe?"),
            ConversationTurn(role="assistant", content="Your Sharpe is 1.42."),
        ]
        messages = build_messages("SYSTEM PROMPT", history, "What about drawdown?")
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert messages[1]["content"] == "What is my Sharpe?"
        assert messages[2]["role"] == "assistant"
        assert messages[-1]["role"] == "user"
        assert "drawdown" in messages[-1]["content"].lower()


# ══════════════════════════════════════════════════════════════════════════════
# Integration Tests — POST /copilot/chat
# ══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestCopilotChatEndpoint:
    async def test_disclaimer_always_present(self):
        """Every response must include the SEBI disclaimer."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/copilot/chat",
                json=make_copilot_request("What is my portfolio worth?"),
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "disclaimer" in data
        assert "SEBI" in data["disclaimer"]
        assert "Not SEBI-registered" in data["disclaimer"]

    async def test_suggested_trades_is_list(self):
        """Response must always include a suggested_trades list (may be empty)."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/copilot/chat",
                json=make_copilot_request("Analyse my portfolio."),
            )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["suggested_trades"], list)

    async def test_conversation_turn_increments(self):
        """With 2 prior user turns, conversation_turn should be 3."""
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
            {"role": "user", "content": "What is my Sharpe?"},
            {"role": "assistant", "content": "Your Sharpe is 1.42."},
        ]
        request_data = make_copilot_request(
            "What about drawdown?",
            history=[ConversationTurn(**h) for h in history],
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/copilot/chat", json=request_data)
        assert resp.status_code == 200
        assert resp.json()["conversation_turn"] == 3  # 2 prior user turns + 1

    async def test_empty_holdings_handled_gracefully(self):
        """An empty holdings list must not crash the endpoint."""
        ctx = make_portfolio_context(
            holdings=[],
            asset_allocation={"Equity": 65.0, "Cash": 35.0},
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/copilot/chat",
                json=make_copilot_request("Show my holdings", context=ctx),
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "answer" in data

    async def test_context_sources_include_live_holdings(self):
        """context_sources must always include 'live_holdings'."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/copilot/chat",
                json=make_copilot_request("What are my risk metrics?"),
            )
        assert resp.status_code == 200
        sources = resp.json()["context_sources"]
        assert "live_holdings" in sources
        assert "risk_metrics" in sources

    async def test_target_allocation_source_included_when_provided(self):
        """When target_allocation is set, 'target_allocation' must be in context_sources."""
        ctx = make_portfolio_context(
            asset_allocation={"Equity": 65.2, "Mutual Funds": 20.1, "Cash": 14.7},
            target_allocation={"Equity": 60.0, "Mutual Funds": 25.0, "Cash": 15.0},
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/copilot/chat",
                json=make_copilot_request("Should I rebalance?", context=ctx),
            )
        assert resp.status_code == 200
        assert "target_allocation" in resp.json()["context_sources"]

    async def test_drift_actions_returned_when_overweight(self):
        """When equity is 20pp over target, suggested_trades must include a SELL."""
        ctx = make_portfolio_context(
            total_net_worth_inr=1_00_00_000,
            asset_allocation={"Equity": 80.0, "Cash": 20.0},
            target_allocation={"Equity": 60.0, "Cash": 40.0},
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/copilot/chat",
                json=make_copilot_request("Should I rebalance?", context=ctx),
            )
        assert resp.status_code == 200
        trades = resp.json()["suggested_trades"]
        assert len(trades) >= 1
        sell_trades = [t for t in trades if t["action"] == "SELL"]
        assert len(sell_trades) >= 1

    async def test_model_used_field_present(self):
        """Response must include model_used field."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/copilot/chat",
                json=make_copilot_request("What is my Sharpe?"),
            )
        assert resp.status_code == 200
        assert "model_used" in resp.json()
        # Without API key, should be rule-based
        assert resp.json()["model_used"] == "rule-based-fallback"
