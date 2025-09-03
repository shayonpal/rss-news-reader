# Violet Tailwind Theme Rollout Plan (2025-08-19)

Status: Approved - Restructured Two-Phase Approach
Owner: UI/UX + Frontend
Related:

- Liquid Glass Research: docs/ui-ux/iOS-26-design-research/liquid-glass-research.md
- Liquid Glass Guidelines: docs/ui-ux/liquid-glass-design-guidelines.md
- Liquid Glass Design System: docs/ui-ux/liquid-glass-design-system.md
- Mark All Read (RR-179): docs/features/mark-all-read.md

## Implementation Strategy

### Primary Goals

**1. Solve Technical Debt:** Eliminate scattered glass styling that causes regressions
**2. Apply Violet Branding:** Implement violet theme via semantic tokens
**3. Maintain Liquid Glass:** Preserve iOS 26 design system principles
**4. Minimize Risk:** Separate structural changes from aesthetic changes

### Current Pain Points

**Regression Issues:**

- Style changes don't get applied uniformly across `.glass-icon-btn`, `.glass-toolbar-btn`, `.glass-popover`, `.glass-segment*`, `.liquid-glass-btn`
- Hardcoded colors in multiple locations: `GlassButton` (ring-blue-500), `liquid-glass-button.css` (rgb values)
- Inconsistent touch targets and focus states across ad hoc glass classes

**Developer Experience:**

- Multiple places to update for single visual change
- Difficult to ensure consistency across all glass elements
- QA surface area too large for UI changes

### Two-Phase Implementation Approach

**Phase A (Component Library Foundation):** Ship centralized glass components with current colors
**Phase B (Violet Theme Application):** Apply violet branding to mature component system

This approach **decouples technical debt cleanup from aesthetic changes**, reducing risk and enabling faster feedback loops.

## Phase A: Component Library Foundation (Ship First)

**Objective:** Eliminate scattered styling technical debt by centralizing all glass behavior into reusable components, keeping current colors intact.

**Value:** Immediate fix for regression issues, easier future UI changes, better developer experience

**Developer Tasks:**

1. **Build Core Components** (`src/components/ui/`)

```typescript
// GlassPopover.tsx - Standardized glass container
interface GlassPopoverProps {
  placement?: "top" | "bottom" | "left" | "right";
  scrollAware?: boolean;
  variant?: "regular" | "clear";
  children: ReactNode;
}

// GlassSegmentedControl.tsx - Centralized indicator logic
interface GlassSegmentedControlProps {
  options: { value: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  size?: "default" | "sm";
}

// GlassFab.tsx - Floating action button (48×48 minimum)
interface GlassFabProps {
  icon: ReactNode;
  onClick: () => void;
  position?: "bottom-right" | "bottom-left";
  ariaLabel: string;
}
```

2. **Key Implementation Requirements:**

- Use **current color tokens** (no violet yet)
- Enforce 48×48px minimum touch targets (mobile HIG compliance)
- Include focus-visible rings using existing `--ring` token
- Add reduced-transparency fallbacks with `@supports not (backdrop-filter: blur(1px))`
- Single glass layer per component (never stack glass-on-glass)
- Export CVA variants for composition: `glassButtonVariants`, `glassPopoverVariants`

3. **Testing Strategy:**

- Unit tests: render, focus-visible, reduced-transparency fallback
- Reuse existing RR-180 glass tests (performance, accessibility)
- Reuse RR-206 responsive tests (touch targets, mobile behavior)

### Slice A1 — Core Glass Primitives (2-3 days)

_Implementation of the developer tasks listed above._

### Slice A2 — Migration Wave 1 (3-4 days)

**Developer Tasks:**

1. **Component Migrations:**

```bash
# Search for usage patterns
grep -r "\.glass-popover" src/
grep -r "\.glass-icon-btn" src/
grep -r "\.glass-toolbar-btn" src/
```

2. **Replace Class Usage:**

```tsx
// Before: <div className="glass-popover">...</div>
// After:  <GlassPopover variant="regular">...</GlassPopover>

// Before: <button className="glass-icon-btn">
// After:  <GlassIconButton variant="default" icon={<Icon />}>

// Before: <button className="glass-toolbar-btn">
// After:  <GlassToolbarButton variant="secondary">
```

3. **Verification Steps:**

- Visual parity check: take screenshots before/after each migration
- Ensure all hover/focus/active states preserved
- Verify 44px touch targets maintained
- Test reduced-transparency behavior

### Slice A3 — Migration Wave 2 (2-3 days)

**Developer Tasks:**

1. **Segmented Control Migration:**

```tsx
// Before: Complex CSS classes with manual indicator positioning
// After: <GlassSegmentedControl options={items} value={selected} onChange={setSelected} />
```

2. **Floating Button Migration:**

```tsx
// Before: .liquid-glass-btn with manual positioning
// After: <GlassFab icon={<ArrowUp />} onClick={scrollToTop} ariaLabel="Scroll to top" />
```

3. **CSS Cleanup:**

- Remove deprecated classes from CSS files
- Update any remaining hardcoded glass styles
- Consolidate glass-related utilities under component variants

