/**
 * Integration Tests for SimpleFeedSidebar with Collapsible Feeds - RR-146
 *
 * Tests the integration of CollapsibleFilterSection with SimpleFeedSidebar:
 * - App branding and header updates
 * - Collapsible feeds section behavior
 * - State persistence during session
 * - URL updates for feed filtering
 * - Performance with many feeds
 * - Filter state preservation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { useSyncStore } from "@/lib/stores/sync-store";
import type { Feed, FeedWithUnreadCount } from "@/types";

// Mock Next.js router
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
  }),
}));

// Mock stores
vi.mock("@/lib/stores/feed-store");
vi.mock("@/lib/stores/ui-store");
vi.mock("@/lib/stores/article-store");
vi.mock("@/lib/stores/sync-store");

// Mock Radix UI Collapsible
vi.mock("@radix-ui/react-collapsible", () => ({
  Root: ({ children, open, onOpenChange, ...props }: any) => (
    <div data-state={open ? "open" : "closed"} {...props}>
      {children}
    </div>
  ),
  Trigger: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="collapsible-trigger" {...props}>
      {children}
    </button>
  ),
  Content: ({ children, ...props }: any) => (
    <div data-testid="collapsible-content" {...props}>
      {children}
    </div>
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader-icon">Loading</div>,
  RefreshCw: () => <div data-testid="refresh-icon">Refresh</div>,
  Sun: () => <div data-testid="sun-icon">Light</div>,
  Moon: () => <div data-testid="moon-icon">Dark</div>,
  Monitor: () => <div data-testid="monitor-icon">System</div>,
  BarChart3: () => <div data-testid="stats-icon">Stats</div>,
  ChevronRight: () => <div data-testid="chevron-right">›</div>,
  ChevronDown: () => <div data-testid="chevron-down">⌄</div>,
  Rss: () => <div data-testid="rss-icon">RSS</div>,
}));

// Test data
const mockFeeds: Map<string, Feed> = new Map([
  [
    "feed-1",
    {
      id: "feed-1",
      title: "Tech News",
      url: "https://tech.example.com/feed",
      folderId: null,
      unreadCount: 0,
      isActive: true,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      lastFetchedAt: new Date("2025-01-01"),
    },
  ],
  [
    "feed-2",
    {
      id: "feed-2",
      title: "Science Daily",
      url: "https://science.example.com/feed",
      folderId: null,
      unreadCount: 0,
      isActive: true,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      lastFetchedAt: new Date("2025-01-01"),
    },
  ],
  [
    "feed-3",
    {
      id: "feed-3",
      title: "Sports Updates",
      url: "https://sports.example.com/feed",
      folderId: null,
      unreadCount: 0,
      isActive: true,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      lastFetchedAt: new Date("2025-01-01"),
    },
  ],
]);

const mockFeedsWithCounts: Map<string, FeedWithUnreadCount> = new Map([
  [
    "feed-1",
    { ...mockFeeds.get("feed-1")!, unreadCount: 15 } as FeedWithUnreadCount,
  ],
  [
    "feed-2",
    { ...mockFeeds.get("feed-2")!, unreadCount: 0 } as FeedWithUnreadCount,
  ],
  [
    "feed-3",
    { ...mockFeeds.get("feed-3")!, unreadCount: 7 } as FeedWithUnreadCount,
  ],
]);

describe("RR-146: SimpleFeedSidebar Collapsible Integration Tests", () => {
  const mockFeedStore = {
    feeds: mockFeeds,
    feedsWithCounts: mockFeedsWithCounts,
    totalUnreadCount: 22,
    loadFeedHierarchy: vi.fn().mockResolvedValue(undefined),
  };

  const mockUIStore = {
    theme: "system" as const,
    setTheme: vi.fn(),
    filterSections: {
      feeds: { isCollapsed: false },
      folders: { isCollapsed: true },
      tags: { isCollapsed: true },
    },
    toggleFilterSection: vi.fn(),
    setFilterSectionCollapsed: vi.fn(),
  };

  const mockArticleStore = {
    readStatusFilter: "all" as const,
  };

  const mockSyncStore = {
    isSyncing: false,
    lastSyncTime: new Date("2025-01-07T10:00:00"),
    performFullSync: vi.fn(),
    syncError: null,
    syncProgress: 0,
    syncMessage: "",
    rateLimit: { used: 15, limit: 100 },
    loadLastSyncTime: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useFeedStore as any).mockReturnValue(mockFeedStore);
    (useUIStore as any).mockReturnValue(mockUIStore);
    (useArticleStore as any).mockReturnValue(mockArticleStore);
    (useSyncStore as any).mockReturnValue(mockSyncStore);

    // Reset window location
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/reader",
        search: "",
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("App Branding", () => {
    it("should display app name and logo in header", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByText("RSS Reader")).toBeInTheDocument();
      expect(screen.getByTestId("rss-icon")).toBeInTheDocument();
    });

    it("should have app branding with proper styling", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const header = screen.getByText("RSS Reader").closest("div");
      expect(header).toHaveClass("font-semibold", "text-lg");
    });

    it("should position branding above action buttons", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const header = screen
        .getByText("RSS Reader")
        .closest(".border-b") as HTMLElement;
      const themeButton = within(header).getByTestId("monitor-icon");
      const syncButton = within(header).getByTestId("refresh-icon");

      expect(themeButton).toBeInTheDocument();
      expect(syncButton).toBeInTheDocument();
    });
  });

  describe("Collapsible Feeds Section", () => {
    it("should render feeds in a collapsible section", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");
      expect(trigger).toBeInTheDocument();
      expect(screen.getByText("Feeds")).toBeInTheDocument();
    });

    it("should show feed count in section header", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // Should show count of feeds
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("should show total unread count in section header", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // Should show total unread count (15 + 7 = 22)
      expect(screen.getByText("22")).toBeInTheDocument();
    });

    it("should toggle collapse state on header click", async () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");

      await userEvent.click(trigger);
      expect(mockUIStore.toggleFilterSection).toHaveBeenCalledWith("feeds");
    });

    it("should show chevron right when collapsed", () => {
      mockUIStore.filterSections.feeds.isCollapsed = true;

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
      expect(screen.queryByTestId("chevron-down")).not.toBeInTheDocument();
    });

    it("should show chevron down when expanded", () => {
      mockUIStore.filterSections.feeds.isCollapsed = false;

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
      expect(screen.queryByTestId("chevron-right")).not.toBeInTheDocument();
    });

    it("should hide feed list when collapsed", () => {
      mockUIStore.filterSections.feeds.isCollapsed = true;

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const content = screen.getByTestId("collapsible-content");
      expect(content.parentElement).toHaveAttribute("data-state", "closed");
    });

    it("should show feed list when expanded", () => {
      mockUIStore.filterSections.feeds.isCollapsed = false;

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const content = screen.getByTestId("collapsible-content");
      expect(content.parentElement).toHaveAttribute("data-state", "open");

      // Verify feeds are visible
      expect(screen.getByText("Tech News")).toBeInTheDocument();
      expect(screen.getByText("Science Daily")).toBeInTheDocument();
      expect(screen.getByText("Sports Updates")).toBeInTheDocument();
    });
  });

  describe("Feed Selection and URL Updates", () => {
    it("should update URL when feed is selected", async () => {
      const onFeedSelect = vi.fn();

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={onFeedSelect} />
      );

      const techNewsFeed = screen.getByText("Tech News");
      await userEvent.click(techNewsFeed);

      expect(onFeedSelect).toHaveBeenCalledWith("feed-1");
    });

    it("should highlight selected feed", () => {
      render(
        <SimpleFeedSidebar selectedFeedId="feed-1" onFeedSelect={vi.fn()} />
      );

      const techNewsFeed = screen.getByText("Tech News").closest("div");
      expect(techNewsFeed).toHaveClass("bg-muted", "font-medium");
    });

    it("should maintain selection when toggling collapse", async () => {
      const { rerender } = render(
        <SimpleFeedSidebar selectedFeedId="feed-1" onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");
      await userEvent.click(trigger);

      // Collapse state changes but selection remains
      rerender(
        <SimpleFeedSidebar selectedFeedId="feed-1" onFeedSelect={vi.fn()} />
      );

      // Selection should persist
      expect(screen.getByText("Tech News").closest("div")).toHaveClass(
        "bg-muted"
      );
    });
  });

  describe("Filter Integration", () => {
    it("should show only feeds with unread when filter is unread", () => {
      // @ts-ignore - Testing filter behavior
      mockArticleStore.readStatusFilter = "unread";

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // Should show feeds with unread counts
      expect(screen.getByText("Tech News")).toBeInTheDocument();
      expect(screen.getByText("Sports Updates")).toBeInTheDocument();

      // Should not show feed with 0 unread
      expect(screen.queryByText("Science Daily")).not.toBeInTheDocument();
    });

    it("should show all feeds when filter is read or all", () => {
      mockArticleStore.readStatusFilter = "all";

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByText("Tech News")).toBeInTheDocument();
      expect(screen.getByText("Science Daily")).toBeInTheDocument();
      expect(screen.getByText("Sports Updates")).toBeInTheDocument();
    });

    it("should update feed count based on filter", () => {
      // @ts-ignore - Testing filter behavior
      mockArticleStore.readStatusFilter = "unread";

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // Should show count of visible feeds (2 with unread)
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("should always show selected feed regardless of filter", () => {
      // @ts-ignore - Testing filter behavior
      mockArticleStore.readStatusFilter = "unread";

      render(
        <SimpleFeedSidebar
          selectedFeedId="feed-2" // Has 0 unread
          onFeedSelect={vi.fn()}
        />
      );

      // Selected feed should be visible even with 0 unread
      expect(screen.getByText("Science Daily")).toBeInTheDocument();
    });
  });

  describe("Performance with Many Feeds", () => {
    it("should handle 64+ feeds efficiently", () => {
      // Create 64 feeds as per requirement
      const manyFeeds = new Map<string, Feed>();
      const manyFeedsWithCounts = new Map<string, FeedWithUnreadCount>();

      for (let i = 1; i <= 64; i++) {
        const feed: Feed = {
          id: `feed-${i}`,
          title: `Feed ${i}`,
          url: `https://example.com/feed-${i}`,
          folderId: null,
          unreadCount: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastFetchedAt: new Date(),
        };

        manyFeeds.set(feed.id, feed);
        manyFeedsWithCounts.set(feed.id, {
          ...feed,
          unreadCount: Math.floor(Math.random() * 50),
        });
      }

      mockFeedStore.feeds = manyFeeds;
      mockFeedStore.feedsWithCounts = manyFeedsWithCounts;

      const startTime = performance.now();

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const renderTime = performance.now() - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(100);

      // Should show correct count
      expect(screen.getByText("64")).toBeInTheDocument();
    });

    it("should maintain smooth collapse animation with many feeds", async () => {
      // Setup many feeds
      const manyFeeds = new Map<string, Feed>();
      for (let i = 1; i <= 64; i++) {
        manyFeeds.set(`feed-${i}`, {
          id: `feed-${i}`,
          title: `Feed ${i}`,
          url: `https://example.com/feed-${i}`,
          folderId: null,
          unreadCount: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastFetchedAt: new Date(),
        });
      }

      mockFeedStore.feeds = manyFeeds;

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");

      const startTime = performance.now();
      await userEvent.click(trigger);
      const animationTime = performance.now() - startTime;

      // Animation should be fast even with many items
      expect(animationTime).toBeLessThan(200);
    });
  });

  describe("Session State Persistence", () => {
    it("should persist collapse state during session", () => {
      const { rerender } = render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // Toggle collapse
      const trigger = screen.getByTestId("collapsible-trigger");
      fireEvent.click(trigger);

      expect(mockUIStore.toggleFilterSection).toHaveBeenCalledWith("feeds");

      // Simulate component remount
      rerender(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // State should persist (mocked as collapsed)
      mockUIStore.filterSections.feeds.isCollapsed = true;

      rerender(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });

    it("should not persist collapse state to localStorage", () => {
      const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");
      fireEvent.click(trigger);

      // Should not save collapse state to localStorage
      const calls = localStorageSpy.mock.calls;
      const collapseStateCalls = calls.filter(
        (call) => call[1] && call[1].includes("filterSections")
      );

      expect(collapseStateCalls).toHaveLength(0);
    });
  });

  describe("Touch Target Requirements", () => {
    it("should have 44px touch targets for collapse trigger", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");
      expect(trigger).toHaveClass("min-h-[44px]");
    });

    it("should have 44px touch targets for feed items", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const feedItem = screen.getByText("Tech News").closest("div");
      expect(feedItem).toHaveClass("p-3"); // Padding ensures 44px height
    });
  });

  describe("Empty States", () => {
    it("should show empty state when no feeds exist", () => {
      mockFeedStore.feeds = new Map();
      mockFeedStore.feedsWithCounts = new Map();

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByText("No feeds yet")).toBeInTheDocument();
      expect(screen.getByText(/Click the Sync button/)).toBeInTheDocument();
    });

    it("should still show collapsible header with 0 feeds", () => {
      mockFeedStore.feeds = new Map();

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByText("Feeds")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument(); // Feed count
    });
  });

  describe("Sync Integration", () => {
    it("should show loading state during initial sync", () => {
      mockSyncStore.isSyncing = true;
      mockFeedStore.feeds = new Map();

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
      expect(screen.getByText("Syncing your feeds...")).toBeInTheDocument();
    });

    it("should maintain collapse state during sync", () => {
      mockUIStore.filterSections.feeds.isCollapsed = true;
      mockSyncStore.isSyncing = true;

      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // Collapse state should persist during sync
      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for collapsible section", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");
      expect(trigger).toHaveAttribute("aria-expanded");
      expect(trigger).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Feeds")
      );
    });

    it("should be keyboard navigable", async () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      const trigger = screen.getByTestId("collapsible-trigger");
      trigger.focus();

      await userEvent.keyboard("{Enter}");
      expect(mockUIStore.toggleFilterSection).toHaveBeenCalledWith("feeds");
    });

    it("should announce feed counts to screen readers", () => {
      render(
        <SimpleFeedSidebar selectedFeedId={null} onFeedSelect={vi.fn()} />
      );

      // Feed count should be visible
      expect(screen.getByText("3")).toBeInTheDocument();

      // Unread count should be visible
      expect(screen.getByText("22")).toBeInTheDocument();
    });
  });
});
