/**
 * ReportSchedulerProcessor — Unit Test Suite
 * ============================================
 *
 * Tests verify:
 *  1. Updates Report.status to PROCESSING at the start of each job
 *  2. Calls PdfReportService.generate() with the correct arguments
 *  3. Updates Report.status to COMPLETED + sets generatedAt + fileSizeBytes on success
 *  4. Stores fileUrl as a base64 data URI starting with "data:application/pdf;base64,"
 *  5. Updates Report.status to FAILED + sets errorMessage on PdfReportService failure
 *  6. truncates errorMessage to 1000 chars to fit DB column limit
 *  7. Re-throws the original error (for BullMQ retry)
 *  8. Handles unknown job names gracefully (returns skipped=true)
 *
 * Strategy:
 *   Processor is tested via direct instantiation (no NestJS DI).
 *   PdfReportService is mocked to avoid real PDF generation overhead.
 *   PrismaService is mocked to avoid DB dependency.
 */

import { ReportStatus } from "@prisma/client";
import { ReportSchedulerProcessor } from "../processors/report-scheduler.processor";
import { REPORT_JOBS, GenerateReportPayload } from "../interfaces/report-queue.interface";

// ── Mock Factories ─────────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    report: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function buildMockPdfService(bufferSize = 4096) {
  const fakePdfBuffer = Buffer.alloc(bufferSize, "%PDF");
  return {
    generate: jest.fn().mockResolvedValue(fakePdfBuffer),
    buffer: fakePdfBuffer,
  };
}

function buildProcessor(
  prisma = buildMockPrisma(),
  pdfService = buildMockPdfService(),
) {
  return {
    processor: new ReportSchedulerProcessor(prisma as any, pdfService as any),
    prisma,
    pdfService,
  };
}

/** Helper: build a minimal Job-like object for process() calls */
function mockJob<T>(name: string, data: T) {
  return { name, data, id: "job-" + Math.random().toString(36).slice(2) };
}

