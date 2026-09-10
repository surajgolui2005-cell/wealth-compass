"use client";

/**
 * useCopilotChat
 * ==============
 *
 * TanStack Query v5 mutation hook that handles the full copilot chat lifecycle:
 *
 *   1. Assembles a PortfolioContextPayload from TanStack Query cached data
 *      (from existing /portfolio and /risk API calls already in the app).
 *   2. Appends the user's message to the thread immediately (optimistic update).
 *   3. Adds a streaming placeholder assistant message.
 *   4. Calls POST /api/v1/copilot/chat (NestJS proxies to Python service).
 *   5. Replaces the placeholder with the real response including trade suggestions.
 *
 * Conversation history is read from and written to CopilotContext so it
 * persists across dashboard tab navigation.
 */

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "./nanoid";
import { copilotClient } from "@/lib/api-client";
import { useCopilotContext, toConversationHistory } from "@/context/CopilotContext";
import type {
  ChatMessage,
  CopilotChatRequest,
  CopilotChatResponse,
  PortfolioContextPayload,
} from "@/types/copilot";

// ── Minimal fallback portfolio context ────────────────────────────────────────
// Used when the TanStack Query cache has no portfolio data yet.
// The copilot will still respond — it just won't have real numbers.

const FALLBACK_CONTEXT: PortfolioContextPayload = {
  portfolio_id: "unknown",
  total_net_worth_inr: 0,
  holdings: [],
  asset_allocation: { Portfolio: 100 },
  target_allocation: null,
  risk_metrics: {
    sharpe_ratio: 0,
    sortino_ratio: 0,
    beta: null,
    max_drawdown_pct: 0,
    annual_volatility_pct: 0,
    hhi: 0,
    diversification_score: 0,
  },
};

// ── Portfolio context assembler ───────────────────────────────────────────────

