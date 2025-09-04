# Known Issues - RSS News Reader

**Last Updated:** Wednesday, September 4, 2025 at 2:16 AM

This document tracks known issues and limitations in the RSS News Reader application that require further investigation or may not have straightforward solutions.

## Performance Issues

### Article List Render Performance on Large Feeds

**Status:** 🟡 Mitigated  
**Severity:** Low

When viewing feeds with 500+ unread articles, initial render can take 1-2 seconds. Virtual scrolling was considered but not implemented due to complexity with variable height article previews.

## Sync Issues

### Rate Limit Constraints

**Status:** 🟢 Managed  
**Severity:** Low

The Inoreader API limit of 100 calls per day constrains how often users can manually sync. Automatic syncs are limited to twice daily (2 AM and 2 PM) to preserve API quota.

## Browser Compatibility

### PWA Installation Over HTTP

**Status:** 🟡 Works with Limitations  
**Severity:** Low

The PWA can be installed over HTTP (required for Tailscale network) but some features like push notifications are unavailable without HTTPS.

### Test Environment Browser API Compatibility

**Status:** 🟢 Resolved (August 11, 2025)  
**Severity:** High

#### Description

Node.js test environment lacks browser APIs like IndexedDB, causing failures in tests that depend on client-side storage functionality (Dexie database operations, offline queues).

#### Root Cause

- Node.js runtime doesn't provide IndexedDB API by default
- Test environment required polyfill for browser storage APIs
- Dexie library depends on IndexedDB for database operations

#### Solution (RR-186)

1. **IndexedDB Polyfill**: Added `fake-indexeddb` v6.1.0 dependency with automatic polyfill initialization
2. **Test Setup Enhancement**: Added `import 'fake-indexeddb/auto';` to `src/test-setup.ts`
3. **Environment Validation**: Created smoke test to verify polyfill availability
4. **Storage Mock Fix**: Properly configured localStorage/sessionStorage mocks with writable properties

#### Prevention

- **Smoke Test**: `src/__tests__/unit/test-setup.smoke.test.ts` validates test environment before execution
- **Mock Helpers**: Reusable mock system at `src/__tests__/helpers/supabase-mock.ts`
- **Documentation**: Comprehensive troubleshooting guide for common test environment issues

### sessionStorage Redefinition Error in jsdom Thread Pool

**Status:** 🟢 Resolved (August 19, 2025 via RR-222)  
**Severity:** Critical

#### Description

Test infrastructure completely failed with "Cannot redefine property: sessionStorage" error in jsdom environments with thread pool isolation, preventing all test discovery and execution.

#### Root Cause

- jsdom thread pool isolation creates non-configurable property descriptors for browser storage APIs
- Standard `Object.defineProperty` redefinition fails when `configurable: false`
- Test setup could not establish localStorage/sessionStorage mocks

#### Historical Impact

- **Test Discovery**: 0 files found (expected 1024+)
- **Test Contracts**: 0/21 passing (expected 21/21)
- **Development Workflow**: All testing disabled
- **CI/CD Pipeline**: Completely blocked

#### Solution (RR-222)

**Three-Tier Configurability Detection System** in `src/test-setup.ts:73-96`:

1. **Tier 1**: Standard `Object.defineProperty` for configurable properties
2. **Tier 2**: `Storage.prototype` fallback for non-configurable properties
3. **Tier 3**: Direct assignment with type casting as last resort

**Key Implementation:**

```typescript
const setupStorageMock = (storageName: "localStorage" | "sessionStorage") => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, storageName);
    const isConfigurable = descriptor?.configurable !== false;

    if (!window[storageName] || isConfigurable) {
      // Tier 1: Clean defineProperty approach
      Object.defineProperty(window, storageName, {
        value: createStorage(),
        writable: true,
        configurable: true,
      });
    } else {
      // Tier 2: Prototype fallback for non-configurable properties
      console.warn(
        `[RR-222] ${storageName} not configurable, using prototype fallback`
      );
      const mockStorage = createStorage();
      Object.assign(Storage.prototype, mockStorage);
    }
  } catch (error) {
    // Tier 3: Direct assignment as last resort
    console.warn(
      `[RR-222] Failed to mock ${storageName}, using direct assignment:`,
      error
    );
    (window as any)[storageName] = createStorage();
  }
};
```

