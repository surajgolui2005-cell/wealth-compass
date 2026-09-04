import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart2 } from 'lucide-react';
import { EquityCurveChart } from '@/components/charts/EquityCurveChart';
import { BenchmarkComparisonChart } from '@/components/charts/BenchmarkComparisonChart';

export const metadata: Metadata = { title: 'Analytics' };

// Sample data — in production these are fetched via TanStack Query from /api/v1/analytics
const sampleEquityData = [
  { date: '2026-01-01', value: 500000 },
  { date: '2026-02-01', value: 520000 },
  { date: '2026-03-01', value: 490000 },
  { date: '2026-04-01', value: 545000 },
  { date: '2026-05-01', value: 570000 },
  { date: '2026-06-01', value: 555000 },
  { date: '2026-07-01', value: 610000 },
  { date: '2026-08-01', value: 640000 },
  { date: '2026-09-01', value: 680000 },
];

const sampleBenchmarkData = [
  { date: '2026-01-01', portfolio: 0, benchmark: 0 },
  { date: '2026-02-01', portfolio: 4.0, benchmark: 2.8 },
  { date: '2026-03-01', portfolio: -2.0, benchmark: -1.5 },
  { date: '2026-04-01', portfolio: 9.0, benchmark: 5.5 },
  { date: '2026-05-01', portfolio: 14.0, benchmark: 8.2 },
  { date: '2026-06-01', portfolio: 11.0, benchmark: 7.0 },
  { date: '2026-07-01', portfolio: 22.0, benchmark: 11.0 },
  { date: '2026-08-01', portfolio: 28.0, benchmark: 14.5 },
  { date: '2026-09-01', portfolio: 36.0, benchmark: 18.0 },
];

const metrics = [
  { label: 'Time-Weighted Return', value: '+36.0%', description: 'TWR since inception' },
  { label: 'XIRR (Annualised)', value: '+28.4%', description: 'Money-weighted return' },
  { label: 'Sharpe Ratio', value: '1.82', description: 'Risk-adjusted return' },
  { label: 'Sortino Ratio', value: '2.41', description: 'Downside deviation return' },
  { label: 'Alpha vs NIFTY 50', value: '+18.0%', description: "Jensen's alpha" },
  { label: 'Beta vs NIFTY 50', value: '0.74', description: 'Market correlation' },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">Performance metrics powered by the Quant Engine</p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <BarChart2 className="h-3.5 w-3.5" />
          Quant Engine v1
        </Badge>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(({ label, value, description }) => (
          <Card key={label} className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </Card>
        ))}
      </div>

      {/* Equity curve */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <EquityCurveChart data={sampleEquityData} currency="INR" height={280} />
        </CardContent>
      </Card>

      {/* Benchmark comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio vs NIFTY 50 (Cumulative Return %)</CardTitle>
        </CardHeader>
        <CardContent>
          <BenchmarkComparisonChart
            data={sampleBenchmarkData}
            portfolioLabel="My Portfolio"
            benchmarkLabel="NIFTY 50"
            height={280}
          />
        </CardContent>
      </Card>
    </div>
  );
}
