/**
 * Reusable Scroll-Responsive Floating Element
 * Provides consistent scroll-based hide/show behavior for floating UI components
 * Used across listing page and article detail page for standardized UX
 */

"use client";

import React, { useState, useEffect, useRef } from "react";

interface ScrollHideFloatingElementProps {
  children: React.ReactNode;
  className?: string;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  offset?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  scrollContainer?: React.RefObject<HTMLElement>;
  hideThreshold?: number; // Pixels scrolled before hiding
  showOnScrollUp?: boolean; // Show immediately when scrolling up
  animationDuration?: number; // Animation duration in ms
  visible?: boolean; // External visibility control
}

/**
 * Floating element that smoothly hides when scrolling down and shows when scrolling up
 * Provides consistent behavior across all pages
 */
export function ScrollHideFloatingElement({
  children,
  className = "",
  position = "top-right",
  offset = {},
  scrollContainer,
  hideThreshold = 50,
  showOnScrollUp = true,
  animationDuration = 300,
  visible = true,
}: ScrollHideFloatingElementProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Position classes mapping - unified 16px spacing for consistency
  const positionClasses = {
    "top-left": "top-4 left-4",    // 16px top spacing
    "top-right": "top-4 right-4",  // 16px top spacing
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  // PWA safe area classes - unified base spacing
  const pwaClasses = {
    "top-left": "pwa-standalone:top-[calc(16px+env(safe-area-inset-top))] pwa-standalone:left-[calc(16px+env(safe-area-inset-left))]",
    "top-right": "pwa-standalone:top-[calc(16px+env(safe-area-inset-top))] pwa-standalone:right-[calc(16px+env(safe-area-inset-right))]",
    "bottom-left": "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))] pwa-standalone:left-[calc(16px+env(safe-area-inset-left))]",
    "bottom-right": "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))] pwa-standalone:right-[calc(16px+env(safe-area-inset-right))]",
  };

  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainer?.current || window;
      const currentScrollY = container === window 
        ? window.scrollY 
        : (container as HTMLElement).scrollTop;

      const scrollDelta = currentScrollY - lastScrollY;
      
      // Fixed translation distance instead of scroll-dependent over-translation
      if (elementRef.current) {
        const hideDistance = 64; // Fixed distance - prevents off-screen drift
        const isScrollingDown = scrollDelta > 0;
        const isScrollingUp = scrollDelta < 0;
        const isAtTop = currentScrollY <= 10;
        const pastThreshold = currentScrollY > hideThreshold;
        
        // Determine if element should be hidden
        const shouldHide = isScrollingDown && pastThreshold;
        const shouldShow = isScrollingUp || isAtTop;
        
        // Calculate translation direction based on position
        const translateDirection = position.startsWith("top") ? -1 : 1;
        const translateY = shouldHide ? hideDistance * translateDirection : 0;
        
        // Apply transforms with proper visibility controls
        elementRef.current.style.transform = `translateY(${translateY}px)`;
        elementRef.current.style.opacity = shouldHide ? "0" : "1";
        elementRef.current.style.pointerEvents = shouldHide ? "none" : "auto";
      }

      setLastScrollY(currentScrollY);
    };

    const container = scrollContainer?.current || window;
    const eventTarget = container === window ? window : container;
    
    if (eventTarget) {
      eventTarget.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      if (eventTarget) {
        eventTarget.removeEventListener("scroll", handleScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollContainer, hideThreshold, showOnScrollUp, lastScrollY, visible]);

  // Update visibility when external visible prop changes
  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  // Build custom offset styles if provided
  const customStyles: React.CSSProperties = {
    transition: `opacity ${animationDuration}ms cubic-bezier(0.32, 0.72, 0, 1)`,
    willChange: "transform, opacity",
    ...offset,
  };

  return (
    <div
      ref={elementRef}
      className={`
        fixed z-50
        ${positionClasses[position]}
        ${pwaClasses[position]}
        ${className}
      `}
      style={customStyles}
    >
      {children}
    </div>
  );
}