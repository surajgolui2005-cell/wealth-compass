/**
 * ReportService
 * ─────────────
 * Orchestration layer for the reporting engine.
 *
 * Responsibilities:
 *   - requestPdfReport   — create a Report row (PENDING), enqueue a BullMQ job
 *   - requestCsvReport   — generate CSV synchronously, return the content
 *   - getReportStatus    — return the current Report row (status polling)
 *   - downloadReport     — decode the stored PDF buffer and stream it
 *   - listReports        — paginated report history for the user
 *
 * Security:
 *   All methods verify that the requested report/portfolio belongs to the
 *   authenticated user (userId) before taking action, preventing IDOR.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Response } from "express";
import { FileFormat, ReportStatus, ReportType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ExcelExportService } from "./services/excel-export.service";
import { GeneratePdfReportDto, GenerateCsvReportDto } from "./dto/report.dto";
import {
  REPORT_GENERATION_QUEUE,
  REPORT_JOBS,
  GenerateReportPayload,
} from "./interfaces/report-queue.interface";

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelExportService: ExcelExportService,
    @InjectQueue(REPORT_GENERATION_QUEUE)
    private readonly reportQueue: Queue,
  ) {}

  // ── PDF Report ────────────────────────────────────────────────────────────────

  /**
   * Enqueue an async PDF report generation job.
   * Returns immediately with { reportId, status: "PENDING" }.
   */
  async requestPdfReport(
    userId: string,
    dto: GeneratePdfReportDto,
  ): Promise<{ reportId: string; status: string; message: string }> {
    // Verify portfolio ownership
    await this.assertPortfolioOwnership(userId, dto.portfolioId);

    // Create a Report record in PENDING state
    const report = await this.prisma.report.create({
      data: {
        userId,
        portfolioId: dto.portfolioId,
        reportType: dto.reportType,
        fileFormat: FileFormat.PDF,
        status: ReportStatus.PENDING,
        parameters: {
          fromDate: dto.fromDate ?? null,
          toDate: dto.toDate ?? null,
        },
      },
    });

    // Enqueue the BullMQ generation job
    const payload: GenerateReportPayload = {
      reportId: report.id,
      userId,
      portfolioId: dto.portfolioId,
      reportType: dto.reportType,
      fileFormat: "PDF",
      requestedAt: new Date().toISOString(),
    };

    await this.reportQueue.add(REPORT_JOBS.GENERATE_REPORT, payload, {
      jobId: `report:${report.id}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });

    this.logger.log(
      `PDF report enqueued [reportId: ${report.id}, type: ${dto.reportType}, portfolio: ${dto.portfolioId}]`,
    );

    return {
      reportId: report.id,
      status: ReportStatus.PENDING,
      message: "PDF generation has been queued. Poll /status to check progress.",
    };
  }

  // ── CSV Report ────────────────────────────────────────────────────────────────

  /**
   * Generate a CSV report synchronously and stream it as a file download.
   * CSV is small enough that synchronous generation is appropriate.
   */
  async requestCsvReport(
    userId: string,
    dto: GenerateCsvReportDto,
    res: Response,
  ): Promise<void> {
    // Verify portfolio ownership
    await this.assertPortfolioOwnership(userId, dto.portfolioId);

    // Create a Report record (transitions: PENDING → PROCESSING → COMPLETED)
    const report = await this.prisma.report.create({
      data: {
        userId,
        portfolioId: dto.portfolioId,
        reportType: dto.reportType,
        fileFormat: FileFormat.CSV,
        status: ReportStatus.PROCESSING,
        parameters: {
          fromDate: dto.fromDate ?? null,
          toDate: dto.toDate ?? null,
        },
      },
    });

    try {
      const fromDate = dto.fromDate ? new Date(dto.fromDate) : undefined;
      const toDate = dto.toDate ? new Date(dto.toDate) : undefined;

      const csv = await this.excelExportService.generate(
        userId,
        dto.portfolioId,
        dto.reportType,
        fromDate,
        toDate,
      );

      const filename = this.excelExportService.getFilename(dto.portfolioId, dto.reportType);
      const csvBuffer = Buffer.from(csv, "utf-8");

      // Persist completion metadata
      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.COMPLETED,
          fileSizeBytes: csvBuffer.length,
          generatedAt: new Date(),
        },
      });

      // Stream to client
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", csvBuffer.length);
      res.setHeader("X-Report-Id", report.id);
      res.setHeader("Cache-Control", "no-store");
      res.end(csvBuffer);
    } catch (err) {
      const message = (err as Error).message;

      await this.prisma.report
        .update({
          where: { id: report.id },
          data: { status: ReportStatus.FAILED, errorMessage: message.slice(0, 1000) },
        })
        .catch(() => {}); // best-effort

      throw err;
    }
  }

  // ── Status Polling ────────────────────────────────────────────────────────────

  /**
   * Return the current state of a report.
   * Excludes the fileUrl (which may be a large base64 payload).
   */
  async getReportStatus(userId: string, reportId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: {
        id: true,
        reportType: true,
        fileFormat: true,
        status: true,
        fileSizeBytes: true,
        errorMessage: true,
        generatedAt: true,
        createdAt: true,
        updatedAt: true,
        portfolioId: true,
      },
    });

    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`);
    }

    return report;
  }

  // ── Download ──────────────────────────────────────────────────────────────────

  /**
   * Stream the generated PDF back to the client.
   * Only available once status = COMPLETED.
   */
  async downloadReport(userId: string, reportId: string, res: Response): Promise<void> {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId },
      select: {
        id: true,
        status: true,
        fileFormat: true,
        fileUrl: true,
        reportType: true,
        portfolioId: true,
      },
    });

    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`);
    }

    if (report.status !== ReportStatus.COMPLETED) {
      throw new ForbiddenException(
        `Report ${reportId} is not ready. Current status: ${report.status}`,
      );
    }

    if (!report.fileUrl) {
      throw new InternalServerErrorException(`Report ${reportId} has no stored file.`);
    }

    // CSV reports are not stored in fileUrl (they are streamed directly)
    if (report.fileFormat === FileFormat.CSV) {
      throw new ForbiddenException(
        "CSV reports are generated and streamed synchronously via POST /csv. Use that endpoint.",
      );
    }

    // Decode base64 data URI → Buffer
    const dataUriPrefix = "data:application/pdf;base64,";
    if (!report.fileUrl.startsWith(dataUriPrefix)) {
      throw new InternalServerErrorException("Stored file format is not recognised.");
    }

    const base64 = report.fileUrl.slice(dataUriPrefix.length);
    const pdfBuffer = Buffer.from(base64, "base64");

    const slug = report.reportType.toLowerCase().replace(/_/g, "-");
    const date = new Date().toISOString().split("T")[0];
    const filename = `wealthcompass-${slug}-${report.portfolioId?.slice(0, 8) ?? "all"}-${date}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("X-Report-Id", report.id);
    res.setHeader("Cache-Control", "no-store");
    res.end(pdfBuffer);
  }

  // ── Report History ────────────────────────────────────────────────────────────

  /**
   * Return paginated report history for the user.
   */
  async listReports(userId: string, limit = 20, offset = 0) {
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { userId },
        select: {
          id: true,
          reportType: true,
          fileFormat: true,
          status: true,
          fileSizeBytes: true,
          errorMessage: true,
          generatedAt: true,
          createdAt: true,
          portfolioId: true,
          parameters: true,
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      this.prisma.report.count({ where: { userId } }),
    ]);

    return { reports, total, limit, offset };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────────

  /**
   * Throws NotFoundException if the portfolio does not belong to the user.
   * Prevents IDOR attacks on report generation.
   */
  private async assertPortfolioOwnership(userId: string, portfolioId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!portfolio) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }
  }
}
