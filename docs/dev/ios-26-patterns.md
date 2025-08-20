# iOS 26 Development Patterns: Implementation Guide

## Overview

This guide provides comprehensive instructions for implementing iOS 26 Liquid Glass patterns in new components, based on the production-tested RR-179 Mark All Read implementation. Follow these patterns to ensure consistency, performance, and maintainability across the application.

## Getting Started

### Prerequisites

- Understanding of React hooks and state management
- Familiarity with CSS custom properties and animations
- Knowledge of responsive design principles
- Experience with TypeScript (optional but recommended)

### Setup Checklist

1. **CSS Architecture**: Ensure `src/styles/liquid-glass-button.css` is imported
2. **Custom Properties**: Verify CSS custom properties are available
3. **State Management**: Choose appropriate state management approach
4. **Performance Tools**: Set up performance monitoring for 60fps validation

## Component Implementation Pattern

### 1. State Machine Setup

Every liquid glass component should implement a clear state machine:

```typescript
// Define state types
type ComponentState = 'normal' | 'confirming' | 'loading' | 'disabled';

// State management hooks
const [isProcessing, setIsProcessing] = useState(false);
const [waitingConfirmation, setWaitingConfirmation] = useState(false);

// Derived state calculation
const componentState = useMemo((): ComponentState => {
  if (/* disabled condition */) return 'disabled';
  if (isProcessing) return 'loading';
  if (waitingConfirmation) return 'confirming';
  return 'normal';
}, [isProcessing, waitingConfirmation, /* other dependencies */]);
```

### 2. CSS Class Structure

Follow the established naming convention:

```typescript
// Base class with state modifier
const buttonClassName = `liquid-glass-${componentType} state-${componentState}`;

// With additional modifiers
const fullClassName = `
  liquid-glass-${componentType}
  state-${componentState}
  ${isCompact ? "liquid-glass-compact" : ""}
  ${isExpanded ? "expanded" : ""}
`.trim();
```

### 3. Event Handling Pattern

Implement the two-tap confirmation pattern:

```typescript
const handlePrimaryAction = useCallback(async () => {
  // First tap - enter confirmation mode
  if (componentState === "normal") {
    setWaitingConfirmation(true);

    // Auto-reset confirmation after timeout
    setTimeout(() => {
      setWaitingConfirmation(false);
    }, 3000); // 3 second timeout
    return;
  }

  // Second tap - execute action
  if (componentState === "confirming") {
    setWaitingConfirmation(false);
    setIsProcessing(true);

    try {
      await performAction();
    } catch (error) {
      console.error("Action failed:", error);
      // Handle error state
    } finally {
      setIsProcessing(false);
    }
  }
}, [componentState, performAction]);
```

## CSS Implementation Patterns

### 1. Component Base Styles

Start with the established foundation:

```css
.liquid-glass-your-component {
  /* Inherit base liquid glass properties */
  @extend .liquid-glass-base; /* If using a preprocessor */

  /* Or manually include base properties */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0 16px;
  height: var(--glass-control-height);
  border-radius: var(--glass-control-border-radius);

  /* Glass effect */
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);

  /* Performance */
  transform: translateZ(0);
  will-change: transform, background-color;
  transition: all 300ms var(--glass-spring-timing);

  /* Component-specific properties */
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}
```

### 2. State Styling Implementation

Apply consistent state patterns:

```css
/* Normal State */
.liquid-glass-your-component.state-normal {
  color: var(--glass-primary);
  border: 1px solid var(--glass-primary-alpha);
  background: rgba(139, 92, 246, 0.05);
  box-shadow:
    var(--glass-shadow-base) rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Hover enhancement (desktop only) */
@media (min-width: 768px) {
  .liquid-glass-your-component.state-normal:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.15);
    transform: translateY(-1px);
    box-shadow: var(--glass-shadow-hover) rgba(139, 92, 246, 0.15);
  }
}

/* Confirming State */
.liquid-glass-your-component.state-confirming {
  background: var(--glass-confirm-alpha) !important;
  color: var(--glass-confirm) !important;
  border: 1px solid rgba(255, 182, 193, 0.5) !important;
  animation: liquid-glass-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Loading State */
.liquid-glass-your-component.state-loading {
  color: var(--glass-primary);
  border: 1px solid rgba(139, 92, 246, 0.3);
  background: rgba(139, 92, 246, 0.1);
}

/* Disabled State */
.liquid-glass-your-component.state-disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(100%) contrast(1.3);
}
```

