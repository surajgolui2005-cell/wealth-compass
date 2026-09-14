import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "../auth/auth.module";
import { AlphaVantageProvider } from "./providers/alpha-vantage.provider";
import { CoinGeckoProvider } from "./providers/coingecko.provider";
import { YahooFinanceProvider } from "./providers/yahoo-finance.provider";
import { PriceCacheService } from "./services/price-cache.service";
import { MarketDataService } from "./services/market-data.service";
import { MarketDataProcessor } from "./workers/market-data.processor";
import { MarketDataScheduler } from "./workers/market-data.scheduler";
import { MarketDataController } from "./controllers/market-data.controller";
import { MARKET_DATA_QUEUE } from "./interfaces/price-cache.interface";

/**
 * MarketDataModule — self-contained bounded context for all price feed operations.
 */
@Module({
  imports: [
    ConfigModule,
    AuthModule,
    BullModule.registerQueueAsync({
      name: MARKET_DATA_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>("REDIS_URL", "redis://localhost:6379");
        let host = "localhost";
        let port = 6379;
        let password: string | undefined;

        try {
          const url = new URL(redisUrl);
          host = url.hostname;
          port = parseInt(url.port) || 6379;
          if (url.password) password = decodeURIComponent(url.password);
        } catch {
          // Fallback to defaults if URL parsing fails
        }

        return {
          connection: { host, port, password, maxRetriesPerRequest: null },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
          },
        };
      },
    }),
  ],
  controllers: [MarketDataController],
  providers: [
    // Price feed adapters
    YahooFinanceProvider,
    AlphaVantageProvider,
    CoinGeckoProvider,
    // Core services
    PriceCacheService,
    MarketDataService,
    // BullMQ workers
    MarketDataProcessor,
    MarketDataScheduler,
  ],
  exports: [MarketDataService, PriceCacheService, YahooFinanceProvider],
})
export class MarketDataModule {}
