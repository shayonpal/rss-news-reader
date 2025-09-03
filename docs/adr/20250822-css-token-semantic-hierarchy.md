# ADR-014: Implement CSS Token Semantic Hierarchy for Violet Theme Preparation

- **Status:** Accepted
- **Date:** 2025-08-22
- **Issue:** RR-231 (Foundation Finalization)

## Context

The application's CSS token system was fragmented across 46+ scattered variables with direct property assignments and no semantic abstraction. This approach created several challenges:

1. **Theme Implementation Difficulty**: Adding violet theme required manual overrides for each variable
2. **Maintenance Complexity**: Changes to visual properties required updates across multiple unrelated variables
3. **Inconsistent Naming**: Variables mixed physical properties with design intent (e.g., `--glass-blur` vs `--glass-nav-bg`)
4. **Scaling Limitations**: No systematic approach for adding new themes or variants
5. **Developer Experience**: Unclear which variables to use for specific design intentions

With the upcoming Violet Theme Rollout (RR-232-234), a systematic token architecture was needed to enable efficient theme switching and long-term maintainability.

## Decision

We will implement a three-tier CSS token semantic hierarchy following industry-standard design token patterns:

### 1. Reference Tokens (Tier 1)

**Purpose**: Physical properties and base values - the raw materials

```css
/* Physical properties - the foundation */
--glass-blur-base: 16px;
--glass-blur-enhanced: 20px;
--glass-opacity-base: 0.35;
--glass-opacity-enhanced: 0.55;
--glass-border-light: 0.08;
--glass-border-enhanced: 0.12;
```

### 2. Semantic Tokens (Tier 2)

**Purpose**: Design intent and meaning - what the values represent

```css
/* Design intent - semantic meaning */
--color-surface-glass: rgba(255, 255, 255, var(--glass-opacity-enhanced));
--color-surface-glass-hover: rgba(255, 255, 255, var(--glass-opacity-hover));
--color-border-glass: rgba(0, 0, 0, var(--glass-border-light));
--color-border-glass-enhanced: rgba(0, 0, 0, var(--glass-border-enhanced));
```

### 3. Component Tokens (Tier 3)

**Purpose**: Legacy API compatibility - maintains existing interfaces

```css
/* Legacy bridge - maintains existing component API */
--glass-nav-bg: var(--color-surface-glass);
--glass-nav-border: var(--color-border-glass);
--glass-chip-bg: var(--color-surface-glass);
--glass-enhanced-bg: var(--color-surface-glass);
```

### Theme Implementation Strategy

**Violet Theme**: Override only reference tokens, semantic and component tokens inherit automatically

```css
[data-theme-violet] {
  /* Reference token adjustments for violet */
  --glass-opacity-enhanced: 0.45; /* Reduced for color visibility */
  --glass-saturation-base: 200%; /* Enhanced for violet richness */

  /* Semantic tokens automatically become violet */
  /* Component tokens maintain API compatibility */
}
```

## Consequences

### Positive

**Theme System Benefits:**

- **Efficient Theme Switching**: Violet theme requires only reference token overrides (~6 variables vs 46+)
- **Consistent Theme Application**: Semantic tokens ensure design intent is preserved across themes
- **Scalable Architecture**: Additional themes (e.g., blue, green) follow the same pattern
- **Maintainable Overrides**: Theme changes happen at the reference level, not scattered throughout

**Developer Experience Benefits:**

- **Clear Token Purpose**: Three-tier hierarchy makes token intent explicit
- **Semantic Naming**: `--color-surface-glass` is clearer than `--glass-nav-bg-something`
- **Safe Refactoring**: Component tokens provide stable API during migration
- **Type Safety**: Semantic structure enables better tooling and validation

**Technical Benefits:**

- **Performance**: No runtime calculation overhead, pure CSS custom properties
- **Compatibility**: Legacy component API prevents breaking changes during migration
- **Documentation**: Self-documenting token names improve code comprehension
- **Testing**: Semantic tokens enable better visual regression testing

### Negative

**Implementation Complexity:**

