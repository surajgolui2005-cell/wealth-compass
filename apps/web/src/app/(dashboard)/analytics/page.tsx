"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart2,
  Briefcase,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { BenchmarkComparisonChart } from "@/components/charts/BenchmarkComparisonChart";
import { formatCurrency } from "@/lib/utils";

interface PortfolioOption {
  id: string;
  name: string;
  currency: string;
  totalValue: number;
  isDefault: boolean;
}

interface AnalyticsData {
  portfolioId: string;
  portfolioName: string;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  holdingsCount: number;
  metrics: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  equityCurve: Array<{
    date: string;
    value: number;
  }>;
  benchmarkComparison: Array<{
    date: string;
    portfolio: number;
    benchmark: number;
  }>;
  topGainers: Array<{
    id: string;
    symbol: string;
    name: string;
    assetClass: string;
    broker: string;
    value: number;
    cost: number;
    pnl: number;
    pnlPct: number;
    weightPct: number;
  }>;
  topLosers: Array<{
    id: string;
    symbol: string;
    name: string;
    assetClass: string;
    broker: string;
    value: number;
    cost: number;
    pnl: number;
    pnlPct: number;
    weightPct: number;
  }>;
}

export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");

  // 1. Fetch user's portfolios
  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery<PortfolioOption[]>({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const res = await apiClient.get("/portfolios");
      return (res as any).data ?? res.data ?? (Array.isArray(res) ? res : []);
    },
  });

  // Default to the first or default portfolio
  useEffect(() => {
    if (portfolios.length > 0 && !selectedPortfolioId) {
      const defaultPort = portfolios.find((p) => p.isDefault) || portfolios[0];
      if (defaultPort) {
        setSelectedPortfolioId(defaultPort.id);
      }
    }
  }, [portfolios, selectedPortfolioId]);

  // 2. Fetch live analytics for selected portfolio
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isRefetching,
    refetch,
  } = useQuery<AnalyticsData>({
    queryKey: ["portfolio-analytics", selectedPortfolioId],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${selectedPortfolioId}/analytics`);
      return (res as any).data ?? res.data;
    },
    enabled: !!selectedPortfolioId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const activePortfolio = portfolios.find((p) => p.id === selectedPortfolioId);
  const isPnlPositive = (analytics?.totalPnl ?? 0) >= 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Performance Analytics</h2>
            <Badge
              variant="outline"
              className="gap-1.5 bg-primary/10 text-primary border-primary/20"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Live Quant Engine
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time returns, risk-adjusted ratios, equity curve, and benchmark tracking.
          </p>
        </div>

        {/* Portfolio Switcher Dropdown */}
        <div className="flex items-center gap-2.5">
          {portfoliosLoading ? (
            <Skeleton className="h-10 w-52" />
          ) : portfolios.length > 0 ? (
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
                <Briefcase className="h-4 w-4" />
              </div>
              <select
                id="analytics-portfolio-select"
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                className="h-10 appearance-none rounded-lg border bg-card pl-9 pr-9 text-sm font-medium shadow-sm transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isDefault ? "★" : ""} ({formatCurrency(Number(p.totalValue || 0))})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 flex items-center text-muted-foreground">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          ) : null}

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={analyticsLoading || isRefetching}
            title="Refresh analytics data"
            className="h-10 w-10 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Portfolio Quick Overview Banner */}
      {activePortfolio && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-gradient-to-r from-card via-card to-primary/5 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Portfolio
              </p>
              <h3 className="text-lg font-bold">{activePortfolio.name}</h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Total Value:</span>
              <p className="font-bold text-base">
                {formatCurrency(analytics?.totalValue ?? Number(activePortfolio.totalValue || 0))}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Invested Cost:</span>
              <p className="font-semibold text-base">{formatCurrency(analytics?.totalCost ?? 0)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Unrealized P&L:</span>
              <p
                className={`font-bold text-base flex items-center gap-1 ${isPnlPositive ? "text-emerald-500" : "text-rose-500"}`}
              >
                {isPnlPositive ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {formatCurrency(analytics?.totalPnl ?? 0)} ({isPnlPositive ? "+" : ""}
                {(analytics?.totalPnlPct ?? 0).toFixed(2)}%)
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Holdings Count:</span>
              <p className="font-semibold text-base">{analytics?.holdingsCount ?? 0} Assets</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton or Empty State */}
      {analyticsLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-8 w-36 mb-1" />
                <Skeleton className="h-3 w-44" />
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <Skeleton className="h-[280px] w-full" />
          </Card>
        </div>
      ) : !analytics || analytics.holdingsCount === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Layers className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No assets found in this portfolio</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Connect a broker (Groww, Angel One, Zerodha) or add manual holdings to view live
            returns, equity curves, and Sharpe ratios.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={selectedPortfolioId ? `/portfolios/${selectedPortfolioId}` : "/portfolios"}>
              <Button className="bg-primary text-primary-foreground gap-1.5">
                <Briefcase className="h-4 w-4" />
                Manage Portfolio & Connect Broker
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.metrics.map(({ label, value, description }) => {
              const isPositive = value.startsWith("+");
              const isNegative = value.startsWith("-");
              return (
                <Card key={label} className="p-5 transition-shadow hover:shadow-md">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                    {label}
                  </p>
                  <p
                    className={`text-2xl font-bold tracking-tight ${
                      isPositive
                        ? "text-emerald-500"
                        : isNegative
                          ? "text-rose-500"
                          : "text-foreground"
                    }`}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </Card>
              );
            })}
          </div>

          {/* Equity curve */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  Portfolio Equity Curve (INR)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time equity valuation trajectory based on current asset holdings
                </p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                Current: {formatCurrency(analytics.totalValue)}
              </Badge>
            </CardHeader>
            <CardContent>
              <EquityCurveChart data={analytics.equityCurve} currency="INR" height={280} />
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
                  Benchmark-relative performance comparison against market indices
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-blue-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Portfolio ({analytics.totalPnlPct.toFixed(1)}%)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-amber-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  NIFTY 50 (+12.5%)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <BenchmarkComparisonChart
                data={analytics.benchmarkComparison}
                portfolioLabel={activePortfolio?.name || "My Portfolio"}
                benchmarkLabel="NIFTY 50"
                height={280}
              />
            </CardContent>
          </Card>

          {/* Top Performance Movers */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Gainers */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-emerald-500">
                  <TrendingUp className="h-4 w-4" />
                  Top Performing Holdings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.topGainers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No gainers recorded yet.</p>
                ) : (
                  analytics.topGainers.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b pb-2.5 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-semibold">{item.symbol}</p>
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

            {/* Top Laggards */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-500">
                  <TrendingDown className="h-4 w-4" />
                  Holdings Lagging or Drawdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.topLosers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No holdings in loss.</p>
                ) : (
                  analytics.topLosers.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b pb-2.5 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-semibold">{item.symbol}</p>
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
        </>
      )}
    </div>
  );
}