### 3. Responsive Behavior

Implement consistent responsive patterns:

```css
/* Desktop sizing */
@media (min-width: 768px) {
  .liquid-glass-your-component {
    min-width: 140px;
  }

  .liquid-glass-your-component.state-confirming {
    min-width: 160px; /* Slightly wider in confirmation */
  }
}

/* Mobile expansion */
@media (max-width: 767px) {
  .liquid-glass-your-component.state-confirming {
    flex: 1;
    min-width: 180px;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .liquid-glass-your-component:hover {
    background: transparent !important;
    transform: none !important;
  }
}
```

## Performance Optimization Patterns

### 1. Animation Performance

Ensure 60fps performance:

```css
/* GPU acceleration */
.liquid-glass-your-component {
  transform: translateZ(0);
  will-change: transform, background-color;
}

/* Optimize animation properties */
.liquid-glass-your-component {
  transition:
    transform 300ms var(--glass-spring-timing),
    background-color 300ms var(--glass-spring-timing),
    border-color 300ms var(--glass-spring-timing);
}

/* Touch feedback */
.liquid-glass-your-component:active:not(:disabled) {
  transform: scale(0.98);
  transition: transform 150ms ease-out;
}
```

### 2. Memory Management

```typescript
// Cleanup timeout references
useEffect(() => {
  return () => {
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
    }
  };
}, []);

// Debounce expensive operations
const debouncedAction = useMemo(
  () => debounce(performAction, 300),
  [performAction]
);
```

### 3. Render Optimization

```typescript
// Memoize expensive calculations
const buttonClassName = useMemo(() => {
  return `liquid-glass-${componentType} state-${componentState}`;
}, [componentType, componentState]);

// Prevent unnecessary re-renders
const MemoizedComponent = memo(YourComponent, (prevProps, nextProps) => {
  return (
    prevProps.state === nextProps.state &&
    prevProps.disabled === nextProps.disabled
  );
});
```

## Integration Patterns

### 1. Store Integration

Follow the established store pattern:

```typescript
// Store method example
const performOptimisticAction = async () => {
  try {
    // Step 1: Immediate optimistic updates
    updateLocalState();

    // Step 2: localStorage for instant UI feedback
    await localStorageStateManager.updateState(changes);

    // Step 3: Database operation (batched)
    await databaseOperation();

    // Step 4: Sync queue for cross-device consistency
    await addToSyncQueue(operation);
  } catch (error) {
    // Rollback optimistic changes
    rollbackLocalState();
    throw error;
  }
};
```

### 2. Component Coordination

Implement coordinated animations:

```typescript
// Parent component coordination
const [isExpanded, setIsExpanded] = useState(false);

useEffect(() => {
  if (componentState === "confirming") {
    setIsExpanded(true);
    // Collapse related components
    setSegmentedControlVisible(false);
  } else {
    setIsExpanded(false);
    setSegmentedControlVisible(true);
  }
}, [componentState]);
```

### 3. Context-Aware Behavior

```typescript
// Adapt to context
const isInHeader = useContext(HeaderContext);
const isMobile = useMediaQuery("(max-width: 767px)");

const componentVariant = useMemo(() => {
  if (isInHeader && isMobile) return "header-mobile";
  if (isInHeader) return "header-desktop";
  return "standalone";
}, [isInHeader, isMobile]);
```

## Error Handling Patterns

### 1. Graceful Degradation

