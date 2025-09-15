---
description: Step 6 - Test-After-Done approach with realistic mocking and quality validation
argument_hint: <issue-id>
---

# Step 6: Test - Test-After-Done with Quality Validation

Write quality tests for working implementation to ensure regression protection and validate acceptance criteria. Uses realistic service mocking and mandatory test quality review.

## Project Activation

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

## 1. Parse Input & Implementation Analysis

Check $ARGUMENTS for Linear issue ID and analyze working implementation:

```bash
# Parse Linear issue
ISSUE_ID="$ARGUMENTS"

# Analyze what was implemented
git status --porcelain
git diff --cached --name-only
git log --oneline -5
```

## 2. Behavior Analysis of Working Implementation

Use Serena MCP to understand what the implementation actually does:

**Check relevant memories first:**
- `mcp__serena__read_memory` testing_infrastructure_consolidated.md for test patterns
- Check domain-specific memories based on implementation type (UI, API, sync, etc.)
- Look for similar issue patterns in issue_learnings_consolidated.md

### 2A. Symbol Behavior Discovery

```
Use Serena MCP to analyze implemented functionality:
- get_symbols_overview on modified files to understand structure
- find_symbol for each modified function/class to understand behavior
- find_referencing_symbols to understand integration points
- search_for_pattern to find similar existing test patterns

Map actual behavior:
- What functions do with different inputs
- What state changes occur
- What API calls are made
- What error conditions exist
- What side effects happen
```

### 2B. Acceptance Criteria Mapping

```
Use linear-expert to get acceptance criteria and map to implementation:

For each acceptance criterion:
1. Identify which symbols implement this behavior
2. Determine how to test this criterion is met
3. Plan test scenarios that validate criterion completion
```

## 3. Realistic Service Schema Gathering

Gather real schemas for realistic mocking:

### 3A. Database Schema Analysis

```
Use db-expert-readonly to gather realistic database mocking data:

Task: Extract database schemas for test mocking

Analyze:
- Table structures and field names for [tables involved in implementation]
- Data types and constraints for realistic test data
- Foreign key relationships and validation rules
- Example real data patterns from existing records

Return realistic mock data structures that match actual database schema.
```

### 3B. Internal API Schema Analysis

```
Use Serena MCP to extract internal API patterns:

For each internal API call in implementation:
1. find_symbol for API route handlers to understand request/response
2. Extract JSDoc comments for parameter documentation
3. Check OpenAPI registry for documented schemas
4. Find existing API call patterns in codebase

Build realistic API mock responses with actual field names and types.
```

### 3C. External API Schema Analysis

```
Use web-researcher to get external service documentation:

For external services (Inoreader API, etc.):
1. Get official API documentation for endpoints used
2. Extract real response schemas and field structures
3. Find existing external API calls in codebase for patterns
4. Build realistic external service mocks with actual data structures

Focus on services actually called by the implementation.
```

## 4. Test Generation with Realistic Mocking

Generate tests based on actual implementation behavior:

### 4A. Test Structure Planning

```
Plan test coverage:
- Unit tests: Individual functions/methods with realistic mocks
- Integration tests: Component interactions with real data flows
- API tests: Endpoint testing with realistic request/response
- Edge case tests: Error conditions and boundary cases discovered from code analysis

Use existing test patterns from similar implementations found via Serena.
```

### 4B. Test Directory Structure

Follow established test organization patterns:

```
src/__tests__/
├── unit/              # Individual function/component tests
│   ├── [feature].test.ts
│   └── test-setup.smoke.test.ts
├── integration/       # API and service integration tests
│   ├── [feature]-api.test.ts
│   └── [feature]-sync.test.ts
├── e2e/              # Playwright browser tests
│   ├── [feature]-functionality.spec.ts
│   └── [feature]-mobile.spec.ts
├── api/              # API endpoint tests
│   └── [feature].test.ts
├── stores/           # Zustand store tests
│   ├── [feature]-store.test.ts
│   └── test-utils.ts  # Store isolation utilities
└── helpers/          # Test utilities and mocks
    ├── supabase-mock.ts
    └── [feature]-mock.ts
```

### 4C. Realistic Mock Generation

```
Generate mocks using gathered schemas:
- Database mocks: Real field names, proper data types, valid relationships
- Internal API mocks: Actual response structures from JSDoc/OpenAPI
- External API mocks: Official API response formats from documentation
- State mocks: Real Zustand store structures with isolation patterns

Critical Requirements:
- Use createIsolatedUIStore() for Zustand tests (prevents state leakage)
- Include ALL required mock properties (parseAttempts, parseFailed, etc.)
- Use thread-safe patterns with unique storage keys
- Mock external services only, test real business logic

Avoid over-mocking: Mock services, not internal business logic.
```

