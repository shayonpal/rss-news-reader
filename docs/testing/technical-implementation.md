# Testing Strategy

This document outlines the comprehensive testing strategy for the RSS News Reader, covering unit testing, integration testing, and end-to-end testing approaches.

## Overview

The RSS News Reader implements a multi-layered testing approach optimized for reliability, performance, and cross-platform compatibility. Our testing infrastructure has been optimized (RR-183) to achieve 8-20 second test execution times, enabling efficient CI/CD integration.

## Testing Architecture

### 1. Unit Testing

**Framework**: Vitest with React Testing Library  
**Purpose**: Test individual components, utilities, and business logic in isolation  
**Execution Time**: 8-20 seconds (optimized with thread pool configuration)

**Coverage Areas:**

- React component behavior and rendering
- Utility functions and data transformations
- Store management (Zustand)
- Custom hooks functionality
- API service layer logic

**Key Features:**

- Thread pool optimization with 4 max threads
- Comprehensive cleanup hooks preventing memory leaks
- Mock system supporting complex selector patterns
- Custom matchers for enhanced assertions

**Test Environment Requirements (RR-186):**

- **IndexedDB Polyfill**: `fake-indexeddb` library provides browser API compatibility for Dexie and other storage-dependent tests
- **Environment Validation**: Smoke test at `src/__tests__/unit/test-setup.smoke.test.ts` validates test environment setup before test execution
- **Mock Infrastructure**: Comprehensive mock helpers for browser APIs (localStorage, sessionStorage) and external services (Supabase)

**Store Isolation Patterns (RR-188):**

- **Zustand Store Isolation**: Isolated store creation utilities at `src/lib/stores/__tests__/test-utils.ts` prevent state leakage in parallel test execution
- **Parallel Test Support**: Enhanced Vitest configuration supports concurrent test execution without cross-test state contamination
- **Unique Storage Keys**: Each test gets unique storage identifiers to prevent shared state between test cases

### 2. Integration Testing

**Framework**: Vitest with Supertest  
**Purpose**: Test API endpoints and service interactions  
**Environment**: Isolated test environment with mocked dependencies

**Coverage Areas:**

- API endpoint functionality and error handling
- Database integration and data persistence
- Service layer interactions
- Authentication and authorization flows
- External API integration points

**Test Database:**

- Isolated test environment
- Automatic cleanup between tests
- Row Level Security policy validation
- Database migration testing

### 3. End-to-End (E2E) Testing

**Framework**: Playwright (RR-184)  
**Purpose**: Validate complete user workflows across multiple browsers and devices

#### Browser Coverage

**Desktop Browsers:**

- **Chromium**: Latest stable version
- **Firefox**: Latest stable version
- **Safari (WebKit)**: Latest stable version

**Mobile Devices:**

- **iPhone 14**: Safari mobile browser
- **iPhone 14 Pro Max**: Safari mobile browser
- **iPad Gen 7**: Safari tablet browser
- **iPad Pro 11"**: Safari tablet browser
- **Android Pixel 5**: Chrome mobile browser

#### Test Scenarios

1. **Core User Journeys** (`rr-184-core-user-journeys.spec.ts`)
   - Article reading workflow validation
   - Feed navigation and selection
   - Manual sync triggers and UI updates
   - Cross-session state persistence
   - PWA installation and functionality

2. **iPhone Button Tappability** (`iphone-button-tappability.spec.ts`)
   - iOS touch target compliance (44x44px minimum)
   - Element spacing validation (8px minimum)
   - Touch interaction responsiveness
   - Gesture recognition (swipe, tap, long-press)
   - Modal and dropdown accessibility
   - Form input focus behavior
   - ARIA label validation
   - PWA installation banner tappability

#### Network Requirements

- **Tailscale VPN**: All E2E tests require Tailscale network access
- **Base URL**: http://100.96.166.53:3000/reader
- **Authentication**: None required (network-based access control)
- **Auto-Start**: Development server automatically starts if not running

#### Test Execution

