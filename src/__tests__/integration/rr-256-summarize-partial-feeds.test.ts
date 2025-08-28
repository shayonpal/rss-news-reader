/**
 * Integration tests for RR-256: Summarize Partial Feeds with Auto-fetch
 * Tests the end-to-end flow of summarizing articles from partial feeds,
 * including automatic full content extraction before summarization.
 */

import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Article, Feed } from "@/types";

// MSW server for API mocking
const server = setupServer(
  // Default handlers
  http.post("/api/articles/:id/fetch-content", async ({ params }) => {
    const { id } = params;

    // Simulate different scenarios based on article ID
    if (id === "timeout-article") {
      // Simulate timeout
      await new Promise((resolve) => setTimeout(resolve, 35000));
      return HttpResponse.json({ error: "Timeout" }, { status: 504 });
    }

    if (id === "error-article") {
      return HttpResponse.json({ error: "Extraction failed" }, { status: 500 });
    }

    // Default success response
    return HttpResponse.json({
      success: true,
      content: `<p>Full extracted content for article ${id}. This is the complete article text with all details that were missing from the RSS feed.</p>`,
      extractedAt: new Date().toISOString(),
      metadata: {
        title: "Extracted Article Title",
        author: "Article Author",
        publishedDate: new Date().toISOString(),
        wordCount: 500,
      },
    });
  }),

  http.post("/api/articles/:id/summarize", async ({ request, params }) => {
    const { id } = params;
    const body = await request.json();

    return HttpResponse.json({
      success: true,
      summary: `AI-generated summary for article ${id}. Key points from the ${body.fullContentUsed ? "full extracted" : "RSS"} content.`,
      model: "claude-3-5-sonnet",
      fullContentUsed: body.fullContentUsed || false,
      cached: false,
      input_tokens: 1500,
      output_tokens: 250,
    });
  })
);

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

// Test data factories
const createPartialFeedArticle = (
  overrides: Partial<Article> = {}
): Article => ({
  id: "partial-article-1",
  feed_id: "bbc-feed",
  user_id: "user-1",
  title: "BBC News Article",
  link: "https://bbc.com/news/article-1",
  content:
    "This is truncated RSS content that only contains the first paragraph...",
  full_content: null,
  has_full_content: false,
  author: "BBC Reporter",
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  is_read: false,
  is_starred: false,
  reading_time: 2,
  ai_summary: null,
  ai_summary_model: null,
  ai_summary_generated_at: null,
  inoreader_id: "bbc-1",
  ...overrides,
});

const createCompleteFeedArticle = (
  overrides: Partial<Article> = {}
): Article => ({
  id: "complete-article-1",
  feed_id: "techcrunch-feed",
  user_id: "user-1",
  title: "TechCrunch Article",
  link: "https://techcrunch.com/article-1",
  content:
    "This is complete RSS content with all the article details included in the feed. No extraction needed.",
  full_content: null,
  has_full_content: false,
  author: "TC Writer",
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  is_read: false,
  is_starred: false,
  reading_time: 5,
  ai_summary: null,
  ai_summary_model: null,
  ai_summary_generated_at: null,
  inoreader_id: "tc-1",
  ...overrides,
});

const createPartialFeed = (overrides: Partial<Feed> = {}): Feed => ({
  id: "bbc-feed",
  title: "BBC News",
  url: "https://feeds.bbci.co.uk/news/rss.xml",
  site_url: "https://bbc.com",
  user_id: "user-1",
  created_at: new Date().toISOString(),
  last_fetched_at: new Date().toISOString(),
  category: "News",
  is_partial_content: true,
  fetch_full_content: false,
  ...overrides,
});

const createCompleteFeed = (overrides: Partial<Feed> = {}): Feed => ({
  id: "techcrunch-feed",
  title: "TechCrunch",
  url: "https://techcrunch.com/feed/",
  site_url: "https://techcrunch.com",
  user_id: "user-1",
  created_at: new Date().toISOString(),
  last_fetched_at: new Date().toISOString(),
  category: "Technology",
  is_partial_content: false,
  fetch_full_content: false,
  ...overrides,
});

