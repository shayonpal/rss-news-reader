# Safe Test Practices for RSS News Reader

_Documentation for RR-123 memory exhaustion fix_

## Overview

The RSS News Reader project experienced critical memory exhaustion issues during test execution that could freeze the development machine and require hard reboots. This document outlines the safe practices implemented to prevent test runner memory overruns and system instability.

### The Memory Exhaustion Problem

**Symptoms observed:**

- Vitest spawning excessive worker processes (6-8+ concurrent forks)
- Memory usage climbing to 4-8GB+ during test runs
- System freezing requiring hard reboot
- Test processes becoming unresponsive and unkillable
- PM2 services crashing due to resource starvation

**Root causes identified:**

- Vitest's default pooling strategy spawning too many worker processes
- No resource limits on test execution time or memory usage
- Integration tests running alongside unit tests without isolation
- Missing process monitoring and automatic cleanup mechanisms

## Safe Test Execution

### Primary Command (Recommended)

```bash
npm test
```

This command runs the **optimized test runner** (RR-183) that completes in 8-20 seconds with all protective measures:

- **Thread Pool Optimization**: Uses threads pool with 4 max threads for optimal performance
- **Fast Execution**: Completes full test suite in 8-20 seconds (vs previous 2+ minute timeouts)
- **Resource Management**: Comprehensive cleanup hooks prevent memory leaks and process accumulation
- **Execution Monitoring**: Real-time progress tracking and automatic resource monitoring
- **CI/CD Ready**: Reliable execution under 10-minute timeout for continuous integration

### New Optimized Test Execution Modes (RR-183)

```bash
# Default optimized execution (fastest)
npm test

# Alternative execution strategies
npm run test:parallel     # Maximum parallelization (fastest, ~8-12 seconds)
npm run test:sequential   # Sequential execution (most reliable, ~15-20 seconds)
npm run test:sharded      # Sharded execution (balanced, ~10-15 seconds)
npm run test:progressive  # Progressive execution (detailed feedback)
npm run test:watch        # Watch mode for development

# Legacy safe runner (slower but very conservative)
./scripts/safe-test-runner.sh
```

### Test Infrastructure Requirements (RR-186)

**Browser API Polyfills:**

- **IndexedDB Polyfill**: `fake-indexeddb` v6.1.0 automatically provides IndexedDB compatibility for Node.js test environment
- **Auto-import**: Automatically initialized in `src/test-setup.ts` via `import 'fake-indexeddb/auto';`
- **Use Case**: Essential for testing Dexie database operations, offline queues, and browser storage functionality

**Environment Validation:**

- **Smoke Test**: `src/__tests__/unit/test-setup.smoke.test.ts` validates test environment setup
- **Mock Validation**: Ensures localStorage/sessionStorage mocks are properly configured
- **Polyfill Verification**: Confirms IndexedDB polyfill is available and functional

**API Testing Improvements (RR-102):**

- **Path Flexibility**: Development environment supports both `/api/*` and `/reader/api/*` paths via automatic redirects
- **Test Reliability**: Tests no longer fail due to missing `/reader` prefix in API calls - automatic 307 redirects handle path variations
- **HTTP Method Preservation**: All test requests (GET, POST, PUT, DELETE, PATCH) work correctly regardless of path format used

**Mock System Improvements:**

- **Storage Mocks**: Fixed localStorage/sessionStorage configuration with `writable: true, configurable: true`
- **Supabase Helper**: Reusable mock at `src/__tests__/helpers/supabase-mock.ts` with method chaining support
- **Export Fixes**: Corrected missing exports in utility classes for proper testability

### Store Isolation Testing Patterns (RR-188)

**Zustand Store State Isolation:**
The RSS News Reader implements sophisticated store isolation patterns to prevent state leakage in parallel test execution environments, particularly critical for CI/CD pipeline compatibility.

**Store Isolation Infrastructure:**

- **Isolated Store Creation**: `src/lib/stores/__tests__/test-utils.ts` provides `createIsolatedUIStore()` utility
- **Unique Storage Keys**: Each test gets unique storage identifiers preventing cross-test contamination
- **Boolean State Management**: Enhanced null/undefined handling in store logic with Boolean coercion
- **Parallel Test Support**: Fully compatible with Vitest's parallel execution without state persistence issues

**Critical CI/CD Fix (RR-188):**

- **Problem**: UI store collapse state persisting across tests in CI environment causing 4/6 test failures
- **Solution**: Store isolation utilities with unique storage keys for each test execution
- **Impact**: Unblocked CI/CD pipeline that was previously failing due to parallel test state contamination

