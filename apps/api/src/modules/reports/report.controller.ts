/**
 * ReportController
 * ─────────────────
 * REST API surface for the Report module.
 *
 * All routes require a valid JWT (JwtAuthGuard).
 * userId is always extracted from the JWT payload, never from the request body,
 * to prevent IDOR (Insecure Direct Object Reference) attacks.
 *
 * Route Map:
 *   POST   /api/v1/reports/pdf               — Enqueue async PDF report generation
 *   POST   /api/v1/reports/csv               — Generate CSV synchronously (streamed download)
 *   GET    /api/v1/reports                   — List user's report history
 *   GET    /api/v1/reports/:id/status        — Poll async report status
 *   GET    /api/v1/reports/:id/download      — Download completed PDF report
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportService } from "./report.service";
import { GeneratePdfReportDto, GenerateCsvReportDto } from "./dto/report.dto";

type AuthRequest = Request & { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("api/v1/reports")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // ── PDF Generation ────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/reports/pdf
   * Enqueues a PDF report generation job and returns immediately.
   *
   * Response: { reportId, status: "PENDING", message }
   * Poll GET /api/v1/reports/:id/status until status === "COMPLETED".
   * Then download via GET /api/v1/reports/:id/download.
   */
  @Post("pdf")
  @HttpCode(HttpStatus.ACCEPTED)
  async generatePdfReport(
    @Req() req: AuthRequest,
    @Body() dto: GeneratePdfReportDto,
  ) {
    return this.reportService.requestPdfReport(req.user.id, dto);
  }

  // ── CSV Generation ────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/reports/csv
   * Generates and streams a CSV file synchronously.
   *
   * Response: application/csv file download.
   * The X-Report-Id response header contains the persisted Report record ID.
   */
  @Post("csv")
  @HttpCode(HttpStatus.OK)
  async generateCsvReport(
    @Req() req: AuthRequest,
    @Body() dto: GenerateCsvReportDto,
    @Res() res: Response,
  ) {
    await this.reportService.requestCsvReport(req.user.id, dto, res);
  }

  // ── Report History ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/reports
   * Returns paginated report history for the authenticated user.
   *
   * Query params:
   *   limit  — page size (default 20, max 100)
   *   offset — pagination offset (default 0)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listReports(
    @Req() req: AuthRequest,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 20,
    @Query("offset", new ParseIntPipe({ optional: true })) offset = 0,
  ) {
    return this.reportService.listReports(req.user.id, limit, offset);
  }

  // ── Status Polling ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/reports/:id/status
   * Returns the current processing status of a report.
   *
   * Response: { id, reportType, fileFormat, status, fileSizeBytes, generatedAt, errorMessage }
   */
  @Get(":id/status")
  @HttpCode(HttpStatus.OK)
  async getReportStatus(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) reportId: string,
  ) {
    return this.reportService.getReportStatus(req.user.id, reportId);
  }

  // ── File Download ─────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/reports/:id/download
   * Streams the generated PDF to the client.
   * Returns 403 if the report is not yet COMPLETED.
   */
  @Get(":id/download")
  @HttpCode(HttpStatus.OK)
  async downloadReport(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) reportId: string,
    @Res() res: Response,
  ) {
    await this.reportService.downloadReport(req.user.id, reportId, res);
  }
}
