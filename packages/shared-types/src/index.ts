export interface User {
  id: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
}

export interface UserPreferences {
  homeCurrency: string;
  riskTolerance: "LOW" | "MEDIUM" | "HIGH";
  timezone: string;
}

export interface Holding {
  id: string;
  userId: string;
  assetType: "EQUITY" | "CRYPTO" | "MUTUAL_FUND" | "BOND" | "CASH" | "FIXED_DEPOSIT" | "REAL_ESTATE";
  symbol: string;
  isin?: string;
  quantity: string; // Decimal representation
  avgCostBasis: string; // Decimal representation
  costCurrency: string;
  isManual: boolean;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  holdingId: string;
  userId: string;
  type: "BUY" | "SELL" | "DIVIDEND" | "SPLIT" | "BONUS";
  quantity: string;
  pricePerUnit: string;
  currency: string;
  fxRateToHome: string;
  transactedAt: Date;
}

export interface RiskSnapshot {
  var95_1d_inr: string;
  cvar95_1d_inr: string;
  sharpeRatio: string;
  sortinoRatio: string;
  betaVsBenchmark: string;
  maxDrawdownPct: string;
  portfolioRiskScore: number;
  computedAt: Date;
}
