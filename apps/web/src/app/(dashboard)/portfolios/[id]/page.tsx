'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/common/stat-card';
import { EmptyState } from '@/components/common/empty-state';
import { formatCurrency, formatPercent, classifyDelta, cn } from '@/lib/utils';

interface Holding {
  id: string;
  symbol: string;
  quantity: string;
  avgCost: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  assetType: string;
}

interface PortfolioDetail {
  id: string;
  name: string;
  currency: string;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
}

export default function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: portfolio, isLoading: portfolioLoading } = useQuery<PortfolioDetail>({
    queryKey: ['portfolio', id],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${id}/summary`);
      return (res as any).data ?? res.data;
    },
  });

  const { data: holdingsData, isLoading: holdingsLoading } = useQuery<{ data: Holding[] }>({
    queryKey: ['holdings', id],
    queryFn: async () => {
      const res = await apiClient.get(`/portfolios/${id}/holdings?limit=50`);
      return res as any;
    },
  });

  const holdings = holdingsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {portfolioLoading ? <Skeleton className="h-7 w-48 inline-block" /> : portfolio?.name}
        </h2>
        <p className="text-muted-foreground">Holdings and performance overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Value" value={portfolio?.totalValue ?? 0} isCurrency currency={portfolio?.currency} isLoading={portfolioLoading} />
        <StatCard label="Unrealised P&L" value={formatCurrency(portfolio?.totalPnl ?? 0, portfolio?.currency)} delta={portfolio?.totalPnlPct} isLoading={portfolioLoading} />
        <StatCard label="Holdings" value={holdings.length} isLoading={holdingsLoading} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Holdings</CardTitle></CardHeader>
        <CardContent>
          {holdingsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : holdings.length === 0 ? (
            <EmptyState title="No holdings" description="Record a transaction to add a position." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="pb-2 text-left font-medium">Symbol</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Avg Cost</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                    <th className="pb-2 text-right font-medium">P&L</th>
                    <th className="pb-2 text-right font-medium">P&L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holdings.map((h) => {
                    const dir = classifyDelta(h.pnlPct);
                    return (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {h.symbol}
                            <Badge variant="secondary" className="text-xs">{h.assetType}</Badge>
                          </div>
                        </td>
                        <td className="py-3 text-right tabular-nums">{h.quantity}</td>
                        <td className="py-3 text-right tabular-nums">{formatCurrency(h.avgCost)}</td>
                        <td className="py-3 text-right tabular-nums font-medium">{formatCurrency(h.currentValue)}</td>
                        <td className={cn('py-3 text-right tabular-nums', dir === 'positive' ? 'text-success' : dir === 'negative' ? 'text-destructive' : '')}>
                          {formatCurrency(h.pnl)}
                        </td>
                        <td className={cn('py-3 text-right tabular-nums font-medium', dir === 'positive' ? 'text-success' : dir === 'negative' ? 'text-destructive' : '')}>
                          {formatPercent(h.pnlPct)}
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
  );
}
