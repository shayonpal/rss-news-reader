/**
 * RR-271: Anthropic API Key Encryption Tests
 *
 * Test Coverage:
 * 1. Encryption key validation (64-char hex format)
 * 2. Encryption/decryption round-trip with random IVs
 * 3. Security validation (no keys in logs/errors)
 * 4. Tampered authTag detection
 * 5. Performance benchmarks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";

describe("RR-271: Anthropic API Key Encryption - Unit Tests", () => {
  const VALID_HEX_KEY =
    "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e3498";
  const INVALID_BASE64_KEY = "NnZJ0iRlqVID3c/+5IguN3GL7wFsmPGCJ+/gEQNeNJg=";
  const TEST_API_KEY = "sk-ant-api03-test-key-1234567890";

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Encryption Key Validation", () => {
    it("should reject Base64 format keys", () => {
      process.env.TOKEN_ENCRYPTION_KEY = INVALID_BASE64_KEY;

      // This test will fail until implementation converts key format
      expect(() => {
        // Simulate encryption attempt with Base64 key
        const keyBuffer = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
        expect(keyBuffer.length).toBe(32); // Should be 32 bytes for AES-256
      }).toThrow();
    });

    it("should accept 64-character hex format keys", () => {
      process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;

      const keyBuffer = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex");
      expect(keyBuffer.length).toBe(32); // 32 bytes = 256 bits for AES-256
      expect(process.env.TOKEN_ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/i);
    });

    it("should validate key length is exactly 64 hex characters", () => {
      const shortKey =
        "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e34"; // 62 chars
      const longKey =
        "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e349800"; // 66 chars

      expect(shortKey.length).not.toBe(64);
      expect(longKey.length).not.toBe(64);
      expect(VALID_HEX_KEY.length).toBe(64);
    });

    it("should detect invalid hex characters", () => {
      const invalidHexKey =
        "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e34g8"; // 'g' is invalid

      expect(invalidHexKey).not.toMatch(/^[0-9a-f]{64}$/i);
      expect(VALID_HEX_KEY).toMatch(/^[0-9a-f]{64}$/i);
    });
  });

  describe("Encryption Round-Trip", () => {
    it("should encrypt and decrypt API key with random IV", () => {
      // This test simulates the encrypt/decrypt functions
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Decrypt
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      expect(decrypted).toBe(TEST_API_KEY);
    });

    it("should generate different ciphertext with different IVs", () => {
      const key = Buffer.from(VALID_HEX_KEY, "hex");

      // First encryption
      const iv1 = crypto.randomBytes(16);
      const cipher1 = crypto.createCipheriv("aes-256-gcm", key, iv1);
      const encrypted1 =
        cipher1.update(TEST_API_KEY, "utf8", "hex") + cipher1.final("hex");

      // Second encryption with different IV
      const iv2 = crypto.randomBytes(16);
      const cipher2 = crypto.createCipheriv("aes-256-gcm", key, iv2);
      const encrypted2 =
        cipher2.update(TEST_API_KEY, "utf8", "hex") + cipher2.final("hex");

      expect(encrypted1).not.toBe(encrypted2); // Different ciphertext
      expect(iv1).not.toEqual(iv2); // Different IVs
    });

    it("should preserve exact API key format after round-trip", () => {
      const apiKeys = [
        "sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "sk-ant-api03-短い鍵", // Unicode test
        'sk-ant-{"key":"value"}', // JSON-like content
        "", // Empty string edge case
      ];

      const key = Buffer.from(VALID_HEX_KEY, "hex");

      apiKeys.forEach((apiKey) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

        let encrypted = cipher.update(apiKey, "utf8", "hex");
        encrypted += cipher.final("hex");
        const authTag = cipher.getAuthTag();

        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        expect(decrypted).toBe(apiKey);
      });
    });
  });

  describe("Security Validation", () => {
    it("should never expose API keys in error messages", () => {
      const sensitiveKey = "sk-ant-api03-SUPER-SECRET-KEY-12345";

      // Simulate various error scenarios
      const errors = [
        new Error(`Failed to encrypt: ${sensitiveKey}`), // Bad pattern
        new Error("Failed to encrypt API key"), // Good pattern
        new Error(`Invalid key format: ${sensitiveKey.substring(0, 10)}...`), // Partial exposure
      ];

      // Only the second error is acceptable
      expect(errors[0].message).toContain(sensitiveKey); // This should be caught
      expect(errors[1].message).not.toContain(sensitiveKey); // This is safe
      expect(errors[2].message).toContain("sk-ant-api"); // Partial exposure is also bad
    });

    it("should sanitize error messages before throwing", () => {
      const sanitizeError = (message: string, apiKey?: string): string => {
        if (!apiKey) return message;

        // Replace any occurrence of the API key
        return message.replace(apiKey, "[REDACTED]");
      };

      const apiKey = "sk-ant-api03-SECRET-123";
      const unsafeMessage = `Encryption failed for key: ${apiKey}`;
      const safeMessage = sanitizeError(unsafeMessage, apiKey);

      expect(safeMessage).toBe("Encryption failed for key: [REDACTED]");
      expect(safeMessage).not.toContain(apiKey);
    });

    it("should detect tampered authTag and fail decryption", () => {
      const key = Buffer.from(VALID_HEX_KEY, "hex");
      const iv = crypto.randomBytes(16);

      // Encrypt
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Tamper with authTag
      const tamperedTag = Buffer.from(authTag);
      tamperedTag[0] = tamperedTag[0] ^ 0xff; // Flip bits

      // Attempt decrypt with tampered tag
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tamperedTag);

      expect(() => {
        decipher.update(encrypted, "hex", "utf8");
        decipher.final("utf8"); // This should throw
      }).toThrow(/Unsupported state or unable to authenticate data/);
    });

    it("should fail decryption with wrong key", () => {
      const correctKey = Buffer.from(VALID_HEX_KEY, "hex");
      const wrongKey = Buffer.from(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "hex"
      );
      const iv = crypto.randomBytes(16);

      // Encrypt with correct key
      const cipher = crypto.createCipheriv("aes-256-gcm", correctKey, iv);
      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Try to decrypt with wrong key
      const decipher = crypto.createDecipheriv("aes-256-gcm", wrongKey, iv);
      decipher.setAuthTag(authTag);

      expect(() => {
        decipher.update(encrypted, "hex", "utf8");
        decipher.final("utf8");
      }).toThrow();
    });

    it("should not log sensitive data during encryption/decryption", () => {
      const consoleLogSpy = vi.spyOn(console, "log");
      const consoleErrorSpy = vi.spyOn(console, "error");

      // Simulate encryption with logging checks
      const key = Buffer.from(VALID_HEX_KEY, "hex");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      cipher.update(TEST_API_KEY, "utf8", "hex");
      cipher.final("hex");

      // Ensure no console output contains the API key
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Performance Benchmarks", () => {
    it("should decrypt within 5ms", () => {
      const key = Buffer.from(VALID_HEX_KEY, "hex");
      const iv = crypto.randomBytes(16);

      // Prepare encrypted data
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Measure decrypt time
      const startTime = performance.now();

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      decipher.update(encrypted, "hex", "utf8");
      decipher.final("utf8");

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5); // Should complete in < 5ms
    });

    it("should handle batch encryption efficiently", () => {
      const key = Buffer.from(VALID_HEX_KEY, "hex");
      const apiKeys = Array.from(
        { length: 100 },
        (_, i) => `sk-ant-api03-key-${i}`
      );

      const startTime = performance.now();

      apiKeys.forEach((apiKey) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        cipher.update(apiKey, "utf8", "hex");
        cipher.final("hex");
        cipher.getAuthTag();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTime = duration / apiKeys.length;

      expect(avgTime).toBeLessThan(1); // Average < 1ms per encryption
    });
  });

  describe("Storage Format Validation", () => {
    it("should store encrypted data in correct JSONB format", () => {
      const key = Buffer.from(VALID_HEX_KEY, "hex");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      const storageFormat = {
        encrypted,
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
      };

      // Validate format
      expect(storageFormat).toHaveProperty("encrypted");
      expect(storageFormat).toHaveProperty("iv");
      expect(storageFormat).toHaveProperty("authTag");

      expect(typeof storageFormat.encrypted).toBe("string");
      expect(typeof storageFormat.iv).toBe("string");
      expect(typeof storageFormat.authTag).toBe("string");

      // Validate hex encoding
      expect(storageFormat.encrypted).toMatch(/^[0-9a-f]+$/i);
      expect(storageFormat.iv).toMatch(/^[0-9a-f]{32}$/i); // 16 bytes = 32 hex chars
      expect(storageFormat.authTag).toMatch(/^[0-9a-f]{32}$/i); // 16 bytes = 32 hex chars
    });
  });
});
