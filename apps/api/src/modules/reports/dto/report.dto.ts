/**
 * Report DTOs
 * ───────────
 * Request body shapes for the report endpoints.
 * Validated via class-validator.
 */

import { IsEnum, IsUUID, IsOptional, IsDateString } from "class-validator";
import { ReportType, FileFormat } from "@prisma/client";

export { ReportType, FileFormat };

// ── PDF Report Request ────────────────────────────────────────────────────────

export class GeneratePdfReportDto {
  @IsUUID()
  portfolioId!: string;

  @IsEnum(ReportType)
  reportType!: ReportType;

  /**
   * Optional ISO date range for time-bounded reports (e.g. performance, tax).
   * If omitted, defaults to all-time / most recent snapshot.
   */
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

// ── CSV Report Request ────────────────────────────────────────────────────────

export class GenerateCsvReportDto {
  @IsUUID()
  portfolioId!: string;

  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
