# RR-193 Implementation Plan: Eliminate Nested Scrollbars with Mutex Accordion

## Overview

Complete implementation specification for eliminating nested scrollbars in the RSS reader sidebar through CSS Grid layout and mutex accordion behavior.

## Phase 1: Layout Foundation (2-3 hours)

### Task 1.1: Remove Nested Scrollable Containers

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Lines to modify**: 401, 603

**Current problematic code:**

```tsx
// Line 401 (Topics section)
<div className="scrollbar-hide max-h-[30vh] space-y-0.5 overflow-y-auto pl-6 pr-1">

// Line 603 (Feeds section)
<div className="scrollbar-hide max-h-[60vh] space-y-0.5 overflow-y-auto pl-6 pr-1">
```

**Replace with:**

```tsx
// Topics section - remove max-height and overflow constraints
<div className="space-y-0.5 pl-6 pr-1">

// Feeds section - remove max-height and overflow constraints
<div className="space-y-0.5 pl-6 pr-1">
```

### Task 1.2: Implement CSS Grid Main Container

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Line to modify**: ~264 (main container)

**Current:**

```tsx
<div className="relative flex-1 overflow-y-auto" ref={scrollContainerRef}>
```

**Replace with:**

```tsx
<div
  className="relative flex-1 overflow-y-auto grid grid-rows-[auto_1fr]"
  ref={scrollContainerRef}
  data-testid="sidebar-main-container"
>
```

### Task 1.3: Reverse Section Order (Feeds above Topics)

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Sections to reorder**: Move Feeds section JSX above Topics section JSX

**Implementation**: Cut the entire Feeds section (Collapsible component) and paste it above the Topics section in the JSX return statement.

## Phase 2: Mutex Accordion Logic (2-3 hours)

### Task 2.1: Extend UI Store Interface

**File**: `src/lib/stores/ui-store.ts`
**Section**: UIState interface

**Add to UIState interface:**

```tsx
// Mutex accordion state (session-only, not persisted)
mutexSection: 'feeds' | 'tags' | null;
setMutexSection: (section: 'feeds' | 'tags' | null) => void;
resetMutexState: () => void;
```

### Task 2.2: Update Store Implementation

**File**: `src/lib/stores/ui-store.ts`
**Section**: useUIStore implementation

**Add to store implementation:**

```tsx
// Mutex accordion (session-only, not persisted)
mutexSection: 'tags', // Default: Topics open
setMutexSection: (section) => set({ mutexSection: section }),
resetMutexState: () => set({
  mutexSection: 'tags', // Default state
  feedsSectionCollapsed: true, // Feeds closed by default
  tagsSectionCollapsed: false, // Topics open by default
}),

// Update existing toggle methods to implement mutex behavior
toggleFeedsSection: () =>
  set((state) => {
    const newCollapsed = !state.feedsSectionCollapsed;
    return {
      feedsSectionCollapsed: newCollapsed,
      // Mutex logic: if opening feeds, close topics
      tagsSectionCollapsed: newCollapsed ? state.tagsSectionCollapsed : true,
      mutexSection: newCollapsed ? null : 'feeds',
    };
  }),

toggleTagsSection: () =>
  set((state) => {
    const newCollapsed = !state.tagsSectionCollapsed;
    return {
      tagsSectionCollapsed: newCollapsed,
      // Mutex logic: if opening topics, close feeds
      feedsSectionCollapsed: newCollapsed ? state.feedsSectionCollapsed : true,
      mutexSection: newCollapsed ? null : 'tags',
    };
  }),
```

### Task 2.3: Update Default State Initialization

**File**: `src/lib/stores/ui-store.ts`
**Section**: Store initialization

**Modify default values:**

```tsx
// Collapsible Sections (session-only, not persisted)
feedsSectionCollapsed: true,  // Changed from false - Feeds closed by default
tagsSectionCollapsed: false,  // Topics open by default (unchanged)
```

## Phase 3: Mobile Optimization (2-3 hours)

### Task 3.1: Add Test IDs for Component Testing

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Add data-testid attributes to key elements:**

