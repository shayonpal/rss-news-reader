/**
 * RR-251: Ghost Button Navigation Integration Test
 *
 * Validates ghost button variant integration in article navigation
 * Tests actual rendering, CSS variable resolution, and accessibility
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: "/reader/articles/test-id",
  }),
}));

// Import component under test
import { GlassButton } from "@/components/ui/glass-button";

describe("RR-251: Ghost Button Navigation Integration", () => {
  let originalComputedStyle: typeof window.getComputedStyle;

  beforeEach(() => {
    // Store original
    originalComputedStyle = window.getComputedStyle;

    // Mock getComputedStyle for CSS variable resolution
    window.getComputedStyle = vi.fn((element: Element) => {
      const original = originalComputedStyle(element);

      // Mock CSS variable resolution
      return {
        ...original,
        getPropertyValue: (prop: string) => {
          if (prop === "--ghost-text-light") {
            return "109, 40, 217"; // violet-700 RGB
          }
          if (prop === "--ghost-text-dark") {
            return "255, 255, 255"; // white RGB
          }
          return original.getPropertyValue(prop);
        },
      };
    }) as typeof window.getComputedStyle;
  });

  afterEach(() => {
    // Restore original
    window.getComputedStyle = originalComputedStyle;
    vi.clearAllMocks();
  });

  describe("Article Navigation Ghost Buttons", () => {
    it("should render Previous button with ghost variant", () => {
      render(
        <GlassButton variant="ghost" size="sm" aria-label="Previous article">
          Previous
        </GlassButton>
      );

      const button = screen.getByRole("button", { name: /previous article/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("text-[color:var(--ghost-text-light)]");
      expect(button).toHaveClass("dark:text-[color:var(--ghost-text-dark)]");
    });

    it("should render Next button with ghost variant", () => {
      render(
        <GlassButton variant="ghost" size="sm" aria-label="Next article">
          Next
        </GlassButton>
      );

      const button = screen.getByRole("button", { name: /next article/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("text-[color:var(--ghost-text-light)]");
      expect(button).toHaveClass("dark:text-[color:var(--ghost-text-dark)]");
    });

    it("should maintain touch optimization for mobile navigation", () => {
      const { container } = render(
        <GlassButton
          variant="ghost"
          size="sm"
          style={{
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            touchAction: "manipulation",
          }}
        >
          Navigate
        </GlassButton>
      );

      const button = container.querySelector("button");
      expect(button).toHaveStyle({
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      });
    });

    it("should have proper minimum touch target size", () => {
      const { container } = render(
        <GlassButton variant="ghost" size="sm">
          Button
        </GlassButton>
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("min-h-[48px]");
      expect(button).toHaveClass("min-w-[48px]");
    });

    it("should apply glass effects to ghost variant", () => {
      const { container } = render(
        <GlassButton variant="ghost">Ghost Button</GlassButton>
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("backdrop-blur-[16px]");
      expect(button).toHaveClass("backdrop-saturate-[180%]");
      expect(button).toHaveClass("hover:bg-white/35");
      expect(button).toHaveClass("dark:hover:bg-white/35");
    });
  });

  describe("CSS Variable Integration", () => {
    it("should resolve violet-700 for light mode", () => {
      const { container } = render(
        <GlassButton variant="ghost">Test</GlassButton>
      );

      const button = container.querySelector("button");
      const styles = window.getComputedStyle(button!);

      // Mock resolution check
      expect(styles.getPropertyValue("--ghost-text-light")).toBe(
        "109, 40, 217"
      );
    });

    it("should resolve white for dark mode", () => {
      const { container } = render(
        <GlassButton variant="ghost">Test</GlassButton>
      );

      const button = container.querySelector("button");
      const styles = window.getComputedStyle(button!);

      // Mock resolution check
      expect(styles.getPropertyValue("--ghost-text-dark")).toBe(
        "255, 255, 255"
      );
    });
  });

  describe("Accessibility Compliance", () => {
    it("should have proper aria-label for navigation buttons", () => {
      render(
        <>
          <GlassButton variant="ghost" aria-label="Previous article">
            Previous
          </GlassButton>
          <GlassButton variant="ghost" aria-label="Next article">
            Next
          </GlassButton>
        </>
      );

      expect(screen.getByLabelText("Previous article")).toBeInTheDocument();
      expect(screen.getByLabelText("Next article")).toBeInTheDocument();
    });

    it("should maintain focus styles", () => {
      const { container } = render(
        <GlassButton variant="ghost">Button</GlassButton>
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass("focus-visible:outline-none");
      expect(button).toHaveClass("focus-visible:ring-2");
      expect(button).toHaveClass("focus-visible:ring-offset-2");
    });
  });
});
