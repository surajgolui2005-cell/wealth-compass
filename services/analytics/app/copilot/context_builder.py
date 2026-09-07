"""
Copilot Context Builder
=======================

Transforms a live PortfolioContext into:
  1. A structured natural-language portfolio summary string (the RAG "retrieved context")
  2. A list of rule-derived SuggestedTradeAction objects (drift detection)
  3. A grounded LLM system prompt that prevents hallucination
  4. An OpenAI-format messages array for the LLM chat call

Design principles
-----------------
- Zero hallucination: every number in the system prompt comes verbatim from
  the PortfolioContext supplied by the caller. The LLM is instructed to echo
  these numbers, not invent new ones.
- INR formatting: all monetary values are formatted using Indian numbering
  (Lakhs and Crores) to match the investor's native context.
- Drift threshold: 5 percentage points. Below this, no rebalancing action
  is generated to avoid noise from minor market movements.
- Concentration alert: any single holding exceeding 20% of the portfolio
  triggers a reduce-concentration suggestion.
"""

from __future__ import annotations

import logging

from app.schemas.copilot import (
    ConversationTurn,
    PortfolioContext,
    SEBI_DISCLAIMER,
    SuggestedTradeAction,
)

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

DRIFT_THRESHOLD_PCT = 5.0          # Minimum drift to generate a trade suggestion
CONCENTRATION_THRESHOLD_PCT = 20.0  # Max single-holding weight before alert
CRORE = 1_00_00_000.0              # 1 Crore = 10,000,000 INR
LAKH = 1_00_000.0                  # 1 Lakh = 100,000 INR


# ── INR Formatter ──────────────────────────────────────────────────────────────


def format_inr(amount_inr: float) -> str:
    """
    Format an INR monetary value using Indian numbering (Lakhs / Crores).

    Examples:
        1_23_45_678  → "₹1.23 Cr"
        3_40_000     → "₹3.40 L"
        99_000       → "₹99,000"
        -5_00_000    → "-₹5.00 L"
    """
    sign = "-" if amount_inr < 0 else ""
    abs_val = abs(amount_inr)

    if abs_val >= CRORE:
        return f"{sign}₹{abs_val / CRORE:.2f} Cr"
    if abs_val >= LAKH:
        return f"{sign}₹{abs_val / LAKH:.2f} L"
    # Below 1 lakh — use comma formatting
    return f"{sign}₹{abs_val:,.0f}"


# ── Portfolio Summary Builder ──────────────────────────────────────────────────


def build_portfolio_summary(ctx: PortfolioContext) -> str:
    """
    Build a structured plain-text summary of the live portfolio.

    This is the "retrieved document" in the RAG pipeline — injected verbatim
    into the system prompt so the LLM has precise, current numbers.
    """
    lines: list[str] = []

    # ── Net Worth ──────────────────────────────────────────────────────────────
    lines.append(f"Portfolio Net Worth : {format_inr(ctx.total_net_worth_inr)}")
    lines.append(f"Portfolio ID        : {ctx.portfolio_id}")

    # ── Top Holdings (up to 10 by weight) ─────────────────────────────────────
    sorted_holdings = sorted(
        ctx.holdings, key=lambda h: h.market_value_inr, reverse=True
    )
    if sorted_holdings:
        lines.append("\nTop Holdings:")
        for h in sorted_holdings[:10]:
            pnl_sign = "▲" if h.unrealized_pnl_pct >= 0 else "▼"
            lines.append(
                f"  {h.symbol:<16} [{h.broker:<10}]  "
                f"{format_inr(h.market_value_inr):>14}  "
                f"({h.weight_pct:.1f}%)  "
                f"P&L: {pnl_sign}{abs(h.unrealized_pnl_pct):.1f}%"
            )
        if len(ctx.holdings) > 10:
            lines.append(f"  … and {len(ctx.holdings) - 10} more holdings")

    # ── Asset Allocation ───────────────────────────────────────────────────────
    lines.append("\nAsset Allocation (Current):")
    for asset_class, pct in sorted(
        ctx.asset_allocation.items(), key=lambda x: x[1], reverse=True
    ):
        amount = ctx.total_net_worth_inr * pct / 100
        lines.append(f"  {asset_class:<20} {pct:>6.1f}%   ({format_inr(amount)})")

    # ── Target vs Current Drift ────────────────────────────────────────────────
    if ctx.target_allocation:
        lines.append("\nTarget Allocation vs Current (Drift):")
        all_classes = set(ctx.asset_allocation) | set(ctx.target_allocation)
        for asset_class in sorted(all_classes):
            current = ctx.asset_allocation.get(asset_class, 0.0)
            target = ctx.target_allocation.get(asset_class, 0.0)
            drift = current - target
            drift_str = f"{drift:+.1f}%" if drift != 0 else " 0.0%"
            lines.append(
                f"  {asset_class:<20}  target {target:.1f}%  current {current:.1f}%  "
                f"drift {drift_str}"
            )

    # ── Risk Metrics ───────────────────────────────────────────────────────────
    rm = ctx.risk_metrics
    beta_str = f"{rm.beta:.2f}" if rm.beta is not None else "N/A (no benchmark)"
    hhi_label = (
        "Well-diversified" if rm.hhi < 1500
        else "Moderately concentrated" if rm.hhi < 2500
        else "Highly concentrated"
    )
    lines.append("\nRisk Metrics (Quant Engine):")
    lines.append(f"  Sharpe Ratio         : {rm.sharpe_ratio:.4f}")
    lines.append(f"  Sortino Ratio        : {rm.sortino_ratio:.4f}")
    lines.append(f"  Beta (vs benchmark)  : {beta_str}")
    lines.append(f"  Max Drawdown         : {rm.max_drawdown_pct:.2f}%")
    lines.append(f"  Annual Volatility    : {rm.annual_volatility_pct:.2f}%")
    lines.append(f"  HHI Concentration   : {rm.hhi:.0f} ({hhi_label})")
    lines.append(f"  Diversification Score: {rm.diversification_score:.1f} / 100")

    return "\n".join(lines)