**Usage Pattern:**

```typescript
import { createIsolatedUIStore } from "./test-utils";

describe("UI Store Collapse State Tests", () => {
  let store: ReturnType<typeof createIsolatedUIStore>;

  beforeEach(() => {
    // Each test gets isolated store with unique storage keys
    store = createIsolatedUIStore();
  });

  it("should manage collapse state independently", () => {
    // Test implementation with guaranteed state isolation
    store.getState().toggleFeedsCollapse();
    expect(store.getState().isFeedsCollapsed).toBe(true);
  });
});
```

**Benefits:**

- **Parallel Test Safety**: No state leakage between concurrent test executions
- **CI/CD Compatibility**: Eliminates CI pipeline blocking due to test failures
- **Deterministic Results**: Consistent test outcomes regardless of execution order
- **Development Productivity**: Reliable local test execution in parallel mode

### Legacy Commands (Use with Caution)

```bash
# Unit tests only (bypasses optimizations)
npm run test:unit

# Integration tests only (requires stopping PM2 services)
npm run test:integration:safe

# Manual vitest execution (NOT RECOMMENDED)
npx vitest run  # ⚠️ Can cause memory exhaustion
```

**Warning**: Never run `npx vitest` directly without the safe runner. This bypasses all protective measures and can cause system instability.

## Resource Limits Implementation

### Vitest Configuration Limits (RR-183 Optimized)

**Optimized Configuration (`vitest.config.ts`):**

```javascript
pool: 'threads',          // ✅ Switched from forks to threads for better performance
poolOptions: {
  threads: {
    maxThreads: 4,        // ✅ Optimal thread count for performance
    minThreads: 1,        // Minimum thread allocation
  },
},
testTimeout: 5000,        // ✅ Reduced from 30s to 5s for faster execution
hookTimeout: 5000,        // ✅ Reduced hook timeout for efficiency
fileParallelism: true,    // ✅ Enable file-level parallelism
testConcurrency: 5,       // ✅ Multiple tests per thread
```

**Performance Improvements:**

- **Execution Time**: 8-20 seconds (vs previous 2+ minute timeouts)
- **Thread Pool**: Optimized threading prevents process accumulation
- **Memory Usage**: Stable usage with comprehensive cleanup hooks
- **Timeout Handling**: Faster timeouts catch hanging tests quickly

**Integration Tests (`vitest.config.integration.ts`):**

```javascript
// Same limits as unit tests
// Separate configuration for isolation
environment: "node",      // Node environment for API tests
include: ['**/src/__tests__/integration/**']
```

### Safe Test Runner Limits

**Process Management:**

- **Lock File**: `/tmp/rss-reader-test.lock` prevents concurrent test runs
- **Process Monitoring**: Background monitor kills tests if >4 vitest processes detected
- **Memory Monitoring**: Warns when system memory <1GB free
- **Runtime Limit**: 30-minute maximum execution time with automatic termination

**Execution Flow:**

1. Pre-execution cleanup (kill existing vitest processes)
2. Create lock file with current PID
3. Start background resource monitoring
4. Run unit tests with timeout protection
5. Pause between test suites (2-second cooldown)
6. Run integration tests with timeout protection
7. Automatic cleanup (kill monitors, remove lock, check for orphans)

## Emergency Procedures

### When Tests Go Wrong

**Immediate Response:**

```bash
# Emergency test process killer
./scripts/kill-test-processes.sh
```

This script performs aggressive cleanup:

- Kills all vitest and node test processes (SIGTERM then SIGKILL)
- Removes test lock files
- Cleans up zombie processes
- Shows memory status before/after
- Restarts any crashed PM2 services

**System Recovery Steps:**

1. Run the emergency killer script
2. Wait 10-15 seconds for cleanup completion
3. Check system memory usage: `vm_stat` (macOS) or `free -h` (Linux)
4. Verify PM2 services are running: `pm2 status`
5. Restart PM2 if needed: `pm2 restart all`
6. Test with safe runner: `npm test`

### When System Becomes Unresponsive

If the emergency script doesn't work because the system is too overloaded:

**macOS:**

1. Force quit Terminal: `Cmd+Option+Esc` → Terminal → Force Quit
2. Open Activity Monitor and force quit vitest/node processes
3. If completely frozen: Hold power button for hard restart

**Linux:**

1. Switch to TTY: `Ctrl+Alt+F2`
2. Login and run: `sudo pkill -9 vitest && sudo pkill -9 node`
3. If unresponsive: `sudo reboot`

