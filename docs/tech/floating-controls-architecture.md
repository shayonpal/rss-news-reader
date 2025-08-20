# Floating Controls Architecture (RR-215)

## Overview

The Floating Controls Architecture represents a fundamental shift from traditional fixed header patterns to iOS-inspired floating UI elements. This architecture provides enhanced mobile user experience by eliminating visual clutter while maintaining full functionality through intelligent scroll-responsive behavior.

## Architecture Philosophy

### Core Principles

1. **Content-First Design**: Maximize content visibility by removing persistent UI chrome
2. **Context-Aware Visibility**: Show controls when needed, hide when scrolling for focus
3. **Consistent Behavior**: Standardized scroll patterns across all floating elements
4. **Performance Optimized**: 60fps animations with minimal resource usage
5. **PWA Native Feel**: iOS-inspired interactions for web app experiences

### Design Goals

- **Eliminate Visual Clutter**: Remove fixed headers that compete with content
- **Improve Focus**: Hide UI during active reading/scrolling
- **Maintain Accessibility**: Preserve all functionality while enhancing UX
- **Mobile-First**: Optimize for touch interactions and limited screen space

## System Components

### 1. ScrollCoordinator Service

**Location**: `src/services/scroll-coordinator.ts`

Central service for managing scroll events and coordinating behavior across multiple floating components.

#### Key Features

- **Unified Scroll Management**: Single scroll listener to prevent performance issues
- **Component Registration**: Subscribe/unsubscribe pattern for floating elements
- **State Synchronization**: Consistent scroll state across all components
- **Performance Optimization**: Throttled updates with requestAnimationFrame

#### API Interface

```typescript
interface ScrollCoordinator {
  subscribe(id: string, callback: ScrollCallback): void;
  unsubscribe(id: string): void;
  updateScrollState(scrollY: number): void;
}

interface ScrollCallback {
  (position: {
    scrollY: number;
    scrollState: ScrollState;
    isScrollingUp: boolean;
    contentVisible?: boolean;
  }): void;
}

type ScrollState = 'expanded' | 'transitioning' | 'collapsed';
```

#### Implementation Pattern

```typescript
// Component registration
useEffect(() => {
  const coordinator = getScrollCoordinator();
  const id = componentId.current;
  coordinator.subscribe(id, updateState);

  return () => {
    coordinator.unsubscribe(id);
  };
}, [updateState]);
```

### 2. ScrollHideFloatingElement Component

**Location**: `src/components/ui/scroll-hide-floating-element.tsx`

Reusable wrapper component providing standardized scroll-responsive behavior for floating UI elements.

#### Architecture Features

- **Position System**: Four-corner positioning with PWA safe area support
- **Scroll Detection**: Progressive hiding based on scroll direction and distance
- **Animation System**: Smooth transforms with GPU acceleration
- **External Control**: Programmatic visibility control for complex UI states

#### Usage Patterns

```typescript
// Basic floating button
<ScrollHideFloatingElement position="top-right">
  <ActionButton />
</ScrollHideFloatingElement>

// Conditional visibility
<ScrollHideFloatingElement 
  visible={showControls && !sidebarOpen}
  position="top-left"
>
  <NavigationButton />
</ScrollHideFloatingElement>
```

### 3. iOS Header Scroll Hook

**Location**: `src/hooks/use-ios-header-scroll.ts`

Custom hook providing iOS-style header scroll behavior with dynamic calculations for height, blur, and animation states.

#### State Management

```typescript
interface IOSHeaderScrollState {
  scrollState: ScrollState;
  scrollY: number;
  isScrollingUp: boolean;
  titleScale: number;
  headerHeight: number;
  blurIntensity: number;
  contentVisible: boolean;
}
```

#### Dynamic Calculations

- **Title Scale**: `Math.max(0.5, 1 - scrollY / 300)`
- **Header Height**: `Math.max(54, 120 - scrollY * 0.4)`
- **Blur Intensity**: `Math.min(16, 8 + scrollY / 20)`

### 4. Morphing Navigation Button

**Location**: `src/components/ui/morphing-nav-button.tsx`

Intelligent navigation button that morphs between hamburger and back button based on scroll state and context.

#### Morphing Logic

- **Expanded State**: Hamburger icon (☰) for menu access
- **Collapsed State**: Back arrow (←) for navigation
- **Smooth Transitions**: iOS-style morphing animations with spring physics

## Implementation Strategy

### Migration from Fixed Headers

#### Before (Fixed Header Pattern)

