# Animation System for iOS 26 Liquid Glass Design

## Overview

This document defines the animation patterns and interactions for the iOS 26 Liquid Glass redesign, focusing on smooth, performant animations that enhance the user experience.

## Core Animation Principles

### Timing Functions

```css
:root {
  /* Easing curves */
  --ease-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.6, 1);
  --ease-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --ease-elastic: cubic-bezier(0.68, -0.6, 0.32, 1.6);

  /* Durations */
  --duration-instant: 100ms;
  --duration-quick: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-glacial: 1000ms;
}
```

## Tab Navigation Animations

### Tab Switch Animation

```css
/* Base tab icon animation */
.tab-icon {
  transition:
    transform var(--duration-normal) var(--ease-spring),
    color var(--duration-quick) var(--ease-out);
  transform-origin: center;
}

/* Active state scaling */
.tab-icon-active {
  animation: tab-activate var(--duration-normal) var(--ease-spring);
}

@keyframes tab-activate {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1.1);
  }
}

/* Icon morph implementation */
.icon-morph-container {
  position: relative;
  width: 24px;
  height: 24px;
}

.icon-outline,
.icon-solid {
  position: absolute;
  inset: 0;
  transition:
    opacity var(--duration-quick) var(--ease-out),
    transform var(--duration-normal) var(--ease-spring);
}

.icon-outline {
  opacity: 1;
  transform: scale(1);
}

.icon-solid {
  opacity: 0;
  transform: scale(0.8);
}

.tab-active .icon-outline {
  opacity: 0;
  transform: scale(1.2);
}

.tab-active .icon-solid {
  opacity: 1;
  transform: scale(1);
}
```

### Tab Press Feedback

```typescript
// Haptic feedback + visual response
function handleTabPress(tabId: string) {
  // Visual feedback
  setPressed(tabId);

  // Haptic feedback (iOS)
  if ("vibrate" in navigator) {
    navigator.vibrate(10);
  }

  // Reset after animation
  setTimeout(() => setPressed(null), 100);
}
```

### Badge Animation

```css
/* Badge appearance */
.tab-badge {
  animation: badge-appear var(--duration-normal) var(--ease-spring);
}

@keyframes badge-appear {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Badge update pulse */
.badge-updated {
  animation: badge-pulse var(--duration-slow) var(--ease-out);
}

@keyframes badge-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4);
  }
}
```

## Glass Effect Animations

### Glass Hover States

```css
/* Button hover with lift effect */
.glass-button {
  transition: all var(--duration-normal) var(--ease-out);
  transform: translateY(0);
}

.glass-button:hover {
  transform: translateY(-2px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 1px rgba(255, 255, 255, 0.35);
}

.glass-button:active {
  transition-duration: var(--duration-instant);
  transform: translateY(0) scale(0.98);
}

/* Glass shimmer effect */
.glass-shimmer::after {
  content: "";
  position: absolute;
  inset: -50%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 70%
  );
  transform: translateX(-100%) rotate(45deg);
  transition: transform var(--duration-slow) var(--ease-out);
}

.glass-shimmer:hover::after {
  transform: translateX(100%) rotate(45deg);
}
```

### Loading States

```css
/* Skeleton shimmer for glass cards */
.glass-skeleton {
  position: relative;
  overflow: hidden;
  background: var(--glass-bg-clear);
}

.glass-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  animation: skeleton-shimmer 2s infinite;
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
```

## Content Animations

### Article List Transitions

```css
/* Stagger animation for list items */
.article-list-item {
  opacity: 0;
  transform: translateY(10px);
  animation: fade-in-up var(--duration-normal) var(--ease-out) forwards;
}

.article-list-item:nth-child(n) {
  animation-delay: calc(n * 50ms);
}

@keyframes fade-in-up {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Read state transition */
.article-card {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-quick) var(--ease-out);
}

.article-card.is-read {
  opacity: 0.6;
}
```

### Summary Generation Animation

```typescript
// Summary expand animation with auto-scroll
function handleSummaryGenerated(summaryElement: HTMLElement) {
  // Apply expand animation
  summaryElement.classList.add("summary-expand");

  // Calculate scroll position
  const rect = summaryElement.getBoundingClientRect();
  const scrollTop = window.scrollY;
  const elementTop = rect.top + scrollTop;
  const headerHeight = 64;

  // Only scroll if summary is below viewport or too high
  if (rect.top < headerHeight || rect.bottom > window.innerHeight) {
    window.scrollTo({
      top: elementTop - headerHeight - 20,
      behavior: "smooth",
    });
  }
}
```