- **Migration Overhead**: Requires careful migration from 46+ scattered variables
- **Learning Curve**: Developers must understand three-tier hierarchy
- **Initial Setup**: More complex initial token definition process
- **Browser Support**: CSS custom properties not supported in very old browsers (IE11-)

**Maintenance Considerations:**

- **Token Discipline**: Requires maintaining semantic boundaries between tiers
- **Documentation Overhead**: Three-tier system requires comprehensive documentation
- **Migration Risk**: Incorrect token mapping could introduce visual regressions

### Neutral

**Architectural Impact:**

- Establishes formal design token system that guides all future UI development
- Creates foundation for design system scaling beyond glass components
- Aligns with industry standards (Design Tokens Community Group specification)
- Prepares architecture for potential design system extraction/sharing

## Implementation Details

### Token Organization

**File Structure:**

```
src/app/globals.css
├── Reference Tokens (Tier 1)
│   ├── Physical properties
│   └── Base values
├── Semantic Tokens (Tier 2)
│   ├── Color definitions
│   └── Design intent mapping
└── Component Tokens (Tier 3)
    ├── Legacy API bridge
    └── Compatibility layer
```

### Migration Strategy

1. **Phase 1**: Implement reference and semantic tokens
2. **Phase 2**: Map existing component tokens to semantic tokens
3. **Phase 3**: Validate visual consistency across application
4. **Phase 4**: Enable violet theme through reference token overrides

### Token Naming Conventions

**Reference Tokens**: `--{property}-{variant}`

- `--glass-opacity-base`, `--glass-blur-enhanced`

**Semantic Tokens**: `--color-{role}-{element}-{state?}`

- `--color-surface-glass`, `--color-border-glass-enhanced`

**Component Tokens**: `--{component}-{property}`

- `--glass-nav-bg`, `--glass-chip-border`

## Validation Criteria

### Success Metrics

1. **Violet Theme Implementation**: Should require ≤10 reference token overrides
2. **Visual Consistency**: No visual regressions during token migration
3. **API Compatibility**: Existing components continue working without changes
4. **Performance**: No measurable performance impact from token hierarchy
5. **Documentation**: Complete token taxonomy and usage guidelines

### Risk Mitigation

**Visual Regression Prevention:**

- Comprehensive visual testing during migration
- Component-by-component validation process
- Staged rollout with feature flags if needed

**Performance Monitoring:**

- CSS bundle size analysis before/after migration
- Runtime performance profiling
- Memory usage validation

**Developer Experience Validation:**

- Documentation completeness review
- Team training on three-tier hierarchy
- Migration tooling for existing code

## Alternative Approaches Considered

### Flat Token System

**Rejected**: Would not scale for multi-theme support and lacks semantic organization

### CSS-in-JS Tokens

**Rejected**: Runtime performance overhead and complexity for this use case

### Separate Theme Files

**Rejected**: Would duplicate token definitions and complicate maintenance

### Design Token Tools (Style Dictionary, etc.)

**Deferred**: Adds build complexity without immediate value for single-application use case

## Future Considerations

### Design System Evolution

- Token hierarchy prepares for potential design system extraction
- Semantic tokens enable cross-platform design token sharing
- Foundation ready for design token automation tools

### Theme Expansion

- Blue theme: `--color-primary-blue: #3b82f6`
- Green theme: `--color-primary-green: #10b981`
- Dark mode variations: Enhanced semantic token dark mode support

### Tooling Integration

- CSS custom property IntelliSense/autocomplete
- Design token validation and linting
- Visual regression testing integration

## Related Work

- **RR-229**: Core glass primitives using basic token system
- **RR-230**: CSS-to-component migration requiring token consistency
- **RR-231**: Foundation finalization implementing semantic hierarchy
- **RR-232-234**: Violet theme rollout phases leveraging semantic tokens

## References

- [Design Tokens Community Group W3C Specification](https://design-tokens.github.io/community-group/format/)
- [Material Design Token System](https://m3.material.io/foundations/design-tokens/overview)
- [CSS Custom Properties for Cascading Variables](https://www.w3.org/TR/css-variables-1/)
- [Component Library Foundation Finalization Documentation](../features/component-library-foundation-finalization.md)
