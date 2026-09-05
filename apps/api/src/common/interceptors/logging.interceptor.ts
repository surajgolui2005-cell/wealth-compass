import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

export const SENSITIVE_KEYS = new Set([
  "password",
  "confirmpassword",
  "oldpassword",
  "newpassword",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "jwt",
  "secret",
  "apisecret",
  "api_secret",
  "clientsecret",
  "client_secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "credentials",
  "vaultsecretpath",
  "vault_secret_path",
  "pin",
  "otp",
  "passcode",
  "cvv",
  "creditcard",
  "credit_card",
  "cardnumber",
  "card_number",
  "ssn",
  "privatekey",
  "private_key",
  "encryptedcredentials",
  "encrypted_credentials",
]);

const JWT_REGEX = /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

/**
 * Recursively scrubs all sensitive keys and patterns from request/response payloads.
 * Zero sensitive fields or credential tokens survive sanitization.
 */
export function sanitizeSensitiveData(data: any, seen = new WeakSet()): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    let sanitized = data.replace(JWT_REGEX, "[REDACTED_JWT]");
    sanitized = sanitized.replace(BEARER_REGEX, "Bearer [REDACTED]");
    return sanitized;
  }

  if (typeof data !== "object") {
    return data;
  }

  // Prevent circular references
  if (seen.has(data)) {
    return "[CIRCULAR]";
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeSensitiveData(item, seen));
  }

  const sanitizedObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");

    if (
      SENSITIVE_KEYS.has(normalizedKey) ||
      Array.from(SENSITIVE_KEYS).some((k) => normalizedKey.includes(k))
    ) {
      sanitizedObj[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitizedObj[key] = sanitizeSensitiveData(value, seen);
    } else if (typeof value === "string") {
      sanitizedObj[key] = sanitizeSensitiveData(value, seen);
    } else {
      sanitizedObj[key] = value;
    }
  }

  return sanitizedObj;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger;

  constructor(loggerInstance?: Logger) {
    this.logger = loggerInstance || new Logger("HTTP");
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    if (!req) {
      return next.handle();
    }

    const { method, url, ip } = req;
    const userAgent = req.get("user-agent") || "Unknown";
    const startTime = Date.now();

    const sanitizedBody = sanitizeSensitiveData(req.body);
    const sanitizedQuery = sanitizeSensitiveData(req.query);

    this.logger.log(
      `--> ${method} ${url} | IP: ${ip} | UserAgent: ${userAgent} | Body: ${JSON.stringify(sanitizedBody)} | Query: ${JSON.stringify(sanitizedQuery)}`,
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = res?.statusCode || 200;
          const sanitizedResponse = sanitizeSensitiveData(data);

          this.logger.log(
            `<-- ${method} ${url} ${statusCode} +${duration}ms | Response: ${JSON.stringify(sanitizedResponse)}`,
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err?.status || err?.statusCode || 500;

          this.logger.error(
            `<-- ${method} ${url} ${statusCode} +${duration}ms | Error: ${err?.message || "Unknown error"}`,
          );
        },
      }),
    );
  }
}
