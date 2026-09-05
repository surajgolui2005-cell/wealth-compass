import { ConfigService } from "@nestjs/config";
import { EncryptionService } from "../encryption.service";

describe("EncryptionService (AES-256-GCM)", () => {
  let service: EncryptionService;
  const testKey = "test_encryption_secret_key_32b!"; // exactly 32 chars

  beforeEach(() => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "ENCRYPTION_KEY_AES256") {
          return testKey;
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new EncryptionService(mockConfigService);
  });

  describe("Basic Encryption & Decryption Fidelity", () => {
    it("should encrypt and decrypt a standard ASCII string correctly", () => {
      const plaintext = "api_key_zerodha_live_9876543210";
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toEqual(plaintext);
      expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it("should encrypt and decrypt complex Unicode and currency symbols", () => {
      const plaintext = "₹ 15,00,000.50 | 🚀 NSE:RELIANCE | 证券 거래 | 🔐 TopSecret";
      const encrypted = service.encrypt(plaintext);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it("should encrypt and decrypt an empty string", () => {
      const plaintext = "";
      const encrypted = service.encrypt(plaintext);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it("should encrypt and decrypt large payloads (multi-kilobyte text)", () => {
      const largeText = "A".repeat(50_000) + "🔏" + "B".repeat(50_000);
      const encrypted = service.encrypt(largeText);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toEqual(largeText);
    });
  });

  describe("Unique IV Invariant (No IV Reuse)", () => {
    it("should generate a different ciphertext and IV for identical plaintexts", () => {
      const plaintext = "my_broker_secret_password_123";
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      const encrypted3 = service.encrypt(plaintext);

      expect(encrypted1).not.toEqual(encrypted2);
      expect(encrypted2).not.toEqual(encrypted3);
      expect(encrypted1).not.toEqual(encrypted3);

      const [iv1] = encrypted1.split(":");
      const [iv2] = encrypted2.split(":");
      const [iv3] = encrypted3.split(":");

      expect(iv1).not.toEqual(iv2);
      expect(iv2).not.toEqual(iv3);

      // All three distinct ciphertexts must still decrypt to the identical original plaintext
      expect(service.decrypt(encrypted1)).toEqual(plaintext);
      expect(service.decrypt(encrypted2)).toEqual(plaintext);
      expect(service.decrypt(encrypted3)).toEqual(plaintext);
    });
  });

  describe("Tamper Resistance & Integrity Verification (AES-GCM Auth Tag)", () => {
    it("should fail decryption if a single byte in the ciphertext is modified", () => {
      const plaintext = "sensitive_broker_account_token";
      const encrypted = service.encrypt(plaintext);
      const [iv, authTag, ciphertext] = encrypted.split(":");

      // Flip the last character of ciphertext
      const lastChar = ciphertext.slice(-1);
      const tamperedChar = lastChar === "a" ? "b" : "a";
      const tamperedCiphertext = ciphertext.slice(0, -1) + tamperedChar;
      const tamperedPayload = `${iv}:${authTag}:${tamperedCiphertext}`;

      expect(() => service.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });

    it("should fail decryption if the auth tag is modified", () => {
      const plaintext = "sensitive_broker_account_token";
      const encrypted = service.encrypt(plaintext);
      const [iv, authTag, ciphertext] = encrypted.split(":");

      // Flip the first character of auth tag
      const firstChar = authTag[0];
      const tamperedFirstChar = firstChar === "0" ? "1" : "0";
      const tamperedAuthTag = tamperedFirstChar + authTag.slice(1);
      const tamperedPayload = `${iv}:${tamperedAuthTag}:${ciphertext}`;

      expect(() => service.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });

    it("should fail decryption if the IV is modified", () => {
      const plaintext = "sensitive_broker_account_token";
      const encrypted = service.encrypt(plaintext);
      const [iv, authTag, ciphertext] = encrypted.split(":");

      const tamperedIv = (iv[0] === "f" ? "e" : "f") + iv.slice(1);
      const tamperedPayload = `${tamperedIv}:${authTag}:${ciphertext}`;

      expect(() => service.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });

    it("should reject malformed payload formats", () => {
      expect(() => service.decrypt("invalid_string_no_colons")).toThrow(
        /Invalid encrypted payload format/,
      );
      expect(() => service.decrypt("only:two_parts")).toThrow(/Invalid encrypted payload format/);
      expect(() => service.decrypt("")).toThrow(/Cannot decrypt empty payload/);
    });
  });

  describe("Object & Credentials Helper Methods", () => {
    it("should serialize, encrypt, and decrypt complex nested objects", () => {
      const data = {
        userId: "usr-12345",
        settings: {
          mfaEnabled: true,
          limits: [1000, 2500, 5000],
        },
        meta: { timestamp: 1725540000000, label: "test" },
      };

      const encrypted = service.encryptObject(data);
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toContain("usr-12345");

      const decrypted = service.decryptObject<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });

    it("should encrypt and decrypt provider credentials dictionary", () => {
      const credentials = {
        apiKey: "kite_prod_api_key_xyz890",
        apiSecret: "kite_prod_secret_token_abc123",
        requestToken: "temp_request_token_456",
      };

      const encrypted = service.encryptCredentials(credentials);
      expect(encrypted).not.toContain("kite_prod_api_key_xyz890");
      expect(encrypted).not.toContain("kite_prod_secret_token_abc123");

      const decrypted = service.decryptCredentials(encrypted);
      expect(decrypted).toEqual(credentials);
      expect(decrypted.apiKey).toBe("kite_prod_api_key_xyz890");
      expect(decrypted.apiSecret).toBe("kite_prod_secret_token_abc123");
    });

    it("should throw on encrypting null or undefined", () => {
      expect(() => service.encrypt(null as any)).toThrow(/Cannot encrypt null or undefined input/);
      expect(() => service.encrypt(undefined as any)).toThrow(
        /Cannot encrypt null or undefined input/,
      );
      expect(() => service.encryptObject(null as any)).toThrow(
        /Cannot encrypt null or undefined object/,
      );
    });
  });

  describe("Key Handling & Isolation", () => {
    it("should fail decryption when attempting to decrypt with a different key", () => {
      const otherKeyService = new EncryptionService(undefined, "different_secret_key_32_bytes!");
      const plaintext = "classified_financial_record";

      const encrypted = service.encrypt(plaintext);

      // Decryption with a different key must fail authentication tag check
      expect(() => otherKeyService.decrypt(encrypted)).toThrow(/Decryption failed/);
    });

    it("should support 64-char hex key", () => {
      const hexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const hexKeyService = new EncryptionService(undefined, hexKey);

      const plaintext = "hex_key_test";
      const encrypted = hexKeyService.encrypt(plaintext);
      expect(hexKeyService.decrypt(encrypted)).toEqual(plaintext);
    });

    it("should derive 256-bit key via SHA-256 for non-32 byte arbitrary passphrases", () => {
      const arbitraryPassphrase = "short-passphrase";
      const customService = new EncryptionService(undefined, arbitraryPassphrase);

      const plaintext = "arbitrary_passphrase_test";
      const encrypted = customService.encrypt(plaintext);
      expect(customService.decrypt(encrypted)).toEqual(plaintext);
    });

    it("should throw if encryption key is empty", () => {
      expect(() => new EncryptionService(undefined, "")).toThrow(
        /ENCRYPTION_KEY_AES256 must be a non-empty string/,
      );
    });
  });
});
