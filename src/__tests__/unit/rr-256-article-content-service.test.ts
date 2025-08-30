/**
 * Unit tests for RR-256: Article Content Service
 * Tests the ensureFullContent service logic for auto-fetching full content
 * from partial feeds before summarization.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Article, Feed } from "@/types";

// Mock supabase client before any imports
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: vi.fn(() =>
        Promise.resolve({ data: { id: "log-1" }, error: null })
      ),
    })),
  },
}));

// Mock ContentParsingService
vi.mock("@/lib/services/content-parsing-service", () => ({
  ContentParsingService: {
    getInstance: vi.fn(() => ({
      extractContent: vi.fn(),
    })),
  },
}));

import { ArticleContentService } from "@/lib/services/article-content-service";
import { supabase } from "@/lib/db/supabase";

// Mock fetch for content extraction
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Reference to mocked supabase for easier access in tests
const mockSupabase = supabase as any;

describe("ArticleContentService", () => {
  let service: ArticleContentService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = ArticleContentService.getInstance();
    mockSupabase.from.mockClear();
    mockFetch.mockClear();

    // Set up default mock implementation that handles all tables including fetch_logs
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "fetch_logs") {
        return {
          insert: vi.fn(() =>
            Promise.resolve({ data: { id: "log-1" }, error: null })
          ),
        };
      }

      // Default mock for other tables
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        insert: vi.fn(() =>
          Promise.resolve({ data: { id: "log-1" }, error: null })
        ),
      };
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("ensureFullContent", () => {
    describe("Happy Path", () => {
      it("should fetch full content for partial feed article without content", async () => {
        const articleId = "article-1";
        const feedId = "bbc-feed";

        // Mock article without full content
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === "articles") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(() => ({
                      data: {
                        id: articleId,
                        feed_id: feedId,
                        content: "Truncated RSS content...",
                        full_content: null,
                        has_full_content: false,
                        link: "https://bbc.com/article-1",
                        feeds: {
                          id: feedId,
                          is_partial_content: true,
                          fetch_full_content: true,
                        },
                      },
                      error: null,
                    })),
                  })),
                  single: vi.fn(() => ({
                    data: {
                      id: articleId,
                      feed_id: feedId,
                      content: "Truncated RSS content...",
                      full_content: null,
                      has_full_content: false,
                      link: "https://bbc.com/article-1",
                      feeds: {
                        id: feedId,
                        is_partial_content: true,
                        fetch_full_content: true,
                      },
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
            };
          }
          if (table === "fetch_logs") {
            return {
              insert: vi.fn(() =>
                Promise.resolve({
                  data: { id: "log-1" },
                  error: null,
                })
              ),
            };
          }
          // Default for other tables
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: null,
                  error: null,
                })),
              })),
            })),
          };
        });

        // Mock successful content extraction
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            content:
              "<p>Full extracted article content with complete details...</p>",
          }),
        });

        // Mock database update
        mockSupabase.from.mockImplementationOnce(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { full_content: "Full extracted article content..." },
                  error: null,
                })),
              })),
            })),
          })),
        }));

        const result = await service.ensureFullContent(articleId, feedId);

        expect(result.wasFetched).toBe(true);
        expect(result.content).toContain("Full extracted article");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/articles/article-1/fetch-content"),
          expect.any(Object)
        );
      });

      it("should update article.full_content after successful fetch", async () => {
        const articleId = "article-2";
        const fullContent = "Complete article content from extraction";

        // Setup mocks for successful extraction
        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  full_content: null,
                  feed_id: "partial-feed",
                  link: "https://example.com/article",
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { full_content: fullContent },
                  error: null,
                })),
              })),
            })),
          })),
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, content: fullContent }),
        });

        await service.ensureFullContent(articleId, "partial-feed");

        expect(mockSupabase.from).toHaveBeenCalledWith("articles");
        expect(mockSupabase.from().update).toHaveBeenCalledWith(
          expect.objectContaining({
            full_content: fullContent,
            has_full_content: true,
          })
        );
      });

      it("should log extraction attempt in fetch_logs table", async () => {
        const articleId = "article-3";

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === "fetch_logs") {
            return {
              insert: vi.fn(() => ({
                data: { id: "log-1" },
                error: null,
              })),
            };
          }
          // Return default mocks for other tables
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { full_content: null },
                  error: null,
                })),
              })),
            })),
          };
        });

        await service.ensureFullContent(articleId, "feed-1");

        expect(mockSupabase.from).toHaveBeenCalledWith("fetch_logs");
        expect(mockSupabase.from("fetch_logs").insert).toHaveBeenCalledWith(
          expect.objectContaining({
            article_id: articleId,
            status: expect.any(String),
            attempted_at: expect.any(String),
          })
        );
      });
    });

    describe("Skip Conditions", () => {
      it("should skip fetch when feed is not partial", async () => {
        const articleId = "article-4";
        const feedId = "techcrunch-feed";

        // Mock non-partial feed
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === "feeds") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: { is_partial_content: false },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "articles") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: {
                      content: "Full RSS content",
                      full_content: null,
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
        });

        const result = await service.ensureFullContent(articleId, feedId);

        expect(result.wasFetched).toBe(false);
        expect(result.content).toBe("Full RSS content");
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should skip fetch when article already has full content", async () => {
        const articleId = "article-5";
        const existingContent = "Already fetched full content";

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  content: "RSS content",
                  full_content: existingContent,
                  has_full_content: true,
                },
                error: null,
              })),
            })),
          })),
        });

        const result = await service.ensureFullContent(articleId, "feed-1");

        expect(result.wasFetched).toBe(false);
        expect(result.content).toBe(existingContent);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should skip fetch when both conditions are not met", async () => {
        // Non-partial feed AND existing full content
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === "feeds") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: { is_partial_content: false },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "articles") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: {
                      content: "RSS content",
                      full_content: "Existing full content",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
        });

        const result = await service.ensureFullContent("article-6", "feed-1");

        expect(result.wasFetched).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should return original content on fetch failure", async () => {
        const articleId = "article-7";
        const rssContent = "Original RSS content";

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  content: rssContent,
                  full_content: null,
                  link: "https://example.com/article",
                },
                error: null,
              })),
            })),
          })),
        });

        // Mock fetch failure
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const result = await service.ensureFullContent(
          articleId,
          "partial-feed"
        );

        expect(result.wasFetched).toBe(false);
        expect(result.content).toBe(rssContent);
      });

      it("should log extraction attempt even on failure", async () => {
        const articleId = "article-8";

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === "fetch_logs") {
            return {
              insert: vi.fn(() => ({ data: null, error: null })),
            };
          }
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { full_content: null },
                  error: null,
                })),
              })),
            })),
          };
        });

        mockFetch.mockRejectedValueOnce(new Error("Extraction failed"));

        await service.ensureFullContent(articleId, "feed-1");

        expect(mockSupabase.from).toHaveBeenCalledWith("fetch_logs");
        expect(mockSupabase.from("fetch_logs").insert).toHaveBeenCalledWith(
          expect.objectContaining({
            article_id: articleId,
            status: "failed",
          })
        );
      });

      it("should handle null/undefined article gracefully", async () => {
        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: { message: "Article not found" },
              })),
            })),
          })),
        });

        await expect(
          service.ensureFullContent("non-existent", "feed-1")
        ).rejects.toThrow("Article not found");
      });

      it("should handle extraction returning empty content", async () => {
        const articleId = "article-9";
        const rssContent = "Fallback RSS content";

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  content: rssContent,
                  full_content: null,
                  link: "https://example.com/article",
                },
                error: null,
              })),
            })),
          })),
        });

        // Mock extraction returning empty content
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, content: "" }),
        });

        const result = await service.ensureFullContent(
          articleId,
          "partial-feed"
        );

        expect(result.wasFetched).toBe(false);
        expect(result.content).toBe(rssContent);
      });
    });

    describe("Performance", () => {
      it("should respect 30-second timeout", async () => {
        const articleId = "article-timeout";

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  content: "RSS content",
                  full_content: null,
                  link: "https://slow-site.com/article",
                },
                error: null,
              })),
            })),
          })),
        });

        // Mock slow fetch that exceeds timeout
        mockFetch.mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({
                  ok: true,
                  json: async () => ({ success: true, content: "Too late" }),
                });
              }, 35000); // 35 seconds
            })
        );

        const startTime = Date.now();
        const result = await service.ensureFullContent(
          articleId,
          "partial-feed"
        );
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(31000); // Should timeout at 30s
        expect(result.wasFetched).toBe(false);
        expect(result.content).toBe("RSS content");
      });

      it("should not exceed MAX_CONCURRENT_PARSES limit", async () => {
        const articles = Array.from({ length: 5 }, (_, i) => `article-${i}`);

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  content: "RSS",
                  full_content: null,
                  link: "https://example.com/article",
                },
                error: null,
              })),
            })),
          })),
        });

        let concurrentCount = 0;
        let maxConcurrent = 0;

        mockFetch.mockImplementation(() => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);

          return new Promise((resolve) => {
            setTimeout(() => {
              concurrentCount--;
              resolve({
                ok: true,
                json: async () => ({ success: true, content: "Content" }),
              });
            }, 100);
          });
        });

        // Start all fetches concurrently
        const promises = articles.map((id) =>
          service.ensureFullContent(id, "partial-feed")
        );

        await Promise.all(promises);

        expect(maxConcurrent).toBeLessThanOrEqual(3); // MAX_CONCURRENT_PARSES
      });

      it("should queue requests when concurrent limit reached", async () => {
        const articles = Array.from({ length: 6 }, (_, i) => `article-${i}`);
        const fetchOrder: string[] = [];

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn((field: string, value: string) => ({
              single: vi.fn(() => ({
                data: {
                  id: value,
                  content: "RSS",
                  full_content: null,
                  link: `https://example.com/${value}`,
                },
                error: null,
              })),
            })),
          })),
        });

        mockFetch.mockImplementation((url: string) => {
          const match = url.match(/articles\/(article-\d+)/);
          if (match) {
            fetchOrder.push(match[1]);
          }

          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ success: true, content: "Content" }),
              });
            }, 50);
          });
        });

        const promises = articles.map((id) =>
          service.ensureFullContent(id, "partial-feed")
        );

        await Promise.all(promises);

        // First 3 should start immediately, next 3 should wait
        expect(fetchOrder.slice(0, 3)).toEqual(
          expect.arrayContaining(["article-0", "article-1", "article-2"])
        );
      });
    });

    describe("Database Transactions", () => {
      it("should update article atomically", async () => {
        const articleId = "article-atomic";

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  content: "RSS",
                  full_content: null,
                  link: "https://example.com/article",
                },
                error: null,
              })),
            })),
          })),
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

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, content: "New content" }),
        });

        // Should handle update failure gracefully
        const result = await service.ensureFullContent(
          articleId,
          "partial-feed"
        );

        expect(result.wasFetched).toBe(false);
        expect(result.content).toBe("RSS"); // Falls back to original
      });

      it("should handle concurrent updates safely", async () => {
        const articleId = "article-concurrent";
        let updateCount = 0;

        mockSupabase.from.mockReturnValue({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  content: "RSS",
                  full_content: null,
                  link: "https://example.com/article",
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => {
            updateCount++;
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: { full_content: "Updated" },
                    error: null,
                  })),
                })),
              })),
            };
          }),
        });

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, content: "Content" }),
        });

        // Simulate concurrent requests for same article
        const promises = Array.from({ length: 3 }, () =>
          service.ensureFullContent(articleId, "partial-feed")
        );

        await Promise.all(promises);

        // Should only update once despite concurrent requests
        expect(updateCount).toBe(1);
      });
    });
  });

  describe("fetchFullContent", () => {
    it("should call extraction API with correct parameters", async () => {
      const articleId = "article-10";
      const articleUrl = "https://example.com/article-10";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Extracted content</p>",
        }),
      });

      await service["fetchFullContent"](articleId, articleUrl);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/articles/${articleId}/fetch-content`),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining(articleUrl),
        })
      );
    });

    it("should parse HTML content correctly", async () => {
      const htmlContent = "<p>Paragraph 1</p><p>Paragraph 2</p>";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: htmlContent,
        }),
      });

      const result = await service["fetchFullContent"]("id", "url");

      expect(result).toBe(htmlContent);
    });

    it("should sanitize extracted content", async () => {
      const unsafeContent = '<script>alert("xss")</script><p>Safe content</p>';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: unsafeContent,
        }),
      });

      const result = await service["fetchFullContent"]("id", "url");

      expect(result).not.toContain("<script>");
      expect(result).toContain("Safe content");
    });

    it("should handle malformed HTML gracefully", async () => {
      const malformedHtml = "<p>Unclosed paragraph <div>Mixed tags</p>";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: malformedHtml,
        }),
      });

      const result = await service["fetchFullContent"]("id", "url");

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe("checkPartialFeedStatus", () => {
    it("should return true for partial feeds", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { is_partial_content: true },
              error: null,
            })),
          })),
        })),
      });

      const isPartial = await service["checkPartialFeedStatus"]("bbc-feed");

      expect(isPartial).toBe(true);
    });

    it("should return false for complete feeds", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { is_partial_content: false },
              error: null,
            })),
          })),
        })),
      });

      const isPartial =
        await service["checkPartialFeedStatus"]("techcrunch-feed");

      expect(isPartial).toBe(false);
    });

    it("should handle missing feed gracefully", async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: "Feed not found" },
            })),
          })),
        })),
      });

      const isPartial = await service["checkPartialFeedStatus"]("unknown-feed");

      expect(isPartial).toBe(false); // Safe default
    });
  });
});
