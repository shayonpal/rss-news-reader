# RR-27: Fix Article List State Preservation on Back Navigation - Comprehensive Test Plan

## Overview

This document outlines the comprehensive test strategy for implementing article list state preservation during back navigation, specifically addressing the issue where articles marked as read disappear when navigating back from article detail in "Unread Only" mode.

## Problem Statement

**Current Issue**: Articles that are automatically marked as read via the intersection observer (auto-scroll feature) disappear from the article list when users navigate back from article detail view while in "Unread Only" filter mode.

**Expected Behavior**: Auto-read articles should remain visible in the list with visual differentiation, preserving the exact scroll position and list state for optimal user experience.

## Implementation Strategy

The solution involves:

1. **Enhanced Session Storage**: Track article states with auto-read vs manual-read differentiation
2. **State Preservation**: Maintain article visibility for session-preserved items
3. **Observer Management**: Disable/re-enable intersection observers during scroll restoration
4. **Visual Differentiation**: Show preserved articles with distinct styling
5. **Navigation History**: Track navigation patterns with circular buffer

## Test Categories

### 1. Unit Tests (`/src/__tests__/unit/rr-27-state-preservation-unit.test.ts`)

**Purpose**: Test core state management functions in isolation

**Test Coverage**:

- `ArticleListStateManager` class functionality
- Session storage save/retrieve operations
- State expiry after 30 minutes
- Article state updates and batch operations
- `NavigationHistory` circular buffer implementation
- Data validation and error handling

**Key Test Scenarios**:

```typescript
describe("ArticleListStateManager", () => {
  it("should save list state to sessionStorage");
  it("should return null when no saved state exists");
  it("should return null and clear state when expired (> 30 minutes)");
  it("should handle corrupted state data gracefully");
  it("should update specific article state");
  it("should return only session-preserved articles");
});

describe("NavigationHistory", () => {
  it("should add navigation entries with timestamps");
  it("should maintain circular buffer with max size");
  it("should handle back/forward navigation correctly");
  it("should remove forward history when navigating to new path");
});
```

### 2. Integration Tests (`/src/__tests__/integration/rr-27-navigation-flows.test.ts`)

**Purpose**: Test component interactions and complete navigation flows

**Test Coverage**:

- Article list and detail component integration
- Router navigation with state preservation
- Intersection observer setup and cleanup
- Session storage integration
- Error handling across component boundaries

**Key Test Scenarios**:

```typescript
describe("Basic Navigation Flow", () => {
  it("should save scroll position when navigating to article detail");
  it("should restore scroll position when navigating back from article detail");
  it("should handle back navigation from article detail");
});

describe("State Preservation in Unread Only Mode", () => {
  it("should preserve auto-read articles in session storage");
  it("should handle intersection observer for auto-read detection");
  it("should differentiate between auto-read and manually read articles");
});
```

### 3. Edge Case Tests (`/src/__tests__/edge-cases/rr-27-navigation-edge-cases.test.ts`)

**Purpose**: Test boundary conditions and error scenarios

**Test Coverage**:

- Storage quota exceeded scenarios
- Corrupted session data recovery
- Network connectivity changes
- Browser environment variations (iOS Safari, private browsing)
- Concurrent access and race conditions
- Memory pressure and performance limits

**Key Test Scenarios**:

```typescript
describe("Storage Quota and Memory Management", () => {
  it("should handle session storage quota exceeded gracefully");
  it("should limit article count to prevent memory bloat");
  it("should handle navigation history storage failures");
});

describe("Browser Environment Edge Cases", () => {
  it("should handle iOS Safari quirks");
  it("should handle private browsing mode restrictions");
  it("should handle disabled JavaScript storage");
});
```

### 4. Acceptance Tests (`/src/__tests__/acceptance/rr-27-acceptance.test.ts`)

**Purpose**: Verify all acceptance criteria from Linear issue are met

**Acceptance Criteria Validation**:

1. **AC1**: Auto-read articles remain visible in Unread Only mode
2. **AC2**: Visual differentiation of auto-read vs manually read articles
3. **AC3**: State preservation for both back button and prev/next navigation
4. **AC4**: Exact scroll position restoration (within 10px tolerance)
5. **AC5**: Session storage expiry after 30 minutes
6. **AC6**: Performance remains acceptable with large article lists (1000+ articles)
7. **AC7**: Auto-read detection works correctly during scroll restoration

**Key Test Scenarios**:

```typescript
describe("AC1: Auto-read articles remain visible in Unread Only mode", () => {
  it(
    "should preserve auto-read articles in session storage when navigating back"
  );
  it("should differentiate between auto-read and manually read articles");
});

describe("Integration: Complete user flow acceptance", () => {
  it("should pass complete user scenario: scroll, auto-read, navigate, return");
  it("should handle edge case: user navigates rapidly between articles");
});
```

