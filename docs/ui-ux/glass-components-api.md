# Glass Components API Reference

**Status**: ✅ Implementation Complete  
**Issue**: RR-229 - Core Glass Primitives  
**Components**: GlassPopover, GlassSegmentedControl  
**Last Updated**: August 20, 2025

This document provides comprehensive API reference for the foundational glass components implemented in RR-229, serving as the building blocks for the Violet Theme Rollout.

## Overview

The glass components provide performant, accessible UI primitives with a unified glass morphism design language. They utilize CVA (Class Variance Authority) for type-safe variant management and are optimized for both desktop and mobile experiences.

**Key Features:**

- 🎨 Unified glass design system with CSS custom properties
- 🚀 GPU-accelerated animations with `transform-gpu` and `will-change`
- ♿ WCAG 2.1 AA accessibility compliance
- 📱 44px minimum touch targets for mobile
- 🎭 Theme preparation for violet rollout phases
- 📦 Bundle optimized (~5KB gzipped combined)

---

## GlassPopover

A performant popover component built on Radix UI with glass morphism styling, ESC key handling, focus trapping, and outside-click dismissal.

### TypeScript Interface

```typescript
interface GlassPopoverProps {
  /** Trigger element that opens the popover */
  trigger: React.ReactNode;
  /** Content to display inside the popover */
  children: React.ReactNode;
  /** Whether the popover is open (controlled) */
  open?: boolean;
  /** Called when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Side to align the popover relative to trigger */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment relative to the trigger */
  align?: "start" | "center" | "end";
  /** Offset from the trigger */
  sideOffset?: number;
  /** Alignment offset */
  alignOffset?: number;
  /** Accessible label for the popover content */
  ariaLabel?: string;
  /** Additional class name for the content */
  className?: string;
  /** Theme variant */
  theme?: "default" | "violet-ready";
  /** Size variant */
  size?: "default" | "sm" | "lg";
  /** Enable reduced transparency mode */
  reducedTransparency?: boolean;
  /** Disable portal rendering */
  disablePortal?: boolean;
  /** Whether to show arrow */
  showArrow?: boolean;
  /** Arrow size */
  arrowSize?: number;
}
```

### CVA Variants

```typescript
const glassPopoverContentVariants = cva(
  // Base styles consolidate .glass-popover CSS classes
  [
    "glass-popover",
    "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturation)]",
    "bg-[var(--glass-nav-bg)] border border-[var(--glass-nav-border)]",
    "rounded-[22px] overflow-hidden",
    "shadow-[0_24px_60px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.12)]",
    // Animation and performance optimizations
    "will-change-[transform,opacity] transform-gpu",
    "animate-in fade-in-0 zoom-in-95",
  ],
  {
    variants: {
      theme: {
        default: "",
        "violet-ready": "data-theme-violet-ready",
      },
      size: {
        default: "min-w-[8rem]",
        sm: "min-w-[6rem]",
        lg: "min-w-[12rem]",
      },
    },
  }
);
```

### Radix Integration Details

- **Base Component**: `@radix-ui/react-popover` v1.1.15
- **Portal Rendering**: Enabled by default (configurable via `disablePortal`)
- **Focus Management**: Automatic focus trap with keyboard navigation
- **State Management**: Supports both controlled and uncontrolled modes

### Interaction Behavior

| Interaction       | Behavior                                         |
| ----------------- | ------------------------------------------------ |
| **ESC Key**       | Closes popover and returns focus to trigger      |
| **Outside Click** | Closes popover automatically                     |
| **Focus Trap**    | Keyboard navigation stays within popover content |
| **Arrow Keys**    | Navigate between interactive elements inside     |
| **Tab/Shift+Tab** | Standard focus management within content         |

### Usage Examples

#### Basic Usage

```tsx
import { GlassPopover } from "@/components/ui/glass-popover";
import { Button } from "@/components/ui/button";

<GlassPopover trigger={<Button>Open Menu</Button>}>
  <div className="p-4">
    <h3>Popover Content</h3>
    <p>This content appears in a glass popover.</p>
  </div>
</GlassPopover>;
```

#### Controlled State

```tsx
const [isOpen, setIsOpen] = useState(false);

<GlassPopover
  trigger={<Button>Toggle</Button>}
  open={isOpen}
  onOpenChange={setIsOpen}
  side="bottom"
  align="start"
>
  <div className="p-4">
    <button onClick={() => setIsOpen(false)}>Close</button>
  </div>
</GlassPopover>;
```

#### Theme Variants

```tsx
// Default theme
<GlassPopover trigger={<Button>Default</Button>} theme="default">
  <div className="p-4">Default glass styling</div>
</GlassPopover>

// Violet-ready theme (for upcoming rollout)
<GlassPopover trigger={<Button>Violet</Button>} theme="violet-ready">
  <div className="p-4">Violet theme preparation</div>
</GlassPopover>
```

#### Size Variants

```tsx
// Small popover
<GlassPopover trigger={<Button>Small</Button>} size="sm">
  <div className="p-2">Compact content</div>
</GlassPopover>

// Large popover
<GlassPopover trigger={<Button>Large</Button>} size="lg">
  <div className="p-6">Expanded content area</div>
</GlassPopover>
```

---

## GlassSegmentedControl

A accessible segmented control with glass styling, keyboard navigation, and ARIA compliance. Supports icons, multiple segments, and maintains 44px touch targets.

### TypeScript Interface

