"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Briefcase,
  RefreshCw,
  ChevronDown,
  Layers,
  PieChart,
  Activity,
  Info,
} from "lucide-react";
import Link from "next/link";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { AllocationDonutChart } from "@/components/charts/AllocationDonutChart";
import { CorrelationHeatmap } from "@/components/charts/CorrelationHeatmap";
import { formatCurrency } from "@/lib/utils";

interface PortfolioOption {
  id: string;
  name: string;
  currency: string;
  totalValue: number;
  isDefault: boolean;
}

interface RiskMetricItem {
  label: string;
  value: string;
  severity: "low" | "medium" | "high" | "neutral";
}

interface RiskData {
  portfolioId: string;
  portfolioName: string;
  totalValue: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  diversificationScore: number;
  annualVolatilityPct: number;
  var95_1d: number;
  cvar95_1d: number;
  maxDrawdownPct: number;
  hhi: number;
  effectiveN: number;
  topHoldingsConcentration: {
    top1Pct: number;
    top3Pct: number;
    top5Pct: number;
  };
  riskMetrics: RiskMetricItem[];
  allocationSlices: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  drawdownSeries: Array<{
    date: string;
    drawdownPct: number;
  }>;
  correlation: {
    assets: string[];
    matrix: number[][];
  };
}

function SeverityBadge({ s }: { s: "low" | "medium" | "high" | "neutral" }) {
  const map: Record<
    string,
    { variant: "success" | "warning" | "destructive" | "secondary"; label: string }
  > = {
    low: { variant: "success", label: "Low Risk" },
    medium: { variant: "warning", label: "Moderate" },
    high: { variant: "destructive", label: "High Risk" },
    neutral: { variant: "secondary", label: "—" },
  };
  const item = map[s] || map.neutral;
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export default function RiskPage() {
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

  // 2. Fetch live risk data for selected portfolio
  const {
    data: riskData,
    isLoading: riskLoading,
    isRefetching,
    refetch,
  } = useQuery<RiskData>({
    queryKey: ["portfolio-risk", selectedPortfolioId],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${selectedPortfolioId}/risk`);
      return (res as any).data ?? res.data;
    },
    enabled: !!selectedPortfolioId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const activePortfolio = portfolios.find((p) => p.id === selectedPortfolioId);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Risk Center</h2>
            <Badge
              variant="outline"
              className="gap-1.5 bg-primary/10 text-primary border-primary/20"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Live Risk Engine
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time Value at Risk (VaR), drawdown exposure, concentration, and asset correlation.
          </p>
        </div>

        {/* Portfolio Selector */}
        <div className="flex items-center gap-2.5">
          {portfoliosLoading ? (
            <Skeleton className="h-10 w-52" />
          ) : portfolios.length > 0 ? (
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
                <Briefcase className="h-4 w-4" />
              </div>
              <select
                id="risk-portfolio-select"
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
            disabled={riskLoading || isRefetching}
            title="Refresh risk metrics"
            className="h-10 w-10 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Portfolio Overview Strip */}
      {activePortfolio && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-gradient-to-r from-card via-card to-destructive/5 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                (riskData?.riskScore ?? 0) > 65
                  ? "bg-destructive/10 text-destructive"
                  : (riskData?.riskScore ?? 0) > 40
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-emerald-500/10 text-emerald-500"
              }`}
            >
              {(riskData?.riskScore ?? 0) > 65 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
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
              <span className="text-xs text-muted-foreground">Portfolio Value:</span>
              <p className="font-bold text-base">
                {formatCurrency(riskData?.totalValue ?? Number(activePortfolio.totalValue || 0))}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Risk Level:</span>
              <div className="mt-0.5">
                <SeverityBadge s={riskData?.riskLevel || "low"} />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Volatility (Annual):</span>
              <p className="font-bold text-base">{riskData?.annualVolatilityPct ?? 0}%</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Diversification:</span>
              <p className="font-bold text-base text-primary">
                {riskData?.diversificationScore ?? 0} / 100
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading or Empty State */}
      {riskLoading ? (
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <Skeleton className="h-[240px] w-full" />
            </Card>
            <Card className="p-6">
              <Skeleton className="h-[240px] w-full" />
            </Card>
          </div>
        </div>
      ) : !riskData || riskData.totalValue === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No assets found in this portfolio</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Connect a broker (Groww, Angel One, Zerodha) to evaluate real-time Value at Risk, asset
            correlation, and concentration metrics.
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
          {/* Risk metric summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {riskData.riskMetrics.map(({ label, value, severity }) => (
              <Card key={label} className="p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    {label}
                  </p>
                  <SeverityBadge s={severity} />
                </div>
                <p className="text-2xl font-bold tracking-tight">{value}</p>
              </Card>
            ))}
          </div>

          {/* Charts Row: Drawdown & Allocation */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Drawdown chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Historical Drawdown Profile</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    Max: {riskData.maxDrawdownPct.toFixed(2)}%
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Underwater drawdown tracking peak-to-trough decline over time
                </p>
              </CardHeader>
              <CardContent>
                <DrawdownChart data={riskData.drawdownSeries} height={240} />
              </CardContent>
            </Card>

            {/* Asset Allocation Donut */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Asset Allocation Split</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {riskData.allocationSlices.length} Asset Classes
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Portfolio capital distribution across Equities, Mutual Funds, Debt, and Cash
                </p>
              </CardHeader>
              <CardContent>
                <AllocationDonutChart
                  data={riskData.allocationSlices}
                  totalValue={riskData.totalValue}
                  currency="INR"
                  height={240}
                />
              </CardContent>
            </Card>
          </div>

          {/* Correlation Heatmap */}
          {riskData?.correlation?.assets?.length ? (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Asset Correlation Matrix</span>
                  <Badge variant="outline" className="text-xs">
                    {riskData.correlation.assets.length} Top Holdings
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Pairwise Pearson return correlation coefficients among your largest portfolio
                  positions
                </p>
              </CardHeader>
              <CardContent>
                <CorrelationHeatmap
                  data={{
                    assets: riskData.correlation.assets,
                    matrix: riskData.correlation.matrix ?? [],
                  }}
                  height={300}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Concentration Risk Analysis */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
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
                    {riskData.topHoldingsConcentration.top1Pct}% of your portfolio. SEBI
                    diversification guidelines recommend keeping individual stock exposures under
                    15–20% to avoid unsystematic volatility.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
