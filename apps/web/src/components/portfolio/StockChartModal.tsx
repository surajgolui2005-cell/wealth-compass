"use client";

import { useEffect, useRef, useState } from "react";
import { X, TrendingUp, BarChart2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StockChartModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string; // e.g. "RELIANCE", "INFY", "BTC"
  exchange?: string; // e.g. "NSE", "BSE", "BINANCE"
  name?: string;
}

const TIMEFRAMES = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1Y", value: "12M" },
  { label: "5Y", value: "60M" },
];

type ChartType = "candlestick" | "line";

export function StockChartModal({
  open,
  onClose,
  symbol,
  exchange = "NSE",
  name,
}: StockChartModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [loaded, setLoaded] = useState(false);

  const tvSymbol = `${exchange}:${symbol.toUpperCase()}`;
  const interval =
    timeframe === "1D"
      ? "30"
      : timeframe === "1W"
        ? "240"
        : timeframe === "1M"
          ? "D"
          : timeframe === "3M"
            ? "D"
            : timeframe === "12M"
              ? "W"
              : "M";

  useEffect(() => {
    if (!open || !containerRef.current) return;
    setLoaded(false);

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => setLoaded(true);
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: "Asia/Kolkata",
      theme: "light",
      style: chartType === "candlestick" ? "1" : "3",
      locale: "en",
      enable_publishing: false,
      hide_legend: false,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "calc(100% - 32px)";
    inner.style.width = "100%";

    wrapper.appendChild(inner);
    wrapper.appendChild(script);
    containerRef.current.appendChild(wrapper);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [open, tvSymbol, interval, chartType]);

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              {name ?? symbol} &mdash;
              <span className="text-muted-foreground text-sm font-normal">
                {exchange}:{symbol.toUpperCase()}
              </span>
            </DialogTitle>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-3 pb-2 border-b">
            {/* Chart type */}
            <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/40">
              <button
                onClick={() => setChartType("candlestick")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  chartType === "candlestick"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart2 className="h-3 w-3" />
                Candle
              </button>
              <button
                onClick={() => setChartType("line")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  chartType === "line"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TrendingUp className="h-3 w-3" />
                Line
              </button>
            </div>

            {/* Timeframe */}
            <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/40">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    timeframe === tf.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* TradingView Chart */}
        <div className="relative" style={{ height: "520px" }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-sm">Loading live chart…</span>
              </div>
            </div>
          )}
          <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
