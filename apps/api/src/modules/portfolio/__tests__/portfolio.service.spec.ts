import { Test, TestingModule } from '@nestjs/testing';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { PortfolioNotFoundException } from '../exceptions/portfolio-not-found.exception';
import { PortfolioService } from '../services/portfolio.service';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let prisma: any;

  const mockPortfolio = {
    id: 'portfolio-uuid-1234',
    userId: 'user-uuid-1234',
    name: 'Main Equity Portfolio',
    description: 'Long-term equity & crypto holdings',
    isDefault: true,
    currency: 'INR',
    totalValue: new Decimal('150000.5000'),
    createdAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      portfolio: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPortfolio', () => {
    it('should create a portfolio and set default flag', async () => {
      prisma.portfolio.count.mockResolvedValue(0);
      prisma.portfolio.create.mockResolvedValue(mockPortfolio);

      const result = await service.createPortfolio('user-uuid-1234', {
        name: 'Main Equity Portfolio',
        currency: 'INR',
      });

      expect(prisma.portfolio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-uuid-1234',
          name: 'Main Equity Portfolio',
          isDefault: true,
          currency: 'INR',
        }),
      });
      expect(result).toEqual(mockPortfolio);
    });
  });

  describe('getUserPortfolios', () => {
    it('should return non-deleted user portfolios', async () => {
      prisma.portfolio.findMany.mockResolvedValue([mockPortfolio]);

      const result = await service.getUserPortfolios('user-uuid-1234');

      expect(prisma.portfolio.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1234', deletedAt: null },
        include: { _count: { select: { holdings: true } } },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getPortfolioById', () => {
    it('should return portfolio details if user owns it', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolioById('user-uuid-1234', 'portfolio-uuid-1234');
      expect(result).toEqual(mockPortfolio);
    });

    it('should throw PortfolioNotFoundException if portfolio does not exist', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(
        service.getPortfolioById('user-uuid-1234', 'invalid-id'),
      ).rejects.toThrow(PortfolioNotFoundException);
    });
  });

  describe('recalculatePortfolioTotal', () => {
    it('should calculate total portfolio value using Decimal.js across holdings', async () => {
      const mockTx = {
        holding: {
          findMany: jest.fn().mockResolvedValue([
            { currentValue: new Decimal('10000.5000') },
            { currentValue: new Decimal('25000.2500') },
          ]),
        },
        portfolio: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const total = await service.recalculatePortfolioTotal(mockTx, 'portfolio-uuid-1234');

      expect(total.toString()).toBe('35000.75');
      expect(mockTx.portfolio.update).toHaveBeenCalledWith({
        where: { id: 'portfolio-uuid-1234' },
        data: { totalValue: '35000.7500' },
      });
    });
  });
});
