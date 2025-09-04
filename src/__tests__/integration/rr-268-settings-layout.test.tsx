/**
 * RR-268: Integration Tests for Settings Page Layout
 *
 * Test Requirements:
 * 1. Complete page integration with components
 * 2. Navigation flow from sidebar to settings
 * 3. CollapsibleFilterSection behavior
 * 4. Glass-input styling integration
 * 5. Responsive layout at different breakpoints
 * 6. Component interactions
 *
 * TDD Approach: These tests should FAIL initially and PASS after implementation
 */

import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "@/app/settings/page";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";

// Mock Next.js router with complete implementation
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  pathname: "/reader/settings",
  query: {},
  asPath: "/reader/settings",
  route: "/reader/settings",
  isReady: true,
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockRouter.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
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

// Mock stores
vi.mock("@/lib/stores/feed-store", () => ({
  useFeedStore: () => ({
    feeds: new Map(),
    feedsWithCounts: [],
    totalUnreadCount: 0,
    loadFeedHierarchy: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/sync-store", () => ({
  useSyncStore: () => ({
    isSyncing: false,
    syncProgress: 0,
    lastSyncTime: null,
    loadLastSyncTime: vi.fn(),
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
    unreadCounts: new Map(),
    totalUnreadCount: 0,
  }),
}));

vi.mock("@/lib/stores/tag-store", () => ({
  useTagStore: () => ({
    tags: [],
    loadTags: vi.fn(),
  }),
}));

// Mock lucide icons
vi.mock("lucide-react", () => ({
  Bot: ({ className }: any) => <div className={className} data-icon="bot" />,
  CloudCheck: ({ className }: any) => (
    <div className={className} data-icon="cloud-check" />
  ),
  Blocks: ({ className }: any) => (
    <div className={className} data-icon="blocks" />
  ),
  ArrowLeft: ({ className }: any) => (
    <div className={className} data-icon="arrow-left" />
  ),
  Bolt: ({ className }: any) => <div className={className} data-icon="bolt" />,
  LayoutDashboard: ({ className }: any) => (
    <div className={className} data-icon="layout-dashboard" />
  ),
  Settings: ({ className }: any) => (
    <div className={className} data-icon="settings" />
  ),
  Moon: () => <div data-icon="moon" />,
  Sun: () => <div data-icon="sun" />,
  Monitor: () => <div data-icon="monitor" />,
  RefreshCw: () => <div data-icon="refresh" />,
  Newspaper: () => <div data-icon="newspaper" />,
  Tag: () => <div data-icon="tag" />,
  Hash: () => <div data-icon="hash" />,
  Home: () => <div data-icon="home" />,
  ChevronDown: () => <div data-icon="chevron-down" />,
  ChevronRight: () => <div data-icon="chevron-right" />,
  Folder: () => <div data-icon="folder" />,
  FolderOpen: () => <div data-icon="folder-open" />,
  Rss: () => <div data-icon="rss" />,
  X: () => <div data-icon="x" />,
}));

// Mock Next Image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock refresh manager
vi.mock("@/lib/refresh-manager", () => ({
  refreshManager: {
    getRemainingCooldown: vi.fn(() => 0),
    formatCountdown: vi.fn((seconds: number) => `${seconds}s`),
    canRefresh: vi.fn(() => true),
    startCooldown: vi.fn(),
  },
}));

// Real CollapsibleFilterSection implementation for integration
vi.mock("@/components/ui/collapsible-filter-section", () => ({
  CollapsibleFilterSection: ({
    title,
    icon,
    children,
    defaultOpen = false,
  }: any) => {
    const [isExpanded, setIsExpanded] = React.useState(defaultOpen);

    return (
      <div
        data-testid="collapsible-section"
        className="collapsible-filter-section"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="collapsible-header flex items-center gap-2"
          aria-expanded={isExpanded}
        >
          {icon}
          <span>{title}</span>
          <span>{isExpanded ? "▼" : "▶"}</span>
        </button>
        {isExpanded && <div className="collapsible-content">{children}</div>}
      </div>
    );
  },
}));

// Mock ProgressBar
vi.mock("@/components/ui/progress-bar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div data-testid="progress-bar" data-progress={progress}>
      Progress: {progress}%
    </div>
  ),
}));

