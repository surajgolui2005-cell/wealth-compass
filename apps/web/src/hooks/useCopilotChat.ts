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
      const resp = await copilotClient.post<CopilotChatResponse>("/copilot/chat", body);
      return resp.data;
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
      updateLastMessage((prev) => ({
        ...prev,
        content:
          "⚠️ I encountered an error fetching your portfolio analysis. Please try again in a moment.",
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