```bash
# Run all E2E tests across all browsers
npm run test:e2e

# Run specific test suite
npx playwright test src/__tests__/e2e/rr-184-core-user-journeys.spec.ts
npx playwright test src/__tests__/e2e/iphone-button-tappability.spec.ts

# Run on specific browser/device
npx playwright test --project="Mobile Safari"
npx playwright test --project="iPad Safari"
npx playwright test --project=chromium

# Debug mode
npx playwright test --headed
npx playwright test --ui
```

## Cross-Browser Validation Strategy

### Compatibility Matrix

| Test Type          | Chrome | Firefox | Safari | Mobile Safari | iPad Safari | Android |
| ------------------ | ------ | ------- | ------ | ------------- | ----------- | ------- |
| Core User Journeys | ✅     | ✅      | ✅     | ✅            | ✅          | ✅      |
| Button Tappability | ✅     | ✅      | ✅     | ✅            | ✅          | ✅      |
| PWA Features       | ✅     | ✅      | ✅     | ✅            | ✅          | ✅      |
| Touch Gestures     | N/A    | N/A     | N/A    | ✅            | ✅          | ✅      |

### Platform-Specific Testing

**iOS Devices:**

- Touch target size compliance (44x44px iOS guidelines)
- Safe area handling for PWA installation
- Gesture recognition and response times
- Safari-specific PWA behaviors

**Android Devices:**

- Chrome PWA installation flow
- Touch interaction patterns
- Responsive design validation

**Desktop Browsers:**

- Keyboard navigation accessibility
- Mouse interaction patterns
- Responsive breakpoint testing

## Mobile PWA Testing Guidelines

### Touch Target Compliance

**iOS Standards (Apple HIG):**

- Minimum touch target size: 44x44 points
- Minimum spacing between touch targets: 8 points
- Clear visual feedback on touch interactions

**Implementation:**

- Automated validation in `iphone-button-tappability.spec.ts`
- Detection of non-compliant elements
- Spacing validation between interactive elements

### PWA Installation Testing

**Validation Points:**

- Web App Manifest correctness
- Service Worker registration
- Installation banner appearance
- Offline functionality
- App icon display
- Splash screen configuration

**Test Coverage:**

- Installation flow across different browsers
- Post-installation functionality
- Offline queue behavior
- Background sync capabilities

### Gesture Support Testing

**Touch Interactions:**

- Tap, double-tap, long-press recognition
- Swipe gestures (left, right, up, down)
- Pull-to-refresh functionality
- Pinch-to-zoom handling
- Scroll momentum and boundaries

## Test Data Management

### Test Environment

**Database:**

- Isolated test database instance
- Automatic cleanup between test runs
- Seed data for consistent test scenarios
- Row Level Security policy validation

**External Dependencies:**

- Mocked Inoreader API responses
- Mocked Claude API interactions
- Stubbed network requests in E2E tests

**Browser API Compatibility (RR-186):**

- **IndexedDB**: `fake-indexeddb` polyfill for database storage tests
- **localStorage/sessionStorage**: Properly configured mocks with writable properties
- **Environment Validation**: Automated smoke tests verify polyfill availability and API compatibility

### Test Infrastructure (RR-186)

**IndexedDB Polyfill Requirements:**

- **Dependency**: `fake-indexeddb` v6.1.0 automatically polyfills IndexedDB for Node.js test environment
- **Auto-import**: Added `import 'fake-indexeddb/auto';` to `src/test-setup.ts` for automatic polyfill activation
- **Compatibility**: Resolves Dexie and other storage-dependent test failures in headless test environment
- **Use Cases**: Essential for testing browser storage features, offline queues, and local data persistence

**Mock System Improvements:**

- **Storage Mocks**: Fixed localStorage/sessionStorage mocks with proper `writable: true, configurable: true` properties
- **Supabase Mock Helper**: Reusable mock at `src/__tests__/helpers/supabase-mock.ts` with method chaining support
- **Environment Validation**: Smoke test validates that all required polyfills and mocks are properly initialized
- **Export Consistency**: Fixed missing exports in utility classes to ensure proper testability

**Troubleshooting Common Issues:**

