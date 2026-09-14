import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "../lib/api-client";

export interface LiveQuote {
  symbol: string;
  price: number;
  closePrice?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  currency?: string;
  isMarketOpen?: boolean;
  timestamp?: string;
}

export interface LivePriceData {
  quotes: Record<string, LiveQuote>;
  ticks: Record<string, "up" | "down" | null>;
  isMarketOpen: boolean;
  isLive: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  getQuoteForSymbol: (symbol: string) => LiveQuote | null;
}

export function useLivePrices(
  symbols: string[],
  options: { intervalMs?: number; enabled?: boolean } = {},
): LivePriceData {
  const { intervalMs = 5000, enabled = true } = options;

  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [ticks, setTicks] = useState<Record<string, "up" | "down" | null>>({});
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(true);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const prevQuotesRef = useRef<Record<string, number>>({});
  const tickTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const isFetchingRef = useRef<boolean>(false);

  // Normalize symbols list
  const validSymbols = Array.from(new Set(symbols.map((s) => s?.trim()).filter(Boolean)));
  const symbolsKey = validSymbols.sort().join(",");

  const fetchLiveQuotes = useCallback(async () => {
    if (!enabled || validSymbols.length === 0 || isFetchingRef.current) return;

    // Pause polling if browser tab is hidden to save bandwidth & CPU
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      isFetchingRef.current = true;
      const res = await apiClient.get<{
        isMarketOpen: boolean;
        lastUpdated: string;
        quotes: Record<string, LiveQuote>;
      }>("/market-data/live-quotes", {
        params: { symbols: validSymbols.join(",") },
      });

      const data = res.data?.quotes ? res.data : (res as any)?.data;
      if (!data || !data.quotes) return;

      const newQuotes: Record<string, LiveQuote> = data.quotes;
      const newTicks: Record<string, "up" | "down" | null> = {};

      Object.entries(newQuotes).forEach(([sym, q]) => {
        const upperSym = sym.toUpperCase();
        const prevPrice = prevQuotesRef.current[upperSym];
        if (prevPrice !== undefined && q.price !== undefined) {
          if (q.price > prevPrice) {
            newTicks[upperSym] = "up";
          } else if (q.price < prevPrice) {
            newTicks[upperSym] = "down";
          }
        }
        if (q.price !== undefined) {
          prevQuotesRef.current[upperSym] = q.price;
        }
      });

      setQuotes((prev) => ({ ...prev, ...newQuotes }));
      setIsMarketOpen(Boolean(data.isMarketOpen));
      setIsLive(true);
      setLastUpdated(new Date());

      // If there are directional ticks, trigger tick state and clear after 1.5s
      if (Object.keys(newTicks).length > 0) {
        setTicks((prev) => ({ ...prev, ...newTicks }));

        Object.keys(newTicks).forEach((k) => {
          if (tickTimeoutsRef.current[k]) clearTimeout(tickTimeoutsRef.current[k]);
          tickTimeoutsRef.current[k] = setTimeout(() => {
            setTicks((prev) => ({ ...prev, [k]: null }));
          }, 1500);
        });
      }
    } catch (err) {
      console.warn("[useLivePrices] Failed to fetch live quotes:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [enabled, symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch and interval timer
  useEffect(() => {
    if (!enabled || validSymbols.length === 0) return;

    fetchLiveQuotes();

    const intervalId = setInterval(fetchLiveQuotes, intervalMs);

    // Resume immediately when tab comes back into view
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLiveQuotes();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      Object.values(tickTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [fetchLiveQuotes, intervalMs, enabled, validSymbols.length]);

  const getQuoteForSymbol = useCallback(
    (symbol: string): LiveQuote | null => {
      if (!symbol) return null;
      const clean = symbol.trim().toUpperCase();

      // Direct match
      if (quotes[clean]) return quotes[clean];

      // Match without .NS suffix or with .NS suffix
      for (const [key, val] of Object.entries(quotes)) {
        const k = key.toUpperCase();
        if (k === clean || k === `${clean}.NS` || `${k}.NS` === clean) {
          return val;
        }
        if (k.startsWith(clean) || clean.startsWith(k.replace(".NS", ""))) {
          return val;
        }
      }

      return null;
    },
    [quotes],
  );

  return {
    quotes,
    ticks,
    isMarketOpen,
    isLive,
    lastUpdated,
    refresh: fetchLiveQuotes,
    getQuoteForSymbol,
  };
}