## Monitoring Test Execution

### Real-Time Process Monitor

```bash
./scripts/monitor-test-processes.sh
```

This provides a live dashboard showing:

- **Memory Usage**: Current system memory with color-coded warnings
- **Process Count**: Number of active vitest processes
- **Process Details**: PID, memory usage, CPU%, runtime for each test process
- **PM2 Status**: Status of RSS reader services
- **Test Lock Status**: Whether tests are currently running

**Status Indicators:**

- 🟢 **Green**: Normal operation (memory <3GB, processes <3)
- 🟡 **Yellow**: Warning levels (memory 3-4GB, processes 3-4)
- 🔴 **Red**: Critical levels (memory >4GB, processes >4)

### Monitoring Best Practices

1. **Always monitor during development**: Run the monitor in a separate terminal
2. **Watch for warnings**: Yellow indicators suggest stopping tests before they become critical
3. **Act on red alerts**: Immediately run emergency cleanup if critical levels are reached
4. **Check after test completion**: Verify no orphaned processes remain

## Tag System Testing (RR-128)

### Test Categories for Tags Feature

**API Tests:**

- Tag creation and validation (`/api/tags POST`)
- Tag listing with filtering and pagination (`/api/tags GET`)
- Article tag retrieval (`/api/articles/[id]/tags GET`)
- HTML entity decoding and React XSS protection in all endpoints
- Error handling for duplicate tags and invalid input

**Integration Tests:**

- Tag sync from Inoreader categories during sync operations
- Article-tag relationship management in database
- Tag count maintenance and updates
- Database constraint validation (unique slugs, foreign keys)

**E2E Tests:**

- Tag display in sidebar "Topics" section
- Tag filtering and search functionality
- Tag creation through UI forms
- Tag association with articles
- XSS protection via React's built-in safeguards for tag names

**Unit Tests:**

- Tag store state management
- Tag utility functions (slug generation, HTML entity decoding)
- Tag component rendering and interactions
- Tag validation logic

## End-to-End (E2E) Testing Best Practices (RR-184)

The RSS News Reader implements comprehensive E2E testing using Playwright with focus on cross-browser compatibility and iPhone button tappability validation.

### E2E Test Guidelines

**✅ DO:**

- Use the optimized Playwright configuration with 8 browser profiles
- Test across desktop browsers (Chromium, Firefox, WebKit) and mobile devices (iPhone, iPad, Android)
- Validate touch target compliance (44x44px iOS guidelines) in iPhone tests
- Include network requirements verification (Tailscale connectivity)
- Test real user workflows end-to-end without mocking core functionality
- Capture artifacts (screenshots, videos, traces) on test failures
- Validate PWA installation and service worker functionality
- Test touch interactions and gesture support on mobile devices

**❌ DON'T:**

- Run E2E tests without Tailscale VPN connection
- Mock Supabase or core application APIs in E2E tests
- Test on browsers not included in the configuration
- Skip mobile-specific validation for touch interactions
- Run E2E tests in CI without proper network access

### E2E Test Execution

```bash
# Recommended E2E testing commands
npm run test:e2e                    # All browsers and devices
npx playwright test src/__tests__/e2e/rr-184-core-user-journeys.spec.ts
npx playwright test src/__tests__/e2e/iphone-button-tappability.spec.ts

# Mobile-specific testing
npx playwright test --project="Mobile Safari"      # iPhone 14
npx playwright test --project="Mobile Safari Large" # iPhone 14 Pro Max
npx playwright test --project="iPad Safari"        # iPad devices

# Debug mode
npx playwright test --headed --debug
npx playwright test --ui
```

### iPhone Button Tappability Testing

The iPhone button tappability test suite validates iOS Human Interface Guidelines compliance:

**Touch Target Size Validation:**

```javascript
test("All buttons meet iOS 44px minimum touch target", async ({ page }) => {
  await page.goto("/reader");

  const buttons = await page.locator('button, [role="button"], a').all();
  const violations = [];

  for (const button of buttons) {
    const box = await button.boundingBox();
    if (box && (box.width < 44 || box.height < 44)) {
      violations.push({
        element: (await button.textContent()) || "unlabeled",
        size: `${box.width}x${box.height}`,
      });
    }
  }

  expect(violations).toEqual([]);
});
```

**Element Spacing Validation:**

- Minimum 8px spacing between interactive elements
- Automated detection of spacing violations
- Visual feedback validation for touch interactions

