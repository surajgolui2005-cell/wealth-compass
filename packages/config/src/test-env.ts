import { validateEnv } from "./env";

function runTests() {
  console.log("--- Running @investor-pm/config Environment Validation Tests ---");

  // Test 1: Valid environment configuration
  console.log("Test 1: Valid configuration...");
  const validMockEnv = {
    NODE_ENV: "development",
    PORT: "3000",
    API_PORT: "3000",
    WEB_PORT: "5173",
    QUANT_ENGINE_PORT: "8000",
    ADMINER_PORT: "8080",
    POSTGRES_HOST: "localhost",
    POSTGRES_PORT: "5432",
    POSTGRES_USER: "postgres",
    POSTGRES_PASSWORD: "postgres_dev_password_only",
    POSTGRES_DB: "investor_pm",
    REDIS_HOST: "localhost",
    REDIS_PORT: "6379",
    REDIS_URL: "redis://localhost:6379",
    QUANT_ENGINE_URL: "http://localhost:8000",
    JWT_SECRET: "dev_jwt_secret_key_must_be_at_least_16_chars",
    JWT_REFRESH_SECRET: "dev_jwt_refresh_secret_key_must_be_at_least_16_chars",
    ENCRYPTION_KEY_AES256: "dev_aes256_secret_key_32_bytes_long_!",
  };

  const parsed = validateEnv(validMockEnv);
  if (
    parsed.DATABASE_URL ===
    "postgresql://postgres:postgres_dev_password_only@localhost:5432/investor_pm"
  ) {
    console.log("✓ Test 1 Passed: Valid config parsed with constructed DATABASE_URL.");
  } else {
    throw new Error(`Test 1 Failed: DATABASE_URL mismatch: ${parsed.DATABASE_URL}`);
  }

  // Test 2: Missing required variables
  console.log("\nTest 2: Missing required variables (POSTGRES_PASSWORD, JWT_SECRET)...");
  const invalidMockEnv = {
    NODE_ENV: "development",
    // Missing POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY_AES256
  };

  let threwError = false;
  try {
    validateEnv(invalidMockEnv);
  } catch (err: any) {
    threwError = true;
    console.log("✓ Test 2 Passed: Correctly caught missing variables with message:");
    console.log(err.message);
  }

  if (!threwError) {
    throw new Error("Test 2 Failed: Did not throw on missing required variables.");
  }

  // Test 3: Invalid secret lengths and URLs
  console.log("\nTest 3: Invalid secret lengths (< 16 chars) and invalid QUANT_ENGINE_URL...");
  const shortSecretsEnv = {
    ...validMockEnv,
    JWT_SECRET: "too_short",
    QUANT_ENGINE_URL: "not-a-valid-url",
  };

  let threwValidation = false;
  try {
    validateEnv(shortSecretsEnv);
  } catch (err: any) {
    threwValidation = true;
    console.log("✓ Test 3 Passed: Correctly caught short secret and invalid URL:");
    console.log(err.message);
  }

  if (!threwValidation) {
    throw new Error("Test 3 Failed: Did not throw on invalid secret length or URL.");
  }

  console.log("\n=============================================================");
  console.log("ALL @investor-pm/config ENVIRONMENT VALIDATION TESTS PASSED!");
  console.log("=============================================================");
}

runTests();
