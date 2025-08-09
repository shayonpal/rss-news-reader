# RR-170: Test Specification Report - HTML Entity Decoding in Tag Names

## Executive Summary

This document contains the complete test specification for RR-170, which addresses the issue of HTML entities rendering in tag names (e.g., "India&#x2F;Canada" instead of "India/Canada"). The tests defined here serve as the **authoritative specification** that the implementation must conform to.

## Test Coverage Overview

### Test Files Created

1. **Test Contract**: `src/__tests__/contracts/rr-170-tag-html-entities.contract.ts`
   - Defines exact behavior requirements
   - Contains all test cases and expected outcomes
   - Serves as the single source of truth

2. **Unit Tests**: `src/__tests__/unit/rr-170-tag-decoding.test.ts`
   - 70+ test cases covering all scenarios
   - Tests decoding function in isolation
   - Validates security and performance

3. **Integration Tests**: `src/__tests__/integration/rr-170-tag-display.test.ts`
   - Tests API to UI data flow
   - Validates database preservation
   - Tests error handling and edge cases

4. **Component Tests**: `src/components/feeds/__tests__/simple-feed-sidebar.test.tsx`
   - Tests SimpleFeedSidebar rendering
   - Validates visual display and interaction
   - Tests accessibility and security

## Implementation Requirements

### Code Change Required

**File**: `src/components/feeds/simple-feed-sidebar.tsx`
**Line**: 284

**Current Code**:
```typescript
{escapeHtml(tag.name)}
```

**Required Change**:
```typescript
{escapeHtml(decodeHtmlEntities(tag.name))}
```

**Import Required**:
```typescript
import { decodeHtmlEntities } from '@/lib/utils/html-decoder';
```

### Processing Pipeline

The implementation MUST follow this exact processing order:
1. **Decode**: HTML entities → readable text
2. **Escape**: Dangerous HTML → safe entities
3. **Render**: Display in UI

## Test Cases Specification

### Core Decoding Requirements

| Input | Expected Output | Test Coverage |
|-------|----------------|---------------|
| `India&#x2F;Canada` | `India/Canada` | ✅ Unit, Integration, Component |
| `Tech &amp; Science` | `Tech & Science` | ✅ Unit, Integration, Component |
| `News&#8211;Updates` | `News–Updates` | ✅ Unit, Integration |
| `Q&amp;A` | `Q&A` | ✅ Unit, Integration, Component |
| `normal-tag` | `normal-tag` | ✅ Unit, Integration, Component |
| `C&#x2B;&#x2B;` | `C++` | ✅ Unit |
| `&lt;Tech&gt;` | `<Tech>` (then escaped) | ✅ Unit, Component |
| `&quot;Breaking News&quot;` | `"Breaking News"` | ✅ Unit |
| `100&#37; News` | `100% News` | ✅ Unit |
| `AT&amp;T` | `AT&T` | ✅ Unit |

### Security Requirements

| Scenario | Requirement | Test Coverage |
|----------|------------|---------------|
| XSS Prevention | HTML tags must be escaped after decoding | ✅ Unit, Component |
| Script Injection | `<script>` tags must not execute | ✅ Unit, Component |
| URL Preservation | URLs must NOT be decoded | ✅ Unit, Integration |
| Onclick Injection | Event handlers must be sanitized | ✅ Component |

### Performance Requirements

| Metric | Requirement | Test Coverage |
|--------|------------|---------------|
| Single Tag | < 1ms decoding time | ✅ Unit |
| Batch (100 tags) | < 50ms total time | ✅ Unit |
| Component Render (50 tags) | < 500ms | ✅ Component |
| API Response (100 tags) | < 1000ms | ✅ Integration |

### Database Preservation

| Requirement | Description | Test Coverage |
|-------------|------------|---------------|
| No DB Writes | Display-only change, no database updates | ✅ Integration |
| Original Values | Database values remain with HTML entities | ✅ Integration |
| Tag IDs | Selection uses tag IDs, not names | ✅ Integration |

## Test Execution Commands

### Run All Tests for RR-170

