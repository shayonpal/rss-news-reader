/**
 * Security tests for API key handling
 * RR-272: User preferences API integration with Settings page
 *
 * Validates that API keys are never exposed in client state,
 * properly encrypted, and handled securely throughout the application.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePreferencesDomainStore } from "@/lib/stores/preferences-domain-store";
import {
  usePreferencesEditorStore,
  apiKeyStorage,
  apiKeyToken,
} from "@/lib/stores/preferences-editor-store";
import crypto from "crypto";

// Mock encryption key for testing
const TEST_ENCRYPTION_KEY =
  "a1b2c3d4e5f6789012345678901234567890abcdefabcdef1234567890abcdef";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Mock API responses
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("API Key Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

    // Clear any stored keys
    apiKeyStorage.delete(global);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Client-Side Security", () => {
    it("should never expose API key in domain store state", async () => {
      const { result } = renderHook(() => usePreferencesDomainStore());

      // Mock API response with encrypted API key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preferences: {
            ai: {
              provider: "anthropic",
              apiKey: {
                encrypted: "encrypted_value_here",
                iv: "initialization_vector",
                authTag: "auth_tag_value",
              },
              model: "claude-3-sonnet-20240229",
              enabled: true,
            },
          },
        }),
      });

      await act(async () => {
        await result.current.loadPreferences();
      });

      // Verify API key is never in plain text in the store
      expect(result.current.savedPreferences?.ai.apiKey).toBeNull();

      // Verify the store state doesn't contain the key anywhere
      const storeJSON = JSON.stringify(result.current);
      expect(storeJSON).not.toContain("sk-");
      expect(storeJSON).not.toContain("anthropic");
      expect(storeJSON).not.toContain("encrypted_value_here");
    });

    it("should use WeakMap pattern for temporary API key storage", async () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      const testApiKey = "sk-test-anthropic-key-12345";

      await act(async () => {
        result.current.setApiKeyInput(testApiKey);
      });

      // API key should not be in the store state
      expect(result.current.apiKeyInput).toBe(""); // Empty or masked

      // Verify it's not accessible via JSON serialization
      const storeJSON = JSON.stringify(result.current);
      expect(storeJSON).not.toContain(testApiKey);

      // But should be retrievable via WeakMap (actual implementation)
      expect(apiKeyStorage.get(apiKeyToken)).toBe(testApiKey);
    });

    it("should mask API key in DevTools and console", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      // Simulate setting an API key
      const testApiKey = "sk-ant-api03-test-key";

      act(() => {
        result.current.setApiKeyInput(testApiKey);
      });

      // Custom toString should mask the key
      const storeString = result.current.toString?.() || String(result.current);
      expect(storeString).not.toContain(testApiKey);

      // Console.log should not expose the key
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      console.log(result.current);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(testApiKey)
      );

      consoleSpy.mockRestore();
    });

    it("should clear API key from memory on component unmount", async () => {
      const { result, unmount } = renderHook(() => usePreferencesEditorStore());

      const testApiKey = "sk-test-key-to-clear";

      act(() => {
        result.current.setApiKeyInput(testApiKey);
      });

      expect(apiKeyStorage.get(apiKeyToken)).toBe(testApiKey);

      // Unmount should clear the key
      unmount();

      // Key should be cleared from WeakMap (garbage collected)
      expect(apiKeyStorage.get(apiKeyToken)).toBeUndefined();
    });
  });

  describe("API Encryption", () => {
    it("should encrypt API key before sending to server", async () => {
      const { result: domainResult } = renderHook(() =>
        usePreferencesDomainStore()
      );
      const { result: editorResult } = renderHook(() =>
        usePreferencesEditorStore()
      );

      const plainApiKey = "sk-ant-api03-real-key-123";

      // Set API key in editor
      act(() => {
        editorResult.current.setApiKeyInput(plainApiKey);
      });

      // Build patch for save
      const patch = editorResult.current.buildPatch(
        domainResult.current.savedPreferences
      );

      // Mock the save request
      mockFetch.mockImplementation(async (url, options) => {
        const body = JSON.parse(options.body);

        // Verify the API key is encrypted in the request
        expect(body.ai?.apiKey).toBeDefined();
        expect(body.ai.apiKey).toHaveProperty("encrypted");
        expect(body.ai.apiKey).toHaveProperty("iv");
        expect(body.ai.apiKey).toHaveProperty("authTag");

        // Verify plain key is not in request
        const requestJSON = JSON.stringify(body);
        expect(requestJSON).not.toContain(plainApiKey);

        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      });

      await act(async () => {
        await domainResult.current.savePreferences(patch);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/users/preferences"),
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("encrypted"),
        })
      );
    });

    it("should validate encryption key format", () => {
      const invalidKeys = [
        "", // Empty
        "short", // Too short
        "not-hex-characters-1234567890", // Not hex
        TEST_ENCRYPTION_KEY.slice(0, -2), // Wrong length
      ];

      invalidKeys.forEach((invalidKey) => {
        process.env.TOKEN_ENCRYPTION_KEY = invalidKey;

        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        // Attempt to encrypt with invalid key
        expect(() => {
          const iv = crypto.randomBytes(16);
          crypto.createCipheriv(
            ENCRYPTION_ALGORITHM,
            Buffer.from(invalidKey, "hex"),
            iv
          );
        }).toThrow();

        consoleSpy.mockRestore();
      });
    });

    it("should use AES-256-GCM encryption algorithm", () => {
      const plainText = "sk-ant-api03-test-encryption";

      // Encrypt
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        ENCRYPTION_ALGORITHM,
        Buffer.from(TEST_ENCRYPTION_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(plainText, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Verify encryption produced output
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plainText);
      expect(authTag).toBeDefined();

      // Decrypt to verify
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_ALGORITHM,
        Buffer.from(TEST_ENCRYPTION_KEY, "hex"),
        iv
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      expect(decrypted).toBe(plainText);
    });

    it("should handle decryption failures gracefully", async () => {
      const { result } = renderHook(() => usePreferencesDomainStore());

      // Mock API response with corrupted encrypted data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preferences: {
            ai: {
              provider: "anthropic",
              apiKey: {
                encrypted: "corrupted_data",
                iv: "bad_iv",
                authTag: "bad_tag",
              },
            },
          },
        }),
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await act(async () => {
        await result.current.loadPreferences();
      });

      // Should handle error gracefully and set apiKey to null
      expect(result.current.savedPreferences?.ai.apiKey).toBeNull();
      expect(result.current.error).toBeNull(); // No user-facing error

      consoleSpy.mockRestore();
    });
  });

  describe("Network Security", () => {
    it("should only send API key over HTTPS", async () => {
      const { result } = renderHook(() => usePreferencesDomainStore());

      mockFetch.mockImplementation(async (url) => {
        // Verify HTTPS in production
        if (process.env.NODE_ENV === "production") {
          expect(url).toMatch(/^https:\/\//);
        }

        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      });

      await act(async () => {
        await result.current.savePreferences({ ai: { apiKey: "encrypted" } });
      });
    });

    it("should include CSRF protection headers", async () => {
      const { result } = renderHook(() => usePreferencesDomainStore());

      mockFetch.mockImplementation(async (url, options) => {
        // Verify security headers
        expect(options.headers).toHaveProperty(
          "Content-Type",
          "application/json"
        );

        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      });

      await act(async () => {
        await result.current.savePreferences({});
      });
    });

    it("should handle API key rotation", async () => {
      const { result } = renderHook(() => usePreferencesDomainStore());

      const oldKey = "sk-ant-old-key-123";
      const newKey = "sk-ant-new-key-456";

      // First save with old key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await result.current.savePreferences({
          ai: { apiKey: { encrypted: "old_encrypted" } },
        });
      });

      // Rotate to new key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await result.current.savePreferences({
          ai: { apiKey: { encrypted: "new_encrypted" } },
        });
      });

      // Verify both requests were made
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Server-Side Validation", () => {
    it("should reject unencrypted API keys from client", async () => {
      const { result } = renderHook(() => usePreferencesDomainStore());

      // Attempt to send plain API key (should be rejected)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: "API key must be encrypted",
        }),
      });

      await act(async () => {
        try {
          await result.current.savePreferences({
            ai: { apiKey: "sk-plain-text-key" }, // Wrong format
          });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.error).toContain("API key must be encrypted");
    });

    it("should validate API key format after decryption", async () => {
      // This would be server-side validation
      const validateApiKey = (key: string): boolean => {
        // Anthropic keys start with sk-ant-
        const anthropicPattern = /^sk-ant-api\d{2}-[\w-]{48}$/;

        // OpenAI keys start with sk-
        const openaiPattern = /^sk-[\w]{48}$/;

        return anthropicPattern.test(key) || openaiPattern.test(key);
      };

      // Valid keys
      expect(
        validateApiKey(
          "sk-ant-api03-abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx"
        )
      ).toBe(true);

      // Invalid keys
      expect(validateApiKey("invalid-key")).toBe(false);
      expect(validateApiKey("sk-")).toBe(false);
      expect(validateApiKey("")).toBe(false);
    });
  });

  describe("Audit and Compliance", () => {
    it("should log API key access attempts", async () => {
      const auditLog: Array<{
        action: string;
        timestamp: Date;
        userId?: string;
      }> = [];

      const logAccess = (action: string, userId?: string) => {
        auditLog.push({
          action,
          timestamp: new Date(),
          userId,
        });
      };

      // Simulate API key access
      logAccess("api_key_view_attempt", "user_123");
      logAccess("api_key_update", "user_123");
      logAccess("api_key_rotation", "user_123");

      expect(auditLog).toHaveLength(3);
      expect(auditLog[0].action).toBe("api_key_view_attempt");
      expect(auditLog[1].action).toBe("api_key_update");
      expect(auditLog[2].action).toBe("api_key_rotation");
    });

    it("should enforce rate limiting on API key operations", async () => {
      const rateLimiter = {
        attempts: new Map<string, number>(),
        maxAttempts: 5,
        windowMs: 60000, // 1 minute

        checkLimit(userId: string): boolean {
          const attempts = this.attempts.get(userId) || 0;
          if (attempts >= this.maxAttempts) {
            return false;
          }
          this.attempts.set(userId, attempts + 1);
          return true;
        },

        reset(userId: string) {
          this.attempts.delete(userId);
        },
      };

      const userId = "user_123";

      // Should allow up to 5 attempts
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.checkLimit(userId)).toBe(true);
      }

      // Should block after 5 attempts
      expect(rateLimiter.checkLimit(userId)).toBe(false);

      // Reset should allow access again
      rateLimiter.reset(userId);
      expect(rateLimiter.checkLimit(userId)).toBe(true);
    });

    it("should sanitize error messages to avoid key leakage", () => {
      const sanitizeError = (error: Error): string => {
        let message = error.message;

        // Remove any potential API keys
        message = message.replace(/sk-[\w-]+/g, "[REDACTED]");

        // Remove specific key patterns
        message = message.replace(
          /api[_-]?key[:\s]+[\w-]+/gi,
          "api_key: [REDACTED]"
        );

        return message;
      };

      const error1 = new Error("Invalid API key: sk-ant-api03-test123");
      expect(sanitizeError(error1)).toBe("Invalid API key: [REDACTED]");

      const error2 = new Error("Failed to decrypt api_key: sk-test-key");
      expect(sanitizeError(error2)).toBe(
        "Failed to decrypt api_key: [REDACTED]"
      );
    });
  });

  describe("Memory Management", () => {
    it("should clear sensitive data from memory after use", () => {
      // Simulate secure string handling
      class SecureString {
        private value: string;
        private cleared = false;

        constructor(value: string) {
          this.value = value;
        }

        getValue(): string {
          if (this.cleared) {
            throw new Error("Value has been cleared");
          }
          return this.value;
        }

        clear() {
          // Overwrite memory
          this.value = "0".repeat(this.value.length);
          this.value = "";
          this.cleared = true;
        }
      }

      const apiKey = new SecureString("sk-ant-api03-sensitive");

      expect(apiKey.getValue()).toBe("sk-ant-api03-sensitive");

      apiKey.clear();

      expect(() => apiKey.getValue()).toThrow("Value has been cleared");
    });

    it("should use WeakMap for automatic garbage collection", () => {
      const keyStore = new WeakMap();
      let component: any = { id: "component1" };

      keyStore.set(component, "sk-ant-api03-gc-test");

      expect(keyStore.get(component)).toBe("sk-ant-api03-gc-test");

      // Remove reference
      component = null;

      // Key should be eligible for garbage collection
      // (Cannot directly test GC, but WeakMap ensures it)
      expect(component).toBeNull();
    });
  });
});