**Phase A Completion Criteria:**

- [ ] All `.glass-*` CSS classes replaced with React components
- [ ] No scattered styling in multiple CSS files
- [ ] All touch targets meet 44×44px minimum
- [ ] Focus states consistent and accessible
- [ ] All existing tests pass with current visual appearance
- [ ] Components handle reduced-transparency gracefully

## Phase B: Violet Theme Application (Ship Second)

**Objective:** Apply violet branding to the mature, centralized component system from Phase A.

**Value:** Consistent violet theme across all glass elements with minimal risk of regressions

### Slice B1 — Token Update (30 minutes)

**Developer Tasks:**

1. **Update `src/app/globals.css`:**

```css
:root {
  /* Violet Light Mode */
  --primary: 262 83% 67%; /* Violet 500 */
  --primary-foreground: 0 0% 98%; /* Near-white */
  --accent: 262 100% 97%; /* Violet 50 tint */
  --accent-foreground: 262 66% 35%; /* Violet 700 text */
  --ring: 262 83% 67%; /* Match primary */

  /* Chart Colors */
  --chart-1: 262 83% 67%; /* Violet */
  --chart-2: 239 84% 67%; /* Indigo */
  --chart-3: 199 84% 55%; /* Sky */
  --chart-4: 43 84% 60%; /* Amber */
  --chart-5: 340 75% 60%; /* Rose */
}

.dark {
  /* Violet Dark Mode */
  --primary: 262 70% 72%; /* Brighter for dark */
  --primary-foreground: 240 6% 10%; /* Near-black */
  --accent: 262 40% 22%; /* Deep violet surface */
  --accent-foreground: 0 0% 98%; /* Near-white */
  --ring: 262 70% 65%; /* Lighter ring */
}
```

2. **Immediate Testing:**

- Smoke test: Home, Article List, Article Detail, Sidebar, Menus
- Both light and dark modes
- Focus ring visibility on glass and solid surfaces

### Slice B2 — Hardcoded Color Cleanup (1-2 hours)

**Developer Tasks:**

1. **Fix `src/styles/liquid-glass-button.css`:**

```css
/* Replace hardcoded rgb(139, 92, 246) with: */
color: hsl(var(--primary));
background: hsl(var(--primary) / 0.12);
border-color: hsl(var(--primary) / 0.25);
box-shadow: 0 2px 8px hsl(var(--primary) / 0.08);
```

2. **Fix Component Hardcoded Colors:**

```tsx
// In existing glass components, replace:
// ring-blue-500 → ring-ring
// bg-blue-500/20 → bg-primary/20
// text-blue-600 → text-primary
// hover:bg-blue-500/25 → hover:bg-primary/25
```

3. **Sonner Toast Integration:**

```tsx
// Apply in toast provider configuration
<Toaster
  toastOptions={{
    classNames: {
      toast: "bg-popover text-popover-foreground border border-border",
      success: "bg-primary/10 text-primary",
      error: "bg-destructive text-destructive-foreground",
      action: "bg-primary text-primary-foreground hover:bg-primary/90",
    },
  }}
/>
```

**Phase B Completion Criteria:**

- [ ] All interactive elements use violet theme tokens
- [ ] AA contrast validated (≥4.5:1 for text, ≥3:1 for UI)
- [ ] Focus rings visible on all surfaces
- [ ] Mark All Read states preserved (normal/loading violet, confirming red)
- [ ] Toast notifications harmonize with glass theme
- [ ] No hardcoded color values remain in components

## Testing & Validation Strategy

### Phase A Testing (Component Library)

**Required Test Suites:**

```bash
# Unit tests for new components
npm run test -- GlassPopover GlassSegmentedControl GlassFab

# Existing glass behavior tests
npm run test -- rr-180  # Glass performance & accessibility
npm run test -- rr-206  # Responsive behavior

# Type checking
npm run type-check
```

**Manual Testing Checklist:**

- [ ] Touch targets ≥44×44px on mobile (iOS Safari)
- [ ] Focus rings visible on keyboard navigation
- [ ] Reduced transparency fallbacks work (`prefers-reduced-transparency`)
- [ ] No visual regressions in light/dark modes
- [ ] Hover/active states preserved across all components

### Phase B Testing (Violet Theme)

**Accessibility Validation:**

```bash
# Use browser dev tools contrast checker
# Verify AA compliance (4.5:1 for text, 3:1 for UI)
# Test focus ring visibility on both glass and solid backgrounds
```

**Cross-Platform Verification:**

- iOS Safari (primary target)
- Android Chrome (fallback behavior)
- Desktop Safari/Chrome/Firefox/Edge
- Test with `prefers-reduced-motion` and `prefers-reduced-transparency`

### Rollback Procedures

**Phase A Rollback:**

```bash
# If component migration causes issues
git checkout HEAD~1 -- src/components/ui/Glass*
git checkout HEAD~1 -- [files with component usage]
npm run test  # Verify rollback works
```

**Phase B Rollback:**

