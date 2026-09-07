/**
 * DTOs for the RBI Account Aggregator (AA) Integration Layer.
 *
 * Covers the three-phase AA flow:
 *   1. Consent creation  (CreateAaConsentDto)
 *   2. OTP verification  (VerifyAaOtpDto)
 *   3. Data fetch        (AaAccountPayloadDto and sub-types)
 *
 * Reference specs:
 *   - Setu AA Gateway   : https://docs.setu.co/data/account-aggregator
 *   - Finvu AA Gateway  : https://docs.finvu.in/
 *   - ReBIT FIP/AA Spec : https://api.rebit.org.in/
 */

// --- AA Handle identifiers ----------------------------------------------------

export type AaHandle = "setu" | "finvu" | "sahamati" | "onemoney";

// --- FI Types supported by the adapter ---------------------------------------

export type AaFiType =
  | "DEPOSIT"
  | "TERM_DEPOSIT"
  | "RECURRING_DEPOSIT"
  | "SIP"
  | "CP"
  | "GOVT_SECURITIES"
  | "EQUITIES"
  | "BONDS"
  | "DEBENTURES"
  | "MUTUAL_FUNDS"
  | "ETF"
  | "IDR"
  | "CIS"
  | "AIF"
  | "INSURANCE_POLICIES"
  | "NPS"
  | "INVIT"
  | "REIT";

// --- 1. Consent Creation -----------------------------------------------------

/**
 * Input DTO for initiating an AA consent request.
 * Maps to the AA /Consent POST endpoint body.
 */
export class CreateAaConsentDto {
  /** Licensed AA handle, e.g. 'setu', 'finvu', 'onemoney' */
  aaHandle: AaHandle;

  /** Internal user ID requesting consent */
  userId: string;

  /** Internal portfolio ID to associate fetched data with */
  portfolioId: string;

  /**
   * Data date range for the consent.
   * Defaults to 12 months lookback if not provided.
   */
  dataDateRange?: {
    from: string; // ISO-8601
    to: string; // ISO-8601
  };

  /**
   * Financial Information types to request access for.
   * Defaults to ['DEPOSIT', 'EQUITIES', 'MUTUAL_FUNDS', 'TERM_DEPOSIT'].
   */
  fiTypes?: AaFiType[];

  /**
   * Optional: user VUA (Virtual User Address) on the AA.
   * e.g. "user@onemoney" or "9876543210@finvu"
   */
  vua?: string;
}

// --- 2. OTP Verification -----------------------------------------------------

/**
 * Input DTO for verifying the AA OTP and confirming consent.
 */
export class VerifyAaOtpDto {
  /** Consent ID returned from the consent creation step */
  consentId: string;

  /** One-time password received by the user on their AA-registered mobile */
  otp: string;

  /** AA handle used in the original consent request */
  aaHandle: AaHandle;
}

// --- 3. AA FI Data Payload Types ---------------------------------------------

/**
 * Bank / Deposit account as returned by the AA FI fetch.
 * Maps to ReBIT DEPOSIT FI Type schema.
 */
export interface AaBankAccountData {
  maskedAccNumber: string;
  ifsc: string;
  bankName: string;
  accountType: "SAVINGS" | "CURRENT" | "OVERDRAFT" | "NRE" | "NRO" | "SB";
  currentBalance: string; // Decimal string, INR
  availableBalance?: string;
  currency?: string;
  linkedAccRef?: string;
  transactions?: AaBankTransactionData[];
}

/**
 * Term deposit / FD as returned by the AA FI fetch.
 * Maps to ReBIT TERM_DEPOSIT FI Type schema.
 */
export interface AaTermDepositData {
  maskedAccNumber: string;
  bankName: string;
  principalAmount: string; // Decimal string, INR
  maturityAmount?: string;
  interestRate: string; // Annual rate, e.g. "7.25"
  depositDate: string; // ISO-8601
  maturityDate: string; // ISO-8601
  tenorDays?: number;
  currency?: string;
  linkedAccRef?: string;
}

/**
 * Equity / Demat holding as returned by the AA FI fetch.
 * Maps to ReBIT EQUITIES FI Type schema.
 */
export interface AaDematHoldingData {
  isin: string;
  symbol?: string; // NSE/BSE ticker
  issuerName: string;
  units: string; // Decimal string
  ltp?: string; // Last traded price, INR
  avgCostPrice?: string; // Average cost basis, INR
  closingPrice?: string;
  exchangeCode?: "NSE" | "BSE";
}

/**
 * Mutual Fund folio as returned by the AA FI fetch.
 * Maps to ReBIT MUTUAL_FUNDS FI Type schema.
 */
export interface AaMutualFundData {
  amc: string;
  schemeCode: string;
  schemeName: string;
  folioNo: string;
  isin?: string;
  units: string; // Decimal string
  nav?: string; // Current NAV, INR
  currentValue?: string; // units x NAV, INR
  investedValue?: string;
  dividendType?: "GROWTH" | "IDCW" | "BONUS";
  sipRegNo?: string;
}

/**
 * Bank transaction record returned by the AA FI fetch.
 * Maps to ReBIT DEPOSIT transaction schema.
 */
export interface AaBankTransactionData {
  txnId: string;
  type: "CREDIT" | "DEBIT";
  mode: "NEFT" | "RTGS" | "IMPS" | "UPI" | "ATM" | "CDM" | "OTHER";
  amount: string; // Decimal string, INR
  currentBalance?: string;
  transactionTimestamp: string; // ISO-8601
  narration?: string;
  reference?: string;
}

/**
 * Top-level payload DTO representing the full decrypted AA session response.
 * One instance corresponds to one FI account returned by the AA.
 */
export class AaAccountPayloadDto {
  /** AA-assigned FI Reference ID for this account */
  fipId: string;

  /** FI type per ReBIT schema */
  fiType: AaFiType;

  /** Bank / Deposit accounts (populated when fiType is 'DEPOSIT') */
  bankAccounts?: AaBankAccountData[];

  /** Term deposits / FDs (populated when fiType is 'TERM_DEPOSIT') */
  termDeposits?: AaTermDepositData[];

  /** Demat equity holdings (populated when fiType is 'EQUITIES') */
  dematHoldings?: AaDematHoldingData[];

  /** Mutual fund folios (populated when fiType is 'MUTUAL_FUNDS') */
  mutualFunds?: AaMutualFundData[];
}

// --- Internal encrypted consent token shape -----------------------------------

/**
 * Shape of the data encrypted via EncryptionService.encryptObject()
 * and stored in financialProviderAccount.encryptedCredentials.
 */
export interface AaEncryptedConsentToken {
  aaHandle: AaHandle;
  consentId: string;
  consentHandle: string;
  sessionId?: string;
  vua?: string;
  consentStatus: "PENDING" | "ACTIVE" | "PAUSED" | "REVOKED" | "EXPIRED";
  createdAt: string; // ISO-8601
  expiresAt?: string; // ISO-8601
}