### Cross-Browser Testing Matrix

| Test Scenario      | Chrome | Firefox | Safari | Mobile Safari | iPad Safari | Android |
| ------------------ | ------ | ------- | ------ | ------------- | ----------- | ------- |
| Core User Journeys | ✅     | ✅      | ✅     | ✅            | ✅          | ✅      |
| Button Tappability | ✅     | ✅      | ✅     | ✅            | ✅          | ✅      |
| PWA Installation   | ✅     | ✅      | ✅     | ✅            | ✅          | ✅      |
| Touch Gestures     | N/A    | N/A     | N/A    | ✅            | ✅          | ✅      |
| ARIA Accessibility | ✅     | ✅      | ✅     | ✅            | ✅          | ✅      |

### Mobile PWA Testing Requirements

**Network Requirements:**

- Tailscale VPN connection required
- Base URL: `http://100.96.166.53:3000/reader`
- No authentication needed (network-based access control)

**Touch Interaction Testing:**

- Swipe gesture recognition (left, right, up, down)
- Pull-to-refresh functionality validation
- Touch response time testing (< 100ms requirement)
- Modal and dropdown accessibility via touch

**PWA Functionality Testing:**

- Web App Manifest validation
- Service Worker registration and offline capabilities
- Installation banner tappability
- Post-installation functionality verification

### E2E Test Structure Example

```javascript
// Core user journey test structure
test("Article reading workflow", async ({ page }) => {
  // Network connectivity verification
  await expect(page).toHaveURL(/\/reader/);

  // Navigate through feeds
  await page.click('[data-testid="feed-item"]:first-child');
  await page.waitForLoadState("networkidle");

  // Select and read article
  await page.click('[data-testid="article-item"]:first-child');
  await expect(page.locator('[data-testid="article-title"]')).toBeVisible();

  // Validate navigation back
  await page.click('[data-testid="back-button"]');
  await expect(page).toHaveURL(/\/reader\/feeds\//);
});
```

### E2E Test Debugging

**Visual Debugging:**

- Use `--headed` flag for browser UI
- Use `--debug` flag for step-by-step execution
- Use `--ui` flag for Playwright UI mode

**Artifact Analysis:**

- Screenshots captured on failure
- Video recordings for complete test execution
- Network traces for API call analysis
- Console logs for JavaScript errors

### Performance Testing in E2E

**Load Time Validation:**

```javascript
test("Page load performance", async ({ page }) => {
  const startTime = Date.now();
  await page.goto("/reader");
  await page.waitForLoadState("networkidle");
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(2000); // 2-second target
});
```

**Touch Response Time:**

```javascript
test("Touch interactions respond quickly", async ({ page }) => {
  test.skip(browserName === "chromium", "Mobile only");

  const startTime = Date.now();
  await page.tap('[data-testid="sidebar-toggle"]');
  await page.waitForSelector('[data-testid="sidebar"]', { state: "visible" });
  const responseTime = Date.now() - startTime;

  expect(responseTime).toBeLessThan(100); // iOS responsiveness requirement
});
```

### E2E Test File Organization

```
src/__tests__/e2e/
├── rr-184-core-user-journeys.spec.ts     # Main user workflow tests
├── iphone-button-tappability.spec.ts     # iOS touch compliance tests
├── pwa-installation.spec.ts              # PWA functionality tests
├── cross-browser-validation.spec.ts      # Browser compatibility tests
└── performance-validation.spec.ts        # Load time and response tests
```

### Tag Test File Locations

```
src/__tests__/
├── api/
│   └── tags.test.ts                    # API endpoint tests
├── integration/
│   ├── tags-api.test.ts               # Integration API tests
│   ├── tags-sync.test.ts              # Tag sync integration
│   └── rr-128-tags-e2e.test.ts       # End-to-end tag tests
├── stores/
│   └── tag-store.test.ts              # Tag store unit tests
├── unit/
│   └── tags-schema.test.ts            # Tag validation tests
└── e2e/
    ├── tags-functionality.spec.ts     # E2E tag functionality
    └── tags-article-detail.spec.ts    # E2E article tag tests
```

## Memory-Efficient Test Writing

### Unit Test Guidelines

**✅ DO:**

- Mock external dependencies (Supabase, APIs)
- Use `vi.clearAllMocks()` in `afterEach` hooks to prevent mock contamination (RR-182)
- Wrap async React state updates in `act()` to prevent race conditions (RR-182)
- Avoid large data structures in test fixtures
- Test single units of functionality
- Use focused tests with `.only()` during development
- Include all required properties in article mocks (e.g., `parseAttempts`) (RR-182)