```typescript
interface GlassSegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface GlassSegmentedControlProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof glassSegmentedControlVariants> {
  /** Options to display in the segmented control */
  options: GlassSegmentedControlOption[];
  /** Currently selected value */
  value: string;
  /** Called when selection changes */
  onValueChange: (value: string) => void;
  /** Accessible label for the control */
  ariaLabel?: string;
  /** Enable reduced transparency mode */
  reducedTransparency?: boolean;
}
```

### CVA Variants

```typescript
const glassSegmentedControlVariants = cva(
  // Base styles consolidate .glass-segment* CSS classes
  [
    "glass-segment",
    "relative inline-flex gap-0 border border-white/8 dark:border-white/18",
    "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturation)]",
    "bg-[var(--glass-chip-bg)] rounded-full shadow-lg shadow-black/5 dark:shadow-white/5",
    // Performance optimizations
    "will-change-transform transform-gpu",
  ],
  {
    variants: {
      size: {
        default: "p-1",
        sm: "glass-segment-sm p-1",
      },
      segments: {
        2: "grid-cols-2",
        3: "glass-segment-3 grid grid-cols-3 items-center",
        4: "grid-cols-4",
      },
      theme: {
        default: "",
        "violet-ready": "[&]:data-theme-violet-ready",
      },
    },
    defaultVariants: {
      size: "default",
      segments: 3,
      theme: "default",
    },
  }
);
```

### Accessibility Compliance

- **ARIA Roles**: `role="radiogroup"` for container, `role="radio"` for options
- **ARIA States**: `aria-checked`, `aria-labelledby`, `aria-describedby`
- **Touch Targets**: Minimum 44px height/width for mobile compliance
- **High Contrast**: Respects `prefers-contrast: high` media query
- **Reduced Motion**: Honors `prefers-reduced-motion` for animations

### Keyboard Navigation

| Key                  | Behavior                            |
| -------------------- | ----------------------------------- |
| **Arrow Left/Right** | Navigate between options            |
| **Arrow Up/Down**    | Navigate between options (circular) |
| **Enter/Space**      | Select focused option               |
| **Tab**              | Enter/exit the segmented control    |
| **Home**             | Jump to first option                |
| **End**              | Jump to last option                 |

### Usage Examples

#### Basic 3-Segment Control

```tsx
import { GlassSegmentedControl } from "@/components/ui/glass-segmented-control";
import { List, MailOpen, CheckCheck } from "lucide-react";

const [filter, setFilter] = useState("all");

const options = [
  { value: "all", label: "All", icon: <List className="h-4 w-4" /> },
  { value: "unread", label: "Unread", icon: <MailOpen className="h-4 w-4" /> },
  { value: "read", label: "Read", icon: <CheckCheck className="h-4 w-4" /> },
];

<GlassSegmentedControl
  options={options}
  value={filter}
  onValueChange={setFilter}
  size="default"
  segments={3}
  ariaLabel="Article filter options"
/>;
```

#### Small 2-Segment Control

```tsx
const viewOptions = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

<GlassSegmentedControl
  options={viewOptions}
  value={view}
  onValueChange={setView}
  size="sm"
  segments={2}
  ariaLabel="View mode"
/>;
```

#### 4-Segment with Icons

```tsx
const timeOptions = [
  { value: "1h", label: "1h", icon: <Clock className="h-3 w-3" /> },
  { value: "24h", label: "24h", icon: <Clock className="h-3 w-3" /> },
  { value: "7d", label: "7d", icon: <Calendar className="h-3 w-3" /> },
  { value: "30d", label: "30d", icon: <Calendar className="h-3 w-3" /> },
];

<GlassSegmentedControl
  options={timeOptions}
  value={timeRange}
  onValueChange={setTimeRange}
  segments={4}
  ariaLabel="Time range filter"
/>;
```

---

## Design Tokens Integration

Both components utilize CSS custom properties for consistent theming:

```css
:root {
  --glass-blur: 20px;
  --glass-saturation: 1.8;
  --glass-nav-bg: rgba(255, 255, 255, 0.1);
  --glass-nav-border: rgba(255, 255, 255, 0.2);
  --glass-chip-bg: rgba(255, 255, 255, 0.05);
}

@media (prefers-color-scheme: dark) {
  :root {
    --glass-nav-bg: rgba(0, 0, 0, 0.3);
    --glass-nav-border: rgba(255, 255, 255, 0.1);
    --glass-chip-bg: rgba(255, 255, 255, 0.08);
  }
}
```

## Performance Characteristics

- **Bundle Size**: ~5KB gzipped combined
- **GPU Acceleration**: `transform-gpu` and `will-change` properties
- **Animation Performance**: CSS-based with hardware acceleration
- **Memory Usage**: Minimal overhead with Radix primitives
- **Tree Shaking**: Individual component imports supported

## Migration Notes

These components consolidate and replace fragmented CSS classes:

- `.glass-popover` → `GlassPopover` component
- `.glass-segment*` → `GlassSegmentedControl` component
- Manual Radix setup → Integrated component with sensible defaults

See [Component Library Foundation](../features/component-library-foundation.md) for detailed migration guide.

## Related Documentation

- [Liquid Glass Design System](liquid-glass-design-system.md)
- [Component Library Foundation](../features/component-library-foundation.md)
- [Violet Theme Rollout Plan](../expert-discussions/violet-tailwind-theme-rollout-plan-2025-08-19.md)
- [Floating Controls Architecture](../tech/floating-controls-architecture.md)
