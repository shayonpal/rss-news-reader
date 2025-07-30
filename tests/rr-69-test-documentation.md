# RR-69 Test Documentation: Remove Test Pages & Debug Endpoints

## Overview

This document describes the comprehensive test suite created for RR-69, which ensures the complete removal of test pages and debug endpoints from the RSS News Reader application for security purposes.

## Test Categories

### 1. E2E Security Tests (`src/__tests__/e2e/rr-69-remove-test-endpoints.spec.ts`)

**Purpose**: Verify that all test/debug endpoints return 404 errors in production.

**Key Test Cases**:

- Test page removal (404 responses for all test pages)
- API endpoint removal (404 responses for all test/debug API endpoints)
- Service Worker cache verification (no test endpoints cached)
- Codebase verification (no test endpoint strings in production bundles)
- Security header verification (no information leakage)

**Running the tests**:

```bash
# Run against production
npx playwright test --config=playwright.config.rr69.ts --project=production-security

# Run against development
npx playwright test --config=playwright.config.rr69.ts --project=development-security
```

### 2. Script Validation Tests (`src/__tests__/scripts/validate-build.test.ts`)

**Purpose**: Ensure the `validate-build.sh` script is updated to use production health endpoints.

**Key Test Cases**:

- No references to test-supabase endpoint
- Uses production health endpoints (/api/health/app, /api/health/db)
- Proper error handling for 404 responses
- No test endpoint compilation checks

**Running the tests**:

```bash
npm run test -- src/__tests__/scripts/validate-build.test.ts
```

### 3. Integration Tests (`src/__tests__/integration/health-endpoints.test.ts`)

**Purpose**: Verify that health monitoring continues to work after removing test endpoints.

**Key Test Cases**:

- Production health endpoints return 200
- Removed test endpoints return 404
- Core API functionality remains intact
- Health endpoint response times are acceptable

**Running the tests**:

```bash
npm run test -- src/__tests__/integration/health-endpoints.test.ts
```

### 4. Codebase Security Scan (`src/__tests__/security/codebase-scan.test.ts`)

**Purpose**: Scan the entire codebase to ensure no references to test endpoints remain.

**Key Test Cases**:

- No test endpoint string references
- No test route files exist
- No test imports
- No test environment variables
- No test navigation links
- No test API client calls
- Build configuration clean
- Service Worker precache clean

**Running the tests**:

```bash
npm run test -- src/__tests__/security/codebase-scan.test.ts
```

## Complete Test Execution

Run all RR-69 security tests with the provided script:

```bash
./scripts/test-rr69-security.sh
```

This script will:

1. Run unit tests for script validation
2. Perform codebase security scan
3. Run integration tests (if dev server running)
4. Execute E2E security tests (if prod server accessible)
5. Provide a summary of results

## Expected Results (Red Phase)

Before implementing RR-69, these tests should fail with:

1. **E2E Tests**: Will fail because test endpoints still return 200
2. **Script Tests**: Will fail because validate-build.sh still references test-supabase
3. **Integration Tests**: Will fail because test endpoints don't return 404
4. **Codebase Scan**: Will fail finding multiple test endpoint references

## Expected Results (Green Phase)

After implementing RR-69, all tests should pass:

1. **E2E Tests**: All test endpoints return 404
2. **Script Tests**: validate-build.sh uses production health endpoints
3. **Integration Tests**: Only production endpoints work
4. **Codebase Scan**: No test endpoint references found

## Manual Verification Checklist

After running automated tests, manually verify:

- [ ] No test-\* files exist in `src/app/`
- [ ] No test-\* or debug/ files exist in `src/app/api/`
- [ ] Production build completes without errors
- [ ] Service worker doesn't cache test endpoints
- [ ] validate-build.sh uses production health endpoints

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/security-tests.yml
- name: Run RR-69 Security Tests
  run: |
    chmod +x ./scripts/test-rr69-security.sh
    ./scripts/test-rr69-security.sh
```

## Troubleshooting

### Tests fail with "server not accessible"

- Ensure production server is running on port 3147
- Check if Tailscale VPN is connected
- Verify PM2 services are running: `pm2 status`

### Codebase scan finds references

- Check if references are in test files (excluded from scan)
- Verify all test pages/routes are deleted
- Run `npm run build` to ensure clean build

### E2E tests timeout

- Increase timeout in playwright.config.rr69.ts
- Check network connectivity to production server
- Verify no firewall blocking connections

## Security Impact

Removing these test endpoints:

1. Prevents exposure of database schema information
2. Eliminates debug data manipulation capabilities
3. Removes potential attack vectors
4. Ensures production builds are clean

## Maintenance

Keep these tests in the codebase to prevent regression:

- Run before each release
- Include in pre-commit hooks for sensitive areas
- Update if new health endpoints are added
