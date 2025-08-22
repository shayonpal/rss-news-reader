/**
 * RR-215: iOS Morphing Navigation Button
 * Animated button that morphs between hamburger and back icon based on scroll state
 */

"use client";

import React from "react";
import { Menu, ArrowLeft } from "lucide-react";
import type { ScrollState } from "@/services/scroll-coordinator";
import { GlassIconButton } from "./glass-button";

interface MorphingNavButtonProps {
  scrollState: ScrollState;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Navigation button that morphs between hamburger (expanded) and back (collapsed) icons
 * with smooth iOS-style animations
 */
export function MorphingNavButton({
  scrollState,
  onClick,
  ariaLabel = "Toggle navigation",
  className = "",
}: MorphingNavButtonProps) {
  const isCollapsed = scrollState === "collapsed";

  // Reduced motion support
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
        false
      : false;

  const transitionDuration = prefersReducedMotion ? "0.01s" : "0.25s";

  return (
    <GlassIconButton
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid="morphing-nav-button"
      data-scroll-state={scrollState}
      variant="liquid-glass"
      className={className}
    >
      {/* Icon container for morphing animation */}
      <div
        data-testid="icon-container"
        className="relative h-6 w-6"
        style={{
          transition: `all ${transitionDuration} cubic-bezier(0.32, 0.72, 0, 1)`,
          willChange: "transform",
        }}
      >
        {/* Hamburger Icon */}
        <Menu
          data-testid="hamburger-icon"
          className="absolute inset-0 h-6 w-6 text-current"
          style={{
            opacity: isCollapsed ? 0 : 1,
            transform: isCollapsed
              ? "rotate(90deg) scale(0.8)"
              : "rotate(0deg) scale(1)",
            transition: `all ${transitionDuration} cubic-bezier(0.32, 0.72, 0, 1)`,
          }}
        />

        {/* Back Icon */}
        <ArrowLeft
          data-testid="back-icon"
          className="absolute inset-0 h-6 w-6 text-current"
          style={{
            opacity: isCollapsed ? 1 : 0,
            transform: isCollapsed
              ? "rotate(0deg) scale(1)"
              : "rotate(-90deg) scale(0.8)",
            transition: `all ${transitionDuration} cubic-bezier(0.32, 0.72, 0, 1)`,
          }}
        />
      </div>
    </GlassIconButton>
  );
}
