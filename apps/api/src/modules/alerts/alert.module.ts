/**
 * AlertModule
 * ────────────
 * NestJS module that wires together the full alert + notification pipeline:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  portfolio.updated / holding.updated  (EventEmitter2 events)    │
 *   │                       │                                          │
 *   │               AlertEventListener                                 │
 *   │                       │  enqueues                                │
 *   │            alert-notifications queue  (BullMQ / Redis)           │
 *   │                       │                                          │
 *   │           NotificationProcessor  (WorkerHost)                   │
 *   │              │                  │                                │
 *   │  EVALUATE_PORTFOLIO_ALERTS    DISPATCH_NOTIFICATION             │
 *   │       (AlertEvaluatorEngine)   (in_app / email / webhook)       │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * REST API surface (AlertController):
 *   CRUD endpoints for AlertRules + AlertLog history + manual evaluate trigger.
 *
 * EventEmitterModule:
 *   Must be imported here so AlertEventListener can register @OnEvent handlers.
 *   The global EventEmitterModule.forRoot() registered in PortfolioModule is
 *   reused — NestJS de-duplicates global modules, so importing it here is safe.
 *
 * Exports:
 *   AlertService         — for future SchedulerModule integration
 *   AlertEvaluatorEngine — for future NotificationInboxModule
 */

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "../auth/auth.module";
import { AlertEvaluatorEngine } from "./alert-evaluator.engine";
import { AlertController } from "./alert.controller";
import { AlertService } from "./alert.service";
import { AlertEventListener } from "./alert-event.listener";
import { ConcentrationRuleEvaluator } from "./evaluators/concentration-rule.evaluator";
import { DrawdownRuleEvaluator } from "./evaluators/drawdown-rule.evaluator";
import { TargetDriftRuleEvaluator } from "./evaluators/target-drift-rule.evaluator";
import { VolatilityRuleEvaluator } from "./evaluators/volatility-rule.evaluator";
import { NotificationProcessor } from "./processors/notification.processor";
import { ALERT_NOTIFICATION_QUEUE } from "./interfaces/alert-queue.interface";

@Module({
  imports: [
    ConfigModule,
    AuthModule,

    // EventEmitter — registers @OnEvent handlers in AlertEventListener.
    // Safe to import multiple times; NestJS de-duplicates global modules.
    EventEmitterModule.forRoot(),

    // BullMQ queue registration with Redis connection from env.
    // Mirrors the pattern used in MarketDataModule exactly.
    BullModule.registerQueueAsync({
      name: ALERT_NOTIFICATION_QUEUE,
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
          // Fallback to defaults
        }

        return {
          connection: { host, port, password, maxRetriesPerRequest: null },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: "exponential", delay: 5_000 },
            removeOnComplete: { count: 500 },
            removeOnFail: { count: 200 },
          },
        };
      },
    }),
  ],
  controllers: [AlertController],
  providers: [
    // Domain service
    AlertService,

    // Evaluation engine
    AlertEvaluatorEngine,

    // Concrete rule evaluators
    DrawdownRuleEvaluator,
    ConcentrationRuleEvaluator,
    VolatilityRuleEvaluator,
    TargetDriftRuleEvaluator,

    // Event-driven pipeline
    AlertEventListener,
    NotificationProcessor,
  ],
  exports: [AlertService, AlertEvaluatorEngine],
})
export class AlertModule {}
