# Glass Components API Reference

**Status**: ✅ Complete Component Library - Finalized by RR-231  
**Issues**: RR-229 (Core Glass Primitives), RR-230 (CSS-to-Component Migration), RR-231 (Foundation Finalization)  
**Components**: GlassPopover, GlassSegmentedControl, GlassButton, GlassInput, GlassCard, GlassTooltip, GlassNav, GlassFooter  
**Last Updated**: August 22, 2025

This document provides comprehensive API reference for the complete glass component library implemented across RR-229, RR-230, and RR-231, serving as the building blocks for the Violet Theme Rollout.

## Overview

The glass components provide performant, accessible UI primitives with a unified glass morphism design language. They utilize CVA (Class Variance Authority) for type-safe variant management and are optimized for both desktop and mobile experiences.

**Key Features:**

- 🎨 Unified glass design system with CSS custom properties
- 🚀 GPU-accelerated animations with `transform-gpu` and `will-change`
- ♿ WCAG 2.1 AA accessibility compliance
- 📱 44px minimum touch targets for mobile
- 🎭 Theme preparation for violet rollout phases
- 📦 Bundle optimized (~5KB gzipped combined)

## RR-230 Enhancements: Complete CSS-to-Component Migration

**Status**: ✅ Complete (August 22, 2025)

RR-230 achieved **complete CSS-to-component migration** for the glass button system, establishing the production-ready foundation for the component library:

### Architecture Achievements

- **Zero CSS Classes**: Eliminated all `.glass-*` CSS classes in favor of pure component variants
- **Zero Inline Styles**: Removed all inline glass styling throughout the application
- **Glass Container Model**: Implemented "glass container + transparent children" architecture pattern
- **Height Standardization**: Unified all glass buttons to `--glass-control-height: 48px`
- **Enhanced Liquid Glass**: Added sophisticated styling with improved opacity (0.55) and visual hierarchy

### New Component Variants

**GlassButton** now includes CSS-matching variants:

- `css-toolbar-btn`: Transparent variant for toolbar containers
- `css-icon-btn`: Icon-specific styling with proper touch targets
- `liquid-glass`: Enhanced variant with sophisticated glass effects

### Production Migration Success

- **Files Migrated**: `article-action-button.tsx`, `morphing-dropdown.tsx`, `dropdown-menu.tsx`, `page.tsx`, `article-detail.tsx`
- **Testing Coverage**: Comprehensive test suite with component validation and regression prevention
- **Performance**: No performance degradation with enhanced visual quality

### Component Library Foundation

RR-230 establishes the proven patterns and infrastructure needed for:

- **RR-231 Wave 2**: Scaling componentization to remaining UI elements
- **Phase B Violet Theme**: Theme application across the component system
- **Future Enhancements**: Extensible component architecture for new features

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

## GlassInput

A form input component with glass styling, validation states, and accessibility compliance.

### TypeScript Interface

```typescript
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input variant style */
  variant?: "default" | "filled";
  /** Size variant */
  size?: "sm" | "default" | "lg";
  /** Validation state */
  state?: "default" | "error" | "success";
  /** Theme variant */
  theme?: "default" | "violet-ready";
}
```

### CVA Variants

```typescript
const glassInputVariants = cva(
  [
    "w-full rounded-lg transition-colors duration-200",
    "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturation)]",
    "bg-[var(--color-surface-glass)] border border-[var(--color-border-glass)]",
    "placeholder:text-muted-foreground focus:outline-none",
    "focus:ring-2 focus:ring-violet-500 focus:border-transparent",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "will-change-transform transform-gpu",
  ],
  {
    variants: {
      variant: {
        default: "",
        filled: "bg-[var(--color-surface-glass-enhanced)]",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-3",
        lg: "h-12 px-4 text-lg",
      },
      state: {
        default: "",
        error: "border-red-500 focus:ring-red-500",
        success: "border-green-500 focus:ring-green-500",
      },
      theme: {
        default: "",
        "violet-ready": "data-theme-violet-ready",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      state: "default",
      theme: "default",
    },
  }
);
```

### Usage Examples

```tsx
// Basic input
<GlassInput placeholder="Search articles..." />

// Form input with validation
<GlassInput
  variant="filled"
  size="lg"
  state="error"
  placeholder="Enter email"
  aria-describedby="email-error"
/>

// Success state with icon
<div className="relative">
  <GlassInput
    state="success"
    placeholder="Username"
    value={username}
    onChange={(e) => setUsername(e.target.value)}
  />
  <CheckIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
</div>
```

---

## GlassCard

A container component with glass styling and elevation system for content organization.

### TypeScript Interface

```typescript
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation level for depth perception */
  elevation?: "flat" | "low" | "medium" | "high";
  /** Card variant style */
  variant?: "default" | "bordered";
  /** Size variant */
  size?: "sm" | "default" | "lg";
  /** Polymorphic element type */
  as?: React.ElementType;
  /** Theme variant */
  theme?: "default" | "violet-ready";
}
```

