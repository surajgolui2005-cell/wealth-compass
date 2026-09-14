import { Injectable } from "@nestjs/common";
import { AssetClassCode, ProviderCode, TransactionType } from "@prisma/client";
import * as Papa from "papaparse";
import {
  CsvColumnMapping,
  CsvParseResult,
  FinancialDataProvider,
  RawExternalHolding,
  RawExternalTransaction,
} from "../interfaces/provider.interface";

@Injectable()
export class CsvProviderAdapter implements FinancialDataProvider {
  getProviderCode(): ProviderCode | string {
    return ProviderCode.CSV;
  }

  validateConfig(config: Record<string, any>): boolean {
    return typeof config.csvContent === "string" && config.csvContent.trim().length > 0;
  }

  async connect(
    _credentials: Record<string, any>,
  ): Promise<{ connected: boolean; message?: string }> {
    return {
      connected: true,
      message: "CSV Provider parser ready.",
    };
  }

  async fetchHoldings(_credentials: Record<string, any>): Promise<RawExternalHolding[]> {
    return [];
  }

  async fetchTransactions(
    credentials: Record<string, any>,
    _startDate?: Date,
  ): Promise<RawExternalTransaction[]> {
    const csvContent = credentials.csvContent;
    const customMapping: CsvColumnMapping = credentials.customMapping || {};

    const parseResult = this.parseCsvContent(csvContent, customMapping);
    return parseResult.transactions;
  }

