/**
 * Shared TypeScript types for the AI Portfolio Copilot.
 *
 * These mirror the Python Pydantic schemas in:
 *   services/analytics/app/schemas/copilot.py
 *
 * The NestJS API gateway proxies requests to the Python copilot service,
 * so all types here must remain in sync with the Python definitions.
 */

// ── Risk Metrics ──────────────────────────────────────────────────────────────

export interface RiskMetricsSnapshot {
  sharpe_ratio: number;
  sortino_ratio: number;
  beta: number | null;
  max_drawdown_pct: number;
  annual_volatility_pct: number;
  hhi: number;
  diversification_score: number;
}

// ── Holdings ──────────────────────────────────────────────────────────────────

export interface HoldingSnapshot {
  symbol: string;
  name: string;
  broker: string;
  quantity: number;
  avg_cost_inr: number;
  current_price_inr: number;
  market_value_inr: number;
  unrealized_pnl_inr: number;
  unrealized_pnl_pct: number;
  asset_class: string;
  weight_pct: number;
}

// ── Portfolio Context (the RAG payload) ───────────────────────────────────────

export interface PortfolioContextPayload {
  portfolio_id: string;
  total_net_worth_inr: number;
  holdings: HoldingSnapshot[];
  asset_allocation: Record<string, number>;
  target_allocation: Record<string, number> | null;
  risk_metrics: RiskMetricsSnapshot;
}

// ── Conversation ──────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

/** A single message in the chat thread (client-side representation). */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  /** Trade suggestions attached to an assistant message. */
  suggestedTrades?: SuggestedTradeAction[];
  /** Whether this is the currently-streaming message. */
  isStreaming?: boolean;
}

export interface ConversationTurn {
  role: MessageRole;
  content: string;
}

// ── Trade Suggestions ─────────────────────────────────────────────────────────

export type TradeAction = "BUY" | "SELL" | "HOLD" | "REBALANCE";

export interface SuggestedTradeAction {
  action: TradeAction;
  asset_class: string;
  symbol: string | null;
  rationale: string;
  suggested_amount_inr: number | null;
  target_weight_pct: number | null;
  current_weight_pct: number | null;
  drift_pct: number | null;
}

// ── API Request / Response ────────────────────────────────────────────────────

export interface CopilotChatRequest {
  user_message: string;
  portfolio_context: PortfolioContextPayload;
  conversation_history: ConversationTurn[];
}

export interface CopilotChatResponse {
  answer: string;
  suggested_trades: SuggestedTradeAction[];
  context_sources: string[];
  disclaimer: string;
  model_used: string;
  conversation_turn: number;
}

// ── Starter Prompts ───────────────────────────────────────────────────────────

export interface StarterPrompt {
  id: string;
  label: string;
  message: string;
  icon: string;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: "risk",
    label: "Analyse portfolio risk",
    message:
      "Analyze my overall portfolio risk. Include Sharpe Ratio, Max Drawdown, and Volatility in your analysis.",
    icon: "📊",
  },
  {
    id: "concentration",
    label: "Overconcentration check",
    message:
      "Where am I overconcentrated across brokers? Flag any single holding above 20% and suggest rebalancing.",
    icon: "⚠️",
  },
  {
    id: "tax",
    label: "Tax-saving trades",
    message:
      "Suggest tax-saving trades I should consider before 31st March based on my current allocation and unrealized losses.",
    icon: "💰",
  },
];

// ── Broker Deep-Link Map ──────────────────────────────────────────────────────

/** Maps broker identifiers to their trade/search URLs. */
export const BROKER_DEEP_LINKS: Record<string, { label: string; url: (symbol: string) => string }> =
  {
    ZERODHA: {
      label: "Open in Kite",
      url: (s) => `https://kite.zerodha.com/chart/ext/ciq/NSE/${s}`,
    },
    GROWW: {
      label: "Open in Groww",
      url: (s) => `https://groww.in/stocks/${s.toLowerCase()}`,
    },
    UPSTOX: {
      label: "Open in Upstox",
      url: (s) => `https://upstox.com/stocks/${s.toLowerCase()}/`,
    },
    DHAN: {
      label: "Open in Dhan",
      url: (s) => `https://web.dhan.co/stocks/${s}`,
    },
    COINDC_X: {
      label: "Open in CoinDCX",
      url: (s) => `https://coindcx.com/trade/${s}-INR`,
    },
  };
