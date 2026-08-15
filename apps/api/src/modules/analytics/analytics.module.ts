import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { AnalyticsClientService } from "./analytics-client.service";
import { AnalyticsController } from "./controllers/analytics.controller";

/**
 * AnalyticsModule
 * ===============
 * Bounded context connecting the NestJS API Gateway to the Python FastAPI
 * Quant Engine microservice for high-performance portfolio metrics (TWR, XIRR, Benchmark metrics).
 */
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsClientService],
  exports: [AnalyticsClientService],
})
export class AnalyticsModule {}
