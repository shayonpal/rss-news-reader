# RR-117: Auth Status Endpoint Implementation - Comprehensive Test Plan

## Executive Summary

This document provides a comprehensive test plan for implementing the OAuth authentication status endpoint (`/api/auth/inoreader/status`) as part of RR-117. The endpoint provides authentication status information for monitoring and client use within the RSS News Reader PWA.

**Test Coverage Overview:**

- **Unit Tests**: 45+ test cases covering core logic and error handling
- **Integration Tests**: 35+ test cases covering end-to-end HTTP functionality
- **Edge Cases**: 25+ test cases covering boundary conditions and unusual scenarios
- **Acceptance Tests**: 35+ test cases verifying all acceptance criteria

**Total Test Cases**: 140+ comprehensive test scenarios

## Background and Context

### Issue Context: RR-117

The auth status endpoint was previously removed as part of RR-71 (API route cleanup) but is now needed again based on:

1. **Build Validation Requirements**: The `scripts/validate-build.sh` expects this endpoint to exist
2. **Integration Test Expectations**: `health-endpoints.test.ts` tests for this endpoint
3. **Monitoring Integration**: Required for health monitoring and Uptime Kuma integration
4. **Client Status Checks**: Frontend needs to verify authentication state

### Implementation Requirements

Based on analysis of existing health check patterns and integration test expectations:

**Primary Requirements:**

- Endpoint: `/api/auth/inoreader/status` (GET only)
- Response format: JSON with authentication status
- Token file validation: Check `~/.rss-reader/tokens.json`
- Age calculation: Based on file modification time
- Expiry logic: 365-day token lifetime assumption
- Security: Never expose actual token values

**Integration Requirements:**

- Compatible with existing health check system
- Follows same response patterns as other health endpoints
- Integrates with PM2 service monitoring
- Works with Uptime Kuma external monitoring

## Test Suite Architecture

### 1. Unit Tests (`rr-117-auth-status-unit.test.ts`)

**Purpose**: Test core business logic in isolation with mocked dependencies.

**Key Test Categories:**

- Token file existence checks (5 test cases)
- Token file content validation (4 test cases)
- Token age calculation (3 test cases)
- Response format consistency (4 test cases)
- Security considerations (2 test cases)
- HTTP methods and performance (3 test cases)

**Mocking Strategy:**

- `fs/promises` module fully mocked
- Environment variables controlled
- Crypto operations mocked if needed
- NextRequest/NextResponse simulated

**Sample Critical Tests:**

```typescript
it("should return authenticated: false when token file does not exist");
it("should return authenticated: false for unencrypted tokens");
it("should calculate token age correctly for recent tokens");
it("should never expose actual token values in response");
```

### 2. Integration Tests (`rr-117-auth-status-integration.test.ts`)

**Purpose**: Test end-to-end HTTP functionality with real file system operations.

**Key Test Categories:**

- Endpoint availability and basic response (4 test cases)
- Token file scenarios (4 test cases)
- Token age and expiration logic (3 test cases)
- Performance and reliability (3 test cases)
- Error handling and edge cases (3 test cases)
- Security validation (3 test cases)
- CORS and headers (2 test cases)

**Test Environment:**

- Temporary directory setup for token files
- Real HTTP requests via test server
- File system operations with cleanup
- Concurrent request testing

**Sample Critical Tests:**

```typescript
it("should respond to GET /reader/api/auth/inoreader/status");
it("should handle valid encrypted tokens");
it("should handle concurrent requests without errors");
it("should not expose sensitive data in responses");
```

### 3. Edge Cases Tests (`rr-117-auth-status-edge-cases.test.ts`)

**Purpose**: Test boundary conditions, unusual scenarios, and error recovery.

**Key Test Categories:**

- Boundary conditions (4 test cases)
- Unusual file system states (4 test cases)
- Malformed JSON edge cases (5 test cases)
- Environment variable edge cases (4 test cases)
- Time and date edge cases (3 test cases)
- Memory and resource constraints (3 test cases)

**Special Scenarios:**

- Token file exactly 365 days old
- Zero-byte files and directory instead of file
- System clock changes and DST transitions
- Unicode and special characters in JSON
- Out-of-memory and disk full conditions

**Sample Edge Cases:**

```typescript
it("should handle token file with exactly 365 days age");
it("should handle token file that exists but is a directory");
it("should handle system clock changes (future date)");
it("should handle out-of-memory conditions gracefully");
```

### 4. Acceptance Tests (`rr-117-acceptance.test.ts`)

**Purpose**: Verify all acceptance criteria are met with realistic end-to-end scenarios.

