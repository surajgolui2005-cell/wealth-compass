import { AssetClassCode, ProviderCode, TransactionType } from '@prisma/client';

export interface RawExternalHolding {
  symbol: string;
  name?: string;
  quantity: number | string;
  avgCostBasis?: number | string;
  currentPrice?: number | string;
  assetClassCode?: AssetClassCode;
  currency?: string;
  externalRefId?: string;
}

export interface RawExternalTransaction {
  symbol: string;
  type: TransactionType;
  quantity: number | string;
  pricePerUnit: number | string;
  fees?: number | string;
  transactedAt: Date;
  currency?: string;
  notes?: string;
  providerRefId?: string;
  assetClassCode?: AssetClassCode;
  splitRatio?: number;
}

export interface CsvColumnMapping {
  symbolHeader?: string;
  dateHeader?: string;
  typeHeader?: string;
  quantityHeader?: string;
  priceHeader?: string;
  feesHeader?: string;
  assetClassHeader?: string;
  notesHeader?: string;
}

export interface CsvParseResult {
  transactions: RawExternalTransaction[];
  holdings: RawExternalHolding[];
  totalRowsParsed: number;
  skippedRowsCount: number;
  errors: string[];
}

export interface FinancialDataProvider {
  /**
   * Unique ProviderCode handled by this adapter
   */
  getProviderCode(): ProviderCode | string;

  /**
   * Validates credentials or config parameters before connection
   */
  validateConfig(config: Record<string, any>): Promise<boolean> | boolean;

  /**
   * Tests connection to external provider API or source
   */
  connect(credentials: Record<string, any>): Promise<{ connected: boolean; message?: string }>;

  /**
   * Fetches current snapshot of holdings from external provider
   */
  fetchHoldings(credentials: Record<string, any>): Promise<RawExternalHolding[]>;

  /**
   * Fetches historical transaction stream from external provider
   */
  fetchTransactions(
    credentials: Record<string, any>,
    startDate?: Date,
  ): Promise<RawExternalTransaction[]>;
}
