/**
 * Viewport hook for responsive behavior
 * Implements RR-206 specifications for breakpoint detection
 */

"use client";

import { useState, useEffect } from "react";
import { BREAKPOINTS, MEDIA_QUERIES } from "@/lib/constants/breakpoints";

export interface ViewportState {
  width: number;
  height: number;
  isMobile: boolean; // < 768px
  isTablet: boolean; // 768px - 1023px
  isDesktop: boolean; // >= 1024px
  shouldCollapseSidebar: boolean; // < 768px
  shouldShowCompactFilters: boolean; // < 1024px
  shouldShowHamburger: boolean; // < 768px
}

export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(() => {
    // Always return SSR-safe defaults during initial render
    // This prevents hydration mismatches on iPhone Safari
    return {
      width: 1024,
      height: 768,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      shouldCollapseSidebar: false,
      shouldShowCompactFilters: false,
      shouldShowHamburger: false,
    };
  });

  useEffect(() => {
    // Set actual viewport state after hydration
    const width = window.innerWidth;
    const height = window.innerHeight;
    setViewport(calculateViewportState(width, height));

    // Timer for debouncing - declared outside handler to prevent memory leak
    let resizeTimer: NodeJS.Timeout | null = null;

    // Handle resize events with proper debouncing
    const handleResize = () => {
      // Clear existing timer if any
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      // Set new timer with reduced delay for smoother transitions
      resizeTimer = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        setViewport(calculateViewportState(width, height));
        resizeTimer = null; // Clear reference after execution
      }, 50); // Reduced from 100ms to 50ms for smoother transitions
    };

    // Modern orientation change handling
    const handleOrientationChange = () => {
      // Use resize handler which already has debouncing
      handleResize();
    };

    // Add event listeners
    window.addEventListener("resize", handleResize, { passive: true });

    // Use modern screen.orientation API if available, fallback to resize only
    if (screen.orientation) {
      screen.orientation.addEventListener("change", handleOrientationChange);
    }

    return () => {
      // Cleanup timer if it exists
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      window.removeEventListener("resize", handleResize);
      if (screen.orientation) {
        screen.orientation.removeEventListener(
          "change",
          handleOrientationChange
        );
      }
    };
  }, []);

  return viewport;
}

// Calculate viewport state based on dimensions
function calculateViewportState(width: number, height: number): ViewportState {
  // Clear boundary definitions:
  // Mobile: width < 768px
  // Tablet: 768px <= width < 1024px
  // Desktop: width >= 1024px
  const isMobile = width < BREAKPOINTS.MOBILE;
  const isTablet = width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP;
  const isDesktop = width >= BREAKPOINTS.DESKTOP;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    // Sidebar collapses only on mobile (< 768px)
    shouldCollapseSidebar: width < BREAKPOINTS.MOBILE,
    // Filters show compact (icons only) below desktop (< 1024px)
    shouldShowCompactFilters: width < BREAKPOINTS.DESKTOP,
    // Hamburger shows only on mobile (< 768px)
    shouldShowHamburger: width < BREAKPOINTS.MOBILE,
  };
}

// Hook for using media queries with SSR support
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Modern browsers
    if (media.addEventListener) {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    } else {
      // Legacy browsers
      media.addListener(listener);
      return () => media.removeListener(listener);
    }
  }, [query]);

  return matches;
}
