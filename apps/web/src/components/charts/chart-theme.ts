/**
 * chart-theme.ts
 * ─────────────────────────────────────────────────────
 * Shared color palette, formatter utilities, and dark-mode
 * detection used by all chart components.
 */

// ── Color palette ─────────────────────────────────────────────────────────────
export const CHART_COLORS = {
  primary: "#005A9C", // Royal Blue (Reliability, Confidence)
  navy: "#003B7A", // Deep Navy (Trust, Stability)
  sky: "#0080C8", // Sky Blue (Innovation, Clarity)
  teal: "#00A99D", // Teal (Growth, Balance)
  mint: "#6DD5A3", // Mint Green (Progress, Prosperity)
  darkTeal: "#008B75", // Dark Teal (Success, Wealth)
  charcoal: "#2D3E50", // Charcoal (Readability)
  success: "#00A99D", // Brand Teal
  warning: "#f59e0b", // Amber
  destructive: "#ef4444", // Red
  muted: "#94a3b8", // Slate
  purple: "#7c3aed",
  orange: "#ea580c",
  pink: "#db2777",
  indigo: "#4f46e5",
} as const;

/** Ordered sequence for multi-series charts matching brand identity */
export const COLOR_SEQUENCE = [
  CHART_COLORS.primary, // Royal Blue #005A9C
  CHART_COLORS.teal, // Teal #00A99D
  CHART_COLORS.sky, // Sky Blue #0080C8
  CHART_COLORS.mint, // Mint Green #6DD5A3
  CHART_COLORS.navy, // Deep Navy #003B7A
  CHART_COLORS.darkTeal, // Dark Teal #008B75
  CHART_COLORS.warning,
  CHART_COLORS.purple,
];

// ── Formatter utilities ───────────────────────────────────────────────────────

/**
 * Compact INR axis label (e.g. ₹1.2L, ₹4.5Cr, ₹500)
 */
export function formatAxisCurrency(value: number, currency = "INR"): string {
  if (isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currency === "INR" ? "₹" : "$";

  if (abs >= 1_00_00_000) return `${sign}${symbol}${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${sign}${symbol}${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

/**
 * Full-precision INR tooltip value (e.g. ₹1,23,456.78)
 */
export function formatTooltipCurrency(value: number, currency = "INR"): string {
  if (isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Percent axis label (e.g. +4.5%, -2.1%)
 */
export function formatAxisPercent(value: number, decimals = 1): string {
  if (isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Short date label for axis ticks (e.g. "4 Sep")
 */
export function formatAxisDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
      new Date(dateStr),
    );
  } catch {
    return dateStr;
  }
}

/**
 * Full date for tooltips (e.g. "4 Sep 2026")
 */
export function formatTooltipDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ── Heatmap color scale (correlation: -1 → +1) ───────────────────────────────
export function correlationToColor(value: number): string {
  // Red (-1) → White (0) → Blue (+1)
  const clamped = Math.max(-1, Math.min(1, value));
  if (clamped < 0) {
    const t = -clamped;
    const r = Math.round(255);
    const g = Math.round(255 * (1 - t));
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }
  const t = clamped;
  const r = Math.round(255 * (1 - t));
  const g = Math.round(255 * (1 - t));
  const b = Math.round(255);
  return `rgb(${r},${g},${b})`;
}

// ── Tooltip shared styles ─────────────────────────────────────────────────────
export const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
  padding: "8px 12px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
};

export const GRID_STYLE = {
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 3",
};

export const AXIS_STYLE = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
};