```typescript
// Traditional fixed header
<header className="fixed top-0 left-0 right-0 z-40 bg-white border-b">
  <div className="flex items-center justify-between p-4">
    <button onClick={toggleMenu}>☰</button>
    <h1>App Title</h1>
    <div className="controls">
      <FilterButton />
      <ActionButton />
    </div>
  </div>
</header>

<main className="pt-16"> {/* Header height offset */}
  <Content />
</main>
```

#### After (Floating Controls Pattern)

```typescript
// Floating controls architecture
<main className="min-h-screen">
  <Content />
</main>

{/* Floating navigation */}
<ScrollHideFloatingElement 
  position="top-left" 
  visible={isMobile && !sidebarOpen}
>
  <MorphingNavButton onClick={toggleMenu} />
</ScrollHideFloatingElement>

{/* Floating controls */}
<ScrollHideFloatingElement 
  position="top-right"
  visible={!sidebarOpen}
>
  <div className="flex gap-2">
    <FilterButton />
    <ActionButton />
  </div>
</ScrollHideFloatingElement>
```

### Benefits of Migration

1. **Increased Content Area**: No header space reservation needed
2. **Enhanced Focus**: Controls hide during active scrolling
3. **Better Mobile UX**: More screen real estate for content
4. **Consistent Behavior**: Standardized patterns across all pages
5. **Performance**: Single scroll listener vs multiple fixed elements

## Scroll Behavior Patterns

### Three-State System

#### 1. Expanded State (scrollY < 50px)

- **Navigation**: Full hamburger button visibility
- **Header**: Complete header with all content sections visible
- **Controls**: All floating elements in default positions
- **Animations**: Spring entry animations for smooth appearance

#### 2. Transitioning State (50px < scrollY < 150px)

- **Navigation**: Begin morphing hamburger → back button
- **Header**: Progressive height reduction and content sliding
- **Controls**: Gradual opacity reduction and upward movement
- **Animations**: Synchronized transforms across all elements

#### 3. Collapsed State (scrollY > 150px)

- **Navigation**: Compact back button for quick exit
- **Header**: Minimal height with hidden content section
- **Controls**: Hidden or minimally visible for focus
- **Animations**: Complete state transition with GPU optimization

### Scroll Direction Detection

```typescript
const handleScroll = useCallback(() => {
  const currentScrollY = window.scrollY;
  const scrollDelta = currentScrollY - lastScrollY;
  const isScrollingUp = scrollDelta < 0 && currentScrollY > 10;
  
  // Update visibility based on direction
  setElementVisible(isScrollingUp || currentScrollY < hideThreshold);
  
  setLastScrollY(currentScrollY);
}, [lastScrollY, hideThreshold]);
```

## Performance Optimizations

### Scroll Performance

- **Passive Listeners**: `{ passive: true }` for non-blocking scroll
- **RequestAnimationFrame**: Throttled updates for 60fps performance
- **GPU Acceleration**: `transform: translateZ(0)` and `will-change` properties
- **Single Coordinator**: One scroll listener managing all floating elements

### Memory Management

- **Component Cleanup**: Proper event listener removal on unmount
- **Ref Management**: Efficient reference handling with useRef
- **Timeout Cleanup**: Clear all timeouts to prevent memory leaks

### Animation Performance

```css
.floating-element {
  /* GPU acceleration */
  transform: translateZ(0);
  will-change: transform, opacity;
  
  /* Optimized transitions */
  transition: all 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
```

## PWA Integration

### Safe Area Support

Automatic adjustment for iOS device safe areas across all positions:

```typescript
const pwaClasses = {
  "top-left": "pwa-standalone:top-[calc(8px+env(safe-area-inset-top))]",
  "top-right": "pwa-standalone:top-[calc(8px+env(safe-area-inset-top))]",
  "bottom-left": "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))]",
  "bottom-right": "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))]",
};
```

### Device-Specific Optimizations

- **iPhone Notch**: Dynamic spacing for notched devices
- **iPad**: Responsive positioning for larger screens
- **Android**: Standard positioning with fallback support
- **Desktop**: Enhanced hover states and larger touch targets

## Testing Strategy

### Component Testing

- **Unit Tests**: Individual floating element behavior
- **Integration Tests**: ScrollCoordinator coordination between components
- **Performance Tests**: 60fps validation and memory leak detection

### E2E Testing

- **Scroll Behavior**: Cross-browser scroll state validation
- **Touch Interactions**: Mobile device touch target compliance
- **Accessibility**: Screen reader and keyboard navigation testing

### Test Coverage

Current test suite includes 129 test cases across:

- `rr-215-ios-scrollable-header.test.tsx` - Component unit tests
- `rr-215-scroll-coordination.test.ts` - Integration tests
- `rr-215-mobile-scroll-behavior.test.ts` - E2E mobile tests
- `rr-215-scroll-performance.test.ts` - Performance benchmarks

