"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Search,
  Info,
  RefreshCw,
  ExternalLink,
  Activity,
  Layers,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface StockChartModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string; // e.g. "RELIANCE", "INFY", "INF174K01LS2", "WIPRO LTD"
  exchange?: string; // e.g. "NSE", "BSE", "BINANCE"
  name?: string;
}

interface ChartPoint {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface HistoryResponse {
  symbol: string;
  resolvedSymbol: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  range: string;
  interval: string;
  points: ChartPoint[];
}

const TIMEFRAMES = [
  { label: "5D", range: "5d", interval: "15m" },
  { label: "1M", range: "1mo", interval: "1d" },
  { label: "6M", range: "6mo", interval: "1d" },
  { label: "1Y", range: "1y", interval: "1d" },
  { label: "5Y", range: "5y", interval: "1wk" },
];

// Known ISIN & Statement Name to TradingView Symbol mappings
const KNOWN_BENCHMARK_MAPPINGS: Record<string, { displaySym: string; note?: string }> = {
  INF174K01LS2: {
    displaySym: "NIFTY_MIDCAP",
    note: "Mutual Funds trade at daily NAV. Showing Midcap benchmark.",
  },
  INF209K01157: {
    displaySym: "NIFTY 50",
    note: "Mutual Funds trade at daily NAV. Showing Nifty 50 benchmark.",
  },
  INF769K01HG5: {
    displaySym: "NIFTY 50",
    note: "Mutual Funds trade at daily NAV. Showing Nifty 50 benchmark.",
  },
  INF846K01EW2: {
    displaySym: "NIFTY 50",
    note: "Mutual Funds trade at daily NAV. Showing Nifty 50 benchmark.",
  },
  INF109K01Y60: {
    displaySym: "NIFTY 50",
    note: "Mutual Funds trade at daily NAV. Showing Nifty 50 benchmark.",
  },
  INF200K01UT4: {
    displaySym: "NIFTY_SMALLCAP",
    note: "Mutual Funds trade at daily NAV. Showing Smallcap benchmark.",
  },
  "TATAAML-TATAGOLD": {
    displaySym: "GOLDBEES",
    note: "Showing Gold ETF (GOLDBEES) chart.",
  },
  TATAGOLD: { displaySym: "GOLDBEES", note: "Showing Gold ETF (GOLDBEES) chart." },
  "TATAAML-TATSILV": {
    displaySym: "SILVERBEES",
    note: "Showing Silver ETF (SILVERBEES) chart.",
  },
  TATSILV: { displaySym: "SILVERBEES", note: "Showing Silver ETF (SILVERBEES) chart." },
  "BILLIONBRAINS GARAGE VN L": {
    displaySym: "NIFTY 50",
    note: "Unlisted private entity (Groww parent). Displaying Nifty 50 benchmark chart.",
  },
  BILLIONBRAINS: {
    displaySym: "NIFTY 50",
    note: "Unlisted private entity (Groww parent). Displaying Nifty 50 benchmark chart.",
  },
  GROWW: {
    displaySym: "NIFTY 50",
    note: "Unlisted private entity (Groww parent). Displaying Nifty 50 benchmark chart.",
  },
};

function formatCurrency(val: number | undefined, currency = "INR") {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency === "INR" ? "INR" : "USD",
    maximumFractionDigits: 2,
  }).format(val);
}

function formatVolume(val: number | undefined) {
  if (!val) return "0";
  if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
  return val.toLocaleString("en-IN");
}