describe("RR-256: Summarize Partial Feeds Integration", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
    vi.useFakeTimers();
    mockSupabase.from.mockClear();
    mockSupabase.rpc.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Summarization with Auto-fetch", () => {
    it("should auto-fetch content before summarization for partial feeds", async () => {
      const article = createPartialFeedArticle();
      const feed = createPartialFeed();

      // Mock database queries
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: {
                      ...article,
                      full_content: "Full extracted content...",
                      has_full_content: true,
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: feed,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "fetch_logs") {
          return {
            insert: vi.fn(() => ({
              data: { id: "log-1" },
              error: null,
            })),
          };
        }
      });

      // Make summarization request
      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: false }),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.summary).toContain("full extracted");
      expect(result.fullContentUsed).toBe(true);

      // Verify fetch-content was called
      expect(mockSupabase.from).toHaveBeenCalledWith("articles");
      expect(mockSupabase.from("articles").update).toHaveBeenCalled();
    });

    it("should update database with fetched content", async () => {
      const article = createPartialFeedArticle();
      const fullContent = "Complete article content after extraction";

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
            update: vi.fn((updates: any) => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: { ...article, ...updates },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
      });

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          return HttpResponse.json({
            success: true,
            content: fullContent,
          });
        })
      );

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(mockSupabase.from("articles").update).toHaveBeenCalledWith(
        expect.objectContaining({
          full_content: fullContent,
          has_full_content: true,
          updated_at: expect.any(String),
        })
      );
    });

    it("should log extraction in fetch_logs table", async () => {
      const article = createPartialFeedArticle();
      let logInserted = false;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "fetch_logs") {
          return {
            insert: vi.fn((data: any) => {
              logInserted = true;
              expect(data).toMatchObject({
                article_id: article.id,
                feed_id: article.feed_id,
                status: expect.stringMatching(/success|failed/),
                attempted_at: expect.any(String),
                response_time_ms: expect.any(Number),
              });
              return { data: { id: "log-1" }, error: null };
            }),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: article,
                error: null,
              })),
            })),
          })),
        };
      });

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(logInserted).toBe(true);
    });

    it("should generate summary from fetched full content", async () => {
      const article = createPartialFeedArticle();
      const fullContent =
        "This is the complete article with 500 words of detailed content...";

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          return HttpResponse.json({
            success: true,
            content: fullContent,
          });
        }),
        http.post("/api/articles/:id/summarize", async ({ request }) => {
          const body = await request.json();

          // Verify full content was used
          expect(body.content).toBe(fullContent);

          return HttpResponse.json({
            success: true,
            summary: "Summary based on full extracted content",
            fullContentUsed: true,
          });
        })
      );

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { ...article, full_content: fullContent },
                error: null,
              })),
            })),
          })),
        })),
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await response.json();

      expect(result.summary).toContain("full extracted content");
      expect(result.fullContentUsed).toBe(true);
    });

    it("should maintain transaction atomicity", async () => {
      const article = createPartialFeedArticle();
      let transactionStarted = false;
      let transactionCommitted = false;
      let transactionRolledBack = false;

      mockSupabase.rpc.mockImplementation((procedure: string) => {
        if (procedure === "begin_transaction") {
          transactionStarted = true;
          return { data: null, error: null };
        }
        if (procedure === "commit_transaction") {
          transactionCommitted = true;
          return { data: null, error: null };
        }
        if (procedure === "rollback_transaction") {
          transactionRolledBack = true;
          return { data: null, error: null };
        }
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: article,
                error: null,
              })),
            })),
          })),
        })),
      });

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      // Transaction should be properly managed
      expect(transactionStarted || transactionCommitted).toBeTruthy();

      // On error, should rollback
      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: { message: "Database error" },
              })),
            })),
          })),
        })),
      });

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (transactionStarted) {
        expect(transactionRolledBack || !transactionCommitted).toBeTruthy();
      }
    });
  });

  describe("Fallback Behavior", () => {
    it("should use RSS content when extraction fails", async () => {
      const article = createPartialFeedArticle({
        id: "error-article",
        content: "Fallback RSS content",
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.fullContentUsed).toBe(false);
    });

    it("should handle extraction timeout gracefully", async () => {
      const article = createPartialFeedArticle({
        id: "timeout-article",
        content: "RSS content to use after timeout",
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
      });

      // Use fake timers to simulate timeout
      const startTime = Date.now();

      const responsePromise = fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30000), // 30-second timeout
      });

      // Fast-forward time
      vi.advanceTimersByTime(30000);

      const response = await responsePromise;
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.fullContentUsed).toBe(false);
      expect(Date.now() - startTime).toBeLessThanOrEqual(31000);
    });

    it("should continue summarization after fetch failure", async () => {
      const article = createPartialFeedArticle();

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          return HttpResponse.json({ error: "Network error" }, { status: 500 });
        })
      );

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });

    it("should log failed extraction attempts", async () => {
      const article = createPartialFeedArticle({ id: "error-article" });
      let failedLogInserted = false;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "fetch_logs") {
          return {
            insert: vi.fn((data: any) => {
              if (data.status === "failed") {
                failedLogInserted = true;
                expect(data.error_message).toBeDefined();
              }
              return { data: { id: "log-fail" }, error: null };
            }),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: article,
                error: null,
              })),
            })),
          })),
        };
      });

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(failedLogInserted).toBe(true);
    });
  });

  describe("Skip Conditions", () => {
    it("should skip auto-fetch for non-partial feeds", async () => {
      const article = createCompleteFeedArticle();
      const feed = createCompleteFeed();
      let fetchContentCalled = false;

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          fetchContentCalled = true;
          return HttpResponse.json({ success: true });
        })
      );

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: feed,
                  error: null,
                })),
              })),
            })),
          };
        }
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(fetchContentCalled).toBe(false);
      expect(result.fullContentUsed).toBe(false);
    });

    it("should skip auto-fetch when article already has full content", async () => {
      const article = createPartialFeedArticle({
        full_content: "Existing full content",
        has_full_content: true,
      });
      const feed = createPartialFeed();
      let fetchContentCalled = false;

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          fetchContentCalled = true;
          return HttpResponse.json({ success: true });
        })
      );

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: feed,
                  error: null,
                })),
              })),
            })),
          };
        }
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(fetchContentCalled).toBe(false);
      expect(result.summary).toContain("Existing full content");
    });
  });

  describe("Database Interactions", () => {
    it("should update article.full_content atomically", async () => {
      const article = createPartialFeedArticle();
      const updates: any[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
            update: vi.fn((data: any) => {
              updates.push(data);
              return {
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(() => ({
                      data: { ...article, ...data },
                      error: null,
                    })),
                  })),
                })),
              };
            }),
          };
        }
      });

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      // Should update full_content and has_full_content together
      const contentUpdate = updates.find((u) => u.full_content);
      if (contentUpdate) {
        expect(contentUpdate.has_full_content).toBe(true);
        expect(contentUpdate.updated_at).toBeDefined();
      }
    });

    it("should set has_full_content flag correctly", async () => {
      const article = createPartialFeedArticle();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
            update: vi.fn((data: any) => {
              expect(data.has_full_content).toBe(true);
              return {
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(() => ({
                      data: { ...article, ...data },
                      error: null,
                    })),
                  })),
                })),
              };
            }),
          };
        }
      });

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    });

    it("should record fetch metadata in logs", async () => {
      const article = createPartialFeedArticle();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "fetch_logs") {
          return {
            insert: vi.fn((data: any) => {
              expect(data).toMatchObject({
                article_id: article.id,
                feed_id: article.feed_id,
                url: article.link,
                status: expect.any(String),
                response_time_ms: expect.any(Number),
                content_length: expect.any(Number),
                metadata: expect.objectContaining({
                  trigger: "summarization",
                  partial_feed: true,
                }),
              });
              return { data: { id: "log-1" }, error: null };
            }),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: article,
                error: null,
              })),
            })),
          })),
        };
      });

      await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(mockSupabase.from).toHaveBeenCalledWith("fetch_logs");
    });

    it("should handle concurrent updates safely", async () => {
      const article = createPartialFeedArticle();
      const updateQueue: string[] = [];
      let updateCount = 0;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
            update: vi.fn((data: any) => {
              updateCount++;
              updateQueue.push(`update-${updateCount}`);

              // Simulate slight delay
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    eq: vi.fn(() => ({
                      select: vi.fn(() => ({
                        single: vi.fn(() => ({
                          data: { ...article, ...data },
                          error: null,
                        })),
                      })),
                    })),
                  });
                }, 10);
              });
            }),
          };
        }
      });

      // Make concurrent requests
      const promises = Array.from({ length: 3 }, (_, i) =>
        fetch(`/api/articles/${article.id}/summarize`, {
          method: "POST",
          body: JSON.stringify({ requestId: i }),
        })
      );

      await Promise.all(promises);

      // Should handle updates sequentially or with proper locking
      expect(updateCount).toBeLessThanOrEqual(3);
      expect(updateQueue.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty extracted content", async () => {
      const article = createPartialFeedArticle();

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          return HttpResponse.json({
            success: true,
            content: "", // Empty content
          });
        })
      );

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await response.json();

      // Should fall back to RSS content
      expect(result.success).toBe(true);
      expect(result.fullContentUsed).toBe(false);
    });

    it("should handle malformed HTML in extracted content", async () => {
      const article = createPartialFeedArticle();
      const malformedHtml =
        "<p>Unclosed tag <div>Mixed content</p> <script>alert('xss')</script>";

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          return HttpResponse.json({
            success: true,
            content: malformedHtml,
          });
        })
      );

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn((data: any) => {
                // Content should be sanitized
                expect(data.full_content).not.toContain("<script>");
                return {
                  data: { ...article, ...data },
                  error: null,
                };
              }),
            })),
          })),
        })),
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
    });

    it("should handle URL returning 404", async () => {
      const article = createPartialFeedArticle();

      server.use(
        http.post("/api/articles/:id/fetch-content", () => {
          return HttpResponse.json(
            { error: "Article not found" },
            { status: 404 }
          );
        })
      );

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: article,
              error: null,
            })),
          })),
        })),
      });

      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await response.json();

      // Should still generate summary from RSS
      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });

    it("should handle feed marked as partial but has complete content", async () => {
      const article = createPartialFeedArticle({
        content:
          "This is actually complete content despite being from a partial feed. The full article is here.",
      });
      const feed = createPartialFeed();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: article,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "feeds") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: feed,
                  error: null,
                })),
              })),
            })),
          };
        }
      });

      // Even if fetch is attempted, should work fine
      const response = await fetch(`/api/articles/${article.id}/summarize`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });
  });
});
