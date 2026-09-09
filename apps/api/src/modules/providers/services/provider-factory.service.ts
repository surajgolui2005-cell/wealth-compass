import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { ProviderCode } from "@prisma/client";
import { CsvProviderAdapter } from "../adapters/csv-provider.adapter";
import { CamsCasPdfAdapter } from "../adapters/cams-cas-pdf.adapter";
import { ManualEntryAdapter } from "../adapters/manual-entry.adapter";
import { MockBrokerProviderAdapter } from "../adapters/mock-broker.adapter";
import { RbiAccountAggregatorAdapter } from "../adapters/rbi-account-aggregator.adapter";
import { FinancialDataProvider } from "../interfaces/provider.interface";

@Injectable()
export class ProviderFactoryService implements OnModuleInit {
  private readonly providerRegistry = new Map<string, FinancialDataProvider>();

  constructor(
    private readonly manualAdapter: ManualEntryAdapter,
    private readonly csvAdapter: CsvProviderAdapter,
    private readonly mockBrokerAdapter: MockBrokerProviderAdapter,
    private readonly rbiAaAdapter: RbiAccountAggregatorAdapter,
    private readonly camsCasAdapter: CamsCasPdfAdapter,
  ) {}

  onModuleInit() {
    this.registerProvider(this.manualAdapter);
    this.registerProvider(this.csvAdapter);
    this.registerProvider(this.rbiAaAdapter);
    this.registerProvider(this.camsCasAdapter);

    // Register mock broker adapter for all supported broker codes
    const brokers = [
      ProviderCode.ZERODHA,
      ProviderCode.GROWW,
      ProviderCode.ANGEL_ONE,
      ProviderCode.UPSTOX,
      ProviderCode.BINANCE,
      ProviderCode.ICICI_DIRECT,
      ProviderCode.WAZIRX,
    ];

    for (const code of brokers) {
      this.providerRegistry.set(code.toString().toUpperCase(), this.mockBrokerAdapter);
    }
  }

  /**
   * Registers a new provider adapter instance dynamically
   */
  registerProvider(provider: FinancialDataProvider) {
    const code = provider.getProviderCode().toString().toUpperCase();
    this.providerRegistry.set(code, provider);
  }

  /**
   * Resolves the matching FinancialDataProvider for the given ProviderCode
   */
  getProvider(providerCode: ProviderCode | string): FinancialDataProvider {
    if (!providerCode) {
      throw new BadRequestException("Provider code is required");
    }

    const key = providerCode.toString().toUpperCase();
    const provider = this.providerRegistry.get(key);

    if (!provider) {
      throw new BadRequestException(`Financial provider code '${providerCode}' is not supported.`);
    }

    return provider;
  }

  /**
   * Returns list of all currently supported provider codes
   */
  getSupportedProviders(): string[] {
    return Array.from(this.providerRegistry.keys());
  }
}
