import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssetClassCode, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { InsufficientHoldingException } from '../exceptions/insufficient-holding.exception';
import { InsufficientCashException } from '../exceptions/insufficient-cash.exception';
import { HoldingService } from '../services/holding.service';
import { PortfolioService } from '../services/portfolio.service';
import { TransactionService } from '../services/transaction.service';

describe('TransactionService & Holding Domain Engine', () => {
  let transactionService: TransactionService;
  let holdingService: HoldingService;
  let portfolioService: PortfolioService;
  let eventEmitter: EventEmitter2;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      assetClass: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      asset: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      holding: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      portfolio: {
        update: jest.fn(),
      },
    };

    const portfolioServiceMock = {
      getPortfolioById: jest.fn().mockResolvedValue({
        id: 'portfolio-uuid-1234',
        userId: 'user-uuid-1234',
        name: 'Main Equity Portfolio',
        currency: 'INR',
      }),
      recalculatePortfolioTotal: jest.fn().mockResolvedValue(new Decimal('50000.0000')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        HoldingService,
        { provide: PortfolioService, useValue: portfolioServiceMock },
        { provide: PrismaService, useValue: prisma },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    transactionService = module.get<TransactionService>(TransactionService);
    holdingService = module.get<HoldingService>(HoldingService);
    portfolioService = module.get<PortfolioService>(PortfolioService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('Holding Position State Math (Decimal.js)', () => {
    it('should calculate weighted average cost basis accurately on BUY', () => {
      // Held: 10 units @ 100 cost basis. Total cost = 1000.
      // BUY: 10 units @ 200 + 10 fees. Tx cost = 2010. Total cost = 3010.
      // New Q = 20. New Cost Basis = 3010 / 20 = 150.5
      const state = holdingService.calculateNewHoldingState(
        '10.00000000',
        '100.00000000',
        TransactionType.BUY,
        10,
        200,
        10,
        'RELIANCE',
      );

      expect(state.quantity).toBe('20.00000000');
      expect(state.avgCostBasis).toBe('150.50000000');
      expect(state.currentValue).toBe('4000.0000');
    });

    it('should decrease quantity on SELL without changing average cost basis', () => {
      // Held: 10 units @ 100 cost basis.
      // SELL: 4 units @ 150.
      // New Q = 6. Avg Cost Basis = 100.
      const state = holdingService.calculateNewHoldingState(
        '10.00000000',
        '100.00000000',
        TransactionType.SELL,
        4,
        150,
        0,
        'RELIANCE',
      );

      expect(state.quantity).toBe('6.00000000');
      expect(state.avgCostBasis).toBe('100.00000000');
      expect(state.currentValue).toBe('900.0000');
    });

    it('should throw InsufficientHoldingException when SELL quantity exceeds held quantity', () => {
      expect(() => {
        holdingService.calculateNewHoldingState(
          '10.00000000',
          '100.00000000',
          TransactionType.SELL,
          15, // Attempting to sell 15 when holding only 10
          200,
          0,
          'RELIANCE',
        );
      }).toThrow(InsufficientHoldingException);
    });

    it('should maintain target asset quantity and cost basis on DIVIDEND transaction', () => {
      const state = holdingService.calculateNewHoldingState(
        '10.00000000',
        '100.00000000',
        TransactionType.DIVIDEND,
        0,
        500, // 500 total dividend
        0,
        'RELIANCE',
        1,
        '150.00000000',
      );

      expect(state.quantity).toBe('10.00000000');
      expect(state.avgCostBasis).toBe('100.00000000');
    });

    it('should adjust quantity and average cost basis proportionally on SPLIT (2-for-1)', () => {
      // Held: 10 units @ 100 cost basis. Total cost = 1000.
      // 2-for-1 split (splitRatio = 2)
      // New Q = 20. New Cost Basis = 50. Total cost = 1000.
      const state = holdingService.calculateNewHoldingState(
        '10.00000000',
        '100.00000000',
        TransactionType.SPLIT,
        0,
        0,
        0,
        'TCS',
        2,
        '200.00000000',
      );

      expect(state.quantity).toBe('20.00000000');
      expect(state.avgCostBasis).toBe('50.00000000');
    });

    it('should dilute average cost basis on BONUS share issuance', () => {
      // Held: 10 units @ 100 cost basis. Total cost = 1000.
      // BONUS: 10 free shares.
      // New Q = 20. New Cost Basis = 1000 / 20 = 50.
      const state = holdingService.calculateNewHoldingState(
        '10.00000000',
        '100.00000000',
        TransactionType.BONUS,
        10,
        0,
        0,
        'INFY',
      );

      expect(state.quantity).toBe('20.00000000');
      expect(state.avgCostBasis).toBe('50.00000000');
    });
  });

  describe('recordTransaction with Cash Balance & Events', () => {
    it('should record DEPOSIT transaction and increase CASH holding balance', async () => {
      prisma.assetClass.findUnique.mockResolvedValue({ id: 'ac-cash', code: AssetClassCode.CASH });
      prisma.asset.findFirst.mockResolvedValue({ id: 'asset-cash', symbol: 'CASH' });
      prisma.holding.findFirst.mockResolvedValue({
        id: 'holding-cash-1',
        portfolioId: 'portfolio-uuid-1234',
        assetId: 'asset-cash',
        symbol: 'CASH',
        quantity: new Decimal('5000.00000000'),
        avgCostBasis: new Decimal('1.00000000'),
        currentPrice: new Decimal('1.00000000'),
      });

      prisma.holding.update.mockResolvedValue({
        id: 'holding-cash-1',
        quantity: new Decimal('15000.00000000'),
        avgCostBasis: new Decimal('1.00000000'),
        currentValue: new Decimal('15000.0000'),
      });

      prisma.transaction.create.mockResolvedValue({
        id: 'tx-dep-1',
        holdingId: 'holding-cash-1',
        type: TransactionType.DEPOSIT,
        quantity: new Decimal('10000'),
        pricePerUnit: new Decimal('1'),
        fees: new Decimal('0'),
        totalAmount: new Decimal('10000'),
        transactedAt: new Date(),
      });

      const result = await transactionService.recordTransaction('user-uuid-1234', {
        portfolioId: 'portfolio-uuid-1234',
        symbol: 'CASH',
        type: TransactionType.DEPOSIT,
        quantity: 10000,
        pricePerUnit: 1,
        transactedAt: new Date(),
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.holding.update).toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(portfolioService.recalculatePortfolioTotal).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('transaction.recorded', expect.anything());
      expect(result.transaction.id).toBe('tx-dep-1');
    });

    it('should record BUY transaction, update target holding, and deduct CASH balance', async () => {
      prisma.assetClass.findUnique.mockResolvedValue({ id: 'ac-1', code: AssetClassCode.STOCKS });
      prisma.asset.findFirst
        .mockResolvedValueOnce({ id: 'asset-rel', symbol: 'RELIANCE' })
        .mockResolvedValueOnce({ id: 'asset-cash', symbol: 'CASH' });

      // First call for RELIANCE holding, second call for CASH holding inside updateCashBalance
      prisma.holding.findFirst
        .mockResolvedValueOnce({
          id: 'holding-rel-1',
          portfolioId: 'portfolio-uuid-1234',
          assetId: 'asset-rel',
          symbol: 'RELIANCE',
          quantity: new Decimal('10'),
          avgCostBasis: new Decimal('100'),
          currentPrice: new Decimal('100'),
        })
        .mockResolvedValueOnce({
          id: 'holding-cash-1',
          portfolioId: 'portfolio-uuid-1234',
          assetId: 'asset-cash',
          symbol: 'CASH',
          quantity: new Decimal('5000'),
          avgCostBasis: new Decimal('1'),
          currentPrice: new Decimal('1'),
        });

      prisma.holding.update
        .mockResolvedValueOnce({
          id: 'holding-rel-1',
          quantity: new Decimal('20'),
          avgCostBasis: new Decimal('150.5'),
          currentValue: new Decimal('4000'),
        })
        .mockResolvedValueOnce({
          id: 'holding-cash-1',
          quantity: new Decimal('2990'),
          currentValue: new Decimal('2990'),
        });

      prisma.transaction.create.mockResolvedValue({
        id: 'tx-buy-1',
        holdingId: 'holding-rel-1',
        type: TransactionType.BUY,
        quantity: new Decimal('10'),
        pricePerUnit: new Decimal('200'),
        fees: new Decimal('10'),
        totalAmount: new Decimal('2010'),
        transactedAt: new Date(),
      });

      const result = await transactionService.recordTransaction('user-uuid-1234', {
        portfolioId: 'portfolio-uuid-1234',
        symbol: 'RELIANCE',
        type: TransactionType.BUY,
        quantity: 10,
        pricePerUnit: 200,
        fees: 10,
        transactedAt: new Date(),
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('transaction.recorded', expect.anything());
      expect(result.transaction.id).toBe('tx-buy-1');
    });

    it('should throw InsufficientCashException when cash outflow exceeds available cash balance', async () => {
      prisma.assetClass.findUnique.mockResolvedValue({ id: 'ac-1', code: AssetClassCode.STOCKS });
      prisma.asset.findFirst
        .mockResolvedValueOnce({ id: 'asset-rel', symbol: 'RELIANCE' })
        .mockResolvedValueOnce({ id: 'asset-cash', symbol: 'CASH' });

      prisma.holding.findFirst
        .mockResolvedValueOnce({
          id: 'holding-rel-1',
          portfolioId: 'portfolio-uuid-1234',
          assetId: 'asset-rel',
          symbol: 'RELIANCE',
          quantity: new Decimal('0'),
          avgCostBasis: new Decimal('0'),
          currentPrice: new Decimal('0'),
        })
        .mockResolvedValueOnce({
          id: 'holding-cash-1',
          portfolioId: 'portfolio-uuid-1234',
          assetId: 'asset-cash',
          symbol: 'CASH',
          quantity: new Decimal('100'), // Only 100 cash available
          avgCostBasis: new Decimal('1'),
          currentPrice: new Decimal('1'),
        });

      prisma.holding.update.mockResolvedValue({
        id: 'holding-rel-1',
        quantity: new Decimal('10'),
      });

      prisma.transaction.create.mockResolvedValue({
        id: 'tx-buy-oversell',
      });

      await expect(
        transactionService.recordTransaction('user-uuid-1234', {
          portfolioId: 'portfolio-uuid-1234',
          symbol: 'RELIANCE',
          type: TransactionType.BUY,
          quantity: 10,
          pricePerUnit: 200, // Costs 2000, but only 100 cash available!
          fees: 0,
          transactedAt: new Date(),
        }),
      ).rejects.toThrow(InsufficientCashException);
    });
  });
});
