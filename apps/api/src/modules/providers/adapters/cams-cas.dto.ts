import { AssetClassCode, TransactionType } from "@prisma/client";
import { RawExternalHolding, RawExternalTransaction } from "../interfaces/provider.interface";

/**
 * Enriched transaction entity extracted from CAS statements.
 * Extends canonical RawExternalTransaction with CAS folio and mutual fund metadata.
 */
export interface NormalizedTransaction extends RawExternalTransaction {
  /** Folio number identifying the investment account */
  folioNumber: string;
  /** Full mutual fund scheme name (e.g. HDFC Top 100 Fund - Growth) */
  schemeName: string;
  /** 12-character alphanumeric ISIN (e.g. INF179K01BE2) */
  isin?: string;
  /** AMFI Scheme Code if available */
  amfiCode?: string;
  /** Dividend / IDCW rate per unit (e.g. 1.25 for @ Rs. 1.25 per unit) */
  dividendRate?: number;
  /** Running cumulative unit balance after this transaction */
  balanceUnits?: number | string;
  /** Registrar transfer agent that issued this statement section */
  rta?: "CAMS" | "KFINTECH" | "KARVY" | "UNKNOWN";
}

/**
 * Investor demographic and tax information extracted from CAS header
 */
export interface CasInvestorInfo {
  name?: string;
  email?: string;
  mobile?: string;
  pan?: string;
  address?: string;
}

/**
 * Statement period bounds
 */
export interface CasStatementPeriod {
  from: string;
  to: string;
}

/**
 * Single transaction entry within a scheme
 */
export interface CasTransaction {
  date: Date;
  description: string;
  amount: number;
  units: number;
  price: number;
  balance: number;
  type: TransactionType;
  dividendRate?: number;
}

/**
 * Scheme level block within a folio
 */
export interface CasScheme {
  schemeName: string;
  isin?: string;
  amfiCode?: string;
  advisor?: string;
  rta: "CAMS" | "KFINTECH" | "KARVY" | "UNKNOWN";
  openingUnitBalance?: number;
  closingUnitBalance?: number;
  nav?: number;
  navDate?: Date;
  valuation?: number;
  valuationDate?: Date;
  transactions: CasTransaction[];
}

/**
 * Folio block grouping schemes under an AMC
 */
export interface CasFolio {
  folioNumber: string;
  amc: string;
  pan?: string;
  kycStatus?: string;
  schemes: CasScheme[];
}

/**
 * Complete parsed CAS result structure
 */
export interface CasParseResult {
  fileType: "CAMS" | "KFINTECH" | "UNKNOWN";
  casType: "DETAILED" | "SUMMARY";
  statementPeriod?: CasStatementPeriod;
  investorInfo?: CasInvestorInfo;
  folios: CasFolio[];
  transactions: NormalizedTransaction[];
  holdings: RawExternalHolding[];
  totalTransactionsCount: number;
  totalFoliosCount: number;
  errors: string[];
}

/**
 * Input configuration for parsing a CAS PDF
 */
export interface ParseCasPdfOptions {
  /** In-memory binary buffer of the uploaded PDF file */
  pdfBuffer: Buffer | Uint8Array;
  /** Optional user password (PAN + Date of Birth, e.g. ABCDE1234F01011990) */
  password?: string;
}
