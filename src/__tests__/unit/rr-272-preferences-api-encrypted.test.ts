/**
 * Unit tests for RR-272: User Preferences API with Encryption
 * Tests GET/PUT /api/users/[id]/preferences with deterministic PBKDF2 encryption
 *
 * Features tested:
 * - Deterministic PBKDF2 key derivation
 * - User ID-based routing
 * - API key encryption/decryption
 * - New schema structure (summaryLengthMin/Max, contentFocus, model)
 * - Cache behavior with user-specific keys
 * - ai_models table integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GET, PUT } from "@/app/api/users/[id]/preferences/route";
import { createClient } from "@/lib/supabase/server";

// Mock crypto module for deterministic encryption testing
vi.mock("crypto", () => ({
  default: {
    // Mock deterministic PBKDF2 functions
    pbkdf2Sync: vi.fn((content: string, salt: Buffer) => {
      // Return deterministic IV based on content for testing
      return Buffer.from(content.slice(0, 16).padEnd(16, "0"), "utf8");
    }),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => Buffer.from("deterministic-hash-32bytes-long")),
    })),
    // Encryption functions
    createCipheriv: vi.fn(() => ({
      update: vi.fn(() => "encrypted"),
      final: vi.fn(() => "data"),
      getAuthTag: vi.fn(() => Buffer.from("authtag")),
    })),
    createDecipheriv: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn(() => "sk-ant-test"),
      final: vi.fn(() => "-key-123"),
    })),
    randomBytes: vi.fn(() => Buffer.from("1234567890123456")), // Not used in deterministic mode
  },
}));

// Mock Supabase server wrapper
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// RR-272 Schema - matches actual implementation
const AiPreferencesSchema = z.object({
  model: z.string().optional(),
  summaryLengthMin: z.number().int().min(50).max(500).optional(),
  summaryLengthMax: z.number().int().min(50).max(500).optional(),
  summaryStyle: z
    .enum(["objective", "analytical", "concise", "detailed"])
    .optional(),
  contentFocus: z
    .enum(["general", "technical", "business", "educational"])
    .nullable()
    .optional(),
  hasApiKey: z.boolean().optional(),
});

const SyncPreferencesSchema = z.object({
  maxArticles: z.number().int().min(10).max(5000).optional(),
  retentionCount: z.number().int().min(1).max(365).optional(),
});

const PreferencesResponseSchema = z
  .object({
    ai: AiPreferencesSchema.optional(),
    sync: SyncPreferencesSchema.optional(),
  })
  .strict();

type PreferencesResponse = z.infer<typeof PreferencesResponseSchema>;

describe("RR-272: User Preferences API with Encryption", () => {
  let mockSupabase: any;
  let mockFrom: any;
  let mockSelect: any;
  let mockUpdate: any;
  let mockEq: any;
  let mockSingle: any;

  // Helper to create params for route handler
  const createParams = (id: string = "test-user-id") => ({
    params: { id },
  });

  // Helper to create mock request
  const createRequest = (url?: string) => {
    return new NextRequest(
      url || "http://localhost:3000/api/users/test-user-id/preferences"
    );
  };

  // Helper for PUT requests
  const createPutRequest = (data: any) => {
    return {
      json: async () => data,
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables matching RR-272
    process.env.TOKEN_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.DEFAULT_SUMMARY_MODEL = "claude-3-haiku-20240307";
    process.env.SUMMARY_LENGTH_MIN = "100";
    process.env.SUMMARY_LENGTH_MAX = "300";
    process.env.SUMMARY_STYLE = "objective";
    process.env.SUMMARY_CONTENT_FOCUS = "general";
    process.env.SYNC_MAX_ARTICLES = "500";
    process.env.ARTICLES_RETENTION_DAYS = "30";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-key";

    // Set up Supabase mocks
    mockSingle = vi.fn();
    mockEq = vi.fn(() => ({ single: mockSingle }));
    mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockUpdate = vi.fn(() => ({ eq: mockEq }));

    mockFrom = vi.fn((table: string) => {
      if (table === "ai_models") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { model_id: "claude-3-haiku-20240307" },
                error: null,
              }),
            })),
          })),
        };
      }

      return {
        select: mockSelect,
        update: mockUpdate,
      };
    });

    mockSupabase = {
      from: mockFrom,
    };

    (createClient as any).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/users/[id]/preferences", () => {
    it("should return default preferences for new user", async () => {
      // Mock user with no preferences
      mockSingle.mockResolvedValue({
        data: { preferences: null },
        error: null,
      });

      const request = createRequest();
      const response = await GET(request, createParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        ai: {
          hasApiKey: false,
          model: "claude-3-haiku-20240307",
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: "objective",
          contentFocus: "general",
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      });
    });

    it("should return merged preferences with encrypted API key status", async () => {
      // Mock user with preferences including encrypted API key
      const storedPrefs = {
        ai: {
          model: "claude-3-sonnet-20240229",
          summaryLengthMin: 150,
          summaryLengthMax: 250,
          summaryStyle: "analytical",
          contentFocus: "technical",
        },
        sync: {
          maxArticles: 1000,
          retentionCount: 60,
        },
        encryptedData: {
          apiKeys: {
            anthropic: {
              encrypted: "encrypteddata",
              iv: "mockiv",
              authTag: "mocktag",
            },
          },
        },
      };

      mockSingle.mockResolvedValue({
        data: { preferences: storedPrefs },
        error: null,
      });

      const request = createRequest();
      // Fix: Use unique user ID to avoid cache conflicts
      const response = await GET(
        request,
        createParams("user-with-encrypted-api-key")
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai?.hasApiKey).toBe(true);
      expect(data.ai?.model).toBe("claude-3-sonnet-20240229");
      expect(data.ai?.summaryLengthMin).toBe(150);
      expect(data.ai?.summaryLengthMax).toBe(250);
      expect(data.ai?.summaryStyle).toBe("analytical");
      expect(data.ai?.contentFocus).toBe("technical");

      // API key should NOT be in response (security)
      expect(data.ai?.apiKey).toBeUndefined();
    });

    it("should handle invalid user ID", async () => {
      const request = createRequest();
      const response = await GET(request, createParams(""));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("User ID is required");
    });

    it("should return 404 for non-existent user", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "No rows returned" },
      });

      const request = createRequest();
      const response = await GET(request, createParams("nonexistent"));

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("User not found");
    });
  });

  describe("PUT /api/users/[id]/preferences", () => {
    beforeEach(() => {
      // Mock successful user lookup and update
      mockSingle
        .mockResolvedValueOnce({
          data: { preferences: {} },
          error: null,
        })
        .mockResolvedValue({
          data: null,
          error: null,
        });
    });

    it("should update AI preferences with new structure", async () => {
      const updates = {
        ai: {
          model: "claude-3-opus-20240229",
          summaryLengthMin: 200,
          summaryLengthMax: 400,
          summaryStyle: "detailed" as const,
          contentFocus: "technical" as const,
        },
      };

      const request = createPutRequest(updates);
      const response = await PUT(request, createParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai?.model).toBe("claude-3-opus-20240229");
      expect(data.ai?.summaryLengthMin).toBe(200);
      expect(data.ai?.summaryLengthMax).toBe(400);
      expect(data.ai?.summaryStyle).toBe("detailed");
      expect(data.ai?.contentFocus).toBe("technical");
    });

    it("should validate summaryLength range constraints", async () => {
      const invalidUpdates = {
        ai: {
          summaryLengthMin: 600, // Above max of 500
          summaryLengthMax: 750,
        },
      };

      const request = createPutRequest(invalidUpdates);
      const response = await PUT(request, createParams());

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("UNPROCESSABLE_ENTITY");
    });

    it("should validate contentFocus enum values", async () => {
      const invalidUpdates = {
        ai: {
          contentFocus: "invalid-focus",
        },
      };

      const request = createPutRequest(invalidUpdates);
      const response = await PUT(request, createParams());

      expect(response.status).toBe(422);
    });

    it("should validate model against ai_models table", async () => {
      // Mock user preferences fetch first
      mockSingle.mockResolvedValueOnce({
        data: { preferences: {} },
        error: null,
      });

      // Mock model validation failure - need to override the entire mockFrom for this test
      const originalMockFrom = mockFrom;
      mockFrom.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === "ai_models") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116" },
                }),
              })),
            })),
          };
        }
        return originalMockFrom(table);
      });

      const updates = {
        ai: {
          model: "invalid-model-id",
        },
      };

      const request = createPutRequest(updates);
      const response = await PUT(request, createParams());

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("INVALID_MODEL");
    });
  });

  describe("API Key Encryption", () => {
    beforeEach(() => {
      mockSingle
        .mockResolvedValueOnce({
          data: { preferences: {} },
          error: null,
        })
        .mockResolvedValue({
          data: null,
          error: null,
        });
    });

    it("should encrypt API key using deterministic PBKDF2", async () => {
      const updates = {
        ai: {
          apiKeyChange: "replace" as const,
          apiKey: "sk-ant-test-key-123456",
        },
      };

      const request = createPutRequest(updates);
      const response = await PUT(request, createParams());

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should indicate API key is present
      expect(data.ai?.hasApiKey).toBe(true);

      // Should NOT return the actual key (security)
      expect(data.ai?.apiKey).toBeUndefined();

      // Verify encryption was called
      const mockCrypto = await import("crypto");
      expect(mockCrypto.default.pbkdf2Sync).toHaveBeenCalled();
    });

    it("should clear API key when requested", async () => {
      // Start with existing encrypted key
      mockSingle.mockResolvedValueOnce({
        data: {
          preferences: {
            encryptedData: {
              apiKeys: {
                anthropic: { encrypted: "existing", iv: "iv", authTag: "tag" },
              },
            },
          },
        },
        error: null,
      });

      const updates = {
        ai: {
          apiKeyChange: "clear" as const,
        },
      };

      const request = createPutRequest(updates);
      const response = await PUT(request, createParams());

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should indicate no API key
      expect(data.ai?.hasApiKey).toBe(false);
    });

    it("should handle invalid API key format", async () => {
      // Test what happens when we provide invalid key format
      const updates = {
        ai: {
          apiKeyChange: "replace" as const,
          apiKey: null, // Invalid key format
        },
      };

      const request = createPutRequest(updates);
      const response = await PUT(request, createParams());

      // The actual implementation throws internal error when encryption fails
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe("INTERNAL_ERROR");
      expect(data.message).toBe("Failed to update preferences");
    });
  });

  describe("Cache Behavior", () => {
    it("should use user-specific cache keys", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";

      // Mock different preferences for different users
      mockSingle
        .mockResolvedValueOnce({
          data: { preferences: { ai: { summaryLengthMin: 100 } } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { preferences: { ai: { summaryLengthMin: 200 } } },
          error: null,
        });

      // First user request
      const request1 = createRequest(
        `http://localhost:3000/api/users/${userId1}/preferences`
      );
      const response1 = await GET(request1, createParams(userId1));
      const data1 = await response1.json();

      // Second user request
      const request2 = createRequest(
        `http://localhost:3000/api/users/${userId2}/preferences`
      );
      const response2 = await GET(request2, createParams(userId2));
      const data2 = await response2.json();

      // Should have different data for different users
      expect(data1.ai?.summaryLengthMin).toBe(100);
      expect(data2.ai?.summaryLengthMin).toBe(200);

      // Should have called database twice (different cache keys)
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("should generate consistent ETags for same preferences", async () => {
      mockSingle.mockResolvedValue({
        data: { preferences: { ai: { summaryLengthMin: 150 } } },
        error: null,
      });

      const request = createRequest();
      const response1 = await GET(request, createParams());
      const response2 = await GET(request, createParams());

      const etag1 = response1.headers.get("ETag");
      const etag2 = response2.headers.get("ETag");

      expect(etag1).toBe(etag2);
      expect(etag1).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      // Mock database query failure directly
      mockSingle.mockRejectedValue(new Error("Database connection failed"));

      const request = createRequest();
      const response = await GET(request, createParams("user-with-db-error"));

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to retrieve preferences");
    });

    it("should validate request body size", async () => {
      const largeRequest = {
        ...createPutRequest({}),
        headers: new Headers({ "content-length": "20000" }), // Exceeds 10KB limit
      } as unknown as NextRequest;

      const response = await PUT(largeRequest, createParams());

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toBe("Request too large");
    });

    it("should handle invalid JSON in request body", async () => {
      const invalidRequest = {
        json: async () => {
          throw new SyntaxError("Invalid JSON");
        },
        headers: new Headers(),
      } as unknown as NextRequest;

      const response = await PUT(invalidRequest, createParams());

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid request format");
    });
  });
});
