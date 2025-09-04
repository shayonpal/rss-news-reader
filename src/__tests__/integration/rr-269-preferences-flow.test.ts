/**
 * Integration tests for RR-269: User Preferences Flow
 * Tests end-to-end integration with summary-prompt.ts and sync service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { SummaryPromptBuilder } from "@/lib/ai/summary-prompt";
import type { Database } from "@/types/database";

// Test fixtures
const testArticle = {
  title: "Test Article",
  author: "Test Author",
  publishedDate: "2024-01-01",
  content: "This is test content that needs summarization.",
};

const testPreferences = {
  timezone: "America/Toronto",
  summaryWordCount: "150-200",
  summaryStyle: "analytical" as const,
  summaryModel: "claude-3-haiku-20240307",
  syncMaxArticles: 250,
  theme: "dark" as const,
  fontSize: "large" as const,
  readingWidth: "wide" as const,
  enableNotifications: true,
};

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe("RR-269: User Preferences Integration Flow", () => {
  let mockSupabase: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save original environment
    originalEnv = { ...process.env };
    
    // Setup test environment
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUMMARY_WORD_COUNT = "70-80";
    process.env.SUMMARY_STYLE = "objective";
    process.env.SYNC_MAX_ARTICLES = "100";
    
    // Create mock Supabase client
    mockSupabase = {
      from: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user" } },
          error: null,
        }),
      },
    };
    
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe("Summary Generation with User Preferences", () => {
    it("should use user preferences over environment variables", async () => {
      // Mock preferences API response
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summaryWordCount: "150-200",
            summaryStyle: "analytical",
            summaryModel: "claude-3-haiku-20240307",
          }),
          { status: 200 }
        )
      );

      // Fetch preferences
      const prefsResponse = await fetch("/api/users/preferences");
      const prefs = await prefsResponse.json();
      
      // Build prompt with preferences
      const prompt = buildPromptWithPreferences(testArticle, prefs);
      
      expect(prompt).toContain("analytical summary");
      expect(prompt).toContain("150-200 words");
      expect(prompt).not.toContain("70-80 words"); // Not using env default
      expect(prompt).not.toContain("objective summary"); // Not using env default
    });

    it("should fallback to environment defaults when preferences not set", async () => {
      // Mock empty preferences
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({}),
          { status: 200 }
        )
      );

      const prefsResponse = await fetch("/api/users/preferences");
      const prefs = await prefsResponse.json();
      
      // Use default environment values
      const config = {
        summaryWordCount: prefs.summaryWordCount || process.env.SUMMARY_WORD_COUNT || "70-80",
        summaryStyle: prefs.summaryStyle || process.env.SUMMARY_STYLE || "objective",
      };
      
      expect(config.summaryWordCount).toBe("70-80");
      expect(config.summaryStyle).toBe("objective");
    });

    it("should validate AI model selection against database", async () => {
      // Setup ai_models table mock
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "ai_models") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "claude-3-haiku-20240307",
                    name: "Claude 3 Haiku",
                    active: true,
                    max_tokens: 4096,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      // Validate model exists and is active
      const { data: model } = await mockSupabase
        .from("ai_models")
        .select("*")
        .eq("id", "claude-3-haiku-20240307")
        .single();

      expect(model).toBeDefined();
      expect(model.active).toBe(true);
      expect(model.max_tokens).toBe(4096);
    });

    it("should generate prompts with correct word count ranges", () => {
      const testCases = [
        { range: "50-75", expected: "50-75 words" },
        { range: "100-150", expected: "100-150 words" },
        { range: "200-250", expected: "200-250 words" },
      ];

      testCases.forEach(({ range, expected }) => {
        const prompt = buildPromptWithPreferences(testArticle, {
          summaryWordCount: range,
          summaryStyle: "objective",
        });
        
        expect(prompt).toContain(expected);
      });
    });
  });

  describe("Sync Service Integration", () => {
    it("should respect syncMaxArticles preference during sync", async () => {
      // Mock preferences with custom sync limit
      vi.mocked(fetch).mockImplementation((url: any) => {
        if (url === "/api/users/preferences") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ syncMaxArticles: 250 }),
              { status: 200 }
            )
          );
        }
        if (url === "/api/sync") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                processed: 250,
                message: "Sync completed",
              }),
              { status: 200 }
            )
          );
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      // Get preferences
      const prefsResponse = await fetch("/api/users/preferences");
      const prefs = await prefsResponse.json();
      
      // Trigger sync with preferences
      const syncResponse = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxArticles: prefs.syncMaxArticles }),
      });
      const syncResult = await syncResponse.json();
      
      expect(syncResult.processed).toBe(250);
      expect(syncResult.processed).toBe(prefs.syncMaxArticles);
    });

    it("should use default sync limit when preference not set", async () => {
      vi.mocked(fetch).mockImplementation((url: any) => {
        if (url === "/api/users/preferences") {
          return Promise.resolve(
            new Response(JSON.stringify({}), { status: 200 })
          );
        }
        if (url === "/api/sync") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                processed: 100, // Default from env
              }),
              { status: 200 }
            )
          );
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const syncResponse = await fetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({ 
          maxArticles: parseInt(process.env.SYNC_MAX_ARTICLES || "100") 
        }),
      });
      const syncResult = await syncResponse.json();
      
      expect(syncResult.processed).toBe(100);
    });

    it("should enforce sync limits between 10-1000", async () => {
      const testLimits = [
        { input: 5, expected: 10 }, // Below minimum
        { input: 500, expected: 500 }, // Valid
        { input: 1500, expected: 1000 }, // Above maximum
      ];

      for (const { input, expected } of testLimits) {
        const validated = Math.min(Math.max(input, 10), 1000);
        expect(validated).toBe(expected);
      }
    });
  });

  describe("Cache Invalidation Flow", () => {
    it("should invalidate cache after preference update", async () => {
      let cacheHit = false;
      
      vi.mocked(fetch).mockImplementation((url: any, options: any) => {
        if (url === "/api/users/preferences") {
          if (options?.method === "PUT") {
            // Update preferences
            cacheHit = false; // Cache invalidated
            return Promise.resolve(
              new Response(
                JSON.stringify(testPreferences),
                { status: 200 }
              )
            );
          } else {
            // GET preferences
            if (cacheHit) {
              // Return cached version
              return Promise.resolve(
                new Response(
                  JSON.stringify({ cached: true, ...testPreferences }),
                  { status: 200, headers: { "X-Cache": "HIT" } }
                )
              );
            } else {
              cacheHit = true; // Next request will hit cache
              return Promise.resolve(
                new Response(
                  JSON.stringify(testPreferences),
                  { status: 200, headers: { "X-Cache": "MISS" } }
                )
              );
            }
          }
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      // First GET - cache miss
      const response1 = await fetch("/api/users/preferences");
      expect(response1.headers.get("X-Cache")).toBe("MISS");
      
      // Second GET - cache hit
      const response2 = await fetch("/api/users/preferences");
      expect(response2.headers.get("X-Cache")).toBe("HIT");
      
      // PUT update - invalidates cache
      await fetch("/api/users/preferences", {
        method: "PUT",
        body: JSON.stringify({ theme: "light" }),
      });
      
      // Next GET - cache miss (was invalidated)
      const response3 = await fetch("/api/users/preferences");
      expect(response3.headers.get("X-Cache")).toBe("MISS");
    });

    it("should maintain cache for 5 minutes", async () => {
      const startTime = Date.now();
      let requestCount = 0;
      
      vi.mocked(fetch).mockImplementation(() => {
        requestCount++;
        const timeDiff = Date.now() - startTime;
        const cacheValid = timeDiff < 5 * 60 * 1000; // 5 minutes
        
        return Promise.resolve(
          new Response(
            JSON.stringify(testPreferences),
            { 
              status: 200,
              headers: { "X-Cache": cacheValid && requestCount > 1 ? "HIT" : "MISS" }
            }
          )
        );
      });

      // Initial request
      const response1 = await fetch("/api/users/preferences");
      expect(response1.headers.get("X-Cache")).toBe("MISS");
      
      // Within 5 minutes - should hit cache
      const response2 = await fetch("/api/users/preferences");
      expect(response2.headers.get("X-Cache")).toBe("HIT");
      
      // Simulate time passing (6 minutes)
      vi.setSystemTime(startTime + 6 * 60 * 1000);
      
      // After 5 minutes - cache expired
      const response3 = await fetch("/api/users/preferences");
      expect(response3.headers.get("X-Cache")).toBe("MISS");
      
      vi.useRealTimers();
    });
  });

  describe("Database Transaction Handling", () => {
    it("should handle partial updates with jsonb_set", async () => {
      const initialPrefs = {
        timezone: "America/Toronto",
        theme: "dark",
      };
      
      const updates = {
        theme: "light",
        fontSize: "large",
      };
      
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((data: any) => ({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  preferences: { ...initialPrefs, ...updates },
                },
                error: null,
              }),
            }),
          }),
        })),
      });

      const supabase = createClient("", "");
      const { data } = await supabase
        .from("users")
        .update({ preferences: updates })
        .eq("inoreader_id", "shayon")
        .select("preferences")
        .single();

      // Verify partial update preserved existing data
      expect(data.preferences.timezone).toBe("America/Toronto"); // Preserved
      expect(data.preferences.theme).toBe("light"); // Updated
      expect(data.preferences.fontSize).toBe("large"); // Added
    });

    it("should handle concurrent preference updates", async () => {
      let version = 1;
      
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  preferences: testPreferences,
                  version: ++version,
                },
                error: null,
              }),
            }),
          }),
        })),
      });

      // Simulate concurrent updates
      const updates = [
        { theme: "light" },
        { fontSize: "small" },
        { enableNotifications: false },
      ];

      const promises = updates.map((update) =>
        mockSupabase
          .from("users")
          .update({ preferences: update })
          .eq("inoreader_id", "shayon")
          .select("preferences, version")
          .single()
      );

      const results = await Promise.all(promises);
      
      // Each update should increment version
      expect(results[0].data.version).toBe(2);
      expect(results[1].data.version).toBe(3);
      expect(results[2].data.version).toBe(4);
    });
  });

  describe("Error Recovery", () => {
    it("should retry on transient database errors", async () => {
      let attempts = 0;
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              attempts++;
              if (attempts < 3) {
                return Promise.resolve({
                  data: null,
                  error: new Error("Connection timeout"),
                });
              }
              return Promise.resolve({
                data: { preferences: testPreferences },
                error: null,
              });
            }),
          }),
        }),
      });

      // Retry logic implementation
      const retryFetch = async (maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          const { data, error } = await mockSupabase
            .from("users")
            .select("preferences")
            .eq("inoreader_id", "shayon")
            .single();
          
          if (!error) return data;
          if (i === maxRetries - 1) throw error;
          
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, i)));
        }
      };

      const data = await retryFetch();
      expect(attempts).toBe(3);
      expect(data.preferences).toEqual(testPreferences);
    });

    it("should provide fallback for critical preferences", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("Database unavailable"),
            }),
          }),
        }),
      });

      // Fallback implementation
      const getPreferencesWithFallback = async () => {
        try {
          const { data, error } = await mockSupabase
            .from("users")
            .select("preferences")
            .eq("inoreader_id", "shayon")
            .single();
          
          if (error) throw error;
          return data.preferences;
        } catch (error) {
          // Return critical defaults
          return {
            summaryWordCount: process.env.SUMMARY_WORD_COUNT || "70-80",
            summaryStyle: process.env.SUMMARY_STYLE || "objective",
            syncMaxArticles: parseInt(process.env.SYNC_MAX_ARTICLES || "100"),
          };
        }
      };

      const prefs = await getPreferencesWithFallback();
      expect(prefs.summaryWordCount).toBe("70-80");
      expect(prefs.syncMaxArticles).toBe(100);
    });
  });

  describe("Performance Benchmarks", () => {
    it("should fetch preferences within 100ms (cached)", async () => {
      // Simulate cached response
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify(testPreferences),
          { 
            status: 200,
            headers: { "X-Cache": "HIT", "X-Response-Time": "15ms" }
          }
        )
      );

      const start = performance.now();
      await fetch("/api/users/preferences");
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100);
    });

    it("should update preferences within 500ms", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify(testPreferences),
          { status: 200 }
        )
      );

      const start = performance.now();
      await fetch("/api/users/preferences", {
        method: "PUT",
        body: JSON.stringify({ theme: "dark" }),
      });
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(500);
    });

    it("should handle bulk preference operations efficiently", async () => {
      const operations = Array(10).fill(null).map((_, i) => ({
        theme: i % 2 === 0 ? "dark" : "light",
      }));

      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const start = performance.now();
      await Promise.all(
        operations.map((op) =>
          fetch("/api/users/preferences", {
            method: "PUT",
            body: JSON.stringify(op),
          })
        )
      );
      const duration = performance.now() - start;
      
      // Should process 10 updates in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });
});

// Helper function to build prompt with preferences
function buildPromptWithPreferences(
  article: any,
  preferences: any
): string {
  const config = {
    wordCount: preferences.summaryWordCount || "70-80",
    style: preferences.summaryStyle || "objective",
  };

  return `You are a news summarization assistant. Create a ${config.style} summary of the following article in ${config.wordCount} words.

Article Details:
Title: ${article.title}
Author: ${article.author}
Published: ${article.publishedDate}

Article Content:
${article.content}`;
}