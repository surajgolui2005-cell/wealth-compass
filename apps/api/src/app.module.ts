import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { PortfolioModule } from "./modules/portfolio/portfolio.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { MarketDataModule } from "./modules/market-data/market-data.module";
import { CalculatorModule } from "./modules/calculator/calculator.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AlertModule } from "./modules/alerts/alert.module";
import { ReportModule } from "./modules/reports/report.module";
import { CacheModule } from "./common/cache/cache.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { ObservabilityModule } from "./common/observability/observability.module";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.example"],
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    CryptoModule,
    CacheModule,
    ObservabilityModule,
    HealthModule,
    AuthModule,
    PortfolioModule,
    ProvidersModule,
    MarketDataModule,
    CalculatorModule,
    AnalyticsModule,
    AlertModule,
    ReportModule,
  ],
})
export class AppModule {}
