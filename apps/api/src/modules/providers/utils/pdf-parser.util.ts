import { Logger, UnauthorizedException } from "@nestjs/common";
import { decryptPDF } from "@pdfsmaller/pdf-decrypt";
import pdfParse from "pdf-parse";

const logger = new Logger("PdfParserUtil");

export interface PdfTextResult {
  text: string;
  numPages: number;
  info?: Record<string, any>;
}

/**
 * Decrypts a password-protected PDF buffer entirely in-memory using AES-256 or RC4.
 * Guarantees zero disk writes.
 */
export async function decryptPdfBufferInMemory(
  buffer: Buffer | Uint8Array,
  password?: string,
): Promise<Buffer> {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (!password || password.trim().length === 0) {
    // If no password provided, return original buffer
    return Buffer.from(uint8);
  }

  const trimmedPassword = password.trim();

  // Try candidate passwords: exact, uppercase (PANs are often uppercase), lowercase
  const candidatePasswords = Array.from(
    new Set([trimmedPassword, trimmedPassword.toUpperCase(), trimmedPassword.toLowerCase()]),
  );

  let lastError: Error | null = null;

  for (const pwd of candidatePasswords) {
    try {
      const decryptedBytes = await decryptPDF(uint8, pwd);
      if (decryptedBytes && decryptedBytes.length > 0) {
        return Buffer.from(decryptedBytes);
      }
    } catch (err: any) {
      lastError = err;
      const msg = (err?.message || "").toLowerCase();
      // If error indicates the document is not encrypted, return original buffer directly
      if (
        msg.includes("not encrypted") ||
        msg.includes("unencrypted") ||
        msg.includes("no encryption")
      ) {
        return Buffer.from(uint8);
      }
      // Otherwise continue to next candidate password
    }
  }

  // If candidate passwords failed or document is protected with an invalid password
  logger.warn(`Failed to decrypt PDF in-memory: ${lastError?.message}`);
  throw new UnauthorizedException(
    "Invalid password for CAS PDF statement. CAMS/KFintech statements require PAN + Date of Birth (e.g. ABCDE1234F01011990).",
  );
}

/**
 * Extracts raw textual content from an unencrypted or in-memory decrypted PDF buffer.
 * Utilizes pdf-parse in-memory.
 */
export async function extractTextFromPdfBuffer(
  buffer: Buffer | Uint8Array,
): Promise<PdfTextResult> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  try {
    const parsed = await pdfParse(nodeBuffer);
    return {
      text: parsed.text || "",
      numPages: parsed.numpages || 1,
      info: parsed.info || {},
    };
  } catch (err: any) {
    const errorMsg = (err?.message || "").toLowerCase();

    if (
      errorMsg.includes("password") ||
      errorMsg.includes("encrypted") ||
      errorMsg.includes("security handler") ||
      errorMsg.includes("invalid pdf structure") ||
      errorMsg.includes("bad xref entry")
    ) {
      throw new UnauthorizedException(
        "CAS statement is password protected. Please provide the account password (PAN + Date of Birth).",
      );
    }

    throw new Error(`Failed to parse PDF document: ${err?.message || "Corrupted PDF data"}`);
  }
}

/**
 * In-memory pipeline: Decrypts PDF (if protected) and extracts all text content.
 * Guarantees that neither password nor unencrypted PDF data is ever written to disk.
 */
export async function parseProtectedPdf(
  buffer: Buffer | Uint8Array,
  password?: string,
): Promise<PdfTextResult> {
  let processedBuffer: Buffer;

  if (password && password.trim().length > 0) {
    processedBuffer = await decryptPdfBufferInMemory(buffer, password);
  } else {
    processedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  return extractTextFromPdfBuffer(processedBuffer);
}
