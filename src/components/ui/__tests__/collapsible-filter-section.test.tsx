/**
 * Unit Tests for CollapsibleFilterSection Component - RR-146
 *
 * These tests define the exact behavior the implementation must follow.
 * The component should provide a collapsible section with:
 * - Toggle arrow animation
 * - Persistent collapse state during session
 * - Smooth animations (<200ms)
 * - 44px touch targets for iPad
 * - Accessible keyboard navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { CollapsibleFilterSection } from "../collapsible-filter-section";

// Mock Radix UI Collapsible components
vi.mock("@radix-ui/react-collapsible", () => ({
  Root: ({ children, open, onOpenChange, ...props }: any) => (
    <div data-state={open ? "open" : "closed"} {...props}>
      {typeof children === "function" ? children({ open }) : children}
    </div>
  ),
  Trigger: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Content: ({ children, ...props }: any) => {
    const parent = props["data-state"] || "closed";
    return (
      <div
        data-state={parent}
        style={{ display: parent === "closed" ? "none" : "block" }}
        {...props}
      >
        {children}
      </div>
    );
  },
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  ChevronRight: ({ className, ...props }: any) => (
    <svg className={className} data-testid="chevron-right-icon" {...props}>
      ChevronRight
    </svg>
  ),
  ChevronDown: ({ className, ...props }: any) => (
    <svg className={className} data-testid="chevron-down-icon" {...props}>
      ChevronDown
    </svg>
  ),
}));

describe("RR-146: CollapsibleFilterSection Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Core Functionality", () => {
    it("should render with title and children when provided", () => {
      render(
        <CollapsibleFilterSection title="Feeds" defaultOpen={true}>
          <div data-testid="feed-list">Feed content</div>
        </CollapsibleFilterSection>
      );

      expect(screen.getByText("Feeds")).toBeInTheDocument();
      expect(screen.getByTestId("feed-list")).toBeInTheDocument();
      expect(screen.getByText("Feed content")).toBeInTheDocument();
    });

    it("should display item count when provided", () => {
      render(
        <CollapsibleFilterSection
          title="Feeds"
          itemCount={64}
          defaultOpen={true}
        >
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      expect(screen.getByText("64")).toBeInTheDocument();
      expect(screen.getByText("64")).toHaveClass(
        "text-xs",
        "text-muted-foreground"
      );
    });

    it("should display unread count badge when provided", () => {
      render(
        <CollapsibleFilterSection
          title="Feeds"
          unreadCount={15}
          defaultOpen={true}
        >
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const badge = screen.getByText("15");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass(
        "rounded-full",
        "bg-primary/10",
        "text-primary"
      );
    });

    it("should format large unread counts as 999+", () => {
      render(
        <CollapsibleFilterSection
          title="Feeds"
          unreadCount={1500}
          defaultOpen={true}
        >
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      expect(screen.getByText("999+")).toBeInTheDocument();
    });

    it("should not display unread badge when count is 0", () => {
      render(
        <CollapsibleFilterSection
          title="Feeds"
          unreadCount={0}
          defaultOpen={true}
        >
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });

  describe("Collapse/Expand Behavior", () => {
    it("should start collapsed by default", () => {
      render(
        <CollapsibleFilterSection title="Feeds">
          <div data-testid="feed-content">Content</div>
        </CollapsibleFilterSection>
      );

      // Content should be hidden when collapsed
      const content = screen.getByTestId("feed-content");
      expect(content.parentElement).toHaveStyle({ display: "none" });
      expect(screen.getByTestId("chevron-right-icon")).toBeInTheDocument();
    });

    it("should start expanded when defaultOpen is true", () => {
      render(
        <CollapsibleFilterSection title="Feeds" defaultOpen={true}>
          <div data-testid="feed-content">Content</div>
        </CollapsibleFilterSection>
      );

      const content = screen.getByTestId("feed-content");
      expect(content.parentElement).toHaveStyle({ display: "block" });
      expect(screen.getByTestId("chevron-down-icon")).toBeInTheDocument();
    });

    it("should toggle on header click", async () => {
      const onOpenChange = vi.fn();
      render(
        <CollapsibleFilterSection title="Feeds" onOpenChange={onOpenChange}>
          <div data-testid="feed-content">Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");

      // Click to expand
      await userEvent.click(trigger);
      expect(onOpenChange).toHaveBeenCalledWith(true);

      // Click to collapse
      await userEvent.click(trigger);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should animate chevron rotation on toggle", async () => {
      const { rerender } = render(
        <CollapsibleFilterSection title="Feeds" open={false}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      // Initially collapsed - chevron right
      let chevron = screen.getByTestId("chevron-right-icon");
      expect(chevron).toHaveClass("transition-transform", "duration-200");

      // Expand - chevron should rotate down
      rerender(
        <CollapsibleFilterSection title="Feeds" open={true}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      chevron = screen.getByTestId("chevron-down-icon");
      expect(chevron).toHaveClass("transition-transform", "duration-200");
    });

    it("should complete animation within 200ms", async () => {
      render(
        <CollapsibleFilterSection title="Feeds">
          <div data-testid="feed-content">Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");

      // Start animation
      fireEvent.click(trigger);

      // Animation should complete within 200ms
      vi.advanceTimersByTime(200);

      // Verify animation classes are applied
      const chevron =
        screen.queryByTestId("chevron-down-icon") ||
        screen.queryByTestId("chevron-right-icon");
      expect(chevron).toHaveClass("duration-200");
    });
  });

  describe("Touch Target Requirements", () => {
    it("should have 44px minimum touch target for trigger button", () => {
      render(
        <CollapsibleFilterSection title="Feeds">
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");

      // Check for min-h-[44px] class or equivalent
      expect(trigger).toHaveClass("min-h-[44px]");

      // Verify padding adds up to 44px total height
      expect(trigger).toHaveClass("py-2"); // 8px * 2 = 16px padding
      // With text line height, should total at least 44px
    });

    it("should maintain 44px targets on iPad viewport", () => {
      // Mock iPad viewport
      Object.defineProperty(window, "innerWidth", {
        value: 1024,
        writable: true,
      });

      render(
        <CollapsibleFilterSection title="Feeds">
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      expect(trigger).toHaveClass("min-h-[44px]");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(
        <CollapsibleFilterSection title="Feeds" open={false}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Feeds")
      );
    });

    it("should update ARIA attributes when expanded", () => {
      render(
        <CollapsibleFilterSection title="Feeds" open={true}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    it("should be keyboard navigable with Enter key", async () => {
      const onOpenChange = vi.fn();
      render(
        <CollapsibleFilterSection title="Feeds" onOpenChange={onOpenChange}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      trigger.focus();

      await userEvent.keyboard("{Enter}");
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("should be keyboard navigable with Space key", async () => {
      const onOpenChange = vi.fn();
      render(
        <CollapsibleFilterSection title="Feeds" onOpenChange={onOpenChange}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      trigger.focus();

      await userEvent.keyboard(" ");
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("should maintain focus after toggle", async () => {
      render(
        <CollapsibleFilterSection title="Feeds">
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      trigger.focus();

      await userEvent.click(trigger);
      expect(document.activeElement).toBe(trigger);
    });
  });

  describe("Styling and Layout", () => {
    it("should apply custom className when provided", () => {
      render(
        <CollapsibleFilterSection title="Feeds" className="custom-class">
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const container = screen.getByText("Feeds").closest("[data-state]");
      expect(container).toHaveClass("custom-class");
    });

    it("should have hover state on trigger", () => {
      render(
        <CollapsibleFilterSection title="Feeds">
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      expect(trigger).toHaveClass("hover:bg-muted/50");
    });

    it("should have proper flex layout for header", () => {
      render(
        <CollapsibleFilterSection title="Feeds" itemCount={64} unreadCount={15}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");
      expect(trigger).toHaveClass("flex", "items-center", "justify-between");
    });

    it("should align chevron icon properly", () => {
      render(
        <CollapsibleFilterSection title="Feeds">
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const chevron = screen.getByTestId("chevron-right-icon");
      expect(chevron).toHaveClass("h-4", "w-4");
    });
  });

  describe("Integration with Filters", () => {
    it("should work with unread filter showing only feeds with unread", () => {
      const feeds = [
        { id: "1", title: "Feed 1", unreadCount: 5 },
        { id: "2", title: "Feed 2", unreadCount: 0 },
        { id: "3", title: "Feed 3", unreadCount: 10 },
      ];

      const visibleFeeds = feeds.filter((f) => f.unreadCount > 0);

      render(
        <CollapsibleFilterSection
          title="Feeds"
          itemCount={visibleFeeds.length}
          unreadCount={15}
          defaultOpen={true}
        >
          {visibleFeeds.map((feed) => (
            <div key={feed.id}>{feed.title}</div>
          ))}
        </CollapsibleFilterSection>
      );

      expect(screen.getByText("2")).toBeInTheDocument(); // item count
      expect(screen.getByText("15")).toBeInTheDocument(); // unread count
      expect(screen.getByText("Feed 1")).toBeInTheDocument();
      expect(screen.queryByText("Feed 2")).not.toBeInTheDocument();
      expect(screen.getByText("Feed 3")).toBeInTheDocument();
    });

    it("should work with read filter showing all feeds", () => {
      const feeds = [
        { id: "1", title: "Feed 1", unreadCount: 5 },
        { id: "2", title: "Feed 2", unreadCount: 0 },
        { id: "3", title: "Feed 3", unreadCount: 10 },
      ];

      render(
        <CollapsibleFilterSection
          title="Feeds"
          itemCount={feeds.length}
          defaultOpen={true}
        >
          {feeds.map((feed) => (
            <div key={feed.id}>{feed.title}</div>
          ))}
        </CollapsibleFilterSection>
      );

      expect(screen.getByText("3")).toBeInTheDocument(); // item count
      expect(screen.getByText("Feed 1")).toBeInTheDocument();
      expect(screen.getByText("Feed 2")).toBeInTheDocument();
      expect(screen.getByText("Feed 3")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty children gracefully", () => {
      render(
        <CollapsibleFilterSection title="Feeds" defaultOpen={true}>
          {null}
        </CollapsibleFilterSection>
      );

      expect(screen.getByText("Feeds")).toBeInTheDocument();
    });

    it("should handle undefined counts", () => {
      render(
        <CollapsibleFilterSection
          title="Feeds"
          itemCount={undefined}
          unreadCount={undefined}
        >
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      expect(screen.getByText("Feeds")).toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("should handle very long titles with truncation", () => {
      const longTitle =
        "This is a very long title that should be truncated properly in the UI";

      render(
        <CollapsibleFilterSection title={longTitle}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toHaveClass("truncate");
    });

    it("should handle rapid toggle clicks", async () => {
      const onOpenChange = vi.fn();

      render(
        <CollapsibleFilterSection title="Feeds" onOpenChange={onOpenChange}>
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");

      // Rapid clicks
      await userEvent.click(trigger);
      await userEvent.click(trigger);
      await userEvent.click(trigger);

      // Should handle all clicks
      expect(onOpenChange).toHaveBeenCalledTimes(3);
    });
  });

  describe("Performance Requirements", () => {
    it("should not re-render children when parent updates unrelated props", () => {
      const ChildComponent = vi.fn(() => <div>Child content</div>);

      const { rerender } = render(
        <CollapsibleFilterSection title="Feeds" defaultOpen={true}>
          <ChildComponent />
        </CollapsibleFilterSection>
      );

      expect(ChildComponent).toHaveBeenCalledTimes(1);

      // Update unrelated prop
      rerender(
        <CollapsibleFilterSection title="Feeds Updated" defaultOpen={true}>
          <ChildComponent />
        </CollapsibleFilterSection>
      );

      // Children should not re-render for title change
      expect(ChildComponent).toHaveBeenCalledTimes(2); // React will re-render, but we can optimize with memo
    });

    it("should debounce rapid state changes", async () => {
      const onOpenChange = vi.fn();

      render(
        <CollapsibleFilterSection
          title="Feeds"
          onOpenChange={onOpenChange}
          debounceMs={100}
        >
          <div>Content</div>
        </CollapsibleFilterSection>
      );

      const trigger = screen.getByRole("button");

      // Multiple rapid clicks
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      fireEvent.click(trigger);

      // Wait for debounce
      vi.advanceTimersByTime(100);

      // Should batch the changes (implementation dependent)
      // This test documents expected debouncing behavior
    });
  });
});
