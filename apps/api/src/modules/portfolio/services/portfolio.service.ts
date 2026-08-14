import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePortfolioDto } from '../dto/create-portfolio.dto';
import { UpdatePortfolioDto } from '../dto/update-portfolio.dto';
import { PortfolioNotFoundException } from '../exceptions/portfolio-not-found.exception';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async createPortfolio(userId: string, dto: CreatePortfolioDto) {
    if (dto.isDefault) {
      await this.prisma.portfolio.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const existingPortfolios = await this.prisma.portfolio.count({
      where: { userId, deletedAt: null },
    });

    const isFirstPortfolio = existingPortfolios === 0;

    return this.prisma.portfolio.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isDefault: dto.isDefault ?? isFirstPortfolio,
        currency: dto.currency?.toUpperCase() || 'INR',
        totalValue: 0,
      },
    });
  }

  async getUserPortfolios(userId: string) {
    return this.prisma.portfolio.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { holdings: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getPortfolioById(userId: string, portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId,
        deletedAt: null,
      },
      include: {
        holdings: {
          where: { deletedAt: null },
          include: {
            asset: true,
          },
        },
      },
    });

    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }

    return portfolio;
  }

  async updatePortfolio(userId: string, portfolioId: string, dto: UpdatePortfolioDto) {
    const portfolio = await this.getPortfolioById(userId, portfolioId);

    if (dto.isDefault) {
      await this.prisma.portfolio.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        isDefault: dto.isDefault,
        currency: dto.currency ? dto.currency.toUpperCase() : undefined,
      },
    });
  }

  async deletePortfolio(userId: string, portfolioId: string) {
    const portfolio = await this.getPortfolioById(userId, portfolioId);

    await this.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Portfolio successfully deleted' };
  }

  /**
   * Recalculates total portfolio net worth using Decimal.js across all active holdings
   */
  async recalculatePortfolioTotal(tx: any, portfolioId: string) {
    const holdings = await tx.holding.findMany({
      where: { portfolioId, deletedAt: null },
      select: { currentValue: true },
    });

    const totalValueDecimal = holdings.reduce(
      (sum: Decimal, h: any) => sum.plus(new Decimal(h.currentValue.toString())),
      new Decimal(0),
    );

    await tx.portfolio.update({
      where: { id: portfolioId },
      data: { totalValue: totalValueDecimal.toFixed(4) },
    });

    return totalValueDecimal;
  }
}