```css
.summary-section {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height var(--duration-slow) var(--ease-out),
    opacity var(--duration-normal) var(--ease-out);
}

.summary-expand {
  max-height: 2000px;
  opacity: 1;
}

/* Glass morph-in effect */
.summary-content {
  transform: scale(0.95);
  filter: blur(4px);
  transition:
    transform var(--duration-normal) var(--ease-spring),
    filter var(--duration-normal) var(--ease-out);
}

.summary-expand .summary-content {
  transform: scale(1);
  filter: blur(0);
}
```

## Gesture Animations

### Swipe Navigation

```typescript
// Swipe gesture handler with visual feedback
export function useSwipeNavigation() {
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null
  );
  const threshold = 50;

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setSwipeDirection("left");
      navigateToNextArticle();
      setTimeout(() => setSwipeDirection(null), 300);
    },
    onSwipedRight: () => {
      setSwipeDirection("right");
      navigateToPreviousArticle();
      setTimeout(() => setSwipeDirection(null), 300);
    },
    trackMouse: false,
    threshold,
  });

  return { handlers, swipeDirection };
}
```

```css
/* Swipe feedback animation */
.article-container {
  transition: transform var(--duration-normal) var(--ease-out);
}

.swipe-left {
  animation: swipe-left-feedback var(--duration-normal) var(--ease-spring);
}

.swipe-right {
  animation: swipe-right-feedback var(--duration-normal) var(--ease-spring);
}

@keyframes swipe-left-feedback {
  0% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-20px);
    opacity: 0.8;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes swipe-right-feedback {
  0% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(20px);
    opacity: 0.8;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}
```

## Interactive Elements

### Filter Toggle Animation

```css
/* iOS-style filter toggle */
.filter-toggle {
  position: relative;
  background: var(--glass-bg-clear);
  border-radius: var(--radius-lg);
  padding: 2px;
}

.filter-indicator {
  position: absolute;
  inset: 2px;
  width: calc(50% - 2px);
  background: var(--glass-bg-regular);
  border-radius: var(--radius-md);
  transition: transform var(--duration-normal) var(--ease-spring);
  box-shadow: var(--glass-shadow-sm);
}

.filter-toggle[data-value="unread"] .filter-indicator {
  transform: translateX(100%);
}

.filter-option {
  position: relative;
  z-index: 1;
  transition: color var(--duration-quick) var(--ease-out);
}

.filter-option.active {
  color: var(--primary);
  font-weight: 600;
}
```

### More Menu Animation

```css
/* Expanding more menu */
.more-menu {
  transform-origin: top right;
  opacity: 0;
  transform: scale(0.8);
  transition:
    opacity var(--duration-quick) var(--ease-out),
    transform var(--duration-normal) var(--ease-spring);
}

.more-menu.open {
  opacity: 1;
  transform: scale(1);
}

.more-menu-item {
  opacity: 0;
  transform: translateX(-10px);
  transition: all var(--duration-quick) var(--ease-out);
}

.more-menu.open .more-menu-item {
  opacity: 1;
  transform: translateX(0);
}

.more-menu.open .more-menu-item:nth-child(n) {
  transition-delay: calc(n * 30ms);
}
```

## Performance Optimization

### GPU Acceleration

```css
/* Force GPU acceleration for smooth animations */
.gpu-accelerated {
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
  perspective: 1000px;
}

/* Clean up after animation */
.animation-complete {
  will-change: auto;
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Keep essential feedback */
  .tab-icon-active {
    transform: scale(1.1);
  }

  .glass-button:active {
    transform: scale(0.98);
  }
}
```

### Animation Frame Management

```typescript
// Debounced animations for performance
export function useAnimationFrame(callback: () => void) {
  const requestRef = useRef<number>();

  const animate = useCallback(() => {
    callback();
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]);
}
```

## Animation Sequences

### Page Transitions

```typescript
// Coordinated page transition
export function usePageTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const transitionTo = async (route: string) => {
    setIsTransitioning(true);

    // Fade out current content
    await sleep(200);

    // Navigate
    router.push(route);

    // Fade in new content
    await sleep(200);
    setIsTransitioning(false);
  };

  return { isTransitioning, transitionTo };
}
```

## Testing Animations

### Performance Metrics

- All animations should run at 60fps
- Use Chrome DevTools Performance tab
- Check for layout thrashing
- Monitor paint and composite times

### Device Testing

- Test on real iOS devices
- Verify haptic feedback works
- Check battery impact
- Ensure smooth scrolling maintained
