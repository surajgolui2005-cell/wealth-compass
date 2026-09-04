'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  type TooltipProps,
} from 'recharts';
import { ChartContainer } from './chart-container';
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  GRID_STYLE,
  AXIS_STYLE,
  formatAxisCurrency,
  formatAxisDate,
  formatTooltipCurrency,
  formatTooltipDate,
} from './chart-theme';

export interface EquityCurveDataPoint {
  date: string;
  value: number;
}

interface EquityCurveChartProps {
  data: EquityCurveDataPoint[];
  currency?: string;
  height?: number;
  isLoading?: boolean;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-medium text-foreground">{formatTooltipDate(label)}</p>
      <p className="mt-0.5" style={{ color: CHART_COLORS.primary }}>
        {formatTooltipCurrency(value)}
      </p>
    </div>
  );
}

export function EquityCurveChart({
  data,
  currency = 'INR',
  height = 300,
  isLoading = false,
}: EquityCurveChartProps) {
  const isEmpty = !data || data.length === 0;
  const gradientId = 'equity-gradient';

  return (
    <ChartContainer
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Record transactions to see your portfolio equity curve."
    >
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
          tickFormatter={(v) => formatAxisCurrency(v, currency)}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.muted, strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.primary }}
          isAnimationActive
          animationDuration={600}
        />
      </AreaChart>
    </ChartContainer>
  );
}
