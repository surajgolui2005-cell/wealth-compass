import { z } from "zod";

export const envSchema = z
  .object({
    // Runtime & Node Environment
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PORT: z.coerce.number().int().positive().default(3000),
    WEB_PORT: z.coerce.number().int().positive().default(5173),
    QUANT_ENGINE_PORT: z.coerce.number().int().positive().default(8000),
    ADMINER_PORT: z.coerce.number().int().positive().default(8080),

    // PostgreSQL Database
    POSTGRES_HOST: z.string().min(1, "POSTGRES_HOST is required").default("localhost"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_USER: z.string().min(1, "POSTGRES_USER is required").default("postgres"),
    POSTGRES_PASSWORD: z.string().min(1, "POSTGRES_PASSWORD is required"),
    POSTGRES_DB: z.string().min(1, "POSTGRES_DB is required").default("investor_pm"),
    DATABASE_URL: z.string().min(1).optional(),

    // Redis Cache & Queue
    REDIS_HOST: z.string().min(1, "REDIS_HOST is required").default("localhost"),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional().default(""),
    REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

    // Quant Engine Service
    QUANT_ENGINE_URL: z.string().url().default("http://localhost:8000"),

    // Security & Authentication Secrets
    JWT_SECRET: z
      .string()
      .min(16, "JWT_SECRET must be at least 16 characters in length for security"),
    JWT_EXPIRES_IN: z.string().default("1d"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(16, "JWT_REFRESH_SECRET must be at least 16 characters in length for security"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    ENCRYPTION_KEY_AES256: z
      .string()
      .min(
        32,
        "ENCRYPTION_KEY_AES256 must be at least 32 characters (256-bit key) for AES-256 encryption",
      ),

    // External Provider API Credentials (Optional in local development)
    COINGECKO_API_KEY: z.string().optional().default(""),
    OPEN_EXCHANGE_RATES_APP_ID: z.string().optional().default(""),
    ZERODHA_API_KEY: z.string().optional().default(""),
    ZERODHA_API_SECRET: z.string().optional().default(""),
    BINANCE_API_KEY: z.string().optional().default(""),
    BINANCE_API_SECRET: z.string().optional().default(""),
  })
  .transform((data) => {
    // Construct default DATABASE_URL if omitted
    const databaseUrl =
      data.DATABASE_URL ||
      `postgresql://${data.POSTGRES_USER}:${encodeURIComponent(data.POSTGRES_PASSWORD)}@${data.POSTGRES_HOST}:${data.POSTGRES_PORT}/${data.POSTGRES_DB}`;

    return {
      ...data,
      DATABASE_URL: databaseUrl,
    };
  });

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates the provided environment record (or process.env by default) against envSchema.
 * Throws a detailed error message listing all validation failures if schema requirements are violated.
 */
export function validateEnv(rawEnv: Record<string, unknown> = process.env): EnvConfig {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - [${err.path.join(".")}] ${err.message}`)
      .join("\n");

    const errorMessage = `[Environment Validation Error] Invalid or missing configuration variables:\n${errorDetails}`;
    throw new Error(errorMessage);
  }

  return result.data;
}
