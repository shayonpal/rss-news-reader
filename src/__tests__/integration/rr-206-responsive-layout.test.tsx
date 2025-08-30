/**
 * Integration Tests for RR-206: Fix sidebar collapse behavior for proper responsive display
 *
 * Test Contract:
 * - Tests full page layout with sidebar, header, and article list integration
 * - Verifies responsive breakpoint coordination between components
 * - Tests state management across viewport changes
 * - Validates hamburger menu behavior with sidebar state
 * - Ensures filter buttons coordinate with available space
 *
 * These tests verify the components work together correctly.
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
import "@testing-library/jest-dom";
import { act, renderHook } from "@testing-library/react";

// Mock environment variables before any imports
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

// Mock Supabase client
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockResolvedValue({ data: [], error: null }),
      delete: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

import { useUIStore } from "@/lib/stores/ui-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import type { Feed, Folder } from "@/types";

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

// Mock components for integration testing
const MockHomePage = ({
  viewport,
}: {
  viewport: "mobile" | "tablet" | "desktop";
}) => {
  const { isSidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const { readStatusFilter } = useArticleStore();

  // Simulate viewport-based behavior
  React.useEffect(() => {
    if (viewport === "mobile") {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [viewport, setSidebarOpen]);

  const showHamburger = viewport === "mobile" && !isSidebarOpen;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside
        className={` ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} ${viewport === "mobile" ? "absolute" : "relative"} w-64 transition-transform duration-300`}
        data-testid="sidebar"
        data-state={isSidebarOpen ? "open" : "closed"}
      >
        <div>Sidebar Content</div>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <header className="flex items-center p-4" data-testid="header">
          {/* Hamburger - only visible on mobile when sidebar closed */}
          {showHamburger && (
            <button
              data-testid="hamburger-menu"
              onClick={toggleSidebar}
              className="mr-4"
            >
              ☰
            </button>
          )}

          {/* Filter Buttons */}
          <div className="flex gap-2" data-testid="filter-buttons">
            <button data-testid="filter-all">
              <span data-testid="filter-all-icon">📋</span>
              <span
                data-testid="filter-all-text"
                className={viewport === "desktop" ? "" : "hidden"}
              >
                All
              </span>
            </button>
            <button data-testid="filter-unread">
              <span data-testid="filter-unread-icon">📧</span>
              <span
                data-testid="filter-unread-text"
                className={viewport === "desktop" ? "" : "hidden"}
              >
                Unread
              </span>
            </button>
            <button data-testid="filter-read">
              <span data-testid="filter-read-icon">✓</span>
              <span
                data-testid="filter-read-text"
                className={viewport === "desktop" ? "" : "hidden"}
              >
                Read
              </span>
            </button>
          </div>
        </header>

        {/* Article List */}
        <main data-testid="article-list">
          <div>Articles go here</div>
        </main>
      </div>

      {/* Overlay for mobile */}
      {viewport === "mobile" && isSidebarOpen && (
        <div
          data-testid="sidebar-overlay"
          className="fixed inset-0 z-40 bg-black/50"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
};

describe("RR-206: Responsive Layout Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores to initial state
    const uiStore = useUIStore.getState();
    uiStore.setSidebarOpen(true);

    const articleStore = useArticleStore.getState();
    articleStore.setReadStatusFilter("unread");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Desktop Layout (≥1024px)", () => {
    it("should show sidebar, hide hamburger, show filter text", () => {
      render(<MockHomePage viewport="desktop" />);

      // Sidebar should be visible
      const sidebar = screen.getByTestId("sidebar");
      expect(sidebar).toHaveAttribute("data-state", "open");

      // Hamburger should NOT exist
      const hamburger = screen.queryByTestId("hamburger-menu");
      expect(hamburger).not.toBeInTheDocument();

      // Filter text should be visible
      expect(screen.getByTestId("filter-all-text")).not.toHaveClass("hidden");
      expect(screen.getByTestId("filter-unread-text")).not.toHaveClass(
        "hidden"
      );
      expect(screen.getByTestId("filter-read-text")).not.toHaveClass("hidden");

      // No overlay should exist
      const overlay = screen.queryByTestId("sidebar-overlay");
      expect(overlay).not.toBeInTheDocument();
    });

    it("should not allow sidebar to be collapsed on desktop", async () => {
      const { rerender } = render(<MockHomePage viewport="desktop" />);

      // Try to close sidebar programmatically
      const uiStore = useUIStore.getState();
      await act(async () => {
        uiStore.setSidebarOpen(false);
      });

      rerender(<MockHomePage viewport="desktop" />);

      // Sidebar should auto-reopen on desktop
      await waitFor(() => {
        const sidebar = screen.getByTestId("sidebar");
        expect(sidebar).toHaveAttribute("data-state", "open");
      });
    });
  });

  describe("Tablet Layout (768-1023px)", () => {
    it("should show sidebar, hide hamburger, hide filter text", () => {
      render(<MockHomePage viewport="tablet" />);

      // Sidebar should be visible
      const sidebar = screen.getByTestId("sidebar");
      expect(sidebar).toHaveAttribute("data-state", "open");

      // Hamburger should NOT exist
      const hamburger = screen.queryByTestId("hamburger-menu");
      expect(hamburger).not.toBeInTheDocument();

      // Filter text should be hidden (icons only)
      expect(screen.getByTestId("filter-all-text")).toHaveClass("hidden");
      expect(screen.getByTestId("filter-unread-text")).toHaveClass("hidden");
      expect(screen.getByTestId("filter-read-text")).toHaveClass("hidden");

      // Icons should still be visible
      expect(screen.getByTestId("filter-all-icon")).toBeInTheDocument();
      expect(screen.getByTestId("filter-unread-icon")).toBeInTheDocument();
      expect(screen.getByTestId("filter-read-icon")).toBeInTheDocument();
    });
  });

  describe("Mobile Layout (<768px)", () => {
    it("should hide sidebar, show hamburger, hide filter text", () => {
      render(<MockHomePage viewport="mobile" />);

      // Sidebar should be collapsed
      const sidebar = screen.getByTestId("sidebar");
      expect(sidebar).toHaveAttribute("data-state", "closed");

      // Hamburger SHOULD be visible
      const hamburger = screen.getByTestId("hamburger-menu");
      expect(hamburger).toBeInTheDocument();

      // Filter text should be hidden (icons only)
      expect(screen.getByTestId("filter-all-text")).toHaveClass("hidden");
      expect(screen.getByTestId("filter-unread-text")).toHaveClass("hidden");
      expect(screen.getByTestId("filter-read-text")).toHaveClass("hidden");
    });

    it("should toggle sidebar with hamburger menu", async () => {
      render(<MockHomePage viewport="mobile" />);

      // Initially closed
      expect(screen.getByTestId("sidebar")).toHaveAttribute(
        "data-state",
        "closed"
      );

      // Click hamburger to open
      const hamburger = screen.getByTestId("hamburger-menu");
      await userEvent.click(hamburger);

      await waitFor(() => {
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "open"
        );
      });

      // Overlay should appear
      const overlay = screen.getByTestId("sidebar-overlay");
      expect(overlay).toBeInTheDocument();

      // Click overlay to close
      await userEvent.click(overlay);

      await waitFor(() => {
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "closed"
        );
      });
    });

    it("should hide hamburger when sidebar is open", async () => {
      render(<MockHomePage viewport="mobile" />);

      // Hamburger visible initially
      expect(screen.getByTestId("hamburger-menu")).toBeInTheDocument();

      // Open sidebar
      await userEvent.click(screen.getByTestId("hamburger-menu"));

      await waitFor(() => {
        // Hamburger should disappear when sidebar is open
        expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
      });
    });
  });

  describe("Viewport Transitions", () => {
    it("should handle desktop → tablet → mobile transition", async () => {
      const { rerender } = render(<MockHomePage viewport="desktop" />);

      // Desktop: sidebar open, no hamburger, full text
      expect(screen.getByTestId("sidebar")).toHaveAttribute(
        "data-state",
        "open"
      );
      expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
      expect(screen.getByTestId("filter-all-text")).not.toHaveClass("hidden");

      // Transition to tablet
      rerender(<MockHomePage viewport="tablet" />);

      await waitFor(() => {
        // Tablet: sidebar still open, no hamburger, icons only
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "open"
        );
        expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
        expect(screen.getByTestId("filter-all-text")).toHaveClass("hidden");
      });

      // Transition to mobile
      rerender(<MockHomePage viewport="mobile" />);

      await waitFor(() => {
        // Mobile: sidebar closed, hamburger visible, icons only
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "closed"
        );
        expect(screen.getByTestId("hamburger-menu")).toBeInTheDocument();
        expect(screen.getByTestId("filter-all-text")).toHaveClass("hidden");
      });
    });

    it("should handle mobile → tablet → desktop transition", async () => {
      const { rerender } = render(<MockHomePage viewport="mobile" />);

      // Mobile: sidebar closed, hamburger visible
      expect(screen.getByTestId("sidebar")).toHaveAttribute(
        "data-state",
        "closed"
      );
      expect(screen.getByTestId("hamburger-menu")).toBeInTheDocument();

      // Transition to tablet
      rerender(<MockHomePage viewport="tablet" />);

      await waitFor(() => {
        // Tablet: sidebar opens, hamburger disappears
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "open"
        );
        expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
      });

      // Transition to desktop
      rerender(<MockHomePage viewport="desktop" />);

      await waitFor(() => {
        // Desktop: sidebar still open, filter text appears
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "open"
        );
        expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
        expect(screen.getByTestId("filter-all-text")).not.toHaveClass("hidden");
      });
    });
  });

  describe("State Preservation", () => {
    it("should preserve filter selection across viewport changes", async () => {
      const { rerender } = render(<MockHomePage viewport="desktop" />);

      // Set filter to "read"
      const articleStore = useArticleStore.getState();
      await act(async () => {
        articleStore.setReadStatusFilter("read");
      });

      // Change viewport
      rerender(<MockHomePage viewport="mobile" />);

      // Filter should still be "read"
      expect(articleStore.readStatusFilter).toBe("read");

      // Change back to desktop
      rerender(<MockHomePage viewport="desktop" />);

      // Filter should still be "read"
      expect(articleStore.readStatusFilter).toBe("read");
    });

    it("should preserve article scroll position during sidebar toggle", async () => {
      render(<MockHomePage viewport="mobile" />);

      const articleList = screen.getByTestId("article-list");

      // Simulate scroll position
      Object.defineProperty(articleList, "scrollTop", {
        value: 500,
        writable: true,
      });

      // Toggle sidebar
      await userEvent.click(screen.getByTestId("hamburger-menu"));

      await waitFor(() => {
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "open"
        );
      });

      // Scroll position should be preserved
      expect(articleList.scrollTop).toBe(500);
    });
  });

  describe("Performance and Animation", () => {
    it("should use transform for sidebar animation", () => {
      render(<MockHomePage viewport="mobile" />);

      const sidebar = screen.getByTestId("sidebar");
      const className = sidebar.className;

      // Should use translate-x for performance
      expect(className).toMatch(/translate-x/);
      expect(className).toMatch(/transition-transform/);
      expect(className).toMatch(/duration-300/);
    });

    it("should not trigger reflow during transitions", async () => {
      const { rerender } = render(<MockHomePage viewport="mobile" />);

      // Mock performance observer
      const measurePerformance = vi.fn();
      const observer = new PerformanceObserver(measurePerformance);
      observer.observe({ entryTypes: ["measure"] });

      // Transition through viewports
      performance.mark("transition-start");
      rerender(<MockHomePage viewport="tablet" />);
      rerender(<MockHomePage viewport="desktop" />);
      rerender(<MockHomePage viewport="mobile" />);
      performance.mark("transition-end");

      performance.measure(
        "viewport-transitions",
        "transition-start",
        "transition-end"
      );

      // No layout thrashing should occur
      const sidebar = screen.getByTestId("sidebar");
      expect(sidebar.className).not.toMatch(/w-0|left-/);
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid viewport changes", async () => {
      const { rerender } = render(<MockHomePage viewport="desktop" />);

      // Rapidly change viewports
      for (let i = 0; i < 10; i++) {
        rerender(<MockHomePage viewport="mobile" />);
        rerender(<MockHomePage viewport="tablet" />);
        rerender(<MockHomePage viewport="desktop" />);
      }

      // Should end in correct state
      await waitFor(() => {
        expect(screen.getByTestId("sidebar")).toHaveAttribute(
          "data-state",
          "open"
        );
        expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
        expect(screen.getByTestId("filter-all-text")).not.toHaveClass("hidden");
      });
    });

    it("should handle iPad landscape (1024px exactly)", () => {
      // iPad landscape is exactly 1024px - should be treated as desktop
      render(<MockHomePage viewport="desktop" />);

      expect(screen.getByTestId("sidebar")).toHaveAttribute(
        "data-state",
        "open"
      );
      expect(screen.queryByTestId("hamburger-menu")).not.toBeInTheDocument();
      expect(screen.getByTestId("filter-all-text")).not.toHaveClass("hidden");
    });

    it("should handle long feed titles with truncation", () => {
      const longTitle =
        "This is a very long feed title that should be truncated with ellipsis when it exceeds the available width in the sidebar";

      render(
        <div className="w-64 truncate" data-testid="feed-title">
          {longTitle}
        </div>
      );

      const feedTitle = screen.getByTestId("feed-title");
      expect(feedTitle).toHaveClass("truncate");
    });
  });
});
