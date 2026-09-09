"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
import { getBrokerConfig } from "@/lib/broker-config";
import { formatCurrency, formatPercent, classifyDelta, cn } from "@/lib/utils";
import {
  Plus,
  UploadCloud,
  Link2,
  TrendingUp,
  BarChart2,
  Layers,
  PieChart as PieIcon,
  ShieldCheck,
} from "lucide-react";

interface Holding {
  id: string;
  symbol: string;
  quantity: string | number;
  avgCostBasis: string | number;
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
  const id = params?.id as string;

  // Modals state
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [connectBrokerOpen, setConnectBrokerOpen] = useState(false);

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
  });

  // Fetch holdings
  const { data: holdingsData, isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: ["holdings", id],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${id}/holdings`);
      return (res as any).data ?? res.data ?? (Array.isArray(res) ? res : []);
    },
  });

  const holdings: Holding[] = Array.isArray(holdingsData) ? holdingsData : [];

  // Prepare Donut chart data for Platform Breakdown
  const platformDonutSlices: AllocationSlice[] = (summary?.platformBreakdown || []).map((p) => {
    const cfg = getBrokerConfig(p.providerCode);
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
            Import CSV
          </Button>

          <Button variant="outline" onClick={() => setConnectBrokerOpen(true)} className="gap-1.5">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Connect Broker
          </Button>
        </div>
      </div>

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
                const cfg = getBrokerConfig(plat.providerCode);
                const dir = classifyDelta(plat.pnlPct);
                return (
                  <div
                    key={plat.providerCode}
                    className="p-3.5 rounded-xl border bg-card/60 flex flex-col justify-between hover:shadow-sm transition-shadow"
                    style={{ borderColor: cfg.textColor + "40" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-1.5">
                        <span>{cfg.emoji}</span>
                        <span>{cfg.label}</span>
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: cfg.color, color: cfg.textColor }}
                      >
                        {plat.percentage.toFixed(1)}%
                      </span>
                    </div>

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
            <CardTitle className="text-base">All Assets Across Platforms</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any broker badge to open your position on that broker&apos;s site. Click the
              chart icon for real-time TradingView charts.
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
                    <th className="pb-3 text-right font-medium">Live Price</th>
                    <th className="pb-3 text-right font-medium">Current Value</th>
                    <th className="pb-3 text-right font-medium">Unrealised P&L</th>
                    <th className="pb-3 text-center font-medium">Live Chart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holdings.map((h) => {
                    const symbol = h.symbol || h.asset?.symbol || "UNKNOWN";
                    const name = h.asset?.name || symbol;
                    const exchange = h.asset?.exchange || "NSE";
                    const qty = Number(h.quantity || 0);
                    const avgCost = Number(h.avgCostBasis || 0);
                    const curPrice = Number(h.currentPrice || avgCost || 0);
                    const curValue = Number(h.currentValue || qty * curPrice);
                    const pnl = Number(h.unrealizedPnL || curValue - qty * avgCost);
                    const pnlPct = Number(
                      h.unrealizedPnLPct || (avgCost > 0 ? (pnl / (qty * avgCost)) * 100 : 0),
                    );
                    const dir = classifyDelta(pnlPct);
                    const providerCode =
                      h.providerAccount?.providerCode || (h.providerAccountId ? "GROWW" : "MANUAL");

                    return (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors group">
                        {/* Stock name & ticker */}
                        <td className="py-3.5 font-medium">
                          <div>
                            <span className="font-bold text-foreground">{symbol}</span>
                            <span className="text-xs text-muted-foreground block truncate max-w-[180px]">
                              {name !== symbol ? name : exchange}
                            </span>
                          </div>
                        </td>

                        {/* Platform Badge (Click opens broker) */}
                        <td className="py-3.5">
                          <PlatformBadge providerCode={providerCode} symbol={symbol} size="md" />
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 text-right tabular-nums text-foreground">
                          {qty.toLocaleString()}
                        </td>

                        {/* Avg Cost */}
                        <td className="py-3.5 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(avgCost)}
                        </td>

                        {/* Current Live Price */}
                        <td className="py-3.5 text-right tabular-nums font-semibold text-foreground">
                          {formatCurrency(curPrice)}
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
