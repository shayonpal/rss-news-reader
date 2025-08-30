# ADR-016: Violet Focus Ring Unification for Glass Components

- **Status:** Accepted
- **Date:** 2025-08-26
- **Issue:** RR-252 (Violet Focus Indicators for Glass Components)
- **Parent Issue:** RR-233 (Component Library Foundation Finalization)

## Context

During the violet theme rollout (RR-232) and component library foundation finalization (RR-233), an inconsistency was discovered in the focus ring colors across glass components. The GlassSegmentedControl component was still using blue-500 focus rings while other glass components (GlassButton, GlassInput) had been updated to use violet-500, creating visual inconsistency in the design system.

### Existing Implementation Issues

**Before RR-252:**

```typescript
// GlassSegmentedControl - Inconsistent blue focus
"focus-visible:ring-blue-500"; // ❌ Blue focus ring

// GlassButton - Violet focus (already updated)
"focus-visible:ring-violet-500"; // ✅ Violet focus ring

// GlassInput - Violet focus (already updated)
"focus-visible:ring-violet-500"; // ✅ Violet focus ring
```

**Problems:**

1. **Visual Inconsistency**: Mixed blue and violet focus indicators across glass components
2. **Brand Misalignment**: Blue focus rings conflicted with violet theme identity
3. **Design System Fragmentation**: Different focus styles violated unified design principles
4. **User Experience Issues**: Inconsistent focus feedback confused navigation patterns
5. **Accessibility Concerns**: Mixed focus colors could affect user expectations for keyboard navigation

### Component Library Foundation Context (RR-233)

RR-252 was identified as part of the broader component library foundation finalization initiative, which aimed to:

- Establish consistent visual patterns across all glass components
- Ensure proper violet theme integration throughout the component library
- Maintain accessibility standards while improving brand consistency
- Create a unified focus system for better user experience

## Decision

We will unify all glass component focus rings to use violet-500, achieving complete visual consistency across the glass component system while maintaining WCAG AA accessibility compliance.

### Implementation Approach

**GlassSegmentedControl Focus Ring Update:**

```typescript
// Before (RR-252)
const focusClasses = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-blue-500", // ❌ Blue
  "focus-visible:ring-offset-2",
].join(" ");

// After (RR-252)
const focusClasses = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-violet-500", // ✅ Violet
  "focus-visible:ring-offset-2",
].join(" ");
```

**Unified Focus System Achieved:**

- **GlassButton**: `focus-visible:ring-violet-500` ✅
- **GlassInput**: `focus-visible:ring-violet-500` ✅
- **GlassSegmentedControl**: `focus-visible:ring-violet-500` ✅ (RR-252)

**Key Features:**

- **Brand Consistency**: All glass components use violet-500 focus indicators
- **Accessibility Compliance**: Maintains WCAG AA contrast ratios (4.05:1 light, 4.22:1 dark)
- **Theme Integration**: Focus rings participate in the unified violet theme system
- **User Experience**: Consistent focus feedback across all interactive glass elements

## Consequences

### Positive

**Design System Benefits:**

- **Visual Consistency**: Unified violet focus indicators across all glass components
- **Brand Alignment**: Focus rings now reinforce the violet theme identity throughout the application
- **Design System Integrity**: Single focus color standard eliminates visual fragmentation
- **Component Library Maturity**: Establishes consistent patterns for future glass components

**User Experience Benefits:**

- **Predictable Navigation**: Users develop consistent expectations for focus behavior
- **Improved Accessibility**: Unified focus system reduces cognitive load for keyboard navigation
- **Brand Recognition**: Violet focus rings reinforce brand identity throughout user interactions
- **Professional Polish**: Consistent focus indicators contribute to overall application quality

**Developer Experience Benefits:**

- **Clear Standards**: Single focus ring color eliminates decision fatigue
- **Maintainable Code**: Consistent focus patterns reduce maintenance burden
- **Design System Documentation**: Clear examples of proper focus ring implementation
- **Pattern Reusability**: Established standard for future glass component development

**Technical Benefits:**

- **Accessibility Compliance**: Violet-500 meets WCAG AA contrast requirements
- **Performance**: No performance impact from color change
- **Browser Support**: Focus-visible widely supported in modern browsers
- **Theme Integration**: Focus rings participate in existing color token system

### Negative

**Migration Considerations:**

- **Visual Change**: Users may notice focus ring color change (minimal impact)
- **Testing Updates**: Existing tests needed updates to expect violet instead of blue
- **Documentation Sync**: Component documentation required updates for new focus colors
- **Design Review**: All glass components needed review to ensure consistent implementation

**Development Impact:**

- **Test Isolation Issues**: Discovered and resolved React Testing Library test isolation problems during implementation
- **Quality Assurance**: Required comprehensive testing across all glass components
- **Cross-Component Validation**: Needed to verify consistency across the entire glass component library

### Neutral

**Architectural Impact:**

- Reinforces the violet theme as the primary brand color system
- Establishes focus ring standards for future component development
- Demonstrates systematic approach to design system consistency

## Implementation Details

### Focus Ring Specification