  /**
   * Parses CSV string into normalized transaction data structures with smart header detection
   * that automatically skips broker metadata headers (e.g. Groww, Angel One, Zerodha holding reports).
   */
  parseCsvContent(csvContent: string, customMapping?: CsvColumnMapping): CsvParseResult {
    if (!csvContent || !csvContent.trim()) {
      return {
        transactions: [],
        holdings: [],
        totalRowsParsed: 0,
        skippedRowsCount: 0,
        errors: ["CSV file contains no data rows."],
      };
    }

    // 1. Parse raw rows first to locate the real table header row
    const rawParse = Papa.parse<string[]>(csvContent, {
      header: false,
      skipEmptyLines: "greedy",
    });

    const rawRows = (rawParse.data || []).map((row) =>
      row.map((cell) => (cell ? String(cell).trim() : "")),
    );

    if (rawRows.length === 0) {
      return {
        transactions: [],
        holdings: [],
        totalRowsParsed: 0,
        skippedRowsCount: 0,
        errors: ["CSV file contains no data rows."],
      };
    }

    // 2. Find the actual table header row (skipping metadata lines like Client Name, UCC, Summary, etc.)
    let headerRowIndex = 0;
    let bestHeaderScore = -1;

    for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
      const row = rawRows[r];
      const normalizedCells = row.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ""));

      let score = 0;
      const hasSymbol = normalizedCells.some((c) =>
        [
          "symbol",
          "ticker",
          "stockname",
          "stock",
          "companyname",
          "company",
          "tradingsymbol",
          "instrument",
          "scrip",
          "scripname",
          "security",
          "securityname",
          "isin",
          "asset",
        ].includes(c),
      );

      const hasQty = normalizedCells.some((c) =>
        [
          "quantity",
          "qty",
          "totalqty",
          "totalquantity",
          "shares",
          "units",
          "holdingqty",
          "availableqty",
          "netqty",
          "balance",
        ].includes(c),
      );

      const hasPrice = normalizedCells.some((c) =>
        [
          "avgcostprice",
          "avgcost",
          "avgprice",
          "averagecost",
          "averageprice",
          "buyprice",
          "buyavg",
          "price",
          "rate",
          "ltp",
          "closeprice",
          "curvalue",
          "marketvalue",
        ].includes(c),
      );

      if (hasSymbol) score += 4;
      if (hasQty) score += 3;
      if (hasPrice) score += 2;

      if (score > bestHeaderScore && score >= 4) {
        bestHeaderScore = score;
        headerRowIndex = r;
      }
    }

    // 3. Extract headers and data rows
    const headerRow = rawRows[headerRowIndex];
    const rawDataRows = rawRows.slice(headerRowIndex + 1);

    const headers = headerRow.map((h, i) => (h ? h.trim() : `col_${i}`));
    const headerMap = this.resolveHeaderMap(headers, customMapping);

    // Auto-heal broken multiline rows (e.g. "JAIPRAKASH POWER VEN.\nLTD")
    const dataRows: string[][] = [];
    for (let i = 0; i < rawDataRows.length; i++) {
      const cur = rawDataRows[i];
      const next = rawDataRows[i + 1];

      // If current row has fewer columns than header (e.g. just 1 cell) and next row has the rest
      if (cur.length === 1 && cur[0] && next && next.length >= Math.max(2, headers.length - 1)) {
        const mergedFirst = `${cur[0]} ${next[0]}`.trim();
        dataRows.push([mergedFirst, ...next.slice(1)]);
        i++; // skip next row
      } else {
        dataRows.push(cur);
      }
    }

    const transactions: RawExternalTransaction[] = [];
    const errors: string[] = [];
    let skippedRowsCount = headerRowIndex; // metadata rows skipped before table

    const IGNORED_SYMBOLS = new Set([
      "TOTAL",
      "GRAND TOTAL",
      "SUMMARY",
      "SUBTOTAL",
      "DISCLAIMER",
      "NOTE",
      "NOTES",
      "PORTFOLIO",
      "ALL STOCKS",
      "ALL ASSETS",
    ]);

    for (let index = 0; index < dataRows.length; index++) {
      const rowArr = dataRows[index];
      const rowNum = headerRowIndex + index + 2; // 1-indexed

      // Build row object
      const rowObj: Record<string, string> = {};
      headers.forEach((h, colIdx) => {
        rowObj[h] = rowArr[colIdx] || "";
      });

      try {
        let symbolVal = this.getFieldValue(rowObj, headerMap.symbolHeader);

        // Fallback: If symbol header gave an empty value, check if there's a stock name or ISIN column
        if (!symbolVal) {
          const fallbackSymHeader = headers.find((h) => {
            const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            return ["stockname", "companyname", "scrip", "instrument", "isin"].includes(clean);
          });
          if (fallbackSymHeader) {
            symbolVal = this.getFieldValue(rowObj, fallbackSymHeader);
          }
        }

        if (!symbolVal) {
          skippedRowsCount++;
          continue;
        }

        const cleanSymbol = symbolVal.trim().toUpperCase();
        if (
          IGNORED_SYMBOLS.has(cleanSymbol) ||
          cleanSymbol.startsWith("TOTAL") ||
          cleanSymbol.startsWith("GRAND TOTAL") ||
          cleanSymbol.startsWith("DISCLAIMER") ||
          /^\d+\s+(STOCKS?|HOLDINGS?|ASSETS?|ITEMS?)$/i.test(cleanSymbol)
        ) {
          skippedRowsCount++;
          continue;
        }

        const typeVal = this.getFieldValue(rowObj, headerMap.typeHeader);
        const transactionType = this.normalizeTransactionType(typeVal);

        const dateVal = this.getFieldValue(rowObj, headerMap.dateHeader);
        const transactedAt = this.normalizeDate(dateVal);

        const qtyVal = this.getFieldValue(rowObj, headerMap.quantityHeader);
        const quantity = this.cleanNumeric(qtyVal);

        if (quantity <= 0) {
          skippedRowsCount++;
          continue;
        }

        const priceVal = this.getFieldValue(rowObj, headerMap.priceHeader);
        let pricePerUnit = this.cleanNumeric(priceVal);

        // Fallback 1: If price is 0, check LTP / Market Price columns
        if (pricePerUnit <= 0) {
          const ltpHeader = headers.find((h) => {
            const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            return [
              "ltp",
              "ltprs",
              "closeprice",
              "curprice",
              "currentprice",
              "marketprice",
              "closingprice",
              "lastprice",
            ].includes(clean);
          });
          if (ltpHeader) {
            pricePerUnit = this.cleanNumeric(this.getFieldValue(rowObj, ltpHeader));
          }
        }

        // Fallback 2: If price is still 0, derive from Invested Value / Total Cost / Qty
        if (pricePerUnit <= 0 && quantity > 0) {
          const investedHeader = headers.find((h) => {
            const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            return [
              "invested",
              "investedvalue",
              "investedamount",
              "totalinvested",
              "totalinvestment",
              "totalcost",
              "costvalue",
              "totalamount",
              "cost",
            ].includes(clean);
          });
          if (investedHeader) {
            const investedVal = this.cleanNumeric(this.getFieldValue(rowObj, investedHeader));
            if (investedVal > 0) {
              pricePerUnit = investedVal / quantity;
            }
          }
        }

        // Fallback 3: If price is still 0, derive from Current Value / Qty
        if (pricePerUnit <= 0 && quantity > 0) {
          const curValHeader = headers.find((h) => {
            const clean = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            return [
              "currentvalue",
              "curvalue",
              "marketvalue",
              "totalvalue",
              "holdingvalue",
              "value",
            ].includes(clean);
          });
          if (curValHeader) {
            const curVal = this.cleanNumeric(this.getFieldValue(rowObj, curValHeader));
            if (curVal > 0) {
              pricePerUnit = curVal / quantity;
            }
          }
        }

        const feesVal = this.getFieldValue(rowObj, headerMap.feesHeader);
        const fees = this.cleanNumeric(feesVal);

        const notesVal = this.getFieldValue(rowObj, headerMap.notesHeader);

        const assetClassVal = this.getFieldValue(rowObj, headerMap.assetClassHeader);
        const assetClassCode = this.normalizeAssetClassCode(assetClassVal, cleanSymbol);

        // Sanitize symbol: Take first token if it's like "RELIANCE - INE002A01018" or "RELIANCE INDUSTRIES"
        let finalSymbol = cleanSymbol;
        if (finalSymbol.includes(" - ")) {
          finalSymbol = finalSymbol.split(" - ")[0].trim();
        }

        // Extract statement snapshot valuation fields if present (e.g. from broker Excel/CSV holding reports)
        const buyValField = this.getFieldValue(rowObj, headerMap.buyValueHeader);
        let buyValue = this.cleanNumeric(buyValField);
        if (buyValue <= 0 && quantity > 0 && pricePerUnit > 0) {
          buyValue = Number((quantity * pricePerUnit).toFixed(2));
        }

        const curPriceField = this.getFieldValue(rowObj, headerMap.currentPriceHeader);
        let curPrice = this.cleanNumeric(curPriceField);

        const curValField = this.getFieldValue(rowObj, headerMap.currentValueHeader);
        let curVal = this.cleanNumeric(curValField);

        if (curPrice > 0 && curVal <= 0 && quantity > 0) {
          curVal = Number((quantity * curPrice).toFixed(2));
        } else if (curVal > 0 && curPrice <= 0 && quantity > 0) {
          curPrice = Number((curVal / quantity).toFixed(4));
        }

        const pnlField = this.getFieldValue(rowObj, headerMap.unrealizedPnLHeader);
        let pnl = this.cleanNumeric(pnlField);
        const hasExplicitPnl = pnlField !== "" && !isNaN(Number(pnlField.replace(/[^\d.-]/g, "")));
        if (!hasExplicitPnl && curVal > 0 && buyValue > 0) {
          pnl = Number((curVal - buyValue).toFixed(2));
        }

        const hasPnl = hasExplicitPnl || (curVal > 0 && buyValue > 0);
        const pnlPct =
          hasPnl && buyValue > 0 ? Number(((pnl / buyValue) * 100).toFixed(4)) : undefined;

        transactions.push({
          symbol: finalSymbol,
          type: transactionType,
          quantity,
          pricePerUnit: Number(pricePerUnit.toFixed(4)),
          fees,
          transactedAt,
          notes: notesVal || undefined,
          assetClassCode,
          buyValue: buyValue > 0 ? buyValue : undefined,
          currentPrice: curPrice > 0 ? curPrice : undefined,
          currentValue: curVal > 0 ? curVal : undefined,
          unrealizedPnL: hasPnl ? pnl : undefined,
          unrealizedPnLPct: pnlPct,
        });
      } catch (err: any) {
        skippedRowsCount++;
        errors.push(`Row ${rowNum}: ${err.message || "Failed to parse row"}`);
      }
    }

    return {
      transactions,
      holdings: [],
      totalRowsParsed: dataRows.length,
      skippedRowsCount,
      errors,
    };
  }

  private cleanNumeric(val?: string | number): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const str = String(val).trim();
    if (!str) return 0;

    // Detect negative numbers in parentheses e.g. (1,450.50)
    const isNegativeParen = /^\(.*\)$/.test(str);

    // Strip currency symbols (₹, $, €, £), "Rs", "INR", commas, slashes, and spaces
    const cleaned = str.replace(/[^\d.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === ".") return 0;

    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return isNegativeParen && num > 0 ? -num : num;
  }

  private resolveHeaderMap(
    headers: string[],
    customMapping?: CsvColumnMapping,
  ): Required<CsvColumnMapping> {
    const normalizedHeaders = headers.map((h) => ({
      original: h,
      clean: h.toLowerCase().replace(/[^a-z0-9]/g, ""),
    }));

    const findMatch = (customKey: string | undefined, aliases: string[]): string | undefined => {
      if (customKey && headers.includes(customKey)) {
        return customKey;
      }

      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        const match = normalizedHeaders.find((h) => h.clean === cleanAlias);
        if (match) {
          return match.original;
        }
      }
      return undefined;
    };

    return {
      symbolHeader:
        findMatch(customMapping?.symbolHeader, [
          "symbol",
          "ticker",
          "tradingsymbol",
          "instrument",
          "stockname",
          "stock",
          "companyname",
          "company",
          "scrip",
          "scripname",
          "security",
          "securityname",
          "asset",
          "isin",
          "code",
        ]) || "",
      dateHeader:
        findMatch(customMapping?.dateHeader, [
          "date",
          "transactedat",
          "transactiondate",
          "tradedate",
          "time",
          "timestamp",
          "ason",
          "holdingdate",
        ]) || "",
      typeHeader:
        findMatch(customMapping?.typeHeader, [
          "type",
          "transactiontype",
          "action",
          "side",
          "buysell",
          "activity",
        ]) || "",
      quantityHeader:
        findMatch(customMapping?.quantityHeader, [
          "quantity",
          "qty",
          "totalqty",
          "totalquantity",
          "shares",
          "units",
          "holdingqty",
          "availableqty",
          "netqty",
          "balance",
          "volume",
          "amountunits",
          "holdingquantity",
          "totalshares",
        ]) || "",
      priceHeader:
        findMatch(customMapping?.priceHeader, [
          "avgcostprice",
          "avgcost",
          "avgprice",
          "avgpricers",
          "avgbuyprice",
          "avgbuypricers",
          "averagecost",
          "averageprice",
          "averagebuyprice",
          "averagepurchaseprice",
          "avgpurchaseprice",
          "buyprice",
          "buyavg",
          "purchaseprice",
          "price",
          "priceperunit",
          "unitprice",
          "rate",
          "executionprice",
          "costprice",
          "ltp",
          "ltprs",
          "closeprice",
          "marketprice",
          "currentprice",
          "closingprice",
          "curprice",
        ]) || "",
      feesHeader:
        findMatch(customMapping?.feesHeader, [
          "fees",
          "fee",
          "commission",
          "charges",
          "tax",
          "brokerage",
          "stt",
          "gst",
        ]) || "",
      assetClassHeader:
        findMatch(customMapping?.assetClassHeader, ["assetclass", "category", "assettype"]) || "",
      notesHeader:
        findMatch(customMapping?.notesHeader, ["notes", "description", "memo", "remarks"]) || "",
      buyValueHeader:
        findMatch(customMapping?.buyValueHeader, [
          "buyvalue",
          "buyvaluers",
          "totalbuyvalue",
          "investedvalue",
          "investedamount",
          "invested",
          "totalinvested",
          "totalinvestment",
          "totalcost",
          "costvalue",
          "totalamount",
          "cost",
        ]) || "",
      currentPriceHeader:
        findMatch(customMapping?.currentPriceHeader, [
          "closingprice",
          "closingpricers",
          "closeprice",
          "ltp",
          "ltprs",
          "marketprice",
          "currentprice",
          "curprice",
          "lastprice",
          "nav",
          "cmp",
        ]) || "",
      currentValueHeader:
        findMatch(customMapping?.currentValueHeader, [
          "closingvalue",
          "closingvaluers",
          "closevalue",
          "currentvalue",
          "curvalue",
          "marketvalue",
          "totalvalue",
          "holdingvalue",
          "value",
          "presentvalue",
        ]) || "",
      unrealizedPnLHeader:
        findMatch(customMapping?.unrealizedPnLHeader, [
          "unrealisedpnl",
          "unrealizedpnl",
          "unrealisedpnlrs",
          "unrealizedpnlrs",
          "pnl",
          "pnlrs",
          "unrealisedprofitloss",
          "unrealizedprofitloss",
          "profitloss",
          "gainloss",
          "overallpnl",
          "returns",
          "totalpnl",
        ]) || "",
    };
  }

  private getFieldValue(row: Record<string, string>, headerName?: string): string {
    if (!headerName || !(headerName in row)) {
      return "";
    }
    return row[headerName] ? row[headerName].trim() : "";
  }

  private normalizeTransactionType(rawType: string): TransactionType {
    const clean = rawType.toUpperCase().trim();

    if (["BUY", "BOUGHT", "PURCHASE", "B"].includes(clean)) return TransactionType.BUY;
    if (["SELL", "SOLD", "S"].includes(clean)) return TransactionType.SELL;
    if (["DIV", "DIVIDEND", "DISTRIBUTION"].includes(clean)) return TransactionType.DIVIDEND;
    if (["INT", "INTEREST"].includes(clean)) return TransactionType.INTEREST;
    if (["DEP", "DEPOSIT", "FUNDING", "CREDIT"].includes(clean)) return TransactionType.DEPOSIT;
    if (["WITH", "WITHDRAWAL", "PAYOUT", "DEBIT"].includes(clean))
      return TransactionType.WITHDRAWAL;
    if (["FEE", "CHARGE", "TAX"].includes(clean)) return TransactionType.FEE;
    if (["SPLIT", "STOCK_SPLIT"].includes(clean)) return TransactionType.SPLIT;
    if (["BONUS", "BONUS_SHARES"].includes(clean)) return TransactionType.BONUS;

    return TransactionType.BUY;
  }

  private normalizeDate(rawDate: string): Date {
    if (!rawDate) return new Date();

    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try DD/MM/YYYY or DD-MM-YYYY format
    const parts = rawDate.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }

    return new Date();
  }

  private normalizeAssetClassCode(rawAssetClass: string, symbol: string): AssetClassCode {
    const clean = rawAssetClass ? rawAssetClass.toUpperCase().trim() : "";

    if (clean.includes("CRYPTO") || clean.includes("BITCOIN")) return AssetClassCode.CRYPTO;
    if (clean.includes("MUTUAL") || clean.includes("MF")) return AssetClassCode.MUTUAL_FUNDS;
    if (clean.includes("ETF")) return AssetClassCode.ETFS;
    if (clean.includes("BOND")) return AssetClassCode.BONDS;
    if (clean.includes("CASH")) return AssetClassCode.CASH;

    // Symbol heuristics
    if (["BTC", "ETH", "SOL", "USDT", "BNB", "DOGE"].includes(symbol.toUpperCase())) {
      return AssetClassCode.CRYPTO;
    }

    return AssetClassCode.STOCKS;
  }
}