### 4D. Test Implementation with Infrastructure Best Practices

```
Write tests that:
1. Validate each acceptance criterion with specific test cases
2. Test actual implementation behavior (not theoretical behavior)
3. Use realistic data that matches production patterns
4. Cover edge cases discovered from code analysis
5. Follow existing test patterns from similar features

Critical Infrastructure Requirements:
- Always use createIsolatedUIStore() for Zustand store tests
- Include required mock properties: parseAttempts, parseFailed, isPartialContent
- Wrap async React state updates in act() to prevent race conditions
- Use vi.clearAllMocks() in beforeEach hooks
- Keep test data small (<100KB fixtures)
- Use thread-safe patterns for parallel execution

Focus on regression prevention: Would these tests catch future breaks?
```

## 5. Test Quality Review with code-reviewer

### 5A. Test Quality Validation

```
Use code-reviewer agent to validate test quality:

Task: Review generated tests for quality and effectiveness

You are reviewing tests written for working implementation (Test-After-Done approach).

Test Review Context:
{
  "issue_id": "RR-XXX",
  "acceptance_criteria": ["[criteria from Linear]"],
  "implementation_files": ["[files that were implemented]"],
  "test_files": ["[test files generated]"],
  "mocking_strategy": {
    "database_mocks": "[realistic database mock patterns used]",
    "api_mocks": "[internal/external API mock patterns used]",
    "service_mocks": "[external service mock patterns used]"
  }
}

Review Requirements:
1. Tests validate ALL acceptance criteria from Linear issue
2. Tests cover edge cases discovered from implementation analysis
3. Mocks are realistic (real field names, data types, structures)
4. Tests are not over-mocked (test real behavior, mock only services)
5. Tests would catch regressions (validate actual functionality)
6. Tests are maintainable and clear
7. Test execution time reasonable for 8-20s target

Flag Issues:
- Over-mocking: Tests that mock internal logic instead of external services
- Unrealistic mocks: Fake field names or data structures
- Missing edge cases: Important scenarios not covered
- Acceptance criteria gaps: Criteria not validated by tests
- Performance issues: Tests that would slow down suite execution

Return structured feedback with specific test file and line references.
```

### 5B. Handle Test Quality Issues

Based on code-reviewer feedback:

```
If MAJOR test issues found:
- Regenerate tests with specific feedback
- Re-review with code-reviewer
- Continue until test quality acceptable

If MINOR test issues found:
- Fix specific issues in place
- Quick re-review of fixes only

If APPROVED:
- Proceed to test execution
```

## 6. Quality Checks Before Test Execution

Run quality checks early to catch issues:

```bash
# Run quality gates before test execution
npm run type-check  # Ensure test TypeScript compiles
npm run lint        # Check test code quality
npm run format:check # Verify test formatting

# Fix any issues before proceeding to test execution
```

## 7. Test Execution with Infrastructure Safety

### 7A. Pre-Test Infrastructure Validation

```bash
# Critical infrastructure checks before test execution
echo "🔍 Validating test infrastructure..."

# Check for hanging processes
ps aux | grep vitest
if [ $? -eq 0 ]; then
  echo "⚠️ Existing vitest processes found - cleaning up"
  ./scripts/kill-test-processes.sh
fi

# Verify PM2 services are stable
pm2 status | grep -E "rss-reader|sync"

# Check system memory
FREE_MEM=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
if [ $FREE_MEM -lt 250000 ]; then
  echo "⚠️ Low system memory - recommend manual execution"
  MANUAL_MODE=true
else
  MANUAL_MODE=false
fi

# Check test lock file
if [ -f "/tmp/rss-reader-test.lock" ]; then
  echo "⚠️ Test lock exists - cleaning up"
  rm /tmp/rss-reader-test.lock
fi
```

### 7B. Execution Strategy (Always Offer Manual Option)

**Always provide manual execution option regardless of risk assessment:**

```
🧪 Test Execution Options:

OPTION 1 - Automatic Execution:
  npm test  # Optimized runner (8-20s target)

OPTION 2 - Manual Execution (Recommended):
  Run these commands and provide results:

  1. Feature Tests:
     npm test -- --testPathPattern="[feature-pattern]" --verbose

  2. Quality Checks:
     npm run type-check && npm run lint && npm run format:check

  3. Full Regression Check:
     npm test

  4. Emergency Cleanup (if needed):
     ./scripts/kill-test-processes.sh

Choose option (1/2) or both: _
```

