/**
 * ReportSchedulerProcessor
 * ─────────────────────────
 * BullMQ Worker that processes the `report-generation` queue.
 *
 * Handles one job type:
 *
 *  GENERATE_REPORT
 *    ─ Updates Report.status to PROCESSING.
 *    ─ Delegates to PdfReportService.generate() to build the PDF buffer.
 *    ─ Encodes the buffer as base64 and stores it in Report.fileUrl.
 *      (Production: swap this for an S3 upload and store the S3 URL instead.)
 *    ─ Updates Report.status to COMPLETED, sets generatedAt + fileSizeBytes.
 *    ─ On failure: sets Report.status = FAILED, writes errorMessage.
 *    ─ Re-throws the error so BullMQ applies exponential backoff retries.
 *
 * Concurrency: 2 — allows two reports to generate in parallel while
 * preventing Redis / DB connection saturation.
 *
 * File storage strategy:
 *   Report.fileUrl is set to `data:application/pdf;base64,<b64>` for the
 *   in-process download endpoint. This is intentionally simple; a follow-up
 *   step can introduce S3 with pre-signed URLs by changing only this processor.
 */

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { ReportStatus, ReportType } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { PdfReportService } from "../services/pdf-report.service";
import { REPORT_GENERATION_QUEUE, REPORT_JOBS, GenerateReportPayload } from "../interfaces/report-queue.interface";

@Processor(REPORT_GENERATION_QUEUE, { concurrency: 2 })
export class ReportSchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportSchedulerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfReportService: PdfReportService,
  ) {
    super();
  }

  // ── Job Router ────────────────────────────────────────────────────────────────

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job "${job.name}" [id: ${job.id}]`);

    switch (job.name) {
      case REPORT_JOBS.GENERATE_REPORT:
        return this.handleGenerateReport(job as Job<GenerateReportPayload>);

      default:
        this.logger.warn(`Unknown job name "${job.name}" — skipping`);
        return { skipped: true, reason: `Unknown job: ${job.name}` };
    }
  }

  // ── Handler: GENERATE_REPORT ──────────────────────────────────────────────────

  private async handleGenerateReport(job: Job<GenerateReportPayload>): Promise<object> {
    const startMs = Date.now();
    const { reportId, userId, portfolioId, reportType } = job.data;

    // ── 1. Mark as PROCESSING ────────────────────────────────────────────────────
    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.PROCESSING },
    });

    this.logger.log(
      `Report [${reportId}] marked PROCESSING [type: ${reportType}, portfolio: ${portfolioId}]`,
    );

    try {
      // ── 2. Generate PDF buffer ─────────────────────────────────────────────────
      const pdfBuffer = await this.pdfReportService.generate(
        userId,
        portfolioId,
        reportType as ReportType,
      );

      // ── 3. Encode and store ────────────────────────────────────────────────────
      // Stored as a base64 data URI for the in-process download endpoint.
      // Replace this block with S3 upload when object storage is wired in.
      const base64 = pdfBuffer.toString("base64");
      const fileUrl = `data:application/pdf;base64,${base64}`;

      // ── 4. Mark as COMPLETED ───────────────────────────────────────────────────
      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.COMPLETED,
          fileUrl,
          fileSizeBytes: pdfBuffer.length,
          generatedAt: new Date(),
        },
      });

      const durationMs = Date.now() - startMs;
      this.logger.log(
        `Report [${reportId}] COMPLETED — ` +
          `${pdfBuffer.length} bytes, ${durationMs}ms`,
      );

      return { reportId, status: "COMPLETED", fileSizeBytes: pdfBuffer.length, durationMs };
    } catch (err) {
      const message = (err as Error).message;

      // ── 5. Mark as FAILED ─────────────────────────────────────────────────────
      try {
        await this.prisma.report.update({
          where: { id: reportId },
          data: {
            status: ReportStatus.FAILED,
            errorMessage: message.slice(0, 1000), // truncate to DB column limit
          },
        });
      } catch (updateErr) {
        this.logger.error(
          `Could not mark Report ${reportId} as FAILED: ${(updateErr as Error).message}`,
        );
      }

      this.logger.error(`Report [${reportId}] FAILED — ${message}`);

      // Re-throw so BullMQ applies exponential backoff retries
      throw err;
    }
  }
}
