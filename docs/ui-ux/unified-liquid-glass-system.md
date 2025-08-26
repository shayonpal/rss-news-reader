# Unified Liquid Glass System

## Overview

The Unified Liquid Glass System represents the culmination of iOS 26 liquid glass implementation across the RSS News Reader application, achieving complete design consistency through master CSS variables and single-source depth control. This system was finalized in RR-232 and builds upon the foundations established in RR-224 and RR-230.

**Key Achievement**: Complete visual harmony across all glass components with master depth control and two-tier hierarchy system.

## Architecture Summary

### Single-Source Master Control

The unified system is governed by master CSS variables that control depth and appearance across all glass components. The latest implementation uses a streamlined single-source opacity system:

```css
/* Brand Color (Single Source) */
--brand-accent-rgb: 139, 92, 246; /* violet-500 */

/* Glass Opacity System (Single Source) */
--glass-surface-opacity: 0.03;
--glass-surface-hover-opacity: 0.08;
--glass-surface-subtle-opacity: 0.02;
--glass-border-opacity: 0.1;
--glass-border-enhanced-opacity: 0.15;

/* Master depth shadow (3-layer Apple iOS 26 specification) */
--glass-depth-shadow:
  0 8px 32px rgba(0, 0, 0, 0.12),
  /* Ambient shadow */ 0 2px 8px rgba(0, 0, 0, 0.04),
  /* Key shadow */ inset 0 1px 1px rgba(255, 255, 255, 0.25); /* Glass highlight */

/* Secondary depth (75% intensity for toolbars) */
--glass-depth-shadow-secondary:
  0 6px 24px rgba(0, 0, 0, 0.09),
  /* Reduced ambient */ 0 1px 6px rgba(0, 0, 0, 0.03),
  /* Reduced key */ inset 0 1px 1px rgba(255, 255, 255, 0.19); /* Reduced highlight */
```

### Two-Tier Hierarchy

The system implements a clear hierarchy for different UI element types:

- **Primary Depth** (`liquid-glass-primary`): For segmented controls, individual buttons, and standalone elements
- **Secondary Depth** (`liquid-glass-secondary`): For toolbars, button clusters, and container elements

## CSS Class Reference

### Core Unified Classes

#### `.liquid-glass-primary`

Used for individual controls and primary interactive elements.

```css
.liquid-glass-primary {
  /* Single-source glass implementation with fallbacks */
  background-color: rgb(
    var(--brand-accent-rgb, 139 92 246) / var(--glass-surface-opacity, 0.03)
  );
  border: 1px solid
    rgb(var(--brand-accent-rgb, 139 92 246) / var(--glass-border-opacity, 0.1));
  border-radius: 9999px; /* Fully rounded */
  box-shadow: var(--glass-depth-shadow);
  backdrop-filter: var(--glass-blur-effect);
  -webkit-backdrop-filter: var(--glass-blur-effect);
  transition: all 200ms var(--motion-smooth);
}

.liquid-glass-primary:hover:not(:disabled) {
  background-color: rgb(
    var(--brand-accent-rgb, 139 92 246) /
      var(--glass-surface-hover-opacity, 0.08)
  );
}
```

**Usage Examples**:

- Segmented control segments (`.glass-segment`)
- Mark All Read button (`.liquid-glass-mark-all-read`)
- Individual action buttons

#### `.liquid-glass-secondary`

Used for containers, toolbars, and clustered elements.

```css
.liquid-glass-secondary {
  /* Single-source glass implementation for containers/toolbars */
  background-color: rgb(
    var(--brand-accent-rgb, 139 92 246) / var(--glass-surface-opacity, 0.03)
  );
  border: 1px solid
    rgb(var(--brand-accent-rgb, 139 92 246) / var(--glass-border-opacity, 0.1));
  border-radius: 22px; /* Less rounded for containers */
  box-shadow: var(--glass-depth-shadow-secondary);
  backdrop-filter: var(--glass-blur-effect);
  -webkit-backdrop-filter: var(--glass-blur-effect);
  transition: all 200ms var(--motion-smooth);
}
```

