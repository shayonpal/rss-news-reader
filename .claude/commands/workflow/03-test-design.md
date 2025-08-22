---
description: Design and validate comprehensive tests based on staging contracts
argument_hint: [#issue|"feature description"]
---

# Test Design - Test Creation & Validation Phase

Focused test creation phase that prevents test skipping and ensures quality gates before implementation.

## Help Mode
If user provides `--help` or `help` parameter, display this usage guide:

```
test-design - Design and validate comprehensive tests based on staging contracts

USAGE:
  test-design #RR-123           Design tests for Linear issue
  test-design "auth flow"       Design tests for feature description
  test-design help              Show this help

WORKFLOW:
  1. Contract Analysis - Review staging requirements
  2. Test Design - Create comprehensive test suite
  3. Quality Validation - Ensure tests meet standards
  4. Handoff Prep - Package for execute phase

INTEGRATION:
  Input:  Staging contracts from 02-stage
  Output: Validated test suite for 04-execute
```

## Instructions

**CRITICAL: Always activate Serena MCP at session start:**
```bash
mcp__serena__activate_project
```

### Phase 1: Contract Analysis

**Parse Requirements:**
- Extract issue number or feature description from $ARGUMENTS
- If Linear issue: Use `linear-expert` to get issue details and acceptance criteria
- If feature description: Parse requirements from staging documentation

**Map Test Scenarios:**
```bash
# Get current staging contracts
ls -la docs/staging/ | head -10
```
- Identify symbols and components requiring tests
- Map acceptance criteria to specific test scenarios
- Document test coverage requirements

### Phase 2: Test Design & Creation

**Engage test-expert with RSS Reader context:**

**Domain Context Package:**
- **RSS Feed System**: Parse feeds, sync articles, handle feed failures
- **Inoreader Integration**: OAuth flow, API rate limits, token refresh
- **Database Layer**: Supabase RLS, article deduplication, user preferences
- **PWA Components**: Liquid glass morphing, mobile gestures, scroll behavior
- **Performance**: Mobile-first, 60fps animations, memory efficiency

**Test Pattern Requirements:**
- **API Tests**: Mock Inoreader responses, test rate limiting, error handling
- **Database Tests**: Fixtures for articles/feeds, RLS policy validation
- **Component Tests**: Glass morphing states, gesture interactions
- **Integration Tests**: End-to-end sync flows, auth persistence
- **Performance Tests**: Mobile benchmarks, animation smoothness

**Test Creation Process:**
1. Generate failing tests first (TDD approach)
2. Cover happy path, edge cases, and error scenarios
3. Include performance benchmarks for mobile
4. Validate API mocking strategies

### Phase 3: Test Quality Validation

**Test Completeness Check:**
- Every acceptance criterion has corresponding tests
- Edge cases covered (network failures, invalid data, rate limits)
- Error scenarios tested (auth failures, parsing errors)
- Performance thresholds defined and tested

**Quality Gates:**
```bash
# Validate test structure
npm run test:lint
npm run test:dry-run  # Ensure tests fail appropriately
```

**Test Coverage Mapping:**
- Document which tests validate which acceptance criteria
- Identify any gaps in test coverage
- Ensure mobile-specific scenarios are covered

### Phase 4: Handoff Documentation

**Package for Execute Phase:**
- Summary of created tests and coverage
- Test execution strategy
- Dependencies and setup requirements
- Expected test failures before implementation

**Integration with 04-execute:**
- All tests are validated and comprehensive
- Implementation contracts clearly defined
- Quality gates passed - no further test validation needed
- Ready for red-green-refactor TDD cycle

## Output Format

```
## 🧪 Test Design Complete

### 📋 Test Coverage Summary
- **Unit Tests**: [count] covering [components]
- **Integration Tests**: [count] covering [flows]
- **API Tests**: [count] covering [endpoints]
- **Performance Tests**: [count] covering [metrics]

### ✅ Quality Gates Passed
- All acceptance criteria have tests
- Edge cases and errors covered
- Tests fail appropriately (TDD)
- Mobile performance benchmarks set

### 📦 Handoff Package Ready
**Test Files Created:**
- [list of test files]

**Next Steps for Execute Phase:**
- Run tests (expect failures)
- Implement features to make tests pass
- Validate performance benchmarks
- Complete acceptance criteria

**Handoff to 04-execute:**
✅ Validated test suite ready for implementation
✅ Test quality gates passed
✅ Implementation contracts established
✅ No additional test analysis required

**Estimated Implementation Effort:** [time estimate]

**Command Integration:** Use `04-execute` to begin implementation phase with pre-validated tests
```

## RSS Reader Test Patterns

**Common Test Scenarios:**
- Feed parsing with malformed XML
- OAuth token refresh during sync
- Offline reading with cached articles
- Glass component morphing animations
- Mobile scroll performance under load

**Performance Benchmarks:**
- Article list render < 100ms
- Glass animations 60fps
- Feed sync < 5 seconds for 100 articles
- Memory usage < 50MB on mobile