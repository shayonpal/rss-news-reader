'use client';

import React, { useRef } from 'react';
import { Button, type ButtonProps } from './button';

interface IOSButtonProps extends ButtonProps {
  onPress?: () => void;
}

/**
 * Button component optimized for iOS Safari touch handling
 * Solves the issue where iOS requires double-tap due to hover states
 */
export function IOSButton({ onPress, onClick, children, ...props }: IOSButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchedRef = useRef(false);

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
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
      ref={buttonRef}
      {...props}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        ...props.style,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {children}
    </Button>
  );
}