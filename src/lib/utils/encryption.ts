/**
 * RR-272: AES-256-GCM encryption utilities for API keys
 * Provides secure encryption/decryption for sensitive data
 */

import crypto from "crypto";

/**
 * Type for encrypted data structure
 */
export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum
const SALT_LENGTH = 32;

/**
 * Validate encryption key format
 * @param key - The key string to validate
 * @returns True if key is valid hex format
 */
function validateKeyFormat(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Get encryption key from environment
 * @returns Buffer containing the encryption key
 * @throws Error if key is not properly configured
 */
function getEncryptionKey(): Buffer {
  // Try client-side environment variable first, then server-side
  const keyHex =
    process.env.NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY ||
    process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error("Encryption key not configured");
  }

  if (!validateKeyFormat(keyHex)) {
    throw new Error(
      "Encryption key must be a 64-character hex string (256 bits)"
    );
  }

  return Buffer.from(keyHex, "hex");
}

/**
 * Derive a deterministic IV using PBKDF2 from the content
 * This ensures the same content always produces the same encrypted result
 * @param content - The content to derive IV from
 * @param key - The encryption key to use as part of derivation
 * @returns Deterministic IV for this content
 */
function deriveIV(content: string, key: Buffer): Buffer {
  // Create a stable salt from the content hash and key
  // This ensures same content always gets same IV
  const contentHash = crypto.createHash("sha256").update(content).digest();
  const keySalt = crypto.createHash("sha256").update(key).digest();

  // Combine content hash and key salt for the derivation salt
  const salt = Buffer.concat([contentHash, keySalt]).slice(0, SALT_LENGTH);

  // Derive IV using PBKDF2 with the combined salt
  return crypto.pbkdf2Sync(
    content,
    salt,
    PBKDF2_ITERATIONS,
    IV_LENGTH,
    "sha256"
  );
}

/**
 * Encrypt a string using AES-256-GCM with deterministic IV
 * Uses PBKDF2 to derive IV from content, ensuring same input produces same output
 * @param text - Plain text to encrypt
 * @returns Object containing encrypted data, IV, and auth tag
 */
export function encryptApiKey(text: string): EncryptedData {
  try {
    const key = getEncryptionKey();
    // Use deterministic IV derivation instead of random
    const iv = deriveIV(text, key);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt API key");
  }
}

/**
 * Decrypt a string using AES-256-GCM
 * @param encrypted - Encrypted data in hex format
 * @param iv - Initialization vector in hex format
 * @param authTag - Authentication tag in hex format
 * @returns Decrypted plain text
 */
export function decryptApiKey(
  encrypted: string,
  iv: string,
  authTag: string
): string | null {
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, "hex")
    );

    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    // Return null to indicate decryption failure without exposing details
    return null;
  }
}

/**
 * Validate encryption key format
 * @returns True if key is valid
 */
export function isEncryptionKeyValid(): boolean {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  return !!keyHex && validateKeyFormat(keyHex);
}

/**
 * Process API key for storage/transmission
 * Encrypts the key and returns encrypted components
 */
export function processApiKeyForStorage(apiKey: string): EncryptedData | null {
  if (!apiKey || !isEncryptionKeyValid()) {
    return null;
  }

  try {
    return encryptApiKey(apiKey);
  } catch {
    return null;
  }
}

/**
 * Alias for decryptApiKey for backward compatibility
 */
export const decrypt = decryptApiKey;

/**
 * Sanitize error messages to remove sensitive information
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove any API keys or sensitive patterns
  return message
    .replace(/sk-[a-zA-Z0-9-]+/g, "[REDACTED]")
    .replace(/api[_-]?key[:\s]+[a-zA-Z0-9-]+/gi, "api_key: [REDACTED]");
}
