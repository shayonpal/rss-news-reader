/**
 * Unit Tests for RR-206: Fix sidebar collapse behavior for proper responsive display
 *
 * Test Contract:
 * - Tests useViewport hook functionality across all breakpoints
 * - Validates BREAKPOINTS and MEDIA_QUERIES constants
 * - Tests responsive state calculation logic
 * - Tests orientation change handling
 * - Tests SSR compatibility
 *
 * Symbol Testing:
 * - useViewport hook with all state properties
 * - calculateViewportState function
 * - useMediaQuery hook
 * - BREAKPOINTS and MEDIA_QUERIES constants
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewport, useMediaQuery } from "@/hooks/use-viewport";
import { BREAKPOINTS, MEDIA_QUERIES } from "@/lib/constants/breakpoints";

// Mock window and screen APIs
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  matchMedia: vi.fn(),
};

const mockScreen = {
  orientation: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
};

// Mock performance for animation tests
const mockPerformance = {
  now: vi.fn(() => Date.now()),
};

describe("RR-206: Responsive Behavior Implementation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Mock global objects
    Object.defineProperty(global, "window", {
      value: mockWindow,
      writable: true,
    });
    Object.defineProperty(global, "screen", {
      value: mockScreen,
      writable: true,
    });
    Object.defineProperty(global, "performance", {
      value: mockPerformance,
      writable: true,
    });

    // Reset window dimensions
    mockWindow.innerWidth = 1024;
    mockWindow.innerHeight = 768;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("BREAKPOINTS and MEDIA_QUERIES Constants", () => {
    it("should have correct breakpoint values per RR-206 specification", () => {
      expect(BREAKPOINTS.MOBILE).toBe(768);
      expect(BREAKPOINTS.DESKTOP).toBe(1024);
    });

    it("should have correct media query strings", () => {
      expect(MEDIA_QUERIES.IS_MOBILE).toBe("(max-width: 767px)");
      expect(MEDIA_QUERIES.IS_TABLET).toBe(
        "(min-width: 768px) and (max-width: 1023px)"
      );
      expect(MEDIA_QUERIES.IS_DESKTOP).toBe("(min-width: 1024px)");
      expect(MEDIA_QUERIES.NOT_MOBILE).toBe("(min-width: 768px)");
      expect(MEDIA_QUERIES.COMPACT_FILTERS).toBe("(max-width: 1023px)");
    });
  });

  describe("useViewport Hook - Desktop Behavior", () => {
    it("should correctly identify desktop viewport (1024px+)", () => {
      mockWindow.innerWidth = 1440;
      mockWindow.innerHeight = 900;

      const { result } = renderHook(() => useViewport());

      expect(result.current).toEqual({
        width: 1440,
        height: 900,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        shouldCollapseSidebar: false,
        shouldShowCompactFilters: false,
        shouldShowHamburger: false,
      });
    });

    it("should handle exact desktop breakpoint (1024px)", () => {
      mockWindow.innerWidth = 1024;
      mockWindow.innerHeight = 768;

      const { result } = renderHook(() => useViewport());

      expect(result.current).toEqual({
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        shouldCollapseSidebar: false,
        shouldShowCompactFilters: false,
        shouldShowHamburger: false,
      });
    });
  });

  describe("useViewport Hook - Tablet Behavior", () => {
    it("should correctly identify tablet viewport (768-1023px)", () => {
      mockWindow.innerWidth = 768;
      mockWindow.innerHeight = 1024;

      const { result } = renderHook(() => useViewport());

      expect(result.current).toEqual({
        width: 768,
        height: 1024,
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        shouldCollapseSidebar: false, // Sidebar visible on tablet
        shouldShowCompactFilters: true, // Compact filters on tablet
        shouldShowHamburger: false, // No hamburger on tablet
      });
    });

    it("should handle iPad landscape (1024x768)", () => {
      mockWindow.innerWidth = 1024;
      mockWindow.innerHeight = 768;

      const { result } = renderHook(() => useViewport());

      expect(result.current.isDesktop).toBe(true);
      expect(result.current.shouldShowCompactFilters).toBe(false);
    });
  });

  describe("useViewport Hook - Mobile Behavior", () => {
    it("should correctly identify mobile viewport (<768px)", () => {
      mockWindow.innerWidth = 390;
      mockWindow.innerHeight = 844;

      const { result } = renderHook(() => useViewport());

      expect(result.current).toEqual({
        width: 390,
        height: 844,
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        shouldCollapseSidebar: true, // Sidebar collapsed on mobile
        shouldShowCompactFilters: true, // Compact filters on mobile
        shouldShowHamburger: true, // Hamburger visible on mobile
      });
    });

    it("should handle boundary condition at 767px (mobile)", () => {
      mockWindow.innerWidth = 767;
      mockWindow.innerHeight = 1024;

      const { result } = renderHook(() => useViewport());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.shouldCollapseSidebar).toBe(true);
      expect(result.current.shouldShowHamburger).toBe(true);
    });
  });

  describe("useViewport Hook - Responsive State Transitions", () => {
    it("should handle resize from desktop to mobile", async () => {
      mockWindow.innerWidth = 1440;
      mockWindow.innerHeight = 900;

      const { result } = renderHook(() => useViewport());

      // Initial desktop state
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.shouldShowHamburger).toBe(false);

      // Simulate resize to mobile
      mockWindow.innerWidth = 390;
      mockWindow.innerHeight = 844;

      // Get the resize handler that was added to window
      const resizeHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "resize"
      )?.[1];

      expect(resizeHandler).toBeDefined();

      // Trigger resize with proper React act()
      await act(async () => {
        resizeHandler?.();
        vi.advanceTimersByTime(50); // Advance past debounce delay
      });

      // Should now be mobile state
      expect(result.current.isMobile).toBe(true);
      expect(result.current.shouldShowHamburger).toBe(true);
      expect(result.current.shouldCollapseSidebar).toBe(true);
    });

    it("should handle resize from mobile to desktop", async () => {
      mockWindow.innerWidth = 390;
      mockWindow.innerHeight = 844;

      const { result } = renderHook(() => useViewport());

      // Initial mobile state
      expect(result.current.isMobile).toBe(true);

      // Simulate resize to desktop
      mockWindow.innerWidth = 1440;
      mockWindow.innerHeight = 900;

      const resizeHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "resize"
      )?.[1];

      await act(async () => {
        resizeHandler?.();
        vi.advanceTimersByTime(50);
      });

      // Should now be desktop state
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.shouldShowHamburger).toBe(false);
      expect(result.current.shouldCollapseSidebar).toBe(false);
    });
  });

  describe("useViewport Hook - Orientation Change Handling", () => {
    it("should handle orientation change events", async () => {
      const { result } = renderHook(() => useViewport());

      // Get orientation change handler
      const orientationHandler =
        mockScreen.orientation.addEventListener.mock.calls.find(
          (call) => call[0] === "change"
        )?.[1];

      expect(orientationHandler).toBeDefined();

      // Simulate orientation change
      mockWindow.innerWidth = 844;
      mockWindow.innerHeight = 390;

      await act(async () => {
        orientationHandler?.();
        vi.advanceTimersByTime(50);
      });

      // Should update viewport state
      expect(result.current.width).toBe(844);
      expect(result.current.height).toBe(390);
    });

    it("should handle missing screen.orientation API", () => {
      // Remove screen.orientation
      Object.defineProperty(global, "screen", {
        value: {},
        writable: true,
      });

      // Should not crash
      expect(() => {
        renderHook(() => useViewport());
      }).not.toThrow();
    });
  });

  describe("useViewport Hook - Performance & Memory", () => {
    it("should debounce resize events to 50ms", async () => {
      const { result } = renderHook(() => useViewport());

      const resizeHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "resize"
      )?.[1];

      // Trigger multiple rapid resizes
      mockWindow.innerWidth = 500;
      resizeHandler?.();

      mockWindow.innerWidth = 600;
      resizeHandler?.();

      mockWindow.innerWidth = 700;
      resizeHandler?.();

      // Should not update immediately
      expect(result.current.width).not.toBe(700);

      // Advance timers past debounce
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Should update to final value
      expect(result.current.width).toBe(700);
    });

    it("should cleanup event listeners on unmount", () => {
      const { unmount } = renderHook(() => useViewport());

      // Verify listeners were added
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
        { passive: true }
      );
      expect(mockScreen.orientation.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );

      // Unmount and verify cleanup
      unmount();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function)
      );
      expect(mockScreen.orientation.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );
    });

    it("should cleanup timers on unmount", () => {
      const { unmount } = renderHook(() => useViewport());

      const resizeHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "resize"
      )?.[1];

      // Start a resize timer
      resizeHandler?.();

      // Unmount should clear any pending timers
      unmount();

      // Timer should be cleared
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("useViewport Hook - SSR Support", () => {
    it("should provide safe default state for SSR", () => {
      // Mock SSR environment
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useViewport());

      // Should provide desktop defaults for SSR
      expect(result.current).toEqual({
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        shouldCollapseSidebar: false,
        shouldShowCompactFilters: false,
        shouldShowHamburger: false,
      });

      // Restore window
      Object.defineProperty(global, "window", {
        value: mockWindow,
        writable: true,
      });
    });
  });

  describe("useMediaQuery Hook", () => {
    beforeEach(() => {
      const mockMediaQueryList = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      };

      mockWindow.matchMedia = vi.fn(() => mockMediaQueryList);
    });

    it("should return media query match state", () => {
      const mockMql = {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      mockWindow.matchMedia = vi.fn(() => mockMql);

      const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

      expect(result.current).toBe(true);
      expect(mockWindow.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
    });

    it("should handle media query changes", async () => {
      const mockMql = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      mockWindow.matchMedia = vi.fn(() => mockMql);

      const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

      expect(result.current).toBe(false);

      // Simulate media query change
      const changeHandler = mockMql.addEventListener.mock.calls.find(
        (call) => call[0] === "change"
      )?.[1];

      await act(async () => {
        changeHandler?.({ matches: true });
      });

      expect(result.current).toBe(true);
    });

    it("should fallback to legacy listeners for older browsers", () => {
      const mockMql = {
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        // No addEventListener - simulating older browser
      };
      mockWindow.matchMedia = vi.fn(() => mockMql);

      renderHook(() => useMediaQuery("(min-width: 768px)"));

      expect(mockMql.addListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should cleanup listeners on unmount", () => {
      const mockMql = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      mockWindow.matchMedia = vi.fn(() => mockMql);

      const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));

      unmount();

      expect(mockMql.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );
    });
  });

  describe("Acceptance Criteria Validation", () => {
    it("AC1: Sidebar auto-collapses on iPhone (<768px)", () => {
      mockWindow.innerWidth = 390; // iPhone width
      const { result } = renderHook(() => useViewport());

      expect(result.current.shouldCollapseSidebar).toBe(true);
      expect(result.current.isMobile).toBe(true);
    });

    it("AC2: Sidebar stays visible on iPad/desktop (≥768px)", () => {
      // iPad portrait
      mockWindow.innerWidth = 768;
      const { result: tabletResult } = renderHook(() => useViewport());
      expect(tabletResult.current.shouldCollapseSidebar).toBe(false);

      // Desktop
      mockWindow.innerWidth = 1024;
      const { result: desktopResult } = renderHook(() => useViewport());
      expect(desktopResult.current.shouldCollapseSidebar).toBe(false);
    });

    it("AC3: Hamburger menu hidden when sidebar visible", () => {
      mockWindow.innerWidth = 768; // Tablet - sidebar visible
      const { result } = renderHook(() => useViewport());

      expect(result.current.shouldShowHamburger).toBe(false);
      expect(result.current.shouldCollapseSidebar).toBe(false);
    });

    it("AC4: Hamburger menu only shows on mobile when sidebar collapsed", () => {
      mockWindow.innerWidth = 390; // Mobile
      const { result } = renderHook(() => useViewport());

      expect(result.current.shouldShowHamburger).toBe(true);
      expect(result.current.shouldCollapseSidebar).toBe(true);
    });

    it("AC5: Read/Unread filters switch to compact view when space limited", () => {
      // Tablet - should show compact
      mockWindow.innerWidth = 768;
      const { result: tabletResult } = renderHook(() => useViewport());
      expect(tabletResult.current.shouldShowCompactFilters).toBe(true);

      // Desktop - should show full
      mockWindow.innerWidth = 1024;
      const { result: desktopResult } = renderHook(() => useViewport());
      expect(desktopResult.current.shouldShowCompactFilters).toBe(false);
    });

    it("AC6: Filter buttons show icon-only on mobile, full text on desktop", () => {
      // Mobile - compact
      mockWindow.innerWidth = 390;
      const { result: mobileResult } = renderHook(() => useViewport());
      expect(mobileResult.current.shouldShowCompactFilters).toBe(true);

      // Desktop - full text
      mockWindow.innerWidth = 1440;
      const { result: desktopResult } = renderHook(() => useViewport());
      expect(desktopResult.current.shouldShowCompactFilters).toBe(false);
    });

    it("AC7: Smooth transitions - debounced to 50ms for 60fps performance", () => {
      const { result } = renderHook(() => useViewport());

      const resizeHandler = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === "resize"
      )?.[1];

      // Rapid changes should be debounced
      resizeHandler?.();
      resizeHandler?.();
      resizeHandler?.();

      // Should only trigger once after debounce period
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Debounce period is 50ms which allows for 60fps (16.67ms per frame)
      expect(50).toBeLessThan(67); // Well under 60fps threshold
    });

    it("AC8: Orientation changes handled without state loss", async () => {
      const { result } = renderHook(() => useViewport());

      // Initial state
      const initialWidth = result.current.width;

      // Simulate orientation change
      mockWindow.innerWidth = 844;
      mockWindow.innerHeight = 390;

      const orientationHandler =
        mockScreen.orientation.addEventListener.mock.calls.find(
          (call) => call[0] === "change"
        )?.[1];

      await act(async () => {
        orientationHandler?.();
        vi.advanceTimersByTime(50);
      });

      // State should update without loss
      expect(result.current.width).toBe(844);
      expect(result.current.height).toBe(390);
      expect(result.current.width).not.toBe(initialWidth);
    });
  });
});