- **IndexedDB Failures**: Ensure `fake-indexeddb` is imported before any Dexie usage in tests
- **Storage Mock Crashes**: Use provided mock helpers instead of manual mock configuration
- **Test Environment**: Run smoke test (`src/__tests__/unit/test-setup.smoke.test.ts`) to validate setup
- **Store State Leakage**: Use isolated stores from `test-utils.ts` for Zustand tests in parallel environments

### Zustand Store Testing Patterns

**Store Isolation (RR-188):**

- **Isolated Store Creation**: Use `createIsolatedUIStore()` from `src/lib/stores/__tests__/test-utils.ts` for tests requiring clean state
- **Parallel Test Safety**: Each test gets unique storage keys preventing cross-test contamination
- **State Management**: Boolean coercion ensures robust null/undefined handling in store logic

**Example Usage:**

```typescript
import { createIsolatedUIStore } from "./test-utils";

describe("UI Store Tests", () => {
  let store: ReturnType<typeof createIsolatedUIStore>;

  beforeEach(() => {
    store = createIsolatedUIStore();
  });

  it("should manage collapse state independently", () => {
    // Test implementation with isolated store
  });
});
```

### Test Fixtures

**Article Data:**

- Sample articles with various content types
- Different publication dates and authors
- Read/unread state variations
- Starred/unstarred combinations

**Feed Data:**

- Multiple feed categories
- Various folder structures
- Different unread count scenarios

## Performance Testing

### Metrics Tracked

**Load Time Performance:**

- Initial page load (< 2 seconds target)
- Feed list rendering (< 500ms target)
- Article detail display (< 300ms target)
- Sync operation completion (< 5 seconds target)

**Resource Usage:**

- Memory consumption during test execution
- Network request efficiency
- Database query optimization
- Browser resource utilization

### Playwright Performance Integration

```javascript
// Example performance measurement
await page.waitForLoadState("networkidle");
const loadTime = await page.evaluate(() => performance.now());
expect(loadTime).toBeLessThan(2000);
```

## GitHub Actions CI/CD Integration

The RSS News Reader implements comprehensive CI/CD testing integration (RR-185) with progressive testing strategy and automated quality gates.

### CI/CD Testing Architecture

**Progressive Testing Pipeline**:

1. **Smoke Tests** (2-3 min): TypeScript, linting, critical tests, build validation
2. **Full Test Suite** (8-10 min): Matrix testing across Node 18/20 with 4-way sharding
3. **E2E Testing** (5-15 min): Cross-browser testing with Playwright
4. **Performance Testing**: Regression detection with baseline comparison
5. **Security Testing**: npm audit and vulnerability assessment

### CI/CD Test Commands

**Smoke Tests Stage**:

```bash
# TypeScript compilation validation
npm run type-check

# Code quality validation
npm run lint

# Critical unit tests (subset)
npm run test:unit

# Build validation
npm run build
```

**Full Test Suite Stage**:

```bash
# Optimized parallel execution (matches CI sharding)
npm run test:parallel

# Performance regression testing
npm run test:performance

# Integration tests with service validation
npm run test:integration:safe
```

**E2E Testing Stage**:

```bash
# Cross-browser E2E testing
npm run test:e2e

# Specific browser testing
npx playwright test --project="Mobile Safari"
npx playwright test --project=chromium
npx playwright test --project=firefox
```

### Test Matrix Configuration

**Node.js Matrix**:

- **Versions**: Node 18.x and 20.x
- **OS**: ubuntu-latest
- **Parallel Execution**: 4-way test sharding

**Browser Matrix** (E2E):

- **Desktop**: Chromium, Firefox, WebKit
- **Mobile**: iPhone 14, iPhone 14 Pro Max (Safari)
- **Tablet**: iPad Gen 7, iPad Pro 11" (Safari)
- **Android**: Pixel 5 (Chrome)

### PR Testing Automation

**Pull Request Validation**:

- **Change Impact Analysis**: Focus testing on modified files
- **Coverage Analysis**: Track test coverage changes
- **Bundle Size Impact**: Monitor JavaScript bundle changes
- **Security Scanning**: Vulnerability assessment for new dependencies
- **Auto-Labeling**: Automatic PR categorization based on changes