```tsx
// Main container
data-testid="sidebar-main-container"

// Section containers
data-testid="feeds-section"
data-testid="topics-section"

// Scrollable content areas
data-testid="feeds-scrollable-section"
data-testid="topics-scrollable-section"

// Collapsible triggers
data-testid="feeds-collapsible-trigger"
data-testid="topics-collapsible-trigger"

// Sidebar toggle button (if not already present)
data-testid="sidebar-toggle-button"

// Backdrop for mobile
data-testid="sidebar-backdrop"
```

### Task 3.2: Enhance Mobile Responsive Styles

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Update sidebar container classes for full-width mobile overlay**

## Phase 4: Edge Cases & Polish (2-3 hours)

### Task 4.1: Implement Empty State Messages

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Add conditional rendering for empty states:**

```tsx
// For empty feeds list
{feeds.length === 0 ? (
  <div className="px-6 py-4 text-sm text-muted-foreground">
    No feeds available
  </div>
) : (
  // Existing feeds rendering
)}

// For empty topics list
{tags.length === 0 ? (
  <div className="px-6 py-4 text-sm text-muted-foreground">
    No topics available
  </div>
) : (
  // Existing topics rendering
)}
```

### Task 4.2: Apply Text Truncation with Line Clamp

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Update feed and tag title styles:**

```tsx
// Feed titles
className = "line-clamp-2 text-sm font-medium";

// Tag titles
className = "line-clamp-2 text-sm font-medium";
```

### Task 4.3: Remove Hover Behaviors (Touch-First Design)

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Remove any hover-related classes like:**

- `hover:line-clamp-none`
- `hover:whitespace-normal`
- Any hover state that expands truncated text

## Implementation File Summary

### Files to Modify:

1. **`src/components/feeds/simple-feed-sidebar.tsx`** (Primary changes)
   - Remove nested scrollable containers (lines 401, 603)
   - Implement CSS Grid layout
   - Reverse section order (Feeds above Topics)
   - Add test IDs for testing
   - Implement empty state messages
   - Apply line-clamp text truncation

2. **`src/lib/stores/ui-store.ts`** (State management)
   - Extend UIState interface with mutex properties
   - Implement mutex logic in toggle functions
   - Set proper default state (Topics open, Feeds closed)
   - Add resetMutexState function

### Test Files Created:

1. **`src/__tests__/unit/rr-193-mutex-accordion.test.tsx`** - Unit tests for mutex logic
2. **`src/__tests__/integration/rr-193-scroll-elimination.test.tsx`** - Integration tests for layout
3. **`src/__tests__/e2e/rr-193-mobile-sidebar-overlay.test.ts`** - E2E mobile behavior tests
4. **`src/__tests__/performance/rr-193-css-grid-performance.test.ts`** - Performance validation

## Success Criteria Verification

### Technical Requirements:

- [ ] Only main sidebar container scrolls (no nested scrollbars)
- [ ] Mutex behavior: Topics OR Feeds open, never both
- [ ] Default state: Topics open, Feeds closed on every load
- [ ] Feeds section positioned above Topics section
- [ ] CSS Grid layout with `grid-template-rows: auto 1fr`
- [ ] No persistence of accordion state (session-only)

### UX Requirements:

- [ ] Mobile: Full-width sidebar overlay
- [ ] Empty states: "No feeds/topics available"
- [ ] Long names truncated to 2 lines with line-clamp
- [ ] No hover expansions (touch-first)
- [ ] Works across all viewport sizes
- [ ] 60fps animation performance

### Test Coverage:

- [ ] All unit tests pass (mutex accordion logic)
- [ ] All integration tests pass (layout and rendering)
- [ ] All E2E tests pass (mobile behavior)
- [ ] All performance tests pass (60fps, no memory leaks)

## Risk Mitigation

### Low-Risk Approach:

- Building on proven RR-146 and RR-206 foundation
- CSS-first solution (no complex JavaScript)
- Incremental changes with extensive testing
- Backwards compatible state management

### Rollback Plan:

- Git branch: `shayon/rr-193-eliminate-nested-scrollbars-in-sidebar-with-mutex-accordion`
- Each phase can be rolled back independently
- Original nested scrolling behavior preserved in git history

## Estimated Timeline: 8-12 hours across 4 phases

- Phase 1: 2-3 hours (Layout Foundation)
- Phase 2: 2-3 hours (Mutex Logic)
- Phase 3: 2-3 hours (Mobile Optimization)
- Phase 4: 2-3 hours (Edge Cases & Polish)

Ready for implementation with `flow-execute` command.
