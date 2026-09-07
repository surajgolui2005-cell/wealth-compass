import { Test, TestingModule } from "@nestjs/testing";
import { ProviderCode, TransactionType } from "@prisma/client";
import { TransactionService } from "../../portfolio/services/transaction.service";
import { CsvProviderAdapter } from "../adapters/csv-provider.adapter";
import { ManualEntryAdapter } from "../adapters/manual-entry.adapter";
import { MockBrokerProviderAdapter } from "../adapters/mock-broker.adapter";
import { RbiAccountAggregatorAdapter } from "../adapters/rbi-account-aggregator.adapter";
import { CamsCasPdfAdapter } from "../adapters/cams-cas-pdf.adapter";
import { ProviderFactoryService } from "../services/provider-factory.service";
import { ProviderIngestionService } from "../services/provider-ingestion.service";

describe("ProviderIngestionService", () => {
  let ingestionService: ProviderIngestionService;
  let transactionServiceMock: any;

  beforeEach(async () => {
    transactionServiceMock = {
      recordTransaction: jest.fn().mockImplementation((userId, dto) => ({
        transaction: {
          id: `tx-mock-${Math.random()}`,
          portfolioId: dto.portfolioId,
          type: dto.type,
          quantity: dto.quantity,
          pricePerUnit: dto.pricePerUnit,
          totalAmount: dto.quantity * dto.pricePerUnit + (dto.fees || 0),
        },
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderIngestionService,
        ProviderFactoryService,
        ManualEntryAdapter,
        CsvProviderAdapter,
        MockBrokerProviderAdapter,
        {
          provide: RbiAccountAggregatorAdapter,
          useValue: {
            getProviderCode: () => ProviderCode.RBI_AA,
            validateConfig: jest.fn().mockReturnValue(true),
            testConnection: jest.fn().mockResolvedValue(true),
            fetchHoldings: jest.fn().mockResolvedValue([]),
            fetchTransactions: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: CamsCasPdfAdapter,
          useValue: {
            getProviderCode: () => (ProviderCode as any).CAMS_CAS ?? "CAMS_CAS",
            validateConfig: jest.fn().mockReturnValue(true),
            testConnection: jest.fn().mockResolvedValue(true),
            fetchHoldings: jest.fn().mockResolvedValue([]),
            fetchTransactions: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: TransactionService, useValue: transactionServiceMock },
      ],
    }).compile();

    const factory = module.get<ProviderFactoryService>(ProviderFactoryService);
    factory.onModuleInit();

    ingestionService = module.get<ProviderIngestionService>(ProviderIngestionService);
  });

  it("should ingest CSV content into canonical portfolio transactions", async () => {
    const csv = `Symbol,Date,Type,Quantity,Price,Fees\nRELIANCE,2026-01-15,BUY,10,2450.50,12.50\nTCS,2026-02-01,BUY,5,3800.00,10.00`;

    const result = await ingestionService.ingestCsvContent(
      "user-uuid-123",
      "portfolio-uuid-123",
      csv,
    );

    expect(result.importedCount).toBe(2);
    expect(transactionServiceMock.recordTransaction).toHaveBeenCalledTimes(2);
    expect(transactionServiceMock.recordTransaction).toHaveBeenCalledWith(
      "user-uuid-123",
      expect.objectContaining({
        portfolioId: "portfolio-uuid-123",
        symbol: "RELIANCE",
        type: TransactionType.BUY,
        quantity: 10,
        pricePerUnit: 2450.5,
      }),
    );
  });

  it("should sync external broker transactions via mock broker adapter", async () => {
    const result = await ingestionService.syncProviderAccount(
      "user-uuid-123",
      "portfolio-uuid-123",
      ProviderCode.ZERODHA,
    );

    expect(result.providerCode).toBe(ProviderCode.ZERODHA);
    expect(result.importedCount).toBeGreaterThan(0);
    expect(transactionServiceMock.recordTransaction).toHaveBeenCalled();
  });
});
