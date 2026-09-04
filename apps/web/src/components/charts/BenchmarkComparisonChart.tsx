'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  type TooltipProps,
} from 'recharts';
import { ChartContainer } from './chart-container';
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  GRID_STYLE,
  AXIS_STYLE,
  formatAxisPercent,
  formatAxisDate,
  formatTooltipDate,
} from './chart-theme';

export interface BenchmarkDataPoint {
  date: string;
  portfolio: number;  // cumulative return %
  benchmark: number;  // cumulative return %
}

interface BenchmarkComparisonChartProps {
  data: BenchmarkDataPoint[];
  portfolioLabel?: string;
  benchmarkLabel?: string;
  height?: number;
  isLoading?: boolean;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-medium mb-1">{formatTooltipDate(label)}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {formatAxisPercent(entry.value as number, 2)}
        </p>
      ))}
    </div>
  );
}

export function BenchmarkComparisonChart({
  data,
  portfolioLabel = 'Portfolio',
  benchmarkLabel = 'NIFTY 50',
  height = 300,
  isLoading = false,
}: BenchmarkComparisonChartProps) {
  const isEmpty = !data || data.length === 0;

  return (
    <ChartContainer
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Historical data needed for benchmark comparison."
    >
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray={GRID_STYLE.strokeDasharray} stroke={GRID_STYLE.stroke} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(v) => formatAxisPercent(v)}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.muted, strokeWidth: 1 }} />
        <Legend
          iconType="plainline"
          iconSize={16}
          formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
        />
        {/* Zero baseline */}
        <ReferenceLine y={0} stroke={CHART_COLORS.muted} strokeDasharray="4 2" />

        {/* Benchmark line */}
        <Line
          type="monotone"
          dataKey="benchmark"
          name={benchmarkLabel}
          stroke={CHART_COLORS.muted}
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
          isAnimationActive
          animationDuration={600}
        />

        {/* Portfolio line */}
        <Line
          type="monotone"
          dataKey="portfolio"
          name={portfolioLabel}
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.primary }}
          isAnimationActive
          animationDuration={600}
        />
      </LineChart>
    </ChartContainer>
  );
}
