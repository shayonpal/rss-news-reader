/**
 * RR-271: Health Check with Encrypted API Keys - Integration Tests
 *
 * Test Coverage:
 * 1. Health check reports key source (env vs user)
 * 2. Validates user's encrypted key if present
 * 3. Falls back to env key validation
 * 4. Reports accurate status for both sources
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestClient } from "@/test-utils/test-server";
import { createSupabaseTestClient } from "@/test-utils/supabase-test-client";
import crypto from "crypto";

describe("RR-271: Health Check with Encrypted Keys - Integration Tests", () => {
  const VALID_HEX_KEY =
    "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e3498";
  const USER_API_KEY = "sk-ant-api03-user-key-valid";
  const ENV_API_KEY = "sk-ant-api03-env-key-valid";
  const TEST_USER_ID = "health-check-user-123";

  let testClient: ReturnType<typeof createTestClient>;
  let supabase: ReturnType<typeof createSupabaseTestClient>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.TOKEN_ENCRYPTION_KEY = VALID_HEX_KEY;
    process.env.ANTHROPIC_API_KEY = ENV_API_KEY;

    testClient = createTestClient();
    supabase = createSupabaseTestClient();

    // Mock authentication for protected endpoints
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: TEST_USER_ID, email: "health@example.com" },
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

  describe("Key Source Reporting", () => {
    it("should report using environment key when no user key exists", async () => {
      // Mock successful Anthropic API validation
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(ENV_API_KEY);
          }
          models = {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "claude-3-5-haiku-20241022" }],
            }),
          };
        },
      }));

      const response = await testClient.get("/api/health/claude");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        keySource: "environment",
        keyConfigured: true,
        apiReachable: true,
        message:
          "Claude AI API is configured and reachable (using environment key)",
      });
    });

    it("should report using user key when available", async () => {
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

      // Mock Anthropic API validation with user key
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(USER_API_KEY);
          }
          models = {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "claude-3-5-haiku-20241022" }],
            }),
          };
        },
      }));

      const response = await testClient.get("/api/health/claude");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        keySource: "user",
        keyConfigured: true,
        apiReachable: true,
        message: "Claude AI API is configured and reachable (using user key)",
      });
    });

    it("should report no key available when both sources missing", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      // No user preferences stored

      const response = await testClient.get("/api/health/claude");

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: "unhealthy",
        keySource: "none",
        keyConfigured: false,
        apiReachable: false,
        error: "No API key configured",
        message:
          "Claude AI API key not configured in environment or user settings",
      });
    });
  });

  describe("Key Validation", () => {
    it("should validate user key and report invalid key", async () => {
      // Store encrypted user key
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      const INVALID_KEY = "invalid-api-key";
      let encrypted = cipher.update(INVALID_KEY, "utf8", "hex");
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

      // Mock Anthropic API rejection
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(INVALID_KEY);
          }
          models = {
            list: vi.fn().mockRejectedValue(new Error("Invalid API key")),
          };
        },
      }));

      const response = await testClient.get("/api/health/claude");

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: "unhealthy",
        keySource: "user",
        keyConfigured: true,
        apiReachable: false,
        error: "Invalid API key",
        message: "Claude AI API key is configured but invalid (user key)",
      });
    });

    it("should fallback to env key when user key decryption fails", async () => {
      // Store corrupted encrypted data
      await supabase.from("user_preferences").insert({
        user_id: TEST_USER_ID,
        preferences: {
          ai: {
            apiKey: {
              encrypted: "corrupted-data",
              iv: "bad-iv",
              authTag: "bad-tag",
            },
          },
        },
      });

      // Mock Anthropic API with env key
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor(config: any) {
            expect(config.apiKey).toBe(ENV_API_KEY); // Fallback to env
          }
          models = {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "claude-3-5-haiku-20241022" }],
            }),
          };
        },
      }));

      const response = await testClient.get("/api/health/claude");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        keySource: "environment",
        keyConfigured: true,
        apiReachable: true,
        warning: "User key decryption failed, using environment key",
      });
    });
  });

  describe("Performance Monitoring", () => {
    it("should include decryption time in health metrics", async () => {
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

      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          models = {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "claude-3-5-haiku-20241022" }],
            }),
          };
        },
      }));

      const response = await testClient.get("/api/health/claude");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("metrics");
      expect(response.body.metrics).toMatchObject({
        decryptionTime: expect.any(Number),
        apiValidationTime: expect.any(Number),
        totalTime: expect.any(Number),
      });

      // Performance requirements
      expect(response.body.metrics.decryptionTime).toBeLessThan(5); // < 5ms
      expect(response.body.metrics.totalTime).toBeLessThan(1000); // < 1s total
    });

    it("should use cached decryption for repeated health checks", async () => {
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

      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          models = {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "claude-3-5-haiku-20241022" }],
            }),
          };
        },
      }));

      // First health check - decrypts key
      const response1 = await testClient.get("/api/health/claude");
      expect(response1.body.metrics.decryptionTime).toBeGreaterThan(0);

      // Second health check - should use cache
      const response2 = await testClient.get("/api/health/claude");
      expect(response2.body.metrics.decryptionTime).toBeLessThan(1); // < 1ms from cache
      expect(response2.body.metrics.cacheHit).toBe(true);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle database connection errors gracefully", async () => {
      // Mock database error
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await testClient.get("/api/health/claude");

      // Should fallback to env key
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "healthy",
        keySource: "environment",
        warning: "Could not check user preferences: Database connection failed",
      });
    });

    it("should handle rate limiting from Anthropic API", async () => {
      // Store valid user key
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

      // Mock rate limit error
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          models = {
            list: vi.fn().mockRejectedValue({
              status: 429,
              message: "Rate limit exceeded",
            }),
          };
        },
      }));

      const response = await testClient.get("/api/health/claude");

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: "unhealthy",
        keySource: "user",
        keyConfigured: true,
        apiReachable: false,
        error: "Rate limit exceeded",
        retryAfter: expect.any(Number),
      });
    });

    it("should not expose API keys in error logs", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Force an error
      vi.mock("@anthropic-ai/sdk", () => ({
        default: class Anthropic {
          constructor() {
            throw new Error(`API Error with key: ${USER_API_KEY}`);
          }
        },
      }));

      await testClient.get("/api/health/claude");

      // Check console.error was called but without API key
      expect(consoleSpy).toHaveBeenCalled();
      const errorCalls = consoleSpy.mock.calls.flat().join(" ");
      expect(errorCalls).not.toContain(USER_API_KEY);
      expect(errorCalls).not.toContain(ENV_API_KEY);
      expect(errorCalls).not.toContain("sk-ant");
    });
  });

  describe("Status Aggregation", () => {
    it("should aggregate status across all health checks", async () => {
      // Get main health endpoint which aggregates all checks
      const response = await testClient.get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("claude");
      expect(response.body.claude).toMatchObject({
        status: expect.stringMatching(/healthy|unhealthy/),
        keySource: expect.stringMatching(/environment|user|none/),
        keyConfigured: expect.any(Boolean),
      });
    });
  });
});
