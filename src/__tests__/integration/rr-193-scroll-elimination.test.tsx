/**
 * RR-193: Scroll Elimination Integration Tests
 * Tests that nested scrollbars are eliminated and only main container scrolls
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";
import { useUIStore } from "@/lib/stores/ui-store";

// Mock data for testing
const mockFeeds = [
  { id: "1", title: "Test Feed 1", unread_count: 5 },
  { id: "2", title: "Test Feed 2", unread_count: 0 },
];

const mockTags = [
  { id: "tag1", name: "Technology", count: 10 },
  { id: "tag2", name: "Science", count: 3 },
];

describe("RR-193 Scroll Elimination Integration", () => {
  beforeEach(() => {
    // Reset UI store state
    useUIStore.getState().resetMutexState?.();
  });

  describe("CSS Grid Layout", () => {
    it("should render main container with CSS Grid layout", () => {
      render(
        <SimpleFeedSidebar
          feeds={mockFeeds}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      const mainContainer = screen.getByTestId("sidebar-main-container");
      expect(mainContainer).toHaveClass("grid");
      expect(mainContainer).toHaveClass("grid-template-rows");
      // Should use CSS Grid instead of flexbox for main layout
    });

    it("should remove max-height constraints from sections", () => {
      render(
        <SimpleFeedSidebar
          feeds={mockFeeds}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      // Check that problematic max-height classes are removed
      const feedsSection = screen.getByTestId("feeds-scrollable-section");
      const tagsSection = screen.getByTestId("topics-scrollable-section");

      // Should NOT have nested scrollable containers
      expect(feedsSection).not.toHaveClass("max-h-[60vh]");
      expect(feedsSection).not.toHaveClass("overflow-y-auto");
      expect(tagsSection).not.toHaveClass("max-h-[30vh]");
      expect(tagsSection).not.toHaveClass("overflow-y-auto");
    });

    it("should maintain single scrollable main container", () => {
      render(
        <SimpleFeedSidebar
          feeds={mockFeeds}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      const mainContainer = screen.getByTestId("sidebar-main-container");

      // Main container should be the only scrollable area
      expect(mainContainer).toHaveClass("overflow-y-auto");

      // Verify no nested scrollable containers exist
      const nestedScrollable =
        mainContainer.querySelectorAll(".overflow-y-auto");
      expect(nestedScrollable).toHaveLength(1); // Only the main container
    });
  });

  describe("Section Ordering", () => {
    it("should render Feeds above Topics (reversed order)", () => {
      render(
        <SimpleFeedSidebar
          feeds={mockFeeds}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      const feedsSection = screen.getByTestId("feeds-section");
      const topicsSection = screen.getByTestId("topics-section");

      // Get positions in DOM
      const feedsRect = feedsSection.getBoundingClientRect();
      const topicsRect = topicsSection.getBoundingClientRect();

      // Feeds should be positioned above Topics
      expect(feedsRect.top).toBeLessThan(topicsRect.top);
    });
  });

  describe("Empty State Handling", () => {
    it('should show "No feeds available" when feeds array is empty', () => {
      render(
        <SimpleFeedSidebar
          feeds={[]}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      expect(screen.getByText("No feeds available")).toBeInTheDocument();
    });

    it('should show "No topics available" when tags array is empty', () => {
      render(
        <SimpleFeedSidebar
          feeds={mockFeeds}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      expect(screen.getByText("No topics available")).toBeInTheDocument();
    });

    it("should handle empty states in CSS Grid layout", () => {
      render(
        <SimpleFeedSidebar
          feeds={[]}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      const mainContainer = screen.getByTestId("sidebar-main-container");
      expect(mainContainer).toHaveClass("grid");

      // Empty sections should not break grid layout
      const emptyFeedState = screen.getByText("No feeds available");
      expect(
        emptyFeedState.closest('[data-testid="feeds-section"]')
      ).toBeInTheDocument();
    });
  });

  describe("Long Text Truncation", () => {
    const longTitleFeeds = [
      {
        id: "1",
        title:
          "This is a very long feed title that should be truncated to exactly two lines using CSS line-clamp property",
        unread_count: 5,
      },
    ];

    it("should apply line-clamp-2 to feed titles", () => {
      render(
        <SimpleFeedSidebar
          feeds={longTitleFeeds}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      const feedTitle = screen.getByText(/This is a very long feed title/);
      expect(feedTitle).toHaveClass("line-clamp-2");
    });

    it("should not show hover expansions (touch-first design)", () => {
      render(
        <SimpleFeedSidebar
          feeds={longTitleFeeds}
          onFeedSelect={() => {}}
          onTagSelect={() => {}}
        />
      );

      const feedTitle = screen.getByText(/This is a very long feed title/);

      // Should not have hover-related classes
      expect(feedTitle).not.toHaveClass("hover:line-clamp-none");
      expect(feedTitle).not.toHaveClass("hover:whitespace-normal");
    });
  });
});
