import { NestFactory, Reflector } from "@nestjs/core";
import { ClassSerializerInterceptor } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseTransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpLoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { buildValidationPipe } from "./common/pipes/validation.pipe";
import { PinoLoggerService, MetricsInterceptor } from "./common/observability";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Observability & Structured Logging ──────────────────────────────────────
  const pinoLogger = app.get(PinoLoggerService);
  app.useLogger(pinoLogger);

  // ── Security middleware ─────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // required by Swagger UI
          scriptSrc: ["'self'", "'unsafe-inline'"], // required by Swagger UI
          imgSrc: ["'self'", "data:", "validator.swagger.io"],
        },
      },
    }),
  );
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  });

  // ── Global validation pipe ──────────────────────────────────────────────────
  app.useGlobalPipes(buildValidationPipe());

  // ── Global response transform + logging + serializer + metrics ─────────────
  const reflector = app.get(Reflector);
  const metricsInterceptor = app.get(MetricsInterceptor);
  app.useGlobalInterceptors(
    metricsInterceptor,
    new HttpLoggingInterceptor(),
    new ResponseTransformInterceptor(),
    new ClassSerializerInterceptor(reflector),
  );

  // ── Global exception filter ─────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── OpenAPI / Swagger ───────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Wealth Compass API")
    .setDescription(
      "Investor Portfolio Monitoring & Risk Management System — REST API v1.\n\n" +
        "All endpoints return a unified response envelope:\n" +
        "- **Success**: `{ success: true, data: T, meta: { timestamp, pagination? } }`\n" +
        "- **Error**: `{ success: false, error: { code, message, details? }, timestamp, path }`",
    )
    .setVersion("1.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" }, "JWT")
    .addCookieAuth("refresh_token")
    .addTag("Auth", "Authentication, registration and token management")
    .addTag("Portfolios", "Portfolio CRUD and total-value recalculation")
    .addTag("Holdings", "Asset position management within portfolios")
    .addTag("Transactions", "Financial transaction recording and history")
    .addTag("Providers", "Financial data provider adapters and CSV import")
    .addTag("Market Data", "Real-time and historical asset price feeds")
    .addTag("Analytics", "Portfolio performance analytics via Quant Engine")
    .addTag("Alerts", "Configurable rule-based alert management")
    .setContact("Wealth Compass Team", "", "support@wealthcompass.app")
    .setLicense("UNLICENSED", "")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
    customSiteTitle: "Wealth Compass API Docs",
  });

  // ── Start server ────────────────────────────────────────────────────────────
  const port = process.env.PORT || process.env.API_PORT || 3000;
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  console.log(`[NestJS API] Running on  ${baseUrl}`);
  console.log(`[Swagger]   Docs live at ${baseUrl}/api/docs`);
}

if (require.main === module) {
  bootstrap();
}

export { bootstrap };
