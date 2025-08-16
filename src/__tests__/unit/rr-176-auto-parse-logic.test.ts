import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAutoParseContent } from "@/hooks/use-auto-parse-content";
import type { Article, Feed } from "@/types";

// Mock fetch globally
global.fetch = vi.fn();

describe("RR-176: useAutoParseContent Hook - Auto-Parse Logic", () => {
  let testIdCounter = 0;

  const createMockArticle = (overrides: Partial<Article> = {}): Article => ({
    id: `test-article-${++testIdCounter}`,
    feedId: "feed-123",
    title: "Test Article",
    content: "a".repeat(600), // Default to long content
    url: "https://example.com/article",
    publishedAt: new Date().toISOString(),
    author: "Test Author",
    isRead: false,
    isStarred: false,
    hasFullContent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock to initial state
    (global.fetch as any).mockClear();
    (global.fetch as any).mockReset();
  });

  afterEach(() => {
    // Don't restore mocks - keep the global.fetch mock active for the whole test suite
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    (global.fetch as any).mockReset();
  });

  describe("needsParsing Logic - Critical Regression Fix", () => {
    it("should NOT trigger auto-parse for non-partial feed with content >= 500 chars", async () => {
      const feed: Feed = {
        id: "feed-1",
        title: "Normal Feed",
        url: "https://normalfeed.com",
        isPartialContent: false, // NOT a partial feed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle({ content: "a".repeat(600) }),
          feed,
          enabled: true,
        })
      );

      // Wait a bit to ensure no auto-fetch happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT have triggered fetch
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.isParsing).toBe(false);
      expect(result.current.parsedContent).toBeNull();
    });

    it("should trigger auto-parse for partial feed regardless of content length", async () => {
      const feed: Feed = {
        id: "feed-2",
        title: "Partial Feed",
        url: "https://partialfeed.com",
        isPartialContent: true, // IS a partial feed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Full parsed content</p>",
        }),
      });

      const article = createMockArticle({ content: "a".repeat(1000) }); // Long content

      const { result } = renderHook(() =>
        useAutoParseContent({
          article,
          feed,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/reader/api/articles/${article.id}/fetch-content`,
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ forceRefresh: false }),
          })
        );
      });

      await waitFor(() => {
        expect(result.current.parsedContent).toBe("<p>Full parsed content</p>");
      });
    });

    it("should trigger for ANY feed when content < 500 chars", async () => {
      const feed: Feed = {
        id: "feed-3",
        title: "Normal Feed",
        url: "https://normalfeed.com",
        isPartialContent: false, // NOT partial
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Full content for short article</p>",
        }),
      });

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle({ content: "Short content" }), // < 500 chars
          feed,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.parsedContent).toBe(
          "<p>Full content for short article</p>"
        );
      });
    });

    it("should trigger for truncation indicators in normal feeds", async () => {
      const feed: Feed = {
        id: "feed-4",
        title: "Normal Feed",
        url: "https://normalfeed.com",
        isPartialContent: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const contentWithTruncation = "a".repeat(600) + "... Read more";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Full expanded content</p>",
        }),
      });

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle({ content: contentWithTruncation }),
          feed,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.parsedContent).toBe(
          "<p>Full expanded content</p>"
        );
      });
    });

    it("should NOT trigger when article already has full content", async () => {
      const feed: Feed = {
        id: "feed-5",
        title: "Partial Feed",
        url: "https://partialfeed.com",
        isPartialContent: true, // Even for partial feeds
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle({
            hasFullContent: true,
            fullContent: "<p>Already fetched content</p>",
          }),
          feed,
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.isParsing).toBe(false);
    });

    it("should handle undefined feed gracefully (treat as non-partial)", async () => {
      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle({ content: "a".repeat(600) }),
          feed: undefined,
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT trigger for long content without feed
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.isParsing).toBe(false);
    });

    it("should detect all truncation indicator patterns", async () => {
      const truncationPatterns = [
        "Content... Continue reading",
        "Article text [...]",
        "Summary. Click here to read more",
        "Preview text. View full article",
        "Excerpt. Read more at the source",
      ];

      const feed: Feed = {
        id: "feed-6",
        title: "Normal Feed",
        url: "https://normalfeed.com",
        isPartialContent: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      for (const pattern of truncationPatterns) {
        vi.clearAllMocks();
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            content: "<p>Full content</p>",
          }),
        });

        const { result, unmount } = renderHook(() =>
          useAutoParseContent({
            article: createMockArticle({
              content: "a".repeat(600) + " " + pattern,
            }),
            feed,
            enabled: true,
          })
        );

        await waitFor(
          () => {
            expect(global.fetch).toHaveBeenCalled();
          },
          { timeout: 1000 }
        );

        unmount();
      }
    });
  });

  describe("Manual Trigger Behavior", () => {
    it("should allow manual trigger via triggerParse function", async () => {
      const feed: Feed = {
        id: "feed-7",
        title: "Normal Feed",
        url: "https://normalfeed.com",
        isPartialContent: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Manually fetched content</p>",
        }),
      });

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle({ content: "a".repeat(600) }),
          feed,
          enabled: false, // Disabled auto-trigger
        })
      );

      // Should not auto-trigger
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(global.fetch).not.toHaveBeenCalled();

      // Manual trigger
      await result.current.triggerParse();

      await waitFor(() => {
        expect(result.current.parsedContent).toBe(
          "<p>Manually fetched content</p>"
        );
      });
    });

    it("should prevent duplicate fetches while loading", async () => {
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    success: true,
                    content: "<p>Content</p>",
                  }),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle(),
          feed: { isPartialContent: true } as Feed,
          enabled: false,
        })
      );

      // First trigger should start parsing
      await act(async () => {
        result.current.triggerParse();
      });

      // Verify parsing has started
      expect(result.current.isParsing).toBe(true);

      // Additional triggers should be ignored while parsing
      await act(async () => {
        result.current.triggerParse();
        result.current.triggerParse();
      });

      // Wait for the parsing to complete
      await waitFor(() => {
        expect(result.current.isParsing).toBe(false);
      });

      // Should only call fetch once due to duplicate prevention
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.current.parsedContent).toBe("<p>Content</p>");
    });
  });

  describe("Error Handling", () => {
    it("should handle fetch failures gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const articleWithParseAttempts = createMockArticle({
        parseAttempts: 1, // Mock parseAttempts so shouldShowRetry logic works
      });

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: articleWithParseAttempts,
          feed: { isPartialContent: true } as Feed,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.parseError).toBe("Network error");
      });

      expect(result.current.parsedContent).toBeNull();
      expect(result.current.shouldShowRetry).toBe(true);
    });

    it("should handle rate limit errors specially", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          message: "Rate limited",
        }),
      });

      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle(),
          feed: { isPartialContent: true } as Feed,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.parseError).toBe(
          "Too many requests. Please wait a moment and try again."
        );
      });
    });

    it("should not retry permanently failed articles", async () => {
      const { result } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle({ parseFailed: true }),
          feed: { isPartialContent: true } as Feed,
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup and Memory Management", () => {
    it("should abort fetch on unmount", async () => {
      const abortSpy = vi.fn();
      const originalAbortController = global.AbortController;

      // Mock AbortController
      global.AbortController = vi.fn().mockImplementation(() => ({
        abort: abortSpy,
        signal: { aborted: false },
      })) as any;

      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const { unmount } = renderHook(() =>
        useAutoParseContent({
          article: createMockArticle(),
          feed: { isPartialContent: true } as Feed,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();

      // Restore
      global.AbortController = originalAbortController;
    });

    it("should handle rapid article changes correctly", async () => {
      let fetchCount = 0;
      (global.fetch as any).mockImplementation(async () => {
        fetchCount++;
        return {
          ok: true,
          json: async () => ({
            success: true,
            content: `<p>Content ${fetchCount}</p>`,
          }),
        };
      });

      const { result, rerender } = renderHook(
        ({ article }) =>
          useAutoParseContent({
            article,
            feed: { isPartialContent: true } as Feed,
            enabled: true,
          }),
        {
          initialProps: {
            article: createMockArticle({ id: "article-1" }),
          },
        }
      );

      await waitFor(() => {
        expect(result.current.parsedContent).toBe("<p>Content 1</p>");
      });

      // Change article within act()
      await act(async () => {
        rerender({
          article: createMockArticle({ id: "article-2" }),
        });
      });

      await waitFor(
        () => {
          expect(result.current.parsedContent).toBe("<p>Content 2</p>");
        },
        { timeout: 2000 }
      );

      expect(fetchCount).toBe(2);
    });
  });
});