### CVA Variants

```typescript
const glassCardVariants = cva(
  [
    "rounded-xl overflow-hidden",
    "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturation)]",
    "bg-[var(--color-surface-glass)] border border-[var(--color-border-glass)]",
    "will-change-transform transform-gpu",
  ],
  {
    variants: {
      elevation: {
        flat: "",
        low: "shadow-sm",
        medium: "shadow-md",
        high: "shadow-lg shadow-black/10",
      },
      variant: {
        default: "",
        bordered: "border-2 border-[var(--color-border-glass-enhanced)]",
      },
      size: {
        sm: "p-3",
        default: "p-4",
        lg: "p-6",
      },
      theme: {
        default: "",
        "violet-ready": "data-theme-violet-ready",
      },
    },
    defaultVariants: {
      elevation: "low",
      variant: "default",
      size: "default",
      theme: "default",
    },
  }
);
```

### Usage Examples

```tsx
// Article card
<GlassCard elevation="medium" size="lg" as="article">
  <h2 className="text-xl font-semibold mb-2">Article Title</h2>
  <p className="text-muted-foreground mb-4">Article excerpt...</p>
  <div className="flex justify-between items-center">
    <span className="text-sm text-muted-foreground">2 hours ago</span>
    <GlassButton size="sm">Read More</GlassButton>
  </div>
</GlassCard>

// Interactive card
<GlassCard
  elevation="low"
  variant="bordered"
  className="cursor-pointer hover:elevation-medium transition-shadow"
  onClick={handleClick}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  <div className="flex items-center gap-3">
    <Avatar src={user.avatar} />
    <div>
      <h3 className="font-medium">{user.name}</h3>
      <p className="text-sm text-muted-foreground">{user.role}</p>
    </div>
  </div>
</GlassCard>
```

---

## GlassTooltip

An accessible tooltip component with glass styling and smart positioning.

### TypeScript Interface

```typescript
interface GlassTooltipProps {
  /** Content to display in the tooltip */
  content: React.ReactNode;
  /** Element that triggers the tooltip */
  children: React.ReactElement;
  /** Side to position the tooltip */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment relative to trigger */
  align?: "start" | "center" | "end";
  /** Delay before showing (ms) */
  delayDuration?: number;
  /** Theme variant */
  theme?: "default" | "violet-ready";
}
```

### Usage Examples

```tsx
// Basic tooltip
<GlassTooltip content="Save article for later">
  <GlassButton variant="ghost" size="sm">
    <BookmarkIcon className="h-4 w-4" />
  </GlassButton>
</GlassTooltip>

// Rich content tooltip
<GlassTooltip
  content={
    <div className="text-center">
      <div className="font-semibold mb-1">Keyboard Shortcut</div>
      <div className="flex gap-1 justify-center">
        <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd</kbd>
        <span>+</span>
        <kbd className="px-2 py-1 text-xs bg-muted rounded">S</kbd>
      </div>
    </div>
  }
  side="bottom"
  delayDuration={500}
>
  <GlassButton>Save Article</GlassButton>
</GlassTooltip>

// Form field tooltip
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <label htmlFor="api-key">API Key</label>
    <GlassTooltip
      content="Your personal API key for accessing feeds. Keep this secure!"
      side="right"
    >
      <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
    </GlassTooltip>
  </div>
  <GlassInput
    id="api-key"
    type="password"
    placeholder="Enter your API key"
  />
</div>
```

---

## GlassNav

A responsive navigation component with glass styling and scroll-aware behavior.

### TypeScript Interface

```typescript
interface GlassNavProps extends React.HTMLAttributes<HTMLElement> {
  /** Navigation variant */
  variant?: "default" | "compact" | "floating";
  /** Theme variant */
  theme?: "default" | "violet-ready";
}
```

### Usage Examples

```tsx
// Main application navigation
<GlassNav variant="default" className="sticky top-0 z-50">
  <div className="flex items-center justify-between px-4 py-2">
    <div className="flex items-center gap-4">
      <h1 className="text-xl font-bold">RSS Reader</h1>
      <nav className="hidden md:flex gap-6">
        <a href="/feeds" className="text-sm hover:text-violet-500">Feeds</a>
        <a href="/articles" className="text-sm hover:text-violet-500">Articles</a>
        <a href="/settings" className="text-sm hover:text-violet-500">Settings</a>
      </nav>
    </div>
    <div className="flex items-center gap-2">
      <GlassButton variant="ghost" size="sm">
        <UserIcon className="h-4 w-4" />
      </GlassButton>
      <GlassButton variant="ghost" size="sm">
        <SettingsIcon className="h-4 w-4" />
      </GlassButton>
    </div>
  </div>
</GlassNav>

// Compact mobile navigation
<GlassNav variant="compact" className="md:hidden">
  <div className="flex items-center justify-between px-3 py-2">
    <GlassButton variant="ghost" size="sm">
      <MenuIcon className="h-5 w-5" />
    </GlassButton>
    <h1 className="text-lg font-semibold">RSS Reader</h1>
    <GlassButton variant="ghost" size="sm">
      <SearchIcon className="h-5 w-5" />
    </GlassButton>
  </div>
</GlassNav>
```