```bash
# If violet theme has issues
git checkout HEAD~1 -- src/app/globals.css
git checkout HEAD~1 -- src/styles/liquid-glass-button.css
# Keep component library improvements
```

## Developer Implementation Guide

### Pre-Implementation Setup

1. **Branch Strategy:**

```bash
# Work on dev branch directly (no feature branches)
git checkout dev
git pull origin dev
```

2. **Environment Validation:**

```bash
npm run type-check  # Must pass
npm run lint        # Must pass
npm run test        # Baseline test suite
```

### Implementation Order

**Week 1: Phase A (Component Library)**

- Day 1-2: Build core primitives with current colors
- Day 3-4: Migrate `.glass-popover`, `.glass-icon-btn`, `.glass-toolbar-btn`
- Day 5: Migrate segmented controls and floating buttons
- Ship Phase A

**Week 2: Phase B (Violet Theme)**

- Day 1: Update tokens in `globals.css`
- Day 1: Fix hardcoded colors in components and CSS files
- Day 2: Accessibility validation and refinements
- Ship Phase B

### Code Quality Requirements

**Component Standards:**

- All props must have TypeScript interfaces
- Include JSDoc comments for complex props
- Export CVA variants for composition
- Handle loading/disabled states appropriately
- Support `aria-` props passthrough

**CSS Standards:**

- Use semantic tokens only (`hsl(var(--primary))`)
- Never hardcode color values
- Include reduced-transparency fallbacks
- Single glass layer per element
- Performance-optimized animations (transform/opacity only)

### Common Implementation Patterns

**Glass Component Template:**

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassVariants = cva(
  // Base glass styles with current tokens
  "backdrop-blur-md bg-white/20 dark:bg-black/20 border border-white/30 dark:border-black/30",
  {
    variants: {
      variant: {
        default: "...",
        primary: "...",
        secondary: "...",
      },
    },
  }
);

interface GlassComponentProps extends VariantProps<typeof glassVariants> {
  // Component-specific props
}

export function GlassComponent({
  variant,
  className,
  ...props
}: GlassComponentProps) {
  return (
    <div className={cn(glassVariants({ variant }), className)} {...props} />
  );
}
```

**Reduced Transparency Fallback:**

```css
/* Include in all glass components */
@supports not (backdrop-filter: blur(1px)) {
  .glass-element {
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
  }
}

@media (prefers-reduced-transparency: reduce) {
  .glass-element {
    backdrop-filter: none;
    background: hsl(var(--background));
  }
}
```

## Summary

This restructured approach **prioritizes solving the technical debt problem first**, then applies the violet theme as a low-risk enhancement. The two-phase strategy enables:

1. **Immediate Value:** Fix regression issues with component centralization
2. **Reduced Risk:** Test structural changes before aesthetic ones
3. **Better QA:** Each phase has focused testing requirements
4. **Easier Rollback:** Can revert colors without losing component benefits

**Timeline:** ~2 weeks total (1 week per phase)
**Risk Level:** Low (decoupled concerns, incremental delivery)
**Maintenance Benefits:** Long-term reduction in UI regression issues

---

## Reference: Original Design Specifications

_The following sections contain detailed color and implementation specifications for reference during development._

### Violet Palette & Token Values

**Light Mode:**

- `--primary: 262 83% 67%` (Violet 500 #8b5cf6)
- `--primary-foreground: 0 0% 98%` (Near-white)
- `--accent: 262 100% 97%` (Violet 50 surface tint)
- `--accent-foreground: 262 66% 35%` (Violet 700 text)
- `--ring: 262 83% 67%` (Match primary)

**Dark Mode:**

- `--primary: 262 70% 72%` (Brighter Violet 400-450)
- `--primary-foreground: 240 6% 10%` (Near-black)
- `--accent: 262 40% 22%` (Deep violet surface)
- `--accent-foreground: 0 0% 98%` (Near-white)
- `--ring: 262 70% 65%` (Lighter ring)

### Design Principles

**Goals:**

- Tasteful Violet theme consistent with Apple aesthetics
- Maintain WCAG AA contrast across light/dark modes
- Preserve Liquid Glass hierarchy (floating controls, minimal solid fills)
- Minimize code churn via semantic tokens

**Liquid Glass Alignment:**

- Glass layers remain translucent neutrals
- Brand color used for interactive emphasis (buttons, links, focus rings)
- Hover/selected surfaces use brand tint at 6-12% alpha maximum
- Maintain 44px minimum touch targets
- Single glass layer per element (never stack)

### Status Colors & Charts

**Status Palette:**

- Success (Emerald): 500 #10b981, hover 600, surface 100-200
- Warning (Amber): 500 #f59e0b, hover 600, surface 100-200
- Error (Rose): 500 #f43f5e, hover 600, surface 100-200
- Info (Sky): 500 #0ea5e9, hover 600, surface 100-200

**Chart Colors:**

- `--chart-1: 262 83% 67%` (Violet)
- `--chart-2: 239 84% 67%` (Indigo)
- `--chart-3: 199 84% 55%` (Sky)
- `--chart-4: 43 84% 60%` (Amber)
- `--chart-5: 340 75% 60%` (Rose)
