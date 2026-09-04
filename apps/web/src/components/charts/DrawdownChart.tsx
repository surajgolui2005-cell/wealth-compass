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
  formatAxisPercent,
  formatAxisDate,
  formatTooltipDate,
} from './chart-theme';

export interface DrawdownDataPoint {
  date: string;
  drawdownPct: number;
}

interface DrawdownChartProps {
  data: DrawdownDataPoint[];
  height?: number;
  isLoading?: boolean;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  const isNegative = value < 0;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-medium">{formatTooltipDate(label)}</p>
      <p style={{ color: isNegative ? CHART_COLORS.destructive : CHART_COLORS.success }}>
        Drawdown: {formatAxisPercent(value, 2)}
      </p>
    </div>
  );
}

export function DrawdownChart({ data, height = 280, isLoading = false }: DrawdownChartProps) {
  const isEmpty = !data || data.length === 0;

  // Find max drawdown for annotation
  const maxDrawdown = data.length
    ? Math.min(...data.map((d) => d.drawdownPct))
    : 0;

  return (
    <ChartContainer
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Portfolio history needed to compute drawdown."
    >
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="drawdown-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.destructive} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.destructive} stopOpacity={0.02} />
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
          tickFormatter={(v) => formatAxisPercent(v)}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={52}
          domain={['auto', 0]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.muted, strokeWidth: 1 }} />
        {/* Zero reference line */}
        <ReferenceLine y={0} stroke={CHART_COLORS.muted} strokeDasharray="4 2" />
        {/* Max drawdown annotation */}
        {maxDrawdown < 0 && (
          <ReferenceLine
            y={maxDrawdown}
            stroke={CHART_COLORS.destructive}
            strokeDasharray="4 2"
            label={{
              value: `Max: ${formatAxisPercent(maxDrawdown, 1)}`,
              position: 'insideBottomLeft',
              fontSize: 11,
              fill: CHART_COLORS.destructive,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="drawdownPct"
          stroke={CHART_COLORS.destructive}
          strokeWidth={2}
          fill="url(#drawdown-gradient)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.destructive }}
          isAnimationActive
          animationDuration={600}
        />
      </AreaChart>
    </ChartContainer>
  );
}