---

## GlassFooter

A footer component with glass styling and responsive layout system.

### TypeScript Interface

```typescript
interface GlassFooterProps extends React.HTMLAttributes<HTMLElement> {
  /** Footer variant */
  variant?: "default" | "minimal" | "detailed";
  /** Theme variant */
  theme?: "default" | "violet-ready";
}
```

### Usage Examples

```tsx
// Application footer
<GlassFooter variant="detailed" className="mt-auto">
  <div className="px-4 py-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <h3 className="font-semibold mb-2">RSS Reader</h3>
        <p className="text-sm text-muted-foreground">
          Stay updated with your favorite content sources.
        </p>
      </div>
      <div>
        <h4 className="font-medium mb-2">Quick Links</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><a href="/feeds" className="hover:text-foreground">Manage Feeds</a></li>
          <li><a href="/settings" className="hover:text-foreground">Settings</a></li>
          <li><a href="/help" className="hover:text-foreground">Help</a></li>
        </ul>
      </div>
      <div>
        <h4 className="font-medium mb-2">Connect</h4>
        <div className="flex gap-2">
          <GlassButton variant="ghost" size="sm">
            <TwitterIcon className="h-4 w-4" />
          </GlassButton>
          <GlassButton variant="ghost" size="sm">
            <GitHubIcon className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>
    </div>
    <div className="border-t border-[var(--color-border-glass)] mt-6 pt-4 text-center">
      <p className="text-sm text-muted-foreground">
        © 2025 RSS Reader. Built with glass components.
      </p>
    </div>
  </div>
</GlassFooter>

// Minimal footer
<GlassFooter variant="minimal" className="text-center py-4">
  <p className="text-sm text-muted-foreground">
    Made with ❤️ using liquid glass design
  </p>
</GlassFooter>
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

- **Bundle Size**: ~15KB gzipped complete library (under 3KB per component)
- **GPU Acceleration**: `transform-gpu` and `will-change` properties
- **Animation Performance**: CSS-based with hardware acceleration
- **Memory Usage**: Minimal overhead with Radix primitives and efficient CVA compilation
- **Tree Shaking**: Individual component imports supported via barrel exports

## Component Library Architecture

### Barrel Export System

All components are available through centralized exports:

```typescript
// Centralized import (recommended for app code)
import {
  GlassButton,
  GlassInput,
  GlassCard,
  GlassTooltip,
} from "@/components/ui";

// Direct imports (for library code and optimization)
import { GlassButton } from "@/components/ui/glass-button";
```

### Semantic Token Integration

All components utilize the three-tier token system:

**Reference Tokens** → **Semantic Tokens** → **Component Tokens**

```css
/* Reference: Physical properties */
--glass-opacity-enhanced: 0.55;

/* Semantic: Design intent */
--color-surface-glass: rgba(255, 255, 255, var(--glass-opacity-enhanced));

/* Component: API compatibility */
--glass-nav-bg: var(--color-surface-glass);
```

## Migration Notes

### Complete CSS-to-Component Migration (RR-231)

All CSS classes have been migrated to React components:

| CSS Class               | React Component           | Migration Benefits                    |
| ----------------------- | ------------------------- | ------------------------------------- |
| `.glass-popover`        | `<GlassPopover>`          | Radix integration, accessibility      |
| `.glass-segment*`       | `<GlassSegmentedControl>` | Keyboard navigation, ARIA             |
| `.glass-nav`            | `<GlassNav>`              | Responsive design, semantic HTML      |
| `.glass-footer`         | `<GlassFooter>`           | Layout system, mobile optimization    |
| Manual inputs           | `<GlassInput>`            | Validation states, focus management   |
| Card containers         | `<GlassCard>`             | Elevation system, polymorphic API     |
| Tooltip implementations | `<GlassTooltip>`          | Positioning, accessibility compliance |

### Violet Theme Preparation

All components include `violet-ready` theme variants:

```tsx
// Automatic violet theme support
<GlassInput theme="violet-ready" />
<GlassCard theme="violet-ready" />
<GlassTooltip theme="violet-ready" />
```

## Related Documentation

- [Component Library Foundation Finalization](../features/component-library-foundation-finalization.md) - Complete RR-231 implementation
- [Component Library Foundation](../features/component-library-foundation.md) - Original foundation work
- [CSS Token Semantic Hierarchy ADR](../adr/20250822-css-token-semantic-hierarchy.md) - Token architecture decisions
- [Liquid Glass Design System](liquid-glass-design-system.md) - Design principles
- [Violet Theme Rollout Plan](../expert-discussions/violet-tailwind-theme-rollout-plan-2025-08-19.md) - Theme rollout phases
