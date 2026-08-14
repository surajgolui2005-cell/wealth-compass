import { Injectable } from '@nestjs/common';
import { AssetClassCode, ProviderCode, TransactionType } from '@prisma/client';
import * as Papa from 'papaparse';
import {
  CsvColumnMapping,
  CsvParseResult,
  FinancialDataProvider,
  RawExternalHolding,
  RawExternalTransaction,
} from '../interfaces/provider.interface';

@Injectable()
export class CsvProviderAdapter implements FinancialDataProvider {
  getProviderCode(): ProviderCode | string {
    return ProviderCode.CSV;
  }

  validateConfig(config: Record<string, any>): boolean {
    return typeof config.csvContent === 'string' && config.csvContent.trim().length > 0;
  }

  async connect(_credentials: Record<string, any>): Promise<{ connected: boolean; message?: string }> {
    return {
      connected: true,
      message: 'CSV Provider parser ready.',
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
   * Parses CSV string into normalized transaction data structures with header detection
   */
  parseCsvContent(csvContent: string, customMapping?: CsvColumnMapping): CsvParseResult {
    const parseResult = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    const rows = parseResult.data || [];
    const transactions: RawExternalTransaction[] = [];
    const errors: string[] = [];
    let skippedRowsCount = 0;

    if (rows.length === 0) {
      return {
        transactions: [],
        holdings: [],
        totalRowsParsed: 0,
        skippedRowsCount: 0,
        errors: ['CSV file contains no data rows.'],
      };
    }

    const headers = Object.keys(rows[0] || {});
    const headerMap = this.resolveHeaderMap(headers, customMapping);

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = index + 2; // 1-indexed header + 1

      try {
        const symbolVal = this.getFieldValue(row, headerMap.symbolHeader);
        if (!symbolVal) {
          skippedRowsCount++;
          continue;
        }

        const typeVal = this.getFieldValue(row, headerMap.typeHeader);
        const transactionType = this.normalizeTransactionType(typeVal);

        const dateVal = this.getFieldValue(row, headerMap.dateHeader);
        const transactedAt = this.normalizeDate(dateVal);

        const qtyVal = this.getFieldValue(row, headerMap.quantityHeader);
        const quantity = parseFloat(qtyVal || '0');

        const priceVal = this.getFieldValue(row, headerMap.priceHeader);
        const pricePerUnit = parseFloat(priceVal || '0');

        const feesVal = this.getFieldValue(row, headerMap.feesHeader);
        const fees = parseFloat(feesVal || '0');

        const notesVal = this.getFieldValue(row, headerMap.notesHeader);

        const assetClassVal = this.getFieldValue(row, headerMap.assetClassHeader);
        const assetClassCode = this.normalizeAssetClassCode(assetClassVal, symbolVal);

        transactions.push({
          symbol: symbolVal.trim().toUpperCase(),
          type: transactionType,
          quantity: isNaN(quantity) ? 0 : quantity,
          pricePerUnit: isNaN(pricePerUnit) ? 0 : pricePerUnit,
          fees: isNaN(fees) ? 0 : fees,
          transactedAt,
          notes: notesVal || undefined,
          assetClassCode,
        });
      } catch (err: any) {
        skippedRowsCount++;
        errors.push(`Row ${rowNum}: ${err.message || 'Failed to parse row'}`);
      }
    }

    return {
      transactions,
      holdings: [],
      totalRowsParsed: rows.length,
      skippedRowsCount,
      errors,
    };
  }

  private resolveHeaderMap(
    headers: string[],
    customMapping?: CsvColumnMapping,
  ): Required<CsvColumnMapping> {
    const normalizedHeaders = headers.map((h) => ({
      original: h,
      clean: h.toLowerCase().replace(/[^a-z0-9]/g, ''),
    }));

    const findMatch = (customKey: string | undefined, aliases: string[]): string | undefined => {
      if (customKey && headers.includes(customKey)) {
        return customKey;
      }

      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = normalizedHeaders.find((h) => h.clean === cleanAlias);
        if (match) {
          return match.original;
        }
      }
      return undefined;
    };

    return {
      symbolHeader: findMatch(customMapping?.symbolHeader, [
        'symbol',
        'ticker',
        'tradingsymbol',
        'instrument',
        'asset',
        'code',
      ]) || '',
      dateHeader: findMatch(customMapping?.dateHeader, [
        'date',
        'transactedat',
        'transactiondate',
        'tradedate',
        'time',
        'timestamp',
      ]) || '',
      typeHeader: findMatch(customMapping?.typeHeader, [
        'type',
        'transactiontype',
        'action',
        'side',
        'buysell',
        'activity',
      ]) || '',
      quantityHeader: findMatch(customMapping?.quantityHeader, [
        'quantity',
        'qty',
        'units',
        'shares',
        'volume',
        'amountunits',
      ]) || '',
      priceHeader: findMatch(customMapping?.priceHeader, [
        'price',
        'priceperunit',
        'unitprice',
        'rate',
        'executionprice',
        'value',
      ]) || '',
      feesHeader: findMatch(customMapping?.feesHeader, [
        'fees',
        'fee',
        'commission',
        'charges',
        'tax',
      ]) || '',
      assetClassHeader: findMatch(customMapping?.assetClassHeader, [
        'assetclass',
        'category',
        'assettype',
      ]) || '',
      notesHeader: findMatch(customMapping?.notesHeader, [
        'notes',
        'description',
        'memo',
        'remarks',
      ]) || '',
    };
  }

  private getFieldValue(row: Record<string, string>, headerName?: string): string {
    if (!headerName || !(headerName in row)) {
      return '';
    }
    return row[headerName] ? row[headerName].trim() : '';
  }

  private normalizeTransactionType(rawType: string): TransactionType {
    const clean = rawType.toUpperCase().trim();

    if (['BUY', 'BOUGHT', 'PURCHASE', 'B'].includes(clean)) return TransactionType.BUY;
    if (['SELL', 'SOLD', 'S'].includes(clean)) return TransactionType.SELL;
    if (['DIV', 'DIVIDEND', 'DISTRIBUTION'].includes(clean)) return TransactionType.DIVIDEND;
    if (['INT', 'INTEREST'].includes(clean)) return TransactionType.INTEREST;
    if (['DEP', 'DEPOSIT', 'FUNDING', 'CREDIT'].includes(clean)) return TransactionType.DEPOSIT;
    if (['WITH', 'WITHDRAWAL', 'PAYOUT', 'DEBIT'].includes(clean)) return TransactionType.WITHDRAWAL;
    if (['FEE', 'CHARGE', 'TAX'].includes(clean)) return TransactionType.FEE;
    if (['SPLIT', 'STOCK_SPLIT'].includes(clean)) return TransactionType.SPLIT;
    if (['BONUS', 'BONUS_SHARES'].includes(clean)) return TransactionType.BONUS;

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
    const clean = rawAssetClass ? rawAssetClass.toUpperCase().trim() : '';

    if (clean.includes('CRYPTO') || clean.includes('BITCOIN')) return AssetClassCode.CRYPTO;
    if (clean.includes('MUTUAL') || clean.includes('MF')) return AssetClassCode.MUTUAL_FUNDS;
    if (clean.includes('ETF')) return AssetClassCode.ETFS;
    if (clean.includes('BOND')) return AssetClassCode.BONDS;
    if (clean.includes('CASH')) return AssetClassCode.CASH;

    // Symbol heuristics
    if (['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'DOGE'].includes(symbol.toUpperCase())) {
      return AssetClassCode.CRYPTO;
    }

    return AssetClassCode.STOCKS;
  }
}
