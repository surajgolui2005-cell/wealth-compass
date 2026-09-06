import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Request, Response } from "express";
import { MetricsService } from "./metrics.service";
import { getActiveTraceContext } from "./otel-tracer";
import { SentryService } from "./sentry.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly sentryService: SentryService,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (!req) {
      return next.handle();
    }

    const startTime = process.hrtime();
    const traceCtx = getActiveTraceContext();

    if (res && typeof res.setHeader === "function") {
      res.setHeader("X-Trace-Id", traceCtx.traceId);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(req, res, startTime);
        },
        error: (error: any) => {
          this.recordMetrics(req, res, startTime, error?.status || 500);
          if (error && (!error.status || error.status >= 500)) {
            this.sentryService.captureException(error, {
              method: req.method,
              url: req.url,
              headers: {
                host: req.headers?.host,
                "user-agent": req.headers?.["user-agent"],
              },
            });
          }
        },
      }),
    );
  }

  private recordMetrics(
    req: Request,
    res: Response,
    startTime: [number, number],
    fallbackStatusCode?: number,
  ): void {
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    const statusCode = fallbackStatusCode || res.statusCode || 200;
    // Normalize route path to prevent high cardinality:
    // e.g. /api/v1/portfolios/123-abc -> /api/v1/portfolios/:id
    const route = req.route?.path || req.baseUrl || req.path || "unknown";

    this.metricsService.recordHttpRequest(req.method, route, statusCode, durationSeconds);
  }
}
