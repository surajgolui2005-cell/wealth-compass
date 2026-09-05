import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request, Response } from "express";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { AnalyticsCacheManager } from "./analytics-cache.manager";

export const CACHE_TTL_METADATA = "analytics_cache_ttl";
export const CACHE_SCOPE_METADATA = "analytics_cache_scope";

/**
 * Decorator to configure caching on an endpoint.
 */
export const CacheableAnalytics = (scope = "analytics", ttlSeconds = 300) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_SCOPE_METADATA, scope)(target, key, descriptor);
    SetMetadata(CACHE_TTL_METADATA, ttlSeconds)(target, key, descriptor);
  };
};

@Injectable()
export class AnalyticsCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheManager: AnalyticsCacheManager,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    // Only cache GET and idempotent POST analytics
    if (!req || (req.method !== "GET" && req.method !== "POST")) {
      return next.handle();
    }

    const scope =
      this.reflector.get<string>(CACHE_SCOPE_METADATA, context.getHandler()) || "analytics";
    const ttlSeconds = this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler()) || 300;

    const portfolioId =
      req.params?.id || req.params?.portfolioId || req.body?.portfolioId || req.query?.portfolioId;

    const keyParts = [
      "analytics",
      scope,
      portfolioId || "global",
      req.originalUrl || req.url,
      req.method === "POST" && req.body ? JSON.stringify(req.body) : "",
    ];

    const cacheKey = keyParts.filter(Boolean).join(":");

    try {
      const cached = await this.cacheManager.get(cacheKey);

      if (cached !== null) {
        if (res && res.setHeader) {
          res.setHeader("X-Cache", "HIT");
        }
        return of(cached);
      }
    } catch {
      // On cache error, fallback to source
    }

    if (res && res.setHeader) {
      res.setHeader("X-Cache", "MISS");
    }

    return next.handle().pipe(
      tap((data) => {
        if (data) {
          this.cacheManager
            .set(cacheKey, data, ttlSeconds, portfolioId ? String(portfolioId) : undefined)
            .catch(() => {});
        }
      }),
    );
  }
}