# ── Drift & Alert Detection ────────────────────────────────────────────────────


def detect_allocation_drift(ctx: PortfolioContext) -> list[SuggestedTradeAction]:
    """
    Rule-based engine that generates SuggestedTradeAction objects when:
      1. An asset class deviates from its target by more than DRIFT_THRESHOLD_PCT (5pp).
      2. A single holding exceeds CONCENTRATION_THRESHOLD_PCT (20%) of the portfolio.
      3. Sharpe Ratio is below 0.5 (poor risk-adjusted return profile).

    Returns an empty list when no target_allocation is set and no alerts are triggered.
    """
    actions: list[SuggestedTradeAction] = []

    # ── Rule 1: Allocation drift (requires target_allocation) ──────────────────
    if ctx.target_allocation:
        all_classes = set(ctx.asset_allocation) | set(ctx.target_allocation)
        for asset_class in sorted(all_classes):
            current = ctx.asset_allocation.get(asset_class, 0.0)
            target = ctx.target_allocation.get(asset_class, 0.0)
            drift = current - target

            if abs(drift) < DRIFT_THRESHOLD_PCT:
                continue

            action: str = "SELL" if drift > 0 else "BUY"
            drift_amount_inr = abs(drift / 100) * ctx.total_net_worth_inr
            rationale = (
                f"{asset_class} is {abs(drift):.1f}pp "
                f"{'over' if drift > 0 else 'under'}-weight vs. your "
                f"{target:.1f}% target (current: {current:.1f}%). "
                f"{'Reduce' if drift > 0 else 'Increase'} allocation by "
                f"approx. {format_inr(drift_amount_inr)} to restore target balance."
            )
            actions.append(
                SuggestedTradeAction(
                    action=action,  # type: ignore[arg-type]
                    asset_class=asset_class,
                    symbol=None,
                    rationale=rationale,
                    suggested_amount_inr=round(drift_amount_inr, 2),
                    target_weight_pct=target,
                    current_weight_pct=current,
                    drift_pct=round(drift, 2),
                )
            )

    # ── Rule 2: Single-holding concentration alert ─────────────────────────────
    for holding in ctx.holdings:
        if holding.weight_pct > CONCENTRATION_THRESHOLD_PCT:
            excess = holding.weight_pct - CONCENTRATION_THRESHOLD_PCT
            excess_inr = (excess / 100) * ctx.total_net_worth_inr
            actions.append(
                SuggestedTradeAction(
                    action="SELL",
                    asset_class=holding.asset_class,
                    symbol=holding.symbol,
                    rationale=(
                        f"{holding.name} ({holding.symbol}) represents "
                        f"{holding.weight_pct:.1f}% of your portfolio — "
                        f"{excess:.1f}pp above the 20% single-stock concentration limit. "
                        f"Consider trimming approx. {format_inr(excess_inr)} to reduce "
                        f"idiosyncratic risk."
                    ),
                    suggested_amount_inr=round(excess_inr, 2),
                    target_weight_pct=CONCENTRATION_THRESHOLD_PCT,
                    current_weight_pct=holding.weight_pct,
                    drift_pct=round(excess, 2),
                )
            )

    # ── Rule 3: Low Sharpe alert ───────────────────────────────────────────────
    if ctx.risk_metrics.sharpe_ratio < 0.5:
        actions.append(
            SuggestedTradeAction(
                action="REBALANCE",
                asset_class="Portfolio",
                symbol=None,
                rationale=(
                    f"Your portfolio's Sharpe Ratio is {ctx.risk_metrics.sharpe_ratio:.2f}, "
                    f"below the 0.5 threshold for acceptable risk-adjusted returns. "
                    f"Consider shifting allocation toward lower-volatility instruments "
                    f"(e.g. debt funds, liquid funds, or index ETFs) to improve "
                    f"risk-adjusted performance."
                ),
                suggested_amount_inr=None,
                target_weight_pct=None,
                current_weight_pct=None,
                drift_pct=None,
            )
        )

    logger.info(
        "Drift detection complete: portfolio_id=%s drift_actions=%d",
        ctx.portfolio_id,
        len(actions),
    )
    return actions


