'use client';

import { useMemo } from 'react';
import { ChartEmpty, ChartSkeleton } from './chart-container';
import { correlationToColor } from './chart-theme';

export interface CorrelationHeatmapData {
  assets: string[];
  matrix: number[][];
}

interface CorrelationHeatmapProps {
  data: CorrelationHeatmapData;
  height?: number;
  isLoading?: boolean;
}

export function CorrelationHeatmap({
  data,
  height = 320,
  isLoading = false,
}: CorrelationHeatmapProps) {
  const isEmpty = !data?.assets?.length || !data?.matrix?.length;

  if (isLoading) return <ChartSkeleton height={height} />;
  if (isEmpty) {
    return (
      <ChartEmpty
        height={height}
        message="At least 2 assets needed to compute correlation matrix."
      />
    );
  }

  const { assets, matrix } = data;
  const n = assets.length;

  // Layout constants
  const labelW = 56;
  const labelH = 56;
  const cellSize = Math.min(
    Math.floor((height - labelH) / n),
    54,
  );
  const svgW = labelW + cellSize * n;
  const svgH = labelH + cellSize * n;

  return (
    <div style={{ overflowX: 'auto', height }}>
      <svg width={svgW} height={svgH} aria-label="Correlation heatmap">
        {/* Column labels (top) */}
        {assets.map((asset, col) => (
          <text
            key={`col-${col}`}
            x={labelW + col * cellSize + cellSize / 2}
            y={labelH - 6}
            textAnchor="middle"
            fontSize={10}
            fill="hsl(var(--muted-foreground))"
          >
            {asset.length > 6 ? asset.slice(0, 5) + '…' : asset}
          </text>
        ))}

        {/* Row labels (left) + cells */}
        {matrix.map((row, rowIdx) => (
          <g key={`row-${rowIdx}`}>
            {/* Row label */}
            <text
              x={labelW - 6}
              y={labelH + rowIdx * cellSize + cellSize / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill="hsl(var(--muted-foreground))"
            >
              {assets[rowIdx]?.length > 6 ? assets[rowIdx].slice(0, 5) + '…' : assets[rowIdx]}
            </text>

            {/* Cells */}
            {row.map((value, colIdx) => {
              const x = labelW + colIdx * cellSize;
              const y = labelH + rowIdx * cellSize;
              const bg = correlationToColor(value);
              const textColor = Math.abs(value) > 0.6 ? '#fff' : '#374151';
              return (
                <g key={`cell-${rowIdx}-${colIdx}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellSize - 1}
                    height={cellSize - 1}
                    fill={bg}
                    rx={2}
                  />
                  <title>{`${assets[rowIdx]} × ${assets[colIdx]}: ${value.toFixed(2)}`}</title>
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2 + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={textColor}
                    fontWeight={500}
                  >
                    {value.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Color scale legend */}
        {useMemo(() => {
          const scaleW = 80;
          const scaleX = svgW - scaleW - 4;
          const scaleY = svgH - 18;
          const steps = 20;
          return (
            <g>
              {Array.from({ length: steps }).map((_, i) => {
                const v = -1 + (2 * i) / (steps - 1);
                return (
                  <rect
                    key={i}
                    x={scaleX + (i * scaleW) / steps}
                    y={scaleY}
                    width={scaleW / steps + 1}
                    height={8}
                    fill={correlationToColor(v)}
                  />
                );
              })}
              <text x={scaleX} y={scaleY - 3} fontSize={9} fill="hsl(var(--muted-foreground))">-1</text>
              <text x={scaleX + scaleW / 2} y={scaleY - 3} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">0</text>
              <text x={scaleX + scaleW} y={scaleY - 3} textAnchor="end" fontSize={9} fill="hsl(var(--muted-foreground))">+1</text>
            </g>
          );
        }, [svgW, svgH])}
      </svg>
    </div>
  );
}