**Quality Gates**:

- Unit/Integration: 100% pass rate required
- E2E Tests: 95% pass rate (allows network flakiness)
- Security: No high/critical vulnerabilities
- Performance: Within baseline thresholds

### Sharding Strategy

**4-Way Test Sharding**:

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]

# Shard execution
npm run test:parallel -- --shard=${{ matrix.shard }}/4
```

**Shard Distribution**:

- **Shard 1**: Unit tests (components, utilities)
- **Shard 2**: Integration tests (API, database)
- **Shard 3**: Store and hook tests
- **Shard 4**: Performance and edge case tests

### Performance Regression Testing

**Baseline Comparison**:

- **Reference File**: `performance-baseline.json`
- **Automated Detection**: Script `check-performance-regression.js`
- **Thresholds**: Configurable regression limits
- **Reporting**: Detailed performance impact analysis

**Metrics Tracked**:

- Test execution time
- Memory usage patterns
- Bundle size changes
- API response times

### Continuous Integration Strategy

### Test Execution Pipeline

1. **Smoke Tests** (2-3 min): Fast validation for immediate feedback
2. **PR Validation**: Lightweight testing focused on change impact
3. **Full Pipeline**: Complete test matrix on branch pushes
4. **Release Validation**: Enhanced quality gates for production releases

### Parallel Execution

**Unit/Integration Tests:**

- Thread pool with 4 max threads
- Resource management and cleanup
- 8-20 second total execution time
- 4-way sharding for CI/CD optimization

**E2E Tests:**

- Parallel browser execution across 8 profiles
- Device-specific test distribution
- Artifact collection (screenshots, videos, traces)
- Network-aware retry logic for flaky tests

## Error Handling and Debugging

### Test Failure Analysis

**Artifact Collection:**

- Screenshots on test failure
- Video recordings of test execution
- Network request traces
- Console log capture
- Performance metrics

**Debugging Tools:**

- Playwright UI mode for interactive debugging
- Headed browser mode for visual inspection
- Step-by-step execution capabilities
- Network inspection tools

### Common Failure Patterns

**Network Issues:**

- Tailscale connectivity problems
- Service unavailability
- Rate limiting responses

**Touch Target Issues:**

- iOS compliance violations
- Element spacing problems
- Touch response delays

**PWA Installation Issues:**

- Manifest validation failures
- Service Worker registration problems
- Installation banner timing

## Maintenance and Updates

### Test Suite Maintenance

**Regular Updates:**

- Browser version compatibility testing
- New device profile additions
- Test scenario expansion
- Performance benchmark updates

**Monitoring:**

- Test execution time tracking
- Failure rate monitoring
- Performance regression detection
- Coverage gap identification

### Browser API Mock Infrastructure (RR-222)

**Three-Tier Configurability Detection System:**

The RR-222 implementation establishes a sophisticated configurability detection architecture to handle jsdom thread pool isolation challenges:

**Implementation Architecture:**

- **Primary Strategy**: `Object.defineProperty` for clean property redefinition
- **Fallback Strategy**: `Storage.prototype` assignment when properties are non-configurable
- **Last Resort**: Direct window property assignment with type casting
- **Detection Logic**: Uses `Object.getOwnPropertyDescriptor` to assess configurability

**setupStorageMock Function (src/test-setup.ts:73-96):**

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

**Performance Characteristics:**

- **Detection Time**: <1ms per storage type
- **Success Rate**: 100% across all jsdom thread configurations
- **Memory Overhead**: Minimal (single Map instance per storage type)
- **Isolation**: Complete test-to-test state separation

**Validation Results:**

- **Test Discovery**: Restored from 0 to 1024+ test files
- **Contract Success**: 21/21 test contracts passing
- **Thread Safety**: Validated across parallel execution environments
- **Error Handling**: Graceful degradation with console warnings

### Test Infrastructure Improvements Needed (RR-206)

**Responsive Behavior Testing Infrastructure:**

The RR-206 responsive sidebar implementation highlighted several test infrastructure improvements needed for complex behavior testing:

**Current Status:**

- ✅ Simple unit tests: Passing (38/38)
- ❌ Complex behavior tests: Infrastructure issues (28/28 failed due to test setup)
- ✅ Manual verification: All acceptance criteria confirmed working

**Infrastructure Improvements Required:**

1. **Viewport Simulation in Tests**
   - Enhanced jsdom environment configuration for window resize simulation
   - Proper `window.innerWidth`/`window.innerHeight` mocking for responsive tests
   - Screen orientation change event simulation

2. **Component Interaction Testing**
   - Better DOM testing utilities for complex component interactions
   - Improved React Testing Library configuration for responsive components
   - Enhanced test environment for `useViewport()` hook testing

3. **Debounced Function Testing**
   - Proper timer mock configuration for 50ms debounce testing
   - Race condition prevention in tests with async state updates
   - More reliable async behavior validation patterns

4. **Media Query Testing**
   - Browser-like media query support in test environment
   - Breakpoint transition testing capabilities
   - CSS-in-JS responsive behavior validation

**Recommended Approach:**

- Focus on simple unit tests for logic validation
- Use manual testing for complex responsive behavior validation
- Gradually improve test infrastructure for future responsive features
- Consider Playwright component testing for complex UI behavior

**Impact:** While the RR-206 implementation works correctly in production, the test infrastructure needs enhancement to reliably test complex responsive behaviors automatically.

### Documentation Updates

This testing strategy document is updated with:

- New test scenarios and requirements
- Browser support matrix changes
- Performance target adjustments
- Tool and framework updates
- RR-206 test infrastructure improvement recommendations

## Quality Gates

### Git Pre-commit Hook (RR-210)

**Automated Quality Enforcement**: Every commit automatically triggers comprehensive validation through the git pre-commit hook:

**Pre-commit Validation Steps** (individual failure tracking with timeouts):

1. **Type Check** (30s timeout): `npm run type-check` - TypeScript compilation validation
2. **Lint Check** (30s timeout): `npm run lint` - ESLint code quality assessment
3. **Format Check** (30s timeout): `npm run format:check` - Prettier formatting validation
4. **OpenAPI Documentation** (60s timeout): `npm run docs:validate` - Ensures 100% API documentation coverage (45/45 endpoints)

**Hook Features:**

- **Individual Failure Tracking**: Each validation step tracked separately for precise error reporting
- **Graceful Fallback**: Continues when development server unavailable, warns about OpenAPI validation skip
- **Clear Error Messages**: Specific recovery instructions for common failure scenarios
- **Performance Optimized**: Completes in under 90 seconds with early termination on critical failures
- **Non-destructive**: Allows `--no-verify` bypass for emergency situations

**Hook Integration Test Coverage**: Comprehensive test suite at `src/__tests__/integration/rr-210-git-hook.test.ts` with 19 test scenarios covering:

- Hook installation and permissions
- Individual validation step failures
- Timeout handling and network issues
- Error message formatting and recovery guidance
- Integration with existing npm run pre-commit workflow

### Pre-Deployment Requirements

**All Tests Must Pass:**

- Unit tests: 100% passing
- Integration tests: 100% passing
- E2E tests: 95% passing (allowing for flaky network conditions)
- Pre-commit validation: 100% passing (enforced automatically)

**Code Quality Thresholds:**

- TypeScript compilation: 100% success (enforced by pre-commit hook)
- ESLint validation: 100% success (enforced by pre-commit hook)
- Code formatting: 100% Prettier compliance (validated by pre-commit hook)
- API documentation: 100% OpenAPI coverage - all 45 endpoints documented (enforced by pre-commit hook)

**Performance Thresholds:**

- Test execution: < 30 seconds total
- Page load times: < 2 seconds
- Touch response: < 100ms
- Sync operations: < 5 seconds

**Accessibility Requirements:**

- ARIA compliance validation
- Keyboard navigation support
- Touch target size compliance
- Screen reader compatibility

---

This testing strategy ensures comprehensive validation of the RSS News Reader across all supported platforms and devices, with particular emphasis on mobile PWA functionality and iOS touch interaction compliance.