**Color**: `violet-500` (`#8b5cf6`)

**Complete Focus Ring Classes:**

```typescript
const standardFocusRing = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-violet-500",
  "focus-visible:ring-offset-2",
].join(" ");
```

**Accessibility Validation:**

- **Light Mode Contrast**: 4.05:1 (WCAG AA ✅)
- **Dark Mode Contrast**: 4.22:1 (WCAG AA ✅)
- **Focus Visibility**: 2px ring with 2px offset ensures visibility
- **Color Blindness**: Violet distinguishable across common color vision deficiencies

### Components Updated

1. **GlassSegmentedControl** (Primary change in RR-252):
   - Updated focus ring from `blue-500` to `violet-500`
   - Applied to all button states within the control
   - Maintained existing keyboard navigation behavior

2. **ReadStatusFilter Enhancement** (Secondary improvement):
   - Enhanced filter controls with violet interaction feedback
   - Consistent visual branding across filter components
   - Improved user feedback for filter state changes

### Test Infrastructure Improvements

RR-252 implementation revealed and resolved React Testing Library test isolation issues:

**Problems Discovered:**

- "Found multiple elements" errors in test suites
- DOM pollution between test runs
- Inconsistent test results when run in suites vs individually

**Solutions Implemented:**

```typescript
// Enhanced test isolation pattern (RR-252)
beforeEach(() => {
  cleanup(); // Force cleanup before each test
  vi.clearAllMocks(); // Clear all mock state
});

afterEach(() => {
  cleanup(); // Force cleanup after each test
});
```

**Testing Guidance Established:**

- Use exact name selectors instead of regex patterns
- Implement double cleanup (before and after each test)
- Explicit unmounting in multi-state tests
- Clear all mocks to prevent state pollution

## Validation Criteria

### Success Metrics

1. **Visual Consistency**: All glass components display violet-500 focus rings ✅
2. **Accessibility Compliance**: Focus rings meet WCAG AA contrast requirements ✅
3. **Keyboard Navigation**: Focus rings appear on keyboard navigation ✅
4. **Theme Integration**: Focus colors align with violet theme palette ✅
5. **Test Reliability**: Test suites run consistently without isolation issues ✅

### Quality Assurance

**Functional Testing:**

- Keyboard navigation across all glass components verified
- Focus ring visibility tested in light and dark modes
- Screen reader compatibility confirmed
- Cross-browser focus behavior validated

**Visual Testing:**

- Focus ring color consistency verified across components
- Focus ring positioning and sizing confirmed
- Dark mode focus ring visibility validated
- High contrast mode compatibility tested

**Technical Testing:**

- CSS class generation verified for all components
- Test isolation improvements validated
- Performance impact assessed (none detected)
- Browser support confirmed across target browsers

## Alternative Approaches Considered

### Keep Mixed Focus Colors

**Rejected**: Would maintain visual inconsistency and violate design system principles

### Use Different Violet Shade

**Evaluated**: `violet-600` and `violet-400` tested but `violet-500` provided optimal contrast ratios

### Custom Focus Ring Colors per Component

**Rejected**: Would increase complexity and reduce visual consistency benefits

### Gradual Migration

**Rejected**: Partial fixes would prolong visual inconsistency period

## Future Considerations

### Focus System Extension

This violet focus ring standard establishes patterns for future components:

```typescript
// Standard focus ring for all interactive glass components
const GLASS_FOCUS_RING = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-violet-500",
  "focus-visible:ring-offset-2",
].join(" ");
```

### Design System Evolution

- **Component Library Growth**: New glass components should adopt violet focus rings by default
- **Theme Variants**: Future themes can override focus colors through CSS variable system
- **Focus Ring Enhancements**: Could extend to include different ring styles for different component types
- **Accessibility Features**: May add focus ring animations or enhanced contrast options

### Testing Infrastructure

The test isolation improvements implemented in RR-252 establish patterns for reliable testing:

- Template test files with proper cleanup patterns
- Code review checklist including test isolation verification
- Automated testing for component focus ring consistency
- Visual regression testing for focus ring appearance

## Related Work

- **RR-232**: Violet Theme Implementation (foundation for focus ring colors)
- **RR-233**: Component Library Foundation Finalization (parent initiative)
- **RR-251**: Ghost Button Violet Theme Integration (related theme consistency work)
- **ADR-014**: CSS Token Semantic Hierarchy (color system foundation)
- **ADR-015**: CSS Variables for Ghost Button Theme Integration (theme integration patterns)

## References

- [WCAG 2.1 Focus Visible Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [CSS :focus-visible Specification](https://www.w3.org/TR/selectors-4/#the-focus-visible-pseudo)
- [Tailwind CSS Focus Ring Utilities](https://tailwindcss.com/docs/ring-width)
- [Unified Liquid Glass System Documentation](../ui-ux/unified-liquid-glass-system.md#focus-ring-standards-rr-252)
- [Component Library Foundation Documentation](../features/component-library-foundation-finalization.md)
- [Known Issues: React Testing Library Test Isolation](../tech/known-issues.md#react-testing-library-test-isolation-issues-rr-252)