function makeGeneratePayload(
  overrides: Partial<GenerateReportPayload> = {},
): GenerateReportPayload {
  return {
    reportId: "rpt-001",
    userId: "u-001",
    portfolioId: "p-001",
    reportType: "PORTFOLIO_SUMMARY",
    fileFormat: "PDF",
    requestedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("ReportSchedulerProcessor — GENERATE_REPORT (success path)", () => {
  it("marks Report as PROCESSING before calling PdfReportService", async () => {
    const { processor, prisma } = buildProcessor();

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any);

    // First update call should be PROCESSING
    const firstCall = prisma.report.update.mock.calls[0][0];
    expect(firstCall.data.status).toBe(ReportStatus.PROCESSING);
  });

  it("calls PdfReportService.generate() with correct userId, portfolioId, reportType", async () => {
    const { processor, pdfService } = buildProcessor();
    const payload = makeGeneratePayload({
      userId: "u-abc",
      portfolioId: "p-xyz",
      reportType: "RISK_ANALYSIS",
    });

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, payload) as any);

    expect(pdfService.generate).toHaveBeenCalledWith("u-abc", "p-xyz", "RISK_ANALYSIS");
  });

  it("marks Report as COMPLETED after successful PDF generation", async () => {
    const { processor, prisma } = buildProcessor();

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any);

    // Last update call should be COMPLETED
    const lastCall = prisma.report.update.mock.calls[prisma.report.update.mock.calls.length - 1][0];
    expect(lastCall.data.status).toBe(ReportStatus.COMPLETED);
  });

  it("sets generatedAt to a Date instance on success", async () => {
    const { processor, prisma } = buildProcessor();

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any);

    const lastCall = prisma.report.update.mock.calls[prisma.report.update.mock.calls.length - 1][0];
    expect(lastCall.data.generatedAt).toBeInstanceOf(Date);
  });

  it("sets fileSizeBytes to the PDF buffer length on success", async () => {
    const pdfService = buildMockPdfService(8192);
    const { processor, prisma } = buildProcessor(buildMockPrisma(), pdfService);

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any);

    const lastCall = prisma.report.update.mock.calls[prisma.report.update.mock.calls.length - 1][0];
    expect(lastCall.data.fileSizeBytes).toBe(8192);
  });

  it("stores fileUrl as a base64 PDF data URI", async () => {
    const { processor, prisma } = buildProcessor();

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any);

    const lastCall = prisma.report.update.mock.calls[prisma.report.update.mock.calls.length - 1][0];
    expect(lastCall.data.fileUrl).toMatch(/^data:application\/pdf;base64,/);
  });

  it("fileUrl can be decoded back to the original buffer", async () => {
    const pdfService = buildMockPdfService(512);
    const { processor, prisma } = buildProcessor(buildMockPrisma(), pdfService);

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any);

    const lastCall = prisma.report.update.mock.calls[prisma.report.update.mock.calls.length - 1][0];
    const prefix = "data:application/pdf;base64,";
    const b64 = lastCall.data.fileUrl.slice(prefix.length);
    const decoded = Buffer.from(b64, "base64");
    expect(decoded).toEqual(pdfService.buffer);
  });

  it("returns reportId, status=COMPLETED, fileSizeBytes, and durationMs in result", async () => {
    const { processor } = buildProcessor();

    const result = (await processor.process(
      mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload({ reportId: "rpt-xyz" })) as any,
    )) as any;

    expect(result.reportId).toBe("rpt-xyz");
    expect(result.status).toBe("COMPLETED");
    expect(typeof result.fileSizeBytes).toBe("number");
    expect(typeof result.durationMs).toBe("number");
  });

  it("calls prisma.report.update exactly twice on success (PROCESSING + COMPLETED)", async () => {
    const { processor, prisma } = buildProcessor();

    await processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any);

    expect(prisma.report.update).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ReportSchedulerProcessor — GENERATE_REPORT (failure path)", () => {
  it("marks Report as FAILED when PdfReportService throws", async () => {
    const pdfService = { generate: jest.fn().mockRejectedValue(new Error("PDF render failed")) };
    const { processor, prisma } = buildProcessor(buildMockPrisma(), pdfService as any);

    await expect(
      processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any),
    ).rejects.toThrow("PDF render failed");

    const failedUpdate = prisma.report.update.mock.calls.find(
      (call: any[]) => call[0].data?.status === ReportStatus.FAILED,
    );
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate![0].data.status).toBe(ReportStatus.FAILED);
  });

  it("sets errorMessage when PdfReportService throws", async () => {
    const pdfService = {
      generate: jest.fn().mockRejectedValue(new Error("Portfolio not found")),
    };
    const { processor, prisma } = buildProcessor(buildMockPrisma(), pdfService as any);

    await expect(
      processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any),
    ).rejects.toThrow();

    const failedUpdate = prisma.report.update.mock.calls.find(
      (call: any[]) => call[0].data?.status === ReportStatus.FAILED,
    );
    expect(failedUpdate![0].data.errorMessage).toContain("Portfolio not found");
  });

  it("truncates errorMessage to 1000 chars to fit DB column limit", async () => {
    const longMessage = "E".repeat(2000);
    const pdfService = {
      generate: jest.fn().mockRejectedValue(new Error(longMessage)),
    };
    const { processor, prisma } = buildProcessor(buildMockPrisma(), pdfService as any);

    await expect(
      processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any),
    ).rejects.toThrow();

    const failedUpdate = prisma.report.update.mock.calls.find(
      (call: any[]) => call[0].data?.status === ReportStatus.FAILED,
    );
    expect(failedUpdate![0].data.errorMessage.length).toBeLessThanOrEqual(1000);
  });

  it("re-throws the original error for BullMQ retry", async () => {
    const pdfService = {
      generate: jest.fn().mockRejectedValue(new Error("Service unavailable")),
    };
    const { processor } = buildProcessor(buildMockPrisma(), pdfService as any);

    await expect(
      processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any),
    ).rejects.toThrow("Service unavailable");
  });

  it("does not crash if the FAILED update itself throws", async () => {
    const pdfService = {
      generate: jest.fn().mockRejectedValue(new Error("Render error")),
    };
    const prisma = buildMockPrisma();
    // PROCESSING update succeeds, FAILED update throws
    prisma.report.update
      .mockResolvedValueOnce({}) // PROCESSING
      .mockRejectedValueOnce(new Error("DB unreachable")); // FAILED update error

    const { processor } = buildProcessor(prisma, pdfService as any);

    // Should still re-throw the original "Render error", not "DB unreachable"
    await expect(
      processor.process(mockJob(REPORT_JOBS.GENERATE_REPORT, makeGeneratePayload()) as any),
    ).rejects.toThrow("Render error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ReportSchedulerProcessor — unknown job names", () => {
  it("returns skipped=true for unknown job names", async () => {
    const { processor } = buildProcessor();
    const result = (await processor.process(
      mockJob("some.unknown.job.type", {}) as any,
    )) as any;
    expect(result.skipped).toBe(true);
  });

  it("includes the unknown job name in the reason", async () => {
    const { processor } = buildProcessor();
    const result = (await processor.process(
      mockJob("report.job.unknown", {}) as any,
    )) as any;
    expect(result.reason).toContain("report.job.unknown");
  });

  it("does not call prisma.report.update for unknown job names", async () => {
    const { processor, prisma } = buildProcessor();
    await processor.process(mockJob("not.a.real.job", {}) as any);
    expect(prisma.report.update).not.toHaveBeenCalled();
  });
});
