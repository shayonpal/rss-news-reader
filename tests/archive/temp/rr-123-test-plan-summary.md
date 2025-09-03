# RR-123 Test Plan Summary: Fix Test Runner Memory Exhaustion

**Linear Issue:** RR-123  
**Problem:** Test runner spawns 8 vitest processes consuming 36GB+ memory, crashing all services  
**Solution:** Sequential test execution, resource limits, safe test runner script

## Test Coverage Overview

This comprehensive test suite covers all aspects of the memory exhaustion fix with 5 dedicated test files:

### 1. Unit Tests for Configuration Changes

**File:** `src/__tests__/test-configuration/rr-123-test-runner-memory-fix.test.ts`

**Purpose:** Validates configuration changes prevent double test execution

- ✅ Package.json script fixes (no more "vitest run && vitest run")
- ✅ Vitest config resource limits (maxConcurrency: 1-2)
- ✅ Safe test runner script existence and functionality
- ✅ Emergency cleanup procedures
- ✅ CI/CD integration safety

**Key Test Categories:**

- Package.json Configuration Tests (6 tests)
- Vitest Configuration Tests (4 tests)
- Safe Test Runner Script Tests (2 tests)
- Memory and Resource Monitoring Tests (3 tests)
- Process Cleanup and Recovery Tests (2 tests)
- CI/CD Integration Tests (1 test)
- Documentation and Recovery Tests (2 tests)

### 2. Integration Tests for Script Behavior

**File:** `src/__tests__/integration/rr-123-safe-test-execution.test.ts`

**Purpose:** Validates integrated system behavior under realistic conditions

- ✅ Safe test runner execution without memory spikes
- ✅ Concurrent execution prevention
- ✅ Process cleanup on termination
- ✅ Resource limit enforcement
- ✅ Emergency recovery procedures
- ✅ PM2 service stability

**Key Test Categories:**

- Safe Test Runner Script Integration (3 tests)
- Vitest Configuration Integration (3 tests)
- Emergency Recovery Integration (3 tests)
- Resource Monitoring Integration (2 tests)

### 3. Edge Cases and Failure Scenarios

**File:** `src/__tests__/edge-cases/rr-123-memory-exhaustion-scenarios.test.ts`

**Purpose:** Ensures robustness under adverse conditions

- ✅ Concurrent test execution prevention
- ✅ Resource exhaustion scenarios (low memory, CPU overload, disk space)
- ✅ Process management edge cases (zombies, unresponsive processes)
- ✅ Configuration error handling
- ✅ System resource limits

**Key Test Categories:**

- Concurrent Test Execution Prevention (3 tests)
- Resource Exhaustion Scenarios (3 tests)
- Process Management Edge Cases (3 tests)
- Configuration Error Scenarios (3 tests)
- System Resource Edge Cases (2 tests)

### 4. Acceptance Criteria Verification

**File:** `src/__tests__/acceptance/rr-123-acceptance-criteria.test.ts`

**Purpose:** Validates all Linear issue acceptance criteria are met

- ✅ npm test only runs tests once
- ✅ Vitest config has resource limits (max 2 concurrent forks)
- ✅ Safe test runner script with timeouts and cleanup
- ✅ Test monitoring script to check for orphaned processes
- ✅ Documentation on safe test practices
- ✅ Emergency kill commands documented

**Key Test Categories:**

- Acceptance Criteria 1: Single Test Execution (2 tests)
- Acceptance Criteria 2: Resource Limits (4 tests)
- Acceptance Criteria 3: Safe Test Runner (3 tests)
- Acceptance Criteria 4: Process Monitoring (2 tests)
- Acceptance Criteria 5: Documentation (2 tests)
- Acceptance Criteria 6: Emergency Procedures (3 tests)
- Overall System Validation (2 tests)

### 5. Performance and Resource Usage Validation

**File:** `src/__tests__/performance/rr-123-resource-usage-validation.test.ts`

