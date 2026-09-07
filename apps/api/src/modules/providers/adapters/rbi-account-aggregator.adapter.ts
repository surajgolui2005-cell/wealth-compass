import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { AssetClassCode, ProviderCode, TransactionType } from "@prisma/client";
import { EncryptionService } from "../../../common/crypto/encryption.service";
import {
  FinancialDataProvider,
  RawExternalHolding,
  RawExternalTransaction,
} from "../interfaces/provider.interface";
import {
  AaAccountPayloadDto,
  AaBankAccountData,
  AaBankTransactionData,
  AaDematHoldingData,
  AaEncryptedConsentToken,
  AaFiType,
  AaHandle,
  AaMutualFundData,
  AaTermDepositData,
  CreateAaConsentDto,
  VerifyAaOtpDto,
} from "./rbi-aa.dto";

// ---------------------------------------------------------------------------
// AA Gateway URL resolver
// ---------------------------------------------------------------------------

const AA_GATEWAY_URLS: Record<AaHandle, string> = {
  setu: "https://fiu-uat.setu.co/v2",
  finvu: "https://webfinvu.in/v1",
  sahamati: "https://api.sahamati.org.in/v1",
  onemoney: "https://onemoney.in/v1",
};

const DEFAULT_FI_TYPES: AaFiType[] = ["DEPOSIT", "EQUITIES", "MUTUAL_FUNDS", "TERM_DEPOSIT"];

// ---------------------------------------------------------------------------
// HTTP client interface (injectable shim � replaced by real HttpService in prod)
// ---------------------------------------------------------------------------

export interface AaHttpClient {
  post<T = any>(url: string, body: object, headers?: Record<string, string>): Promise<T>;
  get<T = any>(url: string, headers?: Record<string, string>): Promise<T>;
}

/**
 * Default HTTP client using Node.js built-in fetch (Node 18+).
 * In NestJS apps the HttpModule/Axios client is preferred;
 * this shim keeps the adapter testable without network access.
 */
export class DefaultAaHttpClient implements AaHttpClient {
  async post<T>(url: string, body: object, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AA POST ${url} failed (${response.status}): ${text}`);
    }
    return response.json() as Promise<T>;
  }

  async get<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...headers },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AA GET ${url} failed (${response.status}): ${text}`);
    }
    return response.json() as Promise<T>;
  }
}

// ---------------------------------------------------------------------------
// RbiAccountAggregatorAdapter
// ---------------------------------------------------------------------------

/**
 * RBI Account Aggregator (AA) adapter.
 *
 * Implements the three-phase AA consent + data-fetch flow:
 *   Phase 1: createConsent()     � POST /Consent ? get consentId + consentHandle
 *   Phase 2: verifyOtp()         � POST /Consent/otp ? confirm consent, receive sessionToken
 *   Phase 3: fetchHoldings()     � GET /FI/fetch ? decrypt & map to RawExternalHolding[]
 *            fetchTransactions()  � same session, maps bank debit/credit to RawExternalTransaction[]
 *
 * Encrypted consent tokens are stored via EncryptionService (AES-256-GCM)
 * in financialProviderAccount.encryptedCredentials � NEVER in plaintext.
 *
 * Supported AA handles: setu | finvu | sahamati | onemoney
 */
@Injectable()
export class RbiAccountAggregatorAdapter implements FinancialDataProvider {
  private readonly logger = new Logger(RbiAccountAggregatorAdapter.name);

  constructor(
    private readonly encryptionService: EncryptionService,
    readonly httpClient: AaHttpClient = new DefaultAaHttpClient(),
  ) {}

  // -- FinancialDataProvider ------------------------------------------------

  getProviderCode(): ProviderCode | string {
    return "RBI_AA";
  }

