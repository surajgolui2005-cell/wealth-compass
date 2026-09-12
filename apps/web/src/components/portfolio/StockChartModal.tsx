"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { X, TrendingUp, BarChart2, Search, Info, Check, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockChartModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string; // e.g. "RELIANCE", "INFY", "INF174K01LS2", "WIPRO LTD"
  exchange?: string; // e.g. "NSE", "BSE", "BINANCE"
  name?: string;
}

// Known ISIN & Statement Name to TradingView Symbol mappings
const KNOWN_SYMBOL_RESOLUTIONS: Record<
  string,
  { tvSymbol: string; isMutualFund?: boolean; note?: string }
> = {
  // Common Equities by ISIN
  INE002A01018: { tvSymbol: "NSE:RELIANCE" },
  INE009A01021: { tvSymbol: "NSE:INFY" },
  INE090A01021: { tvSymbol: "NSE:ICICIBANK" },
  INE467B01029: { tvSymbol: "NSE:TCS" },
  INE040A01034: { tvSymbol: "NSE:HDFCBANK" },
  INE062A01020: { tvSymbol: "NSE:SBIN" },
  INE238A01034: { tvSymbol: "NSE:AXISBANK" },
  INE081A01012: { tvSymbol: "NSE:TATAMOTORS" },
  INE155A01022: { tvSymbol: "NSE:TATAPOWER" },
  INE075A01022: { tvSymbol: "NSE:WIPRO" },
  INE216A01030: { tvSymbol: "NSE:BAJFINANCE" },
  INE918I01018: { tvSymbol: "NSE:BAJAJFINSV" },
  INE522F01014: { tvSymbol: "NSE:COALINDIA" },
  INE121A01024: { tvSymbol: "NSE:BHARTIARTL" },
  INE018A01030: { tvSymbol: "NSE:LT" },
  INE158A01026: { tvSymbol: "NSE:HEROMOTOCO" },
  INE860A01027: { tvSymbol: "NSE:HCLTECH" },
  INE752E01010: { tvSymbol: "NSE:POWERGRID" },
  INE351I01018: { tvSymbol: "NSE:JPPOWER" },

  // Mutual Fund ISINs (Mapping to respective benchmark index/ETF)
  INF174K01LS2: {
    tvSymbol: "NSE:NIFTY_MID_SELECT",
    isMutualFund: true,
    note: "Mutual Funds trade at daily NAV. Displaying Smallcap/Midcap benchmark.",
  },
  INF209K01157: {
    tvSymbol: "NSE:NIFTY",
    isMutualFund: true,
    note: "Mutual Funds trade at daily NAV. Displaying Nifty 50 benchmark.",
  },
  INF769K01HG5: {
    tvSymbol: "NSE:NIFTY",
    isMutualFund: true,
    note: "Mutual Funds trade at daily NAV. Displaying Nifty 50 benchmark.",
  },
  INF846K01EW2: {
    tvSymbol: "NSE:NIFTY",
    isMutualFund: true,
    note: "Mutual Funds trade at daily NAV. Displaying Nifty 50 benchmark.",
  },
  INF109K01Y60: {
    tvSymbol: "NSE:NIFTY",
    isMutualFund: true,
    note: "Mutual Funds trade at daily NAV. Displaying Nifty 50 benchmark.",
  },
  INF200K01UT4: {
    tvSymbol: "NSE:NIFTY_MID_SELECT",
    isMutualFund: true,
    note: "Mutual Funds trade at daily NAV. Displaying Smallcap benchmark.",
  },

  // Raw Statement & Broker Names
  "WIPRO LTD": { tvSymbol: "NSE:WIPRO" },
  "WIPRO LIMITED": { tvSymbol: "NSE:WIPRO" },
  "JAIPRAKASH POWER VEN. LTD": { tvSymbol: "NSE:JPPOWER" },
  "JAIPRAKASH POWER": { tvSymbol: "NSE:JPPOWER" },
  JPPOWER: { tvSymbol: "NSE:JPPOWER" },
  "TATAAML-TATAGOLD": { tvSymbol: "NSE:GOLDBEES", note: "Showing Gold ETF (GOLDBEES) live chart." },
  TATAGOLD: { tvSymbol: "NSE:GOLDBEES", note: "Showing Gold ETF (GOLDBEES) live chart." },
  "TATAAML-TATSILV": {
    tvSymbol: "NSE:SILVERBEES",
    note: "Showing Silver ETF (SILVERBEES) live chart.",
  },
  TATSILV: { tvSymbol: "NSE:SILVERBEES", note: "Showing Silver ETF (SILVERBEES) live chart." },
  "BILLIONBRAINS GARAGE VN L": {
    tvSymbol: "NSE:NIFTY",
    note: "Unlisted broker parent. Displaying Nifty 50 benchmark.",
  },
  "RELIANCE INDUSTRIES LTD": { tvSymbol: "NSE:RELIANCE" },
  "INFOSYS LIMITED": { tvSymbol: "NSE:INFY" },
  "ICICI BANK LTD": { tvSymbol: "NSE:ICICIBANK" },
  "TCS LTD": { tvSymbol: "NSE:TCS" },
  "HDFC BANK LTD": { tvSymbol: "NSE:HDFCBANK" },
};

