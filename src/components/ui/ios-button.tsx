"use client";

import React, { useRef } from "react";
import { Button, type ButtonProps } from "./button";

interface IOSButtonProps extends ButtonProps {
  onPress?: () => void;
}

/**
 * Base button component optimized for iOS Safari touch handling
 * Solves the issue where iOS requires double-tap due to hover states
 *
 * @see docs/tech/button-architecture.md for complete button architecture guide
 *
 * This is the foundation of our button hierarchy. For article actions,
 * use ArticleActionButton instead of using this directly.
 *
 * Features:
 * - Prevents iOS double-tap requirement
 * - Stops event propagation to prevent unintended parent clicks
 * - Handles both touch and mouse events correctly
 */
export const IOSButton = React.forwardRef<HTMLButtonElement, IOSButtonProps>(
  ({ onPress, onClick, children, ...props }, ref) => {
    const touchedRef = useRef(false);

    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Call the onPress or onClick handler
      if (onPress) {
        onPress();
      } else if (onClick) {
        onClick(e as any);
      }

      // Reset touch state
      touchedRef.current = false;
    };

    const handleTouchStart = () => {
      touchedRef.current = true;
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      // On iOS, ignore click events that come from touch
      // (they arrive after touchend and cause double-firing)
      if (touchedRef.current) {
        e.preventDefault();
        touchedRef.current = false;
        return;
      }

      // For non-touch clicks (desktop), call the handler normally
      if (onClick) {
        onClick(e);
      } else if (onPress) {
        onPress();
      }
    };

    return (
      <Button
        ref={ref}
        {...props}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          ...props.style,
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          touchAction: "manipulation",
        }}
      >
        {children}
      </Button>
    );
  }
);

IOSButton.displayName = "IOSButton";
