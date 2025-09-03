/**
 * RR-215: iOS Header Scroll Hook
 * Provides iOS-style header scroll behavior with dynamic calculations
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getScrollCoordinator,
  type ScrollState,
} from "@/services/scroll-coordinator";

export interface IOSHeaderScrollState {
  scrollState: ScrollState;
  scrollY: number;
  isScrollingUp: boolean;
  titleScale: number;
  headerHeight: number;
  blurIntensity: number;
  contentVisible: boolean; // New: Content header visibility
}

/**
 * Hook for iOS-style scrollable header behavior
 * Integrates with ScrollCoordinator for unified scroll management
 */
export function useIOSHeaderScroll(): IOSHeaderScrollState {
  const [scrollState, setScrollState] = useState<ScrollState>("expanded");
  const [scrollY, setScrollY] = useState(0);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);
  const componentId = useRef(
    `ios-header-${Math.random().toString(36).substr(2, 9)}`
  );

  const updateState = useCallback(
    (position: {
      scrollY: number;
      scrollState: ScrollState;
      isScrollingUp: boolean;
      contentVisible?: boolean;
    }) => {
      setScrollY(position.scrollY);
      setScrollState(position.scrollState);
      setIsScrollingUp(position.isScrollingUp);
      if (position.contentVisible !== undefined) {
        setContentVisible(position.contentVisible);
      }
    },
    []
  );

  useEffect(() => {
    const coordinator = getScrollCoordinator();
    const id = componentId.current;
    coordinator.subscribe(id, updateState);

    return () => {
      coordinator.unsubscribe(id);
    };
  }, [updateState]);

  // Calculate dynamic values based on scroll position
  const titleScale = Math.max(0.5, 1 - scrollY / 300);
  const headerHeight = Math.max(54, 120 - scrollY * 0.4);
  const blurIntensity = Math.min(16, 8 + scrollY / 20);

  return {
    scrollState,
    scrollY,
    isScrollingUp,
    titleScale,
    headerHeight,
    blurIntensity,
    contentVisible,
  };
}
