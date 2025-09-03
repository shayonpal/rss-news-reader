# PWA Safe Area Integration

## Overview

The PWA Safe Area Integration system ensures consistent spacing and positioning across all iOS devices and orientations. This system automatically handles device-specific safe areas including notches, home indicators, and dynamic islands while maintaining optimal touch target accessibility.

## Safe Area Concepts

### iOS Safe Areas

Safe areas represent the portions of the screen that are not covered by system UI elements:

- **Top Safe Area**: Status bar, notch, or Dynamic Island
- **Bottom Safe Area**: Home indicator and gesture areas
- **Side Safe Areas**: Rounded corners and sensor housing
- **Landscape Variations**: Orientation-specific adjustments

### Device Coverage

- **iPhone 14 Pro/Pro Max**: Dynamic Island integration
- **iPhone 14/Plus**: Notch handling with standard safe areas
- **iPhone 13 Series**: Standard notch with optimized spacing
- **iPhone 12 Series**: Legacy notch support
- **iPhone SE Series**: Traditional status bar handling
- **iPad Series**: Minimal safe areas with rounded corner adjustments

## Implementation System

### CSS Environment Variables

The system uses CSS environment variables for dynamic safe area detection:

```css
/* Core safe area variables */
env(safe-area-inset-top)     /* Top safe area (notch, status bar) */
env(safe-area-inset-right)   /* Right safe area (landscape rotation) */
env(safe-area-inset-bottom)  /* Bottom safe area (home indicator) */
env(safe-area-inset-left)    /* Left safe area (landscape rotation) */
```

### Tailwind CSS Integration

Custom Tailwind utilities for PWA-specific spacing:

```css
/* PWA-aware positioning utilities */
.pwa-standalone\:top-\[calc\(8px\+env\(safe-area-inset-top\)\)\] {
  top: calc(8px + env(safe-area-inset-top));
}

.pwa-standalone\:bottom-\[calc\(16px\+env\(safe-area-inset-bottom\)\)\] {
  bottom: calc(16px + env(safe-area-inset-bottom));
}

.pwa-standalone\:left-\[calc\(16px\+env\(safe-area-inset-left\)\)\] {
  left: calc(16px + env(safe-area-inset-left));
}

.pwa-standalone\:right-\[calc\(16px\+env\(safe-area-inset-right\)\)\] {
  right: calc(16px + env(safe-area-inset-right));
}
```

### Position System Implementation

The `ScrollHideFloatingElement` component implements comprehensive safe area support:

```typescript
// PWA safe area classes mapping
const pwaClasses = {
  "top-left":
    "pwa-standalone:top-[calc(8px+env(safe-area-inset-top))] pwa-standalone:left-[calc(16px+env(safe-area-inset-left))]",
  "top-right":
    "pwa-standalone:top-[calc(8px+env(safe-area-inset-top))] pwa-standalone:right-[calc(16px+env(safe-area-inset-right))]",
  "bottom-left":
    "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))] pwa-standalone:left-[calc(16px+env(safe-area-inset-left))]",
  "bottom-right":
    "pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))] pwa-standalone:right-[calc(16px+env(safe-area-inset-right))]",
};
```

## Spacing Guidelines

### Base Spacing Values

- **Top Elements**: 8px base + safe area (minimal intrusion)
- **Bottom Elements**: 16px base + safe area (comfortable thumb reach)
- **Side Elements**: 16px base + safe area (consistent with bottom)

### Device-Specific Calculations

#### iPhone 14 Pro (Dynamic Island)

```css
/* Typical values */
env(safe-area-inset-top): 59px; /* Dynamic Island + status bar */
env(safe-area-inset-bottom): 34px; /* Home indicator */
env(safe-area-inset-left): 0px; /* Portrait mode */
env(safe-area-inset-right): 0px; /* Portrait mode */
```

#### iPhone 14 (Standard Notch)

```css
/* Typical values */
env(safe-area-inset-top): 47px; /* Notch + status bar */
env(safe-area-inset-bottom): 34px; /* Home indicator */
env(safe-area-inset-left): 0px; /* Portrait mode */
env(safe-area-inset-right): 0px; /* Portrait mode */
```

#### iPhone SE (Traditional)

