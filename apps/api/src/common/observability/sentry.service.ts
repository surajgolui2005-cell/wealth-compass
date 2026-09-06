import { Injectable, OnModuleInit } from "@nestjs/common";
import crypto from "crypto";
import { PinoLoggerService } from "./pino-logger.service";

export interface SentryEvent {
  eventId: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "fatal";
  message?: string;
  exception?: {
    type: string;
    value: string;
    stacktrace?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  user?: {
    id?: string;
    email?: string;
    ip_address?: string;
  };
}

const SENSITIVE_KEYS_REGEX =
  /password|token|secret|authorization|cookie|credentials|apiKey|cvv|card/i;

@Injectable()
export class SentryService implements OnModuleInit {
  private isEnabled: boolean = false;
  private dsn?: string;

  constructor(private readonly logger: PinoLoggerService) {
    this.logger.setContext("SentryService");
  }

  public onModuleInit(): void {
    this.dsn = process.env.SENTRY_DSN;
    this.isEnabled = Boolean(this.dsn && process.env.NODE_ENV === "production");

    if (this.isEnabled) {
      this.logger.log("Sentry error reporting initialized with active credential scrubbing");
    } else {
      this.logger.log("Sentry error reporting operating in development/local mode");
    }
  }

  /**
   * Recursively sanitizes data payloads, redacting sensitive credentials and tokens.
   */
  public sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "string") {
      if (/^Bearer\s+/i.test(data)) {
        return "Bearer [REDACTED]";
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (typeof data === "object") {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_KEYS_REGEX.test(key)) {
          cleaned[key] = "[REDACTED]";
        } else {
          cleaned[key] = this.sanitizeData(value);
        }
      }
      return cleaned;
    }

    return data;
  }

  /**
   * Captures an exception with sanitized metadata and returns an event ID.
   */
  public captureException(error: any, extraContext?: Record<string, any>): string {
    const eventId = crypto.randomUUID();
    const sanitizedExtra = extraContext ? this.sanitizeData(extraContext) : {};

    const event: SentryEvent = {
      eventId,
      timestamp: new Date().toISOString(),
      level: "error",
      exception: {
        type: error instanceof Error ? error.name : "UnhandledException",
        value: error instanceof Error ? error.message : String(error),
        stacktrace: error instanceof Error ? error.stack : undefined,
      },
      tags: {
        environment: process.env.NODE_ENV || "development",
        service: "wealthcompass-api",
      },
      extra: sanitizedExtra,
    };

    // If Sentry remote client is configured, dispatch here.
    this.logger.error({
      msg: `[Sentry Event ${eventId}] Captured error: ${event.exception?.value}`,
      sentryEventId: eventId,
      errorName: event.exception?.type,
      extra: sanitizedExtra,
    });

    return eventId;
  }

  /**
   * Captures a log message as a Sentry event.
   */
  public captureMessage(
    message: string,
    level: "info" | "warning" | "error" = "info",
    extraContext?: Record<string, any>,
  ): string {
    const eventId = crypto.randomUUID();
    const sanitizedExtra = extraContext ? this.sanitizeData(extraContext) : {};

    this.logger.log({
      msg: `[Sentry Message ${eventId}] ${message}`,
      level,
      extra: sanitizedExtra,
    });

    return eventId;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }
}
