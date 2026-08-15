import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MarketDataModule } from "../market-data/market-data.module";
import { FifoCalculator } from "./fifo-calculator";
import { WeightedAvgCalculator } from "./weighted-avg-calculator";
import { CurrencyConverterService } from "./currency-converter";
import { ValuationEngine } from "./valuation.engine";
import { ValuationController } from "./controllers/valuation.controller";

/**
 * CalculatorModule — Bounded context for portfolio valuation, cost basis accounting,
 * currency conversions, and P&L analytics.
 *
 * Provides deterministic financial calculations via Decimal.js (28-digit precision).
 */
@Module({
  imports: [AuthModule, MarketDataModule],
  controllers: [ValuationController],
  providers: [FifoCalculator, WeightedAvgCalculator, CurrencyConverterService, ValuationEngine],
  exports: [ValuationEngine, CurrencyConverterService, FifoCalculator, WeightedAvgCalculator],
})
export class CalculatorModule {}
