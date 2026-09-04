import type { Metadata } from 'next';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Activity } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Dashboard' };

const quickLinks = [
  { href: '/portfolios', label: 'View Portfolios', description: 'Manage your investment accounts' },
  { href: '/analytics', label: 'Analytics', description: 'TWR, XIRR, Sharpe ratio' },
  { href: '/risk', label: 'Risk Center', description: 'VaR, drawdown, volatility' },
  { href: '/alerts', label: 'Alert Rules', description: 'Configure threshold alerts' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">Your portfolio snapshot at a glance.</p>
      </div>

      {/* Stat Cards — populated by client-side query hooks in child components */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Portfolio Value" value="Connect API" isLoading={false} />
        <StatCard label="Day P&L" value="—" isLoading={false} />
        <StatCard label="Unrealised Gain" value="—" isLoading={false} />
        <StatCard label="Risk Score" value="—" isLoading={false} />
      </div>

      {/* Quick-access cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map(({ href, label, description }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">{label}</CardTitle>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Activity feed placeholder */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Badge variant="secondary" className="ml-auto">Live</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Connect a portfolio to see recent transactions and alerts here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