**❌ DON'T:**

- Make real database connections in unit tests
- Load large JSON fixtures (>100KB)
- Create multiple instances of React components simultaneously
- Use `describe.concurrent()` or `test.concurrent()`
- Leave mocks hanging between tests
- Forget to wrap async state changes in `act()` when testing React components

### Integration Test Guidelines

**✅ DO:**

- Use separate test database for integration tests
- Clean up test data in `afterAll` hooks
- Mock external APIs (Inoreader, Claude)
- Test API endpoints in isolation
- Limit concurrent database connections
- Test tag-related API endpoints with proper data isolation (RR-128)
- Verify HTML entity decoding in tag creation and retrieval tests

**❌ DON'T:**

- Run integration tests alongside unit tests
- Use production database
- Test multiple API endpoints simultaneously
- Create test data without cleanup
- Mock core application logic (test the real implementation)
- Test tags functionality without verifying React's XSS protection and HTML entity decoding

### Example: Memory-Safe Test Structure

```javascript
describe("Article Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any singleton state
  });

  afterEach(() => {
    // Clean up any test-specific state
    cleanup();
  });

  test("should fetch articles safely", async () => {
    // Small, focused test with mocked data
    const mockArticles = [{ id: 1, title: "Test", content: "Brief content" }];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockArticles }),
    });

    // Test single functionality
    const result = await articleStore.fetchArticles();
    expect(result).toEqual(mockArticles);
  });
});
```

### React Testing Race Conditions (RR-182)

**⚠️ Race Condition Prevention**: React Testing Library tests can fail intermittently due to race conditions in async state updates. The RR-182 fixes established best practices:

**✅ DO:**

```javascript
import { act } from "@testing-library/react";

test("async state updates", async () => {
  const { result } = renderHook(() => useAutoParseContent(article));

  // ✅ Wrap async state changes in act()
  await act(async () => {
    await result.current.triggerParse();
  });

  expect(result.current.parsedContent).toBeDefined();
});
```

**❌ DON'T:**

```javascript
test("async state updates - RACE CONDITION", async () => {
  const { result } = renderHook(() => useAutoParseContent(article));

  // ❌ Missing act() wrapper causes race conditions
  await result.current.triggerParse();

  // ❌ May fail due to timing issues
  expect(result.current.parsedContent).toBeDefined();
});
```

**Mock Cleanup Best Practices (RR-182):**

```javascript
describe("Component Tests", () => {
  beforeEach(() => {
    // ✅ Clear all mocks to prevent contamination
    vi.clearAllMocks();

    // ✅ Reset fetch mocks with consistent responses
    global.fetch = vi.fn();
  });

  test("should handle fetch calls consistently", async () => {
    // ✅ Mock returns expected values every time
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: "test" }),
    });

    // Test execution...
  });
});
```

**Complete Article Mock Example (RR-182):**

```javascript
const mockArticle = {
  id: "test-id",
  title: "Test Article",
  content: "<p>Short content</p>",
  full_content: null,
  parseAttempts: 0, // ✅ Required for shouldShowRetry logic
  parseFailed: false, // ✅ Required for retry state
  feed: {
    isPartialContent: true, // ✅ Required for auto-parse logic
  },
};
```

## Troubleshooting Common Issues

### "Tests are already running" Error

**Problem**: Lock file exists from previous crashed test run

**Solution:**

```bash
# Check if tests are actually running
ps aux | grep vitest

# If no processes found, remove lock file
rm /tmp/rss-reader-test.lock

# Run tests again
npm test
```

### High Memory Usage Warnings

**Problem**: System memory usage approaching critical levels

**Actions:**

1. Stop current tests: `Ctrl+C` in test terminal
2. Run emergency cleanup: `./scripts/kill-test-processes.sh`
3. Check for other memory-heavy processes: `Activity Monitor` (macOS) or `htop` (Linux)
4. Close unnecessary applications
5. Restart tests: `npm test`

### PM2 Services Crashing During Tests

**Problem**: RSS reader services stop working during test execution

**Diagnosis:**

```bash
pm2 status
pm2 logs rss-reader-dev --lines 20
```

**Solution:**

```bash
# Restart all services
pm2 restart all

# If persistent, allocate more memory to PM2
pm2 delete all
pm2 start ecosystem.config.js
```

### Vitest Hanging or Unresponsive

**Problem**: Tests start but never complete, no output for >5 minutes

