import { NotFoundException } from "@nestjs/common";
import { ProviderCode } from "@prisma/client";
import { EncryptionService } from "../../../common/crypto/encryption.service";
import { PortfolioService } from "../../portfolio/services/portfolio.service";
import { TransactionService } from "../../portfolio/services/transaction.service";
import { CsvProviderAdapter } from "../adapters/csv-provider.adapter";
import { ProviderFactoryService } from "../services/provider-factory.service";
import { ProviderIngestionService } from "../services/provider-ingestion.service";

describe("Provider Security & Encryption at Rest (OWASP A01 / A02)", () => {
  let service: ProviderIngestionService;
  let encryptionService: EncryptionService;
  let mockPrisma: any;
  let mockPortfolioService: any;
  let mockTransactionService: any;
  let mockProviderFactory: any;
  let mockCsvAdapter: any;
  let mockProviderInstance: any;

  const testUserA = "user-alice-1111";
  const testUserB = "user-bob-2222";
  const alicePortfolioId = "portfolio-alice-aaa";
  const bobPortfolioId = "portfolio-bob-bbb";

  beforeEach(() => {
    encryptionService = new EncryptionService(undefined, "test_key_for_security_audit_32!");

    mockPrisma = {
      financialProviderAccount: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: "acc-uuid-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        })),
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where.userId === testUserA) {
            return [
              {
                id: "acc-alice-1",
                userId: testUserA,
                providerCode: ProviderCode.ZERODHA,
                accountName: "Alice's Zerodha",
                encryptedCredentials: encryptionService.encryptCredentials({
                  apiKey: "alice_secret_api_key",
                  apiSecret: "alice_secret_api_secret",
                }),
                status: "CONNECTED",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
          }
          return [];
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (
            where.userId === testUserA &&
            (where.id === "acc-alice-1" || where.providerCode === ProviderCode.ZERODHA)
          ) {
            return {
              id: "acc-alice-1",
              userId: testUserA,
              providerCode: ProviderCode.ZERODHA,
              accountName: "Alice's Zerodha",
              encryptedCredentials: encryptionService.encryptCredentials({
                apiKey: "alice_secret_api_key",
                apiSecret: "alice_secret_api_secret",
              }),
              status: "CONNECTED",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          return null;
        }),
        update: jest.fn().mockImplementation(({ where, data }) => ({
          id: where.id,
          ...data,
        })),
      },
    };

    mockPortfolioService = {
      getPortfolioById: jest
        .fn()
        .mockImplementation(async (userId: string, portfolioId: string) => {
          if (userId === testUserA && portfolioId === alicePortfolioId) {
            return { id: alicePortfolioId, userId: testUserA, name: "Alice's Portfolio" };
          }
          if (userId === testUserB && portfolioId === bobPortfolioId) {
            return { id: bobPortfolioId, userId: testUserB, name: "Bob's Portfolio" };
          }
          // Throws NotFoundException if User attempts IDOR against another user's portfolio
          throw new NotFoundException(`Portfolio with ID "${portfolioId}" not found`);
        }),
    };

    mockTransactionService = {
      recordTransaction: jest.fn().mockResolvedValue({
        transaction: { id: "tx-1" },
      }),
    };

    mockProviderInstance = {
      connect: jest.fn().mockResolvedValue(true),
      fetchTransactions: jest.fn().mockResolvedValue([
        {
          symbol: "INFY",
          type: "BUY",
          quantity: 10,
          pricePerUnit: 1500,
          assetClassCode: "STOCKS",
        },
      ]),
    };

    mockProviderFactory = {
      getProvider: jest.fn().mockReturnValue(mockProviderInstance),
    };

    mockCsvAdapter = {
      parseCsvContent: jest.fn().mockReturnValue({
        transactions: [
          {
            symbol: "TCS",
            type: "BUY",
            quantity: 5,
            pricePerUnit: 3500,
            assetClassCode: "STOCKS",
          },
        ],
        skippedRowsCount: 0,
        errors: [],
      }),
    };

    service = new ProviderIngestionService(
      mockProviderFactory,
      mockTransactionService,
      mockCsvAdapter,
      mockPortfolioService,
      encryptionService,
      mockPrisma,
    );
  });

  describe("Database Credential Encryption at Rest (AES-256-GCM)", () => {
    it("should encrypt provider credentials in database records and NEVER store plaintext", async () => {
      const plainApiKey = "live_kite_api_key_8849204";
      const plainApiSecret = "live_kite_secret_token_1982348";

      const result = await service.saveProviderAccount(testUserA, {
        providerCode: ProviderCode.ZERODHA,
        accountName: "Zerodha Primary",
        credentials: {
          apiKey: plainApiKey,
          apiSecret: plainApiSecret,
        },
      });

      // 1. Verify Prisma create was called
      expect(mockPrisma.financialProviderAccount.create).toHaveBeenCalledTimes(1);
      const createPayload = mockPrisma.financialProviderAccount.create.mock.calls[0][0].data;

      // 2. Critical Security Check: Database payload contains encrypted ciphertext
      expect(createPayload.encryptedCredentials).toBeDefined();
      expect(typeof createPayload.encryptedCredentials).toBe("string");
      expect(createPayload.encryptedCredentials).not.toContain(plainApiKey);
      expect(createPayload.encryptedCredentials).not.toContain(plainApiSecret);

      // Verify format is AES-256-GCM iv:authTag:ciphertext (hex)
      const parts = createPayload.encryptedCredentials.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(24); // 12 bytes IV = 24 hex chars
      expect(parts[1]).toHaveLength(32); // 16 bytes auth tag = 32 hex chars

      // 3. Decrypt ciphertext to confirm fidelity
      const decrypted = encryptionService.decryptCredentials(createPayload.encryptedCredentials);
      expect(decrypted.apiKey).toBe(plainApiKey);
      expect(decrypted.apiSecret).toBe(plainApiSecret);

      // 4. Critical Security Check: API response NEVER includes credentials
      expect(result).not.toHaveProperty("credentials");
      expect(result).not.toHaveProperty("encryptedCredentials");
      expect(result.hasCredentials).toBe(true);
    });

    it("should scrub credentials from account listing responses", async () => {
      const accounts = await service.getProviderAccounts(testUserA);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].accountName).toBe("Alice's Zerodha");
      expect(accounts[0].hasCredentials).toBe(true);
      expect(accounts[0]).not.toHaveProperty("credentials");
      expect(accounts[0]).not.toHaveProperty("encryptedCredentials");
    });

    it("should decrypt stored credentials just-in-time when executing provider sync", async () => {
      await service.syncProviderAccount(testUserA, alicePortfolioId, ProviderCode.ZERODHA);

      expect(mockProviderInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "alice_secret_api_key",
          apiSecret: "alice_secret_api_secret",
          providerCode: ProviderCode.ZERODHA,
        }),
      );
    });
  });

  describe("IDOR Ownership Verification", () => {
    it("should reject User A attempting to import CSV into User B portfolio with 404", async () => {
      // Alice attempts to import CSV into Bob's portfolio
      await expect(
        service.ingestCsvContent(
          testUserA,
          bobPortfolioId,
          "Symbol,Date,Type,Quantity,Price\nINFY,2026-01-01,BUY,10,1500",
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPortfolioService.getPortfolioById).toHaveBeenCalledWith(testUserA, bobPortfolioId);
      expect(mockCsvAdapter.parseCsvContent).not.toHaveBeenCalled();
      expect(mockTransactionService.recordTransaction).not.toHaveBeenCalled();
    });

    it("should reject User A attempting to sync provider into User B portfolio with 404", async () => {
      // Alice attempts to sync into Bob's portfolio
      await expect(
        service.syncProviderAccount(testUserA, bobPortfolioId, ProviderCode.ZERODHA),
      ).rejects.toThrow(NotFoundException);

      expect(mockPortfolioService.getPortfolioById).toHaveBeenCalledWith(testUserA, bobPortfolioId);
      expect(mockProviderInstance.connect).not.toHaveBeenCalled();
      expect(mockProviderInstance.fetchTransactions).not.toHaveBeenCalled();
    });

    it("should reject User A attempting to delete User B provider account with 404", async () => {
      // Alice attempts to delete Bob's account
      await expect(service.deleteProviderAccount(testUserA, "acc-bob-account")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should succeed when User A accesses User A portfolio", async () => {
      const result = await service.ingestCsvContent(
        testUserA,
        alicePortfolioId,
        "Symbol,Date,Type,Quantity,Price\nTCS,2026-01-01,BUY,5,3500",
      );

      expect(result.importedCount).toBe(1);
      expect(mockPortfolioService.getPortfolioById).toHaveBeenCalledWith(
        testUserA,
        alicePortfolioId,
      );
      expect(mockTransactionService.recordTransaction).toHaveBeenCalledWith(
        testUserA,
        expect.objectContaining({ portfolioId: alicePortfolioId }),
      );
    });
  });
});