  /**
   * Validates that the supplied config contains a recognised AA handle
   * and an app-level client ID issued by the AA ecosystem.
   */
  validateConfig(config: Record<string, any>): boolean {
    if (!config || typeof config !== "object") return false;
    const validHandles: AaHandle[] = ["setu", "finvu", "sahamati", "onemoney"];
    return (
      typeof config.aaHandle === "string" &&
      validHandles.includes(config.aaHandle as AaHandle) &&
      typeof config.clientId === "string" &&
      config.clientId.trim().length > 0
    );
  }

  /**
   * Phase 1 � Consent Creation.
   *
   * POSTs a consent request to the AA gateway.
   * On success the returned consentId + consentHandle are serialised,
   * encrypted with AES-256-GCM via EncryptionService and returned as
   * `encryptedConsentToken` for storage in the database.
   *
   * credentials shape:
   *   { aaHandle, clientId, clientSecret, userId, portfolioId, vua?, fiTypes?, dataDateRange? }
   */
  async connect(
    credentials: Record<string, any>,
  ): Promise<{ connected: boolean; message?: string; encryptedConsentToken?: string }> {
    const dto = this.buildConsentDto(credentials);
    const baseUrl = this.resolveGatewayUrl(dto.aaHandle);
    const authHeader = this.buildAuthHeader(credentials);

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);

    const consentBody = {
      ver: "2.0.0",
      timestamp: now.toISOString(),
      txnid: this.generateTxnId(),
      ConsentDetail: {
        consentStart: now.toISOString(),
        consentExpiry: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        consentMode: "STORE",
        fetchType: "PERIODIC",
        consentTypes: ["PROFILE", "SUMMARY", "TRANSACTIONS"],
        fiTypes: dto.fiTypes ?? DEFAULT_FI_TYPES,
        DataConsumer: { id: credentials.clientId },
        Customer: { id: dto.vua ?? credentials.vua ?? `${dto.userId}@${dto.aaHandle}` },
        FIDataRange: {
          from: dto.dataDateRange?.from ?? defaultFrom.toISOString(),
          to: dto.dataDateRange?.to ?? now.toISOString(),
        },
        DataLife: { unit: "YEAR", value: 1 },
        Frequency: { unit: "MONTH", value: 1 },
        DataFilter: [],
      },
    };

    try {
      const response = await this.httpClient.post<any>(
        `${baseUrl}/Consent`,
        consentBody,
        authHeader,
      );

      const consentId: string = response?.ConsentHandle ?? response?.consentId ?? response?.id;
      const consentHandle: string = response?.ConsentHandle ?? consentId;

      if (!consentId) {
        throw new Error("AA gateway did not return a consentId");
      }

      const tokenPayload: AaEncryptedConsentToken = {
        aaHandle: dto.aaHandle,
        consentId,
        consentHandle,
        vua: dto.vua ?? credentials.vua,
        consentStatus: "PENDING",
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // AES-256-GCM encrypt before returning � never store plaintext tokens
      const encryptedConsentToken = this.encryptionService.encryptObject(tokenPayload);

      this.logger.log(`AA consent created: consentId=${consentId}, handle=${dto.aaHandle}`);

      return {
        connected: true,
        message: `Consent request submitted to ${dto.aaHandle}. OTP sent to user's AA-registered mobile.`,
        encryptedConsentToken,
      };
    } catch (err: any) {
      this.logger.error(`AA consent creation failed: ${err.message}`);
      throw new UnauthorizedException(`AA consent creation failed: ${err.message}`);
    }
  }

