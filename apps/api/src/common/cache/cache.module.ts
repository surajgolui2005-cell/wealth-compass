import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsCacheManager } from "./analytics-cache.manager";
import { AnalyticsCacheInterceptor } from "./cache.interceptor";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AnalyticsCacheManager, AnalyticsCacheInterceptor],
  exports: [AnalyticsCacheManager, AnalyticsCacheInterceptor],
})
export class CacheModule {}
