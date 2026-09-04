'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';

interface ChartContainerProps {
  height?: number;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function ChartContainer({
  height = 300,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data available yet.',
  children,
}: ChartContainerProps) {
  if (isLoading) {
    return <ChartSkeleton height={height} />;
  }

  if (isEmpty) {
    return <ChartEmpty height={height} message={emptyMessage} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {children as React.ReactElement}
    </ResponsiveContainer>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div style={{ height }} className="flex flex-col gap-2 pt-2">
      <div className="flex items-end gap-1 flex-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function ChartEmpty({ height = 300, message }: { height?: number; message?: string }) {
  return (
    <div
      style={{ height }}
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/30 text-center"
    >
      <div className="rounded-full bg-muted p-3">
        <BarChart2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[200px]">
        {message ?? 'No data available yet.'}
      </p>
    </div>
  );
}