function resolveTradingViewSymbol(rawSymbol: string, rawName?: string, defaultExchange = "NSE") {
  const symClean = (rawSymbol || "").trim().toUpperCase();
  const nameClean = (rawName || "").trim().toUpperCase();

  // 1. Direct dictionary match
  if (KNOWN_SYMBOL_RESOLUTIONS[symClean]) {
    return KNOWN_SYMBOL_RESOLUTIONS[symClean];
  }
  if (KNOWN_SYMBOL_RESOLUTIONS[nameClean]) {
    return KNOWN_SYMBOL_RESOLUTIONS[nameClean];
  }

  // 2. Generic Mutual Fund detection (ISIN starts with INF or name has FUND / DIRECT / GROWTH)
  if (
    symClean.startsWith("INF") ||
    nameClean.includes("FUND") ||
    nameClean.includes("DIRECT GROWTH")
  ) {
    if (nameClean.includes("SMALL CAP") || nameClean.includes("SMALLCAP")) {
      return {
        tvSymbol: "NSE:NIFTY_MID_SELECT",
        isMutualFund: true,
        note: "Mutual Funds trade at daily NAV. Displaying Smallcap benchmark chart.",
      };
    }
    if (nameClean.includes("MID CAP") || nameClean.includes("MIDCAP")) {
      return {
        tvSymbol: "NSE:NIFTY_MID_SELECT",
        isMutualFund: true,
        note: "Mutual Funds trade at daily NAV. Displaying Midcap benchmark chart.",
      };
    }
    return {
      tvSymbol: "NSE:NIFTY",
      isMutualFund: true,
      note: "Mutual Funds trade at daily NAV. Displaying Nifty 50 benchmark chart.",
    };
  }

  // 3. Gold / Silver ETF heuristics
  if (symClean.includes("GOLD") || nameClean.includes("GOLD")) {
    return { tvSymbol: "NSE:GOLDBEES", note: "Showing Gold ETF (GOLDBEES) chart." };
  }
  if (symClean.includes("SILV") || nameClean.includes("SILVER")) {
    return { tvSymbol: "NSE:SILVERBEES", note: "Showing Silver ETF (SILVERBEES) chart." };
  }

  // 4. Clean standard ticker (strip "LTD", "LIMITED", "-EQ", etc.)
  let cleaned = symClean
    .replace(/\s+LTD\.?$/i, "")
    .replace(/\s+LIMITED$/i, "")
    .replace(/-EQ$/i, "")
    .replace(/[^A-Z0-9_-]/g, "");

  if (cleaned.includes(":")) {
    return { tvSymbol: cleaned };
  }

  return { tvSymbol: `${defaultExchange}:${cleaned || "NIFTY"}` };
}

export function StockChartModal({
  open,
  onClose,
  symbol,
  exchange = "NSE",
  name,
}: StockChartModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Smart resolved symbol
  const initialResolution = useMemo(
    () => resolveTradingViewSymbol(symbol, name, exchange),
    [symbol, name, exchange],
  );

  const [activeTvSymbol, setActiveTvSymbol] = useState(initialResolution.tvSymbol);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNote, setActiveNote] = useState(initialResolution.note || "");
  const [isMf, setIsMf] = useState(Boolean(initialResolution.isMutualFund));

  // Update symbol when prop changes
  useEffect(() => {
    const res = resolveTradingViewSymbol(symbol, name, exchange);
    setActiveTvSymbol(res.tvSymbol);
    setActiveNote(res.note || "");
    setIsMf(Boolean(res.isMutualFund));
    setSearchQuery("");
  }, [symbol, name, exchange]);

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
      symbol: activeTvSymbol,
      interval: "D",
      timezone: "Asia/Kolkata",
      theme: "light",
      style: "1",
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
  }, [open, activeTvSymbol]);

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    let query = searchQuery.trim().toUpperCase();
    if (!query.includes(":")) {
      query = `${exchange}:${query}`;
    }
    setActiveTvSymbol(query);
    setActiveNote("");
    setIsMf(false);
  };

  const handleSelectQuickSymbol = (sym: string, note?: string) => {
    setActiveTvSymbol(sym);
    setActiveNote(note || "");
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden rounded-xl bg-card">
        <DialogHeader className="px-4 pt-4 pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
                <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="truncate max-w-[340px] sm:max-w-md">{name ?? symbol}</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {activeTvSymbol}
                </Badge>
              </DialogTitle>
              {symbol && symbol !== name && (
                <p className="text-xs text-muted-foreground mt-0.5">Original: {symbol}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Custom Symbol Search */}
              <form onSubmit={handleCustomSearch} className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search e.g. RELIANCE, TCS"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-2 text-xs w-44 rounded-lg font-mono"
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" className="h-8 text-xs px-2.5">
                  Load
                </Button>
              </form>

              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Mutual Fund / ETF Informational Banner */}
          {activeNote && (
            <div className="mt-2.5 mb-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between text-blue-800 dark:text-blue-200">
              <div className="flex items-center gap-1.5">
                <Info className="h-4 w-4 shrink-0 text-blue-600" />
                <span>{activeNote}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-[10px] text-muted-foreground">Quick Switch:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectQuickSymbol("NSE:NIFTY", "Displaying Nifty 50 benchmark")
                  }
                  className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 text-[10px] font-semibold"
                >
                  Nifty 50
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectQuickSymbol("NSE:GOLDBEES", "Displaying Gold ETF")}
                  className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 text-[10px] font-semibold"
                >
                  Gold ETF
                </button>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* TradingView Chart */}
        <div className="relative" style={{ height: "560px" }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-sm">
                  Loading TradingView live chart for {activeTvSymbol}…
                </span>
              </div>
            </div>
          )}
          <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
