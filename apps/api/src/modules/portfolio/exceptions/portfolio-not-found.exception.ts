import { NotFoundException } from '@nestjs/common';

export class PortfolioNotFoundException extends NotFoundException {
  constructor(portfolioId: string) {
    super(`Portfolio with ID ${portfolioId} was not found or access is denied.`);
  }
}
