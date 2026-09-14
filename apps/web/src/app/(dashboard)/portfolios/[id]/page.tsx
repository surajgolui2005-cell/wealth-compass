"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLivePrices } from "@/hooks/useLivePrices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { PlatformBadge } from "@/components/portfolio/PlatformBadge";
import { StockChartModal } from "@/components/portfolio/StockChartModal";
import { AddTransactionModal } from "@/components/portfolio/AddTransactionModal";
import { ConnectPlatformModal } from "@/components/portfolio/ConnectPlatformModal";
import { ImportCsvModal } from "@/components/portfolio/ImportCsvModal";
import { AllocationDonutChart, AllocationSlice } from "@/components/charts/AllocationDonutChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { BenchmarkComparisonChart } from "@/components/charts/BenchmarkComparisonChart";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { getBrokerConfig } from "@/lib/broker-config";
import { formatCurrency, formatPercent, classifyDelta, cn } from "@/lib/utils";
import {
  Plus,
  UploadCloud,
  Link2,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Layers,
  PieChart as PieIcon,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  X,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface Holding {
  id: string;
  symbol: string;
  quantity: string | number;
  avgCostBasis: string | number;
  buyValue?: string | number;
  currentPrice: string | number;
  currentValue: string | number;
  unrealizedPnL: string | number;
  unrealizedPnLPct: string | number;
  providerAccountId?: string;
  providerAccount?: {
    id: string;
    providerCode: string;
    accountName: string;
  };
  asset?: {
    id: string;
    symbol: string;
    name: string;
    exchange?: string;
    assetClass?: {
      code: string;
      name: string;
    };
  };
}

interface PortfolioSummary {
  id: string;
  name: string;
  currency: string;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  holdingsCount: number;
  platformBreakdown: Array<{
    providerAccountId: string | null;
    providerCode: string;
    accountName: string;
    totalValue: number;
    totalCost: number;
    pnl: number;
    pnlPct: number;
    count: number;
    percentage: number;
  }>;
  assetClassBreakdown: Array<{
    code: string;
    name: string;
    totalValue: number;
    count: number;
    percentage: number;
  }>;
}

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  // Modals state
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [connectBrokerOpen, setConnectBrokerOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  // Track which platform account (account ID or 'MANUAL') is pending removal confirmation
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"holdings" | "analytics" | "risk">("holdings");

  const removePlatformMutation = useMutation({
    mutationFn: (platformKey: string) => {
      if (platformKey === "MANUAL") {
        return apiClient.delete(`/portfolios/${id}/manual-holdings`);
      }
      return apiClient.delete(`/providers/accounts/${platformKey}`);
    },
    onSuccess: () => {
      setConfirmRemoveKey(null);
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-risk"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/portfolios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      router.push("/portfolios");
    },
  });

  // Live Chart modal state
  const [selectedStockForChart, setSelectedStockForChart] = useState<{
    symbol: string;
    name?: string;
    exchange?: string;
  } | null>(null);

  // Fetch summary (aggregates multi-platform data)
  const { data: summary, isLoading: summaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ["portfolio-summary", id],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${id}/summary`);
      return (res as any).data ?? res.data ?? res;
    },
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch live analytics for this portfolio
  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["portfolio-analytics", id],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${id}/analytics`);
      return (res as any).data ?? res.data;
    },
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch live risk for this portfolio
  const { data: riskData, isLoading: riskLoading } = useQuery<any>({
    queryKey: ["portfolio-risk", id],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${id}/risk`);
      return (res as any).data ?? res.data;
    },
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch holdings
  const { data: holdingsData, isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ["holdings", id],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${id}/holdings`);
      return (res as any).data ?? res.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const holdings: Holding[] = Array.isArray(holdingsData) ? holdingsData : [];

  // Extract all asset tickers / symbols to poll live prices
  const holdingSymbols = useMemo(() => {
    return holdings.map((h: any) => h.asset?.symbol || h.symbol || h.asset?.name).filter(Boolean);
  }, [holdings]);

  // Real-time live prices polling hook (every 5s during active tab view)
  const { getQuoteForSymbol, isMarketOpen, isLive, lastUpdated, ticks } = useLivePrices(
    holdingSymbols,
    { intervalMs: 5000, enabled: holdings.length > 0 },
  );

  // Helper: resolve the display config from accountName or providerCode
  const resolvePlatformConfig = (providerCode: string, accountName: string) => {
    const prefix = accountName ? accountName.split(" (via ")[0].split(" (")[0].trim() : "";
    const candidate = prefix || providerCode;
    const cfg = getBrokerConfig(candidate);
    if (cfg.label !== "Manual Entry" && cfg.label !== "RBI AA") {
      return { ...cfg, label: prefix || cfg.label, shortLabel: prefix || cfg.shortLabel };
    }
    if (providerCode === "RBI_AA") {
      return {
        ...getBrokerConfig("RBI_AA"),
        label: prefix || accountName || "RBI AA",
        shortLabel: prefix || "RBI AA",
      };
    }
    return getBrokerConfig(providerCode);
  };

  // Prepare Donut chart data for Platform Breakdown
  const platformDonutSlices: AllocationSlice[] = (summary?.platformBreakdown || []).map((p) => {
    const cfg = resolvePlatformConfig(p.providerCode, p.accountName);
    return {
      name: cfg.shortLabel,
      value: p.totalValue,
      color: cfg.textColor,
    };
  });

  // Prepare Donut chart data for Asset Class Breakdown
  const assetClassDonutSlices: AllocationSlice[] = (summary?.assetClassBreakdown || []).map(
    (ac) => ({
      name: ac.name,
      value: ac.totalValue,
    }),
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {summaryLoading ? (
              <Skeleton className="h-8 w-48 inline-block" />
            ) : (
              summary?.name || "My Portfolio"
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unified multi-platform portfolio across Groww, Angel One, Zerodha & more.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setAddTxOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>

          <Button variant="outline" onClick={() => setImportCsvOpen(true)} className="gap-1.5">
            <UploadCloud className="h-4 w-4 text-muted-foreground" />
            Import CSV / Excel
          </Button>

          <Button variant="outline" onClick={() => setConnectBrokerOpen(true)} className="gap-1.5">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Connect Broker
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowConfirmDelete(true)}
            className="gap-1.5 text-rose-600 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="h-4 w-4" />
            Delete Portfolio
          </Button>
        </div>
      </div>

      {showConfirmDelete && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
          <div>
            <p className="font-semibold text-rose-500 text-sm">
              Are you sure you want to delete this portfolio?
            </p>
            <p className="text-xs text-muted-foreground">
              All holdings and transactions in this portfolio will be removed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Confirm Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Portfolio Value"
          value={summary?.totalValue ?? 0}
          isCurrency
          currency={summary?.currency || "INR"}
          isLoading={summaryLoading}
        />
        <StatCard
          label="Total Unrealised P&L"
          value={formatCurrency(summary?.totalPnl ?? 0, summary?.currency || "INR")}
          delta={summary?.totalPnlPct}
          isLoading={summaryLoading}
        />
        <StatCard
          label="Total Assets"
          value={summary?.holdingsCount ?? holdings.length}
          isLoading={summaryLoading || holdingsLoading}
        />
        <StatCard
          label="Connected Brokers"
          value={(summary?.platformBreakdown || []).length || 1}
          isLoading={summaryLoading}
        />
      </div>

      {/* Portfolio Views Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <button
          onClick={() => setActiveTab("holdings")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer",
            activeTab === "holdings"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <Layers className="h-4 w-4" />
          Holdings & Platforms ({holdings.length})
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer",
            activeTab === "analytics"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <BarChart2 className="h-4 w-4" />
          Performance & Analytics
        </button>

        <button
          onClick={() => setActiveTab("risk")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer",
            activeTab === "risk"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          Risk Center
        </button>
      </div>

      {/* ── TAB 1: HOLDINGS & PLATFORMS ─────────────────────── */}
      {activeTab === "holdings" && (
        <div className="space-y-6">
          {/* Multi-Platform Breakdown Bar / Cards */}
          {summary?.platformBreakdown && summary.platformBreakdown.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Platform Balances & Aggregation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {summary.platformBreakdown.map((plat) => {
                    const cfg = resolvePlatformConfig(plat.providerCode, plat.accountName);
                    const dir = classifyDelta(plat.pnlPct);
                    const platformKey = plat.providerAccountId || "MANUAL";
                    const isConfirming =
                      Boolean(confirmRemoveKey) && confirmRemoveKey === platformKey;
                    const isRemoving = removePlatformMutation.isPending && isConfirming;
                    return (
                      <div
                        key={plat.accountName || plat.providerCode || platformKey}
                        className="p-3.5 rounded-xl border bg-card/60 flex flex-col justify-between hover:shadow-sm transition-shadow relative group"
                        style={{ borderColor: isConfirming ? "#e63946" : cfg.textColor + "40" }}
                      >
                        {/* Header row: broker name + % badge + remove X button */}
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm flex items-center gap-1.5">
                            <span>{cfg.emoji}</span>
                            <span>{cfg.label}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: cfg.color, color: cfg.textColor }}
                            >
                              {plat.percentage.toFixed(1)}%
                            </span>
                            {!isConfirming && (
                              <button
                                onClick={() => setConfirmRemoveKey(platformKey)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-muted-foreground hover:text-rose-600 cursor-pointer"
                                title={`Remove ${cfg.label} and all its assets`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline confirm removal */}
                        {isConfirming && (
                          <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
                            <div className="flex items-center gap-1.5 text-rose-600 text-xs font-medium mb-2">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              Remove {cfg.label} and all {plat.count} asset(s)?
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => removePlatformMutation.mutate(platformKey)}
                                disabled={isRemoving}
                                className="flex-1 text-xs py-1 px-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium disabled:opacity-60 transition-colors cursor-pointer"
                              >
                                {isRemoving ? "Removing…" : "Confirm"}
                              </button>
                              <button
                                onClick={() => setConfirmRemoveKey(null)}
                                disabled={isRemoving}
                                className="flex-1 text-xs py-1 px-2 rounded border border-border hover:bg-muted text-muted-foreground font-medium disabled:opacity-60 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-2.5">
                          <p className="text-lg font-bold tabular-nums">
                            {formatCurrency(plat.totalValue, summary.currency)}
                          </p>
                          <div className="flex items-center justify-between text-xs mt-0.5">
                            <span className="text-muted-foreground">
                              {plat.count} {plat.count === 1 ? "asset" : "assets"}
                            </span>
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                dir === "positive"
                                  ? "text-emerald-600"
                                  : dir === "negative"
                                    ? "text-rose-600"
                                    : "",
                              )}
                            >
                              {plat.pnl >= 0 ? "+" : ""}
                              {formatCurrency(plat.pnl)} ({formatPercent(plat.pnlPct)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Allocation Charts Section */}
          {holdings.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Platform Breakdown Donut */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieIcon className="h-4 w-4 text-blue-600" />
                    Broker / Platform Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AllocationDonutChart
                    data={platformDonutSlices}
                    totalValue={summary?.totalValue}
                    currency={summary?.currency || "INR"}
                    height={260}
                    isLoading={summaryLoading}
                  />
                </CardContent>
              </Card>

              {/* Asset Class Breakdown Donut */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    Asset Class Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AllocationDonutChart
                    data={
                      assetClassDonutSlices.length > 0
                        ? assetClassDonutSlices
                        : [{ name: "Equities", value: summary?.totalValue || 100 }]
                    }
                    totalValue={summary?.totalValue}
                    currency={summary?.currency || "INR"}
                    height={260}
                    isLoading={summaryLoading}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Unified Holdings Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">All Assets Across Platforms</CardTitle>
                  {isLive && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border shadow-xs transition-all",
                        isMarketOpen
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-slate-100 text-slate-700 border-slate-300",
                      )}
                    >
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isMarketOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
                        )}
                      />
                      {isMarketOpen ? "LIVE FEED (NSE/BSE)" : "MARKET CLOSED (LTP)"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any broker badge to open your position on that broker&apos;s site. Click the
                  chart icon for real-time TradingView charts.
                  {lastUpdated && (
                    <span className="ml-1 text-muted-foreground/80 font-mono">
                      • Ticks active ({lastUpdated.toLocaleTimeString()})
                    </span>
                  )}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {holdings.length} {holdings.length === 1 ? "Holding" : "Holdings"}
              </Badge>
            </CardHeader>
            <CardContent>
              {holdingsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : holdings.length === 0 ? (
                <EmptyState
                  title="No assets added yet"
                  description="Click '+ Add Asset' to record a stock you bought on Groww, Angel One, or Zerodha."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="pb-3 text-left font-medium">Asset / Ticker</th>
                        <th className="pb-3 text-left font-medium">Platform</th>
                        <th className="pb-3 text-right font-medium">Qty</th>
                        <th className="pb-3 text-right font-medium">Avg Buy Price</th>
                        <th className="pb-3 text-right font-medium">Buy value</th>
                        <th className="pb-3 text-right font-medium">Live Price</th>
                        <th className="pb-3 text-right font-medium">Current Value</th>
                        <th className="pb-3 text-right font-medium">Unrealised P&L</th>
                        <th className="pb-3 text-center font-medium">Live Chart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {holdings.map((h: any) => {
                        const symbol = h.symbol || h.asset?.symbol || "UNKNOWN";
                        const name = h.asset?.name || symbol;
                        const exchange = h.asset?.exchange || "NSE";
                        const rawQty = h.quantity ?? h.qty ?? h.units ?? 0;
                        const qty = Number(rawQty) || 0;
                        const rawAvg =
                          h.avgCostBasis ?? h.avg_cost_basis ?? h.avgPrice ?? h.buyPrice ?? 0;
                        const avgCost = Number(rawAvg) || 0;
                        const rawBuyVal = h.buyValue ?? h.buy_value ?? qty * avgCost;
                        const buyValue = Number(rawBuyVal) || qty * avgCost;

                        // Real-time live quote matching via Yahoo Finance adapter
                        const liveQuote =
                          getQuoteForSymbol(symbol) ||
                          getQuoteForSymbol(name) ||
                          getQuoteForSymbol(h.asset?.symbol || "");

                        const rawPrice =
                          liveQuote && liveQuote.price > 0
                            ? liveQuote.price
                            : (h.currentPrice ??
                              h.current_price ??
                              h.livePrice ??
                              h.price ??
                              (avgCost || 0));
                        const curPrice = Number(rawPrice) || avgCost;

                        const tick = liveQuote?.symbol
                          ? ticks[liveQuote.symbol.toUpperCase()]
                          : ticks[symbol.toUpperCase()] || null;

                        const rawVal =
                          liveQuote && liveQuote.price > 0
                            ? qty * curPrice
                            : (h.currentValue ?? h.current_value ?? qty * curPrice);
                        const curValue = Number(rawVal) || qty * curPrice;

                        const rawPnl =
                          liveQuote && liveQuote.price > 0
                            ? curValue - buyValue
                            : (h.unrealizedPnL ?? h.unrealized_pnl ?? curValue - buyValue);
                        const pnl = Number(rawPnl) || 0;
                        const rawPnlPct = buyValue > 0 ? (pnl / buyValue) * 100 : 0;
                        const pnlPct = Number(rawPnlPct) || 0;
                        const dir = classifyDelta(pnlPct);
                        const providerCode =
                          h.providerAccount?.providerCode ||
                          (h.providerAccountId ? "OTHER" : "MANUAL");
                        const accountName = h.providerAccount?.accountName || "";
                        // Extract specific broker code/alias from accountName or providerCode
                        const displayCode = (() => {
                          if (accountName) {
                            const prefix = accountName.split(" (via ")[0].split(" (")[0].trim();
                            if (prefix) return prefix;
                          }
                          return providerCode;
                        })();

                        return (
                          <tr key={h.id} className="hover:bg-muted/30 transition-colors group">
                            {/* Stock name & ticker */}
                            <td className="py-3.5 font-medium">
                              <div>
                                <span className="font-bold text-foreground">
                                  {symbol.startsWith("INE") || symbol.startsWith("INF")
                                    ? name !== symbol
                                      ? name
                                      : symbol
                                    : symbol}
                                </span>
                                <span className="text-xs text-muted-foreground block truncate max-w-[180px]">
                                  {symbol.startsWith("INE") || symbol.startsWith("INF")
                                    ? symbol
                                    : name !== symbol
                                      ? name
                                      : exchange}
                                </span>
                              </div>
                            </td>

                            {/* Platform Badge (Click opens broker) */}
                            <td className="py-3.5">
                              <PlatformBadge providerCode={displayCode} symbol={symbol} size="md" />
                            </td>

                            {/* Quantity */}
                            <td className="py-3.5 text-right tabular-nums text-foreground">
                              {qty > 0 ? qty.toLocaleString() : "—"}
                            </td>

                            {/* Avg Cost */}
                            <td className="py-3.5 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(avgCost)}
                            </td>

                            {/* Buy Value */}
                            <td className="py-3.5 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(buyValue)}
                            </td>

                            {/* Current Live Price with Dynamic Tick Animation */}
                            <td className="py-3.5 text-right tabular-nums font-semibold">
                              <div className="flex items-center justify-end gap-1.5">
                                {tick === "up" && (
                                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                )}
                                {tick === "down" && (
                                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                )}
                                <span
                                  className={cn(
                                    "transition-colors duration-500 text-foreground",
                                    tick === "up"
                                      ? "text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-sm"
                                      : tick === "down"
                                        ? "text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded-sm"
                                        : "",
                                  )}
                                >
                                  {formatCurrency(curPrice)}
                                </span>
                              </div>
                            </td>

                            {/* Current Value */}
                            <td className="py-3.5 text-right tabular-nums font-bold text-foreground">
                              {formatCurrency(curValue)}
                            </td>

                            {/* P&L */}
                            <td className="py-3.5 text-right tabular-nums">
                              <div
                                className={cn(
                                  "font-semibold",
                                  dir === "positive"
                                    ? "text-emerald-600"
                                    : dir === "negative"
                                      ? "text-rose-600"
                                      : "text-muted-foreground",
                                )}
                              >
                                {pnl >= 0 ? "+" : ""}
                                {formatCurrency(pnl)}
                              </div>
                              <div
                                className={cn(
                                  "text-xs font-medium",
                                  dir === "positive"
                                    ? "text-emerald-600"
                                    : dir === "negative"
                                      ? "text-rose-600"
                                      : "text-muted-foreground",
                                )}
                              >
                                {formatPercent(pnlPct)}
                              </div>
                            </td>

                            {/* Live Chart Button */}
                            <td className="py-3.5 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full hover:bg-blue-50 hover:text-blue-600"
                                onClick={() => setSelectedStockForChart({ symbol, name, exchange })}
                                title="Open TradingView Live Chart"
                              >
                                <TrendingUp className="h-4 w-4 text-blue-600" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 2: PERFORMANCE & ANALYTICS ────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Performance metric cards */}
          {analyticsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-8 w-36" />
                </Card>
              ))}
            </div>
          ) : analytics?.metrics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.metrics.map(({ label, value, description }: any) => (
                <Card key={label} className="p-5 shadow-sm hover:shadow transition-shadow">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {label}
                  </p>
                  <p
                    className={`text-2xl font-bold tracking-tight ${
                      value.startsWith("+")
                        ? "text-emerald-500"
                        : value.startsWith("-")
                          ? "text-rose-500"
                          : "text-foreground"
                    }`}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </Card>
              ))}
            </div>
          ) : null}

          {/* Equity curve */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  Portfolio Equity Curve (INR)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live valuation trajectory scaled to your current portfolio value
                </p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                Current: {formatCurrency(summary?.totalValue ?? 0)}
              </Badge>
            </CardHeader>
            <CardContent>
              <EquityCurveChart
                data={analytics?.equityCurve || []}
                currency="INR"
                height={260}
                isLoading={analyticsLoading}
              />
            </CardContent>
          </Card>

          {/* Benchmark comparison */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  Portfolio vs NIFTY 50 (Cumulative Return %)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Benchmark-relative return comparison against market indices
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-blue-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  {summary?.name || "Portfolio"} (
                  {(analytics?.benchmarkComparison?.length
                    ? (analytics.benchmarkComparison[analytics.benchmarkComparison.length - 1]
                        ?.portfolio ??
                      summary?.totalPnlPct ??
                      0)
                    : (summary?.totalPnlPct ?? 0)) >= 0
                    ? "+"
                    : ""}
                  {(analytics?.benchmarkComparison?.length
                    ? (analytics.benchmarkComparison[analytics.benchmarkComparison.length - 1]
                        ?.portfolio ??
                      summary?.totalPnlPct ??
                      0)
                    : (summary?.totalPnlPct ?? 0)
                  ).toFixed(1)}
                  %)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-amber-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  NIFTY 50 (
                  {(analytics?.benchmarkComparison?.length
                    ? (analytics.benchmarkComparison[analytics.benchmarkComparison.length - 1]
                        ?.benchmark ?? 3.4)
                    : 3.4) >= 0
                    ? "+"
                    : ""}
                  {(analytics?.benchmarkComparison?.length
                    ? (analytics.benchmarkComparison[analytics.benchmarkComparison.length - 1]
                        ?.benchmark ?? 3.4)
                    : 3.4
                  ).toFixed(1)}
                  %)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <BenchmarkComparisonChart
                data={analytics?.benchmarkComparison || []}
                portfolioLabel={summary?.name || "My Portfolio"}
                benchmarkLabel="NIFTY 50"
                height={260}
                isLoading={analyticsLoading}
              />
            </CardContent>
          </Card>

          {/* Top Gainers & Losers */}
          {analytics && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-emerald-500">
                    <TrendingUp className="h-4 w-4" />
                    Top Performing Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(analytics.topGainers || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No gainers recorded yet.</p>
                  ) : (
                    (analytics.topGainers || []).map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between border-b pb-2.5 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-semibold">{item.name || item.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.broker} • {item.weightPct}% of portfolio
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-500">
                            +{item.pnlPct.toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.value)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-500">
                    <TrendingDown className="h-4 w-4" />
                    Holdings Lagging or Drawdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(analytics.topLosers || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No holdings in loss.</p>
                  ) : (
                    (analytics.topLosers || []).map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between border-b pb-2.5 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-semibold">{item.name || item.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.broker} • {item.weightPct}% of portfolio
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${
                              item.pnlPct >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {item.pnlPct >= 0 ? "+" : ""}
                            {item.pnlPct.toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.value)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: RISK CENTER ─────────────────────────────── */}
      {activeTab === "risk" && (
        <div className="space-y-6">
          {/* Risk metric summary cards */}
          {riskLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-8 w-36" />
                </Card>
              ))}
            </div>
          ) : riskData?.riskMetrics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {riskData.riskMetrics.map(({ label, value, severity }: any) => {
                const badgeVariant =
                  severity === "high"
                    ? "destructive"
                    : severity === "medium"
                      ? "warning"
                      : "success";
                const badgeLabel =
                  severity === "high"
                    ? "High Risk"
                    : severity === "medium"
                      ? "Moderate"
                      : "Low Risk";
                return (
                  <Card key={label} className="p-5 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <Badge variant={badgeVariant as any}>{badgeLabel}</Badge>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">{value}</p>
                  </Card>
                );
              })}
            </div>
          ) : null}

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Drawdown chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Historical Drawdown Profile</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    Max: {(riskData?.maxDrawdownPct ?? 0).toFixed(2)}%
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Underwater peak-to-trough decline over time
                </p>
              </CardHeader>
              <CardContent>
                <DrawdownChart
                  data={riskData?.drawdownSeries || []}
                  height={240}
                  isLoading={riskLoading}
                />
              </CardContent>
            </Card>

            {/* Asset Allocation Donut */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Asset Allocation Split</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {(riskData?.allocationSlices || []).length} Asset Classes
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Capital distribution across asset classes
                </p>
              </CardHeader>
              <CardContent>
                <AllocationDonutChart
                  data={riskData?.allocationSlices || []}
                  totalValue={summary?.totalValue}
                  currency="INR"
                  height={240}
                  isLoading={riskLoading}
                />
              </CardContent>
            </Card>
          </div>

          {/* Correlation Heatmap */}
          {riskData?.correlation && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Asset Correlation Matrix</span>
                  <Badge variant="outline" className="text-xs">
                    {riskData.correlation.assets?.length ?? 0} Top Holdings
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Pairwise return correlation between your largest distinct positions
                </p>
              </CardHeader>
              <CardContent>
                <CorrelationHeatmap
                  data={riskData.correlation || { assets: [], matrix: [] }}
                  height={280}
                  isLoading={riskLoading}
                />
              </CardContent>
            </Card>
          )}

          {/* Concentration Risk Analysis */}
          {riskData?.topHoldingsConcentration && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-primary" />
                  Concentration & Diversification Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4 bg-card/50">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Top 1 Asset
                    </p>
                    <p className="text-xl font-bold mt-1">
                      {riskData.topHoldingsConcentration.top1Pct}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {riskData.topHoldingsConcentration.top1Pct > 25
                        ? "High single-stock exposure"
                        : "Balanced single-asset weight"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 bg-card/50">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Top 3 Assets
                    </p>
                    <p className="text-xl font-bold mt-1">
                      {riskData.topHoldingsConcentration.top3Pct}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Cumulative Top-3 weight</p>
                  </div>
                  <div className="rounded-lg border p-4 bg-card/50">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Effective N
                    </p>
                    <p className="text-xl font-bold mt-1 text-primary">{riskData.effectiveN}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Equal-weight equivalent size
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 bg-card/50">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      HHI Index
                    </p>
                    <p className="text-xl font-bold mt-1">{riskData.hhi}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {riskData.hhi > 2500 ? "Concentrated (>2,500)" : "Diversified (<2,500)"}
                    </p>
                  </div>
                </div>

                {riskData.topHoldingsConcentration.top1Pct > 20 && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      <strong>Concentration Alert:</strong> Your largest position accounts for{" "}
                      {riskData.topHoldingsConcentration.top1Pct}% of this portfolio. Keeping
                      individual stock exposures under 15–20% reduces unsystematic risk.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <AddTransactionModal open={addTxOpen} onClose={() => setAddTxOpen(false)} portfolioId={id} />

      <ImportCsvModal
        open={importCsvOpen}
        onClose={() => setImportCsvOpen(false)}
        portfolioId={id}
      />

      <ConnectPlatformModal
        open={connectBrokerOpen}
        onClose={() => setConnectBrokerOpen(false)}
        portfolioId={id}
      />

      {/* TradingView Live Chart Modal */}
      {selectedStockForChart && (
        <StockChartModal
          open={Boolean(selectedStockForChart)}
          onClose={() => setSelectedStockForChart(null)}
          symbol={selectedStockForChart.symbol}
          name={selectedStockForChart.name}
          exchange={selectedStockForChart.exchange || "NSE"}
        />
      )}
    </div>
  );
}