## Accessibility Considerations

### WCAG Compliance

- **Touch Targets**: Minimum 44px touch targets for all floating elements
- **Focus Management**: Proper focus indication with visible outlines
- **Screen Readers**: ARIA labels and landmark roles for navigation
- **Keyboard Navigation**: Full keyboard accessibility for all interactions

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  .floating-element {
    transition: none;
    animation: none;
  }
}
```

## Browser Compatibility

### Full Support

- **Chrome 76+**: Complete backdrop-filter and CSS custom properties
- **Safari 14+**: Native iOS behavior with enhanced performance
- **Firefox 103+**: Full feature compatibility with latest standards
- **Edge 79+**: Complete Chromium-based support

### Fallback Support

- **Older Browsers**: Solid background fallbacks for backdrop-filter
- **iOS Safari 10+**: Basic floating behavior without advanced effects
- **Android Chrome 80+**: Progressive enhancement with core functionality

## Recent Fixes and Improvements

### Critical Architecture Fixes (August 19, 2025)

#### ScrollHideFloatingElement Over-Translation Issue
- **Problem**: Fixed-position floating elements experiencing double-translation during scroll, causing buttons to drift off-screen beyond viewport boundaries (-1000px+)
- **Root Cause**: `translateY(-currentScrollY)` applying unbounded scroll-based translation to already positioned fixed elements
- **Solution**: Implemented fixed 64px translation distance with directional logic
- **Technical Implementation**: 
  ```typescript
  const hideDistance = 64;
  const translateDirection = position.startsWith("top") ? -1 : 1;
  const translateY = shouldHide ? hideDistance * translateDirection : 0;
  ```

#### Glass Button Styling Normalization
- **Problem**: Thick black borders appearing on glass buttons instead of subtle liquid glass styling
- **Root Cause**: User Agent default button styling overriding CSS glass variables, missing light mode variables
- **Solution**: Added comprehensive appearance normalization and CSS variable definitions
- **CSS Enhancement**: 
  ```css
  .glass-icon-btn,
  .glass-toolbar-btn,
  .liquid-glass-btn,
  .liquid-glass-mark-all-read {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }
  ```

#### Content-Aware Positioning Architecture
- **Problem**: Floating controls overlapping article content with inconsistent positioning systems
- **Root Cause**: Different baseline spacing (8px vs 24px) without content-type awareness
- **Solution**: Unified positioning system with content-type-aware spacing logic
- **Implementation**: Article listing centers content with buttons, article detail provides dedicated breathing room

#### Architecture Unification Benefits
- **Single Source of Truth**: All floating element positioning centralized in ScrollHideFloatingElement
- **Maintainable Patterns**: Consistent behavior patterns extensible to future floating elements
- **Performance Optimized**: Fixed translation distance with proper GPU acceleration
- **PWA Integration**: Comprehensive safe area support across all device types

## Future Enhancements

### Planned Features

1. **Gesture Support**: Swipe-to-dismiss for floating elements
2. **Context Awareness**: Auto-hide based on content type
3. **Advanced Animations**: Particle effects and micro-interactions
4. **Customization**: User-configurable floating element preferences

### Integration Opportunities

- **Modal Systems**: Floating controls within overlay contexts
- **Form Interfaces**: Sticky action buttons for long forms
- **Media Players**: Floating playback controls
- **Search Interfaces**: Floating search and filter controls

## Migration Guide

### Step-by-Step Migration

1. **Remove Fixed Headers**: Eliminate `fixed` positioning from header components
2. **Implement ScrollCoordinator**: Add scroll coordination service
3. **Wrap with ScrollHideFloatingElement**: Convert static elements to floating
4. **Add PWA Classes**: Ensure safe area compatibility
5. **Test Performance**: Validate 60fps scroll performance
6. **Accessibility Review**: Confirm WCAG compliance

### Common Pitfalls

- **Multiple Scroll Listeners**: Use ScrollCoordinator to avoid performance issues
- **Z-Index Conflicts**: Establish clear z-index hierarchy for floating elements
- **Safe Area Neglect**: Always account for iOS safe areas in positioning
- **Animation Jank**: Use transform and opacity for smooth 60fps animations

## Related Documentation

- [ScrollHideFloatingElement Component Guide](../ui-ux/scroll-hide-floating-element.md)
- [Liquid Glass Design System](../ui-ux/liquid-glass-design-system.md)
- [PWA Safe Area Integration](../ui-ux/pwa-safe-areas.md)
- [Performance Optimization Guidelines](../tech/performance-optimization.md)