**Immediate Action:**

```bash
# Emergency kill
./scripts/kill-test-processes.sh

# Check for remaining processes
ps aux | grep vitest
```

**Prevention:**

- Always use `npm test` instead of direct vitest commands
- Monitor resource usage during test development
- Write smaller, focused tests
- Mock external dependencies properly

### Out of Memory Errors

**Problem**: Node.js heap allocation failures

**Error Messages:**

```
FATAL ERROR: Ineffective mark-compacts near heap limit
JavaScript heap out of memory
```

**Recovery:**

1. Force kill all Node processes: `pkill -9 node`
2. Clear Node modules cache: `npm run clean`
3. Restart development environment: `pm2 restart all`
4. Increase Node memory if needed: `export NODE_OPTIONS="--max-old-space-size=4096"`

### IndexedDB Test Failures (RR-186)

**Problem**: Tests fail with "IDBDatabase is not defined" or similar IndexedDB-related errors

**Error Messages:**

```
ReferenceError: IDBDatabase is not defined
TypeError: Cannot read properties of undefined (reading 'open')
Error: Dexie: TypeError: IDBKeyRange is undefined
```

**Diagnosis:**

```bash
# Check if fake-indexeddb is installed
npm list fake-indexeddb

# Verify test setup imports polyfill
grep -n "fake-indexeddb" src/test-setup.ts

# Run smoke test to validate environment
npm test src/__tests__/unit/test-setup.smoke.test.ts
```

**Solution:**

1. Ensure `fake-indexeddb` dependency is installed: `npm install --save-dev fake-indexeddb@^6.1.0`
2. Verify polyfill import in `src/test-setup.ts`: `import 'fake-indexeddb/auto';`
3. Run environment validation: `npm test src/__tests__/unit/test-setup.smoke.test.ts`
4. If issues persist, manually import in test file: `import 'fake-indexeddb/auto';`

**Prevention:**

- Always run smoke test before developing new storage-dependent tests
- Use provided Supabase mock helper instead of manual mocking
- Import `fake-indexeddb/auto` at the top of any test file using Dexie or IndexedDB

### localStorage/sessionStorage Mock Crashes (RR-186)

**Problem**: Tests crash when accessing browser storage APIs

**Error Messages:**

```
TypeError: Cannot redefine property: localStorage
TypeError: Cannot define property sessionStorage, object is not extensible
```

**Solution:**

1. Use properly configured mocks from test setup (automatically applied)
2. Avoid manual redefinition of storage APIs in individual tests
3. If custom mocking needed, use the provided mock helpers

**Correct Usage:**

```javascript
// ✅ Uses automatically configured mocks from test setup
test("storage functionality", () => {
  localStorage.setItem("key", "value");
  expect(localStorage.getItem("key")).toBe("value");
});
```

**Avoid:**

```javascript
// ❌ Don't manually redefine storage APIs
Object.defineProperty(window, 'localStorage', { ... });
```

## localStorage Performance Testing Patterns (RR-197)

**Three-Tier Architecture Testing:**
The RR-197 localStorage optimization introduces sophisticated performance testing patterns to validate the three-tier architecture (localStorage → Memory → Database) and ensure performance targets are met.

**Performance Testing Components:**

```typescript
// Performance test utilities for RR-197
import {
  LocalStorageQueue,
  PerformanceMonitor,
  ArticleCounterManager,
} from "@/lib/utils";

describe("RR-197 localStorage Performance", () => {
  let performanceMonitor: PerformanceMonitor;
  let localStorageQueue: LocalStorageQueue;
  let counterManager: ArticleCounterManager;

  beforeEach(() => {
    // Initialize isolated testing environment
    localStorage.clear();
    performanceMonitor = new PerformanceMonitor({
      targetFps: 60,
      maxResponseTime: 1,
    });
    localStorageQueue = new LocalStorageQueue();
    counterManager = new ArticleCounterManager();
  });

  test("localStorage operations complete under 1ms", () => {
    const operation = () => {
      localStorageQueue.enqueue({
        articleId: "test-article",
        updates: { isRead: true },
        timestamp: Date.now(),
      });
    };

    const metrics = performanceMonitor.monitorOperation(operation);
    expect(metrics.duration).toBeLessThan(1); // <1ms target
    expect(metrics.withinTarget).toBe(true);
  });

  test("FIFO cleanup prevents localStorage bloat", () => {
    // Add 1000+ operations to test cleanup
    for (let i = 0; i < 1200; i++) {
      localStorageQueue.enqueue({
        articleId: `article-${i}`,
        updates: { isRead: true },
        timestamp: Date.now(),
      });
    }

    const operations = localStorageQueue.getOperations();
    expect(operations.length).toBeLessThanOrEqual(1000); // FIFO limit
    expect(operations[0].articleId).toBe("article-200"); // First 200 removed
  });

  test("race condition prevention in counter updates", () => {
    const processedEntries = new Set<string>();

    // Simulate rapid article marking (5+ per second)
    const articleIds = ["article-1", "article-2", "article-3", "article-1"]; // Duplicate

    articleIds.forEach((id) => {
      const entryKey = `${id}-${Date.now()}`;

      if (!processedEntries.has(entryKey)) {
        processedEntries.add(entryKey);
        counterManager.updateCounters(id, false, true);
      }
    });

    // Verify no duplicate processing
    expect(processedEntries.size).toBe(4); // All entries tracked
    // Counter should only decrement 3 times (not 4 due to duplicate)
  });
});
```

