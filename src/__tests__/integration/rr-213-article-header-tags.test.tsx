import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ArticleHeader } from "@/components/articles/article-header";
import { useTagStore } from "@/lib/stores/tag-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useViewport } from "@/hooks/use-viewport";
import DOMPurify from "isomorphic-dompurify";

// Mock all dependencies
vi.mock("@/lib/stores/tag-store");
vi.mock("@/lib/stores/article-store");
vi.mock("@/lib/stores/feed-store");
vi.mock("@/hooks/use-viewport");
vi.mock("@/lib/article-count-manager", () => ({
  ArticleCountManager: vi.fn().mockImplementation(() => ({
    getArticleCounts: vi.fn().mockResolvedValue({
      total: 100,
      unread: 50,
      read: 50,
    }),
    invalidateCache: vi.fn(),
    getCountDisplay: vi.fn(() => "50 unread articles"),
  })),
  getDynamicPageTitle: vi.fn((readStatus, feed, folder, tag) => {
    // Implement priority logic for tests
    if (tag) return tag.name;
    if (folder) return folder.title;
    if (feed) return feed.title;
    return "Articles";
  }),
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RR-213: ArticleHeader with Tag Support", () => {
  const mockTags = new Map([
    ["tag-123", { id: "tag-123", name: "JavaScript", slug: "javascript" }],
    ["tag-456", { id: "tag-456", name: "Python", slug: "python" }],
    [
      "tag-xss",
      {
        id: "tag-xss",
        name: "<script>alert('xss')</script>React",
        slug: "react",
      },
    ],
    ["tag-empty", { id: "tag-empty", name: "", slug: "empty" }],
    ["tag-unicode", { id: "tag-unicode", name: "日本語", slug: "japanese" }],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useTagStore as any).mockReturnValue({
      tags: mockTags,
      getSelectedTags: vi.fn(() => []),
      selectedTagIds: new Set(),
    });

    (useArticleStore as any).mockReturnValue({
      readStatusFilter: "all",
      markAllAsRead: vi.fn(),
      refreshArticles: vi.fn(),
    });

    (useFeedStore as any).mockReturnValue({
      getFeed: vi.fn(),
      getFolder: vi.fn(),
    });

    (useViewport as any).mockReturnValue({
      width: 1024,
      height: 768,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Tag Name Display", () => {
    it("should display tag name when selectedTagId is provided", async () => {
      const { rerender } = render(<ArticleHeader selectedTagId="tag-123" />);

      // Wait for hydration
      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument();
      });
    });

    it("should revert to 'Articles' when tag is deselected", async () => {
      const { rerender } = render(<ArticleHeader selectedTagId="tag-456" />);

      await waitFor(() => {
        expect(screen.getByText("Python")).toBeInTheDocument();
      });

      // Deselect tag
      rerender(<ArticleHeader selectedTagId={null} />);

      await waitFor(() => {
        expect(screen.getByText("Articles")).toBeInTheDocument();
      });
    });

    it("should handle missing tag gracefully", async () => {
      // Tag ID that doesn't exist in the store
      render(<ArticleHeader selectedTagId="deleted-tag" />);

      await waitFor(() => {
        expect(screen.getByText("Articles")).toBeInTheDocument();
      });
    });
  });

  describe("XSS Protection", () => {
    it("should sanitize tag names containing malicious scripts", async () => {
      // Mock the tag store to return the malicious tag
      (useTagStore as any).mockReturnValue({
        tags: mockTags,
        getSelectedTags: vi.fn(() => []),
        selectedTagIds: new Set(),
      });

      render(<ArticleHeader selectedTagId="tag-xss" />);

      await waitFor(() => {
        // Should display sanitized content
        const titleElement = screen.getByRole("heading", { level: 1 });
        expect(titleElement.textContent).not.toContain("<script>");
        expect(titleElement.textContent).toContain("React");
      });
    });
  });

  describe("Priority Order", () => {
    it("should prioritize tag over feed", async () => {
      (useFeedStore as any).mockReturnValue({
        getFeed: vi.fn(() => ({ id: "feed-1", title: "TechCrunch" })),
        getFolder: vi.fn(),
      });

      render(<ArticleHeader selectedTagId="tag-123" selectedFeedId="feed-1" />);

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument();
        expect(screen.queryByText("TechCrunch")).not.toBeInTheDocument();
      });
    });

    it("should prioritize tag over folder", async () => {
      (useFeedStore as any).mockReturnValue({
        getFeed: vi.fn(),
        getFolder: vi.fn(() => ({ id: "folder-1", title: "Tech News" })),
      });

      render(
        <ArticleHeader selectedTagId="tag-456" selectedFolderId="folder-1" />
      );

      await waitFor(() => {
        expect(screen.getByText("Python")).toBeInTheDocument();
        expect(screen.queryByText("Tech News")).not.toBeInTheDocument();
      });
    });

    it("should show feed when no tag selected", async () => {
      (useFeedStore as any).mockReturnValue({
        getFeed: vi.fn(() => ({ id: "feed-1", title: "Hacker News" })),
        getFolder: vi.fn(),
      });

      render(<ArticleHeader selectedTagId={null} selectedFeedId="feed-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hacker News")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty tag name", async () => {
      render(<ArticleHeader selectedTagId="tag-empty" />);

      await waitFor(() => {
        // Empty tag name should still be displayed (as empty)
        const titleElement = screen.getByRole("heading", { level: 1 });
        expect(titleElement).toBeInTheDocument();
      });
    });

    it("should handle Unicode characters in tag names", async () => {
      render(<ArticleHeader selectedTagId="tag-unicode" />);

      await waitFor(() => {
        expect(screen.getByText("日本語")).toBeInTheDocument();
      });
    });

    it("should handle undefined selectedTagId", async () => {
      render(<ArticleHeader selectedTagId={undefined} />);

      await waitFor(() => {
        expect(screen.getByText("Articles")).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("should apply correct typography classes for mobile", async () => {
      (useViewport as any).mockReturnValue({
        width: 375,
        height: 667,
        isMobile: true,
        isTablet: false,
        isDesktop: false,
      });

      render(<ArticleHeader selectedTagId="tag-123" isMobile={true} />);

      await waitFor(() => {
        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading).toHaveClass("text-lg");
      });
    });

    it("should apply correct typography classes for desktop", async () => {
      (useViewport as any).mockReturnValue({
        width: 1920,
        height: 1080,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
      });

      render(<ArticleHeader selectedTagId="tag-456" />);

      await waitFor(() => {
        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading).toHaveClass("md:text-2xl");
      });
    });
  });
});
