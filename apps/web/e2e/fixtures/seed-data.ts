/**
 * Deterministic Financial Domain Seed Dataset for E2E Testing
 * =============================================================
 *
 * Provides typed, predictable, reproducible test data matching the canonical
 * Prisma schema (DATABASE.md) and API contracts (API_CONTRACT.md).
 */

export const SEED_USER = {
  id: 'u-seed-001',
  email: 'test.user@wealthcompass.com',
  name: 'Aarav Mehta',
  password: 'Password123!@#',
  baseCurrency: 'INR',
  createdAt: '2026-01-01T00:00:00.000Z',
  preferences: {
    theme: 'dark',
    riskTolerance: 'MODERATE',
    defaultTimeframe: '1Y',
  },
};

export const SEED_PORTFOLIOS = [
  {
    id: 'p-seed-001',
    userId: 'u-seed-001',
    name: 'Core Wealth Growth Portfolio',
    description: 'Long-term equity & multi-asset compounding',
    currency: 'INR',
    totalValue: 18_75_000.0,
    totalCostBasis: 14_50_000.0,
    unrealizedPnL: 4_25_000.0,
    unrealizedPnLPct: 29.31,
    holdingCount: 4,
    createdAt: '2026-01-15T09:30:00.000Z',
    updatedAt: '2026-09-01T15:30:00.000Z',
  },
  {
    id: 'p-seed-002',
    userId: 'u-seed-001',
    name: 'Debt & Tactical Reserve',
    description: 'Capital preservation & fixed income',
    currency: 'INR',
    totalValue: 6_25_000.0,
    totalCostBasis: 5_90_000.0,
    unrealizedPnL: 35_000.0,
    unrealizedPnLPct: 5.93,
    holdingCount: 2,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-09-01T15:30:00.000Z',
  },
];

export const SEED_HOLDINGS = [
  {
    id: 'h-001',
    portfolioId: 'p-seed-001',
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    assetClass: 'EQUITY',
    exchange: 'NSE',
    quantity: 200,
    avgCostBasis: 2450.0,
    currentPrice: 3020.0,
    currentValue: 6_04_000.0,
    unrealizedPnL: 1_14_000.0,
    unrealizedPnLPct: 23.27,
    allocationPct: 32.21,
  },
  {
    id: 'h-002',
    portfolioId: 'p-seed-001',
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    assetClass: 'EQUITY',
    exchange: 'NSE',
    quantity: 100,
    avgCostBasis: 3600.0,
    currentPrice: 4350.0,
    currentValue: 4_35_000.0,
    unrealizedPnL: 75_000.0,
    unrealizedPnLPct: 20.83,
    allocationPct: 23.20,
  },
  {
    id: 'h-003',
    portfolioId: 'p-seed-001',
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    assetClass: 'EQUITY',
    exchange: 'NSE',
    quantity: 300,
    avgCostBasis: 1480.0,
    currentPrice: 1720.0,
    currentValue: 5_16_000.0,
    unrealizedPnL: 72_000.0,
    unrealizedPnLPct: 16.22,
    allocationPct: 27.52,
  },
  {
    id: 'h-004',
    portfolioId: 'p-seed-001',
    symbol: 'GOLDBEES',
    name: 'Nippon India ETF Gold BeES',
    assetClass: 'COMMODITY',
    exchange: 'NSE',
    quantity: 5000,
    avgCostBasis: 52.0,
    currentPrice: 64.0,
    currentValue: 3_20_000.0,
    unrealizedPnL: 60_000.0,
    unrealizedPnLPct: 23.08,
    allocationPct: 17.07,
  },
];

