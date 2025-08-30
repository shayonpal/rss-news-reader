/**
 * Simplified Unit Tests for RR-206: Responsive behavior verification
 * Tests the core responsive logic without complex component mocking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import "@testing-library/jest-dom";

// Test the viewport hook directly
import { useViewport } from "@/hooks/use-viewport";
import { BREAKPOINTS } from "@/lib/constants/breakpoints";

describe("RR-206: Responsive Breakpoint Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Viewport Hook Breakpoint Detection", () => {
    it("should correctly identify mobile viewport (<768px)", () => {
      // Mock window dimensions
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375, // iPhone width
      });

      const { result } = renderHook(() => useViewport());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.shouldCollapseSidebar).toBe(true);
      expect(result.current.shouldShowCompactFilters).toBe(true);
      expect(result.current.shouldShowHamburger).toBe(true);
    });

    it("should correctly identify tablet viewport (768-1023px)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 900, // Tablet width
      });

      const { result } = renderHook(() => useViewport());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.shouldCollapseSidebar).toBe(false);
      expect(result.current.shouldShowCompactFilters).toBe(true);
      expect(result.current.shouldShowHamburger).toBe(false);
    });

    it("should correctly identify desktop viewport (≥1024px)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1440, // Desktop width
      });

      const { result } = renderHook(() => useViewport());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.shouldCollapseSidebar).toBe(false);
      expect(result.current.shouldShowCompactFilters).toBe(false);
      expect(result.current.shouldShowHamburger).toBe(false);
    });
  });

  describe("Breakpoint Constants", () => {
    it("should have correct breakpoint values", () => {
      expect(BREAKPOINTS.MOBILE).toBe(768);
      expect(BREAKPOINTS.DESKTOP).toBe(1024);
    });

    it("should define correct responsive collapse order", () => {
      // Filter buttons collapse at 1024px
      const filterBreakpoint = BREAKPOINTS.DESKTOP;
      // Mark All Read button collapses at 768px
      const markAllReadBreakpoint = BREAKPOINTS.MOBILE;
      // Sidebar collapses at 768px
      const sidebarBreakpoint = BREAKPOINTS.MOBILE;

      // Verify the order: filters > mark all read = sidebar
      expect(filterBreakpoint).toBeGreaterThan(markAllReadBreakpoint);
      expect(markAllReadBreakpoint).toBe(sidebarBreakpoint);
    });
  });

  describe("Responsive Behavior at Breakpoints", () => {
    it("should show everything with full text on desktop (≥1024px)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useViewport());

      // Everything should be expanded
      expect(result.current.shouldCollapseSidebar).toBe(false); // Sidebar visible
      expect(result.current.shouldShowCompactFilters).toBe(false); // Full text filters
      expect(result.current.shouldShowHamburger).toBe(false); // No hamburger
    });

    it("should show compact buttons on tablet (768-1023px)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 768,
      });

      const { result } = renderHook(() => useViewport());

      // Sidebar visible, buttons compact
      expect(result.current.shouldCollapseSidebar).toBe(false); // Sidebar visible
      expect(result.current.shouldShowCompactFilters).toBe(true); // Icon-only filters
      expect(result.current.shouldShowHamburger).toBe(false); // No hamburger
    });

    it("should collapse sidebar on mobile (<768px)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 767,
      });

      const { result } = renderHook(() => useViewport());

      // Everything collapsed/compact
      expect(result.current.shouldCollapseSidebar).toBe(true); // Sidebar collapsed
      expect(result.current.shouldShowCompactFilters).toBe(true); // Icon-only filters
      expect(result.current.shouldShowHamburger).toBe(true); // Hamburger visible
    });
  });
});
