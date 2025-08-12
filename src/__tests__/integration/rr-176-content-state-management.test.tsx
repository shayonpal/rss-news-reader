import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleDetail } from "@/components/articles/article-detail";
import type { Article, Feed } from "@/types";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => ({
    getArticle: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/lib/stores/feed-store", () => ({
  useFeedStore: () => ({
    updateFeedPartialContent: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock DOMPurify
vi.mock("isomorphic-dompurify", () => ({
  default: {
    sanitize: (content: string) => content,
  },
}));

describe("RR-176: Content State Management - Integration Tests", () => {
  const mockArticle: Article = {
    id: "article-123",
    feedId: "feed-123",
    title: "Test Article Title",
    content:
      "<p>Original RSS content that is quite long to avoid auto-fetch</p>".repeat(
        20
      ),
    url: "https://example.com/article",
    publishedAt: new Date().toISOString(),
    author: "Test Author",
    isRead: false,
    isStarred: false,
    hasFullContent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockPartialFeed: Feed = {
    id: "feed-123",
    title: "Partial Feed",
    url: "https://partialfeed.com",
    isPartialContent: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockNormalFeed: Feed = {
    id: "feed-456",
    title: "Normal Feed",
    url: "https://normalfeed.com",
    isPartialContent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Content Display Priority", () => {
    it("should prioritize manually fetched content over auto-parsed content", async () => {
      // Setup auto-parse to succeed
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Auto-parsed content from partial feed</p>",
        }),
      });

      const { container } = render(
        <ArticleDetail
          article={{ ...mockArticle, content: "Short" }} // Trigger auto-parse
          feed={mockPartialFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Wait for auto-parse to complete
      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain(
          "Auto-parsed content from partial feed"
        );
      });

      // Now manually fetch content
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Manually fetched full content</p>",
        }),
      });

      // Find and click the fetch button (there might be multiple)
      const fetchButtons = screen.getAllByRole("button", {
        name: /full content/i,
      });
      await userEvent.click(fetchButtons[0]);

      // Manual content should take priority
      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Manually fetched full content");
        expect(content?.innerHTML).not.toContain("Auto-parsed content");
      });
    });

    it("should revert to auto-parsed content when manual content cleared", async () => {
      // Setup with auto-parsed content
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Auto-parsed content</p>",
        }),
      });

      const { container } = render(
        <ArticleDetail
          article={{ ...mockArticle, content: "Short" }}
          feed={mockPartialFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Auto-parsed content");
      });

      // Manually fetch different content
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Manual content</p>",
        }),
      });

      const fetchButtons = screen.getAllByRole("button", {
        name: /full content/i,
      });
      await userEvent.click(fetchButtons[0]);

      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Manual content");
      });

      // Click revert button
      const revertButtons = screen.getAllByRole("button", {
        name: /original content/i,
      });
      await userEvent.click(revertButtons[0]);

      // Should show auto-parsed content, not original RSS
      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Auto-parsed content");
        expect(content?.innerHTML).not.toContain("Manual content");
      });
    });

    it("should show original RSS content when no parsed or fetched content", async () => {
      const { container } = render(
        <ArticleDetail
          article={mockArticle} // Long content, won't auto-parse
          feed={mockNormalFeed} // Not a partial feed
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Should show original content immediately
      const content = container.querySelector(".article-content");
      expect(content?.innerHTML).toContain("Original RSS content");

      // Verify no auto-fetch triggered
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Button Synchronization", () => {
    it("should synchronize state between header and footer buttons", async () => {
      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockNormalFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Get both button instances
      const allButtons = screen.getAllByRole("button");
      const fetchButtons = allButtons.filter(
        (btn) => btn.getAttribute("aria-label") === "Full Content"
      );

      // Should have at least 2 fetch buttons (header and footer)
      expect(fetchButtons.length).toBeGreaterThanOrEqual(2);

      // Setup successful fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Fetched content</p>",
        }),
      });

      // Click the first (header) button
      await userEvent.click(fetchButtons[0]);

      // Both buttons should update to show "Original Content"
      await waitFor(() => {
        const revertButtons = screen
          .getAllByRole("button")
          .filter(
            (btn) => btn.getAttribute("aria-label") === "Original Content"
          );
        expect(revertButtons.length).toBeGreaterThanOrEqual(2);
      });

      // Click the second (footer) button to revert
      const revertButtons = screen
        .getAllByRole("button")
        .filter((btn) => btn.getAttribute("aria-label") === "Original Content");
      await userEvent.click(revertButtons[1]);

      // Both should revert back to "Full Content"
      await waitFor(() => {
        const fetchButtonsAfter = screen
          .getAllByRole("button")
          .filter((btn) => btn.getAttribute("aria-label") === "Full Content");
        expect(fetchButtonsAfter.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should prevent desync during rapid clicks", async () => {
      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockNormalFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const fetchButtons = screen
        .getAllByRole("button")
        .filter((btn) => btn.getAttribute("aria-label") === "Full Content");

      // Mock a slow fetch
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    success: true,
                    content: "<p>Fetched</p>",
                  }),
                }),
              100
            )
          )
      );

      // Click both buttons rapidly
      await userEvent.click(fetchButtons[0]);
      await userEvent.click(fetchButtons[1]);

      // Should only trigger one fetch
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Wait for completion
      await waitFor(() => {
        const revertButtons = screen
          .getAllByRole("button")
          .filter(
            (btn) => btn.getAttribute("aria-label") === "Original Content"
          );
        expect(revertButtons.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("State Persistence", () => {
    it("should maintain fetched content when summary is generated", async () => {
      const { container } = render(
        <ArticleDetail
          article={mockArticle}
          feed={mockNormalFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Fetch content first
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Fetched full content</p>",
        }),
      });

      const fetchButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("aria-label") === "Full Content");
      await userEvent.click(fetchButton!);

      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Fetched full content");
      });

      // Simulate summary generation (would normally update article)
      // The fetched content should remain
      const summaryButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("aria-label")?.includes("Summary"));

      if (summaryButton) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            summary: "Article summary",
          }),
        });

        await userEvent.click(summaryButton);

        // Content should still show fetched content
        await waitFor(() => {
          const content = container.querySelector(".article-content");
          expect(content?.innerHTML).toContain("Fetched full content");
        });
      }
    });

    it("should clear temporary states on article change", async () => {
      const { rerender, container } = render(
        <ArticleDetail
          article={{ ...mockArticle, id: "article-1" }}
          feed={mockNormalFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Fetch content for first article
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Article 1 fetched content</p>",
        }),
      });

      const fetchButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("aria-label") === "Full Content");
      await userEvent.click(fetchButton!);

      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Article 1 fetched content");
      });

      // Change to different article
      rerender(
        <ArticleDetail
          article={{
            ...mockArticle,
            id: "article-2",
            content: "<p>Article 2 RSS content</p>",
          }}
          feed={mockNormalFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Should show new article's RSS content, not previous fetched content
      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Article 2 RSS content");
        expect(content?.innerHTML).not.toContain("Article 1 fetched content");
      });

      // Buttons should reset to initial state
      const newFetchButtons = screen
        .getAllByRole("button")
        .filter((btn) => btn.getAttribute("aria-label") === "Full Content");
      expect(newFetchButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Error Recovery", () => {
    it("should maintain previous content on fetch error", async () => {
      const { container } = render(
        <ArticleDetail
          article={mockArticle}
          feed={mockNormalFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Initial content
      expect(container.querySelector(".article-content")?.innerHTML).toContain(
        "Original RSS content"
      );

      // Mock fetch failure
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const fetchButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("aria-label") === "Full Content");
      await userEvent.click(fetchButton!);

      // Should still show original content after error
      await waitFor(() => {
        const content = container.querySelector(".article-content");
        expect(content?.innerHTML).toContain("Original RSS content");
      });

      // Error message should be displayed
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it("should allow retry after fetch failure", async () => {
      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockNormalFeed}
          feedTitle="Test Feed"
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // First attempt fails
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const fetchButton = screen
        .getAllByRole("button")
        .find((btn) => btn.getAttribute("aria-label") === "Full Content");
      await userEvent.click(fetchButton!);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Second attempt succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          content: "<p>Successfully fetched</p>",
        }),
      });

      await userEvent.click(fetchButton!);

      await waitFor(() => {
        expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
      });
    });
  });
});
