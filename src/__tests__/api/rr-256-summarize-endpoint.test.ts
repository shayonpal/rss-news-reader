/**
 * API Endpoint tests for RR-256: Summarize with Auto-fetch
 * Tests the /api/articles/[id]/summarize endpoint behavior
 * with partial feed detection and auto-fetch functionality.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Mock environment variables
process.env.ANTHROPIC_API_KEY = "test-api-key";
process.env.CLAUDE_SUMMARIZATION_MODEL = "claude-3-5-sonnet";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

// MSW server for external API mocking
const server = setupServer(
  http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: "This is an AI-generated summary of the article content.",
        },
      ],
      model: "claude-3-5-sonnet",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 1500,
        output_tokens: 250,
      },
    });
  })
);

// Mock Supabase
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock Anthropic
vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "AI summary" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    };
  },
  APIError: class APIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

// Import after mocks are set up
import { POST } from "@/app/api/articles/[id]/summarize/route";
import { supabase } from "@/lib/db/supabase";

describe("/api/articles/[id]/summarize Endpoint", () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: "error" });
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  describe("Request Processing", () => {
    it("should check partial feed status before summarization", async () => {
      const articleId = "test-article";
      let feedChecked = false;

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: articleId,
                    feed_id: "bbc-feed",
                    content: "RSS content",
                    full_content: null,
                  },
                  error: null,
                })),
              })),
            })),
          } as any;
        }
        if (table === "feeds") {
          feedChecked = true;
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: "bbc-feed",
                    is_partial_content: true,
                  },
                  error: null,
                })),
              })),
            })),
          } as any;
        }
        return {} as any;
      });

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test-article/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: articleId } });

      expect(feedChecked).toBe(true);
      expect(response.status).toBe(200);
    });

    it("should trigger auto-fetch for qualifying articles", async () => {
      const articleId = "partial-article";
      let fetchTriggered = false;

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: articleId,
                    feed_id: "bbc-feed",
                    content: "Truncated content",
                    full_content: null,
                    has_full_content: false,
                    link: "https://bbc.com/article",
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => {
              fetchTriggered = true;
              return {
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(() => ({
                      data: { full_content: "Fetched content" },
                      error: null,
                    })),
                  })),
                })),
              };
            }),
          } as any;
        }
        if (table === "feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: "bbc-feed",
                    is_partial_content: true,
                  },
                  error: null,
                })),
              })),
            })),
          } as any;
        }
        return {} as any;
      });

      server.use(
        http.post("*/api/articles/*/fetch-content", () => {
          return HttpResponse.json({
            success: true,
            content: "Full article content",
          });
        })
      );

      const request = new NextRequest(
        "http://localhost:3000/api/articles/partial-article/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: articleId } });
      const result = await response.json();

      expect(fetchTriggered).toBe(true);
      expect(result.success).toBe(true);
    });

    it("should skip auto-fetch for non-qualifying articles", async () => {
      const articleId = "complete-article";
      let fetchAttempted = false;

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: articleId,
                    feed_id: "techcrunch-feed",
                    content: "Complete RSS content",
                    full_content: null,
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => {
              fetchAttempted = true;
              return {} as any;
            }),
          } as any;
        }
        if (table === "feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: "techcrunch-feed",
                    is_partial_content: false, // Not partial
                  },
                  error: null,
                })),
              })),
            })),
          } as any;
        }
        return {} as any;
      });

      const request = new NextRequest(
        "http://localhost:3000/api/articles/complete-article/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: articleId } });

      expect(fetchAttempted).toBe(false);
      expect(response.status).toBe(200);
    });

    it("should maintain backward compatibility", async () => {
      // Test that existing behavior is preserved for non-partial feeds
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: "legacy-article",
                content: "Full RSS content",
                ai_summary: null,
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/articles/legacy-article/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, {
        params: { id: "legacy-article" },
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });
  });

  describe("Response Format", () => {
    it("should return standard summary response format", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: "test-article",
                content: "Article content",
                ai_summary: null,
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test-article/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: "test-article" } });
      const result = await response.json();

      expect(result).toMatchObject({
        success: true,
        summary: expect.any(String),
        model: expect.any(String),
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
      });
    });

    it("should include fetch metadata in response", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: "partial-article",
                    feed_id: "bbc-feed",
                    content: "Truncated",
                    full_content: null,
                    link: "https://bbc.com/article",
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: { full_content: "Fetched full content" },
                    error: null,
                  })),
                })),
              })),
            })),
          } as any;
        }
        if (table === "feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { is_partial_content: true },
                  error: null,
                })),
              })),
            })),
          } as any;
        }
        return {} as any;
      });

      server.use(
        http.post("*/api/articles/*/fetch-content", () => {
          return HttpResponse.json({
            success: true,
            content: "Full content",
            extractedAt: new Date().toISOString(),
          });
        })
      );

      const request = new NextRequest(
        "http://localhost:3000/api/articles/partial-article/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, {
        params: { id: "partial-article" },
      });
      const result = await response.json();

      expect(result.fullContentUsed).toBe(true);
      expect(result.fetchMetadata).toBeDefined();
    });

    it("should maintain OpenAPI compliance", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: "test",
                content: "Content",
                ai_summary: null,
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: "test" } });
      const result = await response.json();

      // Validate against OpenAPI schema
      const requiredFields = ["success"];
      const optionalFields = [
        "summary",
        "model",
        "error",
        "message",
        "cached",
        "regenerated",
      ];

      requiredFields.forEach((field) => {
        expect(result).toHaveProperty(field);
      });

      // Response should only contain expected fields
      const allFields = [
        ...requiredFields,
        ...optionalFields,
        "input_tokens",
        "output_tokens",
        "config",
      ];
      Object.keys(result).forEach((key) => {
        expect(allFields).toContain(key);
      });
    });
  });

  describe("Error Responses", () => {
    it("should return 404 for non-existent article", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: "Article not found" },
            })),
          })),
        })),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/articles/non-existent/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: "non-existent" } });
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe("article_not_found");
      expect(result.message).toContain("not found");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => {
              throw new Error("Database connection failed");
            }),
          })),
        })),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: "test" } });
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe("summarization_failed");
      expect(result.details).toContain("Database");
    });

    it("should return 503 on service unavailability", async () => {
      // Remove API key to simulate service unavailable
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: "test" } });
      const result = await response.json();

      expect(response.status).toBe(503);
      expect(result.error).toBe("api_not_configured");
      expect(result.message).toContain("not configured");

      // Restore API key
      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it("should include retry-after header on rate limit", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: "test",
                content: "Content",
                ai_summary: null,
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      } as any);

      // Mock Anthropic rate limit error
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const mockAnthropicInstance = new Anthropic();
      mockAnthropicInstance.messages.create = vi.fn().mockRejectedValue({
        status: 429,
        message: "Rate limit exceeded",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, { params: { id: "test" } });
      const result = await response.json();

      expect(response.status).toBe(429);
      expect(result.error).toBe("rate_limit");
      expect(response.headers.get("retry-after")).toBeDefined();
    });
  });

  describe("Request Validation", () => {
    it("should validate article ID format", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/articles/invalid-uuid-format/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const response = await POST(request, {
        params: { id: "invalid-uuid-format" },
      });

      // Should still process but handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle missing request body gracefully", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: "test",
                content: "Content",
                ai_summary: "Existing summary",
              },
              error: null,
            })),
          })),
        })),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test/summarize",
        {
          method: "POST",
          // No body provided
        }
      );

      const response = await POST(request, { params: { id: "test" } });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.cached).toBe(true); // Should return cached summary
    });

    it("should validate regenerate parameter", async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: "test",
                content: "Content",
                ai_summary: "Existing summary",
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/articles/test/summarize",
        {
          method: "POST",
          body: JSON.stringify({ regenerate: true }),
        }
      );

      const response = await POST(request, { params: { id: "test" } });
      const result = await response.json();

      expect(result.regenerated).toBe(true);
      expect(result.cached).toBe(false);
    });
  });

  describe("Performance Considerations", () => {
    it("should respect timeout for content fetching", async () => {
      const startTime = Date.now();

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => {
                  // Simulate slow database
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  return {
                    data: {
                      id: "slow-article",
                      content: "Content",
                      full_content: null,
                    },
                    error: null,
                  };
                }),
              })),
            })),
          } as any;
        }
        return {} as any;
      });

      server.use(
        http.post("*/api/articles/*/fetch-content", async () => {
          // Simulate timeout
          await new Promise((resolve) => setTimeout(resolve, 35000));
          return HttpResponse.json({ content: "Too late" });
        })
      );

      const request = new NextRequest(
        "http://localhost:3000/api/articles/slow-article/summarize",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await POST(request, {
          params: { id: "slow-article" },
        });
        clearTimeout(timeoutId);

        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(31000); // Should timeout at 30s
      } catch (error) {
        // Aborted due to timeout
        expect(Date.now() - startTime).toBeLessThanOrEqual(30500);
      }
    });

    it("should handle concurrent requests efficiently", async () => {
      const requestCount = 5;
      let concurrentCount = 0;
      let maxConcurrent = 0;

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => {
              concurrentCount++;
              maxConcurrent = Math.max(maxConcurrent, concurrentCount);

              await new Promise((resolve) => setTimeout(resolve, 50));

              concurrentCount--;
              return {
                data: {
                  id: "test",
                  content: "Content",
                  ai_summary: null,
                },
                error: null,
              };
            }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      } as any);

      const requests = Array.from({ length: requestCount }, (_, i) =>
        POST(
          new NextRequest(
            `http://localhost:3000/api/articles/article-${i}/summarize`,
            {
              method: "POST",
              body: JSON.stringify({}),
            }
          ),
          { params: { id: `article-${i}` } }
        )
      );

      await Promise.all(requests);

      // Should handle requests concurrently but with limits
      expect(maxConcurrent).toBeGreaterThan(1);
      expect(maxConcurrent).toBeLessThanOrEqual(3); // MAX_CONCURRENT_PARSES
    });
  });
});
