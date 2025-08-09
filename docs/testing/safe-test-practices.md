# Safe Test Practices for RSS News Reader

*Documentation for RR-123 memory exhaustion fix*

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

This command runs the `safe-test-runner.sh` script with all protective measures enabled:

- **Process Limiting**: Maximum 1 concurrent test suite, 2 vitest forks
- **Timeout Protection**: 30-second timeout per test, 15-minute total runtime limit
- **Resource Monitoring**: Background memory and process monitoring
- **Automatic Cleanup**: Kills orphaned processes on completion or failure
- **Lock File Protection**: Prevents multiple test runs from overlapping

### Alternative Commands (Use with Caution)

```bash
# Unit tests only (safer)
npm run test:unit

# Integration tests only (requires stopping PM2 services)
npm run test:integration:safe

# Manual vitest execution (NOT RECOMMENDED)
npx vitest run  # ⚠️ Can cause memory exhaustion
```

**Warning**: Never run `npx vitest` directly without the safe runner. This bypasses all protective measures and can cause system instability.

## Resource Limits Implementation

### Vitest Configuration Limits

**Unit Tests (`vitest.config.ts`):**
```javascript
pool: 'forks',
poolOptions: {
  forks: {
    singleFork: true,     // Force single fork mode
    maxForks: 2,          // Maximum 2 worker processes
  },
},
maxConcurrency: 1,        // Run tests sequentially
testTimeout: 30000,       // 30-second test timeout
hookTimeout: 30000,       // 30-second hook timeout
```

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
- HTML escaping and XSS protection in all endpoints
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
- XSS attack prevention in tag names

**Unit Tests:**
- Tag store state management
- Tag utility functions (slug generation, HTML escaping)
- Tag component rendering and interactions
- Tag validation logic

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
- Use `vi.clearAllMocks()` in `afterEach` hooks
- Avoid large data structures in test fixtures
- Test single units of functionality
- Use focused tests with `.only()` during development

**❌ DON'T:**
- Make real database connections in unit tests
- Load large JSON fixtures (>100KB)
- Create multiple instances of React components simultaneously
- Use `describe.concurrent()` or `test.concurrent()`
- Leave mocks hanging between tests

### Integration Test Guidelines

**✅ DO:**
- Use separate test database for integration tests
- Clean up test data in `afterAll` hooks
- Mock external APIs (Inoreader, Claude)
- Test API endpoints in isolation
- Limit concurrent database connections
- Test tag-related API endpoints with proper data isolation (RR-128)
- Verify HTML escaping in tag creation and retrieval tests

**❌ DON'T:**
- Run integration tests alongside unit tests
- Use production database
- Test multiple API endpoints simultaneously
- Create test data without cleanup
- Mock core application logic (test the real implementation)
- Test tags functionality without proper XSS protection verification

### Example: Memory-Safe Test Structure

```javascript
describe('Article Store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset any singleton state
  })

  afterEach(() => {
    // Clean up any test-specific state
    cleanup()
  })

  test('should fetch articles safely', async () => {
    // Small, focused test with mocked data
    const mockArticles = [
      { id: 1, title: 'Test', content: 'Brief content' }
    ]
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockArticles })
    })
    
    // Test single functionality
    const result = await articleStore.fetchArticles()
    expect(result).toEqual(mockArticles)
  })
})
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

## Configuration Reference

### Test Scripts in package.json

```json
{
  "scripts": {
    "test": "./scripts/safe-test-runner.sh",           // ✅ Safe execution
    "test:unit": "vitest",                             // ⚠️ Use cautiously
    "test:integration": "vitest run --config vitest.config.integration.ts", // ⚠️ Use cautiously
    "test:integration:safe": "pm2 stop rss-reader-dev && npm run test:integration && pm2 start rss-reader-dev" // ✅ Safer
  }
}
```

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

## Best Practices Summary

1. **Always use `npm test`** for safe execution
2. **Monitor resource usage** during test development
3. **Write focused, isolated tests** that clean up after themselves
4. **Never run multiple test suites concurrently**
5. **Use emergency cleanup** if tests become unresponsive
6. **Check PM2 services** after test completion
7. **Mock external dependencies** to prevent resource leaks
8. **Keep test data small** and clean up thoroughly

## Related Documentation

- [Test Configuration Documentation](./rr-119-test-report.md) - Details on test separation
- [RR-123 Test Plan Summary](./rr-123-test-plan-summary.md) - Memory exhaustion investigation
- [Project README](../../README.md) - Main project documentation
- [Health Monitoring](../monitoring/health-monitoring-overview.md) - System monitoring practices

---

*This documentation is part of the RR-123 initiative to ensure safe and reliable test execution for the RSS News Reader project. Last updated: Saturday, August 2, 2025 at 11:56 AM*