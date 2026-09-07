import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { AssetClassCode, ProviderCode, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import {
  FinancialDataProvider,
  RawExternalHolding,
  RawExternalTransaction,
} from "../interfaces/provider.interface";
import { parseProtectedPdf } from "../utils/pdf-parser.util";
import {
  CasFolio,
  CasInvestorInfo,
  CasParseResult,
  CasScheme,
  CasStatementPeriod,
  CasTransaction,
  NormalizedTransaction,
  ParseCasPdfOptions,
} from "./cams-cas.dto";

@Injectable()
export class CamsCasPdfAdapter implements FinancialDataProvider {
  private readonly logger = new Logger(CamsCasPdfAdapter.name);

  // ---------------------------------------------------------------------------
  // Provider Interface Implementation
  // ---------------------------------------------------------------------------

  getProviderCode(): ProviderCode | string {
    return (ProviderCode as any).CAMS_CAS ?? "CAMS_CAS";
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config) return false;
    const buf = config.pdfBuffer;
    return (Buffer.isBuffer(buf) || buf instanceof Uint8Array) && buf.length > 0;
  }

  async connect(
    _credentials: Record<string, any>,
  ): Promise<{ connected: boolean; message?: string }> {
    return {
      connected: true,
      message: "CAMS/KFintech CAS In-Memory PDF Parser active.",
    };
  }

  /**
   * Fetches latest portfolio holdings from the parsed CAS statement.
   * Derives current holdings from latest folio closing balances.
   */
  async fetchHoldings(credentials: Record<string, any>): Promise<RawExternalHolding[]> {
    const parseResult = await this.parseCas(credentials.pdfBuffer, credentials.password);
    return parseResult.holdings;
  }

  /**
   * Fetches normalized mutual fund transaction history from the parsed CAS statement.
   */
  async fetchTransactions(
    credentials: Record<string, any>,
    startDate?: Date,
  ): Promise<NormalizedTransaction[]> {
    const parseResult = await this.parseCas(credentials.pdfBuffer, credentials.password);

    if (startDate) {
      return parseResult.transactions.filter((tx) => tx.transactedAt >= startDate);
    }

    return parseResult.transactions;
  }

  // ---------------------------------------------------------------------------
  // Core CAS In-Memory Parsing Pipeline
  // ---------------------------------------------------------------------------

  /**
   * Parses an in-memory CAS PDF buffer with optional password.
   * Decrypts in-memory, parses folios, schemes, ISINs, NAVs, and transactions.
   */
  async parseCas(pdfBuffer: Buffer | Uint8Array, password?: string): Promise<CasParseResult> {
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("CAS PDF buffer cannot be empty.");
    }

    // 1. In-memory decryption and text extraction
    const { text } = await parseProtectedPdf(pdfBuffer, password);

    if (!text || text.trim().length === 0) {
      throw new Error("Extracted text from CAS PDF is empty or unreadable.");
    }

    // 2. Classify statement issuer (CAMS vs KFintech)
    const fileType = this.detectRta(text);

    // 3. Extract investor information & statement period
    const statementPeriod = this.extractStatementPeriod(text);
    const investorInfo = this.extractInvestorInfo(text);

    // 4. Parse folios, schemes, and transactions
    const folios = this.parseFolios(text, fileType);

    // 5. Flatten and normalize all transactions
    const transactions: NormalizedTransaction[] = [];
    const holdings: RawExternalHolding[] = [];

    for (const folio of folios) {
      for (const scheme of folio.schemes) {
        // Build current holding from closing balance or last transaction balance
        const closingUnits =
          scheme.closingUnitBalance ??
          (scheme.transactions.length > 0
            ? scheme.transactions[scheme.transactions.length - 1].balance
            : 0);

        if (closingUnits > 0) {
          holdings.push({
            symbol: scheme.isin || scheme.schemeName,
            name: scheme.schemeName,
            quantity: new Decimal(closingUnits).toNumber(),
            avgCostBasis: scheme.nav ? new Decimal(scheme.nav).toNumber() : undefined,
            currentPrice: scheme.nav ? new Decimal(scheme.nav).toNumber() : undefined,
            assetClassCode: AssetClassCode.MUTUAL_FUNDS,
            currency: "INR",
            externalRefId: `${folio.folioNumber}-${scheme.isin || scheme.schemeName}`,
          });
        }

        // Map transactions
        scheme.transactions.forEach((tx, idx) => {
          transactions.push({
            symbol: scheme.isin || scheme.schemeName,
            type: tx.type,
            quantity: new Decimal(Math.abs(tx.units)).toNumber(),
            pricePerUnit: new Decimal(tx.price).toNumber(),
            fees: tx.type === TransactionType.FEE ? new Decimal(tx.amount).toNumber() : 0,
            transactedAt: tx.date,
            currency: "INR",
            notes: tx.description,
            providerRefId: `${folio.folioNumber}-${scheme.isin || "MF"}-${tx.date.toISOString().split("T")[0]}-${idx}`,
            assetClassCode: AssetClassCode.MUTUAL_FUNDS,
            folioNumber: folio.folioNumber,
            schemeName: scheme.schemeName,
            isin: scheme.isin,
            amfiCode: scheme.amfiCode,
            dividendRate: tx.dividendRate,
            balanceUnits: new Decimal(tx.balance).toNumber(),
            rta: scheme.rta,
          });
        });
      }
    }

    this.logger.log(
      `CAS PDF parsed successfully: ${folios.length} folios, ${transactions.length} transactions, issuer=${fileType}`,
    );

    return {
      fileType,
      casType: "DETAILED",
      statementPeriod,
      investorInfo,
      folios,
      transactions,
      holdings,
      totalTransactionsCount: transactions.length,
      totalFoliosCount: folios.length,
      errors: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Extraction & Layout Detection Helpers
  // ---------------------------------------------------------------------------

  /**
   * Detects whether the statement originates from CAMS or KFintech
   */
  detectRta(text: string): "CAMS" | "KFINTECH" | "UNKNOWN" {
    const lower = text.toLowerCase();
    if (
      lower.includes("camsonline") ||
      lower.includes("computer age management") ||
      lower.includes("cams")
    ) {
      return "CAMS";
    }
    if (
      lower.includes("kfintech") ||
      lower.includes("kfin technologies") ||
      lower.includes("karvy")
    ) {
      return "KFINTECH";
    }
    return "UNKNOWN";
  }

  /**
   * Extracts statement period: "01-Jan-2023 To 31-Dec-2023"
   */
  extractStatementPeriod(text: string): CasStatementPeriod | undefined {
    const periodMatch = text.match(
      /(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(?:To|to|-)\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i,
    );
    if (periodMatch) {
      return {
        from: periodMatch[1],
        to: periodMatch[2],
      };
    }
    return undefined;
  }

  /**
   * Extracts investor tax demographics (PAN, Email, Mobile)
   */
  extractInvestorInfo(text: string): CasInvestorInfo {
    const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
    const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    const mobileMatch = text.match(/\b(?:\+91[-\s]?)?([6-9]\d{9})\b/);

    return {
      pan: panMatch ? panMatch[1] : undefined,
      email: emailMatch ? emailMatch[1] : undefined,
      mobile: mobileMatch ? mobileMatch[1] : undefined,
    };
  }

  /**
   * Parses folios, nested schemes, and transaction tables
   */
  parseFolios(text: string, defaultRta: "CAMS" | "KFINTECH" | "UNKNOWN"): CasFolio[] {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const folios: CasFolio[] = [];
    let currentAmc = "Unknown AMC";
    let currentFolio: CasFolio | null = null;
    let currentScheme: CasScheme | null = null;

    // Pattern definitions
    const amcRegex = /^(.+?\s+(?:Mutual\s*Fund|MF|Fund\s*House|Asset\s*Management))/i;
    const folioRegex = /Folio\s+(?:No\.?|Number)\s*[:\-]?\s*([0-9\s/]+)/i;
    const isinRegex = /\b(INF[0-9A-Z]{8}\d)\b/i;
    const rtaRegex = /\b(CAMS|KFINTECH|KARVY)\b/i;
    const navRegex = /NAV\s+on\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s*:\s*(?:INR\s*)?([\d,.]+)/i;
    const valuationRegex =
      /(?:Valuation|Market\s+Value)\s+on\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s*:\s*(?:INR\s*)?([\d,.]+)/i;
    const openBalRegex = /Opening\s+Unit\s+Balance\s*[:\-]?\s*([\d,.]+)/i;
    const closeBalRegex = /Closing\s+Unit\s+Balance\s*[:\-]?\s*([\d,.]+)/i;

    // Row parser: starts with date (e.g. 15-Jan-2024 or 15/01/2024 or 2024-01-15)
    const datePrefixRegex =
      /^(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Detect AMC header
      const amcMatch = line.match(amcRegex);
      if (
        amcMatch &&
        !line.toLowerCase().includes("folio") &&
        !line.toLowerCase().includes("isin")
      ) {
        currentAmc = amcMatch[1].trim();
        continue;
      }

      // 2. Detect Folio block
      const folioMatch = line.match(folioRegex);
      if (folioMatch) {
        const rawFolio = folioMatch[1].replace(/\s+/g, "").trim();
        if (rawFolio.length > 0) {
          const panMatch = line.match(/PAN\s*[:\-]?\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
          const kycMatch = line.match(/KYC\s*[:\-]?\s*(OK|NOT\s*OK)/i);

          currentFolio = {
            folioNumber: rawFolio,
            amc: currentAmc,
            pan: panMatch ? panMatch[1] : undefined,
            kycStatus: kycMatch ? kycMatch[1] : undefined,
            schemes: [],
          };
          folios.push(currentFolio);
          currentScheme = null;
          continue;
        }
      }

      // 3. Detect Scheme Header with ISIN
      const isinMatch = line.match(isinRegex);
      const hasRegistrar = rtaRegex.test(line);

      if (
        isinMatch ||
        (hasRegistrar &&
          (line.includes("Growth") ||
            line.includes("Dividend") ||
            line.includes("IDCW") ||
            line.includes("Direct") ||
            line.includes("Regular")))
      ) {
        const isin = isinMatch ? isinMatch[1].toUpperCase() : undefined;
        const rtaMatch = line.match(rtaRegex);
        const rta = rtaMatch
          ? (rtaMatch[1].toUpperCase() as any)
          : defaultRta !== "UNKNOWN"
            ? defaultRta
            : "CAMS";

        const cleanSchemeName = this.cleanSchemeName(line);

        currentScheme = {
          schemeName: cleanSchemeName,
          isin,
          rta,
          transactions: [],
        };

        // Attach to active folio, or create a default folio if statement omitted Folio header
        if (!currentFolio) {
          currentFolio = {
            folioNumber: "DEFAULT-FOLIO",
            amc: currentAmc,
            schemes: [],
          };
          folios.push(currentFolio);
        }

        currentFolio.schemes.push(currentScheme);
        continue;
      }

      // 4. Scheme Balances and Valuation
      if (currentScheme) {
        const openMatch = line.match(openBalRegex);
        if (openMatch) {
          currentScheme.openingUnitBalance = this.parseNumeric(openMatch[1]);
        }

        const closeMatch = line.match(closeBalRegex);
        if (closeMatch) {
          currentScheme.closingUnitBalance = this.parseNumeric(closeMatch[1]);
        }

        const navMatch = line.match(navRegex);
        if (navMatch) {
          currentScheme.navDate = this.parseDate(navMatch[1]);
          currentScheme.nav = this.parseNumeric(navMatch[2]);
        }

        const valMatch = line.match(valuationRegex);
        if (valMatch) {
          currentScheme.valuationDate = this.parseDate(valMatch[1]);
          currentScheme.valuation = this.parseNumeric(valMatch[2]);
        }

        // 5. Transaction Rows
        const dateMatch = line.match(datePrefixRegex);
        if (dateMatch) {
          const tx = this.parseTransactionLine(line, lines, i);
          if (tx) {
            currentScheme.transactions.push(tx);
          }
        }
      }
    }

    return folios;
  }

  /**
   * Parses a single transaction line into a CasTransaction.
   * Handles multi-line descriptions, amount/unit signs, NAV, and dividend rates.
   */
  parseTransactionLine(line: string, allLines: string[], lineIdx: number): CasTransaction | null {
    const parts = line.split(/\s+/);
    if (parts.length < 2) return null;

    const dateStr = parts[0];
    const transactedDate = this.parseDate(dateStr);
    if (!transactedDate) return null;

    // Remaining string after the date
    let rowContent = line.slice(dateStr.length).trim();

    // Look ahead to next line if next line does NOT start with a date, folio, or scheme
    let nextIdx = lineIdx + 1;
    while (
      nextIdx < allLines.length &&
      !allLines[nextIdx].match(
        /^(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/,
      ) &&
      !allLines[nextIdx].toLowerCase().includes("closing") &&
      !allLines[nextIdx].toLowerCase().includes("opening") &&
      !allLines[nextIdx].toLowerCase().includes("nav on") &&
      !allLines[nextIdx].toLowerCase().includes("folio no") &&
      !allLines[nextIdx].toLowerCase().includes("isin:")
    ) {
      const nextLine = allLines[nextIdx].trim();
      // If next line contains numbers or description words, append it
      if (nextLine.length > 0) {
        rowContent += " " + nextLine;
        nextIdx++;
      } else {
        break;
      }
    }

    // Extract dividend / IDCW rate if present
    const dividendRate = this.extractDividendRate(rowContent);

    // Strip "@ Rs. X per unit" from numbers detection so dividend rate doesn't pollute column values
    const cleanNumbersText = rowContent.replace(
      /(?:@\s*(?:Rs\.?)?\s*[\d,.]+(?:\s+per\s+unit)?)/gi,
      "",
    );

    // Extract all numeric tokens (including negative in parentheses e.g. (5000.00))
    const numericMatches = Array.from(
      cleanNumbersText.matchAll(/(?:\(?\s*[\d,]+(?:\.\d+)?\s*\)?)/g),
    )
      .map((m) => m[0].trim())
      .filter((token) => /\d/.test(token));

    // Description is text before numeric tokens (or between date and first numeric)
    let description = cleanNumbersText;
    if (numericMatches.length > 0) {
      const firstNumIdx = cleanNumbersText.indexOf(numericMatches[0]);
      if (firstNumIdx > 0) {
        description = cleanNumbersText.slice(0, firstNumIdx).trim();
      }
    }

    // Classify transaction type
    const txType = this.classifyTransactionType(description, rowContent);

    // Parse extracted numbers:
    // CAMS/KFintech standard column layout: Amount, Units, Price/NAV, Balance
    let amount = 0;
    let units = 0;
    let price = 0;
    let balance = 0;

    const parsedNums = numericMatches.map((n) => this.parseNumeric(n));

    if (parsedNums.length >= 4) {
      amount = parsedNums[0];
      units = parsedNums[1];
      price = parsedNums[2];
      balance = parsedNums[3];
    } else if (parsedNums.length === 3) {
      amount = parsedNums[0];
      units = parsedNums[1];
      price = parsedNums[2];
    } else if (parsedNums.length === 2) {
      amount = parsedNums[0];
      units = parsedNums[1];
    } else if (parsedNums.length === 1) {
      amount = parsedNums[0];
    }

    // Fix signs based on transaction type
    if (txType === TransactionType.SELL && units > 0) {
      units = -units;
    }

    return {
      date: transactedDate,
      description: description || "Mutual Fund Transaction",
      amount: Math.abs(amount),
      units,
      price: price > 0 ? price : units !== 0 ? Math.abs(amount / units) : 0,
      balance,
      type: txType,
      dividendRate,
    };
  }

  /**
   * Classifies transaction description into TransactionType enum
   */
  classifyTransactionType(description: string, fullRow: string): TransactionType {
    const text = (description + " " + fullRow).toLowerCase();

    if (text.includes("stamp duty") || text.includes("stt") || text.includes("turnover tax")) {
      return TransactionType.FEE;
    }
    if (text.includes("reinvest") && (text.includes("idcw") || text.includes("dividend"))) {
      return TransactionType.BUY;
    }
    if (text.includes("payout") && (text.includes("idcw") || text.includes("dividend"))) {
      return TransactionType.DIVIDEND;
    }
    if (
      text.includes("redemption") ||
      text.includes("switch out") ||
      text.includes("switch-out") ||
      text.includes("swp") ||
      text.includes("withdrawal")
    ) {
      return TransactionType.SELL;
    }
    if (
      text.includes("purchase") ||
      text.includes("sip") ||
      text.includes("switch in") ||
      text.includes("switch-in") ||
      text.includes("allotment") ||
      text.includes("systematic")
    ) {
      return TransactionType.BUY;
    }

    return TransactionType.BUY;
  }

  /**
   * Extracts dividend rate per unit (e.g. "@ Rs. 1.25 per unit" -> 1.25)
   */
  extractDividendRate(text: string): number | undefined {
    const match = text.match(
      /(?:div\.|dividend|idcw).*?@\s*(?:Rs\.?)?\s*([\d.]+)(?:\s+per\s+unit)?/i,
    );
    if (match) {
      return parseFloat(match[1]);
    }
    return undefined;
  }

  /**
   * Normalizes scheme name by stripping ISIN, Advisor, Registrar, and formerly trailers
   */
  cleanSchemeName(raw: string): string {
    return raw
      .replace(/-\s*ISIN\s*:\s*[A-Z0-9]+/gi, "")
      .replace(/ISIN\s*:\s*[A-Z0-9]+/gi, "")
      .replace(/\(Advisor\s*:\s*[^)]+\)/gi, "")
      .replace(/Registrar\s*:\s*(?:CAMS|KFINTECH|KARVY)/gi, "")
      .replace(/\(formerly\s+known\s+as\s+[^)]+\)/gi, "")
      .replace(/\(erstwhile\s+[^)]+\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Parses Indian or ISO date format (e.g. 15-Jan-2024, 15/01/2024, 2024-01-15)
   */
  parseDate(dateStr: string): Date {
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    // DD-Mon-YYYY (e.g. 15-Jan-2024)
    const dmyWord = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (dmyWord) {
      const day = parseInt(dmyWord[1], 10);
      const month = months[dmyWord[2].toLowerCase()];
      const year = parseInt(dmyWord[3], 10);
      if (month !== undefined) {
        return new Date(Date.UTC(year, month, day));
      }
    }

    // DD/MM/YYYY
    const dmySlash = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmySlash) {
      const day = parseInt(dmySlash[1], 10);
      const month = parseInt(dmySlash[2], 10) - 1;
      const year = parseInt(dmySlash[3], 10);
      return new Date(Date.UTC(year, month, day));
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Parses numeric values with commas or parentheses into clean floats
   * e.g. "(5,000.50)" -> -5000.50
   */
  parseNumeric(val: string): number {
    if (!val) return 0;
    const isNegative = val.includes("(") && val.includes(")");
    const cleanStr = val.replace(/[(),\s]/g, "");
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  }
}
