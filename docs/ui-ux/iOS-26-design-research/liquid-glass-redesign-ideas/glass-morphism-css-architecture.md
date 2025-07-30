# Glass Morphism CSS Architecture

## Overview

This document defines the CSS architecture for implementing Apple's iOS 26 Liquid Glass design system in the RSS Reader PWA. The system uses layered transparency, backdrop filters, and adaptive color modes.

## CSS Custom Properties

### Glass Material Variables

```css
:root {
  /* Glass backgrounds - Regular variant */
  --glass-bg-regular: rgba(255, 255, 255, 0.28);
  --glass-bg-regular-hover: rgba(255, 255, 255, 0.4);

  /* Glass backgrounds - Clear variant */
  --glass-bg-clear: rgba(255, 255, 255, 0.16);
  --glass-bg-clear-hover: rgba(255, 255, 255, 0.2);

  /* Glass blur intensities */
  --glass-blur-heavy: 24px;
  --glass-blur-medium: 16px;
  --glass-blur-light: 12px;
  --glass-blur-minimal: 8px;

  /* Glass saturation */
  --glass-saturate: 180%;

  /* Glass borders */
  --glass-border-light: rgba(255, 255, 255, 0.4);
  --glass-border-light-subtle: rgba(255, 255, 255, 0.2);

  /* Animation timing */
  --glass-transition-quick: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --glass-transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --glass-transition-spring: 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Dark mode adjustments */
.dark {
  /* Adaptive glass - lighter blur in dark mode */
  --glass-bg-regular: rgba(30, 30, 30, 0.35);
  --glass-bg-regular-hover: rgba(40, 40, 40, 0.45);

  --glass-bg-clear: rgba(20, 20, 20, 0.2);
  --glass-bg-clear-hover: rgba(30, 30, 30, 0.25);

  /* Reduced blur in dark mode for performance */
  --glass-blur-heavy: 16px;
  --glass-blur-medium: 12px;

  /* Dark mode borders */
  --glass-border-light: rgba(255, 255, 255, 0.1);
  --glass-border-light-subtle: rgba(255, 255, 255, 0.05);
}
```

### Shadow System

```css
:root {
  /* Layered shadows for depth */
  --glass-shadow-sm:
    0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);

  --glass-shadow-md:
    0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.04);

  --glass-shadow-lg:
    0 12px 48px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.05);

  /* Inner shadows for glass edges */
  --glass-inner-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25);
}

.dark {
  --glass-shadow-md:
    0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1);

  --glass-inner-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
}
```

## Utility Classes

### Base Glass Components

```css
/* Base glass mixin */
.glass {
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur))
    saturate(var(--glass-saturate));
  transition: all var(--glass-transition-normal);
  will-change: backdrop-filter, transform;
}

/* Regular glass (navigation, cards) */
.glass-regular {
  --glass-blur: var(--glass-blur-heavy);
  background: var(--glass-bg-regular);
  border: 1px solid var(--glass-border-light-subtle);
  box-shadow: var(--glass-shadow-md), var(--glass-inner-shadow);
}

.glass-regular:hover {
  background: var(--glass-bg-regular-hover);
  transform: translateY(-1px);
  box-shadow: var(--glass-shadow-lg), var(--glass-inner-shadow);
}

/* Clear glass (overlays, toasts) */
.glass-clear {
  --glass-blur: var(--glass-blur-medium);
  background: var(--glass-bg-clear);
  border: 1px solid var(--glass-border-light-subtle);
  box-shadow: var(--glass-shadow-sm), var(--glass-inner-shadow);
}

/* Minimal glass (subtle elements) */
.glass-minimal {
  --glass-blur: var(--glass-blur-minimal);
  background: var(--glass-bg-clear);
  border: 1px solid var(--glass-border-light-subtle);
}
```

### Glass Overlays and Effects

```css
/* Shine overlay for buttons/interactive elements */
.glass-shine::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.1) 40%,
    rgba(255, 255, 255, 0) 100%
  );
  opacity: 0;
  transition: opacity var(--glass-transition-quick);
  pointer-events: none;
}

.glass-shine:hover::before {
  opacity: 1;
}

/* Active/pressed state */
.glass-active {
  transform: scale(0.98);
  box-shadow: var(--glass-shadow-sm), var(--glass-inner-shadow);
}

/* Specular highlight animation */
@keyframes glass-shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

.glass-shimmer {
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: glass-shimmer 3s ease-in-out infinite;
}
```

### Shape System Classes

```css
/* Capsule - for buttons and pills */
.shape-capsule {
  border-radius: 9999px;
}

/* Fixed radius - for cards and containers */
.shape-fixed-sm {
  border-radius: 8px;
}

.shape-fixed-md {
  border-radius: 12px;
}

.shape-fixed-lg {
  border-radius: 16px;
}

.shape-fixed-xl {
  border-radius: 24px;
}

/* Concentric - for nested elements */
.shape-concentric {
  border-radius: calc(0.5rem + 50%);
}
```

