import { Injectable, LoggerService, Scope } from "@nestjs/common";
import pino, { Logger as PinoInstance, LoggerOptions } from "pino";
import { getActiveTraceContext } from "./otel-tracer";

export const DEFAULT_REDACT_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "secret",
  "credentials",
  "apiKey",
  "creditCard",
  "cardNumber",
  "cvv",
  "pin",
  "encryptedCredentials",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.token",
  "*.secret",
  "*.credentials",
  "*.authorization",
];

@Injectable({ scope: Scope.DEFAULT })
export class PinoLoggerService implements LoggerService {
  private readonly pino: PinoInstance;
  private context?: string;

  constructor() {
    const isProduction = process.env.NODE_ENV === "production";
    const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

    const pinoOptions: LoggerOptions = {
      level: logLevel,
      base: {
        service: "wealthcompass-api",
        env: process.env.NODE_ENV || "development",
      },
      redact: {
        paths: DEFAULT_REDACT_KEYS,
        censor: "[REDACTED]",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
    };

    this.pino = pino(pinoOptions);
  }

  public setContext(context: string): void {
    this.context = context;
  }

  private buildPayload(message: any, context?: string): { msg: string; [key: string]: any } {
    const ctx = context || this.context || "Application";
    const traceCtx = getActiveTraceContext();

    const basePayload: Record<string, any> = {
      context: ctx,
      trace_id: traceCtx.traceId,
      span_id: traceCtx.spanId,
    };

    if (typeof message === "object" && message !== null) {
      const { msg, message: innerMsg, ...rest } = message;
      return {
        ...basePayload,
        ...rest,
        msg: msg || innerMsg || "Structured log event",
      };
    }

    return {
      ...basePayload,
      msg: String(message),
    };
  }

  public log(message: any, context?: string): void {
    const payload = this.buildPayload(message, context);
    this.pino.info(payload);
  }

  public info(message: any, context?: string): void {
    this.log(message, context);
  }

  public error(message: any, trace?: string, context?: string): void {
    const payload = this.buildPayload(message, context);
    if (trace) {
      payload.stack = trace;
    } else if (message instanceof Error && message.stack) {
      payload.stack = message.stack;
    }
    this.pino.error(payload);
  }

  public warn(message: any, context?: string): void {
    const payload = this.buildPayload(message, context);
    this.pino.warn(payload);
  }

  public debug(message: any, context?: string): void {
    const payload = this.buildPayload(message, context);
    this.pino.debug(payload);
  }

  public verbose(message: any, context?: string): void {
    const payload = this.buildPayload(message, context);
    this.pino.trace(payload);
  }

  public getRawPino(): PinoInstance {
    return this.pino;
  }
}