  /**
   * Phase 2 � OTP Verification.
   *
   * POSTs the OTP to the AA gateway to confirm consent and receive a sessionToken.
   * The session token is merged into the stored encrypted consent token and
   * re-encrypted for background sync use.
   *
   * credentials shape:
   *   { aaHandle, clientId, clientSecret, consentId, otp, encryptedConsentToken? }
   */
  async verifyOtp(credentials: Record<string, any>): Promise<{
    verified: boolean;
    message?: string;
    encryptedSessionToken?: string;
  }> {
    const dto: VerifyAaOtpDto = {
      aaHandle: credentials.aaHandle as AaHandle,
      consentId: credentials.consentId,
      otp: credentials.otp,
    };

    const baseUrl = this.resolveGatewayUrl(dto.aaHandle);
    const authHeader = this.buildAuthHeader(credentials);

    const otpBody = {
      ver: "2.0.0",
      timestamp: new Date().toISOString(),
      txnid: this.generateTxnId(),
      otp: dto.otp,
    };

    try {
      const response = await this.httpClient.post<any>(`${baseUrl}/Consent/otp`, otpBody, {
        ...authHeader,
        "x-consent-id": dto.consentId,
      });

      const sessionId: string =
        response?.sessionToken ?? response?.sessionId ?? response?.session_id;

      if (!sessionId) {
        throw new Error("AA gateway did not return a sessionToken after OTP verification");
      }

      // Decrypt existing consent token (if available) and merge session ID
      let existingToken: Partial<AaEncryptedConsentToken> = {};
      if (credentials.encryptedConsentToken) {
        try {
          existingToken = this.encryptionService.decryptObject<AaEncryptedConsentToken>(
            credentials.encryptedConsentToken,
          );
        } catch {
          // Non-fatal: rebuild token from credentials
        }
      }

      const updatedToken: AaEncryptedConsentToken = {
        aaHandle: dto.aaHandle,
        consentId: dto.consentId,
        consentHandle: (existingToken as AaEncryptedConsentToken).consentHandle ?? dto.consentId,
        sessionId,
        vua: (existingToken as AaEncryptedConsentToken).vua,
        consentStatus: "ACTIVE",
        createdAt: (existingToken as AaEncryptedConsentToken).createdAt ?? new Date().toISOString(),
        expiresAt: (existingToken as AaEncryptedConsentToken).expiresAt,
      };

      const encryptedSessionToken = this.encryptionService.encryptObject(updatedToken);

      this.logger.log(`AA OTP verified: consentId=${dto.consentId}, sessionId=[REDACTED]`);

      return {
        verified: true,
        message: "Consent confirmed. Financial data access granted.",
        encryptedSessionToken,
      };
    } catch (err: any) {
      this.logger.error(`AA OTP verification failed: ${err.message}`);
      throw new UnauthorizedException(`AA OTP verification failed: ${err.message}`);
    }
  }

  /**
   * Phase 3a � Fetch Holdings.
   *
   * Decrypts the stored session token, calls GET /FI/fetch for each FI type,
   * and maps all FI accounts into RawExternalHolding[] using type-specific
   * mapper methods.
   *
   * credentials shape:
   *   { aaHandle, clientId, clientSecret, encryptedConsentToken }
   */
  async fetchHoldings(credentials: Record<string, any>): Promise<RawExternalHolding[]> {
    const { sessionToken, baseUrl, authHeader } = this.resolveSession(credentials);
    const holdings: RawExternalHolding[] = [];

    const fiAccounts = await this.fetchFiData(
      sessionToken,
      baseUrl,
      authHeader,
      sessionToken.consentId,
    );

    for (const account of fiAccounts) {
      switch (account.fiType) {
        case "DEPOSIT":
          for (const bank of account.bankAccounts ?? []) {
            holdings.push(this.mapBankAccount(bank, account.fipId));
          }
          break;

        case "TERM_DEPOSIT":
        case "RECURRING_DEPOSIT":
          for (const fd of account.termDeposits ?? []) {
            holdings.push(this.mapTermDeposit(fd, account.fipId));
          }
          break;

        case "EQUITIES":
          for (const holding of account.dematHoldings ?? []) {
            holdings.push(this.mapDematHolding(holding, account.fipId));
          }
          break;

        case "MUTUAL_FUNDS":
          for (const mf of account.mutualFunds ?? []) {
            holdings.push(this.mapMutualFund(mf, account.fipId));
          }
          break;

        default:
          this.logger.warn(`Unsupported FI type '${account.fiType}' � skipping`);
      }
    }

    this.logger.log(`AA fetchHoldings: mapped ${holdings.length} holdings`);
    return holdings;
  }