```css
/* Typical values */
env(safe-area-inset-top): 20px; /* Status bar only */
env(safe-area-inset-bottom): 0px; /* Home button device */
env(safe-area-inset-left): 0px; /* No rounded corners */
env(safe-area-inset-right): 0px; /* No rounded corners */
```

### Landscape Orientation

Landscape mode introduces side safe areas and modified top/bottom values:

```css
/* Landscape safe areas */
env(safe-area-inset-top): 0px; /* Minimal in landscape */
env(safe-area-inset-bottom): 21px; /* Reduced home indicator */
env(safe-area-inset-left): 47px; /* Notch on left side */
env(safe-area-inset-right): 47px; /* Camera housing on right */
```

## Implementation Examples

### Floating Navigation Button

```typescript
// Top-left positioned navigation with safe area support
<ScrollHideFloatingElement
  position="top-left"
  className="pwa-standalone:top-[calc(8px+env(safe-area-inset-top))] pwa-standalone:left-[calc(16px+env(safe-area-inset-left))]"
>
  <MorphingNavButton />
</ScrollHideFloatingElement>
```

**Resulting Positioning**:

- iPhone 14 Pro: `top: 67px; left: 16px;` (8px + 59px safe area)
- iPhone SE: `top: 28px; left: 16px;` (8px + 20px safe area)
- Landscape: `top: 8px; left: 63px;` (8px + 47px side safe area)

### Floating Action Controls

```typescript
// Bottom-right positioned controls with safe area support
<ScrollHideFloatingElement
  position="bottom-right"
  className="pwa-standalone:bottom-[calc(16px+env(safe-area-inset-bottom))] pwa-standalone:right-[calc(16px+env(safe-area-inset-right))]"
>
  <ActionButtonGroup />
</ScrollHideFloatingElement>
```

**Resulting Positioning**:

- iPhone 14 Pro: `bottom: 50px; right: 16px;` (16px + 34px safe area)
- iPhone SE: `bottom: 16px; right: 16px;` (16px + 0px safe area)
- Landscape: `bottom: 37px; right: 63px;` (16px + 21px + 47px safe areas)

## Touch Target Optimization

### Minimum Touch Targets

All floating elements maintain minimum 44px touch targets as per Apple's Human Interface Guidelines:

```css
.floating-touch-target {
  min-width: 44px;
  min-height: 44px;

  /* Ensure spacing for comfortable tapping */
  margin: 4px;
}
```

### Enhanced Touch Areas

For improved accessibility, invisible touch areas extend beyond visual boundaries:

```css
.enhanced-touch-area::before {
  content: "";
  position: absolute;
  top: -8px;
  right: -8px;
  bottom: -8px;
  left: -8px;
  z-index: -1;
}
```

## Responsive Behavior

### Orientation Changes

The system automatically adapts to orientation changes:

```css
/* Portrait orientation */
@media (orientation: portrait) {
  .floating-element {
    /* Standard portrait spacing */
  }
}

/* Landscape orientation */
@media (orientation: landscape) {
  .floating-element {
    /* Adjusted for side safe areas */
  }
}
```

### Device Size Adaptations

```css
/* iPhone/small screens */
@media (max-width: 428px) {
  .floating-controls {
    /* Compact spacing for small screens */
    gap: 8px;
  }
}

/* iPad/large screens */
@media (min-width: 768px) {
  .floating-controls {
    /* Expanded spacing for larger screens */
    gap: 16px;
  }
}
```

## Detection and Fallbacks

### PWA Context Detection

The system detects PWA standalone mode to apply safe area styles:

```css
/* Only apply safe area adjustments in standalone PWA mode */
@media (display-mode: standalone) {
  .pwa-safe-area {
    /* Safe area aware positioning */
  }
}
```

### JavaScript Detection

For dynamic adjustments, JavaScript can detect safe area values:

```typescript
function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement);

  return {
    top: parseInt(style.getPropertyValue("--safe-area-inset-top") || "0"),
    right: parseInt(style.getPropertyValue("--safe-area-inset-right") || "0"),
    bottom: parseInt(style.getPropertyValue("--safe-area-inset-bottom") || "0"),
    left: parseInt(style.getPropertyValue("--safe-area-inset-left") || "0"),
  };
}
```

### Fallback Support

For browsers without safe area support:

```css
/* Fallback for non-supporting browsers */
@supports not (top: env(safe-area-inset-top)) {
  .floating-element-top {
    top: 24px; /* Standard spacing fallback */
  }

  .floating-element-bottom {
    bottom: 24px; /* Standard spacing fallback */
  }
}
```

