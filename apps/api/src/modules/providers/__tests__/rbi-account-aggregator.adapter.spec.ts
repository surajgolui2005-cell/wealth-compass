import { AssetClassCode, TransactionType } from "@prisma/client";
import { EncryptionService } from "../../../common/crypto/encryption.service";
import {
  AaBankAccountData,
  AaDematHoldingData,
  AaMutualFundData,
  AaTermDepositData,
  AaEncryptedConsentToken,
  AaHandle,
} from "../adapters/rbi-aa.dto";
import {
  AaHttpClient,
  RbiAccountAggregatorAdapter,
} from "../adapters/rbi-account-aggregator.adapter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEncryptionService(): EncryptionService {
  return new EncryptionService(undefined, "test_key_for_aa_adapter_32bytes!");
}

function buildAdapter(
  httpClient: AaHttpClient = { post: jest.fn(), get: jest.fn() },
  encryptionService?: EncryptionService,
): RbiAccountAggregatorAdapter {
  const enc = encryptionService ?? buildEncryptionService();
  return new RbiAccountAggregatorAdapter(enc, httpClient);
}

// ---------------------------------------------------------------------------
// Setu-style AA JSON fixtures
// ---------------------------------------------------------------------------

const SETU_BANK_FI_RESPONSE = {
  FI: [
    {
      fiType: "DEPOSIT",
      fipId: "HDFC-FIP",
      data: {
        Profile: {
          Holders: {
            ifscCode: "HDFC0001234",
            Holder: [{ pan: "ABCDE1234F", dob: "1990-01-01" }],
          },
        },
        Summary: {
          accountType: "SAVINGS",
          currentBalance: "125000.50",
          availableBalance: "124500.00",
          currency: "INR",
        },
        Transactions: {
          Transaction: [
            {
              txnId: "txn-001",
              type: "CREDIT",
              mode: "NEFT",
              amount: "50000",
              currentBalance: "125000.50",
              transactionTimestamp: "2026-08-01T10:30:00Z",
              narration: "Salary Credit Aug 2026",
            },
            {
              txnId: "txn-002",
              type: "DEBIT",
              mode: "UPI",
              amount: "1200.75",
              currentBalance: "123799.75",
              transactionTimestamp: "2026-08-05T15:45:00Z",
              narration: "UPI Payment - Swiggy",
            },
          ],
        },
      },
    },
  ],
};

