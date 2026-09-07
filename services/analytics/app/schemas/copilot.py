"""
Pydantic schemas for POST /copilot/chat.

All monetary values are expressed in INR (Indian Rupees).
The caller (NestJS API gateway) constructs PortfolioContext from live DB data
and passes it in the request body — the copilot never queries any database.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Risk Metrics Snapshot ──────────────────────────────────────────────────────


class RiskMetricsSnapshot(BaseModel):
    """
    Point-in-time risk metric values computed by the Quant Engine.
    All ratio metrics are dimensionless; percentage metrics are expressed
    as percentage values (e.g. -18.3 means -18.3%).
    """

    sharpe_ratio: float = Field(
        ...,
        description=(
            "Annualised Sharpe Ratio (excess return / annualised volatility). "
            ">1.0 acceptable; >2.0 very good."
        ),
    )
    sortino_ratio: float = Field(
        ...,
        description=(
            "Annualised Sortino Ratio (excess return / downside deviation). "
            "Higher is better. +inf sentinel mapped to 9999.0."
        ),
    )
    beta: float | None = Field(
        default=None,
        description=(
            "Systematic risk coefficient vs benchmark (e.g. NIFTY 50). "
            "1.0 = mirrors market; >1.0 amplifies; <1.0 defensive. "
            "Null if no benchmark series provided."
        ),
    )
    max_drawdown_pct: float = Field(
        ...,
        description=(
            "Worst peak-to-trough portfolio loss as a percentage (≤ 0). "
            "E.g. -18.3 means the portfolio fell 18.3% from its highest point."
        ),
    )
    annual_volatility_pct: float = Field(
        ...,
        description="Annualised return volatility (σ_a = σ_d × √252) as a percentage.",
    )
    hhi: float = Field(
        ...,
        description=(
            "Herfindahl-Hirschman Index on the 10,000-point scale. "
            "<1500: diversified; 1500–2500: moderate; >2500: concentrated."
        ),
    )
    diversification_score: float = Field(
        ...,
        description="Composite 0–100 diversification score. >85 = excellent.",
    )


# ── Holding Snapshot ───────────────────────────────────────────────────────────


class HoldingSnapshot(BaseModel):
    """
    A single aggregated holding across all broker accounts.
    Represents one line item in the investor's full portfolio view.
    """

    symbol: str = Field(..., description="Ticker / ISIN / AMFI code / coin symbol.")
    name: str = Field(..., description="Full instrument / fund name.")
    broker: str = Field(
        ...,
        description=(
            "Source broker / platform (e.g. 'ZERODHA', 'GROWW', 'COINDC X', "
            "'CAMS_CAS', 'MANUAL')."
        ),
    )
    quantity: float = Field(..., description="Number of units / shares / coins held.")
    avg_cost_inr: float = Field(
        ..., description="Average cost per unit in INR at time of purchase."
    )
    current_price_inr: float = Field(
        ..., description="Latest market price per unit in INR."
    )
    market_value_inr: float = Field(
        ..., description="Total current market value in INR (quantity × current_price)."
    )
    unrealized_pnl_inr: float = Field(
        ...,
        description=(
            "Unrealized profit / loss in INR "
            "(market_value − quantity × avg_cost). Negative = loss."
        ),
    )
    unrealized_pnl_pct: float = Field(
        ...,
        description="Unrealized P&L as percentage of cost basis.",
    )
    asset_class: str = Field(
        ...,
        description=(
            "Asset class label: 'Equity', 'Mutual Funds', 'Crypto', "
            "'Fixed Income', 'Cash', 'Gold', 'Real Estate'."
        ),
    )
    weight_pct: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="This holding's percentage weight in the total portfolio (0–100).",
    )


# ── Portfolio Context (the RAG payload) ───────────────────────────────────────


class PortfolioContext(BaseModel):
    """
    Complete live portfolio snapshot injected by the NestJS API gateway.
    This is the sole source of truth for the copilot — it never fetches data
    independently. All numbers must be pre-validated by the caller.
    """

    portfolio_id: str = Field(..., description="UUID of the portfolio being analysed.")
    total_net_worth_inr: float = Field(
        ...,
        gt=0,
        description="Total portfolio market value in INR across all brokers.",
    )
    holdings: Annotated[
        list[HoldingSnapshot],
        Field(
            default_factory=list,
            description="All holdings sorted by market_value_inr descending.",
        ),
    ]
    asset_allocation: dict[str, float] = Field(
        ...,
        description=(
            "Current allocation percentages by asset class. "
            "Keys: asset class names; values: percentage (0–100). "
            "Must sum to 100 (±0.5 tolerance)."
        ),
    )
    target_allocation: dict[str, float] | None = Field(
        default=None,
        description=(
            "Investor's target allocation percentages by asset class. "
            "When provided, enables drift detection and rebalancing suggestions. "
            "Must sum to 100 (±0.5 tolerance)."
        ),
    )
    risk_metrics: RiskMetricsSnapshot = Field(
        ..., description="Latest risk metric snapshot from the Quant Engine."
    )

    @field_validator("asset_allocation", "target_allocation", mode="before")
    @classmethod
    def allocation_sums_to_100(
        cls, v: dict[str, float] | None
    ) -> dict[str, float] | None:
        """Allocation weights must sum to ~100%."""
        if v is None:
            return v
        total = sum(v.values())
        if abs(total - 100.0) > 0.5:
            raise ValueError(
                f"Allocation weights must sum to 100.0 (±0.5). Got {total:.4f}."
            )
        return v


# ── Conversation History ───────────────────────────────────────────────────────


class ConversationTurn(BaseModel):
    """A single turn in the multi-turn conversation history."""

    role: Literal["user", "assistant"] = Field(
        ..., description="Message author: 'user' or 'assistant'."
    )
    content: str = Field(
        ...,
        min_length=1,
        max_length=8192,
        description="Text content of this conversation turn.",
    )


# ── Request Model ──────────────────────────────────────────────────────────────


class CopilotQueryRequest(BaseModel):
    """
    Request body for POST /copilot/chat.

    The caller must supply the full live portfolio context alongside the user
    message. Conversation history (up to the last 10 turns) enables multi-turn
    contextual dialogue. History is managed client-side (stateless service).
    """

    user_message: str = Field(
        ...,
        min_length=1,
        max_length=4096,
        description="The investor's natural-language query or instruction.",
    )
    portfolio_context: PortfolioContext = Field(
        ...,
        description="Live portfolio snapshot used to ground the LLM response.",
    )
    conversation_history: list[ConversationTurn] = Field(
        default_factory=list,
        description=(
            "Ordered list of prior conversation turns (alternating user / assistant). "
            "The service uses the last 10 turns for context; older turns are silently dropped."
        ),
    )

    @model_validator(mode="after")
    def cap_conversation_history(self) -> "CopilotQueryRequest":
        """Keep only the most recent 10 turns to bound prompt token usage."""
        if len(self.conversation_history) > 10:
            self.conversation_history = self.conversation_history[-10:]
        return self


# ── Trade Suggestion ───────────────────────────────────────────────────────────


class SuggestedTradeAction(BaseModel):
    """
    A single actionable trade or rebalancing recommendation generated by the
    drift-detection rules engine. These are rule-derived, NOT LLM hallucinations.
    """

    action: Literal["BUY", "SELL", "HOLD", "REBALANCE"] = Field(
        ...,
        description=(
            "Suggested action type. "
            "'REBALANCE' indicates a general allocation shift without a specific instrument."
        ),
    )
    asset_class: str = Field(
        ..., description="Asset class this suggestion applies to."
    )
    symbol: str | None = Field(
        default=None,
        description=(
            "Specific instrument symbol / ticker if the suggestion targets one holding. "
            "Null for asset-class-level rebalancing suggestions."
        ),
    )
    rationale: str = Field(
        ...,
        description="Human-readable explanation grounded in the portfolio numbers.",
    )
    suggested_amount_inr: float | None = Field(
        default=None,
        description=(
            "Approximate INR amount to transact. "
            "Derived from drift × total net worth. Null for HOLD actions."
        ),
    )
    target_weight_pct: float | None = Field(
        default=None,
        description="Investor's target weight for this asset class (from target_allocation).",
    )
    current_weight_pct: float | None = Field(
        default=None,
        description="Current actual weight for this asset class.",
    )
    drift_pct: float | None = Field(
        default=None,
        description=(
            "Drift = current_weight_pct − target_weight_pct. "
            "Positive = over-weight; negative = under-weight."
        ),
    )


# ── Response Model ─────────────────────────────────────────────────────────────

SEBI_DISCLAIMER = (
    "⚠️ AI-generated portfolio analytics for educational purposes only. "
    "Not SEBI-registered investment advice. Past performance is not indicative "
    "of future results. Consult a SEBI-registered investment adviser before "
    "making any investment decisions."
)


class CopilotResponse(BaseModel):
    """
    Response from POST /copilot/chat.

    Every response is mathematically grounded in the caller-supplied portfolio
    context. The SEBI disclaimer is appended unconditionally at the router layer
    and cannot be suppressed by LLM output.
    """

    answer: str = Field(
        ...,
        description=(
            "The copilot's natural-language answer, grounded in live portfolio data. "
            "All monetary figures are expressed in INR (Lakhs / Crores)."
        ),
    )
    suggested_trades: list[SuggestedTradeAction] = Field(
        default_factory=list,
        description=(
            "Rule-derived trade / rebalancing suggestions. "
            "Empty list when no drift or risk alerts are detected."
        ),
    )
    context_sources: list[str] = Field(
        ...,
        description=(
            "Data sources used to ground this response. "
            "Possible values: 'live_holdings', 'risk_metrics', "
            "'asset_allocation', 'target_allocation', 'conversation_history'."
        ),
    )
    disclaimer: str = Field(
        default=SEBI_DISCLAIMER,
        description="Mandatory SEBI statutory disclaimer appended to every response.",
    )
    model_used: str = Field(
        ...,
        description=(
            "Identifier of the LLM model used (e.g. 'gemini-1.5-flash') "
            "or 'rule-based-fallback' when no API key is configured."
        ),
    )
    conversation_turn: int = Field(
        ...,
        ge=1,
        description=(
            "Sequential turn number in this conversation "
            "(1 = first message, increments with each exchange)."
        ),
    )
