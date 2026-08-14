import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AssetClassCode, ProviderCode, TransactionType } from '@prisma/client';
import {
  FinancialDataProvider,
  RawExternalHolding,
  RawExternalTransaction,
} from '../interfaces/provider.interface';

@Injectable()
export class MockBrokerProviderAdapter implements FinancialDataProvider {
  private readonly supportedBrokerCodes: string[] = [
    ProviderCode.ZERODHA,
    ProviderCode.GROWW,
    ProviderCode.BINANCE,
    ProviderCode.ICICI_DIRECT,
    ProviderCode.WAZIRX,
  ];

  getProviderCode(): string {
    return 'MOCK_BROKER_FACTORY';
  }

  isSupported(providerCode: ProviderCode | string): boolean {
    return this.supportedBrokerCodes.includes(providerCode.toString());
  }

  validateConfig(config: Record<string, any>): boolean {
    return Boolean(config && (config.apiKey || config.accessToken || config.mockCredentials));
  }

  async connect(credentials: Record<string, any>): Promise<{ connected: boolean; message?: string }> {
    if (credentials?.invalidCredentials) {
      throw new UnauthorizedException('Invalid broker API key or session token');
    }

    return {
      connected: true,
      message: `Successfully authenticated with ${credentials.providerCode || 'broker API'}.`,
    };
  }

  async fetchHoldings(credentials: Record<string, any>): Promise<RawExternalHolding[]> {
    await this.connect(credentials);
    const providerCode = credentials.providerCode || ProviderCode.ZERODHA;

    if (providerCode === ProviderCode.BINANCE || providerCode === ProviderCode.WAZIRX) {
      return [
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          quantity: 0.25,
          avgCostBasis: 4500000,
          currentPrice: 5200000,
          assetClassCode: AssetClassCode.CRYPTO,
          currency: 'INR',
          externalRefId: 'binance-btc-001',
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          quantity: 2.5,
          avgCostBasis: 220000,
          currentPrice: 280000,
          assetClassCode: AssetClassCode.CRYPTO,
          currency: 'INR',
          externalRefId: 'binance-eth-002',
        },
      ];
    }

    // Default Indian Equity / Mutual Fund Broker Mock
    return [
      {
        symbol: 'RELIANCE',
        name: 'Reliance Industries Ltd',
        quantity: 50,
        avgCostBasis: 2450.0,
        currentPrice: 2950.0,
        assetClassCode: AssetClassCode.STOCKS,
        currency: 'INR',
        externalRefId: 'zerodha-rel-101',
      },
      {
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        quantity: 25,
        avgCostBasis: 3500.0,
        currentPrice: 4150.0,
        assetClassCode: AssetClassCode.STOCKS,
        currency: 'INR',
        externalRefId: 'zerodha-tcs-102',
      },
      {
        symbol: 'NIFTYBEES',
        name: 'Nippon India ETF Nifty BeES',
        quantity: 500,
        avgCostBasis: 220.0,
        currentPrice: 260.0,
        assetClassCode: AssetClassCode.ETFS,
        currency: 'INR',
        externalRefId: 'zerodha-etf-103',
      },
    ];
  }

  async fetchTransactions(
    credentials: Record<string, any>,
    _startDate?: Date,
  ): Promise<RawExternalTransaction[]> {
    await this.connect(credentials);
    const providerCode = credentials.providerCode || ProviderCode.ZERODHA;
    const now = new Date();

    if (providerCode === ProviderCode.BINANCE || providerCode === ProviderCode.WAZIRX) {
      return [
        {
          symbol: 'BTC',
          type: TransactionType.BUY,
          quantity: 0.25,
          pricePerUnit: 4500000,
          fees: 500,
          transactedAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
          notes: 'Binance API Auto Sync BUY BTC',
          providerRefId: 'tx-binance-btc-101',
          assetClassCode: AssetClassCode.CRYPTO,
        },
        {
          symbol: 'ETH',
          type: TransactionType.BUY,
          quantity: 2.5,
          pricePerUnit: 220000,
          fees: 250,
          transactedAt: new Date(now.getTime() - 15 * 24 * 3600 * 1000),
          notes: 'Binance API Auto Sync BUY ETH',
          providerRefId: 'tx-binance-eth-102',
          assetClassCode: AssetClassCode.CRYPTO,
        },
      ];
    }

    return [
      {
        symbol: 'RELIANCE',
        type: TransactionType.BUY,
        quantity: 50,
        pricePerUnit: 2450.0,
        fees: 122.5,
        transactedAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000),
        notes: 'Zerodha Kite API Sync BUY RELIANCE',
        providerRefId: 'tx-zerodha-rel-201',
        assetClassCode: AssetClassCode.STOCKS,
      },
      {
        symbol: 'TCS',
        type: TransactionType.BUY,
        quantity: 25,
        pricePerUnit: 3500.0,
        fees: 87.5,
        transactedAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000),
        notes: 'Zerodha Kite API Sync BUY TCS',
        providerRefId: 'tx-zerodha-tcs-202',
        assetClassCode: AssetClassCode.STOCKS,
      },
      {
        symbol: 'TCS',
        type: TransactionType.DIVIDEND,
        quantity: 25,
        pricePerUnit: 24.0,
        fees: 0,
        transactedAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000),
        notes: 'Zerodha Kite Dividend Payout TCS',
        providerRefId: 'tx-zerodha-tcs-div-203',
        assetClassCode: AssetClassCode.STOCKS,
      },
    ];
  }
}
