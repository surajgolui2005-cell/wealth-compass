import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';
import { DrawdownChart } from '@/components/charts/DrawdownChart';
import { AllocationDonutChart } from '@/components/charts/AllocationDonutChart';
import { CorrelationHeatmap } from '@/components/charts/CorrelationHeatmap';

export const metadata: Metadata = { title: 'Risk Center' };

// Sample data — in production fetched from /api/v1/analytics/risk
const sampleDrawdownData = [
  { date: '2026-01-01', drawdownPct: 0 },
  { date: '2026-02-01', drawdownPct: -1.8 },
  { date: '2026-03-01', drawdownPct: -8.5 },
  { date: '2026-04-01', drawdownPct: -4.2 },
  { date: '2026-05-01', drawdownPct: -0.5 },
  { date: '2026-06-01', drawdownPct: -3.1 },
  { date: '2026-07-01', drawdownPct: 0 },
  { date: '2026-08-01', drawdownPct: -1.2 },
  { date: '2026-09-01', drawdownPct: 0 },
];

const sampleAllocationData = [
  { name: 'Equities', value: 420000 },
  { name: 'Crypto', value: 95000 },
  { name: 'Mutual Funds', value: 110000 },
  { name: 'Bonds', value: 55000 },
];

const sampleCorrelation = {
  assets: ['RELIANCE', 'INFY', 'BTC', 'HDFC', 'NIFTY50'],
  matrix: [
    [1.00,  0.42,  0.18,  0.65,  0.72],
    [0.42,  1.00,  0.12,  0.38,  0.61],
    [0.18,  0.12,  1.00,  0.09,  0.21],
    [0.65,  0.38,  0.09,  1.00,  0.68],
    [0.72,  0.61,  0.21,  0.68,  1.00],
  ],
};

const riskMetrics = [
  { label: 'Value at Risk (95%, 1D)', value: '₹12,450', severity: 'medium' },
  { label: 'CVaR (95%, 1D)', value: '₹18,200', severity: 'medium' },
  { label: 'Max Drawdown', value: '-8.50%', severity: 'low' },
  { label: 'Annualised Volatility', value: '14.2%', severity: 'low' },
  { label: 'Portfolio Risk Score', value: '42 / 100', severity: 'low' },
  { label: 'Diversification Score', value: '78 / 100', severity: 'low' },
];

type Severity = 'low' | 'medium' | 'high' | 'neutral';

function SeverityBadge({ s }: { s: Severity }) {
  const map: Record<Severity, { variant: 'success' | 'warning' | 'destructive' | 'secondary'; label: string }> = {
    low: { variant: 'success', label: 'Low' },
    medium: { variant: 'warning', label: 'Medium' },
    high: { variant: 'destructive', label: 'High' },
    neutral: { variant: 'secondary', label: '—' },
  };
  const { variant, label } = map[s];
  return <Badge variant={variant}>{label}</Badge>;
}

export default function RiskPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Risk Center</h2>
          <p className="text-muted-foreground">Portfolio risk metrics and concentration analysis</p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          Risk Engine
        </Badge>
      </div>

      {/* Risk metric summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {riskMetrics.map(({ label, value, severity }) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <SeverityBadge s={severity as Severity} />
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Drawdown chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Historical Drawdown</CardTitle></CardHeader>
          <CardContent>
            <DrawdownChart data={sampleDrawdownData} height={240} />
          </CardContent>
        </Card>

        {/* Allocation donut */}
        <Card>
          <CardHeader><CardTitle className="text-base">Asset Allocation</CardTitle></CardHeader>
          <CardContent>
            <AllocationDonutChart data={sampleAllocationData} height={240} />
          </CardContent>
        </Card>
      </div>

      {/* Correlation heatmap */}
      <Card>
        <CardHeader><CardTitle className="text-base">Asset Correlation Matrix</CardTitle></CardHeader>
        <CardContent>
          <CorrelationHeatmap data={sampleCorrelation} height={300} />
        </CardContent>
      </Card>
    </div>
  );
}
