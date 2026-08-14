import { BadRequestException } from '@nestjs/common';

export class InsufficientHoldingException extends BadRequestException {
  constructor(symbol: string, requestedQuantity: number | string, currentQuantity: number | string) {
    super(
      `Insufficient holding position for asset ${symbol}. Attempted to sell ${requestedQuantity} units, but only ${currentQuantity} units are held.`,
    );
  }
}