  /**
   * Phase 3b � Fetch Transactions.
   *
   * Decrypts the stored session token, fetches DEPOSIT FI data, and maps
   * bank debit/credit transactions into RawExternalTransaction[].
   *
   * credentials shape:
   *   { aaHandle, clientId, clientSecret, encryptedConsentToken }
   */
  async fetchTransactions(
    credentials: Record<string, any>,
    _startDate?: Date,
  ): Promise<RawExternalTransaction[]> {
    const { sessionToken, baseUrl, authHeader } = this.resolveSession(credentials);
    const transactions: RawExternalTransaction[] = [];

    const fiAccounts = await this.fetchFiData(
      sessionToken,
      baseUrl,
      authHeader,
      sessionToken.consentId,
    );

    for (const account of fiAccounts) {
      if (account.fiType === "DEPOSIT") {
        for (const bank of account.bankAccounts ?? []) {
          const bankTxs = this.mapBankTransactions(bank, account.fipId);
          transactions.push(...bankTxs);
        }
      }
    }

    this.logger.log(`AA fetchTransactions: mapped ${transactions.length} transactions`);
    return transactions;
  }

  // -- AA Session & Fetch helpers -------------------------------------------

  /**
   * Decrypts the stored encrypted consent/session token from credentials.
   */
  resolveSession(credentials: Record<string, any>): {
    sessionToken: AaEncryptedConsentToken;
    baseUrl: string;
    authHeader: Record<string, string>;
  } {
    if (!credentials.encryptedConsentToken) {
      throw new UnauthorizedException(
        "AA credentials missing encryptedConsentToken. Run connect() and verifyOtp() first.",
      );
    }

    const sessionToken = this.encryptionService.decryptObject<AaEncryptedConsentToken>(
      credentials.encryptedConsentToken,
    );

    if (sessionToken.consentStatus !== "ACTIVE") {
      throw new UnauthorizedException(
        `AA consent is not ACTIVE (current status: ${sessionToken.consentStatus})`,
      );
    }

    if (!sessionToken.sessionId) {
      throw new UnauthorizedException(
        "AA session token is missing sessionId. Ensure verifyOtp() was called successfully.",
      );
    }

    const baseUrl = this.resolveGatewayUrl(sessionToken.aaHandle);
    const authHeader = this.buildAuthHeader({ ...credentials, aaHandle: sessionToken.aaHandle });

    return { sessionToken, baseUrl, authHeader };
  }

