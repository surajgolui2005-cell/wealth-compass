import { BadRequestException } from '@nestjs/common';

export class InsufficientCashException extends BadRequestException {
  constructor(portfolioId: string, requestedAmount: number | string, currentCash: number | string) {
    super(
      `Insufficient cash balance in portfolio ${portfolioId}. Attempted cash transaction of ${requestedAmount}, but available cash balance is ${currentCash}.`,
    );
  }
}
