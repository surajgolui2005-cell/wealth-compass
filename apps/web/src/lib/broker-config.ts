// Central broker configuration used across web and mobile
// Each broker has: label, emoji icon, brand color, and deep-link URL builder

export type BrokerCode =
  | "GROWW"
  | "ANGEL_ONE"
  | "ZERODHA"
  | "UPSTOX"
  | "ICICI_DIRECT"
  | "BINANCE"
  | "WAZIRX"
  | "MANUAL"
  | "CSV"
  | "RBI_AA"
  | "CAMS_CAS";

export interface BrokerConfig {
  label: string;
  shortLabel: string;
  emoji: string;
  color: string; // hex for badge background
  textColor: string; // hex for text
  webUrl: string; // homepage
  deepLink: (symbol: string) => string; // stock-specific URL
  mobileDeepLink?: (symbol: string) => string; // native app URL scheme
}

export const BROKER_CONFIG: Record<BrokerCode, BrokerConfig> = {
  GROWW: {
    label: "Groww",
    shortLabel: "Groww",
    emoji: "🟢",
    color: "#00D09C1A",
    textColor: "#00b386",
    webUrl: "https://groww.in",
    deepLink: (symbol) => `https://groww.in/stocks/${symbol.toLowerCase()}`,
    mobileDeepLink: (symbol) => `groww://stocks/${symbol.toLowerCase()}`,
  },
  ANGEL_ONE: {
    label: "Angel One",
    shortLabel: "Angel One",
    emoji: "🔴",
    color: "#FF48481A",
    textColor: "#e63946",
    webUrl: "https://www.angelone.in",
    deepLink: (symbol) => `https://www.angelone.in/trade/equities/nse/${symbol.toUpperCase()}`,
    mobileDeepLink: (symbol) =>
      `https://www.angelone.in/trade/equities/nse/${symbol.toUpperCase()}`,
  },
  ZERODHA: {
    label: "Zerodha Kite",
    shortLabel: "Zerodha",
    emoji: "🟠",
    color: "#FF6B001A",
    textColor: "#d4520a",
    webUrl: "https://kite.zerodha.com",
    deepLink: (symbol) => `https://kite.zerodha.com/chart/ext/ciq/NSE/${symbol.toUpperCase()}`,
    mobileDeepLink: (symbol) => `kite://chart/${symbol.toUpperCase()}`,
  },
  UPSTOX: {
    label: "Upstox",
    shortLabel: "Upstox",
    emoji: "🟣",
    color: "#6D28D91A",
    textColor: "#7c3aed",
    webUrl: "https://upstox.com",
    deepLink: (symbol) => `https://upstox.com/stocks/${symbol.toLowerCase()}/`,
    mobileDeepLink: (symbol) => `upstox://stocks/${symbol.toLowerCase()}`,
  },
  ICICI_DIRECT: {
    label: "ICICI Direct",
    shortLabel: "ICICI",
    emoji: "🟡",
    color: "#F59E0B1A",
    textColor: "#b45309",
    webUrl: "https://www.icicidirect.com",
    deepLink: (symbol) =>
      `https://www.icicidirect.com/markets/equity/stock/${symbol.toLowerCase()}`,
  },
  BINANCE: {
    label: "Binance",
    shortLabel: "Binance",
    emoji: "🔶",
    color: "#F3BA2F1A",
    textColor: "#b07d00",
    webUrl: "https://www.binance.com",
    deepLink: (symbol) => `https://www.binance.com/en/trade/${symbol.toUpperCase()}_USDT`,
    mobileDeepLink: (symbol) => `binance://trade?symbol=${symbol.toUpperCase()}USDT`,
  },
  WAZIRX: {
    label: "WazirX",
    shortLabel: "WazirX",
    emoji: "🔷",
    color: "#3B82F61A",
    textColor: "#2563eb",
    webUrl: "https://wazirx.com",
    deepLink: (symbol) => `https://wazirx.com/exchange/${symbol.toUpperCase()}-INR`,
  },
  MANUAL: {
    label: "Manual Entry",
    shortLabel: "Manual",
    emoji: "✏️",
    color: "#6B72801A",
    textColor: "#374151",
    webUrl: "#",
    deepLink: () => "#",
  },
  CSV: {
    label: "CSV Import",
    shortLabel: "CSV",
    emoji: "📄",
    color: "#6B72801A",
    textColor: "#374151",
    webUrl: "#",
    deepLink: () => "#",
  },
  RBI_AA: {
    label: "RBI AA",
    shortLabel: "RBI AA",
    emoji: "🏦",
    color: "#6B72801A",
    textColor: "#374151",
    webUrl: "#",
    deepLink: () => "#",
  },
  CAMS_CAS: {
    label: "CAMS / CAS",
    shortLabel: "CAMS",
    emoji: "📋",
    color: "#6B72801A",
    textColor: "#374151",
    webUrl: "#",
    deepLink: () => "#",
  },
};

export function getBrokerConfig(code: string | null | undefined): BrokerConfig {
  if (!code) return BROKER_CONFIG.MANUAL;
  const key = code.toUpperCase() as BrokerCode;
  return BROKER_CONFIG[key] ?? BROKER_CONFIG.MANUAL;
}

/** Returns all selectable broker options for dropdowns / sheets */
export const CONNECTABLE_BROKERS: BrokerCode[] = [
  "GROWW",
  "ANGEL_ONE",
  "ZERODHA",
  "UPSTOX",
  "ICICI_DIRECT",
  "BINANCE",
  "WAZIRX",
];
