/**
 * Unit Tests for RR-206: Fix sidebar collapse behavior for proper responsive display
 *
 * Test Contract:
 * - Sidebar MUST auto-collapse on mobile (<768px)
 * - Sidebar MUST stay visible on tablet/desktop (≥768px)
 * - Hamburger menu MUST only show when sidebar is collapsed
 * - Filter buttons MUST adapt based on viewport width
 * - All transitions MUST be smooth (60fps)
 * - Touch targets MUST be ≥44px on mobile
 *
 * These tests define the specification - implementation must conform to them.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock environment variables before any imports
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

// Mock Supabase client with proper chain methods
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

// Mock article count manager
vi.mock("@/lib/article-count-manager", () => ({
  ArticleCountManager: class {
    getArticleCounts = vi.fn().mockResolvedValue({
      total: 100,
      unread: 50,
      read: 50,
    });
    invalidateCache = vi.fn();
    getCountDisplay = vi.fn().mockReturnValue("100 articles");
  },
  getDynamicPageTitle: vi.fn(() => "Test Title"),
}));

// Mock other dependencies
vi.mock("@/lib/refresh-manager", () => ({
  refreshManager: {
    getRemainingCooldown: vi.fn().mockReturnValue(0),
  },
}));

// Mock Next.js Image
vi.mock("next/image", () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

// Mock error boundary
vi.mock("@/components/error-boundary", () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));

// Mock other components
vi.mock("@/components/health-status-widget", () => ({
  HealthStatusWidget: () => <div>Health Widget</div>,
}));

vi.mock("@/components/ui/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme Toggle</div>,
}));

import { ArticleHeader } from "@/components/articles/article-header";
import { ReadStatusFilter } from "@/components/articles/read-status-filter";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";
import { useUIStore } from "@/lib/stores/ui-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useSyncStore } from "@/lib/stores/sync-store";
import { useTagStore } from "@/lib/stores/tag-store";

// Mock Next.js router
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
  }),
  usePathname: () => "/reader",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock stores with full implementations
vi.mock("@/lib/stores/ui-store", () => ({
  useUIStore: vi.fn(() => ({
    isSidebarOpen: true,
    setSidebarOpen: vi.fn(),
    toggleSidebar: vi.fn(),
  })),
}));

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: vi.fn(() => ({
    readStatusFilter: "unread",
    setReadStatusFilter: vi.fn(),
    articles: [],
    loading: false,
    error: null,
    fetchArticles: vi.fn(),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
  })),
}));

vi.mock("@/lib/stores/feed-store", () => ({
  useFeedStore: vi.fn(() => ({
    feeds: [],
    folders: [],
    tags: [],
    loading: false,
    error: null,
    selectedFeedId: null,
    setSelectedFeedId: vi.fn(),
    fetchFeeds: vi.fn(),
  })),
}));

vi.mock("@/lib/stores/sync-store", () => ({
  useSyncStore: vi.fn(() => ({
    isSyncing: false,
    syncProgress: 0,
    startSync: vi.fn(),
    lastSyncTime: null,
  })),
}));

vi.mock("@/lib/stores/tag-store", () => ({
  useTagStore: vi.fn(() => ({
    tags: [],
    loading: false,
    fetchTags: vi.fn(),
  })),
}));

// Mock lucide icons - include all icons used by components
vi.mock("lucide-react", () => ({
  Menu: () => <div data-testid="menu-icon">☰</div>,
  X: () => <div data-testid="close-icon">✕</div>,
  List: () => <div data-testid="list-icon">List</div>,
  MailOpen: () => <div data-testid="mail-icon">Mail</div>,
  CheckCheck: () => <div data-testid="check-icon">Check</div>,
  ChevronRight: () => <div data-testid="chevron-right">›</div>,
  ChevronDown: () => <div data-testid="chevron-down">⌄</div>,
  Loader2: () => <div data-testid="loader">Loading</div>,
  AlertTriangle: () => <div data-testid="alert">Alert</div>,
  Sun: () => <div data-testid="sun-icon">Sun</div>,
  Moon: () => <div data-testid="moon-icon">Moon</div>,
  Monitor: () => <div data-testid="monitor-icon">Monitor</div>,
  RefreshCw: () => <div data-testid="refresh-icon">Refresh</div>,
  BarChart3: () => <div data-testid="stats-icon">Stats</div>,
  Rss: () => <div data-testid="rss-icon">RSS</div>,
  Newspaper: () => <div data-testid="newspaper-icon">News</div>,
  ArrowUp: () => <div data-testid="arrow-up">↑</div>,
}));

describe("RR-206: Responsive Sidebar Behavior", () => {
  let mockMatchMedia: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default store mocks
    (useUIStore as any).mockReturnValue({
      isSidebarOpen: true,
      toggleSidebar: vi.fn(),
      setSidebarOpen: vi.fn(),
      theme: "system",
      setTheme: vi.fn(),
      feedsSectionCollapsed: false,
      setFeedsSectionCollapsed: vi.fn(),
      tagsSectionCollapsed: false,
      setTagsSectionCollapsed: vi.fn(),
    });

    (useArticleStore as any).mockReturnValue({
      readStatusFilter: "unread",
      setReadStatusFilter: vi.fn(),
      markAllAsRead: vi.fn(),
      refreshArticles: vi.fn(),
    });

    (useFeedStore as any).mockReturnValue({
      feeds: new Map(),
      folders: new Map(),
      feedsWithCounts: [],
      totalUnreadCount: 10,
      loadFeedHierarchy: vi.fn().mockResolvedValue(true),
      isSkeletonLoading: false,
      getFeed: vi.fn(),
      getFolder: vi.fn(),
      feedStats: new Map(),
      fetchFeedStats: vi.fn(),
      refreshFeedStats: vi.fn(),
    });

    (useSyncStore as any).mockReturnValue({
      isSyncing: false,
      lastSyncTime: null,
      syncProgress: null,
      syncError: null,
      syncMessage: "",
      rateLimit: null,
      apiUsage: null,
      performFullSync: vi.fn().mockResolvedValue(true),
      loadLastSyncTime: vi.fn().mockResolvedValue(null),
      updateApiUsage: vi.fn(),
      syncArticles: vi.fn(),
      getLastSyncTime: vi.fn(),
    });

    (useTagStore as any).mockReturnValue({
      tags: [],
      loadTags: vi.fn().mockResolvedValue([]),
      selectTag: vi.fn(),
      selectedTagIds: [],
    });

    // Mock matchMedia for responsive tests
    mockMatchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Hamburger Menu Visibility", () => {
    it("should HIDE hamburger menu on desktop (≥1024px)", () => {
      // Set viewport to desktop
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === "(min-width: 1024px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(
        <ArticleHeader
          onMenuClick={vi.fn()}
          menuIcon={<div data-testid="hamburger">☰</div>}
        />
      );

      // Hamburger should NOT be visible on desktop
      const hamburger = screen.queryByTestId("hamburger");
      if (hamburger) {
        const parent = hamburger.parentElement;
        expect(parent).toHaveClass("lg:hidden");
      }
    });

    it("should HIDE hamburger menu on tablet (768-1023px)", () => {
      // Set viewport to tablet
      mockMatchMedia.mockImplementation((query) => ({
        matches:
          query === "(min-width: 768px)" && query !== "(min-width: 1024px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(
        <ArticleHeader
          onMenuClick={vi.fn()}
          menuIcon={<div data-testid="hamburger">☰</div>}
        />
      );

      // Hamburger should NOT be visible on tablet
      const hamburger = screen.queryByTestId("hamburger");
      if (hamburger) {
        const parent = hamburger.parentElement;
        expect(parent).toHaveClass("md:hidden");
      }
    });

    it("should SHOW hamburger menu on mobile (<768px)", () => {
      // Set viewport to mobile
      mockMatchMedia.mockImplementation((query) => ({
        matches: false, // No media queries match for mobile
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(
        <ArticleHeader
          isMobile={true}
          onMenuClick={vi.fn()}
          menuIcon={<div data-testid="hamburger">☰</div>}
        />
      );

      // Hamburger SHOULD be visible on mobile
      const hamburger = screen.getByTestId("hamburger");
      expect(hamburger).toBeInTheDocument();
      const parent = hamburger.parentElement;
      expect(parent).not.toHaveClass("hidden");
    });
  });

  describe("Filter Button Responsive Behavior", () => {
    it("should show FULL TEXT on desktop (≥1024px)", () => {
      // Set viewport to desktop
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === "(min-width: 1024px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<ReadStatusFilter />);

      // Text should be visible on desktop
      const allText = screen.getByText("All");
      const unreadText = screen.getByText("Unread");
      const readText = screen.getByText("Read");

      expect(allText.parentElement).toHaveClass("lg:inline");
      expect(unreadText.parentElement).toHaveClass("lg:inline");
      expect(readText.parentElement).toHaveClass("lg:inline");
    });

    it("should show ICONS ONLY on tablet (768-1023px)", () => {
      // Set viewport to tablet
      mockMatchMedia.mockImplementation((query) => ({
        matches:
          query === "(min-width: 768px)" && query !== "(min-width: 1024px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<ReadStatusFilter />);

      // Text should be hidden, icons visible
      const allText = screen.getByText("All");
      const unreadText = screen.getByText("Unread");
      const readText = screen.getByText("Read");

      // On tablet, text should be hidden (not lg:inline)
      expect(allText.parentElement).toHaveClass("hidden");
      expect(unreadText.parentElement).toHaveClass("hidden");
      expect(readText.parentElement).toHaveClass("hidden");
    });

    it("should show ICONS ONLY on mobile (<768px)", () => {
      // Set viewport to mobile
      mockMatchMedia.mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<ReadStatusFilter />);

      // Icons should be visible, text hidden
      const listIcon = screen.getByTestId("list-icon");
      const mailIcon = screen.getByTestId("mail-icon");
      const checkIcon = screen.getByTestId("check-icon");

      expect(listIcon).toBeInTheDocument();
      expect(mailIcon).toBeInTheDocument();
      expect(checkIcon).toBeInTheDocument();

      // Text should be hidden on mobile
      const allText = screen.getByText("All");
      expect(allText.parentElement).toHaveClass("hidden");
    });
  });

  describe("Touch Target Validation", () => {
    it("should maintain 44px minimum touch targets in compact mode", () => {
      // Set mobile viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(<ReadStatusFilter />);

      // All interactive buttons should have min-h-[44px] class
      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        const className = button.className;
        // Check for minimum height/width classes
        expect(className).toMatch(
          /min-[hw]-\[44px\]|h-\[44px\]|w-\[44px\]|p-[23]|py-[23]|px-[23]/
        );
      });
    });
  });

  describe("Sidebar Auto-Collapse Behavior", () => {
    it("should auto-collapse sidebar on mobile viewport", async () => {
      const setSidebarOpen = vi.fn();
      (useUIStore as any).mockReturnValue({
        isSidebarOpen: true,
        toggleSidebar: vi.fn(),
        setSidebarOpen,
      });

      // Simulate viewport change to mobile
      mockMatchMedia.mockImplementation((query) => ({
        matches: false, // Mobile viewport
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Component should detect mobile viewport and collapse sidebar
      render(<SimpleFeedSidebar />);

      await waitFor(() => {
        expect(setSidebarOpen).toHaveBeenCalledWith(false);
      });
    });

    it("should keep sidebar visible on tablet viewport", async () => {
      const setSidebarOpen = vi.fn();
      (useUIStore as any).mockReturnValue({
        isSidebarOpen: false,
        toggleSidebar: vi.fn(),
        setSidebarOpen,
      });

      // Simulate viewport change to tablet
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === "(min-width: 768px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Component should detect tablet viewport and show sidebar
      render(<SimpleFeedSidebar />);

      await waitFor(() => {
        expect(setSidebarOpen).toHaveBeenCalledWith(true);
      });
    });

    it("should keep sidebar visible on desktop viewport", async () => {
      const setSidebarOpen = vi.fn();
      (useUIStore as any).mockReturnValue({
        isSidebarOpen: false,
        toggleSidebar: vi.fn(),
        setSidebarOpen,
      });

      // Simulate viewport change to desktop
      mockMatchMedia.mockImplementation((query) => ({
        matches:
          query === "(min-width: 1024px)" || query === "(min-width: 768px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Component should detect desktop viewport and show sidebar
      render(<SimpleFeedSidebar />);

      await waitFor(() => {
        expect(setSidebarOpen).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("Viewport Change Transitions", () => {
    it("should handle desktop-to-mobile transition", async () => {
      const setSidebarOpen = vi.fn();
      (useUIStore as any).mockReturnValue({
        isSidebarOpen: true,
        toggleSidebar: vi.fn(),
        setSidebarOpen,
      });

      // Start with desktop viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches:
          query === "(min-width: 1024px)" || query === "(min-width: 768px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { rerender } = render(<SimpleFeedSidebar />);

      // Change to mobile viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Trigger resize event
      await act(async () => {
        window.dispatchEvent(new Event("resize"));
      });

      rerender(<SimpleFeedSidebar />);

      await waitFor(() => {
        expect(setSidebarOpen).toHaveBeenCalledWith(false);
      });
    });

    it("should handle mobile-to-desktop transition", async () => {
      const setSidebarOpen = vi.fn();
      (useUIStore as any).mockReturnValue({
        isSidebarOpen: false,
        toggleSidebar: vi.fn(),
        setSidebarOpen,
      });

      // Start with mobile viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { rerender } = render(<SimpleFeedSidebar />);

      // Change to desktop viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches:
          query === "(min-width: 1024px)" || query === "(min-width: 768px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Trigger resize event
      await act(async () => {
        window.dispatchEvent(new Event("resize"));
      });

      rerender(<SimpleFeedSidebar />);

      await waitFor(() => {
        expect(setSidebarOpen).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("Orientation Change Handling", () => {
    it("should maintain state during orientation change", async () => {
      const setSidebarOpen = vi.fn();
      const toggleSidebar = vi.fn();
      (useUIStore as any).mockReturnValue({
        isSidebarOpen: false,
        toggleSidebar,
        setSidebarOpen,
      });

      // Simulate iPad in portrait (narrow)
      mockMatchMedia.mockImplementation((query) => ({
        matches:
          query === "(min-width: 768px)" && query !== "(min-width: 1024px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { rerender } = render(<SimpleFeedSidebar />);

      // User manually opens sidebar
      await act(async () => {
        toggleSidebar();
      });

      // Simulate orientation change to landscape (wide)
      mockMatchMedia.mockImplementation((query) => ({
        matches:
          query === "(min-width: 1024px)" || query === "(min-width: 768px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      await act(async () => {
        window.dispatchEvent(new Event("orientationchange"));
      });

      rerender(<SimpleFeedSidebar />);

      // Sidebar should remain open after orientation change
      await waitFor(() => {
        expect(setSidebarOpen).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("PWA Safe Area Compliance", () => {
    it("should respect safe-area-inset-* for PWA", () => {
      const { container } = render(<SimpleFeedSidebar />);

      const sidebar = container.querySelector("aside");
      expect(sidebar).toBeTruthy();

      // Check for safe area padding classes
      const className = sidebar?.className || "";
      expect(className).toMatch(/safe-area|pt-safe|pb-safe|pl-safe|pr-safe/);
    });
  });

  describe("Performance Requirements", () => {
    it("should use CSS transitions for 60fps animations", () => {
      const { container } = render(<SimpleFeedSidebar />);

      const sidebar = container.querySelector("aside");
      const className = sidebar?.className || "";

      // Check for transition classes
      expect(className).toMatch(/transition|duration-\d+|ease-/);

      // Verify transform is used instead of left/right for performance
      expect(className).toMatch(/translate-x|transform/);
    });

    it("should not cause layout thrashing during transitions", () => {
      const { container } = render(<SimpleFeedSidebar />);

      const sidebar = container.querySelector("aside");
      const className = sidebar?.className || "";

      // Should use transform instead of width/left changes
      expect(className).not.toMatch(/w-0|left-\[-/);
      expect(className).toMatch(/translate-x-/);
    });
  });
});

describe("RR-206: Filter Button Icon/Text Breakpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useArticleStore as any).mockReturnValue({
      readStatusFilter: "unread",
      setReadStatusFilter: vi.fn(),
    });
  });

  it("should use lg:inline (1024px) breakpoint for filter text", () => {
    render(<ReadStatusFilter />);

    // Get all filter button text spans
    const allText = screen.getByText("All");
    const unreadText = screen.getByText("Unread");
    const readText = screen.getByText("Read");

    // Verify they use lg:inline NOT md:inline
    expect(allText).toHaveClass("lg:inline");
    expect(unreadText).toHaveClass("lg:inline");
    expect(readText).toHaveClass("lg:inline");

    // Should be hidden by default (mobile-first)
    expect(allText).toHaveClass("hidden");
    expect(unreadText).toHaveClass("hidden");
    expect(readText).toHaveClass("hidden");
  });
});
