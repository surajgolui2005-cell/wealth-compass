// Central broker configuration for mobile app
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
  bgColor: string;
  textColor: string;
  webUrl: string;
  deepLink: (symbol: string) => string;
}

export const BROKER_CONFIG: Record<BrokerCode, BrokerConfig> = {
  GROWW: {
    label: "Groww",
    shortLabel: "Groww",
    emoji: "🟢",
    bgColor: "#ecfdf5",
    textColor: "#059669",
    webUrl: "https://groww.in",
    deepLink: (symbol) => `https://groww.in/stocks/${symbol.toLowerCase()}`,
  },
  ANGEL_ONE: {
    label: "Angel One",
    shortLabel: "Angel One",
    emoji: "🔴",
    bgColor: "#fef2f2",
    textColor: "#dc2626",
    webUrl: "https://www.angelone.in",
    deepLink: (symbol) => `https://www.angelone.in/trade/equities/nse/${symbol.toUpperCase()}`,
  },
  ZERODHA: {
    label: "Zerodha Kite",
    shortLabel: "Zerodha",
    emoji: "🟠",
    bgColor: "#fff7ed",
    textColor: "#ea580c",
    webUrl: "https://kite.zerodha.com",
    deepLink: (symbol) => `https://kite.zerodha.com/chart/ext/ciq/NSE/${symbol.toUpperCase()}`,
  },
  UPSTOX: {
    label: "Upstox",
    shortLabel: "Upstox",
    emoji: "🟣",
    bgColor: "#faf5ff",
    textColor: "#9333ea",
    webUrl: "https://upstox.com",
    deepLink: (symbol) => `https://upstox.com/stocks/${symbol.toLowerCase()}/`,
  },
  ICICI_DIRECT: {
    label: "ICICI Direct",
    shortLabel: "ICICI",
    emoji: "🟡",
    bgColor: "#fefce8",
    textColor: "#ca8a04",
    webUrl: "https://www.icicidirect.com",
    deepLink: (symbol) =>
      `https://www.icicidirect.com/markets/equity/stock/${symbol.toLowerCase()}`,
  },
  BINANCE: {
    label: "Binance",
    shortLabel: "Binance",
    emoji: "🔶",
    bgColor: "#fffbeb",
    textColor: "#d97706",
    webUrl: "https://www.binance.com",
    deepLink: (symbol) => `https://www.binance.com/en/trade/${symbol.toUpperCase()}_USDT`,
  },
  WAZIRX: {
    label: "WazirX",
    shortLabel: "WazirX",
    emoji: "🔷",
    bgColor: "#eff6ff",
    textColor: "#2563eb",
    webUrl: "https://wazirx.com",
    deepLink: (symbol) => `https://wazirx.com/exchange/${symbol.toUpperCase()}-INR`,
  },
  MANUAL: {
    label: "Manual Entry",
    shortLabel: "Manual",
    emoji: "✏️",
    bgColor: "#f3f4f6",
    textColor: "#4b5563",
    webUrl: "#",
    deepLink: () => "#",
  },
  CSV: {
    label: "CSV Import",
    shortLabel: "CSV",
    emoji: "📄",
    bgColor: "#f3f4f6",
    textColor: "#4b5563",
    webUrl: "#",
    deepLink: () => "#",
  },
  RBI_AA: {
    label: "RBI AA",
    shortLabel: "RBI AA",
    emoji: "🏦",
    bgColor: "#f3f4f6",
    textColor: "#4b5563",
    webUrl: "#",
    deepLink: () => "#",
  },
  CAMS_CAS: {
    label: "CAMS / CAS",
    shortLabel: "CAMS",
    emoji: "📋",
    bgColor: "#f3f4f6",
    textColor: "#4b5563",
    webUrl: "#",
    deepLink: () => "#",
  },
};

export function getBrokerConfig(code?: string | null): BrokerConfig {
  if (!code) return BROKER_CONFIG.MANUAL;
  const key = code.toUpperCase() as BrokerCode;
  return BROKER_CONFIG[key] ?? BROKER_CONFIG.MANUAL;
}

export const CONNECTABLE_BROKERS: BrokerCode[] = [
  "GROWW",
  "ANGEL_ONE",
  "ZERODHA",
  "UPSTOX",
  "ICICI_DIRECT",
  "BINANCE",
  "WAZIRX",
];