## Component-Specific Classes

### Navigation Components

```css
/* Header glass */
.glass-header {
  @apply glass glass-regular;
  backdrop-filter: blur(var(--glass-blur-heavy)) saturate(var(--glass-saturate));
  background: linear-gradient(
    to right,
    var(--glass-bg-regular) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    var(--glass-bg-regular) 100%
  );
}

/* Tab bar glass with ultra-transparency */
.glass-tab-bar {
  @apply glass shape-fixed-xl;
  backdrop-filter: blur(var(--glass-blur-heavy)) saturate(var(--glass-saturate));
  background: rgba(255, 255, 255, 0.4);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.2),
    var(--glass-inner-shadow);
}

.dark .glass-tab-bar {
  background: rgba(30, 30, 30, 0.4);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.5),
    var(--glass-inner-shadow);
}

/* Active tab state */
.glass-tab-active {
  background: linear-gradient(
    to bottom right,
    rgba(59, 130, 246, 0.3),
    rgba(59, 130, 246, 0.25)
  );
  box-shadow:
    0 4px 20px rgba(59, 130, 246, 0.25),
    var(--glass-inner-shadow);
}
```

### Content Components

```css
/* Article card glass */
.glass-card {
  @apply glass glass-minimal shape-fixed-md;
  transition: all var(--glass-transition-normal);
}

.glass-card:hover {
  @apply glass-regular;
  transform: translateY(-2px);
}

/* Summary section glass */
.glass-summary {
  @apply glass glass-clear shape-fixed-md;
  background: linear-gradient(
    to bottom,
    var(--glass-bg-clear),
    rgba(255, 255, 255, 0.1)
  );
}

/* Floating action button */
.glass-fab {
  @apply glass glass-regular shape-capsule glass-shine;
  box-shadow: var(--glass-shadow-lg), var(--glass-inner-shadow);
}
```

## Performance Optimizations

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  .glass,
  .glass * {
    animation: none !important;
    transition: none !important;
  }

  .glass:hover {
    transform: none !important;
  }
}
```

### Reduced Transparency Support

```css
@media (prefers-reduced-transparency: reduce) {
  .glass-regular {
    backdrop-filter: none;
    background: rgba(255, 255, 255, 0.95);
  }

  .dark .glass-regular {
    background: rgba(30, 30, 30, 0.95);
  }

  .glass-clear,
  .glass-minimal {
    backdrop-filter: none;
    background: rgba(255, 255, 255, 0.9);
  }
}
```

### Fallback for Non-Supporting Browsers

```css
@supports not (backdrop-filter: blur(1px)) {
  .glass-regular {
    background: rgba(255, 255, 255, 0.95);
    box-shadow: var(--glass-shadow-md);
  }

  .glass-clear {
    background: rgba(255, 255, 255, 0.85);
  }

  .dark .glass-regular {
    background: rgba(30, 30, 30, 0.95);
  }
}
```

## Animation Utilities

### Tab Switch Animation

```css
.tab-icon {
  transition: all var(--glass-transition-spring);
}

.tab-icon-active {
  transform: scale(1.1);
}

.tab-icon-inactive {
  transform: scale(1);
}

/* Icon morph - handled by JS class toggle */
.icon-outline,
.icon-solid {
  transition: opacity var(--glass-transition-quick);
}
```

### Glass Element Interactions

```css
/* Press animation */
.glass-press:active {
  transition: transform 100ms ease-out;
  transform: scale(0.95);
}

/* Lift animation */
.glass-lift {
  transition: all var(--glass-transition-normal);
}

.glass-lift:hover {
  transform: translateY(-4px);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.15),
    var(--glass-inner-shadow);
}
```

## Tailwind Configuration

Add these to your `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      backdropBlur: {
        xs: "4px",
      },
      backgroundImage: {
        "glass-gradient":
          "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)",
      },
      animation: {
        shimmer: "glass-shimmer 3s ease-in-out infinite",
      },
    },
  },
};
```

## Usage Guidelines

1. **Never stack glass on glass** - maintains clarity and performance
2. **Use Regular variant for primary UI** - navigation, cards, buttons
3. **Use Clear variant for overlays** - toasts, modals, tooltips
4. **Limit simultaneous glass elements** - max 3-4 for performance
5. **Always provide fallbacks** - for accessibility and compatibility
6. **Test on real devices** - blur performance varies significantly

## Browser Support

- **Full Support**: Safari 15+, Chrome 76+, Edge 79+
- **Partial Support**: Firefox 103+ (no -webkit prefix)
- **Fallback**: Solid backgrounds with opacity