### 5. Performance Tests (`/src/__tests__/performance/rr-27-performance.test.ts`)

**Purpose**: Ensure performance characteristics meet requirements

**Performance Requirements**:

- Save operations: < 50ms for 1000 articles
- Retrieval operations: < 30ms
- Batch updates: < 30ms for 50 articles
- Memory usage: < 10MB growth during extended use
- Intersection observer: < 50ms for 500 elements

**Key Test Scenarios**:

```typescript
describe("Large Dataset Performance", () => {
  it("should handle 1000 articles with acceptable performance");
  it("should handle 5000 articles with compression and chunking");
});

describe("Real-world Performance Scenarios", () => {
  it("should maintain performance during heavy user interaction");
  it("should handle concurrent operations without performance degradation");
});
```

## Test Execution Strategy

### Development Phase

```bash
# Run unit tests during development
npm run test:unit -- src/__tests__/unit/rr-27-state-preservation-unit.test.ts

# Run integration tests for component interactions
npm run test:integration -- src/__tests__/integration/rr-27-navigation-flows.test.ts
```

### Pre-Commit Phase

```bash
# Run all RR-27 related tests
npm run test -- --testNamePattern="RR-27"

# Run acceptance tests to verify requirements
npm run test -- src/__tests__/acceptance/rr-27-acceptance.test.ts
```

### Performance Validation

```bash
# Run performance tests separately
npm run test -- src/__tests__/performance/rr-27-performance.test.ts

# Monitor performance metrics
npm run test:perf
```

### E2E Testing (Optional with Playwright)

```typescript
// tests/e2e/rr-27-navigation.spec.ts
test("should preserve article list state during navigation", async ({
  page,
}) => {
  await page.goto("http://100.96.166.53:3000/reader");

  // Scroll to trigger auto-read
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(1000);

  // Click article to navigate
  await page.click('[data-testid="article-1"]');
  await page.waitForLoadState("networkidle");

  // Navigate back
  await page.goBack();
  await page.waitForLoadState("networkidle");

  // Verify preserved state
  const scrollPosition = await page.evaluate(() => window.scrollY);
  expect(scrollPosition).toBeCloseTo(1000, -1); // Within 10px

  const preservedArticles = await page.locator(".session-preserved").count();
  expect(preservedArticles).toBeGreaterThan(0);
});
```

## Success Criteria

### Functional Requirements

- ✅ All acceptance criteria tests pass
- ✅ Auto-read articles remain visible in Unread Only mode
- ✅ Visual differentiation implemented correctly
- ✅ Scroll position restored within 10px accuracy
- ✅ State expires after 30 minutes as expected

### Performance Requirements

- ✅ Operations complete within specified time limits
- ✅ Memory usage remains stable during extended use
- ✅ No performance regression with large article lists
- ✅ Smooth user experience during navigation

### Reliability Requirements

- ✅ All edge cases handled gracefully
- ✅ Storage quota exceeded scenarios work
- ✅ Browser compatibility maintained
- ✅ Error recovery mechanisms function correctly

## Risk Assessment and Mitigation

### High Risk Areas

1. **Session Storage Quota**: Mitigated by implementing compression and fallback strategies
2. **Performance with Large Lists**: Mitigated by pagination, virtual scrolling, and batch operations
3. **Browser Compatibility**: Mitigated by comprehensive environment testing
4. **Race Conditions**: Mitigated by proper state management and locking mechanisms

### Medium Risk Areas

1. **State Corruption**: Mitigated by data validation and recovery procedures
2. **Memory Leaks**: Mitigated by proper cleanup and caching strategies
3. **Navigation Conflicts**: Mitigated by navigation history management

## Monitoring and Maintenance

### Performance Monitoring

- Implement performance benchmarks as regression tests
- Monitor session storage usage in production
- Track user navigation patterns and performance metrics

### Error Monitoring

- Log state preservation failures
- Monitor session storage quota exceeded events
- Track navigation flow completion rates

### Maintenance Tasks

- Regular performance benchmark updates
- Browser compatibility testing with new versions
- Session storage cleanup optimization

## Conclusion

This comprehensive test plan ensures that the RR-27 implementation meets all functional, performance, and reliability requirements. The multi-layered testing approach provides confidence in the solution's robustness across various scenarios and edge cases.

The test suite serves as both validation of the current implementation and regression prevention for future changes. Performance benchmarks ensure the solution scales appropriately with larger datasets while maintaining optimal user experience.
