import { Injectable } from '@nestjs/common';
import { ProviderCode } from '@prisma/client';
import {
  FinancialDataProvider,
  RawExternalHolding,
  RawExternalTransaction,
} from '../interfaces/provider.interface';

@Injectable()
export class ManualEntryAdapter implements FinancialDataProvider {
  getProviderCode(): ProviderCode | string {
    return ProviderCode.MANUAL;
  }

  validateConfig(_config: Record<string, any>): boolean {
    return true;
  }

  async connect(_credentials: Record<string, any>): Promise<{ connected: boolean; message?: string }> {
    return {
      connected: true,
      message: 'Manual entry adapter is active for local user portfolio recording.',
    };
  }

  async fetchHoldings(_credentials: Record<string, any>): Promise<RawExternalHolding[]> {
    return [];
  }

  async fetchTransactions(
    _credentials: Record<string, any>,
    _startDate?: Date,
  ): Promise<RawExternalTransaction[]> {
    return [];
  }
}
