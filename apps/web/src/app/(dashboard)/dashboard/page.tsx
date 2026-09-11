"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { StatCard } from "@/components/common/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Activity,
  Plus,
  TrendingUp,
  Layers,
  ShieldCheck,
  Bell,
  ExternalLink,
  Building2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getBrokerConfig, CONNECTABLE_BROKERS } from "@/lib/broker-config";
import { ConnectPlatformModal } from "@/components/portfolio/ConnectPlatformModal";

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  totalValue: number | string;
  isDefault: boolean;
  _count?: { holdings: number };
}

export default function DashboardPage() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Unified Investment Dashboard
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs"
            >
              RBI AA Connected
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregated real-time monitoring across all your broker demat accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {defaultPortfolio && (
            <Button
              onClick={() => setConnectModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white gap-1.5 shadow-md shadow-blue-500/10"
            >
              <Building2 className="h-4 w-4" />
              Connect Broker 🔗
            </Button>
          )}

          {defaultPortfolio && (
            <Link href={`/portfolios/${defaultPortfolio.id}`}>
              <Button variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Manage Assets
              </Button>
            </Link>
          )}
        </div>
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
      <Card className="border-border bg-card/80 shadow-xs">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Connected Broker Platforms (RBI Account Aggregator Enabled)
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConnectModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> 1-Click AA Sync →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2.5">
            {CONNECTABLE_BROKERS.map((code) => {
              const cfg = getBrokerConfig(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setConnectModalOpen(true)}
                  title={`Sync ${cfg.label} via AA`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium shadow-xs transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer group"
                  style={{
                    backgroundColor: cfg.color,
                    color: cfg.textColor,
                    borderColor: cfg.textColor + "4D",
                  }}
                >
                  <span className="text-sm">{cfg.emoji}</span>
                  <span className="font-semibold">{cfg.label}</span>
                  <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </button>
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
            RBI AA Real-Time Connected
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Multi-platform asset aggregation active. Setu Account Aggregator syncs stock demat
            holdings across Groww, AngelOne & Zerodha via CDSL/NSDL depositories.
          </p>
        </CardContent>
      </Card>

      {/* Broker Connection Modal */}
      {defaultPortfolio && (
        <ConnectPlatformModal
          open={connectModalOpen}
          onClose={() => setConnectModalOpen(false)}
          portfolioId={defaultPortfolio.id}
        />
      )}
    </div>
  );
}