**Usage Examples**:

- Toolbar containers (`.glass-toolbar`)
- Button clusters
- Navigation containers

## Component Mapping Table

### Article Listing Page Components

| UI Element                                   | Implementation          | Hierarchy Level | CSS Classes                                             |
| -------------------------------------------- | ----------------------- | --------------- | ------------------------------------------------------- |
| **1.1 Hamburger Menu**                       | `GlassIconButton`       | **Primary**     | `.liquid-glass-primary`                                 |
| **1.2 Segmented Controls (All/Unread/Read)** | `GlassSegmentedControl` | **Primary**     | `.glass-segment` → `.liquid-glass-primary`              |
| **1.3 Mark All Read** (3 size variants)      | Custom button component | **Primary**     | `.liquid-glass-mark-all-read` → `.liquid-glass-primary` |

### Article Detail Page Components

| UI Element                                             | Implementation       | Hierarchy Level | CSS Classes                                  |
| ------------------------------------------------------ | -------------------- | --------------- | -------------------------------------------- |
| **2.1 Back Button**                                    | `GlassIconButton`    | **Primary**     | `.liquid-glass-primary`                      |
| **2.2 Combined Cluster Container**                     | `MorphingDropdown`   | **Secondary**   | `.glass-toolbar` → `.liquid-glass-secondary` |
| **2.2.1 Star Button** (within cluster)                 | `StarButton`         | **Transparent** | `.glass-toolbar-btn` (inherits parent glass) |
| **2.2.2 Summarize/Re-summarize** (within cluster)      | `SummaryButton`      | **Transparent** | `.glass-toolbar-btn` (inherits parent glass) |
| **2.2.3 Fetch Full Content/Re-fetch** (within cluster) | `FetchContentButton` | **Transparent** | `.glass-toolbar-btn` (inherits parent glass) |
| **2.2.4 More Menu** (within cluster)                   | `DropdownMenu`       | **Transparent** | `.glass-toolbar-btn` (inherits parent glass) |

### Implementation Pattern

The system follows a **"glass container + transparent children"** architecture:

- **Containers**: Apply glass effects (blur, saturation, shadows)
- **Children**: Remain transparent, inherit parent glass properties
- **Height Standardization**: All components use semantic height tokens:
  - `--control-height-external: 56px` for outer component dimensions
  - `--control-height-internal: 48px` for buttons inside containers
  - `--container-pad-block: 4px` for computed container padding (centers 48px inside 56px)

## Master Control Variables

### Single-Source Depth Control

The unified system provides single-source control for all glass effects. To globally adjust depth (example: 10% more intensity):

```css
:root {
  /* Increase ambient shadows by 10% */
  --glass-depth-shadow:
    0 8px 32px rgba(0, 0, 0, 0.132),
    /* 0.12 + 10% = 0.132 */ 0 2px 8px rgba(0, 0, 0, 0.044),
    /* 0.04 + 10% = 0.044 */ inset 0 1px 1px rgba(255, 255, 255, 0.275); /* 0.25 + 10% = 0.275 */
}
```

### Core Variable System