function usePortfolioContext(): PortfolioContextPayload {
  const queryClient = useQueryClient();

  // Try to read from existing cached queries
  // These cache keys should match what the existing portfolio hooks use
  const portfolioSummary = queryClient.getQueryData<any>(["portfolio", "summary"]);
  const riskSummary = queryClient.getQueryData<any>(["risk", "summary"]);
  const allocation = queryClient.getQueryData<any>(["allocation", "breakdown"]);

  if (!portfolioSummary) return FALLBACK_CONTEXT;

  const holdings = (portfolioSummary.holdings ?? []).map((h: any) => ({
    symbol: h.symbol ?? h.ticker ?? "UNKNOWN",
    name: h.name ?? h.instrumentName ?? h.symbol ?? "Unknown",
    broker: h.broker ?? h.provider ?? "MANUAL",
    quantity: h.quantity ?? 0,
    avg_cost_inr: h.avgCostInr ?? h.averageCost ?? 0,
    current_price_inr: h.currentPriceInr ?? h.currentPrice ?? 0,
    market_value_inr: h.marketValueInr ?? h.marketValue ?? 0,
    unrealized_pnl_inr: h.unrealizedPnlInr ?? h.unrealizedPnl ?? 0,
    unrealized_pnl_pct: h.unrealizedPnlPct ?? 0,
    asset_class: h.assetClass ?? "Equity",
    weight_pct: h.weightPct ?? 0,
  }));

  const assetAllocation: Record<string, number> = {};
  if (allocation?.buckets) {
    for (const bucket of allocation.buckets) {
      assetAllocation[bucket.label] = bucket.percentage ?? 0;
    }
  } else {
    assetAllocation["Portfolio"] = 100;
  }

  return {
    portfolio_id: portfolioSummary.portfolioId ?? portfolioSummary.id ?? "default",
    total_net_worth_inr: portfolioSummary.totalNetWorthInr ?? portfolioSummary.totalValue ?? 0,
    holdings,
    asset_allocation: assetAllocation,
    target_allocation: portfolioSummary.targetAllocation ?? null,
    risk_metrics: riskSummary
      ? {
          sharpe_ratio: riskSummary.sharpeRatio ?? riskSummary.sharpe_ratio ?? 0,
          sortino_ratio: riskSummary.sortinoRatio ?? riskSummary.sortino_ratio ?? 0,
          beta: riskSummary.beta?.beta ?? riskSummary.beta ?? null,
          max_drawdown_pct:
            riskSummary.drawdown?.maxDrawdownPct ?? riskSummary.max_drawdown_pct ?? 0,
          annual_volatility_pct:
            riskSummary.annualVolatilityPct ?? riskSummary.annual_volatility_pct ?? 0,
          hhi: riskSummary.hhi ?? 0,
          diversification_score:
            riskSummary.diversificationScore ?? riskSummary.diversification_score ?? 0,
        }
      : FALLBACK_CONTEXT.risk_metrics,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseCopilotChatReturn {
  sendMessage: (userMessage: string) => void;
  isLoading: boolean;
  error: Error | null;
}

function generateSmartFallback(
  userMessage: string,
  context: PortfolioContextPayload,
): CopilotChatResponse {
  const q = userMessage.toLowerCase();

  if (q.includes("delete") && (q.includes("portfolio") || q.includes("portpolio"))) {
    return {
      answer:
        "To delete a portfolio:\n\n1. Go to **Portfolios** in the left sidebar.\n2. Click the **Trash (🗑️)** icon on any portfolio card, OR open the portfolio and click **Delete Portfolio** in the top-right header.\n3. Confirm the deletion in the popup box.",
      suggested_trades: [],
      context_sources: ["App Navigation Guide"],
      disclaimer: "SEBI Disclaimer: Portfolio operations are local user management actions.",
      model_used: "client-fallback-assistant",
      conversation_turn: 1,
    };
  }

  if (
    (q.includes("create") || q.includes("add") || q.includes("new")) &&
    (q.includes("portfolio") || q.includes("portpolio"))
  ) {
    return {
      answer:
        "To create a new portfolio:\n\n1. Go to **Portfolios** in the left sidebar.\n2. Click the **+ New Portfolio** button at the top-right.\n3. Enter your portfolio name, currency (INR/USD), and optional description, then click **Create**.",
      suggested_trades: [],
      context_sources: ["App Navigation Guide"],
      disclaimer: "SEBI Disclaimer: Educational guidance only.",
      model_used: "client-fallback-assistant",
      conversation_turn: 1,
    };
  }

  if (q.includes("asset") || q.includes("stock") || q.includes("buy") || q.includes("add")) {
    return {
      answer:
        "To add stocks or assets to your portfolio:\n\n1. Open your portfolio detail page.\n2. Click the **+ Add Asset** button in the header.\n3. Select your broker (Groww, Angel One, Zerodha, Upstox, etc.), ticker symbol, quantity, and buy price.\n4. Save to see your updated net worth and platform distribution!",
      suggested_trades: [],
      context_sources: ["App Navigation Guide"],
      disclaimer: "SEBI Disclaimer: Educational guidance only.",
      model_used: "client-fallback-assistant",
      conversation_turn: 1,
    };
  }

  if (q.includes("broker") || q.includes("groww") || q.includes("angel") || q.includes("connect")) {
    return {
      answer:
        "You can connect brokers (Groww, Angel One, Upstox, Zerodha) by clicking **Connect Broker** or **Import CSV** inside your portfolio page to automatically aggregate your multi-platform holdings.",
      suggested_trades: [],
      context_sources: ["Broker Integration Engine"],
      disclaimer: "SEBI Disclaimer: Educational guidance only.",
      model_used: "client-fallback-assistant",
      conversation_turn: 1,
    };
  }

  const netWorth = context.total_net_worth_inr
    ? `₹${context.total_net_worth_inr.toLocaleString()}`
    : "₹0";
  const holdingsCount = context.holdings ? context.holdings.length : 0;

  return {
    answer:
      `I am currently operating in smart offline mode.\n\n` +
      `📊 **Current Snapshot:** Net worth is **${netWorth}** across **${holdingsCount}** asset(s).\n\n` +
      `You can ask me how to create/delete portfolios, add assets from Groww or Angel One, or check your platform distribution!`,
    suggested_trades: [],
    context_sources: ["Local Portfolio Context"],
    disclaimer: "SEBI Disclaimer: Educational guidance only.",
    model_used: "client-fallback-assistant",
    conversation_turn: 1,
  };
}

export function useCopilotChat(): UseCopilotChatReturn {
  const { messages, addMessage, updateLastMessage } = useCopilotContext();
  const portfolioContext = usePortfolioContext();

  const mutation = useMutation<CopilotChatResponse, Error, string>({
    mutationFn: async (userMessage: string) => {
      const history = toConversationHistory(messages);
      const body: CopilotChatRequest = {
        user_message: userMessage,
        portfolio_context: portfolioContext,
        conversation_history: history,
      };
      try {
        const resp = await copilotClient.post<CopilotChatResponse>("/copilot/chat", body);
        return resp.data;
      } catch (err) {
        console.warn(
          "[CopilotChat] Python LLM service unavailable, using smart client fallback:",
          err,
        );
        return generateSmartFallback(userMessage, portfolioContext);
      }
    },

    onMutate: (userMessage: string) => {
      // 1. Append the user message immediately
      const userMsg: ChatMessage = {
        id: nanoid(),
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      };
      addMessage(userMsg);

      // 2. Append a typing-indicator placeholder
      const placeholder: ChatMessage = {
        id: nanoid(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };
      addMessage(placeholder);
    },

    onSuccess: (data: CopilotChatResponse) => {
      // Replace the streaming placeholder with the real response
      updateLastMessage((prev) => ({
        ...prev,
        content: data.answer,
        suggestedTrades: data.suggested_trades,
        isStreaming: false,
        timestamp: new Date(),
      }));
    },

    onError: (error: Error) => {
      const fallback = generateSmartFallback("help", portfolioContext);
      updateLastMessage((prev) => ({
        ...prev,
        content: fallback.answer,
        isStreaming: false,
        timestamp: new Date(),
      }));
      console.error("[CopilotChat] API error:", error);
    },
  });

  const sendMessage = useCallback(
    (userMessage: string) => {
      if (!userMessage.trim() || mutation.isPending) return;
      mutation.mutate(userMessage.trim());
    },
    [mutation],
  );

  return {
    sendMessage,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
