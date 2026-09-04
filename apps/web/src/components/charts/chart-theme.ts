/**
 * chart-theme.ts
 * ─────────────────────────────────────────────────────
 * Shared color palette, formatter utilities, and dark-mode
 * detection used by all chart components.
 */

// ── Color palette ─────────────────────────────────────────────────────────────
export const CHART_COLORS = {
  primary: '#3b82f6',      // blue-500
  success: '#22c55e',      // green-500
  warning: '#f59e0b',      // amber-500
  destructive: '#ef4444',  // red-500
  muted: '#94a3b8',        // slate-400
  purple: '#a855f7',
  orange: '#f97316',
  teal: '#14b8a6',
  pink: '#ec4899',
  indigo: '#6366f1',
} as const;

/** Ordered sequence for multi-series charts */
export const COLOR_SEQUENCE = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.teal,
  CHART_COLORS.pink,
  CHART_COLORS.indigo,
];

// ── Formatter utilities ───────────────────────────────────────────────────────

/**
 * Compact INR axis label (e.g. ₹1.2L, ₹4.5Cr, ₹500)
 */
export function formatAxisCurrency(value: number, currency = 'INR'): string {
  if (isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const symbol = currency === 'INR' ? '₹' : '$';

  if (abs >= 1_00_00_000) return `${sign}${symbol}${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${sign}${symbol}${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

/**
 * Full-precision INR tooltip value (e.g. ₹1,23,456.78)
 */
export function formatTooltipCurrency(value: number, currency = 'INR'): string {
  if (isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Percent axis label (e.g. +4.5%, -2.1%)
 */
export function formatAxisPercent(value: number, decimals = 1): string {
  if (isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Short date label for axis ticks (e.g. "4 Sep")
 */
export function formatAxisDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
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
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(dateStr),
    );
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
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
  padding: '8px 12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
};

export const GRID_STYLE = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '3 3',
};

export const AXIS_STYLE = {
  fontSize: 11,
  fill: 'hsl(var(--muted-foreground))',
};
