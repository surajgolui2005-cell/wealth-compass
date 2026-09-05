import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { ProviderCode } from "@prisma/client";
import { EncryptionService } from "../../../common/crypto/encryption.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTransactionDto } from "../../portfolio/dto/create-transaction.dto";
import { PortfolioService } from "../../portfolio/services/portfolio.service";
import { TransactionService } from "../../portfolio/services/transaction.service";
import { CsvProviderAdapter } from "../adapters/csv-provider.adapter";
import { CsvColumnMapping, RawExternalTransaction } from "../interfaces/provider.interface";
import { ProviderFactoryService } from "./provider-factory.service";

export interface ConnectAccountDto {
  providerCode: ProviderCode | string;
  accountName: string;
  credentials?: Record<string, any>;
}

@Injectable()
export class ProviderIngestionService {
  private readonly logger = new Logger(ProviderIngestionService.name);
  private readonly crypto: EncryptionService;

  constructor(
    private readonly providerFactory: ProviderFactoryService,
    private readonly transactionService: TransactionService,
    private readonly csvAdapter: CsvProviderAdapter,
    @Optional() private readonly portfolioService?: PortfolioService,
    @Optional() private readonly encryptionService?: EncryptionService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    this.crypto = encryptionService || new EncryptionService();
  }

  /**
   * Encrypts and securely persists financial provider credentials at rest.
   * Credentials stored in the database are encrypted with AES-256-GCM.
   */
  async saveProviderAccount(userId: string, dto: ConnectAccountDto) {
    if (!this.prisma) {
      throw new Error("PrismaService is not available");
    }

    let encryptedCredentials: string | null = null;
    if (dto.credentials && Object.keys(dto.credentials).length > 0) {
      encryptedCredentials = this.crypto.encryptCredentials(dto.credentials);
    }

    const account = await this.prisma.financialProviderAccount.create({
      data: {
        userId,
        providerCode: dto.providerCode as ProviderCode,
        accountName: dto.accountName.trim(),
        encryptedCredentials,
        status: "CONNECTED",
      },
    });

    return {
      id: account.id,
      userId: account.userId,
      providerCode: account.providerCode,
      accountName: account.accountName,
      status: account.status,
      hasCredentials: Boolean(account.encryptedCredentials),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Retrieves all provider accounts for a user with credentials scrubbed.
   */
  async getProviderAccounts(userId: string) {
    if (!this.prisma) {
      return [];
    }

    const accounts = await this.prisma.financialProviderAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return accounts.map((acc) => ({
      id: acc.id,
      userId: acc.userId,
      providerCode: acc.providerCode,
      accountName: acc.accountName,
      status: acc.status,
      lastSyncAt: acc.lastSyncAt,
      lastSyncStatus: acc.lastSyncStatus,
      hasCredentials: Boolean(acc.encryptedCredentials),
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    }));
  }

  /**
   * Soft-deletes a connected provider account, enforcing strict user ownership.
   */
  async deleteProviderAccount(userId: string, accountId: string) {
    if (!this.prisma) {
      throw new Error("PrismaService is not available");
    }

    const account = await this.prisma.financialProviderAccount.findFirst({
      where: { id: accountId, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException(`Provider account with ID "${accountId}" not found`);
    }

    return this.prisma.financialProviderAccount.update({
      where: { id: accountId },
      data: { deletedAt: new Date(), status: "DISCONNECTED" },
    });
  }

  /**
   * Parses and ingests transactions from raw CSV string into a target portfolio.
   * Validates portfolio ownership before parsing to prevent IDOR attacks.
   */
  async ingestCsvContent(
    userId: string,
    portfolioId: string,
    csvContent: string,
    customMapping?: CsvColumnMapping,
  ) {
    // IDOR Prevention: Assert requesting user owns the portfolio
    if (this.portfolioService) {
      await this.portfolioService.getPortfolioById(userId, portfolioId);
    }

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
   * Synchronizes holdings & historical transactions from an external broker provider API.
   * Enforces portfolio ownership (preventing IDOR) and uses decrypted credentials from database if available.
   */
  async syncProviderAccount(
    userId: string,
    portfolioId: string,
    providerCode: ProviderCode | string,
    credentials: Record<string, any> = {},
    accountId?: string,
  ) {
    // 1. IDOR Prevention: Verify portfolio ownership before initiating external sync
    if (this.portfolioService) {
      await this.portfolioService.getPortfolioById(userId, portfolioId);
    }

    // 2. Decrypt stored credentials if available
    let resolvedCredentials = { ...credentials };
    let providerAccount: any = null;

    if (this.prisma) {
      if (accountId) {
        providerAccount = await this.prisma.financialProviderAccount.findFirst({
          where: { id: accountId, userId, deletedAt: null },
        });
        if (!providerAccount) {
          throw new NotFoundException(`Provider account with ID "${accountId}" not found`);
        }
      } else {
        providerAccount = await this.prisma.financialProviderAccount.findFirst({
          where: {
            userId,
            providerCode: providerCode as ProviderCode,
            deletedAt: null,
          },
          orderBy: { updatedAt: "desc" },
        });
      }

      if (providerAccount?.encryptedCredentials && Object.keys(resolvedCredentials).length === 0) {
        // Decrypt stored credentials with AES-256-GCM just-in-time
        resolvedCredentials = this.crypto.decryptCredentials(providerAccount.encryptedCredentials);
      }
    }

    const provider = this.providerFactory.getProvider(providerCode);

    const mergedCredentials = {
      ...resolvedCredentials,
      providerCode,
    };

    try {
      // 3. Authenticate with provider
      await provider.connect(mergedCredentials);

      // 4. Fetch external transactions
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

      if (this.prisma && providerAccount) {
        await this.prisma.financialProviderAccount.update({
          where: { id: providerAccount.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: importErrors.length > 0 ? "PARTIAL" : "SUCCESS",
            syncErrorMessage: importErrors.length > 0 ? importErrors.join("; ") : null,
          },
        });
      }

      return {
        providerCode,
        syncedAt: new Date(),
        importedCount: importedTransactions.length,
        errors: importErrors,
        transactions: importedTransactions,
      };
    } catch (err: any) {
      if (this.prisma && providerAccount) {
        await this.prisma.financialProviderAccount.update({
          where: { id: providerAccount.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: "FAILED",
            syncErrorMessage: err.message,
          },
        });
      }
      throw err;
    }
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
      quantity: typeof raw.quantity === "number" ? raw.quantity : parseFloat(raw.quantity),
      pricePerUnit:
        typeof raw.pricePerUnit === "number" ? raw.pricePerUnit : parseFloat(raw.pricePerUnit),
      fees:
        raw.fees !== undefined
          ? typeof raw.fees === "number"
            ? raw.fees
            : parseFloat(raw.fees)
          : 0,
      assetClassCode: raw.assetClassCode,
      currency: raw.currency?.toUpperCase() || "INR",
      transactedAt:
        raw.transactedAt instanceof Date && !isNaN(raw.transactedAt.getTime())
          ? raw.transactedAt
          : new Date(),
      notes:
        raw.notes || `Imported via Integration Layer (${raw.providerRefId || "External Provider"})`,
    };
  }
}
