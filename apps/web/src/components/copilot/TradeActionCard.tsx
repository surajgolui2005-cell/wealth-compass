"use client";

/**
 * TradeActionCard
 * ===============
 *
 * Renders a single SuggestedTradeAction as a compact card with:
 * - Colour-coded action badge (BUY / SELL / REBALANCE / HOLD)
 * - Asset class & symbol
 * - Rationale text
 * - INR amount formatted in Lakhs / Crores
 * - One-click broker deep-link buttons
 */

import { ExternalLink } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { SuggestedTradeAction } from "@/types/copilot";
import { BROKER_DEEP_LINKS } from "@/types/copilot";

// ── Action colour map ─────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  BUY: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  SELL: {
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  REBALANCE: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  HOLD: {
    bg: "bg-slate-50 dark:bg-slate-800/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700",
  },
};

// ── Broker buttons ────────────────────────────────────────────────────────────

const QUICK_BROKERS = ["ZERODHA", "GROWW", "UPSTOX"] as const;

interface BrokerButtonProps {
  broker: string;
  symbol: string;
}

function BrokerButton({ broker, symbol }: BrokerButtonProps) {
  const def = BROKER_DEEP_LINKS[broker];
  if (!def || !symbol) return null;
  return (
    <a
      href={def.url(symbol)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
    >
      {def.label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

// ── INR compact formatter (Lakhs / Crores) ────────────────────────────────────

function formatInrCompact(amount: number): string {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
  return formatCurrency(amount, "INR");
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TradeActionCardProps {
  trade: SuggestedTradeAction;
}

export function TradeActionCard({ trade }: TradeActionCardProps) {
  const style = ACTION_STYLES[trade.action] ?? ACTION_STYLES.HOLD;

  return (
    <div className={cn("rounded-lg border p-3 text-sm space-y-2 mt-2", style.bg, style.border)}>
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
            style.text,
          )}
        >
          {trade.action}
        </span>
        <span className="font-semibold text-foreground">{trade.symbol ?? trade.asset_class}</span>
        {trade.symbol && trade.symbol !== trade.asset_class && (
          <span className="text-muted-foreground text-xs">{trade.asset_class}</span>
        )}
        {trade.drift_pct !== null && (
          <span className="ml-auto text-xs text-muted-foreground">
            Drift:{" "}
            <span className={trade.drift_pct > 0 ? "text-red-500" : "text-emerald-500"}>
              {trade.drift_pct > 0 ? "+" : ""}
              {trade.drift_pct.toFixed(1)}pp
            </span>
          </span>
        )}
      </div>

      {/* Rationale */}
      <p className="text-xs text-foreground/80 leading-relaxed">{trade.rationale}</p>

      {/* Amount & weights */}
      {trade.suggested_amount_inr !== null && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>
            Suggested:{" "}
            <span className="font-semibold text-foreground">
              {formatInrCompact(trade.suggested_amount_inr)}
            </span>
          </span>
          {trade.current_weight_pct !== null && (
            <span>
              Current: <strong>{trade.current_weight_pct.toFixed(1)}%</strong>
            </span>
          )}
          {trade.target_weight_pct !== null && (
            <span>
              Target: <strong>{trade.target_weight_pct.toFixed(1)}%</strong>
            </span>
          )}
        </div>
      )}

      {/* Broker deep-link buttons */}
      {trade.symbol && (
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          {QUICK_BROKERS.map((broker) => (
            <BrokerButton key={broker} broker={broker} symbol={trade.symbol!} />
          ))}
        </div>
      )}
    </div>
  );
}