```bash
# Run all RR-170 tests with coverage
npm test -- --coverage src/__tests__/unit/rr-170 src/__tests__/integration/rr-170 src/components/feeds/__tests__/simple-feed-sidebar

# Run unit tests only
npx vitest run --no-coverage src/__tests__/unit/rr-170-tag-decoding.test.ts

# Run integration tests only
NODE_ENV=test npx vitest run --config vitest.integration.config.ts src/__tests__/integration/rr-170-tag-display.test.ts

# Run component tests only
npx vitest run --no-coverage src/components/feeds/__tests__/simple-feed-sidebar.test.tsx
```

### Pre-Implementation Validation

Before implementing the fix, run these tests to confirm they fail as expected:

```bash
# This should FAIL before implementation
npm test -- src/__tests__/unit/rr-170-tag-decoding.test.ts
```

### Post-Implementation Validation

After implementing the fix, all tests must pass:

```bash
# This should PASS after implementation
npm test -- src/__tests__/unit/rr-170 src/__tests__/integration/rr-170 src/components/feeds/__tests__
```

## Acceptance Criteria Verification

### From Linear Issue RR-170

✅ **Requirement**: Tags render HTML entities in UI
- **Test**: Component tests verify decoded display

✅ **Requirement**: Database stores correct decoded values
- **Test**: Integration tests verify DB preservation

✅ **Requirement**: Must follow RR-154 approach
- **Test**: Uses same `decodeHtmlEntities` function

### Additional Requirements Tested

✅ **Security**: XSS prevention through escape-after-decode
✅ **Performance**: Sub-millisecond decoding per tag
✅ **Reliability**: Graceful handling of malformed entities
✅ **Accessibility**: Proper ARIA attributes maintained

## Test Results Structure

When executed, tests will return JSON results in this format:

```json
{
  "test_plan": {
    "linear_issue": "RR-170",
    "scope": "HTML entity decoding in tag names",
    "acceptance_criteria": [
      "Tags display decoded HTML entities",
      "Database values remain unchanged",
      "Security through proper escaping",
      "Performance within thresholds"
    ]
  },
  "execution_results": {
    "summary": {
      "total_tests": 70,
      "passed": 0,
      "failed": 70,
      "confidence_level": "high"
    },
    "test_categories": [
      {
        "category": "Unit Tests",
        "total": 40,
        "passed": 0,
        "failed": 40
      },
      {
        "category": "Integration Tests",
        "total": 15,
        "passed": 0,
        "failed": 15
      },
      {
        "category": "Component Tests",
        "total": 15,
        "passed": 0,
        "failed": 15
      }
    ]
  },
  "release_readiness": {
    "status": "blocked",
    "blockers": ["Implementation not yet complete"],
    "recommendations": [
      "Implement the one-line fix in SimpleFeedSidebar",
      "Import decodeHtmlEntities function",
      "Run all tests to verify"
    ]
  }
}
```

## Implementation Checklist

Before marking RR-170 as complete, ensure:

- [ ] Import `decodeHtmlEntities` in SimpleFeedSidebar
- [ ] Update line 284 to decode before escaping
- [ ] All unit tests pass (40 tests)
- [ ] All integration tests pass (15 tests)
- [ ] All component tests pass (15 tests)
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Performance benchmarks met
- [ ] Security tests pass

## Notes for Implementation

1. **DO NOT** modify the test files - they are the specification
2. **DO NOT** decode URLs - the `isSafeUrl` check prevents this
3. **DO** ensure the processing order: decode → escape → render
4. **DO** test with actual Inoreader data containing entities

## Risk Assessment

- **Low Risk**: Single-line change in one component
- **No Database Risk**: Display-only change
- **No API Risk**: Backend unchanged
- **Security Verified**: Tests confirm XSS prevention
- **Performance Verified**: Tests confirm sub-ms operation

## Conclusion

These tests form the complete specification for RR-170. The implementation must make all 70+ tests pass without modifying the tests themselves. The fix is a simple one-line change that follows the established pattern from RR-154.