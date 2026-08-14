import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from '../auth/auth.module';
import { PortfolioController } from './controllers/portfolio.controller';
import { TransactionController } from './controllers/transaction.controller';
import { HoldingService } from './services/holding.service';
import { PortfolioService } from './services/portfolio.service';
import { TransactionService } from './services/transaction.service';

@Module({
  imports: [AuthModule, EventEmitterModule.forRoot()],
  controllers: [PortfolioController, TransactionController],
  providers: [PortfolioService, HoldingService, TransactionService],
  exports: [PortfolioService, HoldingService, TransactionService],
})
export class PortfolioModule {}
