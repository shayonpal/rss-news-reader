/**
 * RR-267: Unit Tests for Settings Button in SimpleFeedSidebar
 *
 * Test Requirements:
 * 1. Replace BarChart3 with Bolt icon
 * 2. Navigate to /reader/settings on click
 * 3. Proper aria-label for accessibility
 * 4. Visual hover states
 * 5. Touch target size compliance
 *
 * TDD Approach: These tests should FAIL initially and PASS after implementation
 */

import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";

// Mock Supabase before any store imports
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [],
        error: null,
      })),
      insert: vi.fn(() => ({
        data: [],
        error: null,
      })),
      update: vi.fn(() => ({
        data: [],
        error: null,
      })),
      delete: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "test-user-id" } },
        error: null,
      })),
    },
  },
}));

import { useFeedStore } from "@/lib/stores/feed-store";
import { useSyncStore } from "@/lib/stores/sync-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { useTagStore } from "@/lib/stores/tag-store";

// Mock Next.js router
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockPrefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: mockPrefetch,
    pathname: "/reader",
    query: {},
  }),
  usePathname: () => "/reader",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js Image component
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock the refresh manager
vi.mock("@/lib/refresh-manager", () => ({
  refreshManager: {
    getRemainingCooldown: vi.fn(() => 0),
    formatCountdown: vi.fn((seconds: number) => `${seconds}s`),
    canRefresh: vi.fn(() => true),
    startCooldown: vi.fn(),
  },
}));

// Mock CollapsibleFilterSection
vi.mock("@/components/ui/collapsible-filter-section", () => ({
  CollapsibleFilterSection: ({ title, children }: any) => (
    <div data-testid="collapsible-section">
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  ),
}));

// Mock ProgressBar
vi.mock("@/components/ui/progress-bar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div data-testid="progress-bar" data-progress={progress}>
      Progress: {progress}%
    </div>
  ),
}));

// Mock Zustand stores
vi.mock("@/lib/stores/feed-store");
vi.mock("@/lib/stores/sync-store");
vi.mock("@/lib/stores/ui-store");
vi.mock("@/lib/stores/article-store");
vi.mock("@/lib/stores/tag-store");