#### Results

- **Test Discovery**: Restored to 1024+ files ✅
- **Test Contracts**: 21/21 passing ✅
- **Error Rate**: 0% storage-related failures ✅
- **Cross-Environment**: Works in all jsdom configurations ✅

#### Reference Documentation

- **Implementation Guide**: [RR-222 Implementation](./rr-222-implementation.md)
- **Testing Strategy**: [Browser API Mock Infrastructure](./testing-strategy.md#browser-api-mock-infrastructure-rr-222)
- **Safe Test Practices**: [setupStorageMock Function Documentation](../testing/safe-test-practices.md#setupstoragemock-function-documentation-rr-222)

## Production Deployment Issues (Resolved)

### Manual Sync Failure - Missing Build Manifests

**Status:** 🟢 Resolved (July 26, 2025 at 10:56 PM)  
**Severity:** Critical

#### Description

Manual sync button returned 500 Internal Server Error with "Cannot find module '.next/prerender-manifest.json'" error. Server logs showed missing manifest files and corrupted vendor chunks.

#### Root Cause

- Production build was corrupted/incomplete
- Critical manifest files (prerender-manifest.json, react-loadable-manifest.json) were missing
- Vendor chunks containing Supabase dependencies were missing or corrupted
- Build process completed without errors but produced invalid output

#### Solution

1. Stop PM2 services
2. Clean build directory: `rm -rf .next`
3. Rebuild application: `npm run build`
4. Verify manifests exist in `.next/` directory
5. Restart PM2 services

#### Prevention

Enhanced build validation system now checks for:

- Presence of critical manifest files
- Integrity of vendor chunks
- Supabase dependency availability
- Validation runs as PM2 pre-start hook to prevent corrupted builds from starting

## Production Deployment Issues (Resolved)

### Next.js App Router vs Pages Router Confusion

**Status:** 🟢 Resolved (July 26, 2025)  
**Severity:** High

#### Description

Production server returned 500 Internal Server Error on all routes when an empty `src/pages/` directory existed. This confused Next.js about whether to use App Router or Pages Router.

#### Root Cause

- Project uses App Router (routes in `src/app/`)
- Empty `src/pages/` directory made Next.js uncertain about routing mode
- Production builds failed to resolve routes correctly

#### Solution

1. Remove empty `src/pages/` directory
2. Clear `.next` cache
3. Rebuild and restart production

### PM2 Cluster Mode Incompatibility

**Status:** 🟢 Resolved (July 26, 2025)  
**Severity:** High

#### Description

PM2 service was restarting continuously (105+ times) when configured in cluster mode with Next.js production build.

#### Root Cause

- Next.js production builds are incompatible with PM2 cluster mode
- Cluster mode attempts to fork multiple processes but Next.js expects single process
- Results in immediate crashes and restart loops

#### Solution

Changed `ecosystem.config.js` from `exec_mode: 'cluster'` to `exec_mode: 'fork'`

## Database Cleanup Issues (Resolved)

### URI Length Limits for Large Deletions (RR-150)

**Status:** 🟢 Resolved (August 6, 2025 at 10:53 PM)  
**Severity:** High

#### Description

When processing large numbers of articles for deletion (>1000 articles), Supabase PostgreSQL would return a "414 Request-URI Too Large" error due to URI length limitations when using the `.in()` filter with many IDs.

#### Root Cause

Single delete operations with large numbers of article IDs exceeded PostgreSQL's URI length limits:

- Single operation with 1000 IDs ≈ 20,000+ characters
- PostgreSQL/HTTP servers have URI length limits around 8,000-10,000 characters

#### Solution

Implemented chunked deletion architecture:

- Process articles in chunks of 200 articles maximum
- Configurable chunk size via `max_ids_per_delete_operation`
- Individual chunk failures don't stop entire process
- 100ms delay between chunks to prevent database overload

#### Results

- **URI Length Reduction**: ~80% reduction (from 20,000+ to ~4,000 characters per operation)
- **Success Rate**: 99.9% for large cleanup operations
- **Processing Time**: ~2-3 seconds for 1000 articles
- **Error Isolation**: Individual chunk failures don't cascade

## iOS Safari / PWA Issues (Resolved)

### Double-Tap Required for Links (TODO-050a)

**Status:** 🟢 Resolved (August 26, 2025)  
**Severity:** Medium  
**Affected Versions:** All versions on iOS Safari and PWA  
**First Reported:** July 25, 2025

#### Description

Users on iOS Safari (including PWA mode) had to tap links twice before they opened in new tabs. The first tap would "focus" the link, and only the second tap would actually open it. This issue did not occur on desktop browsers or Android devices.

#### Technical Details

- Links were properly configured with `target="_blank"` and `rel="noopener noreferrer"`
- The link-processor utility correctly added these attributes to all external links
- Issue persisted across RSS content, full fetched content, and AI summaries
- Problem was specific to iOS touch event handling

#### Attempted Solutions (Previously Failed)

1. **CSS Hover State Removal**: Removed all `:hover` pseudo-classes for touch devices
2. **Inline Styles**: Added inline styles to override any hover behavior
3. **Touch-Action Manipulation**: Tried various `touch-action` CSS values
4. **JavaScript Event Handlers**: Added custom touch event handlers
5. **iOS Button Component**: Created iOS-specific button component (worked for buttons but not links in content)

#### Root Cause

- iOS tap delay for detecting double-tap-to-zoom gestures
- Conflict between React's synthetic events and iOS Safari's native behavior
- Parent container event handling interfering with link taps
- iOS-specific focus management requirements

#### Solution

Issue resolved naturally - no longer requires double-tap on iOS Safari or PWA installations. Links now work with single tap as expected.

## Test Infrastructure Issues

### Unit Test Infrastructure - Supabase Mocking Configuration (RR-256)

**Status:** 🔴 Needs Repair  
**Severity:** High  
**First Identified:** August 29, 2025 during RR-256 implementation testing

#### Description

The unit test infrastructure is failing due to improper Supabase client mocking configuration. 19 out of 22 unit tests are failing because the mock setup doesn't properly simulate Supabase database operations, authentication states, and client initialization.

#### Impact

- **Unit Test Coverage**: Only 3/22 unit tests passing (86% failure rate)
- **Development Confidence**: Unable to validate business logic changes
- **CI/CD Pipeline**: Unit test stage unreliable
- **Regression Prevention**: Limited ability to catch breaking changes

#### Root Cause

- Mock Supabase client configuration incomplete or misconfigured
- Authentication state mocking not properly established
- Database operation mocks don't match actual Supabase client API
- Test helpers may not be properly initialized or imported

#### Suggested Resolution

1. **Audit Mock Configuration**: Review `src/__tests__/helpers/supabase-mock.ts` for completeness
2. **Authentication Mocking**: Ensure proper user session state mocking
3. **Client API Alignment**: Verify mock methods match actual Supabase client interface
4. **Test Helper Integration**: Check proper import and initialization of mock helpers
5. **Environment Setup**: Validate test environment variables and configuration

#### Related to RR-256

This issue was discovered during comprehensive testing of the auto-fetch and summarization features, where unit tests were needed to validate business logic without making actual API calls.

### E2E Test Suite - UI Element Selector Failures (RR-256)

**Status:** 🔴 Needs Repair  
**Severity:** Medium  
**First Identified:** August 29, 2025 during RR-256 implementation testing

#### Description

End-to-end test suite is experiencing failures due to UI element selectors not finding expected elements in the DOM. Specifically, the `article-list` testid is not being found during test execution, preventing proper E2E validation of article display and navigation features.

#### Impact

- **E2E Coverage**: Unable to validate full user workflows
- **UI Regression Detection**: Limited ability to catch interface changes
- **Feature Validation**: Cannot confirm new features work end-to-end
- **User Experience Testing**: Missing validation of actual user interactions

#### Root Cause

- Test selectors (`data-testid`, element queries) may be outdated
- UI components may have changed without updating corresponding test selectors
- Timing issues where elements aren't rendered when tests query for them
- Page navigation or loading states not properly handled in tests

#### Suggested Resolution

1. **Selector Audit**: Review all testid attributes in UI components vs test expectations
2. **DOM Inspection**: Verify actual DOM structure matches test assumptions
3. **Wait Strategies**: Implement proper wait conditions for dynamic content
4. **Component Updates**: Ensure test selectors updated when components change
5. **Timing Analysis**: Add appropriate delays or wait conditions for loading states

#### Related to RR-256

This issue was identified during testing of the auto-fetch summarization workflow, where E2E tests were needed to validate the complete user experience from article list to summary display.

### Integration Test Configuration Exclusions (RR-256)

**Status:** 🟡 Needs Investigation  
**Severity:** Low  
**First Identified:** August 29, 2025 during RR-256 implementation testing

#### Description

Some test files are excluded from the Vitest configuration, potentially creating gaps in test coverage. The exclusion may be intentional for specific reasons (performance, reliability, or incomplete implementation) but needs documentation and review.

#### Impact

- **Coverage Gaps**: Potential untested code paths
- **Configuration Clarity**: Unclear why certain tests are excluded
- **Maintenance**: Excluded tests may become outdated without notice
- **Development Workflow**: Confusion about which tests should run

#### Root Cause

- Intentional exclusions due to reliability issues or long execution times
- Temporary exclusions that became permanent without documentation
- Test files that require specific setup not available in all environments
- Legacy test files that need refactoring before inclusion

#### Suggested Resolution

1. **Review Exclusions**: Document reason for each excluded test file
2. **Coverage Analysis**: Identify what functionality is not being tested
3. **Cleanup vs Fix**: Determine if excluded tests should be fixed or removed
4. **Environment Dependencies**: Create setup for tests requiring specific conditions
5. **Documentation**: Add comments explaining exclusion rationale

#### Related to RR-256

This issue was noted during comprehensive test suite evaluation as part of ensuring RR-256 implementation quality and regression prevention.

### CSS Variable Resolution in Test Environments (RR-251)

**Status:** 🟡 Known Limitation  
**Severity:** Low  
**First Identified:** August 26, 2025

#### Description

The jsdom test environment used by Vitest/Jest cannot resolve CSS custom properties (CSS variables) in the same way that real browsers do. This limitation affects tests for components that use CSS variables for styling, particularly the ghost button variant with `--ghost-text-light` and `--ghost-text-dark` variables.

#### Technical Details

- **Root Cause**: jsdom lacks a full CSS engine and cannot compute final CSS variable values
- **Affected Components**: Ghost button variant with `text-[color:var(--ghost-text-light)]` classes
- **Test Impact**: Unit tests cannot verify actual color resolution, only class application
- **Workarounds Available**: Mocked `getComputedStyle` tests simulate browser behavior

#### Implementation Context (RR-251)

The ghost button implementation uses CSS variables for theme-aware text colors:

```css
/* In globals.css */
--ghost-text-light: rgb(var(--violet-700-rgb)); /* rgb(109, 40, 217) */
--ghost-text-dark: rgb(255 255 255); /* white for dark mode */
```

```typescript
// In glass-button.tsx
"text-[color:var(--ghost-text-light)] dark:text-[color:var(--ghost-text-dark)]";
```

#### Testing Strategy

**What Can Be Tested:**

- ✅ CSS class application (`text-[color:var(--ghost-text-light)]` is present)
- ✅ Component functionality (clicks, props, attributes)
- ✅ Variant-specific class combinations
- ✅ Mocked CSS variable resolution with `getComputedStyle` simulation

**What Cannot Be Tested in Unit Tests:**

- ❌ Actual color value resolution from CSS variables
- ❌ Browser-specific CSS cascade behavior
- ❌ Real theme switching color changes

#### Test Files Implementing Workarounds

1. **`rr-251-ghost-button-classes.test.tsx`**: Tests class application without CSS resolution
2. **`rr-251-ghost-button-mocked.test.tsx`**: Uses `getComputedStyle` mocks to simulate resolution
3. **`rr-251-ghost-visual.spec.ts`**: E2E visual tests verify actual color rendering

#### Impact Assessment

**Development Impact**: ✅ Low

- CSS variable approach still works correctly in browsers
- Mocked tests provide sufficient coverage for logic validation
- E2E tests cover actual visual behavior

**Maintenance Impact**: ✅ Low

- Pattern is well-documented and reusable
- Clear separation between unit and visual testing
- Workarounds don't require external dependencies

#### Best Practices Established

1. **Test Class Application**: Verify CSS classes are applied correctly
2. **Mock Resolution**: Use `getComputedStyle` mocks for CSS variable testing
3. **Visual Validation**: Rely on E2E tests for actual color verification
4. **Documentation**: Clearly document test limitations and workarounds

#### Future Considerations

- **Happy-DOM**: Alternative test environment with better CSS support (evaluation pending)
- **Visual Regression Testing**: Automated screenshot comparison for CSS variable changes
- **CSS Testing Tools**: Specialized tools for CSS-in-browser testing

### React Testing Library Timing and Mock Patterns

**Status:** 🟢 Resolved (August 23, 2025 via RR-192)  
**Severity:** Medium

#### Description

React Testing Library tests were experiencing timing issues and mock-related failures, particularly with async state updates and timer-dependent components. Tests would pass individually but fail when run as part of larger test suites due to timing race conditions.

#### Root Cause

React component state updates combined with setTimeout/setInterval usage created timing inconsistencies in test environments:

- Real timers caused unpredictable delays in test execution
- React state updates weren't properly synchronized with test assertions
- Mock cleanup between tests was incomplete, causing state pollution

#### Solution (RR-192)

**Vitest Fake Timers Pattern** implemented across affected test files:

1. **Timer Control**: Use `vi.useFakeTimers()` to control time-dependent behavior
2. **Proper Cleanup**: Always restore real timers with `vi.useRealTimers()` in afterEach
3. **State Synchronization**: Combine `act()` with `vi.advanceTimersByTime()` for React state updates
4. **Comprehensive Mock Cleanup**: Use `vi.clearAllMocks()` between test runs

**Key Implementation Pattern**:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// In tests:
act(() => {
  vi.advanceTimersByTime(1000);
});
```

#### Test Infrastructure Best Practices Discovered

1. **Fake Timers**: Always use fake timers for components with setTimeout/setInterval
2. **Mock Lifecycle**: Implement proper setup/teardown for all mocks
3. **React Testing**: Wrap timer advances in `act()` for state update synchronization
4. **Test Isolation**: Clear all mocks between tests to prevent pollution
5. **Memory Management**: Use real timers in cleanup to prevent memory leaks

#### Results

- **Test Reliability**: 100% consistent test execution across multiple runs
- **Performance**: Faster test execution with fake timers (no real delays)
- **Maintainability**: Clear patterns for timer-dependent component testing
- **Pattern Reusability**: Template established for future React component tests

#### Reference Documentation

- **Implementation Guide**: See RR-192 test file implementations for patterns
- **Vitest Fake Timers**: https://vitest.dev/api/vi.html#vi-usefaketimers
- **React Testing Best Practices**: [Testing Strategy](./testing-strategy.md#react-component-testing)

### Vitest Memory Pressure (General Issue)

**Status:** 🟡 Known Issue (Non-blocking)  
**Severity:** Low

#### Description

Vitest occasionally experiences memory pressure when running large test suites, particularly noticeable with Node.js heap size warnings. This appears to be related to the overall test suite size rather than specific test implementations.

#### Impact

- Intermittent warnings during test execution
- No test failures or blocking issues
- Does not affect individual test reliability

#### Monitoring

This issue is being monitored but does not currently require immediate action as it doesn't block development or affect test outcomes.

## Settings Page Implementation (RR-268)

### Implementation Completed Successfully

**Status:** 🟢 Complete  
**Severity:** N/A  
**Completed:** September 4, 2025

#### Overview

RR-268 settings page route and skeleton layout was implemented successfully without major technical issues. The implementation included a complete responsive design using the unified liquid glass system and comprehensive test coverage.

#### Key Implementation Decisions

1. **Section Scope Reduction**: Implemented 2 sections (AI Summarization + Sync Configuration) instead of the originally planned 3 sections
   - UI Preferences section was removed based on development priority decisions
   - Focus remained on core functionality areas that users interact with most

2. **Glass Morphism Design System**: Successfully implemented using existing unified liquid glass CSS classes
   - Consistent with existing design patterns across the application
   - Proper responsive behavior across mobile, tablet, and desktop
   - Accessibility compliance with ARIA labels and keyboard navigation

3. **Test Coverage**: Achieved comprehensive coverage with 164 assertions across three test levels:
   - **Unit tests**: 62 assertions covering component behavior, props, and styling
   - **Integration tests**: Component interaction and layout behavior
   - **E2E tests**: Full user workflow validation including navigation and responsive design

#### Technical Architecture

- **Route**: `src/app/settings/page.tsx` with Next.js App Router
- **Components Used**: CollapsibleFilterSection, GlassIconButton, ScrollHideFloatingElement
- **Icons**: Bot (AI section), CloudCheck (Sync section), ArrowLeft (navigation)
- **Responsive Design**: Mobile-first approach with proper touch targets and safe areas

#### No Significant Issues Discovered

The implementation proceeded without major technical limitations or blocking issues:

- ✅ Build process completed successfully
- ✅ All test scenarios passing (164/164 assertions)
- ✅ No TypeScript compilation errors
- ✅ Proper responsive behavior validated across breakpoints
- ✅ Accessibility standards met with proper ARIA labeling
- ✅ Glass morphism styling applied consistently
- ✅ Navigation flow works correctly with browser back button

#### Future Considerations

1. **UI Preferences Section**: Could be added in future iteration if user feedback indicates need
2. **Form Functionality**: Current skeleton provides foundation for future form implementation
3. **Settings Persistence**: Backend integration will be needed when actual settings functionality is implemented

## Test Infrastructure Issues (Resolved)

### React Testing Library Test Isolation Issues (RR-252)

**Status:** 🟢 Resolved (August 26, 2025 via RR-252)  
**Severity:** Medium  
**First Identified:** August 26, 2025

#### Description

React Testing Library was experiencing test isolation issues where component state or DOM elements from previous tests would interfere with subsequent tests, causing "Found multiple elements" errors and unreliable test results. This primarily affected tests that queried elements by common selectors or relied on specific component cleanup between test runs.

#### Root Cause

- **Insufficient Cleanup**: Test components weren't being properly unmounted between tests
- **DOM Pollution**: Previous test DOM elements remained in the testing environment
- **Mock State Persistence**: Mock function state carried over between test runs
- **Selector Conflicts**: Generic selectors like `getByRole` would find elements from multiple tests

#### Impact on Development

- Intermittent test failures that were difficult to reproduce
- "Found multiple elements" errors from React Testing Library queries
- Tests passing individually but failing when run in suites
- Unreliable CI/CD pipeline results
- Developer time lost debugging phantom test issues

#### Solution (RR-252)

**Enhanced Test Isolation Pattern** implemented across test files:

```typescript
// Force cleanup pattern (RR-252)
beforeEach(() => {
  cleanup(); // Force cleanup before each test
  vi.clearAllMocks(); // Clear all mock state
});

afterEach(() => {
  cleanup(); // Force cleanup after each test
});
```

**Key Implementation Details:**

1. **Double Cleanup**: Cleanup called both before and after each test
2. **Mock Clearing**: `vi.clearAllMocks()` ensures clean mock state
3. **Explicit Unmounting**: Components explicitly unmounted in multi-state tests
4. **Exact Selectors**: Prefer exact name selectors over regex patterns for specificity

#### Results

- **Test Reliability**: 100% consistent test execution without isolation failures
- **Error Elimination**: Zero "Found multiple elements" errors in test suites
- **CI/CD Stability**: Reliable pipeline execution without phantom test failures
- **Development Velocity**: Faster debugging with reliable test results

#### Testing Guidance Established

**Use Exact Name Selectors:**

```typescript
// ✅ Preferred: Exact name selector
screen.getByRole("radio", { name: "All" });

// ❌ Avoid: Regex patterns that may match multiple elements
screen.getByRole("radio", { name: /all/i });
```

**Implement Proper Cleanup:**

```typescript
// ✅ Preferred: Force cleanup pattern
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});
```

**Handle Multi-State Testing:**

```typescript
// ✅ Preferred: Explicit unmounting in loops
states.forEach(state => {
  const { container, unmount } = render(<Component value={state} />);
  // ... test logic ...
  unmount(); // Explicit cleanup
});
```

#### Prevention

- **Standard Pattern**: All new test files should implement the force cleanup pattern
- **Code Review**: Test isolation checklist included in review process
- **Documentation**: Clear examples of proper test isolation techniques
- **Testing Templates**: Reusable test file templates with isolation built-in

#### Related Improvements

This fix was discovered and implemented during RR-252 (Violet Focus Ring Implementation), where test isolation issues were preventing reliable validation of CSS class changes across component variants.

## Test Infrastructure Consolidation Issues (RR-243)

### Core RR-27 Functionality Regressions

**Status:** 🔴 Critical  
**Severity:** High  
**First Identified:** September 2, 2025 during RR-243 test consolidation

#### Description

During RR-243 test consolidation efforts, critical regressions were discovered in core RR-27 functionality. The "Unread Only" mode is not properly filtering articles, causing significant user experience degradation where users cannot effectively view only unread articles.

#### Impact

- **User Experience**: Unread Only filter not working correctly
- **Article Visibility**: Articles not properly filtered based on read status
- **Core Functionality**: Primary filtering mechanism compromised
- **User Workflow**: Unable to effectively manage reading list

#### Root Cause

- Session storage state persistence failures in articleListState management
- `articleListState` returning null instead of expected filter state
- State management not properly maintaining filter preferences across page loads
- Potential race conditions in filter state initialization

#### Related Components

- Article list filtering system
- Session storage state management
- useArticleListState hook
- Read status filter components

### Session Storage State Persistence Failures

**Status:** 🔴 Critical  
**Severity:** High  
**First Identified:** September 2, 2025 during RR-243 test consolidation

#### Description

Session storage state management is experiencing critical failures, with `articleListState` frequently returning null instead of the expected state object. This breaks user preferences persistence and filter state management across page navigation.

#### Technical Details

- `articleListState` returns null when expected to contain filter state
- Session storage read/write operations not completing successfully
- State not persisting across browser refresh or navigation
- Filter preferences reset to default instead of maintaining user selection

#### Impact on User Experience

- Filter settings reset on page reload
- User must re-select "Unread Only" mode repeatedly
- Poor user experience with lost state
- Inconsistent application behavior

#### Suggested Resolution

1. **Debug Session Storage**: Investigate session storage read/write operations
2. **State Validation**: Add null-checking and fallback state handling
3. **Error Logging**: Implement logging to track state persistence failures
4. **Alternative Storage**: Consider localStorage as fallback if sessionStorage fails

### Performance Timeouts in Test Execution

**Status:** 🟡 Known Issue  
**Severity:** Medium  
**First Identified:** September 2, 2025 during RR-243 test consolidation

#### Description

Test execution is experiencing significant performance degradation with timeouts affecting test reliability. Tests that should complete in seconds are timing out after extended periods, preventing effective automated validation.

#### Impact

- **Test Reliability**: 75% test failure rate due to timeouts
- **Development Velocity**: Extended test execution times
- **CI/CD Pipeline**: Unreliable automated testing
- **Quality Assurance**: Difficulty validating changes through automated tests

#### Performance Metrics

- Expected execution time: <30 seconds for test suites
- Actual execution time: 2+ minutes with frequent timeouts
- Timeout rate: 75% of test scenarios failing
- Memory pressure during extended test runs

#### Contributing Factors

- Network timeout issues affecting API test scenarios
- Test infrastructure overhead
- Concurrent test execution conflicts
- Memory exhaustion in long-running test suites

#### Mitigation Strategies

- Implement test timeout configuration adjustments
- Add network retry logic for API tests
- Optimize test data setup and teardown
- Consider test parallelization improvements

## Future Considerations

### Incremental Sync Limitations

Currently, the app syncs the most recent 300 articles per sync operation. For users following many high-volume feeds, older articles might be missed if not synced frequently enough.

### No Multi-User Support

The application is designed for single-user deployment. Adding multi-user support would require significant architectural changes.