```css
:root {
  /* Semantic Height Tokens */
  --control-height-external: 56px; /* All external component heights */
  --control-height-internal: 48px; /* Buttons inside containers */
  --container-pad-block: calc(
    (var(--control-height-external) - var(--control-height-internal)) / 2
  ); /* 4px */

  /* Legacy Alias (maintains compatibility) */
  --glass-control-height: var(--control-height-external);

  /* Brand Color (Single Source) */
  --brand-accent-rgb: 139, 92, 246; /* violet-500 */

  /* Glass Opacity System (Single Source) */
  --glass-surface-opacity: 0.03;
  --glass-surface-hover-opacity: 0.08;
  --glass-surface-subtle-opacity: 0.02;
  --glass-border-opacity: 0.1;
  --glass-border-enhanced-opacity: 0.15;

  /* Master Glass Effects */
  --glass-blur-effect: blur(var(--glass-blur)) saturate(var(--glass-saturation));

  /* Animation Curves */
  --glass-spring-timing: cubic-bezier(0.34, 1.56, 0.64, 1);
  --motion-smooth: cubic-bezier(0.4, 0, 0.2, 1);

  /* Ghost Button Theme Variables (RR-251) */
  --ghost-text-light: rgb(var(--violet-700-rgb)); /* rgb(109, 40, 217) */
  --ghost-text-dark: rgb(255 255 255); /* white for dark mode readability */
}

:root.dark {
  /* Dark Mode Opacity Adjustments (Single Source Changes) */
  --glass-surface-opacity: 0.05;
  --glass-surface-hover-opacity: 0.12;
  --glass-surface-subtle-opacity: 0.03;
  --glass-border-opacity: 0.15;
  --glass-border-enhanced-opacity: 0.25;
}
```

## Counter Styling System

### OKLCH Color Implementation

The unified system includes optimized counter styling for dark mode visibility:

```css
:root {
  /* Light mode counter colors */
  --counter-unselected-bg: hsl(var(--primary) / 0.1);
  --counter-unselected-text: hsl(var(--primary));
  --counter-selected-bg: hsl(var(--primary));
  --counter-selected-text: hsl(var(--primary-foreground));
}

:root.dark {
  /* Dark mode - enhanced OKLCH-based colors */
  --counter-unselected-bg: oklch(0.2 0.05 280 / 0.2);
  --counter-unselected-text: oklch(0.75 0.15 280);
  --counter-selected-bg: oklch(0.6 0.25 280);
  --counter-selected-text: oklch(0.95 0.02 280);
}
```

### Theme-Agnostic Bold Styling

Counter selection uses bold styling that works across all themes:

```css
.counter-selected {
  font-weight: 600;
  background: var(--counter-selected-bg);
  color: var(--counter-selected-text);
}

.counter-unselected {
  font-weight: 400;
  background: var(--counter-unselected-bg);
  color: var(--counter-unselected-text);
}
```

## Ghost Button Variant (RR-251)

The ghost button variant represents a transparent, minimalist button style integrated with the violet theme system. This implementation demonstrates the flexible CSS variable approach for theme-aware component styling.

### CSS Variable Implementation

```css
/* Ghost Button Theme Variables */
--ghost-text-light: rgb(var(--violet-700-rgb)); /* rgb(109, 40, 217) */
--ghost-text-dark: rgb(255 255 255); /* white for dark mode readability */
```

### Component Integration

The ghost variant is implemented in the `GlassButton` component using CSS variables for responsive theme switching:

```typescript
// In glass-button.tsx - Ghost variant implementation
ghost: [
  "backdrop-blur-[16px] backdrop-saturate-[180%]",
  "border-transparent",
  "bg-transparent",
  "text-[color:var(--ghost-text-light)] dark:text-[color:var(--ghost-text-dark)]",
  "hover:bg-white/35 dark:hover:bg-white/35",
  "hover:border-white/18 dark:hover:border-white/18",
].join(" ")
```

### Usage Examples

**Article Navigation Controls**:
```tsx
<GlassButton variant="ghost" onClick={() => onNavigate("prev")}>
  <ChevronLeft className="h-4 w-4" />
  Previous
</GlassButton>
```

**Key Features**:
- ✅ **Theme Responsive**: Automatically switches colors based on light/dark mode
- ✅ **CSS Variable Based**: Uses `--ghost-text-light` and `--ghost-text-dark` for consistency
- ✅ **Transparent Background**: Maintains glass aesthetic while providing text contrast
- ✅ **Touch Optimized**: Includes `touchAction: "manipulation"` for iOS PWA compatibility

### Testing Considerations

Due to jsdom limitations in test environments, ghost button testing uses a layered approach:

1. **Class Application Tests**: Verify CSS variable classes are correctly applied
2. **Mocked Resolution Tests**: Use `getComputedStyle` mocks to simulate color resolution
3. **E2E Visual Tests**: Validate actual color rendering in browser environment