const SETU_FD_FI_RESPONSE = {
  FI: [
    {
      fiType: "TERM_DEPOSIT",
      fipId: "SBI-FIP",
      data: {
        Profile: {
          Holders: {
            Holder: [{ pan: "XYZAB5678G" }],
          },
        },
        Summary: {
          accountNumber: "XXXX9876",
          principalAmount: "500000",
          maturityAmount: "563750",
          interestRate: "7.25",
          openingDate: "2025-06-01T00:00:00Z",
          maturityDate: "2026-06-01T00:00:00Z",
          tenorDays: 365,
          currency: "INR",
        },
        Transactions: { Transaction: [] },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Finvu-style AA JSON fixtures
// ---------------------------------------------------------------------------

const FINVU_DEMAT_FI_RESPONSE = {
  data: {
    accounts: [
      {
        fiType: "EQUITIES",
        fip_id: "CDSL-FIP",
        data: {
          Summary: {
            Holding: [
              {
                isin: "INE009A01021",
                symbol: "INFY",
                issuerName: "Infosys Ltd",
                units: "100",
                ltp: "1820.50",
                avgCostPrice: "1450.00",
                exchangeCode: "NSE",
              },
              {
                isin: "INE040A01034",
                symbol: "HDFCBANK",
                issuerName: "HDFC Bank Ltd",
                units: "50",
                ltp: "1650.25",
                avgCostPrice: "1200.00",
                exchangeCode: "BSE",
              },
            ],
          },
        },
      },
    ],
  },
};

const FINVU_MF_FI_RESPONSE = {
  data: {
    accounts: [
      {
        fiType: "MUTUAL_FUNDS",
        fip_id: "CAMS-FIP",
        data: {
          Summary: {
            InvestmentAccount: [
              {
                amc: "Mirae Asset",
                schemeCode: "INF769K01010",
                schemeName: "Mirae Asset Large Cap Fund - Growth",
                folioNo: "12345678",
                isin: "INF769K01010",
                units: "250.432",
                nav: "96.87",
                currentValue: "24267.39",
                investedValue: "20000",
                dividendType: "GROWTH",
              },
              {
                amc: "Axis AMC",
                schemeCode: "INF846K01DP8",
                schemeName: "Axis Bluechip Fund - Growth",
                folioNo: "87654321",
                isin: "INF846K01DP8",
                units: "150",
                nav: "52.10",
                currentValue: "7815.00",
                investedValue: "6500",
                dividendType: "GROWTH",
              },
            ],
          },
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Suite 1: validateConfig()
// ---------------------------------------------------------------------------

describe("RbiAccountAggregatorAdapter.validateConfig()", () => {
  const adapter = buildAdapter();

  it("should accept valid setu config", () => {
    expect(adapter.validateConfig({ aaHandle: "setu", clientId: "my-client-id" })).toBe(true);
  });

  it("should accept valid finvu config", () => {
    expect(adapter.validateConfig({ aaHandle: "finvu", clientId: "finvu-id" })).toBe(true);
  });

  it("should accept valid onemoney config", () => {
    expect(adapter.validateConfig({ aaHandle: "onemoney", clientId: "om-id" })).toBe(true);
  });

  it("should accept valid sahamati config", () => {
    expect(adapter.validateConfig({ aaHandle: "sahamati", clientId: "saha-id" })).toBe(true);
  });

  it("should reject unknown AA handle", () => {
    expect(adapter.validateConfig({ aaHandle: "unknown_aa", clientId: "id" })).toBe(false);
  });

  it("should reject missing clientId", () => {
    expect(adapter.validateConfig({ aaHandle: "setu" })).toBe(false);
  });

  it("should reject empty clientId", () => {
    expect(adapter.validateConfig({ aaHandle: "setu", clientId: "" })).toBe(false);
  });

  it("should reject null config", () => {
    expect(adapter.validateConfig(null as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: getProviderCode() and resolveGatewayUrl()
// ---------------------------------------------------------------------------

describe("RbiAccountAggregatorAdapter identity and gateway resolution", () => {
  const adapter = buildAdapter();

  it("should return provider code RBI_AA", () => {
    expect(adapter.getProviderCode()).toBe("RBI_AA");
  });

  it.each<[AaHandle, string]>([
    ["setu", "https://fiu-uat.setu.co/v2"],
    ["finvu", "https://webfinvu.in/v1"],
    ["sahamati", "https://api.sahamati.org.in/v1"],
    ["onemoney", "https://onemoney.in/v1"],
  ])("resolveGatewayUrl(%s) ? %s", (handle, expected) => {
    expect(adapter.resolveGatewayUrl(handle)).toBe(expected);
  });

  it("should throw for unknown handle", () => {
    expect(() => adapter.resolveGatewayUrl("bad_aa" as AaHandle)).toThrow(/Unknown AA handle/);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: AES-256-GCM consent token roundtrip
// ---------------------------------------------------------------------------

describe("AES-256-GCM consent token encryption roundtrip", () => {
  it("should encrypt consent token and decrypt to identical values", () => {
    const enc = buildEncryptionService();
    const adapter = buildAdapter(undefined, enc);

    const token: AaEncryptedConsentToken = {
      aaHandle: "setu",
      consentId: "consent-setu-abc123",
      consentHandle: "CH-setu-abc123",
      sessionId: "sess-xyz789",
      vua: "user@setu",
      consentStatus: "ACTIVE",
      createdAt: "2026-09-01T00:00:00Z",
      expiresAt: "2027-09-01T00:00:00Z",
    };

    const encrypted = enc.encryptObject(token);

    // Ciphertext must not contain any plaintext field values
    expect(encrypted).not.toContain("consent-setu-abc123");
    expect(encrypted).not.toContain("sess-xyz789");
    expect(encrypted).not.toContain("user@setu");

    // Must be in iv:authTag:ciphertext format
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12-byte IV = 24 hex chars
    expect(parts[1]).toHaveLength(32); // 16-byte auth tag = 32 hex chars

    const decrypted = enc.decryptObject<AaEncryptedConsentToken>(encrypted);
    expect(decrypted.consentId).toBe(token.consentId);
    expect(decrypted.sessionId).toBe(token.sessionId);
    expect(decrypted.aaHandle).toBe(token.aaHandle);
    expect(decrypted.consentStatus).toBe("ACTIVE");
    expect(decrypted.vua).toBe(token.vua);
  });

  it("should produce different ciphertext on each encrypt call (unique IVs)", () => {
    const enc = buildEncryptionService();
    const payload = { consentId: "c1", sessionId: "s1" };
    const enc1 = enc.encryptObject(payload);
    const enc2 = enc.encryptObject(payload);
    expect(enc1).not.toBe(enc2); // Different IVs ? different ciphertext
  });

  it("resolveSession() should throw when encryptedConsentToken is missing", () => {
    const adapter = buildAdapter();
    expect(() => adapter.resolveSession({})).toThrow(/encryptedConsentToken/);
  });

  it("resolveSession() should throw when consent is not ACTIVE", () => {
    const enc = buildEncryptionService();
    const adapter = buildAdapter(undefined, enc);
    const pendingToken: AaEncryptedConsentToken = {
      aaHandle: "setu",
      consentId: "c1",
      consentHandle: "ch1",
      sessionId: "s1",
      consentStatus: "PENDING",
      createdAt: new Date().toISOString(),
    };
    const encrypted = enc.encryptObject(pendingToken);
    expect(() => adapter.resolveSession({ encryptedConsentToken: encrypted })).toThrow(
      /not ACTIVE/,
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Setu bank account payload mapping
// ---------------------------------------------------------------------------

describe("mapBankAccount() � Setu DEPOSIT payload", () => {
  const adapter = buildAdapter();

  const bankAccount: AaBankAccountData = {
    maskedAccNumber: "XXXX1234",
    ifsc: "HDFC0001234",
    bankName: "HDFC Bank",
    accountType: "SAVINGS",
    currentBalance: "125000.50",
    availableBalance: "124500.00",
    currency: "INR",
  };

  it("should map to CASH asset class", () => {
    const holding = adapter.mapBankAccount(bankAccount, "HDFC-FIP");
    expect(holding.assetClassCode).toBe(AssetClassCode.CASH);
  });

  it("should use balance as quantity (INR units)", () => {
    const holding = adapter.mapBankAccount(bankAccount, "HDFC-FIP");
    expect(holding.quantity).toBeCloseTo(125000.5);
  });

  it("should set currency to INR", () => {
    const holding = adapter.mapBankAccount(bankAccount, "HDFC-FIP");
    expect(holding.currency).toBe("INR");
  });

  it("should set avgCostBasis and currentPrice to 1 for cash", () => {
    const holding = adapter.mapBankAccount(bankAccount, "HDFC-FIP");
    expect(holding.avgCostBasis).toBe(1);
    expect(holding.currentPrice).toBe(1);
  });

  it("should embed IFSC in the symbol", () => {
    const holding = adapter.mapBankAccount(bankAccount, "HDFC-FIP");
    expect(holding.symbol).toContain("HDFC0001234");
  });

  it("should embed last 4 digits of masked account number in symbol", () => {
    const holding = adapter.mapBankAccount(bankAccount, "HDFC-FIP");
    expect(holding.symbol).toContain("1234");
  });

  it("should handle 0 balance gracefully", () => {
    const zeroBalance = { ...bankAccount, currentBalance: "0" };
    const holding = adapter.mapBankAccount(zeroBalance, "HDFC-FIP");
    expect(holding.quantity).toBe(0);
  });

  it("should embed fipId in externalRefId", () => {
    const holding = adapter.mapBankAccount(bankAccount, "HDFC-FIP");
    expect(holding.externalRefId).toContain("HDFC-FIP");
  });
});

// ---------------------------------------------------------------------------
// Suite 5: FD / Term Deposit payload mapping
// ---------------------------------------------------------------------------

describe("mapTermDeposit() � Setu TERM_DEPOSIT payload", () => {
  const adapter = buildAdapter();

  const fd: AaTermDepositData = {
    maskedAccNumber: "XXXX9876",
    bankName: "SBI",
    principalAmount: "500000",
    maturityAmount: "563750",
    interestRate: "7.25",
    depositDate: "2025-06-01T00:00:00Z",
    maturityDate: "2026-06-01T00:00:00Z",
    tenorDays: 365,
    currency: "INR",
  };

  it("should map to FIXED_DEPOSITS asset class", () => {
    const holding = adapter.mapTermDeposit(fd, "SBI-FIP");
    expect(holding.assetClassCode).toBe(AssetClassCode.FIXED_DEPOSITS);
  });

  it("should set quantity to principal amount", () => {
    const holding = adapter.mapTermDeposit(fd, "SBI-FIP");
    expect(holding.quantity).toBe(500000);
  });

  it("should encode maturity/principal ratio as currentPrice", () => {
    const holding = adapter.mapTermDeposit(fd, "SBI-FIP");
    // 563750 / 500000 = 1.1275
    expect(holding.currentPrice).toBeCloseTo(1.1275, 4);
  });

  it("should embed interest rate and maturity date in name", () => {
    const holding = adapter.mapTermDeposit(fd, "SBI-FIP");
    expect(holding.name).toContain("7.25%");
    expect(holding.name).toContain("2026-06-01");
  });

  it("should set currency to INR", () => {
    const holding = adapter.mapTermDeposit(fd, "SBI-FIP");
    expect(holding.currency).toBe("INR");
  });

  it("should embed SBI in symbol", () => {
    const holding = adapter.mapTermDeposit(fd, "SBI-FIP");
    expect(holding.symbol).toContain("SBI");
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Demat / Equity holdings mapping (Finvu format)
// ---------------------------------------------------------------------------

describe("mapDematHolding() � Finvu EQUITIES payload", () => {
  const adapter = buildAdapter();

  const infy: AaDematHoldingData = {
    isin: "INE009A01021",
    symbol: "INFY",
    issuerName: "Infosys Ltd",
    units: "100",
    ltp: "1820.50",
    avgCostPrice: "1450.00",
    exchangeCode: "NSE",
  };

  it("should map to STOCKS asset class", () => {
    const holding = adapter.mapDematHolding(infy, "CDSL-FIP");
    expect(holding.assetClassCode).toBe(AssetClassCode.STOCKS);
  });

  it("should use NSE symbol as holding symbol", () => {
    const holding = adapter.mapDematHolding(infy, "CDSL-FIP");
    expect(holding.symbol).toBe("INFY");
  });

  it("should set quantity from units", () => {
    const holding = adapter.mapDematHolding(infy, "CDSL-FIP");
    expect(holding.quantity).toBe(100);
  });

  it("should set currentPrice from LTP", () => {
    const holding = adapter.mapDematHolding(infy, "CDSL-FIP");
    expect(holding.currentPrice).toBeCloseTo(1820.5);
  });

  it("should set avgCostBasis from avgCostPrice", () => {
    const holding = adapter.mapDematHolding(infy, "CDSL-FIP");
    expect(holding.avgCostBasis).toBeCloseTo(1450.0);
  });

  it("should set currency to INR", () => {
    const holding = adapter.mapDematHolding(infy, "CDSL-FIP");
    expect(holding.currency).toBe("INR");
  });

  it("should fallback to ISIN when symbol is missing", () => {
    const noSymbol = { ...infy, symbol: undefined };
    const holding = adapter.mapDematHolding(noSymbol, "CDSL-FIP");
    expect(holding.symbol).toBe("INE009A01021");
  });

  it("should embed ISIN in externalRefId", () => {
    const holding = adapter.mapDematHolding(infy, "CDSL-FIP");
    expect(holding.externalRefId).toContain("INE009A01021");
  });

  it("should handle missing LTP and avgCostPrice gracefully", () => {
    const noPrice = { ...infy, ltp: undefined, avgCostPrice: undefined };
    const holding = adapter.mapDematHolding(noPrice, "CDSL-FIP");
    expect(holding.currentPrice).toBeUndefined();
    expect(holding.avgCostBasis).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 7: Mutual Fund folio mapping (Finvu format)
// ---------------------------------------------------------------------------

describe("mapMutualFund() � Finvu MUTUAL_FUNDS payload", () => {
  const adapter = buildAdapter();

  const miraeMF: AaMutualFundData = {
    amc: "Mirae Asset",
    schemeCode: "INF769K01010",
    schemeName: "Mirae Asset Large Cap Fund - Growth",
    folioNo: "12345678",
    isin: "INF769K01010",
    units: "250.432",
    nav: "96.87",
    currentValue: "24267.39",
    investedValue: "20000",
    dividendType: "GROWTH",
  };

  it("should map to MUTUAL_FUNDS asset class", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    expect(holding.assetClassCode).toBe(AssetClassCode.MUTUAL_FUNDS);
  });

  it("should use ISIN as symbol", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    expect(holding.symbol).toBe("INF769K01010");
  });

  it("should set quantity from units (decimal precision)", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    expect(holding.quantity).toBeCloseTo(250.432, 3);
  });

  it("should set currentPrice from NAV", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    expect(holding.currentPrice).toBeCloseTo(96.87);
  });

  it("should compute avgCostBasis as investedValue / units", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    // 20000 / 250.432 � 79.86
    expect(holding.avgCostBasis).toBeCloseTo(79.86, 1);
  });

  it("should set currency to INR", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    expect(holding.currency).toBe("INR");
  });

  it("should embed schemeName and AMC in name", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    expect(holding.name).toContain("Mirae Asset");
    expect(holding.name).toContain("Mirae Asset Large Cap Fund");
  });

  it("should embed folioNo in externalRefId", () => {
    const holding = adapter.mapMutualFund(miraeMF, "CAMS-FIP");
    expect(holding.externalRefId).toContain("12345678");
  });

  it("should fallback currentPrice to currentValue/units when NAV missing", () => {
    const noNav = { ...miraeMF, nav: undefined };
    const holding = adapter.mapMutualFund(noNav, "CAMS-FIP");
    // 24267.39 / 250.432 � 96.9
    expect(holding.currentPrice).toBeCloseTo(96.9, 0);
  });

  it("should fallback symbol to schemeCode when ISIN missing", () => {
    const noIsin = { ...miraeMF, isin: undefined };
    const holding = adapter.mapMutualFund(noIsin, "CAMS-FIP");
    expect(holding.symbol).toBe("INF769K01010"); // schemeCode
  });
});

// ---------------------------------------------------------------------------
// Suite 8: Bank transaction mapping
// ---------------------------------------------------------------------------

describe("mapBankTransactions() � bank DEPOSIT/WITHDRAWAL", () => {
  const adapter = buildAdapter();

  const bankAccount: AaBankAccountData = {
    maskedAccNumber: "XXXX1234",
    ifsc: "HDFC0001234",
    bankName: "HDFC Bank",
    accountType: "SAVINGS",
    currentBalance: "125000.50",
    currency: "INR",
    transactions: [
      {
        txnId: "txn-001",
        type: "CREDIT",
        mode: "NEFT",
        amount: "50000",
        currentBalance: "125000.50",
        transactionTimestamp: "2026-08-01T10:30:00Z",
        narration: "Salary Credit Aug 2026",
      },
      {
        txnId: "txn-002",
        type: "DEBIT",
        mode: "UPI",
        amount: "1200.75",
        currentBalance: "123799.75",
        transactionTimestamp: "2026-08-05T15:45:00Z",
        narration: "UPI Payment - Swiggy",
      },
    ],
  };

  it("should return two transactions from two bank entries", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    expect(txns).toHaveLength(2);
  });

  it("should map CREDIT to DEPOSIT transaction type", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    const credit = txns[0];
    expect(credit.type).toBe(TransactionType.DEPOSIT);
  });

  it("should map DEBIT to WITHDRAWAL transaction type", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    const debit = txns[1];
    expect(debit.type).toBe(TransactionType.WITHDRAWAL);
  });

  it("should set quantity from amount (decimal precision)", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    expect(txns[0].quantity).toBe(50000);
    expect(txns[1].quantity).toBeCloseTo(1200.75);
  });

  it("should set pricePerUnit to 1 for cash transactions", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    txns.forEach((t) => expect(t.pricePerUnit).toBe(1));
  });

  it("should map CASH asset class", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    txns.forEach((t) => expect(t.assetClassCode).toBe(AssetClassCode.CASH));
  });

  it("should use INR currency", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    txns.forEach((t) => expect(t.currency).toBe("INR"));
  });

  it("should parse transactionTimestamp into a Date", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    expect(txns[0].transactedAt).toBeInstanceOf(Date);
    expect(txns[0].transactedAt.toISOString()).toContain("2026-08-01");
  });

  it("should embed narration in notes", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    expect(txns[0].notes).toContain("Salary Credit Aug 2026");
  });

  it("should embed txnId in providerRefId", () => {
    const txns = adapter.mapBankTransactions(bankAccount, "HDFC-FIP");
    expect(txns[0].providerRefId).toContain("txn-001");
  });

  it("should return empty array when no transactions", () => {
    const noTxns = { ...bankAccount, transactions: [] };
    const txns = adapter.mapBankTransactions(noTxns, "HDFC-FIP");
    expect(txns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 9: connect() � consent creation with mock HTTP
// ---------------------------------------------------------------------------

describe("connect() � AA consent creation with mock HTTP client", () => {
  it("should call POST /Consent with correct body shape and encrypt returned consentId", async () => {
    const enc = buildEncryptionService();
    const mockHttp: AaHttpClient = {
      post: jest.fn().mockResolvedValue({
        ConsentHandle: "CH-setu-xyzabc",
        status: "PENDING",
      }),
      get: jest.fn(),
    };
    const adapter = buildAdapter(mockHttp, enc);

    const credentials = {
      aaHandle: "setu",
      clientId: "test-client",
      clientSecret: "test-secret",
      userId: "user-123",
      portfolioId: "port-456",
      vua: "user-123@setu",
    };

    const result = await adapter.connect(credentials);

    // Verify HTTP call
    expect(mockHttp.post).toHaveBeenCalledTimes(1);
    const [url, body] = (mockHttp.post as jest.Mock).mock.calls[0];
    expect(url).toContain("setu.co");
    expect(url).toContain("/Consent");
    expect(body).toHaveProperty("ConsentDetail");
    expect(body.ConsentDetail).toHaveProperty("Customer");
    expect(body.ConsentDetail.Customer.id).toContain("setu");

    // Verify encrypted token returned
    expect(result.connected).toBe(true);
    expect(typeof result.encryptedConsentToken).toBe("string");

    // Decrypt token to verify contents
    const token = enc.decryptObject<{ consentId: string; aaHandle: string }>(
      result.encryptedConsentToken!,
    );
    expect(token.consentId).toBe("CH-setu-xyzabc");
    expect(token.aaHandle).toBe("setu");
  });

  it("should throw UnauthorizedException on AA gateway error", async () => {
    const mockHttp: AaHttpClient = {
      post: jest.fn().mockRejectedValue(new Error("Gateway timeout")),
      get: jest.fn(),
    };
    const adapter = buildAdapter(mockHttp);

    await expect(
      adapter.connect({
        aaHandle: "setu",
        clientId: "client",
        clientSecret: "secret",
        userId: "u1",
        portfolioId: "p1",
      }),
    ).rejects.toThrow(/Gateway timeout/);
  });
});

// ---------------------------------------------------------------------------
// Suite 10: fetchHoldings() end-to-end with mock HTTP (Setu format)
// ---------------------------------------------------------------------------

describe("fetchHoldings() � Setu AA complete flow with mock HTTP", () => {
  it("should parse Setu bank FI response and return CASH holdings", async () => {
    const enc = buildEncryptionService();

    const activeToken: AaEncryptedConsentToken = {
      aaHandle: "setu",
      consentId: "consent-123",
      consentHandle: "CH-123",
      sessionId: "sess-abc",
      consentStatus: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    const mockHttp: AaHttpClient = {
      post: jest.fn(),
      get: jest.fn().mockResolvedValue(SETU_BANK_FI_RESPONSE),
    };

    const adapter = buildAdapter(mockHttp, enc);
    const encryptedToken = enc.encryptObject(activeToken);

    const holdings = await adapter.fetchHoldings({
      aaHandle: "setu",
      clientId: "client",
      clientSecret: "secret",
      encryptedConsentToken: encryptedToken,
    });

    expect(holdings.length).toBeGreaterThan(0);
    expect(holdings[0].assetClassCode).toBe(AssetClassCode.CASH);
    expect(holdings[0].currency).toBe("INR");
    expect(holdings[0].quantity).toBeCloseTo(125000.5);
  });

  it("should parse Setu FD response and return FIXED_DEPOSITS holdings", async () => {
    const enc = buildEncryptionService();

    const activeToken: AaEncryptedConsentToken = {
      aaHandle: "setu",
      consentId: "consent-fd",
      consentHandle: "CH-fd",
      sessionId: "sess-fd",
      consentStatus: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    const mockHttp: AaHttpClient = {
      post: jest.fn(),
      get: jest.fn().mockResolvedValue(SETU_FD_FI_RESPONSE),
    };

    const adapter = buildAdapter(mockHttp, enc);
    const encryptedToken = enc.encryptObject(activeToken);

    const holdings = await adapter.fetchHoldings({
      aaHandle: "setu",
      clientId: "client",
      clientSecret: "secret",
      encryptedConsentToken: encryptedToken,
    });

    expect(holdings.length).toBeGreaterThan(0);
    expect(holdings[0].assetClassCode).toBe(AssetClassCode.FIXED_DEPOSITS);
    expect(holdings[0].quantity).toBe(500000);
    expect(holdings[0].name).toContain("7.25%");
  });
});

// ---------------------------------------------------------------------------
// Suite 11: fetchTransactions() end-to-end with mock HTTP (Finvu format)
// ---------------------------------------------------------------------------

describe("fetchTransactions() � Finvu bank transaction flow", () => {
  it("should return DEPOSIT and WITHDRAWAL transactions from bank data", async () => {
    const enc = buildEncryptionService();

    const activeToken: AaEncryptedConsentToken = {
      aaHandle: "finvu",
      consentId: "consent-finvu-tx",
      consentHandle: "CH-finvu-tx",
      sessionId: "sess-finvu",
      consentStatus: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    // Finvu format bank data with transactions
    const finvuBankResponse = {
      data: {
        accounts: [
          {
            fiType: "DEPOSIT",
            fip_id: "ICICI-FIP",
            data: {
              Profile: {
                Holders: {
                  ifscCode: "ICIC0001234",
                  Holder: [{ pan: "ABCDE1234F" }],
                },
              },
              Summary: {
                accountType: "SAVINGS",
                currentBalance: "75000",
                currency: "INR",
              },
              Transactions: {
                Transaction: [
                  {
                    txnId: "finvu-tx-001",
                    type: "CREDIT",
                    mode: "IMPS",
                    amount: "30000",
                    transactionTimestamp: "2026-07-15T09:00:00Z",
                    narration: "Freelance Payment",
                  },
                  {
                    txnId: "finvu-tx-002",
                    type: "DEBIT",
                    mode: "UPI",
                    amount: "500",
                    transactionTimestamp: "2026-07-16T12:00:00Z",
                    narration: "UPI - Recharge",
                  },
                ],
              },
            },
          },
        ],
      },
    };

    const mockHttp: AaHttpClient = {
      post: jest.fn(),
      get: jest.fn().mockResolvedValue(finvuBankResponse),
    };

    const adapter = buildAdapter(mockHttp, enc);
    const encryptedToken = enc.encryptObject(activeToken);

    const transactions = await adapter.fetchTransactions({
      aaHandle: "finvu",
      clientId: "client",
      clientSecret: "secret",
      encryptedConsentToken: encryptedToken,
    });

    expect(transactions).toHaveLength(2);

    const credit = transactions.find((t) => t.type === TransactionType.DEPOSIT);
    const debit = transactions.find((t) => t.type === TransactionType.WITHDRAWAL);

    expect(credit).toBeDefined();
    expect(credit!.quantity).toBe(30000);
    expect(credit!.currency).toBe("INR");
    expect(credit!.notes).toContain("Freelance Payment");

    expect(debit).toBeDefined();
    expect(debit!.quantity).toBe(500);
    expect(debit!.notes).toContain("UPI - Recharge");
  });
});