export function StockChartModal({
  open,
  onClose,
  symbol,
  exchange = "NSE",
  name,
}: StockChartModalProps) {
  const [activeSymbol, setActiveSymbol] = useState(symbol || "");
  const [activeTimeframe, setActiveTimeframe] = useState(TIMEFRAMES[1]); // Default 1M (index 1)
  const [chartMode, setChartMode] = useState<"area" | "candle">("area");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<HistoryResponse | null>(null);

  // Benchmarking notes
  const note = useMemo(() => {
    const cleanSym = (activeSymbol || "").toUpperCase();
    const cleanName = (name || "").toUpperCase();
    if (KNOWN_BENCHMARK_MAPPINGS[cleanSym]?.note) return KNOWN_BENCHMARK_MAPPINGS[cleanSym].note;
    if (KNOWN_BENCHMARK_MAPPINGS[cleanName]?.note) return KNOWN_BENCHMARK_MAPPINGS[cleanName].note;
    for (const [key, val] of Object.entries(KNOWN_BENCHMARK_MAPPINGS)) {
      if (cleanSym.includes(key) || cleanName.includes(key)) {
        return val.note;
      }
    }
    return undefined;
  }, [activeSymbol, name]);

  // Sync state when props change
  useEffect(() => {
    if (symbol) {
      setActiveSymbol(symbol);
      setSearchQuery("");
    }
  }, [symbol]);

  // Fetch Historical Chart Data
  useEffect(() => {
    if (!open || !activeSymbol) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .get<HistoryResponse>(
        `/market-data/history?symbol=${encodeURIComponent(activeSymbol)}&range=${activeTimeframe.range}&interval=${activeTimeframe.interval}`,
      )
      .then((res) => {
        if (isMounted) {
          setChartData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              `Failed to load chart data for ${activeSymbol}. Try searching another ticker.`,
          );
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, activeSymbol, activeTimeframe]);

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveSymbol(searchQuery.trim().toUpperCase());
  };

  const handleSelectQuickSymbol = (sym: string) => {
    setActiveSymbol(sym);
  };

  const isPositive = (chartData?.change ?? 0) >= 0;
  const strokeColor = isPositive ? "#10b981" : "#ef4444";
  const fillColor = isPositive ? "#10b981" : "#ef4444";

  // Calculate min & max for better chart scaling
  const { minPrice, maxPrice } = useMemo(() => {
    if (!chartData?.points || chartData.points.length === 0) {
      return { minPrice: 0, maxPrice: 100 };
    }
    const prices = chartData.points.map((p) => p.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05 || max * 0.02;
    return {
      minPrice: Math.max(0, Math.floor(min - padding)),
      maxPrice: Math.ceil(max + padding),
    };
  }, [chartData]);

  // TradingView Symbol for external platform redirection
  const tvExternalSymbol = useMemo(() => {
    let s = (activeSymbol || "").toUpperCase();
    if (s.endsWith(".NS")) s = `NSE:${s.replace(".NS", "")}`;
    else if (s.endsWith(".BO")) s = `BSE:${s.replace(".BO", "")}`;
    else if (!s.includes(":")) s = `NSE:${s}`;
    return s;
  }, [activeSymbol]);

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden rounded-2xl bg-card border border-border/60 shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight">
                  <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate max-w-[280px] sm:max-w-md">{name ?? activeSymbol}</span>
                </DialogTitle>
                <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
                  {chartData?.resolvedSymbol || activeSymbol}
                </Badge>
                {exchange && (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-semibold text-muted-foreground"
                  >
                    {exchange}
                  </Badge>
                )}
              </div>

              {/* Price & Change Banner */}
              {chartData && (
                <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {formatCurrency(chartData.currentPrice, chartData.currency)}
                  </span>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md",
                      isPositive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 stroke-[2.5]" />
                    )}
                    <span>
                      {isPositive ? "+" : ""}
                      {formatCurrency(chartData.change, chartData.currency)} (
                      {isPositive ? "+" : ""}
                      {chartData.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Prev Close: {formatCurrency(chartData.previousClose, chartData.currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions & Search */}
            <div className="flex items-center gap-2 pr-6">
              <form onSubmit={handleCustomSearch} className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search e.g. RELIANCE, TCS"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-2 text-xs w-40 sm:w-48 rounded-lg font-mono bg-background"
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" className="h-8 text-xs px-2.5">
                  Load
                </Button>
              </form>

              <a
                href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvExternalSymbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted/80 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all shadow-xs"
                title="Open interactive chart in full screen on TradingView.com"
              >
                <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                <span className="hidden sm:inline font-medium">TradingView</span>
              </a>
            </div>
          </div>

          {/* Mutual Fund or Benchmark Notification */}
          {note && (
            <div className="mt-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs flex items-center justify-between text-blue-800 dark:text-blue-300">
              <div className="flex items-center gap-1.5">
                <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>{note}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-[10px] text-muted-foreground">Quick Switch:</span>
                <button
                  type="button"
                  onClick={() => handleSelectQuickSymbol("NSE:NIFTY")}
                  className="px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-[10px] font-semibold transition-colors"
                >
                  Nifty 50
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectQuickSymbol("GOLDBEES")}
                  className="px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-[10px] font-semibold transition-colors"
                >
                  Gold ETF
                </button>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Toolbar: Timeframe Selector & Stats */}
        <div className="px-4 sm:px-5 py-2.5 bg-muted/10 border-b border-border/30 flex flex-wrap items-center justify-between gap-2">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/40">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.label}
                type="button"
                onClick={() => setActiveTimeframe(tf)}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  activeTimeframe.label === tf.label
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Quick Key Stats Bar */}
          {chartData && (
            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
              {chartData.regularMarketDayHigh && chartData.regularMarketDayLow && (
                <div>
                  <span className="text-[10px] text-muted-foreground/70 uppercase">Day Range:</span>{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(chartData.regularMarketDayLow)} -{" "}
                    {formatCurrency(chartData.regularMarketDayHigh)}
                  </span>
                </div>
              )}
              {chartData.fiftyTwoWeekHigh && chartData.fiftyTwoWeekLow && (
                <div>
                  <span className="text-[10px] text-muted-foreground/70 uppercase">52W Range:</span>{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(chartData.fiftyTwoWeekLow)} -{" "}
                    {formatCurrency(chartData.fiftyTwoWeekHigh)}
                  </span>
                </div>
              )}
              {chartData.regularMarketVolume && (
                <div>
                  <span className="text-[10px] text-muted-foreground/70 uppercase">Vol:</span>{" "}
                  <span className="font-semibold text-foreground">
                    {formatVolume(chartData.regularMarketVolume)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive In-App Chart Area */}
        <div className="relative w-full p-4 sm:p-5" style={{ height: "460px" }}>
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/75 backdrop-blur-xs">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs font-medium">
                  Fetching historical chart for {activeSymbol}…
                </span>
              </div>
            </div>
          )}

          {error ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{error}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try searching for another symbol like RELIANCE, TCS, or INFY.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSymbol("RELIANCE")}
                  className="text-xs"
                >
                  Try RELIANCE
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSymbol("WIPRO")}
                  className="text-xs"
                >
                  Try WIPRO
                </Button>
              </div>
            </div>
          ) : chartData && chartData.points.length > 0 ? (
            <div className="h-full w-full flex flex-col">
              {/* Main Price Area Chart */}
              <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData.points}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={fillColor} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={fillColor} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground, #888)" }}
                      minTickGap={30}
                    />
                    <YAxis
                      domain={[minPrice, maxPrice]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground, #888)" }}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload as ChartPoint;
                        const pointChange = data.close - (chartData.previousClose || data.open);
                        const pointChangePct = chartData.previousClose
                          ? (pointChange / chartData.previousClose) * 100
                          : 0;

                        return (
                          <div className="bg-popover/95 backdrop-blur-md border border-border shadow-xl rounded-xl p-3 text-xs min-w-[160px] font-sans">
                            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                              {data.time}
                            </div>
                            <div className="text-base font-extrabold text-foreground mb-2">
                              {formatCurrency(data.close, chartData.currency)}
                              <span
                                className={cn(
                                  "ml-1.5 text-xs font-semibold",
                                  pointChange >= 0 ? "text-emerald-500" : "text-rose-500",
                                )}
                              >
                                {pointChange >= 0 ? "+" : ""}
                                {pointChangePct.toFixed(2)}%
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] border-t border-border/50 pt-1.5 text-muted-foreground">
                              <div>
                                <span>Open: </span>
                                <span className="font-semibold text-foreground">{data.open}</span>
                              </div>
                              <div>
                                <span>High: </span>
                                <span className="font-semibold text-foreground">{data.high}</span>
                              </div>
                              <div>
                                <span>Low: </span>
                                <span className="font-semibold text-foreground">{data.low}</span>
                              </div>
                              <div>
                                <span>Vol: </span>
                                <span className="font-semibold text-foreground">
                                  {formatVolume(data.volume)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      y={chartData.previousClose}
                      stroke="#888888"
                      strokeDasharray="3 3"
                      strokeOpacity={0.4}
                    />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#chartGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Volume Subplot */}
              <div className="h-16 w-full mt-1 border-t border-border/20 pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.points}
                    margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
                  >
                    <YAxis hide />
                    <Bar dataKey="volume" fill={fillColor} opacity={0.35} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No historical data points found for this timeframe.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-5 bg-muted/20 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Yahoo Finance Live Exchange Feed</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