**Reference**: See `docs/tech/known-issues.md` for detailed testing limitations and workarounds.

## Recent Changes and Evolution

### Height Unification Completion (RR-232 - August 2025)

**CSS Variable Architecture Overhaul**:

The system was completely restructured to use a single-source opacity system for better maintainability and consistency:

**Before**: Complex variable chains with multiple indirection levels

```css
--glass-surface: var(--glass-chip-bg);
--glass-border-style: 1px solid var(--glass-nav-border);
```

**After**: Direct RGB with opacity tokens for cleaner implementation

```css
background-color: rgb(
  var(--brand-accent-rgb, 139 92 246) / var(--glass-surface-opacity, 0.03)
);
border: 1px solid
  rgb(var(--brand-accent-rgb, 139 92 246) / var(--glass-border-opacity, 0.1));
```

**Semantic Height System**:

Replaced fixed 48px height with semantic tokens that support both standalone components and container-based layouts:

- **External Height**: 56px for all component outer dimensions
- **Internal Height**: 48px for buttons inside containers
- **Computed Padding**: 4px (calculated) to center internal elements

**Component Updates**:

- **Mark All Read Button**: Moved to @layer components, uses @apply liquid-glass-primary
- **GlassIconButton**: Updated "liquid-glass" variant to use CSS class instead of Tailwind utilities
- **MorphingDropdown**: Added .more-trigger class, updated positioning logic
- **Container Components**: Now use computed padding for perfect internal button centering

### Component Archival (RR-232)

**Archived Components**:

- `FeedTreeItem` → `archived-components/FeedTreeItem.tsx`
- `FeedList` → `archived-components/FeedList.tsx`

**Reason**: Legacy hierarchical feed components were unused in the current flat sidebar implementation and caused developer confusion during violet theme implementation.

### CSS Cascade Fixes

**Issue Resolved**: CSS cascade specificity problems with dark mode selectors.

**Solution Applied**: Enhanced specificity with `:root.dark` selectors:

```css
/* Before - insufficient specificity */
.dark .glass-component {
  background: var(--glass-surface-dark);
}

/* After - correct specificity */
:root.dark .glass-component {
  background: var(--glass-surface-dark);
}
```

### Tailwind Safelist Configuration

**Issue**: Tailwind was not compiling CSS variable utilities used in glass components.

**Solution**: Added comprehensive safelist to `tailwind.config.js`:

```javascript
module.exports = {
  safelist: [
    // CSS variable utilities for glass system
    "bg-[var(--glass-surface)]",
    "border-[var(--glass-nav-border)]",
    "shadow-[var(--glass-depth-shadow)]",
    // Additional CSS variable patterns...
  ],
};
```

### Expert Consultation Process

The RR-232 implementation involved comprehensive expert consultation:

1. **CSS Expert**: Resolved cascade specificity and variable compilation issues
2. **Tailwind Expert**: Configured safelist for CSS variable utilities
3. **UI Expert**: Validated visual consistency across all glass components
4. **Testing Expert**: Verified no regressions in existing functionality

## Implementation Guidelines

### For New Glass Components

1. **Always use base classes**: Start with `.liquid-glass-primary` or `.liquid-glass-secondary`
2. **Follow hierarchy**: Primary for individual controls, secondary for containers
3. **Use CSS variables**: Never hardcode depth or color values
4. **Test across themes**: Verify appearance in both light and dark modes
5. **Maintain performance**: Use `transform` and `opacity` for animations

### CSS Pattern Example

```css
/* Correct - uses unified system */
.new-glass-component {
  /* Extend base class */
  @apply liquid-glass-primary;

  /* Add component-specific properties */
  padding: 0 16px;
  height: var(--glass-control-height);
}

/* Incorrect - hardcoded values */
.new-glass-component {
  background: rgba(255, 255, 255, 0.35);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
```

### Responsive Considerations

All glass components should follow mobile-first responsive patterns:

```css
.glass-component {
  /* Mobile base styles */
  min-width: var(--glass-control-height);
}

@media (min-width: 768px) {
  .glass-component {
    /* Desktop enhancements */
    min-width: 140px;
  }

  .glass-component:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--glass-depth-shadow-enhanced);
  }
}
```

## Integration with Existing Systems

### Violet Theme Integration

The unified glass system is fully integrated with the violet theme:

- All glass surfaces use violet-derived colors
- Counters use OKLCH-optimized violet tints for better dark mode visibility
- Primary action colors maintain violet branding (`hsl(var(--primary))`)

### Performance Optimizations

```css
.unified-glass-component {
  /* GPU acceleration */
  transform: translateZ(0);
  will-change: transform, background-color;

  /* Optimized transitions */
  transition: all 200ms var(--motion-smooth);
}
```

### Accessibility Compliance

All unified glass components maintain accessibility standards:

```css
.glass-component:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .glass-component {
    transition: none;
    animation: none;
  }
}
```

## Quality Validation Checklist

### Visual Consistency

- [ ] All components use unified depth variables
- [ ] Primary/secondary hierarchy is correctly applied
- [ ] Glass effects use consistent blur and saturation values
- [ ] Counter styling works across all themes

### Functional Requirements

- [ ] Hover states work correctly on desktop
- [ ] Touch interactions are optimized for mobile
- [ ] Transitions are smooth (200ms timing)
- [ ] Dark mode theming is consistent

### Performance Validation

- [ ] No layout shifts during transitions
- [ ] Smooth 60fps animations maintained
- [ ] GPU acceleration properly applied
- [ ] Memory usage remains stable

## Browser Support

### Full Glass Effect Support

- Chrome 76+ (backdrop-filter)
- Safari 14+
- Firefox 103+
- Edge 79+

### Fallback Behavior

Components gracefully degrade to solid backgrounds in unsupported browsers through CSS feature queries:

```css
@supports not (backdrop-filter: blur(1px)) {
  .liquid-glass-unified {
    background: var(--glass-surface-opaque);
  }
}
```

## Future Maintenance

### Global Depth Adjustments

To modify glass depth across the entire application:

1. **Update master variables**: Modify only `--glass-depth-shadow` and `--glass-depth-shadow-secondary`
2. **Maintain proportions**: Keep 75% ratio between primary and secondary depths
3. **Test thoroughly**: Verify changes across all glass components
4. **Document changes**: Update this documentation with new values

### Adding New Glass Variants

When adding new glass component types:

1. **Extend existing classes**: Build on `.liquid-glass-primary` or `.liquid-glass-secondary`
2. **Use CSS variables**: Maintain single-source control
3. **Follow naming conventions**: Use descriptive, component-specific class names
4. **Update documentation**: Add new components to the mapping table

### Performance Monitoring

Monitor glass system performance for:

- **Memory usage**: Excessive backdrop-filter can impact performance
- **Frame rate**: Ensure smooth animations across devices
- **Battery usage**: Glass effects increase power consumption on mobile
- **Loading times**: Too many glass elements can slow initial render

## Related Documentation

- [RR-224 Liquid Glass Unification Implementation](../tech/rr-224-liquid-glass-unification.md) - Technical implementation details
- [Liquid Glass Design System](./liquid-glass-design-system.md) - Design principles and component architecture
- [Glass Components API](./glass-components-api.md) - Component interfaces and usage
- [Component Library Foundation Finalization](../features/component-library-foundation-finalization.md) - RR-230 component migration details
- [iOS 26 Design Patterns](../dev/ios-26-patterns.md) - iOS 26 implementation patterns

## Changelog References

This unified system represents the culmination of several major implementations:

- **RR-224**: Transparency unification and enhanced glass effects
- **RR-230**: Component-based architecture migration
- **RR-231**: Foundation finalization with TypeScript interfaces
- **RR-232**: Final unification with master variables and depth control

For detailed change history, see the [project CHANGELOG.md](../../CHANGELOG.md).
