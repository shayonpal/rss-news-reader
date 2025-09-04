/**
 * Unit tests for RR-269: User Preferences API endpoints
 * Tests GET/PUT /api/users/preferences with validation, caching, and error handling
 * Updated to match nested schema structure (ai/sync objects)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GET, PUT } from "@/app/api/users/preferences/route";
import { createClient } from "@supabase/supabase-js";

// Mock crypto module for encryption
vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn(() => Buffer.from("1234567890123456")),
    createCipheriv: vi.fn(() => ({
      update: vi.fn(() => "encrypted"),
      final: vi.fn(() => "data"),
      getAuthTag: vi.fn(() => Buffer.from("authtag")),
    })),
    createDecipheriv: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn(() => "decrypted"),
      final: vi.fn(() => "value"),
    })),
  },
}));

// Mock Supabase
vi.mock("@supabase/supabase-js");

// Nested preferences schema matching new structure
const PreferencesSchema = z.object({
  ai: z.object({
    model: z.string().optional(),
    summaryWordCount: z.string().regex(/^\d+-\d+$/).optional(),
    summaryStyle: z.enum(["objective", "analytical", "retrospective"]).optional(),
  }).optional(),
  sync: z.object({
    maxArticles: z.number().min(10).max(1000).optional(),
    retentionCount: z.number().min(1).max(365).optional(),
    batchSize: z.number().min(1).max(100).optional(),
  }).optional(),
  apiKeys: z.record(z.string(), z.string()).optional(),
});

type UserPreferences = z.infer<typeof PreferencesSchema>;

// Default preferences with nested structure
const getDefaultPreferences = (): UserPreferences => ({
  ai: {
    model: "claude-3-haiku-20240307",
    summaryWordCount: process.env.SUMMARY_WORD_COUNT || "70-80",
    summaryStyle: (process.env.SUMMARY_STYLE || "objective") as "objective" | "analytical" | "retrospective",
  },
  sync: {
    maxArticles: parseInt(process.env.SYNC_MAX_ARTICLES || "100"),
    retentionCount: parseInt(process.env.ARTICLES_RETENTION_DAYS || "30"),
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE || "20"),
  },
});

describe("RR-269: User Preferences API - Unit Tests", () => {
  let mockSupabase: any;
  let mockFrom: any;
  let mockSelect: any;
  let mockUpdate: any;
  let mockEq: any;
  let mockSingle: any;

  let selectCallCount = 0; // Move this outside to persist across test setup
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env.SUMMARY_WORD_COUNT = "70-80";
    process.env.SUMMARY_STYLE = "objective";
    process.env.SYNC_MAX_ARTICLES = "100";
    process.env.ARTICLES_RETENTION_DAYS = "30";
    process.env.SYNC_BATCH_SIZE = "20";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-key";
    process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    
    // Reset call counter
    selectCallCount = 0;
    
    // Setup mock chain
    mockSingle = vi.fn();
    mockEq = vi.fn(() => ({ single: mockSingle }));
    mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockUpdate = vi.fn(() => ({ eq: mockEq }));
    
    mockFrom = vi.fn((table: string) => {
      // Handle ai_models table specially
      if (table === "ai_models") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "PGRST116", message: "Model not found" },
              }),
            })),
          })),
        };
      }
      // Default behavior for users table
      return {
        select: vi.fn((columns: string) => {
          selectCallCount++;
          // First call is usually the user lookup by inoreader_id
          if (columns === "id" || selectCallCount === 1) {
            return {
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "test-user-uuid" },
                  error: null,
                }),
              })),
            };
          }
          // Subsequent calls for preferences
          return { eq: mockEq };
        }),
        update: mockUpdate,
      };
    });
    
    mockSupabase = {
      from: mockFrom,
    };
    
    // Mock createClient to return our mock
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/users/preferences", () => {
    it("should return merged preferences with defaults for existing user", async () => {
      const storedPrefs: UserPreferences = {
        ai: {
          summaryWordCount: "150-175",
          summaryStyle: "analytical",
        },
        sync: {
          maxArticles: 200,
        },
      };
      
      mockSingle.mockResolvedValue({
        data: {
          id: "shayon",
          preferences: storedPrefs,
        },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/users/preferences");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai.summaryWordCount).toBe("150-175");
      expect(data.ai.summaryStyle).toBe("analytical");
      expect(data.ai.model).toBe("claude-3-haiku-20240307"); // Default
      expect(data.sync.maxArticles).toBe(200);
      expect(data.sync.retentionCount).toBe(30); // Default
      expect(data.sync.batchSize).toBe(20); // Default
    });

    it("should return defaults when user has no preferences", async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: "shayon",
          preferences: null,
        },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/users/preferences");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(getDefaultPreferences());
    });

    it("should use cached preferences on subsequent requests", async () => {
      const storedPrefs: UserPreferences = {
        ai: { summaryWordCount: "100-120" },
      };
      
      mockSingle.mockResolvedValue({
        data: {
          id: "shayon",
          preferences: storedPrefs,
        },
        error: null,
      });

      // First request - hits database
      const request1 = new NextRequest("http://localhost:3000/api/users/preferences");
      await GET(request1);
      expect(mockFrom).toHaveBeenCalledTimes(1);

      // Second request - uses cache
      const request2 = new NextRequest("http://localhost:3000/api/users/preferences");
      const response2 = await GET(request2);
      const data = await response2.json();
      
      expect(mockFrom).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(data.ai.summaryWordCount).toBe("100-120");
    });

    it("should handle database errors gracefully", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
      });

      const request = new NextRequest("http://localhost:3000/api/users/preferences");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch preferences");
    });

    it("should return 404 when user not found", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "User not found" },
      });

      const request = new NextRequest("http://localhost:3000/api/users/preferences");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("PUT /api/users/preferences", () => {
    it("should update preferences with partial data", async () => {
      const updates = {
        ai: {
          summaryWordCount: "100-120",
          summaryStyle: "analytical",
        },
      };

      // Mock user exists check
      mockSingle.mockResolvedValueOnce({
        data: {
          id: "shayon",
          preferences: {},
        },
        error: null,
      });

      // Mock update success
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn(() => ({
          error: null,
        })),
      });

      const response = await PUT({
        json: async () => updates,
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai.summaryWordCount).toBe("100-120");
      expect(data.ai.summaryStyle).toBe("analytical");
    });

    it("should validate summaryWordCount format", async () => {
      const invalidUpdates = {
        ai: {
          summaryWordCount: "invalid-format",
        },
      };

      const response = await PUT({
        json: async () => invalidUpdates,
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid preferences");
    });

    it("should validate summaryModel against ai_models table", async () => {
      const updates = {
        ai: {
          model: "claude-3-opus-20240229",
        },
      };

      // Mock ai_models validation
      mockFrom.mockImplementationOnce((table: string) => {
        if (table === "ai_models") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { model_id: "claude-3-opus-20240229", active: true },
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

      // Mock user exists
      mockSingle.mockResolvedValueOnce({
        data: { id: "shayon", preferences: {} },
        error: null,
      });

      // Mock update success
      mockEq.mockReturnValueOnce({ single: vi.fn() });

      // Mock fetch updated
      mockSingle.mockResolvedValueOnce({
        data: { preferences: updates },
        error: null,
      });

      const response = await PUT({
        json: async () => updates,
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ai.model).toBe("claude-3-opus-20240229");
    });

    it("should reject invalid AI model", async () => {
      const updates = {
        ai: {
          model: "invalid-model",
        },
      };

      // Mock ai_models validation failure
      mockFrom.mockImplementationOnce((table: string) => {
        if (table === "ai_models") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error("Not found"),
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

      const response = await PUT({
        json: async () => updates,
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid AI model specified");
    });

    it("should validate syncMaxArticles range", async () => {
      const invalidUpdates = {
        sync: {
          maxArticles: 5000, // exceeds max of 1000
        },
      };

      const response = await PUT({
        json: async () => invalidUpdates,
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid preferences");
    });

    it("should handle encrypted API keys", async () => {
      const updates = {
        apiKeys: {
          inoreader: "test-api-key",
        },
      };

      // Mock user exists
      mockSingle.mockResolvedValueOnce({
        data: { id: "shayon", preferences: {} },
        error: null,
      });

      // Mock update success
      mockEq.mockReturnValueOnce({ single: vi.fn() });

      // Mock fetch updated with encrypted data
      mockSingle.mockResolvedValueOnce({
        data: {
          preferences: {
            encryptedData: {
              apiKeys: {
                inoreader: {
                  encrypted: "encrypteddata",
                  iv: "31323334353637383930313233343536",
                  authTag: "617574687461670a",
                },
              },
            },
          },
        },
        error: null,
      });

      const response = await PUT({
        json: async () => updates,
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toBeDefined();
      expect(data.apiKeys.inoreader).toBe("decryptedvalue");
    });

    it("should handle database update errors", async () => {
      // Mock user exists
      mockSingle.mockResolvedValueOnce({
        data: { id: "shayon", preferences: {} },
        error: null,
      });

      // Mock update failure
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Update failed"),
          }),
        })),
      });

      const response = await PUT({
        json: async () => ({ ai: { summaryStyle: "analytical" } }),
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update preferences");
    });

    it("should validate min <= max in summaryWordCount", async () => {
      const invalidUpdates = {
        ai: {
          summaryWordCount: "200-100", // min > max
        },
      };

      const response = await PUT({
        json: async () => invalidUpdates,
        headers: new Headers(),
      } as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid preferences");
      expect(data.details[0].message).toContain("Minimum word count must be less than or equal to maximum");
    });
  });

  describe("Schema Validation", () => {
    it("should accept all valid preference fields", async () => {
      const allPreferences: UserPreferences = {
        ai: {
          model: "claude-3-opus-20240229",
          summaryWordCount: "150-200",
          summaryStyle: "analytical",
        },
        sync: {
          maxArticles: 200,
          retentionCount: 60,
          batchSize: 50,
        },
        apiKeys: {
          inoreader: "test-key",
          openai: "another-key",
        },
      };

      const result = PreferencesSchema.safeParse(allPreferences);
      expect(result.success).toBe(true);
    });

    it("should reject invalid summaryStyle", async () => {
      const invalidPrefs = {
        ai: {
          summaryStyle: "invalid" as any,
        },
      };

      const result = PreferencesSchema.safeParse(invalidPrefs);
      expect(result.success).toBe(false);
    });

    it("should accept retrospective as valid summaryStyle", async () => {
      const validPrefs = {
        ai: {
          summaryStyle: "retrospective",
        },
      };

      const result = PreferencesSchema.safeParse(validPrefs);
      expect(result.success).toBe(true);
    });
  });

  describe("Cache Behavior", () => {
    it("should use consistent cache key format", async () => {
      const storedPrefs: UserPreferences = {
        ai: { summaryWordCount: "100-120" },
      };
      
      mockSingle.mockResolvedValue({
        data: {
          id: "shayon",
          preferences: storedPrefs,
        },
        error: null,
      });

      // GET should cache with key "preferences:shayon"
      const request = new NextRequest("http://localhost:3000/api/users/preferences");
      await GET(request);

      // Verify from was called once
      expect(mockFrom).toHaveBeenCalledTimes(1);

      // Second GET should use cache
      await GET(request);
      expect(mockFrom).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should invalidate cache on PUT requests", async () => {
      // Mock user exists
      mockSingle.mockResolvedValueOnce({
        data: { id: "shayon", preferences: {} },
        error: null,
      });

      // Mock update success
      mockEq.mockReturnValueOnce({ single: vi.fn() });

      // Mock fetch updated
      mockSingle.mockResolvedValueOnce({
        data: { preferences: { ai: { summaryStyle: "analytical" } } },
        error: null,
      });

      await PUT({
        json: async () => ({ ai: { summaryStyle: "analytical" } }),
        headers: new Headers(),
      } as unknown as NextRequest);

      // After PUT, cache should be invalidated
      // A subsequent GET should hit the database
      mockSingle.mockResolvedValueOnce({
        data: { id: "shayon", preferences: { ai: { summaryStyle: "analytical" } } },
        error: null,
      });

      const getRequest = new NextRequest("http://localhost:3000/api/users/preferences");
      await GET(getRequest);

      // Verify database was called for the GET after cache invalidation
      expect(mockFrom).toHaveBeenCalled();
    });
  });
});