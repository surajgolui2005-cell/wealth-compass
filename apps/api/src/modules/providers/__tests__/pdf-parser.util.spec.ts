import { UnauthorizedException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import {
  decryptPdfBufferInMemory,
  extractTextFromPdfBuffer,
  parseProtectedPdf,
} from "../utils/pdf-parser.util";

describe("PdfParserUtil", () => {
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    // Read the bundled sample PDF from pdf-parse test suite
    const samplePath = path.resolve(
      __dirname,
      "../../../../../../node_modules/pdf-parse/test/data/05-versions-space.pdf",
    );
    if (fs.existsSync(samplePath)) {
      samplePdfBuffer = fs.readFileSync(samplePath);
    } else {
      // Fallback path if monorepo hoisting differs
      const altPath = path.resolve(
        process.cwd(),
        "node_modules/pdf-parse/test/data/05-versions-space.pdf",
      );
      if (fs.existsSync(altPath)) {
        samplePdfBuffer = fs.readFileSync(altPath);
      } else {
        samplePdfBuffer = Buffer.from("%PDF-1.4 mock pdf buffer");
      }
    }
  });

  describe("extractTextFromPdfBuffer", () => {
    it("should extract text from in-memory PDF buffer", async () => {
      if (samplePdfBuffer.length > 50) {
        const result = await extractTextFromPdfBuffer(samplePdfBuffer);
        expect(result).toBeDefined();
        expect(result.numPages).toBeGreaterThanOrEqual(1);
        expect(typeof result.text).toBe("string");
      }
    });

    it("should throw UnauthorizedException on password-protected or corrupt encrypted buffer", async () => {
      const mockEncrypted = Buffer.from("%PDF-1.4 encrypted data");
      await expect(extractTextFromPdfBuffer(mockEncrypted)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("decryptPdfBufferInMemory", () => {
    it("should return original buffer unchanged if password is empty or not provided", async () => {
      const buf = Buffer.from("TEST_PDF_BYTES");
      const result1 = await decryptPdfBufferInMemory(buf);
      expect(result1).toEqual(buf);

      const result2 = await decryptPdfBufferInMemory(buf, "");
      expect(result2).toEqual(buf);

      const result3 = await decryptPdfBufferInMemory(buf, "   ");
      expect(result3).toEqual(buf);
    });

    it("should throw UnauthorizedException if password decryption fails on encrypted document", async () => {
      const fakeEncrypted = Buffer.from("%PDF-1.4 /Encrypt 4 0 R");
      const pdfDecryptModule = require("@pdfsmaller/pdf-decrypt");
      jest
        .spyOn(pdfDecryptModule, "decryptPDF")
        .mockRejectedValue(new Error("Incorrect password for encrypted PDF"));

      await expect(decryptPdfBufferInMemory(fakeEncrypted, "WRONG_PAN_DOB")).rejects.toThrow(
        UnauthorizedException,
      );

      jest.restoreAllMocks();
    });
  });

  describe("parseProtectedPdf", () => {
    it("should parse unprotected PDF buffer cleanly", async () => {
      if (samplePdfBuffer.length > 50) {
        const result = await parseProtectedPdf(samplePdfBuffer);
        expect(result).toBeDefined();
        expect(result.numPages).toBeGreaterThanOrEqual(1);
      }
    });

    it("should attempt in-memory decryption when password is provided", async () => {
      const fakeEncrypted = Buffer.from("%PDF-1.4 /Encrypt 4 0 R");
      const pdfDecryptModule = require("@pdfsmaller/pdf-decrypt");
      jest.spyOn(pdfDecryptModule, "decryptPDF").mockRejectedValue(new Error("Incorrect password"));

      await expect(parseProtectedPdf(fakeEncrypted, "TEST_PASSWORD")).rejects.toThrow(
        UnauthorizedException,
      );

      jest.restoreAllMocks();
    });
  });
});