  /**
   * Calls the AA FI fetch endpoint and parses the response
   * into a typed AaAccountPayloadDto[].
   */
  private async fetchFiData(
    sessionToken: AaEncryptedConsentToken,
    baseUrl: string,
    authHeader: Record<string, string>,
    consentId: string,
  ): Promise<AaAccountPayloadDto[]> {
    try {
      const response = await this.httpClient.get<any>(`${baseUrl}/FI/fetch/${consentId}`, {
        ...authHeader,
        "x-session-token": sessionToken.sessionId!,
      });

      // Handle both Setu-style { FI: [...] } and Finvu-style { data: { accounts: [...] } }
      const rawAccounts: any[] =
        response?.FI ?? response?.data?.accounts ?? response?.accounts ?? [];

      return rawAccounts.map((acc: any) => this.parseRawFiAccount(acc));
    } catch (err: any) {
      this.logger.error(`AA FI fetch failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Normalises a raw AA FI account response object into AaAccountPayloadDto.
   * Handles both Setu and Finvu response formats.
   */
  private parseRawFiAccount(raw: any): AaAccountPayloadDto {
    const fiType: AaFiType = raw.fiType ?? raw.fi_type ?? raw.type ?? "DEPOSIT";
    const fipId: string = raw.fipId ?? raw.fip_id ?? raw.fip ?? "UNKNOWN_FIP";

    const payload = new AaAccountPayloadDto();
    payload.fipId = fipId;
    payload.fiType = fiType;

    const data = raw.data ?? raw.decryptedData ?? raw.FIData ?? {};
    const profile = data.Profile ?? data.profile ?? {};
    const summary = data.Summary ?? data.summary ?? {};
    const txns: any[] = data.Transactions?.Transaction ?? data.transactions ?? [];

    switch (fiType) {
      case "DEPOSIT": {
        const holders = profile.Holders?.Holder ?? [profile.Holders ?? {}];
        const holderArr = Array.isArray(holders) ? holders : [holders];
        payload.bankAccounts = holderArr.map((h: any): AaBankAccountData => ({
          maskedAccNumber:
            summary.currentBalance !== undefined
              ? (h.dob ?? h.pan ?? "XXXX")
              : (h.maskedAccNumber ?? h.masked_acc_number ?? "XXXX"),
          ifsc: profile.Holders?.ifscCode ?? h.ifscCode ?? h.ifsc ?? "",
          bankName: fipId,
          accountType: summary.accountType ?? "SAVINGS",
          currentBalance: String(summary.currentBalance ?? "0"),
          availableBalance: String(summary.availableBalance ?? summary.currentBalance ?? "0"),
          currency: summary.currency ?? "INR",
          transactions: txns.map((t: any): AaBankTransactionData => ({
            txnId: t.txnId ?? t.transactionId ?? t.id ?? String(Date.now()),
            type: (t.type ?? t.transactionType ?? "CREDIT").toUpperCase() as "CREDIT" | "DEBIT",
            mode: t.mode ?? "OTHER",
            amount: String(t.amount ?? "0"),
            currentBalance: String(t.currentBalance ?? "0"),
            transactionTimestamp: t.transactionTimestamp ?? t.date ?? new Date().toISOString(),
            narration: t.narration ?? t.description ?? t.remarks,
            reference: t.reference ?? t.refNum,
          })),
        }));
        break;
      }

      case "TERM_DEPOSIT":
      case "RECURRING_DEPOSIT": {
        payload.termDeposits = [
          {
            maskedAccNumber: summary.accountNumber ?? profile.Holders?.Holder?.[0]?.dob ?? "XXXX",
            bankName: fipId,
            principalAmount: String(summary.principalAmount ?? "0"),
            maturityAmount: String(summary.maturityAmount ?? "0"),
            interestRate: String(summary.interestRate ?? "0"),
            depositDate: summary.openingDate ?? new Date().toISOString(),
            maturityDate: summary.maturityDate ?? new Date().toISOString(),
            tenorDays: summary.tenorDays,
            currency: summary.currency ?? "INR",
          },
        ];
        break;
      }

      case "EQUITIES": {
        const equities: any[] = summary.Holding ?? data.holdings ?? [];
        payload.dematHoldings = (Array.isArray(equities) ? equities : []).map(
          (eq: any): AaDematHoldingData => ({
            isin: eq.isin ?? eq.ISIN ?? "",
            symbol: eq.symbol ?? eq.tradingSymbol,
            issuerName: eq.issuerName ?? eq.companyName ?? "",
            units: String(eq.units ?? eq.quantity ?? "0"),
            ltp: eq.ltp != null ? String(eq.ltp) : undefined,
            avgCostPrice: eq.avgCostPrice != null ? String(eq.avgCostPrice) : undefined,
            closingPrice: eq.closingPrice != null ? String(eq.closingPrice) : undefined,
            exchangeCode: eq.exchangeCode ?? eq.exchange,
          }),
        );
        break;
      }

      case "MUTUAL_FUNDS": {
        const funds: any[] = summary.InvestmentAccount ?? data.holdings ?? [];
        payload.mutualFunds = (Array.isArray(funds) ? funds : []).map(
          (mf: any): AaMutualFundData => ({
            amc: mf.amc ?? mf.amcName ?? "",
            schemeCode: mf.schemeCode ?? mf.scheme_code ?? "",
            schemeName: mf.schemeName ?? mf.scheme_name ?? "",
            folioNo: mf.folioNo ?? mf.folio_no ?? "",
            isin: mf.isin ?? mf.ISIN,
            units: String(mf.units ?? mf.closingUnits ?? "0"),
            nav: mf.nav != null ? String(mf.nav) : undefined,
            currentValue: mf.currentValue != null ? String(mf.currentValue) : undefined,
            investedValue: mf.investedValue != null ? String(mf.investedValue) : undefined,
            dividendType: mf.dividendType ?? mf.dividend_type,
            sipRegNo: mf.sipRegNo,
          }),
        );
        break;
      }

      default:
        this.logger.warn(`parseRawFiAccount: Unhandled FI type '${fiType}'`);
    }

    return payload;
  }

  // -- Mapping methods: AA payload ? internal holding types ----------------

  /**
   * Maps a bank/deposit account to an internal holding.
   * Balance is represented as quantity (INR units) with CASH asset class.
   */
  mapBankAccount(account: AaBankAccountData, fipId: string): RawExternalHolding {
    const balance = parseFloat(account.currentBalance ?? "0");
    const symbol = `BANK_${(account.ifsc || fipId).toUpperCase()}_${account.maskedAccNumber.slice(-4)}`;

    return {
      symbol,
      name: `${account.bankName} (${account.accountType}) � ${account.maskedAccNumber}`,
      quantity: isNaN(balance) ? 0 : balance,
      avgCostBasis: 1, // 1:1 INR; cost basis for cash = face value
      currentPrice: 1,
      assetClassCode: AssetClassCode.CASH,
      currency: (account.currency ?? "INR").toUpperCase(),
      externalRefId: `aa-bank-${fipId}-${account.maskedAccNumber.slice(-6)}`,
    };
  }

  /**
   * Maps a term deposit / FD to an internal holding.
   * Principal amount is represented as quantity (INR units) with FIXED_DEPOSITS class.
   */
  mapTermDeposit(fd: AaTermDepositData, fipId: string): RawExternalHolding {
    const principal = parseFloat(fd.principalAmount ?? "0");
    const maturity = parseFloat(fd.maturityAmount ?? fd.principalAmount ?? "0");
    const symbol = `FD_${(fd.bankName || fipId).toUpperCase().replace(/\s+/g, "_")}_${fd.maskedAccNumber.slice(-4)}`;

    return {
      symbol,
      name: `FD � ${fd.bankName} @ ${fd.interestRate}% (matures ${fd.maturityDate.slice(0, 10)})`,
      quantity: isNaN(principal) ? 0 : principal,
      avgCostBasis: 1,
      currentPrice: isNaN(maturity) || principal === 0 ? 1 : maturity / principal,
      assetClassCode: AssetClassCode.FIXED_DEPOSITS,
      currency: (fd.currency ?? "INR").toUpperCase(),
      externalRefId: `aa-fd-${fipId}-${fd.maskedAccNumber.slice(-6)}`,
    };
  }

  /**
   * Maps a Demat equity holding to an internal holding.
   * Uses ISIN as the primary symbol; NSE/BSE ticker used if available.
   */
  mapDematHolding(holding: AaDematHoldingData, fipId: string): RawExternalHolding {
    const units = parseFloat(holding.units ?? "0");
    const ltp = holding.ltp != null ? parseFloat(holding.ltp) : undefined;
    const avgCost = holding.avgCostPrice != null ? parseFloat(holding.avgCostPrice) : undefined;
    const symbol = (holding.symbol ?? holding.isin ?? "UNKNOWN").toUpperCase();

    return {
      symbol,
      name: holding.issuerName || symbol,
      quantity: isNaN(units) ? 0 : units,
      avgCostBasis: avgCost != null && !isNaN(avgCost) ? avgCost : undefined,
      currentPrice: ltp != null && !isNaN(ltp) ? ltp : undefined,
      assetClassCode: AssetClassCode.STOCKS,
      currency: "INR",
      externalRefId: `aa-demat-${fipId}-${holding.isin}`,
    };
  }

  /**
   * Maps a Mutual Fund folio to an internal holding.
   * Units are the quantity; NAV is the current price.
   */
  mapMutualFund(mf: AaMutualFundData, fipId: string): RawExternalHolding {
    const units = parseFloat(mf.units ?? "0");
    const nav = mf.nav != null ? parseFloat(mf.nav) : undefined;
    const currentValue = mf.currentValue != null ? parseFloat(mf.currentValue) : undefined;
    const investedValue = mf.investedValue != null ? parseFloat(mf.investedValue) : undefined;

    // avgCostBasis per unit = investedValue / units
    let avgCostPerUnit: number | undefined;
    if (investedValue != null && !isNaN(investedValue) && units > 0) {
      avgCostPerUnit = investedValue / units;
    }

    // Use currentValue / units as currentPrice if NAV not explicitly given
    let currentPrice = nav != null && !isNaN(nav) ? nav : undefined;
    if (currentPrice == null && currentValue != null && !isNaN(currentValue) && units > 0) {
      currentPrice = currentValue / units;
    }

    const symbol = (mf.isin ?? mf.schemeCode ?? "MF_UNKNOWN").toUpperCase();

    return {
      symbol,
      name: `${mf.schemeName} (${mf.amc}) � Folio ${mf.folioNo}`,
      quantity: isNaN(units) ? 0 : units,
      avgCostBasis: avgCostPerUnit,
      currentPrice,
      assetClassCode: AssetClassCode.MUTUAL_FUNDS,
      currency: "INR",
      externalRefId: `aa-mf-${fipId}-${mf.folioNo}`,
    };
  }

  /**
   * Maps bank credit/debit transactions from an AA bank account
   * to internal RawExternalTransaction records.
   */
  mapBankTransactions(account: AaBankAccountData, fipId: string): RawExternalTransaction[] {
    const symbol = `BANK_${(account.ifsc || fipId).toUpperCase()}_${account.maskedAccNumber.slice(-4)}`;

    return (account.transactions ?? []).map((tx): RawExternalTransaction => {
      const amount = parseFloat(tx.amount ?? "0");
      const txType = tx.type === "CREDIT" ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL;

      return {
        symbol,
        type: txType,
        quantity: isNaN(amount) ? 0 : Math.abs(amount),
        pricePerUnit: 1, // 1:1 INR
        fees: 0,
        transactedAt: tx.transactionTimestamp ? new Date(tx.transactionTimestamp) : new Date(),
        notes: tx.narration ?? `AA Bank ${tx.type} via ${tx.mode}`,
        providerRefId: `aa-bank-tx-${tx.txnId}`,
        assetClassCode: AssetClassCode.CASH,
        currency: "INR",
      };
    });
  }

  // -- Private helpers ------------------------------------------------------

  /** Resolves the base gateway URL for a given AA handle */
  resolveGatewayUrl(aaHandle: AaHandle): string {
    const url = AA_GATEWAY_URLS[aaHandle];
    if (!url) {
      throw new Error(
        `Unknown AA handle: '${aaHandle}'. Supported: setu | finvu | sahamati | onemoney`,
      );
    }
    return url;
  }

  /** Constructs the Authorization header using the client credentials */
  private buildAuthHeader(credentials: Record<string, any>): Record<string, string> {
    return {
      Authorization: `Bearer ${credentials.clientSecret ?? credentials.accessToken ?? ""}`,
      "x-client-id": credentials.clientId ?? "",
    };
  }

  /** Builds a CreateAaConsentDto from raw credentials map */
  private buildConsentDto(credentials: Record<string, any>): CreateAaConsentDto {
    const dto = new CreateAaConsentDto();
    dto.aaHandle = credentials.aaHandle as AaHandle;
    dto.userId = credentials.userId ?? "";
    dto.portfolioId = credentials.portfolioId ?? "";
    dto.vua = credentials.vua;
    dto.fiTypes = credentials.fiTypes ?? DEFAULT_FI_TYPES;
    dto.dataDateRange = credentials.dataDateRange;
    return dto;
  }

  /** Generates a UUID-like transaction ID for AA requests */
  private generateTxnId(): string {
    return `txn-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
}