# ── System Prompt Builder ──────────────────────────────────────────────────────


def build_system_prompt(
    ctx: PortfolioContext,
    portfolio_summary: str,
    drift_actions: list[SuggestedTradeAction],
) -> str:
    """
    Construct the grounded LLM system prompt.

    The prompt contains:
    - Strict ground rules (no hallucination, INR formatting, SEBI disclaimer reminder)
    - The full portfolio summary block (verbatim numbers from PortfolioContext)
    - A formatted list of detected drift / alert actions
    - Instructions for how to handle out-of-context queries
    """
    drift_block = ""
    if drift_actions:
        drift_lines = []
        for i, action in enumerate(drift_actions, 1):
            symbol_part = f" [{action.symbol}]" if action.symbol else ""
            drift_lines.append(
                f"  {i}. [{action.action}]{symbol_part} {action.asset_class}: "
                f"{action.rationale}"
            )
        drift_block = "=== DETECTED DRIFT & ALERTS ===\n" + "\n".join(drift_lines)
    else:
        drift_block = (
            "=== DETECTED DRIFT & ALERTS ===\n"
            "  No significant allocation drift or risk alerts detected. "
            "Portfolio is within tolerance of target weights."
        )

    system_prompt = f"""You are Wealth Compass AI, an institutional-grade portfolio analytics assistant.

=== GROUND RULES (STRICTLY ENFORCED) ===
1. Answer ONLY using the numbers provided in the LIVE PORTFOLIO CONTEXT below.
   Do NOT fabricate, estimate, or extrapolate any figures not present in the context.
2. All monetary values MUST be expressed in INR using Indian numbering:
   - ≥ ₹1 Crore  → "₹X.XX Cr"  (e.g. ₹2.45 Cr)
   - ≥ ₹1 Lakh   → "₹X.XX L"   (e.g. ₹34.20 L)
   - Below 1 Lakh → "₹X,XXX"
3. You are NOT a SEBI-registered investment adviser. Never make specific buy/sell
   recommendations for individual securities. You may discuss portfolio-level
   allocation shifts and the detected drift alerts provided below.
4. If the user asks about a metric or holding not present in the context, respond:
   "That data is not available in your current portfolio snapshot."
5. Be concise, precise, and professional. Use bullet points for multi-item answers.
6. When referencing the DETECTED DRIFT & ALERTS, always state the exact INR amounts
   and percentage drifts from the context — never approximate them.

=== LIVE PORTFOLIO CONTEXT ===
{portfolio_summary}

{drift_block}

=== RESPONSE GUIDELINES ===
- Lead with the direct answer to the user's question.
- Reference specific numbers from the context (e.g. "Your Sharpe Ratio is 1.42").
- For rebalancing questions, reference the DETECTED DRIFT & ALERTS section above.
- End responses with a brief risk-awareness note where appropriate.
- Do NOT reproduce the SEBI disclaimer in your answer — it will be appended automatically.
"""
    return system_prompt


# ── Message Array Builder ──────────────────────────────────────────────────────


def build_messages(
    system_prompt: str,
    conversation_history: list[ConversationTurn],
    user_message: str,
) -> list[dict]:
    """
    Assemble the OpenAI-format messages array for the LLM chat call.

    Structure:
        [system]  ← grounded system prompt (always first)
        [user]    ← turn 1 from history
        [assistant] ← turn 2 from history
        …
        [user]    ← current user_message (always last)

    History is already capped at 10 turns by the Pydantic request validator.
    """
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    for turn in conversation_history:
        messages.append({"role": turn.role, "content": turn.content})

    messages.append({"role": "user", "content": user_message})
    return messages


# ── Context Sources Reporter ───────────────────────────────────────────────────


def get_context_sources(ctx: PortfolioContext, has_history: bool) -> list[str]:
    """Return a list of data source labels that were used to ground this response."""
    sources = ["live_holdings", "risk_metrics", "asset_allocation"]
    if ctx.target_allocation:
        sources.append("target_allocation")
    if has_history:
        sources.append("conversation_history")
    return sources