**Integration Testing Patterns:**

```typescript
describe('RR-197 Integration Tests', () => {
  test('article marking with immediate UI feedback', async () => {
    const { user } = render(<ArticleList />);
    const markButton = screen.getByTestId('mark-read-button');

    // Measure UI response time
    const startTime = performance.now();
    await user.click(markButton);
    const responseTime = performance.now() - startTime;

    // Should show immediate visual feedback
    expect(responseTime).toBeLessThan(1); // <1ms target
    expect(screen.getByTestId('article-read-indicator')).toBeVisible();
  });

  test('database batching after 500ms', async () => {
    const mockDatabaseUpdate = vi.fn();
    const { user } = render(<ArticleList onDatabaseUpdate={mockDatabaseUpdate} />);

    // Rapid marking of multiple articles
    const buttons = screen.getAllByTestId('mark-read-button');
    for (const button of buttons.slice(0, 5)) {
      await user.click(button);
    }

    // Should not call database immediately
    expect(mockDatabaseUpdate).not.toHaveBeenCalled();

    // Should batch after 500ms
    await waitFor(() => {
      expect(mockDatabaseUpdate).toHaveBeenCalledOnce();
    }, { timeout: 600 });
  });
});
```

**Performance Benchmarking:**

```typescript
describe('RR-197 Performance Benchmarks', () => {
  test('maintains 60fps during rapid article marking', async () => {
    const { user } = render(<ArticleList articles={createMockArticles(100)} />);
    const markButtons = screen.getAllByTestId('mark-read-button');

    const frameRates: number[] = [];
    let lastFrameTime = performance.now();

    // Monitor frame rate during rapid interactions
    const frameObserver = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      frameRates.push(1000 / frameTime); // Convert to FPS
      lastFrameTime = currentTime;

      if (frameRates.length < 60) {
        requestAnimationFrame(frameObserver);
      }
    };

    requestAnimationFrame(frameObserver);

    // Rapid article marking (5 per second)
    for (let i = 0; i < 10; i++) {
      await user.click(markButtons[i]);
      await new Promise(resolve => setTimeout(resolve, 200)); // 5/sec
    }

    // Wait for frame rate collection
    await waitFor(() => {
      expect(frameRates.length).toBeGreaterThan(50);
    });

    // Calculate average FPS
    const averageFps = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
    expect(averageFps).toBeGreaterThan(55); // Target: 60fps (allow 5fps margin)
  });
});
```

**Memory Management Testing:**

```typescript
describe("RR-197 Memory Management", () => {
  test("graceful degradation when localStorage unavailable", () => {
    // Mock localStorage failure
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });

    const fallbackHandler = new LocalStorageFallback();

    expect(() => {
      fallbackHandler.enqueue({ articleId: "test", updates: { isRead: true } });
    }).not.toThrow();

    // Should fall back to memory-only mode
    expect(fallbackHandler.getMode()).toBe("memory-only");

    // Restore original
    localStorage.setItem = originalSetItem;
  });
});
```

**Key Testing Principles for RR-197:**

1. **Performance Validation**: Every operation tested against <1ms and 60fps targets
2. **Memory Management**: FIFO cleanup and quota handling tested extensively
3. **Race Condition Prevention**: Set-based tracking validated under rapid interaction scenarios
4. **Graceful Degradation**: Fallback behavior tested when localStorage unavailable
5. **Integration Testing**: End-to-end validation of three-tier architecture coordination

## Configuration Reference

