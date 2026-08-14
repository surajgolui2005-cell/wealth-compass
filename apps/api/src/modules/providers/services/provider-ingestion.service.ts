import { Injectable, Logger } from '@nestjs/common';
import { ProviderCode } from '@prisma/client';
import { CreateTransactionDto } from '../../portfolio/dto/create-transaction.dto';
import { TransactionService } from '../../portfolio/services/transaction.service';
import { CsvProviderAdapter } from '../adapters/csv-provider.adapter';
import { CsvColumnMapping, RawExternalTransaction } from '../interfaces/provider.interface';
import { ProviderFactoryService } from './provider-factory.service';

@Injectable()
export class ProviderIngestionService {
  private readonly logger = new Logger(ProviderIngestionService.name);

  constructor(
    private readonly providerFactory: ProviderFactoryService,
    private readonly transactionService: TransactionService,
    private readonly csvAdapter: CsvProviderAdapter,
  ) {}

  /**
   * Parses and ingests transactions from raw CSV string into a target portfolio
   */
  async ingestCsvContent(
    userId: string,
    portfolioId: string,
    csvContent: string,
    customMapping?: CsvColumnMapping,
  ) {
    const parseResult = this.csvAdapter.parseCsvContent(csvContent, customMapping);

    if (parseResult.transactions.length === 0) {
      return {
        importedCount: 0,
        skippedCount: parseResult.skippedRowsCount,
        errors: parseResult.errors,
        transactions: [],
      };
    }

    const importedTransactions = [];
    const importErrors = [...parseResult.errors];

    for (const rawTx of parseResult.transactions) {
      try {
        const dto = this.mapToCreateTransactionDto(portfolioId, rawTx);
        const result = await this.transactionService.recordTransaction(userId, dto);
        importedTransactions.push(result.transaction);
      } catch (err: any) {
        importErrors.push(`Failed to import transaction for ${rawTx.symbol}: ${err.message}`);
      }
    }

    return {
      importedCount: importedTransactions.length,
      skippedCount: parseResult.skippedRowsCount,
      errors: importErrors,
      transactions: importedTransactions,
    };
  }

  /**
   * Synchronizes holdings & historical transactions from an external broker provider API
   */
  async syncProviderAccount(
    userId: string,
    portfolioId: string,
    providerCode: ProviderCode | string,
    credentials: Record<string, any> = {},
  ) {
    const provider = this.providerFactory.getProvider(providerCode);

    const mergedCredentials = {
      ...credentials,
      providerCode,
    };

    // 1. Authenticate with provider
    await provider.connect(mergedCredentials);

    // 2. Fetch external transactions
    const rawTransactions = await provider.fetchTransactions(mergedCredentials);

    const importedTransactions = [];
    const importErrors = [];

    for (const rawTx of rawTransactions) {
      try {
        const dto = this.mapToCreateTransactionDto(portfolioId, rawTx);
        const result = await this.transactionService.recordTransaction(userId, dto);
        importedTransactions.push(result.transaction);
      } catch (err: any) {
        importErrors.push(`Failed to record ${rawTx.symbol} (${rawTx.type}): ${err.message}`);
      }
    }

    return {
      providerCode,
      syncedAt: new Date(),
      importedCount: importedTransactions.length,
      errors: importErrors,
      transactions: importedTransactions,
    };
  }

  /**
   * Converts a RawExternalTransaction from an adapter into a validated internal CreateTransactionDto
   */
  mapToCreateTransactionDto(
    portfolioId: string,
    raw: RawExternalTransaction,
  ): CreateTransactionDto {
    return {
      portfolioId,
      symbol: raw.symbol.trim().toUpperCase(),
      type: raw.type,
      quantity: typeof raw.quantity === 'number' ? raw.quantity : parseFloat(raw.quantity),
      pricePerUnit: typeof raw.pricePerUnit === 'number' ? raw.pricePerUnit : parseFloat(raw.pricePerUnit),
      fees: raw.fees !== undefined ? (typeof raw.fees === 'number' ? raw.fees : parseFloat(raw.fees)) : 0,
      assetClassCode: raw.assetClassCode,
      currency: raw.currency?.toUpperCase() || 'INR',
      transactedAt: raw.transactedAt instanceof Date && !isNaN(raw.transactedAt.getTime()) ? raw.transactedAt : new Date(),
      notes: raw.notes || `Imported via Integration Layer (${raw.providerRefId || 'External Provider'})`,
    };
  }
}
