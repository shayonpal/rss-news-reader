/**
 * RR-255: Integration Tests for Summary Generation Flow
 * 
 * Validates end-to-end summary generation workflow:
 * - Article card interactions
 * - API endpoint integration
 * - Error handling and rate limits
 * - Partial feed content fetching (RR-220 Phase B prep)
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import ArticleList from "@/components/articles/article-list";
import type { Article, Feed } from "@/types";

// Mock server for API responses
const server = setupServer(
  http.post("/api/articles/:id/summarize", ({ params }) => {
    return HttpResponse.json({
      success: true,
      summary: `AI-generated summary for article ${params.id}`,
      model: "claude-3-5-sonnet",
      cached: false,
      usage: {
        inputTokens: 1500,
        outputTokens: 250,
      },
    });
  })
);

// Mock data factories
const createMockArticle = (overrides?: Partial<Article>): Article => ({
  id: "article-1",
  title: "Test Article Title",
  link: "https://example.com/article-1",
  content: "Article content that needs summarization...",
  published_at: new Date().toISOString(),
  author: "Test Author",
  feed_id: "feed-1",
  user_id: "user-1",
  created_at: new Date().toISOString(),
  is_read: false,
  is_starred: false,
  reading_time: 5,
  has_full_content: false,
  full_content: null,
  ai_summary: null,
  ai_summary_model: null,
  ai_summary_generated_at: null,
  inoreader_id: "inoreader-1",
  ...overrides,
});

const createMockFeed = (overrides?: Partial<Feed>): Feed => ({
  id: "feed-1",
  title: "Test Feed",
  url: "https://example.com/feed",
  site_url: "https://example.com",
  user_id: "user-1",
  created_at: new Date().toISOString(),
  last_fetched_at: new Date().toISOString(),
  category: "Technology",
  is_partial_content: false,
  fetch_full_content: false,
  ...overrides,
});

// Mock store hooks
vi.mock("@/hooks/use-article-store", () => ({
  useArticleStore: () => ({
    articles: [
      createMockArticle({ id: "article-1", title: "First Article" }),
      createMockArticle({ id: "article-2", title: "Second Article", ai_summary: "Existing summary" }),
      createMockArticle({ id: "article-3", title: "Third Article" }),
    ],
    isLoading: false,
    error: null,
    generateSummary: vi.fn(async (articleId: string) => {
      const response = await fetch(`/api/articles/${articleId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: false }),
      });
      return response.json();
    }),
    updateArticle: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-feed-store", () => ({
  useFeedStore: () => ({
    feeds: [
      createMockFeed({ id: "feed-1", title: "Normal Feed" }),
      createMockFeed({ 
        id: "feed-2", 
        title: "BBC News", 
        is_partial_content: true 
      }),
    ],
    feedsWithCounts: new Map(),
    getFeed: (feedId: string) => 
      feedId === "feed-1" ? createMockFeed() : createMockFeed({ is_partial_content: true }),
  }),
}));

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/reader",
}));

describe("RR-255: Summary Generation Workflow Integration", () => {
  beforeEach(() => {
    server.listen({ onUnhandledRequest: "error" });
    vi.useFakeTimers();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Summary Generation Without Navigation", () => {
    it("should generate summary without navigating to article", async () => {
      const user = userEvent.setup({ delay: null });
      const mockPush = vi.fn();
      
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush,
        back: vi.fn(),
        forward: vi.fn(),
      });

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      // Find the summary button in article card
      const articleCard = screen.getByTestId("article-card-article-1");
      const summaryButton = within(articleCard).getByRole("button", { 
        name: /summarize/i 
      });

      // Click summary button
      await user.click(summaryButton);

      // Should show loading state
      expect(within(articleCard).getByRole("progressbar")).toBeInTheDocument();

      // Wait for summary to be generated
      vi.advanceTimersByTime(100);
      
      await waitFor(() => {
        expect(screen.getByText(/AI-generated summary/i)).toBeInTheDocument();
      });

      // Should NOT navigate to article detail
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should show loading indicator during API call", async () => {
      const user = userEvent.setup({ delay: null });

      // Delay API response
      server.use(
        http.post("/api/articles/:id/summarize", async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return HttpResponse.json({
            success: true,
            summary: "Delayed summary",
          });
        })
      );

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      // Should immediately show loading
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(summaryButton).toBeDisabled();
      
      // Should have loading text
      expect(screen.getByText(/generating/i)).toBeInTheDocument();

      // Advance time and wait for completion
      vi.advanceTimersByTime(600);
      
      await waitFor(() => {
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(summaryButton).not.toBeDisabled();
      });
    });

    it("should display summary in appropriate view", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
          view="card" // Card view shows inline summary
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      vi.advanceTimersByTime(100);

      await waitFor(() => {
        // Summary should appear in the card
        const articleCard = screen.getByTestId("article-card-article-1");
        expect(within(articleCard).getByText(/AI-generated summary/i)).toBeInTheDocument();
      });
    });

    it("should handle re-summarization of existing summary", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <ArticleList
          articles={[
            createMockArticle({ 
              id: "article-2", 
              ai_summary: "Old summary",
              ai_summary_generated_at: new Date().toISOString(),
            }),
          ]}
          feeds={[createMockFeed()]}
        />
      );

      // Button should show re-summarize
      const resummaryButton = screen.getByRole("button", { 
        name: /re-summarize/i 
      });

      await user.click(resummaryButton);

      vi.advanceTimersByTime(100);

      await waitFor(() => {
        // Should replace old summary
        expect(screen.queryByText("Old summary")).not.toBeInTheDocument();
        expect(screen.getByText(/AI-generated summary/i)).toBeInTheDocument();
      });
    });
  });

  describe("API Error Handling", () => {
    it("should handle API rate limits gracefully", async () => {
      const user = userEvent.setup({ delay: null });

      server.use(
        http.post("/api/articles/:id/summarize", () => {
          return HttpResponse.json(
            {
              error: "rate_limit_exceeded",
              message: "Too many requests. Please try again later.",
              retryAfter: 60,
            },
            { status: 429 }
          );
        })
      );

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      vi.advanceTimersByTime(100);

      await waitFor(() => {
        // Should show error state
        expect(summaryButton).toHaveAttribute("data-error", "true");
        
        // Should show error message
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
        
        // Button should be re-enabled for retry
        expect(summaryButton).not.toBeDisabled();
      });
    });

    it("should retry on transient failures", async () => {
      const user = userEvent.setup({ delay: null });
      let attempt = 0;

      server.use(
        http.post("/api/articles/:id/summarize", () => {
          attempt++;
          if (attempt === 1) {
            // First attempt fails
            return HttpResponse.json(
              { error: "temporary_error", message: "Service temporarily unavailable" },
              { status: 503 }
            );
          }
          // Second attempt succeeds
          return HttpResponse.json({
            success: true,
            summary: "Summary after retry",
          });
        })
      );

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      
      // First click - fails
      await user.click(summaryButton);
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
      });

      // Retry click - succeeds
      await user.click(summaryButton);
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText("Summary after retry")).toBeInTheDocument();
      });
    });

    it("should handle network failures", async () => {
      const user = userEvent.setup({ delay: null });

      server.use(
        http.post("/api/articles/:id/summarize", () => {
          return HttpResponse.error();
        })
      );

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      vi.advanceTimersByTime(100);

      await waitFor(() => {
        // Should show network error
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        
        // Button should allow retry
        expect(summaryButton).not.toBeDisabled();
        expect(summaryButton).toHaveAttribute("data-error", "true");
      });
    });

    it("should handle timeout for long content", async () => {
      const user = userEvent.setup({ delay: null });

      server.use(
        http.post("/api/articles/:id/summarize", async () => {
          // Simulate timeout (>30 seconds)
          await new Promise(resolve => setTimeout(resolve, 35000));
          return HttpResponse.json({ success: true });
        })
      );

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      // Fast-forward to timeout
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
        expect(summaryButton).not.toBeDisabled();
      });
    });
  });

  describe("Article Card Interactions", () => {
    it("should navigate to article when card clicked (not button)", async () => {
      const user = userEvent.setup({ delay: null });
      const mockPush = vi.fn();
      
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush,
        back: vi.fn(),
        forward: vi.fn(),
      });

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const articleCard = screen.getByTestId("article-card-article-1");
      
      // Click on card title (not button)
      const title = within(articleCard).getByText("Test Article Title");
      await user.click(title);

      // Should navigate to article
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/articles/article-1")
      );
    });

    it("should NOT navigate when summary button clicked", async () => {
      const user = userEvent.setup({ delay: null });
      const mockPush = vi.fn();
      
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush,
        back: vi.fn(),
        forward: vi.fn(),
      });

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      // Should NOT navigate
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should handle multiple buttons in card correctly", async () => {
      const user = userEvent.setup({ delay: null });
      const mockPush = vi.fn();
      
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush,
        back: vi.fn(),
        forward: vi.fn(),
      });

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const articleCard = screen.getByTestId("article-card-article-1");

      // Click star button - should not navigate
      const starButton = within(articleCard).getByRole("button", { name: /star/i });
      await user.click(starButton);
      expect(mockPush).not.toHaveBeenCalled();

      // Click summary button - should not navigate
      const summaryButton = within(articleCard).getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);
      expect(mockPush).not.toHaveBeenCalled();

      // Click card background - should navigate
      await user.click(articleCard);
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it("should maintain focus after summary generation", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      
      // Focus button
      summaryButton.focus();
      expect(summaryButton).toHaveFocus();

      // Generate summary
      await user.click(summaryButton);
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        // Focus should remain on button
        expect(summaryButton).toHaveFocus();
      });
    });

    it("should preserve scroll position during summary generation", async () => {
      const user = userEvent.setup({ delay: null });
      const initialScrollY = 500;

      // Mock scroll position
      Object.defineProperty(window, "scrollY", {
        value: initialScrollY,
        writable: true,
      });

      render(
        <ArticleList
          articles={Array.from({ length: 20 }, (_, i) => 
            createMockArticle({ id: `article-${i}` })
          )}
          feeds={[createMockFeed()]}
        />
      );

      // Find a summary button in the middle of the list
      const summaryButtons = screen.getAllByRole("button", { name: /summarize/i });
      await user.click(summaryButtons[10]);

      vi.advanceTimersByTime(100);

      await waitFor(() => {
        // Scroll position should be preserved
        expect(window.scrollY).toBe(initialScrollY);
      });
    });
  });

  describe("Partial Feed Content Handling (RR-220 Prep)", () => {
    it("should detect partial feed articles needing full content", async () => {
      const user = userEvent.setup({ delay: null });

      // Mock partial feed article
      const partialArticle = createMockArticle({
        id: "partial-1",
        feed_id: "feed-2", // BBC partial feed
        has_full_content: false,
        full_content: null,
      });

      render(
        <ArticleList
          articles={[partialArticle]}
          feeds={[createMockFeed({ id: "feed-2", is_partial_content: true })]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      // API should receive indicator about partial content
      await waitFor(() => {
        const requests = server.events.requests;
        const summarizeRequest = requests.find(
          req => req.url.includes("/summarize")
        );
        expect(summarizeRequest).toBeDefined();
      });
    });

    it("should cache generated summaries", async () => {
      const user = userEvent.setup({ delay: null });
      let apiCallCount = 0;

      server.use(
        http.post("/api/articles/:id/summarize", () => {
          apiCallCount++;
          return HttpResponse.json({
            success: true,
            summary: "Cached summary",
            cached: apiCallCount > 1,
          });
        })
      );

      const { rerender } = render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      // First generation
      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText("Cached summary")).toBeInTheDocument();
      });

      // Rerender with same article (simulating navigation back)
      rerender(
        <ArticleList
          articles={[createMockArticle({ ai_summary: "Cached summary" })]}
          feeds={[createMockFeed()]}
        />
      );

      // Should show cached summary without API call
      expect(screen.getByText("Cached summary")).toBeInTheDocument();
      expect(apiCallCount).toBe(1);
    });

    it("should track summary generation metrics", async () => {
      const user = userEvent.setup({ delay: null });
      const metricsCollector = vi.fn();

      // Mock metrics collection
      window.plausible = metricsCollector;

      render(
        <ArticleList
          articles={[createMockArticle()]}
          feeds={[createMockFeed()]}
        />
      );

      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);

      vi.advanceTimersByTime(100);

      await waitFor(() => {
        // Should track summary generation event
        expect(metricsCollector).toHaveBeenCalledWith(
          expect.stringContaining("summary"),
          expect.objectContaining({
            props: expect.objectContaining({
              article_id: "article-1",
              feed_type: "normal",
            }),
          })
        );
      });
    });
  });
});