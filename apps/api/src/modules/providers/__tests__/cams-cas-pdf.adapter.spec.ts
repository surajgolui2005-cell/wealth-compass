import { UnauthorizedException } from "@nestjs/common";
import { AssetClassCode, ProviderCode, TransactionType } from "@prisma/client";
import * as pdfParserUtil from "../utils/pdf-parser.util";
import { CamsCasPdfAdapter } from "../adapters/cams-cas-pdf.adapter";

describe("CamsCasPdfAdapter", () => {
  let adapter: CamsCasPdfAdapter;

  const sampleCamsText = `
Computer Age Management Services Limited (CAMS)
Consolidated Account Statement
Statement Period: 01-Jan-2024 To 30-Jun-2024
Investor Details:
Name: John Doe
Email: john.doe@example.com
Mobile: 9876543210
PAN: ABCDE1234F

HDFC Mutual Fund
Folio No: 12345/67  PAN: ABCDE1234F  KYC: OK
HDFC Top 100 Fund - Growth Option - Direct Plan - ISIN: INF179K01BE2 Registrar : CAMS
Opening Unit Balance: 100.000
Date Transaction Amount Units Price Unit Balance
15-Jan-2024 Purchase 5,000.00 50.123 99.754 150.123
15-Jan-2024 Stamp Duty 0.25 0.000 0.000 150.123
15-Feb-2024 SIP Transaction 5,000.00 48.780 102.500 198.903
10-Mar-2024 Reinvestment of IDCW @ Rs. 1.25 per unit 248.63 2.368 105.000 201.271
Closing Unit Balance: 201.271 NAV on 30-Jun-2024: INR 110.5000 Valuation on 30-Jun-2024: INR 22,240.45

Mirae Asset Mutual Fund
Folio No: 98765/43  PAN: ABCDE1234F  KYC: OK
Mirae Asset Large Cap Fund - Direct Plan - Growth - ISIN: INF769K01010 Registrar : CAMS
Opening Unit Balance: 0.000
Date Transaction Amount Units Price Unit Balance
02-Jan-2024 Initial Purchase 10,000.00 100.000 100.000 100.000
20-May-2024 Redemption (5,000.00) (40.000) 125.000 60.000
Closing Unit Balance: 60.000 NAV on 30-Jun-2024: INR 130.0000 Valuation on 30-Jun-2024: INR 7,800.00
`;

  const sampleKfintechText = `
KFin Technologies Limited
KFINTECH Consolidated Account Statement (eCAS)
Statement Period : 01-Apr-2023 To 31-Mar-2024
Investor Information:
Name: Jane Smith
Email: jane.smith@finance.in
PAN: XYZPK9876Q

Nippon India Mutual Fund
Folio Number: 987654321  PAN: XYZPK9876Q  KYC: OK
Nippon India Small Cap Fund - Growth Plan - ISIN: INF204K01E03 Registrar: KFINTECH
Opening Unit Balance: 0.000
Date Transaction Description Amount Units NAV Balance
05-Apr-2023 Systematic Investment Plan 2,500.00 25.000 100.000 25.000
15-Sep-2023 IDCW Payout @ Rs. 2.50 per unit 62.50 0.000 105.000 25.000
10-Jan-2024 Switch Out (1,050.00) (10.000) 105.000 15.000
Closing Unit Balance: 15.000 NAV on 31-Mar-2024: INR 120.0000 Valuation on 31-Mar-2024: INR 1,800.00
`;

  beforeEach(() => {
    adapter = new CamsCasPdfAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("FinancialDataProvider Interface Compliance", () => {
    it("should return CAMS_CAS as provider code", () => {
      const code = adapter.getProviderCode();
      expect(code.toString()).toBe("CAMS_CAS");
    });

    it("should validate config requiring non-empty pdfBuffer", () => {
      expect(adapter.validateConfig({})).toBe(false);
      expect(adapter.validateConfig({ pdfBuffer: null })).toBe(false);
      expect(adapter.validateConfig({ pdfBuffer: Buffer.from("") })).toBe(false);
      expect(adapter.validateConfig({ pdfBuffer: Buffer.from("PDF content") })).toBe(true);
      expect(adapter.validateConfig({ pdfBuffer: new Uint8Array([1, 2, 3]) })).toBe(true);
    });

    it("should connect successfully", async () => {
      const result = await adapter.connect({});
      expect(result.connected).toBe(true);
      expect(result.message).toContain("active");
    });
  });

  describe("Password & In-Memory Decryption Verification", () => {
    it("should decrypt password-protected buffer with correct PAN + DOB in-memory", async () => {
      const mockEncryptedBuffer = Buffer.from("FAKE_ENCRYPTED_PDF_BYTES");

      jest.spyOn(pdfParserUtil, "parseProtectedPdf").mockImplementation(async (buf, pwd) => {
        if (pwd === "ABCDE1234F01011990") {
          return {
            text: sampleCamsText,
            numPages: 2,
          };
        }
        throw new UnauthorizedException("Invalid password for CAS PDF statement.");
      });

      const result = await adapter.parseCas(mockEncryptedBuffer, "ABCDE1234F01011990");
      expect(result).toBeDefined();
      expect(result.folios.length).toBe(2);
      expect(result.transactions.length).toBe(6);
    });

    it("should reject incorrect password with UnauthorizedException", async () => {
      const mockEncryptedBuffer = Buffer.from("FAKE_ENCRYPTED_PDF_BYTES");

      jest
        .spyOn(pdfParserUtil, "parseProtectedPdf")
        .mockRejectedValue(new UnauthorizedException("Invalid password for CAS PDF statement."));

      await expect(adapter.parseCas(mockEncryptedBuffer, "WRONG_PASSWORD")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when password is required but not provided", async () => {
      const mockEncryptedBuffer = Buffer.from("FAKE_ENCRYPTED_PDF_BYTES");

      jest
        .spyOn(pdfParserUtil, "parseProtectedPdf")
        .mockRejectedValue(new UnauthorizedException("CAS statement is password protected."));

      await expect(adapter.parseCas(mockEncryptedBuffer)).rejects.toThrow(UnauthorizedException);
    });

    it("should reject empty PDF buffer", async () => {
      await expect(adapter.parseCas(Buffer.from(""))).rejects.toThrow(
        "CAS PDF buffer cannot be empty.",
      );
    });
  });

  describe("CAMS eCAS Statement Parsing", () => {
    beforeEach(() => {
      jest.spyOn(pdfParserUtil, "parseProtectedPdf").mockResolvedValue({
        text: sampleCamsText,
        numPages: 2,
      });
    });

    it("should detect CAMS as statement issuer", async () => {
      const result = await adapter.parseCas(Buffer.from("dummy"));
      expect(result.fileType).toBe("CAMS");
    });

    it("should extract statement period and investor demographics", async () => {
      const result = await adapter.parseCas(Buffer.from("dummy"));

      expect(result.statementPeriod).toBeDefined();
      expect(result.statementPeriod?.from).toBe("01-Jan-2024");
      expect(result.statementPeriod?.to).toBe("30-Jun-2024");

      expect(result.investorInfo).toBeDefined();
      expect(result.investorInfo?.pan).toBe("ABCDE1234F");
      expect(result.investorInfo?.email).toBe("john.doe@example.com");
      expect(result.investorInfo?.mobile).toBe("9876543210");
    });

    it("should parse folios and schemes accurately", async () => {
      const result = await adapter.parseCas(Buffer.from("dummy"));

      expect(result.folios.length).toBe(2);

      // Folio 1
      const folio1 = result.folios[0];
      expect(folio1.folioNumber).toBe("12345/67");
      expect(folio1.amc).toBe("HDFC Mutual Fund");
      expect(folio1.pan).toBe("ABCDE1234F");
      expect(folio1.schemes.length).toBe(1);

      const scheme1 = folio1.schemes[0];
      expect(scheme1.schemeName).toContain("HDFC Top 100 Fund");
      expect(scheme1.isin).toBe("INF179K01BE2");
      expect(scheme1.rta).toBe("CAMS");
      expect(scheme1.openingUnitBalance).toBe(100);
      expect(scheme1.closingUnitBalance).toBe(201.271);
      expect(scheme1.nav).toBe(110.5);
      expect(scheme1.valuation).toBe(22240.45);

      // Folio 2
      const folio2 = result.folios[1];
      expect(folio2.folioNumber).toBe("98765/43");
      expect(folio2.amc).toBe("Mirae Asset Mutual Fund");
      expect(folio2.schemes[0].isin).toBe("INF769K01010");
      expect(folio2.schemes[0].closingUnitBalance).toBe(60);
    });

    it("should map mutual fund transactions into NormalizedTransaction records", async () => {
      const result = await adapter.parseCas(Buffer.from("dummy"));

      // Total transactions: 4 in scheme 1 + 2 in scheme 2 = 6
      expect(result.transactions.length).toBe(6);

      // Transaction 1: Regular Purchase
      const tx1 = result.transactions[0];
      expect(tx1.folioNumber).toBe("12345/67");
      expect(tx1.schemeName).toContain("HDFC Top 100 Fund");
      expect(tx1.isin).toBe("INF179K01BE2");
      expect(tx1.type).toBe(TransactionType.BUY);
      expect(tx1.quantity).toBe(50.123);
      expect(tx1.pricePerUnit).toBe(99.754);
      expect(tx1.currency).toBe("INR");
      expect(tx1.balanceUnits).toBe(150.123);
      expect(tx1.assetClassCode).toBe(AssetClassCode.MUTUAL_FUNDS);

      // Transaction 2: Stamp Duty Fee
      const tx2 = result.transactions[1];
      expect(tx2.type).toBe(TransactionType.FEE);
      expect(tx2.fees).toBe(0.25);

      // Transaction 3: SIP Purchase
      const tx3 = result.transactions[2];
      expect(tx3.type).toBe(TransactionType.BUY);
      expect(tx3.quantity).toBe(48.78);
      expect(tx3.pricePerUnit).toBe(102.5);

      // Transaction 4: IDCW Reinvestment with dividend rate
      const tx4 = result.transactions[3];
      expect(tx4.type).toBe(TransactionType.BUY);
      expect(tx4.quantity).toBe(2.368);
      expect(tx4.pricePerUnit).toBe(105);
      expect(tx4.dividendRate).toBe(1.25);

      // Transaction 5: Initial Purchase in Scheme 2
      const tx5 = result.transactions[4];
      expect(tx5.folioNumber).toBe("98765/43");
      expect(tx5.isin).toBe("INF769K01010");
      expect(tx5.type).toBe(TransactionType.BUY);
      expect(tx5.quantity).toBe(100);

      // Transaction 6: Redemption
      const tx6 = result.transactions[5];
      expect(tx6.type).toBe(TransactionType.SELL);
      expect(tx6.quantity).toBe(40);
      expect(tx6.pricePerUnit).toBe(125);
      expect(tx6.balanceUnits).toBe(60);
    });

    it("should generate current holdings from scheme closing balances", async () => {
      const holdings = await adapter.fetchHoldings({
        pdfBuffer: Buffer.from("dummy"),
      });

      expect(holdings.length).toBe(2);
      expect(holdings[0].symbol).toBe("INF179K01BE2");
      expect(holdings[0].quantity).toBe(201.271);
      expect(holdings[0].currentPrice).toBe(110.5);
      expect(holdings[0].assetClassCode).toBe(AssetClassCode.MUTUAL_FUNDS);

      expect(holdings[1].symbol).toBe("INF769K01010");
      expect(holdings[1].quantity).toBe(60);
      expect(holdings[1].currentPrice).toBe(130);
    });

    it("should filter transactions by startDate when requested", async () => {
      const allTxs = await adapter.fetchTransactions({
        pdfBuffer: Buffer.from("dummy"),
      });
      expect(allTxs.length).toBe(6);

      const filtered = await adapter.fetchTransactions(
        { pdfBuffer: Buffer.from("dummy") },
        new Date("2024-02-01"),
      );
      // Feb, Mar, May = 3 transactions after Feb 1
      expect(filtered.length).toBe(3);
      filtered.forEach((tx) => {
        expect(tx.transactedAt >= new Date("2024-02-01")).toBe(true);
      });
    });
  });

  describe("KFintech eCAS Statement Parsing", () => {
    beforeEach(() => {
      jest.spyOn(pdfParserUtil, "parseProtectedPdf").mockResolvedValue({
        text: sampleKfintechText,
        numPages: 1,
      });
    });

    it("should detect KFINTECH as statement issuer", async () => {
      const result = await adapter.parseCas(Buffer.from("dummy"));
      expect(result.fileType).toBe("KFINTECH");
    });

    it("should parse KFintech statement period, investor info, and folios", async () => {
      const result = await adapter.parseCas(Buffer.from("dummy"));

      expect(result.statementPeriod?.from).toBe("01-Apr-2023");
      expect(result.statementPeriod?.to).toBe("31-Mar-2024");
      expect(result.investorInfo?.pan).toBe("XYZPK9876Q");

      expect(result.folios.length).toBe(1);
      const folio = result.folios[0];
      expect(folio.folioNumber).toBe("987654321");
      expect(folio.schemes.length).toBe(1);

      const scheme = folio.schemes[0];
      expect(scheme.schemeName).toContain("Nippon India Small Cap Fund");
      expect(scheme.isin).toBe("INF204K01E03");
      expect(scheme.rta).toBe("KFINTECH");
      expect(scheme.closingUnitBalance).toBe(15);
    });

    it("should map KFintech transactions including IDCW payout and switch out", async () => {
      const result = await adapter.parseCas(Buffer.from("dummy"));

      expect(result.transactions.length).toBe(3);

      // SIP Transaction
      const sip = result.transactions[0];
      expect(sip.type).toBe(TransactionType.BUY);
      expect(sip.quantity).toBe(25);
      expect(sip.pricePerUnit).toBe(100);
      expect(sip.rta).toBe("KFINTECH");

      // Dividend Payout (IDCW Payout)
      const div = result.transactions[1];
      expect(div.type).toBe(TransactionType.DIVIDEND);
      expect(div.dividendRate).toBe(2.5);
      expect(div.pricePerUnit).toBe(105);

      // Switch Out
      const swOut = result.transactions[2];
      expect(swOut.type).toBe(TransactionType.SELL);
      expect(swOut.quantity).toBe(10);
      expect(swOut.pricePerUnit).toBe(105);
      expect(swOut.balanceUnits).toBe(15);
    });
  });

  describe("Helper Functions and Edge Cases", () => {
    it("should parse various date formats correctly", () => {
      const d1 = adapter.parseDate("15-Jan-2024");
      expect(d1.getUTCFullYear()).toBe(2024);
      expect(d1.getUTCMonth()).toBe(0);
      expect(d1.getUTCDate()).toBe(15);

      const d2 = adapter.parseDate("25/12/2023");
      expect(d2.getUTCFullYear()).toBe(2023);
      expect(d2.getUTCMonth()).toBe(11);
      expect(d2.getUTCDate()).toBe(25);
    });

    it("should parse numbers with commas, decimals, and parentheses", () => {
      expect(adapter.parseNumeric("1,23,456.78")).toBe(123456.78);
      expect(adapter.parseNumeric("(5,000.50)")).toBe(-5000.5);
      expect(adapter.parseNumeric("0.000")).toBe(0);
      expect(adapter.parseNumeric("")).toBe(0);
    });

    it("should clean scheme names from metadata tokens", () => {
      const raw =
        "HDFC Top 100 Fund - Direct Growth - ISIN: INF179K01BE2 (Advisor: ARN-12345) Registrar : CAMS (formerly known as HDFC Top 200)";
      const cleaned = adapter.cleanSchemeName(raw);
      expect(cleaned).toBe("HDFC Top 100 Fund - Direct Growth");
    });

    it("should extract dividend rate across variations", () => {
      expect(adapter.extractDividendRate("Dividend Payout @ Rs. 1.75 per unit")).toBe(1.75);
      expect(adapter.extractDividendRate("IDCW - Reinvestment @ Rs. 2.50 per unit")).toBe(2.5);
      expect(adapter.extractDividendRate("Regular Purchase of Mutual Fund")).toBeUndefined();
    });
  });
});