**Acceptance Criteria Coverage:**

#### AC-1: Endpoint Availability and HTTP Compliance (4 test cases)

- Accessible at correct URL
- Only accepts GET requests
- Returns valid JSON
- Responds within time limits

#### AC-2: Response Schema Compliance (3 test cases)

- Required fields always present
- ISO 8601 timestamp format
- Meaningful status values

#### AC-3: Authentication State Detection (4 test cases)

- Correct response for no tokens
- Correct response for valid tokens
- Correct response for unencrypted tokens
- Correct response for expired tokens

#### AC-4: Token Age Calculation and Expiry Warning (3 test cases)

- Accurate age calculation in days
- Warning for tokens expiring soon
- 365-day expiry assumption

#### AC-5: Error Handling and Resilience (4 test cases)

- Invalid JSON handling
- File system error handling
- No sensitive information exposure
- Concurrent request handling

#### AC-6: Integration with Existing Health Check System (3 test cases)

- Compatibility with other health endpoints
- Monitoring system compatibility
- API response pattern consistency

#### AC-7: Security and Privacy Requirements (3 test cases)

- Never expose actual tokens
- Sanitized error messages
- Path traversal protection

#### AC-8: Performance and Resource Usage (3 test cases)

- Performance budget compliance
- Memory usage constraints
- Efficient file processing

## Expected Response Schema

Based on analysis of existing health endpoints and integration test expectations:

```typescript
interface AuthStatusResponse {
  authenticated: boolean; // Primary authentication state
  status: string; // Detailed status code
  message: string; // Human-readable status message
  timestamp: string; // ISO 8601 formatted timestamp
  tokenAge: number | null; // Age in days, null if no tokens
  daysRemaining: number | null; // Days until expiry, null if no tokens
}
```

**Status Values:**

- `valid`: Tokens are valid and fresh (> 30 days remaining)
- `expiring_soon`: Tokens valid but expiring within 30 days
- `expired`: Tokens are expired (> 365 days old)
- `no_tokens`: No token file found
- `invalid_format`: Token file has invalid JSON
- `unencrypted`: Tokens are not encrypted
- `empty_tokens`: Token file exists but encrypted field is empty
- `config_error`: Configuration issues (missing env vars, etc.)
- `error`: General error condition

## Implementation Strategy

### File Structure

```
src/app/api/auth/inoreader/status/
└── route.ts                 # Main endpoint implementation
```

### Dependencies

```typescript
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
```

### Key Logic Flow

1. Check environment variables (HOME, TOKEN_ENCRYPTION_KEY)
2. Construct token file path (`~/.rss-reader/tokens.json`)
3. Check file existence and readability
4. Parse JSON and validate structure
5. Check for encrypted field presence
6. Calculate token age from file modification time
7. Determine authentication status and expiry warnings
8. Return structured response

### Error Handling Strategy

- Always return HTTP 200 (errors are in response body)
- Sanitize all error messages (no file paths or sensitive data)
- Graceful degradation for file system errors
- Consistent response format even for errors
- No exceptions bubble up to cause HTTP 500 errors

## Test Execution Plan

### Phase 1: Unit Test Development and Execution

```bash
# Run unit tests only
npx vitest run src/__tests__/unit/rr-117-auth-status-unit.test.ts

# Expected outcome: All unit tests pass with >95% code coverage
```

### Phase 2: Implementation Development

- Implement `/api/auth/inoreader/status/route.ts` based on unit test specifications
- Follow existing health check patterns from `app-health-check.ts`
- Ensure compliance with Next.js App Router patterns

### Phase 3: Integration Test Execution

```bash
# Run integration tests
npx vitest run --config vitest.integration.config.ts src/__tests__/integration/rr-117-auth-status-integration.test.ts

# Expected outcome: All integration tests pass with real HTTP requests
```

### Phase 4: Edge Case Validation

```bash
# Run edge case tests
npx vitest run src/__tests__/edge-cases/rr-117-auth-status-edge-cases.test.ts

# Expected outcome: All edge cases handled gracefully
```

### Phase 5: Acceptance Criteria Verification

```bash
# Run acceptance tests
npx vitest run src/__tests__/acceptance/rr-117-acceptance.test.ts

# Expected outcome: All acceptance criteria met
```

### Phase 6: Full Test Suite Execution

```bash
# Run all RR-117 related tests
npx vitest run --no-coverage src/__tests__/**/*rr-117*.test.ts

# Run existing health endpoint tests to ensure no regression
npx vitest run src/__tests__/integration/health-endpoints.test.ts

# Run build validation
./scripts/validate-build.sh --mode full
```

