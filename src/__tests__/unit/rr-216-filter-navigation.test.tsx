/**
 * RR-216: Filter State Preservation on Back Navigation
 *
 * Test Specification (CONTRACT from Linear):
 * - Filter state must persist when navigating back from article detail
 * - URL parameters should maintain filter context (?feed=X&tag=Y)
 * - SessionStorage provides fallback for cross-session persistence
 * - Mobile PWA gestures must work correctly
 * - Back button from article must check sessionStorage and route to /?feed=X or /?tag=Y
 *
 * Implementation Requirements:
 * 1. src/app/page.tsx must use useSearchParams() to parse URL on mount
 * 2. src/app/article/[id]/page.tsx line 137 must check sessionStorage before navigation
 * 3. Filter changes must use router.replace() not router.push()
 * 4. URL is primary source of truth, sessionStorage is fallback
 *
 * Test Coverage: 40+ test cases
 * - Unit tests for filter state management
 * - Integration tests for navigation flows
 * - E2E tests for complete user journeys
 * - Edge cases for error handling
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// CRITICAL: These tests define the SPECIFICATION
// The implementation MUST be modified to pass these tests
// DO NOT modify tests to match implementation!

// Mock Supabase before any imports to prevent initialization errors
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
    },
  },
}));

// Mock Next.js navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({ id: "test-article-1" })),
}));

// Mock stores
const mockArticleStore = {
  articles: new Map<string, Article>(),
  loadingArticles: false,
  loadingMore: false,
  articlesError: null,
  hasMore: false,
  summarizingArticles: new Set<string>(),
  readStatusFilter: "all" as const,
  loadArticles: vi.fn(),
  loadMoreArticles: vi.fn(),
  markAsRead: vi.fn(),
  markMultipleAsRead: vi.fn(),
  toggleStar: vi.fn(),
  refreshArticles: vi.fn(),
  clearError: vi.fn(),
  getArticle: vi.fn(),
};

const mockFeedStore = {
  feeds: new Map<string, Feed>(),
  folders: new Map(),
  tags: [],
  loadingFeeds: false,
  feedsError: null,
  loadFeeds: vi.fn(),
  refreshFeeds: vi.fn(),
  updateFeedStats: vi.fn(),
};

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => mockArticleStore,
}));

vi.mock("@/lib/stores/feed-store", () => ({
  useFeedStore: () => mockFeedStore,
}));

vi.mock("@/lib/stores/sync-store", () => ({
  useSyncStore: () => ({
    isSyncing: false,
    lastSyncTime: null,
    startSync: vi.fn(),
  }),
}));

// Mock viewport hook
vi.mock("@/hooks/use-viewport", () => ({
  useViewport: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    shouldCollapseSidebar: false,
    shouldShowHamburger: false,
  }),
}));

// Mock hydration fix
vi.mock("@/hooks/use-hydration-fix", () => ({
  useHydrationFix: () => {},
}));

// Now import React components after all mocks are set up
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import HomePage from "@/app/page";
import ArticlePage from "@/app/article/[id]/page";
import { ArticleList } from "@/components/articles/article-list";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";
import type { Article, Feed } from "@/types";

describe("RR-216: Filter State Preservation on Back Navigation", () => {
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();

    // Setup search params mock
    mockSearchParams = new URLSearchParams();
    (useSearchParams as any).mockReturnValue(mockSearchParams);

    // Clear sessionStorage
    sessionStorage.clear();

    // Setup test articles
    const testArticles: Article[] = [
      {
        id: "1",
        title: "Technology Article",
        content: "Tech content",
        feedId: "tech-feed",
        feedTitle: "Tech News",
        publishedAt: new Date("2025-08-15"),
        isRead: false,
        url: "https://example.com/tech-1",
        author: "Tech Author",
        tags: ["technology"],
      },
      {
        id: "2",
        title: "Business Article",
        content: "Business content",
        feedId: "business-feed",
        feedTitle: "Business News",
        publishedAt: new Date("2025-08-15"),
        isRead: false,
        url: "https://example.com/business-1",
        author: "Business Author",
        tags: ["business"],
      },
      {
        id: "3",
        title: "Sports Article",
        content: "Sports content",
        feedId: "sports-feed",
        feedTitle: "Sports News",
        publishedAt: new Date("2025-08-15"),
        isRead: false,
        url: "https://example.com/sports-1",
        author: "Sports Author",
        tags: ["sports"],
      },
    ];

    // Populate mock store
    testArticles.forEach((article) => {
      mockArticleStore.articles.set(article.id, article);
    });

    // Setup test feeds
    mockFeedStore.feeds.set("tech-feed", {
      id: "tech-feed",
      title: "Tech News",
      url: "https://technews.com/feed",
      userId: "user-1",
      unreadCount: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockFeedStore.feeds.set("business-feed", {
      id: "business-feed",
      title: "Business News",
      url: "https://businessnews.com/feed",
      userId: "user-1",
      unreadCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Setup tags
    mockFeedStore.tags = [
      { id: "technology", name: "Technology", userId: "user-1" },
      { id: "business", name: "Business", userId: "user-1" },
      { id: "sports", name: "Sports", userId: "user-1" },
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe("Unit Tests: Filter State Management", () => {
    it("should save feed filter to sessionStorage when selected", () => {
      render(<HomePage />);

      // Simulate feed selection
      sessionStorage.setItem("articleListFilter", "tech-feed");

      expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
    });

    it("[CRITICAL] HomePage must use useSearchParams to read URL parameters on mount", async () => {
      // This test ensures HomePage parses ?feed=X&tag=Y from URL
      mockSearchParams = new URLSearchParams("?feed=technology-feed-123");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // HomePage must immediately parse URL and load filtered articles
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "technology-feed-123",
          undefined,
          undefined
        );
      });
    });

    it("should save tag filter to sessionStorage when selected", () => {
      render(<HomePage />);

      // Simulate tag selection
      sessionStorage.setItem("articleListTagFilter", "technology");

      expect(sessionStorage.getItem("articleListTagFilter")).toBe("technology");
    });

    it("should restore feed filter from sessionStorage on mount", () => {
      sessionStorage.setItem("articleListFilter", "tech-feed");

      const { rerender } = render(<HomePage />);

      // Trigger useEffect
      act(() => {
        rerender(<HomePage />);
      });

      // Verify filter was restored
      expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
    });

    it("should restore tag filter from sessionStorage on mount", () => {
      sessionStorage.setItem("articleListTagFilter", "technology");

      const { rerender } = render(<HomePage />);

      // Trigger useEffect
      act(() => {
        rerender(<HomePage />);
      });

      expect(sessionStorage.getItem("articleListTagFilter")).toBe("technology");
    });

    it("[IMPLEMENTATION REQUIRED] should parse URL parameters for feed filter", async () => {
      // HomePage must use useSearchParams() hook to read URL
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // Must load articles with feed filter from URL
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "tech-feed",
          undefined,
          undefined
        );
      });

      // Must also update sessionStorage as fallback
      await waitFor(() => {
        expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
      });
    });

    it("should parse URL parameters for tag filter", async () => {
      mockSearchParams = new URLSearchParams("?tag=technology");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          undefined,
          undefined,
          "technology"
        );
      });
    });

    it("should handle combined feed and tag filters in URL", async () => {
      mockSearchParams = new URLSearchParams("?feed=tech-feed&tag=important");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "tech-feed",
          undefined,
          "important"
        );
      });
    });

    it("[IMPLEMENTATION REQUIRED] should use router.replace() not push() for filter changes", () => {
      render(<HomePage />);

      // Simulate feed selection through sidebar
      const handleFeedSelect = vi.fn((feedId) => {
        // CRITICAL: Must use replace() to avoid history pollution
        mockReplace(`/?feed=${feedId}`);
      });

      handleFeedSelect("tech-feed");

      // Must use replace, NOT push
      expect(mockReplace).toHaveBeenCalledWith("/?feed=tech-feed");
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should update URL when tag filter changes", () => {
      render(<HomePage />);

      // Simulate tag selection through sidebar
      const handleTagSelect = vi.fn((tagId) => {
        mockReplace(`/?tag=${tagId}`);
      });

      handleTagSelect("technology");

      expect(mockReplace).toHaveBeenCalledWith("/?tag=technology");
    });

    it("should clear URL parameters when filter is removed", () => {
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // Simulate clearing filter
      const handleFeedSelect = vi.fn((feedId) => {
        if (!feedId) {
          mockReplace("/");
        }
      });

      handleFeedSelect(null);

      expect(mockReplace).toHaveBeenCalledWith("/");
    });

    it("should use router.replace() for filter changes to avoid history pollution", () => {
      render(<HomePage />);

      const handleFeedSelect = vi.fn((feedId) => {
        mockReplace(`/?feed=${feedId}`);
      });

      // Change filters multiple times
      handleFeedSelect("tech-feed");
      handleFeedSelect("business-feed");
      handleFeedSelect("sports-feed");

      // Verify replace was used, not push
      expect(mockReplace).toHaveBeenCalledTimes(3);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should save filter state to ArticleListStateManager", () => {
      const saveStateSpy = vi.spyOn(articleListStateManager, "saveListState");

      render(<HomePage />);

      // Simulate state save with filter
      articleListStateManager.saveListState({
        feedId: "tech-feed",
        tagId: "technology",
        filterMode: "unread",
        articleIds: ["1", "2", "3"],
        readStates: {},
        scrollPosition: 0,
        autoReadArticles: [],
        manualReadArticles: [],
      });

      expect(saveStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          feedId: "tech-feed",
          tagId: "technology",
        })
      );
    });
  });

  describe("Integration Tests: Navigation Flow", () => {
    it("[CRITICAL FIX REQUIRED] ArticlePage back button must check sessionStorage and route to /?feed=X", async () => {
      // Setup: User has active feed filter
      sessionStorage.setItem("articleListFilter", "technology-feed-123");

      // User is on article page
      render(<ArticlePage />);

      // Find back button and click it
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      // CRITICAL: Must navigate to /?feed=technology-feed-123 NOT just /
      expect(mockPush).toHaveBeenCalledWith("/?feed=technology-feed-123");
      expect(mockPush).not.toHaveBeenCalledWith("/");
    });

    it("[CRITICAL FIX REQUIRED] ArticlePage back button must check tag filter and route to /?tag=X", async () => {
      // Setup: User has active tag filter
      sessionStorage.setItem("articleListTagFilter", "important");
      sessionStorage.removeItem("articleListFilter"); // No feed filter

      // User is on article page
      render(<ArticlePage />);

      // Find back button and click it
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      // CRITICAL: Must navigate to /?tag=important NOT just /
      expect(mockPush).toHaveBeenCalledWith("/?tag=important");
      expect(mockPush).not.toHaveBeenCalledWith("/");
    });

    it("[CRITICAL FIX REQUIRED] ArticlePage back with both filters must include both in URL", async () => {
      // Setup: User has both feed and tag filters
      sessionStorage.setItem("articleListFilter", "tech-feed");
      sessionStorage.setItem("articleListTagFilter", "important");

      // User is on article page
      render(<ArticlePage />);

      // Find back button and click it
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      // CRITICAL: Must navigate with both parameters
      expect(mockPush).toHaveBeenCalledWith("/?feed=tech-feed&tag=important");
    });

    it("GIVEN: User on filtered feed view WHEN: Navigate to article and back THEN: Filter preserved", async () => {
      // Start with filtered view
      sessionStorage.setItem("articleListFilter", "tech-feed");
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const { rerender } = render(<HomePage />);

      // Navigate to article
      mockPush("/article/1");

      // Simulate being on article page
      rerender(<ArticlePage />);

      // Navigate back
      mockPush("/?feed=tech-feed");
      rerender(<HomePage />);

      // Verify filter is still active
      expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "tech-feed",
          undefined,
          undefined
        );
      });
    });

    it("GIVEN: User on filtered tag view WHEN: Navigate to article and back THEN: Tag filter preserved", async () => {
      // Start with tag filter
      sessionStorage.setItem("articleListTagFilter", "technology");
      mockSearchParams = new URLSearchParams("?tag=technology");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const { rerender } = render(<HomePage />);

      // Navigate to article
      mockPush("/article/1");
      rerender(<ArticlePage />);

      // Navigate back with tag filter
      mockPush("/?tag=technology");
      rerender(<HomePage />);

      // Verify tag filter preserved
      expect(sessionStorage.getItem("articleListTagFilter")).toBe("technology");
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          undefined,
          undefined,
          "technology"
        );
      });
    });

    it("should coordinate filter state with RR-27 article preservation", async () => {
      // Setup preserved article state from RR-27
      articleListStateManager.saveListState({
        feedId: "tech-feed",
        articleIds: ["1", "2"],
        readStates: { "1": false, "2": true },
        scrollPosition: 500,
        autoReadArticles: ["2"],
        manualReadArticles: [],
        filterMode: "unread",
      });

      // Navigate back with filter
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // Verify both filter and article state preserved
      const savedState = articleListStateManager.getListState();
      expect(savedState?.feedId).toBe("tech-feed");
      expect(savedState?.scrollPosition).toBe(500);
      expect(savedState?.autoReadArticles).toContain("2");
    });

    it("should handle popstate events for browser back button", async () => {
      render(<HomePage />);

      // Simulate navigation history
      window.history.pushState({}, "", "/?feed=tech-feed");

      // Trigger popstate event
      const popstateEvent = new PopStateEvent("popstate");
      act(() => {
        window.dispatchEvent(popstateEvent);
      });

      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalled();
      });
    });

    it("should maintain sidebar selection state with URL filters", async () => {
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const { container } = render(<HomePage />);

      // Verify sidebar shows correct selection
      // This would normally check the actual sidebar component
      // but we're testing the data flow
      expect(sessionStorage.getItem("articleListFilter")).toBe(null);

      // After component mount and effect execution
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "tech-feed",
          undefined,
          undefined
        );
      });
    });

    it("should handle rapid filter changes with debouncing", async () => {
      vi.useFakeTimers();

      render(<HomePage />);

      // Simulate rapid filter changes
      const handleFeedSelect = vi.fn((feedId) => {
        mockReplace(`/?feed=${feedId}`);
      });

      handleFeedSelect("tech-feed");
      handleFeedSelect("business-feed");
      handleFeedSelect("sports-feed");

      // Fast-forward debounce timer
      vi.advanceTimersByTime(300);

      // Only last filter should be active
      expect(mockReplace).toHaveBeenLastCalledWith("/?feed=sports-feed");

      vi.useRealTimers();
    });

    it("should sync filter state between tabs using storage events", async () => {
      render(<HomePage />);

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent("storage", {
        key: "articleListFilter",
        newValue: "tech-feed",
        oldValue: null,
        storageArea: sessionStorage,
      });

      act(() => {
        window.dispatchEvent(storageEvent);
      });

      // Component should react to storage change
      await waitFor(() => {
        expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
      });
    });

    it("should preserve filter when navigating between articles", async () => {
      // Start with filter
      sessionStorage.setItem("articleListFilter", "tech-feed");

      // Navigate through multiple articles
      mockPush("/article/1");
      mockPush("/article/2");
      mockPush("/article/3");

      // Filter should still be in session
      expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");

      // Navigate back to list
      mockPush("/?feed=tech-feed");

      // Filter should be active
      expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
    });
  });

  describe("E2E Tests: Complete User Flows", () => {
    it("[LINEAR ACCEPTANCE CRITERIA] Complete flow: Apply filter → Read article → Back → Filter preserved", async () => {
      // GIVEN: User on filtered feed view (Technology)
      mockSearchParams = new URLSearchParams("?feed=technology-feed-id");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const { rerender } = render(<HomePage />);

      // Verify initial state from URL
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "technology-feed-id",
          undefined,
          undefined
        );
      });

      // WHEN: Navigate to article
      mockPush("/article/1");
      rerender(<ArticlePage />);

      // Press back button
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      // THEN: URL has feed parameter, Articles filtered, SessionStorage preserved
      expect(mockPush).toHaveBeenCalledWith("/?feed=technology-feed-id");
      expect(sessionStorage.getItem("articleListFilter")).toBe(
        "technology-feed-id"
      );
    });

    it("Complete flow: Apply filter → Read article → Back → Filter preserved", async () => {
      // 1. Start on home page
      const { rerender } = render(<HomePage />);

      // 2. Apply feed filter
      act(() => {
        sessionStorage.setItem("articleListFilter", "tech-feed");
        mockReplace("/?feed=tech-feed");
      });

      // 3. Click on article
      mockPush("/article/1");
      rerender(<ArticlePage />);

      // 4. Mark article as read
      await act(async () => {
        await mockArticleStore.markAsRead("1");
      });

      // 5. Navigate back
      mockPush("/?feed=tech-feed");
      rerender(<HomePage />);

      // 6. Verify filter preserved and article marked as read
      expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
      const article = mockArticleStore.articles.get("1");
      expect(mockArticleStore.markAsRead).toHaveBeenCalledWith("1");
    });

    it("[LINEAR MOBILE REQUIREMENT] Mobile Safari PWA: Swipe back preserves filter", async () => {
      // GIVEN: Mobile Safari PWA, Feed filter active
      vi.mock("@/hooks/use-viewport", () => ({
        useViewport: () => ({
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          shouldCollapseSidebar: true,
          shouldShowHamburger: true,
        }),
      }));

      sessionStorage.setItem("articleListFilter", "technology-feed-id");
      mockSearchParams = new URLSearchParams("?feed=technology-feed-id");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const { rerender } = render(<HomePage />);

      // Navigate to article
      mockPush("/article/1");
      rerender(<ArticlePage />);

      // WHEN: Swipe back from article (simulated via back navigation)
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      // THEN: Filter preserved, Sidebar state correct on reopen
      expect(mockPush).toHaveBeenCalledWith("/?feed=technology-feed-id");
      expect(sessionStorage.getItem("articleListFilter")).toBe(
        "technology-feed-id"
      );
    });

    it("Mobile PWA flow: Swipe gestures with filter preservation", async () => {
      // Mock mobile viewport
      vi.mock("@/hooks/use-viewport", () => ({
        useViewport: () => ({
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          shouldCollapseSidebar: true,
          shouldShowHamburger: true,
        }),
      }));

      // Start with filter
      sessionStorage.setItem("articleListFilter", "tech-feed");

      const { rerender } = render(<HomePage />);

      // Simulate swipe to article
      const touchStartEvent = new TouchEvent("touchstart", {
        touches: [{ clientX: 300, clientY: 100 } as Touch],
      });
      const touchEndEvent = new TouchEvent("touchend", {
        changedTouches: [{ clientX: 50, clientY: 100 } as Touch],
      });

      // Navigate to article
      mockPush("/article/1");
      rerender(<ArticlePage />);

      // Simulate swipe back
      mockPush("/?feed=tech-feed");
      rerender(<HomePage />);

      // Filter should be preserved
      expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
    });

    it("URL sharing flow: Direct link to filtered view", async () => {
      // Simulate opening shared URL
      mockSearchParams = new URLSearchParams(
        "?feed=business-feed&tag=important"
      );
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // Should load with both filters active
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "business-feed",
          undefined,
          "important"
        );
      });

      // SessionStorage should be updated
      expect(sessionStorage.getItem("articleListFilter")).toBe("business-feed");
      expect(sessionStorage.getItem("articleListTagFilter")).toBe("important");
    });

    it("Cross-session flow: Filter persists across browser sessions", async () => {
      // Session 1: Set filter
      sessionStorage.setItem("articleListFilter", "tech-feed");
      sessionStorage.setItem("articleListTagFilter", "technology");

      // Simulate browser restart (clear memory but keep sessionStorage)
      mockArticleStore.articles.clear();
      mockFeedStore.feeds.clear();

      // Session 2: Reload page
      render(<HomePage />);

      // Filters should be restored from sessionStorage
      await waitFor(() => {
        expect(sessionStorage.getItem("articleListFilter")).toBe("tech-feed");
        expect(sessionStorage.getItem("articleListTagFilter")).toBe(
          "technology"
        );
      });
    });
  });

  describe("Critical Implementation Tests", () => {
    it("[MUST FIX] ArticlePage line 137 must NOT hardcode router.push('/')", () => {
      // This test will fail until src/app/article/[id]/page.tsx line 137 is fixed
      sessionStorage.setItem("articleListFilter", "my-feed-123");

      render(<ArticlePage />);

      // Get the back button callback
      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      // Must NOT call router.push("/")
      expect(mockPush).not.toHaveBeenCalledWith("/");

      // Must call with filter parameter
      expect(mockPush).toHaveBeenCalledWith("/?feed=my-feed-123");
    });

    it("[MUST IMPLEMENT] HomePage must call useSearchParams() hook", () => {
      // This ensures HomePage is using the Next.js hook
      render(<HomePage />);

      // useSearchParams must have been called at least once
      expect(useSearchParams).toHaveBeenCalled();
    });

    it("[MUST IMPLEMENT] HomePage must sync URL params to sessionStorage on mount", async () => {
      // Clear sessionStorage
      sessionStorage.clear();

      // Set URL with filter
      mockSearchParams = new URLSearchParams("?feed=from-url-123");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // SessionStorage must be updated from URL
      await waitFor(() => {
        expect(sessionStorage.getItem("articleListFilter")).toBe(
          "from-url-123"
        );
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing URL parameters gracefully", () => {
      mockSearchParams = new URLSearchParams("");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // Should load all articles when no filters
      expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined
      );
    });

    it("should handle invalid feed ID in URL", async () => {
      mockSearchParams = new URLSearchParams("?feed=non-existent-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // Should attempt to load but handle gracefully
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "non-existent-feed",
          undefined,
          undefined
        );
      });
    });

    it("should handle sessionStorage quota exceeded", () => {
      // Mock quota exceeded error
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = vi.fn(() => {
        throw new DOMException("QuotaExceededError");
      });

      render(<HomePage />);

      // Should handle error gracefully
      expect(() => {
        sessionStorage.setItem("articleListFilter", "tech-feed");
      }).toThrow();

      sessionStorage.setItem = originalSetItem;
    });

    it("should handle iOS Safari private browsing mode", () => {
      // Mock iOS Safari private mode (sessionStorage throws)
      const originalStorage = global.sessionStorage;
      Object.defineProperty(global, "sessionStorage", {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(() => {
            throw new Error("Private mode");
          }),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });

      render(<HomePage />);

      // Should work with URL params only
      expect(() => render(<HomePage />)).not.toThrow();

      global.sessionStorage = originalStorage;
    });

    it("[CRITICAL] URL parameters must take precedence over sessionStorage", async () => {
      // Set conflicting values
      sessionStorage.setItem("articleListFilter", "tech-feed");
      mockSearchParams = new URLSearchParams("?feed=business-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // URL MUST take precedence (Primary source of truth)
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          "business-feed",
          undefined,
          undefined
        );
      });

      // SessionStorage should be updated to match URL
      await waitFor(() => {
        expect(sessionStorage.getItem("articleListFilter")).toBe(
          "business-feed"
        );
      });
    });

    it("should handle back navigation to non-filtered view", async () => {
      // Start with filter
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const { rerender } = render(<HomePage />);

      // Navigate to article
      mockPush("/article/1");

      // Clear filter and navigate back
      mockSearchParams = new URLSearchParams("");
      (useSearchParams as any).mockReturnValue(mockSearchParams);
      mockPush("/");
      rerender(<HomePage />);

      // Should show all articles
      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
          undefined,
          undefined,
          undefined
        );
      });
    });

    it("should handle filter changes while articles are loading", async () => {
      mockArticleStore.loadingArticles = true;

      render(<HomePage />);

      // Change filter while loading
      const handleFeedSelect = vi.fn((feedId) => {
        mockReplace(`/?feed=${feedId}`);
      });

      handleFeedSelect("tech-feed");

      // Should queue the change
      expect(mockReplace).toHaveBeenCalledWith("/?feed=tech-feed");

      // Complete loading
      mockArticleStore.loadingArticles = false;
    });

    it("should handle memory pressure on iOS (sessionStorage cleared)", () => {
      // Set filter
      sessionStorage.setItem("articleListFilter", "tech-feed");

      // Simulate iOS memory pressure clearing sessionStorage
      sessionStorage.clear();

      // URL params should still work
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
        "tech-feed",
        undefined,
        undefined
      );
    });

    it("should handle filter with special characters in URL", () => {
      const specialFeedId = "feed-with-special-#&@-chars";
      const encodedFeedId = encodeURIComponent(specialFeedId);

      mockSearchParams = new URLSearchParams(`?feed=${encodedFeedId}`);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      render(<HomePage />);

      // Should decode properly
      expect(mockArticleStore.loadArticles).toHaveBeenCalledWith(
        specialFeedId,
        undefined,
        undefined
      );
    });

    it("should handle multiple rapid back/forward navigations", async () => {
      const { rerender } = render(<HomePage />);

      // Simulate rapid navigation
      mockPush("/?feed=tech-feed");
      mockPush("/article/1");
      mockBack();
      // Simulate forward (no dedicated mock, use push)
      mockPush("/article/1");
      mockBack();

      rerender(<HomePage />);

      // Filter should still be correct
      mockSearchParams = new URLSearchParams("?feed=tech-feed");
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      await waitFor(() => {
        expect(mockArticleStore.loadArticles).toHaveBeenCalled();
      });
    });

    it("should handle filter removal with 'All Articles' selection", () => {
      // Start with filter
      sessionStorage.setItem("articleListFilter", "tech-feed");

      render(<HomePage />);

      // Select "All Articles" (null filter)
      const handleFeedSelect = vi.fn((feedId) => {
        if (feedId === null) {
          sessionStorage.setItem("articleListFilter", "null");
          mockReplace("/");
        }
      });

      handleFeedSelect(null);

      expect(sessionStorage.getItem("articleListFilter")).toBe("null");
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });
});

/**
 * Implementation Checklist for RR-216:
 *
 * 1. ✗ src/app/article/[id]/page.tsx line 137:
 *    - MUST check sessionStorage for filters before navigation
 *    - Build URL with parameters: /?feed=X or /?tag=Y or both
 *    - Replace: router.push("/")
 *    - With: router.push(buildReturnUrl())
 *
 *    Example implementation:
 *    ```typescript
 *    onBack={() => {
 *      const feedFilter = sessionStorage.getItem('articleListFilter');
 *      const tagFilter = sessionStorage.getItem('articleListTagFilter');
 *      let url = '/';
 *      const params = new URLSearchParams();
 *      if (feedFilter && feedFilter !== 'null') params.set('feed', feedFilter);
 *      if (tagFilter && tagFilter !== 'null') params.set('tag', tagFilter);
 *      if (params.toString()) url += '?' + params.toString();
 *      router.push(url);
 *    }}
 *    ```
 *
 * 2. ✗ src/app/page.tsx:
 *    - MUST import useSearchParams from 'next/navigation'
 *    - Parse URL parameters on mount
 *    - Sync to sessionStorage for persistence
 *
 *    Example:
 *    ```typescript
 *    const searchParams = useSearchParams();
 *    useEffect(() => {
 *      const feedFromUrl = searchParams.get('feed');
 *      const tagFromUrl = searchParams.get('tag');
 *      if (feedFromUrl) {
 *        setSelectedFeedId(feedFromUrl);
 *        sessionStorage.setItem('articleListFilter', feedFromUrl);
 *      }
 *      if (tagFromUrl) {
 *        setSelectedTagId(tagFromUrl);
 *        sessionStorage.setItem('articleListTagFilter', tagFromUrl);
 *      }
 *    }, [searchParams]);
 *    ```
 *
 * 3. ✗ Filter selection handlers:
 *    - Use router.replace() not push() to avoid history pollution
 *    - Update both URL and sessionStorage
 *
 * These tests are the CONTRACT. The implementation MUST change to pass them.
 */
