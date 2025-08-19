# ScrollHideFloatingElement Component Documentation

## Overview

The `ScrollHideFloatingElement` is a reusable React component that provides standardized scroll-responsive behavior for floating UI elements. It implements iOS-inspired hide/show animations based on scroll direction and position, creating a smooth and intuitive user experience across the application.

## Key Features

- **Unified Scroll Behavior**: Standardized scroll-responsive animations across all floating elements
- **PWA Safe Area Support**: Automatic positioning adjustments for iOS devices with safe areas
- **Performance Optimized**: Uses passive scroll listeners and GPU acceleration for 60fps animations
- **Flexible Positioning**: Support for all four corner positions with custom offset options
- **External Visibility Control**: Programmatic show/hide control for complex UI states
- **TypeScript Support**: Full type safety with comprehensive interface definitions

## Component API

### Props Interface

```typescript
interface ScrollHideFloatingElementProps {
  children: React.ReactNode;                    // Content to display in floating element
  className?: string;                           // Additional CSS classes
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  offset?: {                                    // Custom positioning offsets
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  scrollContainer?: React.RefObject<HTMLElement>; // Custom scroll container reference
  hideThreshold?: number;                       // Pixels scrolled before hiding (default: 50)
  showOnScrollUp?: boolean;                     // Show immediately when scrolling up (default: true)
  animationDuration?: number;                   // Animation duration in ms (default: 300)
  visible?: boolean;                            // External visibility control (default: true)
}
```

### Default Values

- `position`: `"top-right"`
- `hideThreshold`: `50` pixels
- `showOnScrollUp`: `true`
- `animationDuration`: `300` milliseconds
- `visible`: `true`

## Usage Patterns

### Basic Usage

```typescript
import { ScrollHideFloatingElement } from "@/components/ui/scroll-hide-floating-element";

function MyComponent() {
  return (
    <ScrollHideFloatingElement position="top-right">
      <button className="floating-button">
        Action Button
      </button>
    </ScrollHideFloatingElement>
  );
}
```

### Custom Positioning

```typescript
<ScrollHideFloatingElement 
  position="bottom-left"
  offset={{
    bottom: "24px",
    left: "20px"
  }}
>
  <FloatingActionButton />
</ScrollHideFloatingElement>
```

### External Visibility Control

```typescript
function ComponentWithConditionalFloating() {
  const [showFloating, setShowFloating] = useState(true);
  
  return (
    <ScrollHideFloatingElement 
      visible={showFloating && !sidebarOpen}
      position="top-left"
    >
      <NavigationButton />
    </ScrollHideFloatingElement>
  );
}
```

### Custom Scroll Container

```typescript
function ScrollableArea() {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  return (
    <div>
      <div ref={scrollRef} className="overflow-y-auto h-96">
        {/* Scrollable content */}
      </div>
      
      <ScrollHideFloatingElement 
        scrollContainer={scrollRef}
        position="bottom-right"
      >
        <ScrollToTopButton />
      </ScrollHideFloatingElement>
    </div>
  );
}
```

## Implementation Details

### Scroll Detection Algorithm

The component implements a sophisticated scroll detection system:

1. **Threshold-Based Hiding**: Elements hide after scrolling `hideThreshold` pixels downward
2. **Fixed Distance Transform**: Uses fixed 64px translation distance to prevent over-translation issues
3. **Directional Logic**: Proper directional translation based on element position (top/bottom)
4. **Opacity Transitions**: Smooth fade-in/fade-out effects during hide/show transitions
5. **Direction Detection**: Distinguishes between scroll up and scroll down for appropriate responses

#### Fixed Translation Distance (Critical Fix - August 19, 2025)

Previous implementation used unbounded scroll-based translation causing buttons to drift off-screen:

```typescript
// OLD: Over-translation causing off-screen drift
const translateY = -currentScrollY; // Could be -1000px+

// NEW: Fixed distance with proper directional logic  
const hideDistance = 64;
const translateDirection = position.startsWith("top") ? -1 : 1;
const translateY = shouldHide ? hideDistance * translateDirection : 0;
```