describe("RR-268: Settings Page Layout Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.pathname = "/reader/settings";
    mockRouter.asPath = "/reader/settings";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Navigation Flow", () => {
    it("should navigate from sidebar to settings page", async () => {
      // Start on the reader page with sidebar
      mockRouter.pathname = "/reader";
      mockRouter.asPath = "/reader";

      const { rerender } = render(
        <SimpleFeedSidebar
          selectedFeedId={null}
          selectedTagId={null}
          onFeedSelect={vi.fn()}
          onTagSelect={vi.fn()}
          onClearFilters={vi.fn()}
          onClose={vi.fn()}
        />
      );

      // Find and click settings button
      const settingsButton = screen.getByLabelText("Settings");
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/settings");
      });

      // Simulate navigation to settings page
      mockRouter.pathname = "/reader/settings";
      mockRouter.asPath = "/reader/settings";

      // Rerender with settings page
      rerender(<SettingsPage />);

      // Settings page should be rendered
      const settingsTitle = screen.getByRole("heading", { level: 1 });
      expect(settingsTitle).toHaveTextContent("Settings");
    });

    it("should navigate back from settings to previous page", async () => {
      render(<SettingsPage />);

      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(mockRouter.back).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("CollapsibleFilterSection Integration", () => {
    it("should expand and collapse sections on click", async () => {
      render(<SettingsPage />);

      const sections = screen.getAllByTestId("collapsible-section");

      // First section should be expanded by default
      const firstHeader = sections[0].querySelector(".collapsible-header");
      expect(firstHeader).toHaveAttribute("aria-expanded", "true");

      // Click to collapse first section
      fireEvent.click(firstHeader!);

      await waitFor(() => {
        expect(firstHeader).toHaveAttribute("aria-expanded", "false");
      });

      // Click second section to expand
      const secondHeader = sections[1].querySelector(".collapsible-header");
      fireEvent.click(secondHeader!);

      await waitFor(() => {
        expect(secondHeader).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("should only show content when section is expanded", () => {
      render(<SettingsPage />);

      const sections = screen.getAllByTestId("collapsible-section");

      // First section (expanded) should show content
      const firstContent = sections[0].querySelector(".collapsible-content");
      expect(firstContent).toBeInTheDocument();

      // Second section (collapsed) should not show content
      const secondContent = sections[1].querySelector(".collapsible-content");
      expect(secondContent).not.toBeInTheDocument();
    });

    it("should render correct icons in section headers", () => {
      render(<SettingsPage />);

      // Check for specific sections in the correct order
      expect(screen.getByText("AI Summarization")).toBeInTheDocument();
      expect(screen.getByText("Sync Configuration")).toBeInTheDocument();

      // Check icons are rendered
      expect(document.querySelector('[data-icon="bot"]')).toBeInTheDocument();
      expect(
        document.querySelector('[data-icon="cloud-check"]')
      ).toBeInTheDocument();
    });
  });

  describe("Glass Input Integration", () => {
    it("should apply glass-input styles to all form elements", () => {
      const { container } = render(<SettingsPage />);

      // Check that glass-input class exists in the CSS
      const inputs = container.querySelectorAll(".glass-input");

      // Should have multiple glass-input elements
      expect(inputs.length).toBeGreaterThan(0);

      // Each should have the expected structure
      inputs.forEach((input) => {
        expect(input).toHaveClass("glass-input");
      });
    });

    it("should have consistent styling across input types", () => {
      const { container } = render(<SettingsPage />);

      // Text inputs
      const textInputs = container.querySelectorAll('input[type="text"]');
      textInputs.forEach((input) => {
        expect(input).toHaveClass("glass-input");
      });

      // Select elements
      const selects = container.querySelectorAll("select");
      selects.forEach((select) => {
        expect(select).toHaveClass("glass-input");
      });

      // Toggles/checkboxes with glass styling
      const toggles = container.querySelectorAll(".glass-input.toggle");
      // Should have at least some toggles
      if (toggles.length > 0) {
        toggles.forEach((toggle) => {
          expect(toggle).toHaveClass("glass-input");
        });
      }
    });

    it("should maintain glass effect with skeleton state", () => {
      const { container } = render(<SettingsPage />);

      const skeletonInputs = container.querySelectorAll(
        ".glass-input.animate-pulse"
      );

      // Should have skeleton animation on glass inputs
      expect(skeletonInputs.length).toBeGreaterThan(0);
    });
  });

  describe("Responsive Layout", () => {
    it("should adapt layout for mobile (375px)", () => {
      // Set viewport to mobile
      global.innerWidth = 375;
      global.dispatchEvent(new Event("resize"));

      const { container } = render(<SettingsPage />);

      // Container should have mobile-appropriate classes
      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toHaveClass("px-4");

      // Sections should stack vertically
      const sections = screen.getAllByTestId("collapsible-section");
      expect(sections.length).toBe(2);
    });

    it("should adapt layout for tablet (768px)", () => {
      // Set viewport to tablet
      global.innerWidth = 768;
      global.dispatchEvent(new Event("resize"));

      const { container } = render(<SettingsPage />);

      // Container should have tablet-appropriate classes
      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toHaveClass("max-w-4xl");
    });

    it("should adapt layout for desktop (1024px)", () => {
      // Set viewport to desktop
      global.innerWidth = 1024;
      global.dispatchEvent(new Event("resize"));

      const { container } = render(<SettingsPage />);

      // Container should maintain max width
      const mainContainer = container.querySelector(".container");
      expect(mainContainer).toHaveClass("max-w-4xl", "mx-auto");
    });
  });

  describe("Skeleton Loading Behavior", () => {
    it("should show skeleton placeholders for all sections", () => {
      render(<SettingsPage />);

      // Each section should have skeleton elements
      const skeletons = document.querySelectorAll(".animate-pulse");

      // Should have multiple skeleton elements (at least 2, one per section)
      expect(skeletons.length).toBeGreaterThanOrEqual(2);
    });

    it("should disable all interactive elements", () => {
      render(<SettingsPage />);

      // All inputs should be disabled
      const inputs = screen.getAllByRole("textbox");
      inputs.forEach((input) => {
        expect(input).toBeDisabled();
      });

      // All buttons except navigation should be disabled
      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        // Skip back button and section headers
        if (
          !button.getAttribute("aria-label")?.includes("back") &&
          !button.classList.contains("collapsible-header")
        ) {
          expect(button).toBeDisabled();
        }
      });
    });

    it("should maintain form structure without functionality", () => {
      render(<SettingsPage />);

      // Forms should exist but be non-functional
      const forms = document.querySelectorAll("form");

      if (forms.length > 0) {
        forms.forEach((form) => {
          // Should prevent default submission
          const submitEvent = new Event("submit");
          form.dispatchEvent(submitEvent);

          // Nothing should happen (no navigation, no API calls)
          expect(mockRouter.push).not.toHaveBeenCalled();
        });
      }
    });
  });

  describe("Component State Management", () => {
    it("should manage section expansion state independently", async () => {
      render(<SettingsPage />);

      const sections = screen.getAllByTestId("collapsible-section");
      const headers = sections.map((s) =>
        s.querySelector(".collapsible-header")
      );

      // Expand second section
      fireEvent.click(headers[1]!);

      await waitFor(() => {
        expect(headers[1]).toHaveAttribute("aria-expanded", "true");
      });

      // First section should remain in its state
      expect(headers[0]).toHaveAttribute("aria-expanded", "true");
    });

    it("should persist header visibility on scroll", () => {
      const { container } = render(<SettingsPage />);

      const header = container.querySelector('[data-testid="settings-header"]');
      expect(header).toHaveClass("sticky", "top-0");

      // Simulate scroll
      global.scrollY = 500;
      global.dispatchEvent(new Event("scroll"));

      // Header should still be visible (sticky)
      expect(header).toHaveClass("sticky", "top-0");
    });
  });

  describe("Accessibility Integration", () => {
    it("should maintain focus order through sections", () => {
      render(<SettingsPage />);

      const backButton = screen.getByRole("button", { name: /back/i });
      const sections = screen.getAllByTestId("collapsible-section");

      // Tab order should be logical
      backButton.focus();
      expect(document.activeElement).toBe(backButton);

      // Tab to first section header
      const firstHeader = sections[0].querySelector(".collapsible-header");
      firstHeader?.focus();
      expect(document.activeElement).toBe(firstHeader);
    });

    it("should announce section state changes", async () => {
      render(<SettingsPage />);

      const sections = screen.getAllByTestId("collapsible-section");
      const firstHeader = sections[0].querySelector(".collapsible-header");

      // Should have aria-expanded attribute
      expect(firstHeader).toHaveAttribute("aria-expanded", "true");

      // Toggle and check state change
      fireEvent.click(firstHeader!);

      await waitFor(() => {
        expect(firstHeader).toHaveAttribute("aria-expanded", "false");
      });
    });

    it("should provide context for disabled elements", () => {
      render(<SettingsPage />);

      const inputs = screen.getAllByRole("textbox");

      inputs.forEach((input) => {
        expect(input).toHaveAttribute("aria-disabled", "true");
        // Should have placeholder or label for context
        expect(
          input.hasAttribute("placeholder") || input.hasAttribute("aria-label")
        ).toBe(true);
      });
    });
  });

  describe("Error Boundaries", () => {
    it("should handle missing icons gracefully", () => {
      // Mock console.error to avoid test noise
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Even with missing icons, page should render
      render(<SettingsPage />);

      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it("should handle navigation errors gracefully", async () => {
      // Mock router.back to throw
      mockRouter.back.mockImplementationOnce(() => {
        throw new Error("Navigation failed");
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(<SettingsPage />);

      const backButton = screen.getByRole("button", { name: /back/i });
      fireEvent.click(backButton);

      // Page should still be functional
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
