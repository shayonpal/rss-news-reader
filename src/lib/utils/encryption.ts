/**
 * Shared encryption utilities for API keys and sensitive data
 * Uses AES-256-GCM encryption with random IVs
 */

import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a text string using AES-256-GCM
 * @param text The text to encrypt
 * @param encryptionKey The hex-encoded encryption key (optional, defaults to env var)
 * @returns The encrypted data with IV and auth tag
 */
export function encrypt(text: string, encryptionKey?: string): EncryptedData {
  const key = encryptionKey || process.env.TOKEN_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("Encryption key not configured");
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(key, "hex"),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypts data encrypted with the encrypt function
 * @param encryptedData The encrypted data object
 * @param encryptionKey The hex-encoded encryption key (optional, defaults to env var)
 * @returns The decrypted text
 */
export function decrypt(
  encryptedData: EncryptedData,
  encryptionKey?: string
): string {
  const key = encryptionKey || process.env.TOKEN_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("Encryption key not configured");
  }

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(key, "hex"),
    Buffer.from(encryptedData.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));

  let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Sanitizes error messages to prevent API key exposure
 * @param message The error message to sanitize
 * @returns The sanitized message
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove any API keys that might be in the error message
  return message.replace(/sk-[^\s]+/g, "[REDACTED]");
}