export const SEED_ANALYTICS = {
  twr: {
    cumulative: 0.2931,
    annualized: 0.3842,
    period: 'YTD',
    subPeriods: [
      { startDate: '2026-01-01', endDate: '2026-03-31', return: 0.084 },
      { startDate: '2026-04-01', endDate: '2026-06-30', return: 0.112 },
      { startDate: '2026-07-01', endDate: '2026-08-31', return: 0.075 },
    ],
  },
  xirr: {
    rate: 0.3145,
    annualizedPct: 31.45,
    cashFlowCount: 8,
  },
  benchmarkComparison: {
    portfolioReturn: 0.2931,
    benchmarkReturn: 0.185,
    benchmarkName: 'NIFTY 50',
    alpha: 0.0485,
    beta: 0.88,
    sharpeRatio: 1.84,
    sortinoRatio: 2.65,
    informationRatio: 1.12,
    trackingError: 0.042,
  },
  equityCurve: [
    { date: '2026-01-01', portfolioValue: 1450000, benchmarkValue: 1450000 },
    { date: '2026-02-01', portfolioValue: 1510000, benchmarkValue: 1480000 },
    { date: '2026-03-01', portfolioValue: 1572000, benchmarkValue: 1515000 },
    { date: '2026-04-01', portfolioValue: 1640000, benchmarkValue: 1550000 },
    { date: '2026-05-01', portfolioValue: 1695000, benchmarkValue: 1585000 },
    { date: '2026-06-01', portfolioValue: 1750000, benchmarkValue: 1630000 },
    { date: '2026-07-01', portfolioValue: 1810000, benchmarkValue: 1675000 },
    { date: '2026-08-01', portfolioValue: 1845000, benchmarkValue: 1700000 },
    { date: '2026-09-01', portfolioValue: 1875000, benchmarkValue: 1718000 },
  ],
};

export const SEED_RISK = {
  riskScore: 74,
  severity: 'MODERATE',
  var95_1d: 28_500.0,
  var95Pct: -1.52,
  cvar95_1d: 39_200.0,
  cvar95Pct: -2.09,
  volatilityAnnual: 0.162,
  maxDrawdown: -0.098,
  maxDrawdownPct: -9.8,
  diversificationScore: 82.5,
  hhi: 2640.0,
  effectiveN: 3.79,
  allocation: [
    { assetClass: 'Equity - Large Cap', value: 15_55_000, pct: 82.93, color: '#2563EB' },
    { assetClass: 'Commodities - Gold', value: 3_20_000, pct: 17.07, color: '#EAB308' },
  ],
  drawdownSeries: [
    { date: '2026-01-01', drawdown: 0.0 },
    { date: '2026-02-15', drawdown: -0.025 },
    { date: '2026-03-20', drawdown: -0.098 },
    { date: '2026-04-10', drawdown: -0.041 },
    { date: '2026-05-01', drawdown: 0.0 },
    { date: '2026-07-15', drawdown: -0.032 },
    { date: '2026-09-01', drawdown: 0.0 },
  ],
  correlationMatrix: {
    assets: ['RELIANCE', 'TCS', 'HDFCBANK', 'GOLDBEES'],
    matrix: [
      [1.0, 0.42, 0.51, -0.15],
      [0.42, 1.0, 0.38, -0.08],
      [0.51, 0.38, 1.0, -0.22],
      [-0.15, -0.08, -0.22, 1.0],
    ],
  },
};

export const SEED_ALERTS = {
  rules: [
    {
      id: 'rule-001',
      portfolioId: 'p-seed-001',
      name: 'High Drawdown Defense',
      ruleType: 'DRAWDOWN',
      thresholdValue: 10.0,
      comparisonOperator: 'GREATER_THAN',
      severity: 'HIGH',
      channels: ['IN_APP', 'EMAIL'],
      isActive: true,
      lastTriggeredAt: null,
      cooldownMinutes: 1440,
    },
    {
      id: 'rule-002',
      portfolioId: 'p-seed-001',
      name: 'Excess Volatility Warning',
      ruleType: 'VOLATILITY',
      thresholdValue: 25.0,
      comparisonOperator: 'GREATER_THAN',
      severity: 'MEDIUM',
      channels: ['IN_APP'],
      isActive: true,
      lastTriggeredAt: '2026-08-20T14:22:00.000Z',
      cooldownMinutes: 720,
    },
  ],
  logs: [
    {
      id: 'log-001',
      ruleId: 'rule-002',
      portfolioId: 'p-seed-001',
      triggeredValue: 26.4,
      thresholdValue: 25.0,
      message: 'Portfolio annualized volatility (26.4%) breached threshold (25.0%).',
      severity: 'MEDIUM',
      status: 'DELIVERED',
      createdAt: '2026-08-20T14:22:00.000Z',
    },
  ],
};

export const SEED_REPORTS = [
  {
    id: 'rpt-seed-001',
    userId: 'u-seed-001',
    portfolioId: 'p-seed-001',
    reportType: 'PORTFOLIO_SUMMARY',
    format: 'PDF',
    status: 'COMPLETED',
    fileUrl: 'data:application/pdf;base64,JVBERi0xLjcKZmFrZS1wZGYtY29udGVudA==',
    fileSizeBytes: 38450,
    errorMessage: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    completedAt: '2026-09-01T10:00:02.000Z',
  },
];