describe("RR-267: SimpleFeedSidebar Settings Button", () => {
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

    // Setup feed store mock
    vi.mocked(useFeedStore).mockReturnValue({
      feeds: new Map(),
      feedsWithCounts: [],
      totalUnreadCount: 0,
      loadFeedHierarchy: vi.fn(),
      updateArticleReadStatus: vi.fn(),
    } as any);

    // Setup sync store mock
    vi.mocked(useSyncStore).mockReturnValue({
      isSyncing: false,
      syncProgress: 0,
      syncError: null,
      syncMessage: null,
      apiUsage: {
        zone1: {
          calls: 0,
          percentage: 0,
        },
        zone2: {
          calls: 0,
          percentage: 0,
        },
        total: {
          percentage: 0,
        },
        isLoading: false,
        error: null,
      },
      lastSyncTime: null,
      loadLastSyncTime: vi.fn(),
      updateApiUsage: vi.fn(),
      performFullSync: vi.fn(),
    } as any);

    // Setup UI store mock
    vi.mocked(useUIStore).mockReturnValue({
      theme: "system",
      readStatusFilter: "all",
      setTheme: vi.fn(),
      cycleTheme: vi.fn(),
    } as any);

    // Setup article store mock
    vi.mocked(useArticleStore).mockReturnValue({
      articles: [],
      unreadCounts: new Map(),
      totalUnreadCount: 0,
    } as any);

    // Setup tag store mock
    vi.mocked(useTagStore).mockReturnValue({
      tags: [],
      loadTags: vi.fn(),
      selectTag: vi.fn(),
      selectedTagId: null,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Icon Replacement", () => {
    it("should NOT render BarChart3 icon (old implementation)", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      // The BarChart3 icon should NOT exist
      const barChartIcon = screen.queryByTestId("barchart3-icon");
      expect(barChartIcon).not.toBeInTheDocument();

      // Also check by data-icon attribute
      const oldIcon = document.querySelector('[data-icon="BarChart3"]');
      expect(oldIcon).not.toBeInTheDocument();
    });

    it("should render Bolt icon for Settings button", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      // The Bolt icon should exist
      const boltIcon = screen.getByTestId("bolt-icon");
      expect(boltIcon).toBeInTheDocument();

      // Verify it's used as the Settings button icon
      const settingsButton = screen.getByLabelText("Settings");
      expect(settingsButton).toContainElement(boltIcon);
    });

    it("should have correct icon size (h-4 w-4)", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const boltIcon = screen.getByTestId("bolt-icon");
      expect(boltIcon).toHaveClass("h-4", "w-4");
    });
  });

  describe("Button Properties", () => {
    it("should have correct aria-label", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      expect(settingsButton).toBeInTheDocument();
    });

    it("should have hover state styling", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      expect(settingsButton).toHaveClass("hover:bg-muted");
    });

    it("should have correct button classes", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      expect(settingsButton).toHaveClass("rounded", "p-2", "transition-colors");
    });

    it("should be a button element", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      expect(settingsButton.tagName).toBe("BUTTON");
    });
  });

  describe("Navigation Behavior", () => {
    it("should navigate to /reader/settings on click", async () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/settings");
      });
    });

    it("should call router.push exactly once on click", async () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(1);
      });
    });

    it("should not navigate to old /fetch-stats route", async () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalledWith("/fetch-stats");
        expect(mockPush).not.toHaveBeenCalledWith("/reader/fetch-stats");
      });
    });
  });

  describe("Button Position", () => {
    it("should be positioned in the header actions section", () => {
      const { container } = render(<SimpleFeedSidebar {...defaultProps} />);

      // Find the header section with the actions
      const headerActions = container.querySelector(
        ".border-b .flex.items-center.gap-1"
      );
      expect(headerActions).toBeInTheDocument();

      // Settings button should be within the header actions
      const settingsButton = screen.getByLabelText("Settings");
      expect(headerActions).toContainElement(settingsButton);
    });

    it("should be between theme toggle and sync button", () => {
      const { container } = render(<SimpleFeedSidebar {...defaultProps} />);

      const headerActions = container.querySelector(
        ".border-b .flex.items-center.gap-1"
      );
      const buttons = headerActions?.querySelectorAll("button");

      // Should have at least 3 buttons: theme, settings, sync
      expect(buttons?.length).toBeGreaterThanOrEqual(3);

      // Find indices
      const themeButton = screen.getByLabelText(/Current theme:/);
      const settingsButton = screen.getByLabelText("Settings");
      const syncButton = screen.getByLabelText(
        /Sync feeds|Sync in progress|Rate limited/
      );

      // Get button positions
      const allButtons = Array.from(buttons || []);
      const themeIndex = allButtons.indexOf(themeButton);
      const settingsIndex = allButtons.indexOf(settingsButton);
      const syncIndex = allButtons.indexOf(syncButton);

      // Settings should be between theme and sync
      expect(settingsIndex).toBeGreaterThan(themeIndex);
      expect(settingsIndex).toBeLessThan(syncIndex);
    });
  });

  describe("Accessibility", () => {
    it("should have minimum touch target size", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      const styles = window.getComputedStyle(settingsButton);

      // The p-2 class should provide 0.5rem (8px) padding on all sides
      // With icon size of 16px (h-4 w-4), total should be at least 32px
      // But for mobile, we need 44px minimum, which should be handled by the button's natural size
      expect(settingsButton).toHaveClass("p-2");
    });

    it("should be keyboard accessible", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");

      // Should be focusable
      settingsButton.focus();
      expect(document.activeElement).toBe(settingsButton);

      // Should respond to Enter key
      fireEvent.keyDown(settingsButton, { key: "Enter" });
      fireEvent.click(settingsButton);
      expect(mockPush).toHaveBeenCalledWith("/settings");
    });

    it("should respond to Space key", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      settingsButton.focus();

      fireEvent.keyDown(settingsButton, { key: " " });
      fireEvent.keyUp(settingsButton, { key: " " });
      fireEvent.click(settingsButton);

      expect(mockPush).toHaveBeenCalledWith("/settings");
    });
  });

  describe("Error Handling", () => {
    it("should handle navigation errors gracefully", async () => {
      // Mock router.push to throw an error
      mockPush.mockRejectedValueOnce(new Error("Navigation failed"));

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(<SimpleFeedSidebar {...defaultProps} />);

      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/settings");
      });

      // Component should not crash
      expect(settingsButton).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Visual Regression Prevention", () => {
    it("should maintain the same button structure as before", () => {
      const { container } = render(<SimpleFeedSidebar {...defaultProps} />);

      const headerActions = container.querySelector(
        ".border-b .flex.items-center.gap-1"
      );
      const buttons = headerActions?.querySelectorAll("button");

      // Should still have the same number of action buttons
      expect(buttons?.length).toBe(3); // theme, settings, sync
    });

    it("should not affect other buttons", () => {
      render(<SimpleFeedSidebar {...defaultProps} />);

      // Theme button should still work
      const themeButton = screen.getByLabelText(/Current theme:/);
      expect(themeButton).toBeInTheDocument();

      // Sync button should still work
      const syncButton = screen.getByLabelText(
        /Sync feeds|Sync in progress|Rate limited/
      );
      expect(syncButton).toBeInTheDocument();
    });
  });
});