### 7C. Critical Test Failure Handling

**Handle ALL test failures, not just feature-related:**

```
Analyze test failures comprehensively:

If ANY tests fail:
1. **Infrastructure Failures**: Memory exhaustion, process issues
   - Run: ./scripts/kill-test-processes.sh
   - Check: pm2 status
   - Restart if needed: pm2 restart all
   - Retry tests after infrastructure fix

2. **Regression Failures**: Existing functionality broken
   - Identify which existing feature broke
   - Fix implementation to restore existing functionality
   - Do NOT ignore - these are critical app failures

3. **Feature Test Failures**: New implementation issues
   - Bad tests: Fix tests and re-review with code-reviewer
   - Implementation bugs: Fix in place or re-implement if major issues

4. **Quality Failures**: TypeScript, lint, format issues
   - Fix immediately before proceeding
   - Re-run quality checks until clean

Continue ONLY when ALL tests pass and infrastructure is stable.
```


## 8. Regression Testing

After feature tests pass:

```bash
# Run full test suite to check for regressions
npm test

# Analyze results:
- New failures: Implementation broke existing functionality
- Performance regression: Suite exceeds 8-20s target
- All pass: Ready to proceed
```

Handle regressions:
- **Fix implementation** if it broke existing features
- **Optimize tests** if performance target exceeded
- **Return to 04-implement** if major regressions found

## 9. Final Test Validation

### 9A. Comprehensive Test Review

Final code-reviewer validation:

```
Task: Final test suite validation

Validate:
1. All acceptance criteria covered by tests
2. Tests pass consistently
3. No over-mocking issues remain
4. Performance target met (8-20s)
5. Regression protection adequate
6. Test maintainability good

Return final approval or remaining issues.
```

### 9B. Linear Update Preparation

Prepare summary for Linear update:

```
Test Summary for Linear:
- Test files created: [list]
- Acceptance criteria covered: [X/Y]
- Edge cases tested: [count]
- Regression tests: [pass/fail]
- Performance: [Xs execution time]
```

## 10. Concise Test Output

```
✅ RR-XXX Testing Complete

Tests Created:
- src/__tests__/unit/[feature].test.ts: [X test cases covering acceptance criteria]
- src/__tests__/integration/[feature]-api.test.ts: [Y integration tests]
- src/__tests__/stores/[feature]-store.test.ts: [Z store tests with isolation]

Test Results:
- Passed: [X] tests
- Failed: [Y] tests
- Skipped/Ignored: [Z] tests

Failures/Issues Summary:
- [Test name]: Failed - [brief reason] (fixed/needs attention)
- [Test name]: Skipped - [why ignored] (acceptable/needs investigation)
- [Infrastructure issue]: [description] (resolved/monitoring)

Infrastructure:
- Test Infrastructure: ✅ Validated and stable
- PM2 Services: ✅ Running normally
- Memory Usage: ✅ Within safe limits
- Emergency Cleanup: Available if needed

Coverage:
- Acceptance Criteria: [X/Y covered]
- Edge Cases: [Z scenarios tested]
- Regression Protection: ✅ All existing tests pass
- Mocking: Realistic (database + API schemas verified)

Quality:
- TypeScript: ✅ No errors
- Linting: ✅ All rules passed
- Test Execution: ✅ [X]s (within 8-20s target)
- Test Quality Review: ✅ code-reviewer approved

Next Steps - Choose one:
1. ✅ Everything works - Update Linear with test files and summary
2. 🔄 Re-run tests - Run tests again (if intermittent failures or after fixes)
3. 🚨 Report problems - Describe specific issues for troubleshooting
```

## Error Handling

- **If test generation fails**: Analyze implementation more thoroughly, try different approach
- **If quality checks fail**: Fix issues before test execution
- **If tests timeout**: Provide manual commands and wait for user results
- **If regressions found**: Fix implementation or return to 04-implement
- **If test quality poor**: Regenerate with code-reviewer feedback

## Key Rules

- ✅ ALWAYS analyze working implementation behavior first
- ✅ ALWAYS gather realistic service schemas (db-expert-readonly, Serena, web-researcher)
- ✅ ALWAYS review test quality with code-reviewer (with over-mocking detection)
- ✅ ALWAYS run quality checks before test execution
- ✅ ALWAYS check for regressions in full test suite
- ✅ ALWAYS provide manual commands if timeout risk
- 🚫 NO test generation without implementation analysis
- 🚫 NO unrealistic mocks or fake data structures
- Focus on regression prevention and acceptance criteria validation