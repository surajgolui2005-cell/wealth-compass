import crypto from "crypto";

export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled?: boolean;
}

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  startTime: number;
  attributes: Record<string, any>;
  status: "OK" | "ERROR";
  error?: Error;
  setAttribute(key: string, value: any): void;
  end(): void;
}

const SENSITIVE_ATTRIBUTE_PATTERNS = [
  /password/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /secret/i,
  /credential/i,
  /api[._-]?key/i,
  /private[._-]?key/i,
  /secret[._-]?key/i,
  /cvv/i,
  /card/i,
];

/**
 * Sanitizes span attributes by replacing sensitive values with "[REDACTED]".
 */
export function sanitizeAttributes(attributes: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const isSensitive = SENSITIVE_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeAttributes(value);
    } else if (typeof value === "string") {
      // Also check if string value looks like a Bearer token or JWT
      if (/^Bearer\s+[A-Za-z0-9-_=.]+/i.test(value)) {
        sanitized[key] = "Bearer [REDACTED]";
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Global active context holder (supports AsyncLocalStorage / process context)
let currentActiveTraceContext: TraceContext | null = null;

export function setActiveTraceContext(context: TraceContext | null): void {
  currentActiveTraceContext = context;
}

export function getActiveTraceContext(): TraceContext {
  if (currentActiveTraceContext) {
    return currentActiveTraceContext;
  }

  return {
    traceId: crypto.randomBytes(16).toString("hex"),
    spanId: crypto.randomBytes(8).toString("hex"),
    sampled: true,
  };
}

export class SimpleSpan implements Span {
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly startTime: number;
  public attributes: Record<string, any> = {};
  public status: "OK" | "ERROR" = "OK";
  public error?: Error;

  constructor(
    public readonly name: string,
    parentContext?: TraceContext,
  ) {
    this.traceId = parentContext?.traceId || crypto.randomBytes(16).toString("hex");
    this.spanId = crypto.randomBytes(8).toString("hex");
    this.startTime = Date.now();
  }

  public setAttribute(key: string, value: any): void {
    const sanitized = sanitizeAttributes({ [key]: value });
    this.attributes[key] = sanitized[key];
  }

  public setAttributes(attrs: Record<string, any>): void {
    const sanitized = sanitizeAttributes(attrs);
    Object.assign(this.attributes, sanitized);
  }

  public recordException(error: Error): void {
    this.status = "ERROR";
    this.error = error;
    this.setAttribute("exception.type", error.name);
    this.setAttribute("exception.message", error.message);
  }

  public end(): void {
    // In production with an OTLP collector, the span is exported here.
  }
}

/**
 * Executes an async operation wrapped in an OpenTelemetry-compatible span.
 */
export async function traceAsyncOperation<T>(
  name: string,
  fn: (span: SimpleSpan) => Promise<T>,
  initialAttributes?: Record<string, any>,
): Promise<T> {
  const parent = getActiveTraceContext();
  const span = new SimpleSpan(name, parent);

  if (initialAttributes) {
    span.setAttributes(initialAttributes);
  }

  const prevContext = currentActiveTraceContext;
  setActiveTraceContext({
    traceId: span.traceId,
    spanId: span.spanId,
    sampled: true,
  });

  try {
    const result = await fn(span);
    span.status = "OK";
    return result;
  } catch (err: any) {
    span.recordException(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    span.end();
    setActiveTraceContext(prevContext);
  }
}

/**
 * OpenTelemetry tracer singleton helper.
 */
export const otelTracer = {
  getTracer(name: string = "wealthcompass-api") {
    return {
      startSpan(spanName: string, options?: { attributes?: Record<string, any> }) {
        const span = new SimpleSpan(spanName, getActiveTraceContext());
        if (options?.attributes) {
          span.setAttributes(options.attributes);
        }
        return span;
      },
    };
  },
  getActiveTraceContext,
  sanitizeAttributes,
  traceAsyncOperation,
};
