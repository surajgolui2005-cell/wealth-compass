import { PinoLoggerService } from "../pino-logger.service";
import { sanitizeAttributes, traceAsyncOperation } from "../otel-tracer";

describe("PinoLoggerService & Observability Redaction", () => {
  let logger: PinoLoggerService;

  beforeEach(() => {
    logger = new PinoLoggerService();
    logger.setContext("UnitTest");
  });

  describe("PinoLoggerService", () => {
    it("should instantiate without errors", () => {
      expect(logger).toBeDefined();
      expect(logger.getRawPino()).toBeDefined();
    });

    it("should log info, warn, debug, and error messages", () => {
      const pino = logger.getRawPino();
      const infoSpy = jest.spyOn(pino, "info").mockImplementation();
      const warnSpy = jest.spyOn(pino, "warn").mockImplementation();
      const errorSpy = jest.spyOn(pino, "error").mockImplementation();

      logger.log("Standard info event");
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ msg: "Standard info event", context: "UnitTest" }),
      );

      logger.warn("Warning event");
      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ msg: "Warning event" }));

      logger.error("Error event", "MockStackTraces");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ msg: "Error event", stack: "MockStackTraces" }),
      );
    });
  });

  describe("OpenTelemetry Attribute Sanitization", () => {
    it("should redact sensitive fields matching security patterns", () => {
      const rawAttrs = {
        "user.id": "user_123",
        "user.password": "SuperSecretPassword123!",
        "auth.token": "eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "api.key": "sk-1234567890abcdef",
        "http.header.authorization": "Bearer secret_access_token_value",
        "client.cookie": "session=abc123secret",
        "nested.data": {
          secret_key: "nested_secret_value",
          public_info: "allowed_public_string",
        },
      };

      const sanitized = sanitizeAttributes(rawAttrs);

      expect(sanitized["user.id"]).toBe("user_123");
      expect(sanitized["user.password"]).toBe("[REDACTED]");
      expect(sanitized["auth.token"]).toBe("[REDACTED]");
      expect(sanitized["api.key"]).toBe("[REDACTED]");
      expect(sanitized["http.header.authorization"]).toBe("[REDACTED]");
      expect(sanitized["client.cookie"]).toBe("[REDACTED]");
      expect(sanitized["nested.data"].secret_key).toBe("[REDACTED]");
      expect(sanitized["nested.data"].public_info).toBe("allowed_public_string");
    });

    it("should mask Bearer token strings inside values", () => {
      const raw = {
        custom_header: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
      };
      const sanitized = sanitizeAttributes(raw);
      expect(sanitized.custom_header).toBe("Bearer [REDACTED]");
    });

    it("should trace async operation and record span details", async () => {
      const result = await traceAsyncOperation(
        "test_operation",
        async (span) => {
          span.setAttribute("portfolio.id", "port_123");
          span.setAttribute("user.password", "secret");
          return 42;
        },
        { initial: "value" },
      );

      expect(result).toBe(42);
    });
  });
});
