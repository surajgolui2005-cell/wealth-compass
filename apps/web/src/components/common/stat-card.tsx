'use client';

import { cn, formatCurrency, formatPercent, classifyDelta } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  isCurrency?: boolean;
  currency?: string;
  isLoading?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  isCurrency = false,
  currency = 'INR',
  isLoading = false,
  className,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-3 w-20" />
      </Card>
    );
  }

  const direction = delta !== undefined ? classifyDelta(delta) : 'neutral';
  const TrendIcon =
    direction === 'positive' ? TrendingUp
    : direction === 'negative' ? TrendingDown
    : Minus;

  const displayValue =
    isCurrency && typeof value === 'number'
      ? formatCurrency(value, currency, true)
      : String(value);

  return (
    <Card className={cn('p-6', className)}>
      <CardContent className="p-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold mt-1 tracking-tight">{displayValue}</p>
        {delta !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 mt-1 text-xs font-medium',
              direction === 'positive' && 'text-success',
              direction === 'negative' && 'text-destructive',
              direction === 'neutral' && 'text-muted-foreground',
            )}
          >
            <TrendIcon className="h-3 w-3" />
            <span>{formatPercent(delta)}</span>
            {deltaLabel && <span className="text-muted-foreground font-normal">{deltaLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