**Purpose:** Quantitative validation of resource usage improvements

- ✅ Memory usage limits (< 1GB total, no leaks)
- ✅ Process count limits (< 4 vitest processes)
- ✅ System performance maintenance
- ✅ Resource limit compliance
- ✅ Stress testing

**Key Test Categories:**

- Memory Usage Validation (3 tests)
- Process Count Validation (3 tests)
- System Performance Validation (3 tests)
- Resource Limit Compliance (2 tests)
- Stress Testing (1 test)

## Critical Resource Limits Tested

### Memory Limits

- **Total Memory Usage:** < 1GB during test execution
- **Per-Process Memory:** < 512MB per vitest process
- **Memory Leaks:** < 100MB retained after tests
- **Peak Memory:** < 1GB absolute peak

### Process Limits

- **Max Vitest Processes:** ≤ 4 concurrent processes
- **Process Cleanup:** Return to baseline ± 1 process
- **Concurrent Workers:** ≤ 2 test workers (maxConcurrency)

### Performance Limits

- **Test Execution Time:** < 20 seconds per test file
- **CPU Usage:** < 80% average, < 95% peak
- **System Stability:** PM2 services remain online

## Test Execution Strategy

### Prerequisites

1. Clean environment (no existing vitest processes)
2. PM2 services running (rss-reader-dev, rss-sync-cron, rss-sync-server)
3. Sufficient system resources for monitoring

### Execution Order

1. **Unit Tests** → Validate configuration changes
2. **Integration Tests** → Test system integration
3. **Edge Cases** → Stress test failure scenarios
4. **Acceptance Criteria** → Verify all requirements met
5. **Performance Tests** → Quantitative validation

### Monitoring During Tests

- Memory usage tracking (vm_stat on macOS)
- Process count monitoring (ps aux | grep vitest)
- PM2 service health checking
- CPU usage monitoring (top command)

## Expected Outcomes

### Before Fix (Current Issue)

- ❌ 8+ vitest processes spawned
- ❌ 36GB+ memory consumption
- ❌ Service crashes and outages
- ❌ Manual intervention required

### After Fix (Target State)

- ✅ ≤ 4 vitest processes maximum
- ✅ < 1GB total memory usage
- ✅ Service stability maintained
- ✅ Automated cleanup and recovery

## Test Data Collection

Each test file includes comprehensive logging:

- Memory usage before/during/after tests
- Process count tracking
- Performance timing data
- Error conditions and recovery

## Success Criteria

The fix is considered successful when:

1. **All 5 test files pass completely**
2. **No memory exhaustion warnings/errors**
3. **PM2 services remain stable throughout testing**
4. **Resource usage stays within defined limits**
5. **All Linear acceptance criteria are validated**

## Failure Handling

If any tests fail:

1. **Emergency Cleanup:** `pkill -f vitest`
2. **Service Recovery:** `pm2 restart all`
3. **Log Analysis:** Check memory/process logs
4. **Root Cause:** Identify configuration issues

## Integration with Development Workflow

These tests should be run:

- **Before implementing the fix** (to confirm current issues)
- **During implementation** (to validate incremental progress)
- **After implementation** (to confirm fix effectiveness)
- **In CI/CD pipeline** (to prevent regressions)

## Files Created

1. `src/__tests__/test-configuration/rr-123-test-runner-memory-fix.test.ts` (20 tests)
2. `src/__tests__/integration/rr-123-safe-test-execution.test.ts` (11 tests)
3. `src/__tests__/edge-cases/rr-123-memory-exhaustion-scenarios.test.ts` (14 tests)
4. `src/__tests__/acceptance/rr-123-acceptance-criteria.test.ts` (18 tests)
5. `src/__tests__/performance/rr-123-resource-usage-validation.test.ts` (12 tests)

**Total: 75 comprehensive test cases covering all aspects of the memory exhaustion fix**