This prevents fixed-position elements from experiencing double-translation (scroll + transform).

### Animation System

- **GPU Acceleration**: Uses `transform: translateZ(0)` and `willChange` for optimal performance
- **Spring Physics**: CSS transitions with `cubic-bezier(0.32, 0.72, 0, 1)` timing for iOS-like feel
- **Synchronized Movement**: Floating elements move at the same velocity as page content during scroll

### PWA Safe Area Integration

The component automatically handles PWA safe areas:

```typescript
// PWA safe area classes
const pwaClasses = {
  "top-left": "pwa-standalone:top-[calc(8px+env(safe-area-inset-top))] pwa-standalone:left-[calc(16px+env(safe-area-inset-left))]",
  "top-right": "pwa-standalone:top-[calc(8px+env(safe-area-inset-top))] pwa-standalone:right-[calc(16px+env(safe-area-inset-right))]",
  "bottom-left": "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))] pwa-standalone:left-[calc(16px+env(safe-area-inset-left))]",
  "bottom-right": "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))] pwa-standalone:right-[calc(16px+env(safe-area-inset-right))]",
};
```

## Current Usage in Application

### 1. Floating Navigation Button (Main Page)

```typescript
// src/app/page.tsx
<ScrollHideFloatingElement 
  position="top-left" 
  visible={isMobile && !sidebarOpen}
>
  <MorphingNavButton 
    onClick={() => setSidebarOpen(true)}
    ariaLabel="Open sidebar"
  />
</ScrollHideFloatingElement>
```

### 2. Floating Filter Controls (Article Listing)

```typescript
// Used for floating ReadStatusFilter and Mark All Read buttons
<ScrollHideFloatingElement 
  position="top-right"
  visible={!sidebarOpen}
>
  <div className="floating-controls-group">
    <ReadStatusFilter />
    <MarkAllReadButton />
  </div>
</ScrollHideFloatingElement>
```

## Performance Considerations

### Optimization Features

1. **Passive Scroll Listeners**: Uses `{ passive: true }` for better scroll performance
2. **Cleanup Management**: Proper event listener removal and timeout cleanup
3. **RAF Throttling**: Smooth animations without blocking the main thread
4. **Memory Management**: Efficient ref management and effect cleanup

### Performance Metrics

- **Animation Target**: 60fps smooth scrolling
- **Memory Usage**: Minimal overhead with proper cleanup
- **Battery Impact**: Optimized for mobile devices with passive listeners

## Browser Compatibility

- **Modern Browsers**: Full support for all features
- **iOS Safari**: Optimized for PWA safe areas and touch interactions
- **Legacy Support**: Graceful degradation for older browsers
- **Accessibility**: Full keyboard navigation and screen reader support

## Testing

The component is covered by comprehensive tests:

- **Unit Tests**: Component behavior and prop handling
- **Integration Tests**: Scroll coordination and performance
- **E2E Tests**: Real-world mobile scroll behavior validation
- **Performance Tests**: 60fps validation and memory leak detection

## Migration Guide

### Replacing Fixed Elements

Before (fixed positioning):
```typescript
<div className="fixed top-4 right-4 z-50">
  <ActionButton />
</div>
```

After (scroll-responsive floating):
```typescript
<ScrollHideFloatingElement position="top-right">
  <ActionButton />
</ScrollHideFloatingElement>
```

### Benefits of Migration

1. **Better UX**: Automatic hiding during scroll improves content visibility
2. **PWA Support**: Automatic safe area handling for iOS devices
3. **Performance**: Optimized scroll handling with passive listeners
4. **Consistency**: Standardized behavior across all floating elements

## Future Enhancements

- **Gesture Support**: Swipe-to-dismiss functionality
- **Animation Presets**: Additional animation styles (slide, scale, etc.)
- **Accessibility**: Enhanced screen reader announcements
- **Performance**: WebAssembly scroll detection for maximum performance