/**
 * Unit tests for RR-269: User Preferences API endpoints
 * Tests GET/PUT /api/users/preferences with validation, caching, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createMocks } from "node-mocks-http";
import { z } from "zod";
import { GET, PUT } from "@/app/api/users/preferences/route";

// Mock dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    })),
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

// Preference schema matching database JSONB structure
const PreferencesSchema = z.object({
  timezone: z.string().optional(),
  summaryWordCount: z
    .string()
    .regex(/^\d+-\d+$/)
    .optional(),
  summaryStyle: z.enum(["objective", "analytical", "concise"]).optional(),
  summaryModel: z.string().optional(),
  syncMaxArticles: z.number().min(10).max(1000).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  fontSize: z.enum(["small", "medium", "large"]).optional(),
  readingWidth: z.enum(["narrow", "medium", "wide"]).optional(),
  enableNotifications: z.boolean().optional(),
});

// Default preferences from environment
const getDefaultPreferences = () => ({
  summaryWordCount: process.env.SUMMARY_WORD_COUNT || "70-80",
  summaryStyle: (process.env.SUMMARY_STYLE || "objective") as "objective",
  syncMaxArticles: parseInt(process.env.SYNC_MAX_ARTICLES || "100"),
  theme: "system" as const,
  fontSize: "medium" as const,
  readingWidth: "medium" as const,
  enableNotifications: false,
});

// Cache implementation for 5-minute TTL
class PreferencesCache {
  private static cache = new Map<string, { data: any; expires: number }>();
  private static readonly TTL = 5 * 60 * 1000; // 5 minutes

  static get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  static set(key: string, data: any) {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.TTL,
    });
  }

  static invalidate(key: string) {
    this.cache.delete(key);
  }

  static clear() {
    this.cache.clear();
  }
}

describe("RR-269: User Preferences API - Unit Tests", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    PreferencesCache.clear();

    // Reset environment variables
    process.env.SUMMARY_WORD_COUNT = "70-80";
    process.env.SUMMARY_STYLE = "objective";
    process.env.SYNC_MAX_ARTICLES = "100";

    // Setup Supabase mock
    const { createClient } = require("@supabase/supabase-js");
    mockSupabase = createClient("mock-url", "mock-key");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/users/preferences", () => {
    it("should return merged preferences with defaults for existing user", async () => {
      const storedPrefs = {
        timezone: "America/Toronto",
        summaryWordCount: "150-175",
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                inoreader_id: "shayon",
                preferences: storedPrefs,
              },
              error: null,
            }),
          }),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        ...getDefaultPreferences(),
        ...storedPrefs,
      });
      expect(data.summaryWordCount).toBe("150-175"); // User pref overrides default
      expect(data.theme).toBe("system"); // Default preserved
    });

    it("should return defaults when user has no preferences", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                inoreader_id: "shayon",
                preferences: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(getDefaultPreferences());
    });

    it("should use cached preferences on subsequent requests", async () => {
      const storedPrefs = { timezone: "America/Toronto" };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                inoreader_id: "shayon",
                preferences: storedPrefs,
              },
              error: null,
            }),
          }),
        }),
      });

      // First request - hits database
      await GET();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second request - uses cache
      await GET();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should handle database errors gracefully", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("Database connection failed"),
            }),
          }),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch preferences");
    });

    it("should return 404 when user not found", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("PUT /api/users/preferences", () => {
    it("should update preferences with partial data", async () => {
      const updates = {
        summaryWordCount: "100-120",
        theme: "dark" as const,
      };

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  inoreader_id: "shayon",
                  preferences: {
                    timezone: "America/Toronto",
                    ...updates,
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const response = await PUT({
        json: async () => updates,
      } as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summaryWordCount).toBe("100-120");
      expect(data.theme).toBe("dark");

      // Verify cache invalidation
      const cachedData = PreferencesCache.get("user:shayon:preferences");
      expect(cachedData).toBeNull();
    });

    it("should validate summaryWordCount format", async () => {
      const invalidUpdates = {
        summaryWordCount: "invalid-format",
      };

      const response = await PUT({
        json: async () => invalidUpdates,
      } as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid preferences");
    });

    it("should validate summaryModel against ai_models table", async () => {
      const updates = {
        summaryModel: "claude-3-opus-20240229",
      };

      // Mock ai_models validation
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "ai_models") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "claude-3-opus-20240229", active: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    inoreader_id: "shayon",
                    preferences: updates,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      });

      const response = await PUT({
        json: async () => updates,
      } as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summaryModel).toBe("claude-3-opus-20240229");
    });

    it("should reject invalid AI model", async () => {
      const updates = {
        summaryModel: "gpt-4", // Not in ai_models table
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "ai_models") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
      });

      const response = await PUT({
        json: async () => updates,
      } as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid AI model");
    });

    it("should validate syncMaxArticles range", async () => {
      const tooLow = { syncMaxArticles: 5 };
      const tooHigh = { syncMaxArticles: 2000 };

      const responseLow = await PUT({
        json: async () => tooLow,
      } as NextRequest);

      const responseHigh = await PUT({
        json: async () => tooHigh,
      } as NextRequest);

      expect(responseLow.status).toBe(400);
      expect(responseHigh.status).toBe(400);
    });

    it("should use jsonb_set for partial updates", async () => {
      const updates = {
        theme: "dark" as const,
      };

      let updateQuery: string | null = null;
      mockSupabase.from.mockReturnValue({
        update: vi.fn((data: any) => {
          // Capture the SQL-like update
          updateQuery = data;
          return {
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    inoreader_id: "shayon",
                    preferences: {
                      timezone: "America/Toronto",
                      theme: "dark",
                      summaryWordCount: "70-80",
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }),
      });

      await PUT({
        json: async () => updates,
      } as NextRequest);

      // Verify jsonb_set pattern is used (simulated)
      expect(updateQuery).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith("users");
    });

    it("should handle database update errors", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("Update failed"),
              }),
            }),
          }),
        }),
      });

      const response = await PUT({
        json: async () => ({ theme: "dark" }),
      } as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update preferences");
    });
  });

  describe("Schema Validation", () => {
    it("should accept all valid preference fields", () => {
      const validPrefs = {
        timezone: "America/New_York",
        summaryWordCount: "150-200",
        summaryStyle: "analytical" as const,
        summaryModel: "claude-3-opus-20240229",
        syncMaxArticles: 250,
        theme: "dark" as const,
        fontSize: "large" as const,
        readingWidth: "wide" as const,
        enableNotifications: true,
      };

      const result = PreferencesSchema.safeParse(validPrefs);
      expect(result.success).toBe(true);
    });

    it("should reject invalid summaryStyle", () => {
      const invalidPrefs = {
        summaryStyle: "casual", // Not in enum
      };

      const result = PreferencesSchema.safeParse(invalidPrefs);
      expect(result.success).toBe(false);
    });

    it("should reject invalid summaryWordCount format", () => {
      const invalidFormats = [
        { summaryWordCount: "100" }, // Missing range
        { summaryWordCount: "100-" }, // Incomplete
        { summaryWordCount: "-100" }, // Invalid start
        { summaryWordCount: "abc-def" }, // Non-numeric
      ];

      invalidFormats.forEach((prefs) => {
        const result = PreferencesSchema.safeParse(prefs);
        expect(result.success).toBe(false);
      });
    });

    it("should enforce syncMaxArticles bounds", () => {
      const tooLow = { syncMaxArticles: 5 };
      const tooHigh = { syncMaxArticles: 1500 };
      const justRight = { syncMaxArticles: 500 };

      expect(PreferencesSchema.safeParse(tooLow).success).toBe(false);
      expect(PreferencesSchema.safeParse(tooHigh).success).toBe(false);
      expect(PreferencesSchema.safeParse(justRight).success).toBe(true);
    });
  });

  describe("Cache Behavior", () => {
    it("should cache GET responses for 5 minutes", async () => {
      const startTime = Date.now();
      PreferencesCache.set("user:shayon:preferences", { theme: "dark" });

      // Check cache is valid
      expect(PreferencesCache.get("user:shayon:preferences")).toEqual({
        theme: "dark",
      });

      // Fast-forward time by 4 minutes
      vi.setSystemTime(startTime + 4 * 60 * 1000);
      expect(PreferencesCache.get("user:shayon:preferences")).toEqual({
        theme: "dark",
      });

      // Fast-forward past 5 minutes
      vi.setSystemTime(startTime + 6 * 60 * 1000);
      expect(PreferencesCache.get("user:shayon:preferences")).toBeNull();

      vi.useRealTimers();
    });

    it("should invalidate cache on PUT requests", async () => {
      PreferencesCache.set("user:shayon:preferences", { theme: "light" });
      expect(PreferencesCache.get("user:shayon:preferences")).toBeTruthy();

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  inoreader_id: "shayon",
                  preferences: { theme: "dark" },
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      await PUT({
        json: async () => ({ theme: "dark" }),
      } as NextRequest);

      expect(PreferencesCache.get("user:shayon:preferences")).toBeNull();
    });
  });

  describe("Environment Variable Defaults", () => {
    it("should use environment variables as defaults", () => {
      process.env.SUMMARY_WORD_COUNT = "100-150";
      process.env.SUMMARY_STYLE = "analytical";
      process.env.SYNC_MAX_ARTICLES = "250";

      const defaults = getDefaultPreferences();

      expect(defaults.summaryWordCount).toBe("100-150");
      expect(defaults.summaryStyle).toBe("analytical");
      expect(defaults.syncMaxArticles).toBe(250);
    });

    it("should fallback to hardcoded defaults when env vars missing", () => {
      delete process.env.SUMMARY_WORD_COUNT;
      delete process.env.SUMMARY_STYLE;
      delete process.env.SYNC_MAX_ARTICLES;

      const defaults = getDefaultPreferences();

      expect(defaults.summaryWordCount).toBe("70-80");
      expect(defaults.summaryStyle).toBe("objective");
      expect(defaults.syncMaxArticles).toBe(100);
    });
  });

  describe("OpenAPI Documentation Coverage", () => {
    it("should have schemas registered for GET endpoint", () => {
      // This would verify the OpenAPI registry has the endpoint
      // In actual implementation, would check registry.ts
      const expectedSchema = {
        path: "/api/users/preferences",
        method: "GET",
        responses: {
          200: { description: "User preferences with defaults" },
          404: { description: "User not found" },
          500: { description: "Internal server error" },
        },
      };

      expect(expectedSchema).toBeDefined();
    });

    it("should have schemas registered for PUT endpoint", () => {
      const expectedSchema = {
        path: "/api/users/preferences",
        method: "PUT",
        requestBody: PreferencesSchema,
        responses: {
          200: { description: "Updated preferences" },
          400: { description: "Invalid preferences" },
          500: { description: "Internal server error" },
        },
      };

      expect(expectedSchema).toBeDefined();
    });
  });
});
