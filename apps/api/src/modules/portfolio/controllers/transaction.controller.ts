import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { TransactionService } from '../services/transaction.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordTransaction(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionService.recordTransaction(req.user.id, dto);
  }

  @Get('portfolio/:portfolioId')
  @HttpCode(HttpStatus.OK)
  async getTransactionsByPortfolio(
    @Req() req: Request & { user: { id: string } },
    @Param('portfolioId') portfolioId: string,
  ) {
    return this.transactionService.getTransactionsByPortfolio(req.user.id, portfolioId);
  }

  @Get('holding/:holdingId')
  @HttpCode(HttpStatus.OK)
  async getTransactionsByHolding(
    @Req() req: Request & { user: { id: string } },
    @Param('holdingId') holdingId: string,
  ) {
    return this.transactionService.getTransactionsByHolding(req.user.id, holdingId);
  }
}
