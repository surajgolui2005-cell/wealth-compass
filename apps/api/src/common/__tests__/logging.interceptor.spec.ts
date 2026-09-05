import { CallHandler, ExecutionContext, Logger } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { HttpLoggingInterceptor, sanitizeSensitiveData } from "../interceptors/logging.interceptor";

describe("HttpLoggingInterceptor & Sensitive Data Sanitization", () => {
  describe("sanitizeSensitiveData()", () => {
    it("should redact sensitive password and token fields", () => {
      const input = {
        email: "investor@example.com",
        password: "SuperSecretPassword!123",
        confirmPassword: "SuperSecretPassword!123",
        refreshToken: "d7a98b1e4c3d2f10...",
        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      };

      const sanitized = sanitizeSensitiveData(input);

      expect(sanitized.email).toBe("investor@example.com");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.confirmPassword).toBe("[REDACTED]");
      expect(sanitized.refreshToken).toBe("[REDACTED]");
      expect(sanitized.accessToken).toBe("[REDACTED]");
    });

    it("should redact financial provider API keys, secrets, and credentials", () => {
      const input = {
        providerCode: "ZERODHA",
        accountName: "Primary Demat",
        credentials: {
          apiKey: "kite_prod_api_key_123",
          apiSecret: "kite_prod_api_secret_456",
          vaultSecretPath: "secret/data/providers/zerodha",
        },
      };

      const sanitized = sanitizeSensitiveData(input);

      expect(sanitized.providerCode).toBe("ZERODHA");
      expect(sanitized.accountName).toBe("Primary Demat");
      expect(sanitized.credentials).toBe("[REDACTED]");
    });

    it("should redact sensitive payment and personal identity fields", () => {
      const input = {
        cardNumber: "4111-2222-3333-4444",
        cvv: "123",
        pin: "9876",
        otp: "456789",
        ssn: "000-12-3456",
      };

      const sanitized = sanitizeSensitiveData(input);

      expect(sanitized.cardNumber).toBe("[REDACTED]");
      expect(sanitized.cvv).toBe("[REDACTED]");
      expect(sanitized.pin).toBe("[REDACTED]");
      expect(sanitized.otp).toBe("[REDACTED]");
      expect(sanitized.ssn).toBe("[REDACTED]");
    });

    it("should scrub JWT tokens and Bearer strings embedded within arbitrary text", () => {
      const input = {
        message:
          "Request authorized via Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature",
        headerValue: "Bearer secret_token_xyz_123",
      };

      const sanitized = sanitizeSensitiveData(input);

      expect(sanitized.message).not.toContain("eyJhbGciOiJIUzI1Ni");
      expect(sanitized.message).toContain("[REDACTED_JWT]");
      expect(sanitized.headerValue).toBe("Bearer [REDACTED]");
    });

    it("should recursively sanitize deeply nested objects and arrays", () => {
      const input = {
        level1: {
          level2: [
            {
              id: "item-1",
              apiKey: "leak_attempt_key_1",
            },
            {
              id: "item-2",
              privateKey: "leak_attempt_private_key_2",
            },
          ],
        },
      };

      const sanitized = sanitizeSensitiveData(input);

      expect(sanitized.level1.level2[0].id).toBe("item-1");
      expect(sanitized.level1.level2[0].apiKey).toBe("[REDACTED]");
      expect(sanitized.level1.level2[1].id).toBe("item-2");
      expect(sanitized.level1.level2[1].privateKey).toBe("[REDACTED]");
    });

    it("should safely handle circular references without infinite loops", () => {
      const circularObj: any = { name: "RootNode" };
      circularObj.self = circularObj;

      const sanitized = sanitizeSensitiveData(circularObj);
      expect(sanitized.name).toBe("RootNode");
      expect(sanitized.self).toBe("[CIRCULAR]");
    });

    it("should preserve non-sensitive primitive types", () => {
      expect(sanitizeSensitiveData(null)).toBeNull();
      expect(sanitizeSensitiveData(undefined)).toBeUndefined();
      expect(sanitizeSensitiveData(12345)).toBe(12345);
      expect(sanitizeSensitiveData(true)).toBe(true);
      expect(sanitizeSensitiveData("ordinary safe string")).toBe("ordinary safe string");
    });
  });

  describe("HttpLoggingInterceptor execution", () => {
    let interceptor: HttpLoggingInterceptor;
    let mockLogger: { log: jest.Mock; error: jest.Mock };

    beforeEach(() => {
      mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
      };
      interceptor = new HttpLoggingInterceptor(mockLogger as unknown as Logger);
    });

    it("should log HTTP request and response with zero sensitive fields", (done) => {
      const mockReq: any = {
        method: "POST",
        url: "/api/v1/auth/login",
        ip: "127.0.0.1",
        get: jest.fn().mockReturnValue("Mozilla/5.0"),
        body: {
          email: "investor@example.com",
          password: "MyTopSecretPassword!2026",
        },
        query: {
          token: "sensitive_query_token",
        },
      };

      const mockRes: any = {
        statusCode: 200,
      };

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      };

      const responsePayload = {
        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.sig",
        user: { id: "u-1", email: "investor@example.com" },
      };

      const mockHandler: CallHandler = {
        handle: () => of(responsePayload),
      };

      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: () => {
          // Verify request log
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining("--> POST /api/v1/auth/login"),
          );
          const reqLogCall = mockLogger.log.mock.calls[0][0];
          expect(reqLogCall).not.toContain("MyTopSecretPassword!2026");
          expect(reqLogCall).not.toContain("sensitive_query_token");
          expect(reqLogCall).toContain("[REDACTED]");

          // Verify response log
          const resLogCall = mockLogger.log.mock.calls[1][0];
          expect(resLogCall).toContain("<-- POST /api/v1/auth/login 200");
          expect(resLogCall).not.toContain(
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.sig",
          );
          expect(resLogCall).toContain("[REDACTED]");

          done();
        },
        error: done.fail,
      });
    });

    it("should log HTTP error with duration and scrubbed message on failure", (done) => {
      const mockReq: any = {
        method: "GET",
        url: "/api/v1/portfolios/p-999",
        ip: "10.0.0.1",
        get: jest.fn().mockReturnValue("curl/7.68.0"),
        body: {},
        query: {},
      };

      const mockRes: any = {
        statusCode: 404,
      };

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      };

      const mockHandler: CallHandler = {
        handle: () => throwError(() => ({ status: 404, message: "Portfolio not found" })),
      };

      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: () => done.fail("Expected error"),
        error: () => {
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining("<-- GET /api/v1/portfolios/p-999 404"),
          );
          done();
        },
      });
    });
  });
});
