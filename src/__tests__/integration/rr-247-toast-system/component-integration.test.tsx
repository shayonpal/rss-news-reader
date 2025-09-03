/**
 * RR-247: ArticleDetail Toast Integration Tests
 *
 * Tests component integration with new toast utility classes.
 * These tests MUST pass after implementation - they define the specification.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { toast } from "sonner";
import { ArticleDetail } from "@/components/articles/article-detail";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useArticleStore } from "@/lib/stores/article-store";

// Mock Sonner toast library
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn((message, options) => `loading-${Date.now()}`),
    success: vi.fn((message, options) => `success-${Date.now()}`),
    error: vi.fn((message, options) => `error-${Date.now()}`),
    dismiss: vi.fn(),
  },
}));

// Mock stores
vi.mock("@/lib/stores/feed-store");
vi.mock("@/lib/stores/article-store");

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => "/reader"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

describe("ArticleDetail Toast Integration", () => {
  const mockArticle = {
    id: "test-article-123",
    feedId: "test-feed-456",
    title: "Test Article",
    content: "<p>Test content</p>",
    url: "https://example.com/article",
    publishedAt: new Date(),
    isRead: false,
    isStarred: false,
    tags: [],
    summary: null,
    author: "Test Author",
  };

  const mockFeed = {
    id: "test-feed-456",
    title: "Test Feed",
    url: "https://example.com/feed",
    isPartialContent: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock feed store
    vi.mocked(useFeedStore).mockReturnValue({
      feeds: [mockFeed],
      updateFeedPartialContent: vi.fn().mockResolvedValue(undefined),
    } as any);

    // Mock article store
    vi.mocked(useArticleStore).mockReturnValue({
      getArticle: vi.fn().mockResolvedValue(mockArticle),
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("handleToggleFeedPartialContent Toast Behavior", () => {
    it("should use className instead of style prop for loading toast", async () => {
      const { container } = render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Find and click the partial content toggle button
      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalledWith(
          expect.stringContaining("Marking"),
          expect.objectContaining({
            id: expect.stringMatching(/^partial-feed-/),
            className: "toast-warning",
          })
        );
      });

      // SPECIFICATION: NO style prop should be passed
      expect(toast.loading).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          style: expect.any(Object),
        })
      );
    });

    it("should use className for success toast after successful toggle", async () => {
      const mockUpdateFeed = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useFeedStore).mockReturnValue({
        feeds: [mockFeed],
        updateFeedPartialContent: mockUpdateFeed,
      } as any);

      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("marked as partial feed"),
          expect.objectContaining({
            id: expect.stringMatching(/^partial-feed-/),
            duration: 3000,
            className: "toast-success",
          })
        );
      });

      // SPECIFICATION: NO hardcoded colors
      expect(toast.success).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          style: expect.objectContaining({
            background: expect.any(String),
          }),
        })
      );
    });

    it("should use className for error toast on API failure", async () => {
      const mockUpdateFeed = vi.fn().mockRejectedValue(new Error("API Error"));
      vi.mocked(useFeedStore).mockReturnValue({
        feeds: [mockFeed],
        updateFeedPartialContent: mockUpdateFeed,
      } as any);

      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to update"),
          expect.objectContaining({
            id: expect.stringMatching(/^partial-feed-/),
            duration: 0, // Manual dismiss for errors
            className: "toast-error",
          })
        );
      });
    });

    it("should preserve existing toast behavior (ID, duration, dismissal)", async () => {
      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        // Verify toast ID for deduplication
        const loadingCall = vi.mocked(toast.loading).mock.calls[0];
        expect(loadingCall[1]).toHaveProperty("id");
        expect(loadingCall[1].id).toMatch(/^partial-feed-test-feed-456$/);

        // Verify proper duration settings
        expect(toast.success).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            duration: 3000, // 3 second success duration
          })
        );
      });
    });

    it("should handle rapid toggle attempts with proper deduplication", async () => {
      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });

      // Rapid clicks
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        // Should only show one loading toast due to ID-based deduplication
        const loadingCalls = vi.mocked(toast.loading).mock.calls;
        const uniqueIds = new Set(loadingCalls.map((call) => call[1]?.id));
        expect(uniqueIds.size).toBe(1);
      });
    });
  });

  describe("Toast Message Content and Context", () => {
    it("should include feed name in toast messages", async () => {
      const feedWithName = { ...mockFeed, title: "My Custom Feed" };

      render(
        <ArticleDetail
          article={mockArticle}
          feed={feedWithName}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalledWith(
          expect.stringContaining("My Custom Feed"),
          expect.any(Object)
        );
      });
    });

    it("should provide appropriate loading states", async () => {
      const { rerender } = render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      // Button should show loading state
      await waitFor(() => {
        expect(toggleButton).toBeDisabled();
      });
    });
  });

  describe("Theme Integration", () => {
    it("should work correctly with violet theme classes", async () => {
      document.documentElement.classList.add("theme-violet");

      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        // Toast should still use className, theme applied via CSS
        expect(toast.loading).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            className: "toast-warning",
          })
        );
      });
    });

    it("should work correctly with dark theme", async () => {
      document.documentElement.classList.add("dark");

      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            className: "toast-warning",
          })
        );
      });
    });
  });

  describe("Backwards Compatibility", () => {
    it("should maintain RR-171 toast contract compliance", async () => {
      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(() => {
        // Should maintain the same API surface as RR-171
        const loadingCall = vi.mocked(toast.loading).mock.calls[0];
        expect(loadingCall).toHaveLength(2); // message and options
        expect(loadingCall[0]).toBeTypeOf("string");
        expect(loadingCall[1]).toBeTypeOf("object");

        // Options should have required properties
        expect(loadingCall[1]).toHaveProperty("id");
        expect(loadingCall[1]).toHaveProperty("className");
      });
    });

    it("should not break existing toast mock patterns", () => {
      // This test verifies that existing mock patterns still work
      expect(vi.mocked(toast.success)).toBeDefined();
      expect(vi.mocked(toast.error)).toBeDefined();
      expect(vi.mocked(toast.loading)).toBeDefined();

      // Mock functions should return values
      const mockId = toast.success("test", { className: "toast-success" });
      expect(mockId).toBeDefined();
      expect(typeof mockId).toBe("string");
    });
  });

  describe("Error Scenarios and Edge Cases", () => {
    it("should handle missing feed gracefully", async () => {
      render(
        <ArticleDetail
          article={mockArticle}
          feed={null}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Toggle button should not exist or be disabled
      const toggleButton = screen.queryByRole("button", {
        name: /partial content/i,
      });
      expect(toggleButton).toBeNull();
    });

    it("should handle component unmount during toast operation", async () => {
      const { unmount } = render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      // Unmount before operation completes
      unmount();

      // Should not throw errors
      await waitFor(() => {
        expect(toast.loading).toHaveBeenCalled();
      });
    });

    it("should handle network timeout scenarios", async () => {
      const mockUpdateFeed = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Network timeout")), 100)
            )
        );

      vi.mocked(useFeedStore).mockReturnValue({
        feeds: [mockFeed],
        updateFeedPartialContent: mockUpdateFeed,
      } as any);

      render(
        <ArticleDetail
          article={mockArticle}
          feed={mockFeed}
          onToggleStar={vi.fn()}
          onNavigate={vi.fn()}
          onBack={vi.fn()}
        />
      );

      const toggleButton = screen.getByRole("button", {
        name: /partial content/i,
      });
      fireEvent.click(toggleButton);

      await waitFor(
        () => {
          expect(toast.error).toHaveBeenCalledWith(
            expect.stringContaining("Failed"),
            expect.objectContaining({
              className: "toast-error",
              duration: 0, // Persistent error toast
            })
          );
        },
        { timeout: 200 }
      );
    });
  });
});
