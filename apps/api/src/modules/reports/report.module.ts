/**
 * ReportModule
 * ─────────────
 * NestJS module wiring together the full report generation pipeline:
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │  POST /api/v1/reports/pdf   (ReportController)                    │
 *   │                   │  enqueues                                      │
 *   │         report-generation queue  (BullMQ / Redis)                 │
 *   │                   │                                                │
 *   │       ReportSchedulerProcessor  (WorkerHost)                      │
 *   │               │                                                    │
 *   │    GENERATE_REPORT  ──► PdfReportService ──► pdfmake ──► Buffer   │
 *   │                   │  stores base64 in Report.fileUrl               │
 *   │                   │  updates status → COMPLETED / FAILED           │
 *   │                                                                    │
 *   │  POST /api/v1/reports/csv  (ReportController)                     │
 *   │               │  synchronous                                       │
 *   │    ExcelExportService ──► papaparse ──► CSV stream                │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * BullMQ queue options mirror the AlertModule pattern exactly.
 */

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "../auth/auth.module";
import { PdfReportService } from "./services/pdf-report.service";
import { ExcelExportService } from "./services/excel-export.service";
import { ReportSchedulerProcessor } from "./processors/report-scheduler.processor";
import { ReportService } from "./report.service";
import { ReportController } from "./report.controller";
import { REPORT_GENERATION_QUEUE } from "./interfaces/report-queue.interface";

@Module({
  imports: [
    ConfigModule,
    AuthModule,

    // BullMQ queue registration with Redis connection from env.
    // Mirrors the pattern used in AlertModule exactly.
    BullModule.registerQueueAsync({
      name: REPORT_GENERATION_QUEUE,
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
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
          },
        };
      },
    }),
  ],
  controllers: [ReportController],
  providers: [
    // Domain service (orchestrator)
    ReportService,

    // Generation services
    PdfReportService,
    ExcelExportService,

    // BullMQ async worker
    ReportSchedulerProcessor,
  ],
  exports: [ReportService, PdfReportService, ExcelExportService],
})
export class ReportModule {}