### Phase 7: Performance and Load Testing

```bash
# Test concurrent requests (manual verification)
for i in {1..10}; do
  curl -s http://localhost:3000/reader/api/auth/inoreader/status &
done
wait

# Test with large token files (create test files manually)
# Test memory usage over time
```

## Expected Test Results

### Success Criteria

- **All unit tests pass**: 45+ test cases
- **All integration tests pass**: 35+ test cases
- **All edge case tests pass**: 25+ test cases
- **All acceptance tests pass**: 35+ test cases
- **No regression**: Existing health endpoint tests still pass
- **Build validation passes**: `validate-build.sh` succeeds
- **Performance targets met**: < 1 second response time
- **Security validated**: No sensitive data exposure

### Coverage Targets

- **Line Coverage**: > 95%
- **Branch Coverage**: > 90%
- **Function Coverage**: 100%

### Integration Validation

- Endpoint accessible at `/api/auth/inoreader/status`
- Response format matches existing health endpoints
- Works with PM2 process monitoring
- Compatible with Uptime Kuma external monitoring
- No impact on existing functionality

## Risk Assessment and Mitigation

### High Risk Areas

1. **File System Operations**
   - **Risk**: Permission errors, disk full, network filesystem timeouts
   - **Mitigation**: Comprehensive error handling, timeout protection
   - **Test Coverage**: Edge case tests cover various file system errors

2. **Token File Parsing**
   - **Risk**: Malformed JSON, large files, security vulnerabilities
   - **Mitigation**: Safe JSON parsing, size limits, input sanitization
   - **Test Coverage**: Edge case tests cover malformed JSON scenarios

3. **Security and Privacy**
   - **Risk**: Exposing actual token values or file system paths
   - **Mitigation**: Response sanitization, no token value logging
   - **Test Coverage**: Security tests verify no sensitive data exposure

4. **Performance Under Load**
   - **Risk**: Memory leaks, slow responses, resource exhaustion
   - **Mitigation**: Efficient file operations, resource monitoring
   - **Test Coverage**: Performance tests verify response times and concurrency

### Medium Risk Areas

1. **Environment Configuration**
   - **Risk**: Missing environment variables, incorrect paths
   - **Mitigation**: Graceful degradation, clear error messages
   - **Test Coverage**: Unit tests cover missing configuration

2. **Time Calculations**
   - **Risk**: Timezone issues, DST transitions, clock changes
   - **Mitigation**: Use UTC timestamps, handle edge cases
   - **Test Coverage**: Edge case tests cover time-related issues

## Monitoring and Observability

### Integration with Existing Monitoring

The endpoint will integrate with:

1. **Uptime Kuma External Monitoring**
   - HTTP status code monitoring (should always be 200)
   - Response time monitoring (should be < 1 second)
   - JSON response validation

2. **PM2 Service Monitoring**
   - Endpoint health integrated into overall service health
   - Error logging through PM2 log aggregation

3. **Health Check Dashboard**
   - Status included in `scripts/monitor-dashboard.sh`
   - Integration with existing health endpoint patterns

### Metrics and Logging

The endpoint should log:

- Request count and timing
- Error conditions and recovery
- Token status changes (without exposing values)
- Performance metrics for monitoring

## Maintenance and Updates

### Long-term Considerations

1. **Token Expiry Logic Updates**
   - Current assumption: 365 days
   - May need adjustment based on Inoreader API changes
   - Test suite can be updated to reflect new logic

2. **Response Format Evolution**
   - Additional fields may be needed for enhanced monitoring
   - Backward compatibility maintained through optional fields
   - Versioning strategy if breaking changes needed

3. **Security Updates**
   - Regular security reviews of file operations
   - Updates to sanitization logic as needed
   - Dependency updates for security patches

### Documentation Updates

When implementation is complete:

- Update API documentation
- Update monitoring runbooks
- Update troubleshooting guides
- Document new health check capabilities

## Conclusion

This comprehensive test plan provides 140+ test cases covering all aspects of the auth status endpoint implementation. The test-driven approach ensures:

- **Complete requirement coverage** through acceptance tests
- **Robust error handling** through edge case tests
- **Performance validation** through integration tests
- **Security assurance** through dedicated security tests

The implementation should follow the patterns established by existing health check endpoints while providing the specific authentication status information needed for monitoring and client operations.

**Next Steps:**

1. Review and approve this test plan
2. Execute Phase 1 (unit tests) to validate approach
3. Implement the endpoint following test specifications
4. Execute remaining test phases to validate implementation
5. Deploy and monitor in production environment
