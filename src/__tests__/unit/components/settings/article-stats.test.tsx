/**
 * @fileoverview Unit tests for Article Statistics Component - RR-288
 * Tests skeleton loading states and stats display
 * Following TDD approach - tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ArticleStats } from "@/components/settings/article-stats";

// Mock fetch globally
global.fetch = vi.fn();

describe("ArticleStats Component - RR-288 Loading States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Skeleton Loading State", () => {
    it("should display skeleton loader with animate-pulse during fetch", async () => {
      // Mock slow API response
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as any).mockImplementation(() => fetchPromise);

      const { container } = render(<ArticleStats />);

      // Assert: Skeleton should be visible immediately
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass("glass-morphing");

      // Should have 3 skeleton stat items
      const skeletonItems = container.querySelectorAll(".skeleton-stat");
      expect(skeletonItems).toHaveLength(3);

      // Each skeleton item should have proper structure
      skeletonItems.forEach((item) => {
        const label = item.querySelector(".skeleton-label");
        const value = item.querySelector(".skeleton-value");

        expect(label).toBeInTheDocument();
        expect(label).toHaveClass("h-4", "w-16", "bg-gray-200", "rounded");

        expect(value).toBeInTheDocument();
        expect(value).toHaveClass("h-8", "w-12", "bg-gray-300", "rounded");
      });

      // Resolve the fetch to clean up
      resolvePromise!({
        ok: true,
        json: async () => ({
          total: 100,
          unread: 25,
          starred: 10,
        }),
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          container.querySelector(".animate-pulse")
        ).not.toBeInTheDocument();
      });
    });

    it("should have accessible loading state with proper ARIA attributes", () => {
      // Mock pending fetch
      (global.fetch as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<ArticleStats />);

      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toHaveAttribute("aria-busy", "true");
      expect(skeleton).toHaveAttribute(
        "aria-label",
        "Loading article statistics"
      );
      expect(skeleton).toHaveAttribute("role", "status");
    });

    it("should apply liquid glass morphing styles to skeleton", () => {
      // Mock pending fetch
      (global.fetch as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<ArticleStats />);

      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toHaveClass(
        "glass-morphing",
        "glass-blur-md",
        "glass-border"
      );

      // Check for backdrop filter support
      const computedStyles = window.getComputedStyle(skeleton as Element);
      expect(skeleton).toHaveStyle({
        backdropFilter: expect.stringContaining("blur"),
      });
    });
  });

  describe("Statistics Display", () => {
    it("should display total, unread, and starred counts correctly", async () => {
      const mockStats = {
        total: 1234,
        unread: 567,
        starred: 89,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      render(<ArticleStats />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      // Assert: All stats displayed correctly
      expect(screen.getByText("Total Articles")).toBeInTheDocument();
      expect(screen.getByText("1,234")).toBeInTheDocument(); // Formatted with comma

      expect(screen.getByText("Unread")).toBeInTheDocument();
      expect(screen.getByText("567")).toBeInTheDocument();

      expect(screen.getByText("Starred")).toBeInTheDocument();
      expect(screen.getByText("89")).toBeInTheDocument();
    });

    it("should format large numbers with thousand separators", async () => {
      const mockStats = {
        total: 1234567,
        unread: 98765,
        starred: 4321,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("1,234,567")).toBeInTheDocument();
        expect(screen.getByText("98,765")).toBeInTheDocument();
        expect(screen.getByText("4,321")).toBeInTheDocument();
      });
    });

    it("should handle zero values gracefully", async () => {
      const mockStats = {
        total: 0,
        unread: 0,
        starred: 0,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      // All should show "0" not empty
      const zeros = screen.getAllByText("0");
      expect(zeros).toHaveLength(3);
    });

    it("should apply semantic HTML structure for stats", async () => {
      const mockStats = {
        total: 100,
        unread: 25,
        starred: 10,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const { container } = render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      // Should use dl/dt/dd for semantic structure
      const defList = container.querySelector("dl");
      expect(defList).toBeInTheDocument();
      expect(defList).toHaveClass("stats-grid");

      const terms = container.querySelectorAll("dt");
      expect(terms).toHaveLength(3);

      const definitions = container.querySelectorAll("dd");
      expect(definitions).toHaveLength(3);
    });
  });

  describe("API Integration", () => {
    it("should fetch from correct API endpoint", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 100,
          unread: 25,
          starred: 10,
        }),
      });

      render(<ArticleStats />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/reader/api/articles/stats",
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          })
        );
      });
    });

    it("should handle API errors silently (no error state as per spec)", async () => {
      // API returns error
      (global.fetch as any).mockRejectedValueOnce(new Error("API Error"));

      const { container } = render(<ArticleStats />);

      // Wait a bit for error to be processed
      await waitFor(() => {
        // Should not show error state
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
      });

      // Should show default/fallback values (zeros)
      expect(screen.getByText("Total Articles")).toBeInTheDocument();
      expect(screen.getAllByText("0")).toHaveLength(3);
    });

    it("should handle non-200 responses gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal Server Error" }),
      });

      render(<ArticleStats />);

      await waitFor(() => {
        // No error UI as per spec
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();

        // Should show zeros as fallback
        expect(screen.getAllByText("0")).toHaveLength(3);
      });
    });

    it("should handle malformed API responses", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing expected fields
          someOtherField: "value",
        }),
      });

      render(<ArticleStats />);

      await waitFor(() => {
        // Should handle gracefully with fallback values
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
        expect(screen.getAllByText("0")).toHaveLength(3);
      });
    });
  });

  describe("Mobile Performance", () => {
    it("should render efficiently on mobile viewport", async () => {
      const startTime = performance.now();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 100,
          unread: 25,
          starred: 10,
        }),
      });

      render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Should render quickly for mobile
      expect(renderTime).toBeLessThan(3000);
    });

    it("should have touch-friendly layout with adequate spacing", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 100,
          unread: 25,
          starred: 10,
        }),
      });

      const { container } = render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      // Check for adequate padding/spacing
      const statsContainer = container.querySelector(".stats-container");
      expect(statsContainer).toHaveClass("p-4", "space-y-4");

      // Stats items should have mobile-friendly sizes
      const statItems = container.querySelectorAll(".stat-item");
      statItems.forEach((item) => {
        expect(item).toHaveClass("min-h-[44px]"); // iOS touch target minimum
      });
    });
  });

  describe("Component Placement", () => {
    it("should render within settings page container", () => {
      const { container } = render(
        <div className="settings-page">
          <ArticleStats />
        </div>
      );

      const settingsPage = container.querySelector(".settings-page");
      const statsComponent = settingsPage?.querySelector(
        "[data-testid='article-stats']"
      );

      expect(statsComponent).toBeInTheDocument();
    });

    it("should apply correct positioning classes for settings context", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 100,
          unread: 25,
          starred: 10,
        }),
      });

      const { container } = render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      const statsContainer = container.querySelector(
        "[data-testid='article-stats']"
      );
      expect(statsContainer).toHaveClass(
        "glass-morphing",
        "rounded-lg",
        "p-4",
        "mb-6" // Spacing in settings page
      );
    });
  });

  describe("Refresh and Update", () => {
    it("should refetch stats when component remounts", async () => {
      const mockStats1 = { total: 100, unread: 25, starred: 10 };
      const mockStats2 = { total: 150, unread: 30, starred: 15 };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStats1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStats2,
        });

      // First render
      const { unmount } = render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("100")).toBeInTheDocument();
      });

      // Unmount and remount
      unmount();
      render(<ArticleStats />);

      // Should fetch again with new data
      await waitFor(() => {
        expect(screen.getByText("150")).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should not refetch on prop changes (no props)", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 100,
          unread: 25,
          starred: 10,
        }),
      });

      const { rerender } = render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("100")).toBeInTheDocument();
      });

      // Rerender without changes
      rerender(<ArticleStats />);

      // Should not fetch again
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for screen readers", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 100,
          unread: 25,
          starred: 10,
        }),
      });

      const { container } = render(<ArticleStats />);

      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      // Component should have descriptive ARIA label
      const statsContainer = container.querySelector(
        "[data-testid='article-stats']"
      );
      expect(statsContainer).toHaveAttribute(
        "aria-label",
        "Article statistics summary"
      );

      // Individual stats should be labeled
      const totalStat = screen.getByText("100").closest("dd");
      expect(totalStat).toHaveAttribute("aria-label", "Total articles: 100");

      const unreadStat = screen.getByText("25").closest("dd");
      expect(unreadStat).toHaveAttribute("aria-label", "Unread articles: 25");

      const starredStat = screen.getByText("10").closest("dd");
      expect(starredStat).toHaveAttribute("aria-label", "Starred articles: 10");
    });

    it("should announce loading state to screen readers", () => {
      // Mock pending fetch
      (global.fetch as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<ArticleStats />);

      const loadingElement = container.querySelector("[aria-busy='true']");
      expect(loadingElement).toBeInTheDocument();
      expect(loadingElement).toHaveAttribute(
        "aria-label",
        "Loading article statistics"
      );
    });
  });
});
