import { BadRequestException } from '@nestjs/common';
import { ProviderCode } from '@prisma/client';
import { CsvProviderAdapter } from '../adapters/csv-provider.adapter';
import { ManualEntryAdapter } from '../adapters/manual-entry.adapter';
import { MockBrokerProviderAdapter } from '../adapters/mock-broker.adapter';
import { FinancialDataProvider, RawExternalHolding, RawExternalTransaction } from '../interfaces/provider.interface';
import { ProviderFactoryService } from '../services/provider-factory.service';

class CustomDummyBrokerAdapter implements FinancialDataProvider {
  getProviderCode(): string {
    return 'INTERACTIVE_BROKERS';
  }

  validateConfig(): boolean {
    return true;
  }

  async connect(): Promise<{ connected: boolean; message?: string }> {
    return { connected: true };
  }

  async fetchHoldings(): Promise<RawExternalHolding[]> {
    return [{ symbol: 'AAPL', quantity: 10, currentPrice: 180 }];
  }

  async fetchTransactions(): Promise<RawExternalTransaction[]> {
    return [];
  }
}

describe('ProviderFactoryService', () => {
  let factory: ProviderFactoryService;
  let manualAdapter: ManualEntryAdapter;
  let csvAdapter: CsvProviderAdapter;
  let mockBrokerAdapter: MockBrokerProviderAdapter;

  beforeEach(() => {
    manualAdapter = new ManualEntryAdapter();
    csvAdapter = new CsvProviderAdapter();
    mockBrokerAdapter = new MockBrokerProviderAdapter();
    factory = new ProviderFactoryService(manualAdapter, csvAdapter, mockBrokerAdapter);
    factory.onModuleInit();
  });

  it('should resolve MANUAL adapter correctly', () => {
    const provider = factory.getProvider(ProviderCode.MANUAL);
    expect(provider.getProviderCode()).toBe(ProviderCode.MANUAL);
  });

  it('should resolve CSV adapter correctly', () => {
    const provider = factory.getProvider(ProviderCode.CSV);
    expect(provider.getProviderCode()).toBe(ProviderCode.CSV);
  });

  it('should resolve broker adapters (ZERODHA, BINANCE, GROWW) to MockBrokerProviderAdapter', () => {
    const zerodha = factory.getProvider(ProviderCode.ZERODHA);
    const binance = factory.getProvider(ProviderCode.BINANCE);

    expect(zerodha).toBe(mockBrokerAdapter);
    expect(binance).toBe(mockBrokerAdapter);
  });

  it('should throw BadRequestException when requesting an unsupported provider code', () => {
    expect(() => factory.getProvider('UNKNOWN_BROKER')).toThrow(BadRequestException);
  });

  it('should allow registering a new custom adapter without modifying core code', async () => {
    const customAdapter = new CustomDummyBrokerAdapter();
    factory.registerProvider(customAdapter);

    const resolved = factory.getProvider('INTERACTIVE_BROKERS');
    expect(resolved).toBe(customAdapter);

    const holdings = await resolved.fetchHoldings({});
    expect(holdings).toHaveLength(1);
    expect(holdings[0].symbol).toBe('AAPL');
  });
});