## Testing Strategy

### Device Testing Matrix

| Device          | Portrait Top | Portrait Bottom | Landscape Left | Landscape Right |
| --------------- | ------------ | --------------- | -------------- | --------------- |
| iPhone 14 Pro   | 67px         | 50px            | 55px           | 63px            |
| iPhone 14       | 55px         | 50px            | 55px           | 63px            |
| iPhone 13 Pro   | 55px         | 50px            | 55px           | 63px            |
| iPhone 12       | 55px         | 50px            | 55px           | 63px            |
| iPhone SE (3rd) | 28px         | 16px            | 16px           | 16px            |
| iPad Pro 11"    | 32px         | 24px            | 24px           | 24px            |

### Automated Testing

```typescript
// E2E test for safe area compliance
test("floating elements respect safe areas on all devices", async ({
  page,
}) => {
  // Test on iPhone 14 Pro
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    // Simulate Dynamic Island safe areas
    document.documentElement.style.setProperty("--safe-area-inset-top", "59px");
    document.documentElement.style.setProperty(
      "--safe-area-inset-bottom",
      "34px"
    );
  });

  const floatingButton = page.locator('[data-testid="floating-nav-button"]');
  const boundingBox = await floatingButton.boundingBox();

  // Verify minimum top spacing (8px base + 59px safe area)
  expect(boundingBox.y).toBeGreaterThanOrEqual(67);
});
```

## Performance Considerations

### CSS Optimization

Safe area calculations are optimized for performance:

```css
/* Use CSS custom properties for efficient updates */
:root {
  --computed-safe-top: calc(8px + env(safe-area-inset-top));
  --computed-safe-bottom: calc(16px + env(safe-area-inset-bottom));
}

.floating-element-top {
  top: var(--computed-safe-top);
}
```

### Animation Performance

Safe area aware animations maintain 60fps performance:

```css
.floating-element {
  /* Use transform instead of changing top/bottom for animations */
  transform: translateY(var(--scroll-offset));

  /* Avoid animating properties that trigger layout */
  transition: transform 300ms ease-out;
}
```

## Accessibility Integration

### Screen Reader Support

Safe area positioning maintains proper screen reader navigation:

```html
<!-- Proper landmark roles for floating navigation -->
<div role="banner" aria-label="Main navigation">
  <ScrollHideFloatingElement position="top-left">
    <button aria-label="Open main menu">☰</button>
  </ScrollHideFloatingElement>
</div>
```

### Keyboard Navigation

Floating elements maintain logical tab order regardless of positioning:

```css
.floating-element:focus-visible {
  /* Ensure focus outline is visible with safe area positioning */
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
  z-index: 9999;
}
```

## Integration with Existing Systems

### Liquid Glass Components

Safe area integration works seamlessly with liquid glass effects:

```css
.liquid-glass-floating {
  /* Safe area positioning */
  top: calc(8px + env(safe-area-inset-top));

  /* Glass effects */
  backdrop-filter: blur(8px) saturate(180%);
  background: rgba(255, 255, 255, 0.18);
}
```

### Scroll Coordinator

The ScrollCoordinator service accounts for safe areas in scroll calculations:

```typescript
// Adjust scroll thresholds based on safe area context
const adjustedThreshold = baseThreshold + safeAreaInsets.top;
```

## Future Enhancements

### Planned Improvements

1. **Dynamic Island Integration**: Content-aware spacing around Dynamic Island
2. **Gesture Area Detection**: Avoid conflict with system gesture areas
3. **Multi-Screen Support**: iPad external display safe area handling
4. **VR/AR Compatibility**: Future spatial computing safe area considerations

### Advanced Features

- **Smart Positioning**: AI-driven optimal placement based on content
- **Contextual Adjustments**: Safe area modifications based on app state
- **Performance Monitoring**: Real-time safe area calculation optimization

## Related Documentation

- [Floating Controls Architecture](../tech/floating-controls-architecture.md)
- [ScrollHideFloatingElement Component](../ui-ux/scroll-hide-floating-element.md)
- [iOS 26 Design System](../ui-ux/liquid-glass-design-system.md)
- [Accessibility Guidelines](../accessibility/floating-element-a11y.md)
