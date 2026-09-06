import { Global, Module } from "@nestjs/common";
import { PinoLoggerService } from "./pino-logger.service";
import { MetricsService } from "./metrics.service";
import { SentryService } from "./sentry.service";
import { MetricsInterceptor } from "./metrics.interceptor";

@Global()
@Module({
  providers: [PinoLoggerService, MetricsService, SentryService, MetricsInterceptor],
  exports: [PinoLoggerService, MetricsService, SentryService, MetricsInterceptor],
})
export class ObservabilityModule {}
