"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Activity, Plus, TrendingUp, Layers, ShieldCheck, Bell } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getBrokerConfig, CONNECTABLE_BROKERS } from "@/lib/broker-config";

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  totalValue: number | string;
  isDefault: boolean;
  _count?: { holdings: number };
}

export default function DashboardPage() {
  const { data: portfolios = [], isLoading } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const res = await apiClient.get("/portfolios");
      return (res as any).data ?? res.data ?? (Array.isArray(res) ? res : []);
    },
  });

  const totalValue = portfolios.reduce((sum, p) => sum + Number(p.totalValue || 0), 0);

  const totalHoldings = portfolios.reduce((sum, p) => sum + Number(p._count?.holdings || 0), 0);

  const defaultPortfolio = portfolios.find((p) => p.isDefault) || portfolios[0];

  const quickLinks = [
    {
      href: defaultPortfolio ? `/portfolios/${defaultPortfolio.id}` : "/portfolios",
      label: "Portfolio Holdings",
      description: "View assets tagged by Groww, Angel One & Zerodha",
      icon: Layers,
    },
    {
      href: "/analytics",
      label: "Performance Analytics",
      description: "Track XIRR, Sharpe ratio & benchmark comparison",
      icon: TrendingUp,
    },
    {
      href: "/risk",
      label: "Risk Center",
      description: "Value at Risk (VaR), Drawdown & Volatility",
      icon: ShieldCheck,
    },
    {
      href: "/alerts",
      label: "Alert Rules",
      description: "Configure real-time price & volatility alerts",
      icon: Bell,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Unified Investment Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregated real-time monitoring across all your broker accounts.
          </p>
        </div>

        {defaultPortfolio && (
          <Link href={`/portfolios/${defaultPortfolio.id}`}>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Manage Assets
            </Button>
          </Link>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Portfolio Value"
          value={totalValue}
          isCurrency
          currency="INR"
          isLoading={isLoading}
        />
        <StatCard label="Active Portfolios" value={portfolios.length} isLoading={isLoading} />
        <StatCard label="Total Asset Positions" value={totalHoldings} isLoading={isLoading} />
        <StatCard
          label="System Risk Health"
          value={totalValue > 0 ? "Optimal" : "Setup Required"}
          isLoading={isLoading}
        />
      </div>

      {/* Supported Platforms Banner */}
      <Card className="border-border bg-gradient-to-r from-blue-50/50 via-card to-indigo-50/30">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            Connected & Supported Broker Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {CONNECTABLE_BROKERS.map((code) => {
              const cfg = getBrokerConfig(code);
              return (
                <div
                  key={code}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white shadow-xs text-xs font-medium"
                  style={{ borderColor: cfg.textColor + "33" }}
                >
                  <span>{cfg.emoji}</span>
                  <span className="font-semibold text-foreground">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold">{label}</CardTitle>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Activity / Status card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Activity className="h-4 w-4 text-emerald-600" />
          <CardTitle className="text-base">System Ingestion & Market Feeds</CardTitle>
          <Badge
            variant="secondary"
            className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            Real-Time Connected
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Multi-platform asset aggregation active. Stock prices are dynamically updated and
            TradingView live candlestick charts are available on every holding row.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
