# RR-288 Test Design Handoff

## Issue: Implement toast notifications and loading states for settings form

**Test Design Date**: 2025-09-10
**Issue Status**: In Progress
**Test Coverage**: Comprehensive (4 test files, 1,922 lines)

## Test Files Created

### 1. Unit Tests - usePreferencesForm Hook

**File**: `src/__tests__/unit/hooks/usePreferencesForm.test.tsx`
**Lines**: 363
**Coverage**:

- Toast notification integration with Sonner library
- Success toast with "Preferences saved" message
- Error toast with "Couldn't save preferences. Please retry." message
- Loading state management during save
- Button text changes to "Saving..."
- Spinner animation with animate-spin class
- Button disabled state during operation
- Concurrent operation handling
- Mobile performance requirements (<3s)

### 2. Unit Tests - ArticleStats Component

**File**: `src/__tests__/unit/components/settings/article-stats.test.tsx`
**Lines**: 474
**Coverage**:

- Skeleton loading with animate-pulse class
- Fetching from `/reader/api/articles/stats` endpoint
- Display of total, unread, and starred counts
- Number formatting with thousand separators
- Graceful error handling (no error UI)
- Mobile responsiveness
- Accessibility attributes

### 3. Integration Tests - Settings Save Flow

**File**: `src/__tests__/integration/settings-save-flow.test.tsx`
**Lines**: 618
**Coverage**:

- Complete save flow with toast feedback
- Save button state transitions
- Article statistics integration
- Multiple concurrent operations
- Form validation during save
- Network failure recovery
- Mobile touch interactions

### 4. E2E Tests - User Journey

**File**: `src/__tests__/e2e/settings-feedback.spec.ts`
**Lines**: 467
**Coverage**:

- Complete user journey with Playwright
- Toast stacking and positioning
- Mobile touch interactions
- Keyboard navigation
- Error recovery flow
- PWA-specific behaviors
- Liquid glass UI interactions

## Test Validation Status

✅ **All tests properly failing** (TDD approach)

- Tests fail because implementation doesn't exist
- Test structure validated and lint-free
- Tests will guide implementation

## Quality Gates Passed

- ✅ Every acceptance criterion has corresponding tests
- ✅ Edge cases covered (network failures, timeouts, rapid clicking)
- ✅ Error scenarios tested (API failures, invalid data)
- ✅ Performance thresholds defined (<3s mobile load)
- ✅ Mobile-specific scenarios included
- ✅ Accessibility requirements tested

## Implementation Contracts

### Toast Integration (usePreferencesForm hook)

```typescript
// Success case
toast.success("Preferences saved", {
  className: "toast-success",
  duration: 3000,
});

// Error case
toast.error("Couldn't save preferences. Please retry.", {
  className: "toast-error",
  action: {
    label: "Retry",
    onClick: handleSave,
  },
});
```

### Save Button Loading State

```typescript
// During save
<button disabled={isSaving}>
  {isSaving && <span className="animate-spin">⟳</span>}
  {isSaving ? "Saving..." : "Save Changes"}
</button>
```

### Article Stats Component

```typescript
// Skeleton loading
{isLoading ? (
  <div className="glass-skeleton animate-pulse h-24" />
) : (
  <div className="stats-grid">
    <div>Total: {stats.total.toLocaleString()}</div>
    <div>Unread: {stats.unread.toLocaleString()}</div>
    <div>Starred: {stats.starred.toLocaleString()}</div>
  </div>
)}
```

## Dependencies for Execute Phase

### Required Imports

- `sonner` - Toast notifications
- `@/lib/hooks/usePreferencesForm` - Form hook
- `@/components/settings/article-stats` - New component
- Existing semantic CSS classes from RR-247

### API Endpoint Required

- `GET /reader/api/articles/stats` returning:
  ```json
  {
    "total": 1234,
    "unread": 567,
    "starred": 89
  }
  ```

### CSS Classes Available

- `toast-success`, `toast-error` (from RR-247)
- `animate-spin`, `animate-pulse` (Tailwind)
- `glass-skeleton` (existing in globals.css)

## Estimated Implementation Effort

**Component Creation**: 1-2 hours

- ArticleStats component with skeleton loading
- API endpoint for statistics

**Hook Integration**: 1-2 hours

- Toast notifications in usePreferencesForm
- Loading state management

**UI Updates**: 30 minutes

- Settings page component placement
- Save button loading states

**Testing & Validation**: 1 hour

- Run all tests to green
- Manual testing on mobile PWA

**Total Estimate**: 3.5-5.5 hours

## Next Steps for Execute Phase

1. **Run failing tests** to establish baseline:

   ```bash
   npm run test:unit -- src/__tests__/unit/hooks/usePreferencesForm.test.tsx
   npm run test:unit -- src/__tests__/unit/components/settings/article-stats.test.tsx
   ```

2. **Implement in this order**:
   - Create ArticleStats component skeleton
   - Add toast integration to usePreferencesForm
   - Update settings page with new components
   - Create /api/articles/stats endpoint

3. **Validate each step** by running relevant tests

4. **Complete when all tests pass**:
   ```bash
   npm run test
   npm run pre-commit
   ```

## Risk Mitigation

- **Toast library conflicts**: Semantic classes from RR-247 use !important
- **API rate limits**: Stats endpoint should use cached data
- **Mobile performance**: Keep animations GPU-accelerated
- **Concurrent saves**: Debounce or queue operations

## Handoff Complete

✅ Test suite validated and comprehensive
✅ All quality gates passed
✅ Implementation contracts established
✅ Ready for TDD implementation in execute phase

---

**Ready for**: `04-execute RR-288`
