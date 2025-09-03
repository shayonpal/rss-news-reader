# ADR-006: Adopt Liquid Glass Visual Design System

- **Status:** Accepted
- **Date:** 2025-01-20

## Context

The application's visual design was functional but lacked a cohesive and modern aesthetic. To align with the goal of creating a PWA that feels like a native iOS app, a more sophisticated design system was needed. The upcoming iOS 26 "Liquid Glass" design language provided a clear direction for this modernization.

## Decision

We will adopt the principles of the iOS 26 "Liquid Glass" design system. This involves:

1.  **Material & Effects:** Using translucent, blurred backgrounds (`backdrop-filter`) for navigation elements and overlays.
2.  **Adaptive Theming:** The glass effect will be adaptive, with a heavier, more opaque blur in light mode and a lighter, more transparent effect in dark mode.
3.  **Shape System:** Buttons and containers will adopt the new iOS shape system (Capsule, Fixed, Concentric radii).
4.  **Animation:** Interactions will be enhanced with fluid, spring-based animations.

## Consequences

**Positive:**

- The application's UI will feel modern and native on iOS devices.
- Creates a strong, consistent, and visually appealing design language for the entire application.
- The use of translucency provides a better sense of depth and context.

**Negative:**

- `backdrop-filter` can be performance-intensive and may not be supported on all browsers (especially older Android WebViews), requiring solid color fallbacks.
- Requires careful attention to accessibility, as text contrast over a blurred background can be challenging to maintain. Fallbacks for "Reduce Transparency" accessibility settings are necessary.

**Neutral:**

- This establishes a formal design system that will guide all future UI development.