### Test Scripts in package.json (RR-183 Updated)

```json
{
  "scripts": {
    "test": "./scripts/optimized-test-runner.sh", // ✅ Optimized execution (8-20s)
    "test:parallel": "vitest run --pool=threads --poolOptions.threads.maxThreads=4", // ✅ Fastest (8-12s)
    "test:sequential": "vitest run --pool=threads --poolOptions.threads.maxThreads=1", // ✅ Most reliable (15-20s)
    "test:sharded": "vitest run --pool=threads --shard=1/2", // ✅ Balanced (10-15s)
    "test:progressive": "vitest run --reporter=verbose", // ✅ Detailed feedback
    "test:watch": "vitest watch --pool=threads", // ✅ Development mode
    "test:legacy": "./scripts/safe-test-runner.sh", // ✅ Conservative fallback
    "test:unit": "vitest", // ⚠️ Bypasses optimizations
    "test:integration:safe": "pm2 stop rss-reader-dev && npm run test:integration && pm2 start rss-reader-dev" // ✅ Integration only
  }
}
```

**Script Recommendations:**

- **Default**: `npm test` - Optimized runner with monitoring (8-20s)
- **Development**: `npm run test:watch` - Real-time feedback during coding
- **CI/CD**: `npm run test:parallel` - Fastest execution for pipelines
- **Debugging**: `npm run test:sequential` - Most reliable for issue investigation

### Environment Variables for Testing

```bash
# Optional: Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Test database (integration tests)
SUPABASE_URL_TEST="your-test-database-url"
SUPABASE_ANON_KEY_TEST="your-test-anon-key"
```

### File Locations

- **Safe Test Runner**: `scripts/safe-test-runner.sh`
- **Emergency Cleanup**: `scripts/kill-test-processes.sh`
- **Process Monitor**: `scripts/monitor-test-processes.sh`
- **Unit Config**: `vitest.config.ts`
- **Integration Config**: `vitest.config.integration.ts`
- **Lock File**: `/tmp/rss-reader-test.lock`

## Best Practices Summary (Updated for RR-184)

### Unit and Integration Testing (RR-183)

1. **Always use `npm test`** for optimized execution (8-20 seconds)
2. **Choose appropriate test mode** based on your needs:
   - `npm run test:parallel` - Fastest for CI/CD
   - `npm run test:sequential` - Most reliable for debugging
   - `npm run test:watch` - Development mode with hot reload
3. **Write focused, isolated tests** that clean up after themselves
4. **Use act() wrappers** around async React state updates (RR-182)
5. **Clear mocks in beforeEach()** to prevent contamination (RR-182)
6. **Include required mock properties** (e.g., parseAttempts) (RR-182)
7. **Monitor execution time** - tests should complete under 30 seconds
8. **Use emergency cleanup** only if legacy scripts become unresponsive
9. **Mock external dependencies** to prevent resource leaks
10. **Keep test data small** and clean up thoroughly

### End-to-End Testing (RR-184)

11. **Use `npm run test:e2e`** for comprehensive cross-browser validation
12. **Test on all configured browsers and devices** (8 profiles total)
13. **Validate iPhone touch target compliance** (44x44px minimum)
14. **Ensure Tailscale VPN connectivity** before running E2E tests
15. **Test real user workflows** without mocking core application logic
16. **Capture test artifacts** (screenshots, videos, traces) for debugging
17. **Validate PWA installation** and service worker functionality
18. **Test touch interactions and gestures** on mobile devices
19. **Use `--headed` and `--debug` flags** for visual debugging
20. **Verify performance requirements** (< 2s load time, < 100ms touch response)

## Related Documentation

- [Test Configuration Documentation](./rr-119-test-report.md) - Details on test separation
- [RR-123 Test Plan Summary](./rr-123-test-plan-summary.md) - Memory exhaustion investigation
- [Testing Strategy](../tech/testing-strategy.md) - Comprehensive testing approach
- [E2E Testing Documentation](../tech/e2e-testing.md) - Playwright configuration and test suites
- [Project README](../../README.md) - Main project documentation and E2E testing overview
- [Health Monitoring](../monitoring/health-monitoring-overview.md) - System monitoring practices

---

_This documentation covers safe and optimized test execution for the RSS News Reader project. Originally created for RR-123 memory exhaustion fixes, updated for RR-183 performance optimizations, RR-184 E2E testing infrastructure, RR-186 test infrastructure enhancements, and RR-188 store isolation patterns. Last updated: Monday, August 11, 2025 at 4:25 PM_
