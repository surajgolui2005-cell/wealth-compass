/**
 * Report Queue Constants
 * ──────────────────────
 * Single source of truth for all queue and job name constants in the
 * reports subsystem.
 *
 * Keeping these here prevents circular imports between the controller
 * (which produces jobs), the processor (which consumes them), and the
 * module (which registers the queue).
 */

/** BullMQ queue name for all report generation jobs. */
export const REPORT_GENERATION_QUEUE = "report-generation";

/** BullMQ job name constants */
export const REPORT_JOBS = {
  /**
   * Triggered when a user requests a PDF report.
   * The processor fetches data, generates the PDF buffer, and updates the
   * Report record to COMPLETED.
   */
  GENERATE_REPORT: "generate-report",
} as const;

// ── Job Payload Types ─────────────────────────────────────────────────────────

export type ReportJobType = (typeof REPORT_JOBS)[keyof typeof REPORT_JOBS];

/**
 * Payload for GENERATE_REPORT jobs.
 * Enqueued by ReportService when the user requests a PDF.
 */
export interface GenerateReportPayload {
  /** UUID of the Report row in the database (status starts as PENDING). */
  reportId: string;
  /** The user who requested the report. */
  userId: string;
  /** The portfolio to report on. */
  portfolioId: string;
  /** The type of report to generate. */
  reportType: string;
  /** The target file format (always PDF for async jobs). */
  fileFormat: "PDF";
  /** ISO timestamp of when the job was enqueued. */
  requestedAt: string;
}
