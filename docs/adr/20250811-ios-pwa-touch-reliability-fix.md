# ADR-008: iOS PWA Touch Reliability Fixes

- **Status:** Accepted
- **Date:** 2025-08-11

## Context

A critical usability bug (RR-180) was identified where buttons and other interactive elements in the iOS PWA were frequently unresponsive to taps. This was especially prevalent in the article detail view's header. The issue was severe enough to block core user workflows, such as starring an article or navigating back to the list. The root cause was a combination of several interacting front-end issues.

## Decision

We will implement a multi-faceted solution to address the iOS touch reliability issues, focusing on removing conflicts and adhering more closely to mobile web best practices. The decision consists of four key changes:

1.  **Remove Swipe Gesture Handlers:** The global `onTouchStart`, `onTouchMove`, and `onTouchEnd` handlers on the article detail view container will be removed entirely, as they were interfering with tap event propagation on child elements.
2.  **Scope Hover Styles:** All CSS `:hover` styles will be wrapped in a `@media (hover: hover) and (pointer: fine)` media query to prevent them from applying on touch-only devices, which avoids the "first tap to hover, second tap to click" issue.
3.  **Refactor Morphing Dropdown:** The `MorphingDropdown` component will be refactored to toggle visibility of its layers using `display: none` instead of the brittle `pointer-events: none` CSS property, which is known to have hit-testing quirks on iOS WebKit.
4.  **Enforce Touch Target Size:** All interactive elements will be audited and adjusted to meet or exceed Apple's Human Interface Guidelines minimum of 44x44px for touch targets.

## Consequences

**Positive:**

- Resolves the critical bug, making all buttons and controls 100% reliable on the iOS PWA.
- Significantly improves the user experience, removing a major point of frustration.
- The codebase becomes more robust and aligned with best practices for mobile web development.
- The removal of the swipe gesture handler simplifies the component's event logic.

**Negative:**

- The swipe-to-navigate feature between articles is removed. This is an acceptable trade-off for fixing the core button functionality. Navigation can still be accomplished via the "Previous/Next" buttons.

**Neutral:**

- This decision reinforces the importance of testing on real mobile devices, especially for PWAs.