```typescript
const handleActionWithFallback = async () => {
  try {
    await primaryAction();
  } catch (primaryError) {
    console.warn("Primary action failed, trying fallback:", primaryError);

    try {
      await fallbackAction();
    } catch (fallbackError) {
      console.error("Both primary and fallback failed:", fallbackError);

      // Emergency recovery
      await emergencyRecovery();
      throw new Error("Action failed with fallback");
    }
  }
};
```

### 2. State Recovery

```typescript
const recoverFromError = useCallback(async () => {
  // Reset component state
  setIsProcessing(false);
  setWaitingConfirmation(false);

  // Clear any pending timeouts
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  // Trigger external recovery if needed
  if (onError) {
    onError();
  }
}, [onError]);
```

### 3. User Feedback

```typescript
const showErrorFeedback = useCallback((error: Error) => {
  // Visual feedback
  setComponentState("error");

  // User notification
  toast.error("Action failed. Please try again.");

  // Analytics (if applicable)
  analytics.track("component_error", {
    component: "liquid-glass-your-component",
    error: error.message,
  });
}, []);
```

## Testing Patterns

### 1. Unit Testing

```typescript
// Component state testing
describe('LiquidGlassComponent', () => {
  it('should transition through states correctly', async () => {
    const { getByRole } = render(<LiquidGlassComponent />);
    const button = getByRole('button');

    // Initial state
    expect(button).toHaveClass('state-normal');

    // First click - confirmation
    fireEvent.click(button);
    expect(button).toHaveClass('state-confirming');

    // Second click - loading
    fireEvent.click(button);
    expect(button).toHaveClass('state-loading');

    // Wait for completion
    await waitFor(() => {
      expect(button).toHaveClass('state-normal');
    });
  });
});
```

### 2. Performance Testing

```typescript
// Animation performance testing
describe('Animation Performance', () => {
  it('should maintain 60fps during state transitions', async () => {
    const performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        expect(entry.duration).toBeLessThan(16.67); // 60fps = 16.67ms per frame
      });
    });

    performanceObserver.observe({ entryTypes: ['measure'] });

    // Trigger animation
    const { getByRole } = render(<LiquidGlassComponent />);
    fireEvent.click(getByRole('button'));

    // Wait for animation completion
    await new Promise(resolve => setTimeout(resolve, 400));
  });
});
```

### 3. Accessibility Testing

```typescript
// Accessibility validation
describe('Accessibility', () => {
  it('should provide proper ARIA labels and roles', () => {
    const { getByRole } = render(
      <LiquidGlassComponent ariaLabel="Delete all items" />
    );

    const button = getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Delete all items');
  });

  it('should handle keyboard navigation', () => {
    const { getByRole } = render(<LiquidGlassComponent />);
    const button = getByRole('button');

    // Focus
    button.focus();
    expect(button).toHaveFocus();

    // Enter key activation
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toHaveClass('state-confirming');
  });
});
```

## Common Pitfalls and Solutions

### 1. Animation Performance Issues

**Problem**: Choppy animations or low frame rates

**Solution**:

```css
/* Use transform and opacity only for animations */
.liquid-glass-component {
  /* ❌ Avoid animating these properties */
  /* width, height, top, left, margin, padding */

  /* ✅ Use these for smooth animations */
  transform: translateY(-1px) scale(1.02);
  opacity: 0.95;
}
```

### 2. State Management Complexity

**Problem**: Complex state transitions causing bugs

**Solution**:

```typescript
// Use explicit state machine with validation
const validateStateTransition = (
  from: ComponentState,
  to: ComponentState
): boolean => {
  const validTransitions: Record<ComponentState, ComponentState[]> = {
    normal: ["confirming", "disabled"],
    confirming: ["loading", "normal"],
    loading: ["normal", "disabled"],
    disabled: ["normal"],
  };

  return validTransitions[from]?.includes(to) ?? false;
};
```

### 3. Memory Leaks

**Problem**: Timeout references not cleaned up

**Solution**:

```typescript
// Always clean up timeouts and intervals
useEffect(() => {
  const timeoutId = setTimeout(() => {
    setWaitingConfirmation(false);
  }, 3000);

  return () => {
    clearTimeout(timeoutId);
  };
}, []);
```

