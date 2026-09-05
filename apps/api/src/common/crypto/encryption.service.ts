import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly ivLength = 12; // 96 bits recommended for AES-GCM (NIST SP 800-38D)
  private readonly tagLength = 16; // 128 bits authentication tag
  private readonly key: Buffer;

  constructor(
    private readonly configService?: ConfigService,
    explicitKey?: string,
  ) {
    let rawKey: string | undefined = explicitKey;
    if (rawKey === undefined) {
      rawKey =
        this.configService?.get<string>("ENCRYPTION_KEY_AES256") ||
        process.env.ENCRYPTION_KEY_AES256 ||
        "dev_aes256_secret_key_32_bytes_long_!";
    }

    this.key = this.deriveKey(rawKey);
  }

  /**
   * Derives a deterministic 256-bit (32-byte) key buffer from raw input.
   * If a 64-character hex string is provided, it parses it as hex.
   * If an exact 32-character ASCII string is provided, it uses its UTF-8 buffer.
   * Otherwise, it hashes the secret with SHA-256 to ensure exact 32-byte key size.
   */
  private deriveKey(rawKey: string): Buffer {
    if (!rawKey || typeof rawKey !== "string") {
      throw new Error("EncryptionService: ENCRYPTION_KEY_AES256 must be a non-empty string");
    }

    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      return Buffer.from(rawKey, "hex");
    }

    const utf8Buffer = Buffer.from(rawKey, "utf-8");
    if (utf8Buffer.length === 32) {
      return utf8Buffer;
    }

    // SHA-256 derivation ensures exactly 256 bits (32 bytes) of cryptographic key
    return crypto.createHash("sha256").update(utf8Buffer).digest();
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a fresh, unique 96-bit IV.
   * Returns a serialized string formatted as: `iv:authTag:ciphertext` in hex.
   */
  encrypt(plaintext: string): string {
    if (plaintext === null || plaintext === undefined) {
      throw new Error("EncryptionService: Cannot encrypt null or undefined input");
    }

    // Generate fresh cryptographically secure random IV for each operation
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv, {
      authTagLength: this.tagLength,
    });

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  /**
   * Decrypts an AES-256-GCM serialized string (`iv:authTag:ciphertext`) or EncryptedPayload.
   * Validates authentication tag to ensure data integrity and authenticity.
   * Throws an error if ciphertext or tag was tampered with.
   */
  decrypt(payload: string | EncryptedPayload): string {
    if (!payload) {
      throw new Error("EncryptionService: Cannot decrypt empty payload");
    }

    let ivHex: string;
    let authTagHex: string;
    let ciphertextHex: string;

    if (typeof payload === "string") {
      const parts = payload.split(":");
      if (parts.length !== 3) {
        throw new Error(
          'EncryptionService: Invalid encrypted payload format. Expected "iv:authTag:ciphertext"',
        );
      }
      [ivHex, authTagHex, ciphertextHex] = parts;
    } else {
      ivHex = payload.iv;
      authTagHex = payload.authTag;
      ciphertextHex = payload.ciphertext;
    }

    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const ciphertext = Buffer.from(ciphertextHex, "hex");

      if (iv.length !== this.ivLength) {
        throw new Error(`EncryptionService: Invalid IV length (expected ${this.ivLength} bytes)`);
      }

      if (authTag.length !== this.tagLength) {
        throw new Error(
          `EncryptionService: Invalid auth tag length (expected ${this.tagLength} bytes)`,
        );
      }

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv, {
        authTagLength: this.tagLength,
      });

      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      return decrypted.toString("utf-8");
    } catch (err: any) {
      throw new Error(`EncryptionService: Decryption failed - ${err.message}`);
    }
  }

  /**
   * Serializes an arbitrary object to JSON and encrypts it with AES-256-GCM.
   */
  encryptObject<T>(data: T): string {
    if (data === null || data === undefined) {
      throw new Error("EncryptionService: Cannot encrypt null or undefined object");
    }
    const jsonString = JSON.stringify(data);
    return this.encrypt(jsonString);
  }

  /**
   * Decrypts an AES-256-GCM payload and parses the resulting JSON into type T.
   */
  decryptObject<T>(payload: string | EncryptedPayload): T {
    const decryptedJson = this.decrypt(payload);
    try {
      return JSON.parse(decryptedJson) as T;
    } catch (err: any) {
      throw new Error(`EncryptionService: Failed to parse decrypted JSON - ${err.message}`);
    }
  }

  /**
   * Helper specifically for provider credentials (API keys, secrets, tokens).
   */
  encryptCredentials(credentials: Record<string, any>): string {
    return this.encryptObject(credentials);
  }

  /**
   * Helper specifically for provider credentials (API keys, secrets, tokens).
   */
  decryptCredentials(payload: string | EncryptedPayload): Record<string, any> {
    return this.decryptObject<Record<string, any>>(payload);
  }
}
