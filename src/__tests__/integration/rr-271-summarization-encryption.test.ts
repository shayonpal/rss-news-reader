/**
 * RR-271: Summarization API with Encrypted Keys - Integration Tests
 *
 * Test Coverage:
 * 1. User key retrieval and decryption
 * 2. Fallback to environment variable
 * 3. 403 error when no keys available
 * 4. End-to-end flow from settings to API usage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestClient } from "@/test-utils/test-server";
import { createSupabaseTestClient } from "@/test-utils/supabase-test-client";
import crypto from "crypto";

describe("RR-271: Summarization with Encrypted API Keys - Integration Tests", () => {
  const VALID_HEX_KEY =
    "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e3498";
  const USER_API_KEY = "sk-ant-api03-user-key-12345";
  const ENV_API_KEY = "sk-ant-api03-env-key-67890";
  const TEST_ARTICLE_ID = "test-article-123";
  const TEST_USER_ID = "test-user-456";

  let testClient: ReturnType<typeof createTestClient>;
  let supabase: ReturnType<typeof createSupabaseTestClient>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
    process.env.ANTHROPIC_API_KEY = ENV_API_KEY;

    testClient = createTestClient();
    supabase = createSupabaseTestClient();

    // Mock authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: TEST_USER_ID, email: "test@example.com" },
      },
      error: null,
    });

    // Clear any existing preferences
    await supabase
      .from("user_preferences")
      .delete()
      .eq("user_id", TEST_USER_ID);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("API Key Source Priority", () => {
    it("should use user-provided encrypted key when available", async () => {
      // Store encrypted user key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(USER_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      await supabase.from("user_preferences").insert({
        user_id: TEST_USER_ID,
        preferences: {
          ai: {
            summaryModel: "claude-3-5-haiku-20241022",
            apiKey: {
              encrypted,
              iv: iv.toString("hex"),
              authTag: authTag.toString("hex"),
            },
          },
        },
      });

      // Mock Anthropic API call
      const anthropicSpy = vi.fn().mockResolvedValue({
        content: [{ text: "Test summary" }],
      });

      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(USER_API_KEY); // Verify user key is used
          }
          messages = {
            create: anthropicSpy,
          };
        },
      }));

      const response = await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(response.status).toBe(200);
      expect(anthropicSpy).toHaveBeenCalled();
    });

    it("should fallback to environment variable when user key not available", async () => {
      // No user preferences stored

      // Mock Anthropic API call
      const anthropicSpy = vi.fn().mockResolvedValue({
        content: [{ text: "Test summary" }],
      });

      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(ENV_API_KEY); // Verify env key is used
          }
          messages = {
            create: anthropicSpy,
          };
        },
      }));

      const response = await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(response.status).toBe(200);
      expect(anthropicSpy).toHaveBeenCalled();
    });

    it("should return 403 when no API keys available", async () => {
      // Remove environment variable
      delete process.env.ANTHROPIC_API_KEY;

      // No user preferences stored

      const response = await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error:
          "Anthropic API key not configured. Please add your API key in Settings.",
      });
    });

    it("should handle decryption errors gracefully", async () => {
      // Store corrupted encrypted data
      await supabase.from("user_preferences").insert({
        user_id: TEST_USER_ID,
        preferences: {
          ai: {
            summaryModel: "claude-3-5-haiku-20241022",
            apiKey: {
              encrypted: "invalid-hex-data",
              iv: "invalid-iv",
              authTag: "invalid-tag",
            },
          },
        },
      });

      // Should fallback to env variable
      const anthropicSpy = vi.fn().mockResolvedValue({
        content: [{ text: "Test summary" }],
      });

      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(ENV_API_KEY); // Fallback to env
          }
          messages = {
            create: anthropicSpy,
          };
        },
      }));

      const response = await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(response.status).toBe(200);
    });
  });

  describe("Cache Behavior", () => {
    it("should cache decrypted API key for performance", async () => {
      // Store encrypted user key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(USER_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      await supabase.from("user_preferences").insert({
        user_id: TEST_USER_ID,
        preferences: {
          ai: {
            apiKey: {
              encrypted,
              iv: iv.toString("hex"),
              authTag: authTag.toString("hex"),
            },
          },
        },
      });

      // Spy on database queries
      const dbSpy = vi.spyOn(supabase.from("user_preferences"), "select");

      // First request - should hit database
      await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(dbSpy).toHaveBeenCalledTimes(1);

      // Second request within cache TTL - should use cache
      await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(dbSpy).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("should invalidate cache after TTL expires", async () => {
      // Store encrypted user key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(USER_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      await supabase.from("user_preferences").insert({
        user_id: TEST_USER_ID,
        preferences: {
          ai: {
            apiKey: {
              encrypted,
              iv: iv.toString("hex"),
              authTag: authTag.toString("hex"),
            },
          },
        },
      });

      const dbSpy = vi.spyOn(supabase.from("user_preferences"), "select");

      // First request
      await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(dbSpy).toHaveBeenCalledTimes(1);

      // Fast-forward time past cache TTL (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Second request after TTL - should hit database again
      await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(dbSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("End-to-End Flow", () => {
    it("should complete full flow: store key → encrypt → retrieve → decrypt → use", async () => {
      // Step 1: Store API key via preferences endpoint
      const preferencesResponse = await testClient
        .put("/api/users/preferences")
        .send({
          ai: {
            summaryModel: "claude-3-5-haiku-20241022",
            apiKey: USER_API_KEY,
          },
        });

      expect(preferencesResponse.status).toBe(200);
      expect(preferencesResponse.body.ai.apiKey).toBe("[ENCRYPTED]"); // Masked in response

      // Step 2: Verify key is encrypted in database
      const { data: storedPrefs } = await supabase
        .from("user_preferences")
        .select("preferences")
        .eq("user_id", TEST_USER_ID)
        .single();

      expect(storedPrefs?.preferences.ai.apiKey).toHaveProperty("encrypted");
      expect(storedPrefs?.preferences.ai.apiKey).toHaveProperty("iv");
      expect(storedPrefs?.preferences.ai.apiKey).toHaveProperty("authTag");
      expect(storedPrefs?.preferences.ai.apiKey.encrypted).not.toBe(
        USER_API_KEY
      );

      // Step 3: Use key in summarization
      const anthropicSpy = vi.fn().mockResolvedValue({
        content: [{ text: "Article summary using user key" }],
      });

      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(USER_API_KEY); // Verify decrypted key
          }
          messages = {
            create: anthropicSpy,
          };
        },
      }));

      const summaryResponse = await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(summaryResponse.status).toBe(200);
      expect(summaryResponse.body.summary).toBe(
        "Article summary using user key"
      );
      expect(anthropicSpy).toHaveBeenCalled();
    });

    it("should handle API key updates correctly", async () => {
      const FIRST_KEY = "sk-ant-api03-first-key";
      const SECOND_KEY = "sk-ant-api03-second-key";

      // Store first key
      await testClient.put("/api/users/preferences").send({
        ai: { apiKey: FIRST_KEY },
      });

      // Use first key
      const anthropicConstructorSpy = vi.fn();
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            anthropicConstructorSpy(config.apiKey);
          }
          messages = {
            create: vi.fn().mockResolvedValue({
              content: [{ text: "Summary" }],
            }),
          };
        },
      }));

      await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(anthropicConstructorSpy).toHaveBeenCalledWith(FIRST_KEY);

      // Update to second key
      await testClient.put("/api/users/preferences").send({
        ai: { apiKey: SECOND_KEY },
      });

      // Cache should be invalidated, use second key
      anthropicConstructorSpy.mockClear();

      await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(anthropicConstructorSpy).toHaveBeenCalledWith(SECOND_KEY);
    });
  });

  describe("Error Handling", () => {
    it("should not expose API keys in error responses", async () => {
      // Force an error by providing invalid article ID
      const response = await testClient
        .post("/api/articles/invalid-id/summarize")
        .send({ regenerate: false });

      // Check error message doesn't contain keys
      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toContain(USER_API_KEY);
      expect(response.body.error).not.toContain(ENV_API_KEY);
      expect(response.body.error).not.toContain("sk-ant");
    });

    it("should handle Anthropic API errors gracefully", async () => {
      // Store valid encrypted key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(USER_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      await supabase.from("user_preferences").insert({
        user_id: TEST_USER_ID,
        preferences: {
          ai: {
            apiKey: {
              encrypted,
              iv: iv.toString("hex"),
              authTag: authTag.toString("hex"),
            },
          },
        },
      });

      // Mock Anthropic API error
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          messages = {
            create: vi.fn().mockRejectedValue(new Error("Rate limit exceeded")),
          };
        },
      }));

      const response = await testClient
        .post(`/api/articles/${TEST_ARTICLE_ID}/summarize`)
        .send({ regenerate: false });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain("Rate limit exceeded");
      expect(response.body.error).not.toContain(USER_API_KEY);
    });
  });
});