### 4. CSS Specificity Issues

**Problem**: State styles not applying correctly

**Solution**:

```css
/* Use sufficient specificity without !important */
.liquid-glass-component.state-confirming {
  /* Specific enough to override base styles */
}

/* Or use CSS layers for better control */
@layer base, components, utilities;

@layer components {
  .liquid-glass-component.state-confirming {
    background: var(--glass-confirm-alpha);
  }
}
```

## Advanced Patterns

### 1. Dynamic Content Adaptation

```typescript
// Adapt to content changes
const useContentAwareButton = (content: string) => {
  const [buttonWidth, setButtonWidth] = useState<number>();

  useEffect(() => {
    // Measure content and adjust button width
    const measureElement = document.createElement("span");
    measureElement.textContent = content;
    measureElement.style.visibility = "hidden";
    measureElement.style.position = "absolute";

    document.body.appendChild(measureElement);
    const width = measureElement.offsetWidth;
    document.body.removeChild(measureElement);

    setButtonWidth(Math.max(140, width + 32)); // 32px for padding
  }, [content]);

  return buttonWidth;
};
```

### 2. Context-Sensitive Behavior

```typescript
// Adapt behavior based on surrounding components
const useLiquidGlassContext = () => {
  const context = useContext(LiquidGlassContext);

  return {
    ...context,
    registerComponent: (id: string, priority: number) => {
      context.components.set(id, priority);
    },
    unregisterComponent: (id: string) => {
      context.components.delete(id);
    },
  };
};
```

### 3. Performance Monitoring

```typescript
// Monitor component performance
const usePerformanceMonitoring = (componentName: string) => {
  const measureRef = useRef<string>();

  const startMeasure = useCallback(
    (operation: string) => {
      measureRef.current = `${componentName}-${operation}`;
      performance.mark(`${measureRef.current}-start`);
    },
    [componentName]
  );

  const endMeasure = useCallback(() => {
    if (measureRef.current) {
      performance.mark(`${measureRef.current}-end`);
      performance.measure(
        measureRef.current,
        `${measureRef.current}-start`,
        `${measureRef.current}-end`
      );
    }
  }, []);

  return { startMeasure, endMeasure };
};
```

## Checklist for New Components

### Planning Phase

- [ ] Define component states and transitions
- [ ] Identify performance requirements (<60fps)
- [ ] Plan responsive behavior patterns
- [ ] Consider accessibility requirements
- [ ] Design error handling strategy

### Implementation Phase

- [ ] Implement state machine pattern
- [ ] Apply CSS architecture consistently
- [ ] Add responsive design patterns
- [ ] Implement performance optimizations
- [ ] Add comprehensive error handling

### Testing Phase

- [ ] Unit tests for state transitions
- [ ] Performance tests for animations
- [ ] Accessibility compliance testing
- [ ] Cross-browser compatibility
- [ ] Mobile device testing

### Documentation Phase

- [ ] Component API documentation
- [ ] Usage examples and patterns
- [ ] Performance characteristics
- [ ] Known limitations or issues
- [ ] Integration guidelines

## Resources and References

### CSS Architecture

- [Liquid Glass Design System](../ui-ux/liquid-glass-design-system.md)
- [CSS Custom Properties Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [CSS Performance Best Practices](https://web.dev/css-performance/)

### React Patterns

- [React Hooks Documentation](https://reactjs.org/docs/hooks-intro.html)
- [State Management Patterns](https://kentcdodds.com/blog/application-state-management-with-react)
- [Performance Optimization](https://reactjs.org/docs/optimizing-performance.html)

### Testing

- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [Accessibility Testing Guide](https://web.dev/accessibility-testing/)
- [Performance Testing Tools](https://web.dev/performance-testing/)

## Related Documentation

- [RR-179 Implementation Details](../tech/rr-179-implementation.md)
- [Liquid Glass Design System](../ui-ux/liquid-glass-design-system.md)
- [Performance Optimization Guide](../tech/performance-optimization.md)
- [Component Testing Strategy](../testing/component-testing.md)
