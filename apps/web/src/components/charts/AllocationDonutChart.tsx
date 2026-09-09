"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, type TooltipProps } from "recharts";
import { ChartContainer } from "./chart-container";
import { COLOR_SEQUENCE, TOOLTIP_STYLE, formatTooltipCurrency } from "./chart-theme";

export interface AllocationSlice {
  name: string;
  value: number;
  color?: string;
}

interface AllocationDonutChartProps {
  data: AllocationSlice[];
  totalValue?: number;
  currency?: string;
  height?: number;
  isLoading?: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = item?.payload?.pct as number;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-medium">{item?.name}</p>
      <p style={{ color: item?.payload?.color ?? "#3b82f6" }}>
        {formatTooltipCurrency(item?.value ?? 0)}
      </p>
      <p className="text-muted-foreground text-xs">{pct?.toFixed(1)}% of portfolio</p>
    </div>
  );
}

function CenterLabel({ viewBox, total, currency }: any) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        {formatTooltipCurrency(total, currency)}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
      >
        Total
      </text>
    </g>
  );
}

export function AllocationDonutChart({
  data,
  totalValue,
  currency = "INR",
  height = 300,
  isLoading = false,
}: AllocationDonutChartProps) {
  const isEmpty = !data || data.length === 0;

  // Compute total and add pct to each slice
  const total = totalValue ?? data.reduce((sum, d) => sum + d.value, 0);
  const enriched = data.map((d, i) => ({
    ...d,
    pct: total > 0 ? (d.value / total) * 100 : 0,
    color: d.color ?? COLOR_SEQUENCE[i % COLOR_SEQUENCE.length],
  }));

  return (
    <ChartContainer
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="Add holdings to see allocation breakdown."
    >
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={enriched}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="78%"
          paddingAngle={2}
          dataKey="value"
          isAnimationActive
          animationDuration={500}
          label={({ name, pct }: any) => `${name} ${(pct ?? 0).toFixed(0)}%`}
          labelLine={false}
        >
          {enriched.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="transparent" />
          ))}
          <CenterLabel total={total} currency={currency} />
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ChartContainer>
  );
}
