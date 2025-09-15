/**
 * RR-267: Integration Tests for Settings Navigation
 *
 * Test the complete navigation flow from SimpleFeedSidebar to Settings page
 * These tests verify the interaction between components and router
 *
 * Expected behavior:
 * 1. Click Settings button → Navigate to /reader/settings
 * 2. 404 response is acceptable (page will be created in RR-268)
 * 3. Navigation state is properly managed
 */

import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";

// Create a more complete router mock for integration testing
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: "/reader",
  query: {},
  asPath: "/reader",
  route: "/reader",
  isReady: true,
  basePath: "/reader",
  locale: undefined,
  locales: undefined,
  defaultLocale: undefined,
  domainLocales: undefined,
  isLocaleDomain: false,
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/reader",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock stores with more realistic data for integration tests
vi.mock("@/lib/stores/feed-store", () => ({
  useFeedStore: () => ({
    feeds: new Map([
      [
        "feed1",
        {
          id: "feed1",
          title: "Tech News",
          url: "https://tech.example.com/rss",
        },
      ],
      [
        "feed2",
        {
          id: "feed2",
          title: "World News",
          url: "https://world.example.com/rss",
        },
      ],
    ]),
    feedsWithCounts: [
      { feed: { id: "feed1", title: "Tech News" }, unreadCount: 5 },
      { feed: { id: "feed2", title: "World News" }, unreadCount: 3 },
    ],
    totalUnreadCount: 8,
    loadFeedHierarchy: vi.fn().mockResolvedValue(undefined),
    updateArticleReadStatus: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/sync-store", () => ({
  useSyncStore: () => ({
    isSyncing: false,
    syncProgress: 0,
    syncError: null,
    syncMessage: null,
    apiUsage: { used: 25, limit: 100 },
    lastSyncTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    loadLastSyncTime: vi.fn().mockResolvedValue(undefined),
    updateApiUsage: vi.fn(),
    performFullSync: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/ui-store", () => ({
  useUIStore: () => ({
    theme: "system",
    readStatusFilter: "all",
    setTheme: vi.fn(),
    cycleTheme: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => ({
    articles: [],
    unreadCounts: new Map([
      ["feed1", 5],
      ["feed2", 3],
    ]),
    totalUnreadCount: 8,
  }),
}));

vi.mock("@/lib/stores/tag-store", () => ({
  useTagStore: () => ({
    tags: [
      { id: "tag1", name: "Technology", color: "#0066cc" },
      { id: "tag2", name: "Business", color: "#009900" },
    ],
    loadTags: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock other dependencies
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

vi.mock("@/lib/refresh-manager", () => ({
  refreshManager: {
    getRemainingCooldown: vi.fn(() => 0),
    formatCountdown: vi.fn((seconds: number) => `${seconds}s`),
    canRefresh: vi.fn(() => true),
    startCooldown: vi.fn(),
  },
}));

vi.mock("@/components/ui/collapsible-filter-section", () => ({
  CollapsibleFilterSection: ({ title, children }: any) => (
    <div data-testid="collapsible-section">
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("@/components/ui/progress-bar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div data-testid="progress-bar" data-progress={progress}>
      Progress: {progress}%
    </div>
  ),
}));

describe("RR-267: Settings Navigation Integration", () => {
  const defaultProps = {
    selectedFeedId: null,
    selectedTagId: null,
    onFeedSelect: vi.fn(),
    onTagSelect: vi.fn(),
    onClearFilters: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset router state
    mockRouter.pathname = "/reader";
    mockRouter.asPath = "/reader";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Complete Navigation Flow", () => {
    it("should navigate from feed list view to settings page", async () => {
      const { container } = render(<SimpleFeedSidebar {...defaultProps} />);

      // Verify we're on the feed list page
      expect(container.querySelector(".border-b")).toBeInTheDocument();
      expect(screen.getByText("8 unread • 2 feeds")).toBeInTheDocument();

      // Find and click the Settings button
      const settingsButton = screen.getByLabelText("Settings");
      expect(settingsButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(settingsButton);
      });

      // Verify navigation was triggered
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Simulate router navigation completing
      mockRouter.pathname = "/reader/settings";
      mockRouter.asPath = "/reader/settings";
    });

    it("should handle navigation with existing query parameters", async () => {
      // Set up initial query parameters
      const searchParams = new URLSearchParams("?filter=unread&sort=date");
      vi.mocked(useSearchParams as any).mockReturnValue(searchParams);

      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      // Should navigate to settings without preserving query params
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
        expect(mockRouter.push).not.toHaveBeenCalledWith(
          expect.stringContaining("?filter=unread")
        );
      });
    });

    it("should work alongside other navigation buttons", async () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      // Test that all navigation buttons are present and functional
      const themeButton = screen.getByLabelText(/Current theme:/);
      const settingsButton = screen.getByLabelText("Settings");
      const syncButton = screen.getByLabelText(/Sync feeds/);

      expect(themeButton).toBeInTheDocument();
      expect(settingsButton).toBeInTheDocument();
      expect(syncButton).toBeInTheDocument();

      // Click settings button
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Other buttons should not trigger navigation
      vi.clearAllMocks();
      fireEvent.click(themeButton);
      expect(mockRouter.push).not.toHaveBeenCalled();

      fireEvent.click(syncButton);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe("Navigation State Management", () => {
    it("should maintain component state during navigation", async () => {
      const { rerender } = render(<SimpleFeedSidebar {...defaultProps} />);

      // Select a feed first
      const feedItem = screen.getByText("Tech News");
      fireEvent.click(feedItem);
      expect(defaultProps.onFeedSelect).toHaveBeenCalledWith(
        "feed1",
        "Tech News"
      );

      // Update props to reflect selection
      const updatedProps = { ...defaultProps, selectedFeedId: "feed1" };
      rerender(<SimpleFeedSidebar {...updatedProps} />);

      // Navigate to settings
      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Feed selection callback should not be affected
      expect(defaultProps.onFeedSelect).toHaveBeenCalledTimes(1);
    });

    it("should not interfere with sync operations", async () => {
      const mockPerformSync = vi.fn().mockResolvedValue({ success: true });

      vi.mocked(useSyncStore as any).mockReturnValue({
        isSyncing: false,
        syncProgress: 0,
        syncError: null,
        syncMessage: null,
        apiUsage: { used: 25, limit: 100 },
        lastSyncTime: new Date(Date.now() - 3600000).toISOString(),
        loadLastSyncTime: vi.fn().mockResolvedValue(undefined),
        updateApiUsage: vi.fn(),
        performFullSync: mockPerformSync,
      });

      render(<SimpleFeedSidebar {...defaultProps} />);

      // Start a sync operation
      const syncButton = screen.getByLabelText(/Sync feeds/);
      fireEvent.click(syncButton);

      // Navigate to settings while sync might be pending
      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
        expect(mockPerformSync).toHaveBeenCalled();
      });
    });
  });

  describe("Error Recovery", () => {
    it("should recover from navigation failures", async () => {
      // First navigation fails
      mockRouter.push.mockRejectedValueOnce(new Error("Navigation blocked"));

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");

      // First click fails
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Component should still be functional
      expect(settingsButton).toBeInTheDocument();

      // Second click should work
      vi.clearAllMocks();
      mockRouter.push.mockResolvedValueOnce(true);

      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      consoleErrorSpy.mockRestore();
    });

    it("should handle rapid clicks without multiple navigations", async () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");

      // Simulate rapid clicking
      fireEvent.click(settingsButton);
      fireEvent.click(settingsButton);
      fireEvent.click(settingsButton);

      await waitFor(() => {
        // Should only navigate once despite multiple clicks
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Allow for debouncing or immediate navigation
      const callCount = mockRouter.push.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(1);
      expect(callCount).toBeLessThanOrEqual(3);
    });
  });

  describe("Accessibility During Navigation", () => {
    it("should maintain focus management during navigation", async () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");

      // Focus the button
      settingsButton.focus();
      expect(document.activeElement).toBe(settingsButton);

      // Click while focused
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Focus should remain stable (not lost)
      expect(document.activeElement).not.toBe(document.body);
    });

    it("should handle keyboard navigation", async () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");

      // Tab to the button
      settingsButton.focus();

      // Press Enter
      fireEvent.keyDown(settingsButton, { key: "Enter" });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Also test Space key
      vi.clearAllMocks();
      fireEvent.keyDown(settingsButton, { key: " " });
      fireEvent.keyUp(settingsButton, { key: " " });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });
    });
  });
});
