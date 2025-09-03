---
description: Test implemented feature using symbolic analysis and comprehensive validation against Linear acceptance criteria
argument_hint: <linear-issue-id>
---

# Test Implementation with Symbol Analysis

## Project Activation

First, activate Serena MCP to access project memories and symbol navigation:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

Test the implementation for Linear issue $ARGUMENTS using symbolic navigation and comprehensive validation.

## 1. Linear Validation & Symbol Discovery

### Verify Issue Context

Use `linear-expert` to:

- Verify issue is in "In Review" status
- Extract requirements, test contracts, and acceptance criteria
- Get implementation plan and test cases from comments

### Symbol-Level Implementation Analysis

Use Serena MCP to understand what was implemented:

1. **Find Implementation Symbols**:
   - `search_for_pattern` with Linear issue ID to find related commits
   - `get_symbols_overview` on changed files to map modifications
   - `find_symbol` for specific functions/classes mentioned in Linear

2. **Map Symbol Dependencies**:
   - `find_referencing_symbols` to identify impact scope
   - Trace call chains for integration test planning
   - Identify all symbols that need testing

3. **Test Coverage Analysis**:
   - Locate existing test files for modified symbols
   - `find_symbol` to map tests to implementation symbols
   - Identify missing test coverage areas

## 2. Test Execution Strategy

### Create Symbol-Based Test Plan

Use TodoWrite to track testing by symbol:

```
- [ ] Environment verification
- [ ] Primary symbols: [list from symbol analysis]
- [ ] Consumer symbols: [components using the changes]
- [ ] Integration symbols: [API routes, DB operations]
- [ ] Test contract validation
- [ ] Acceptance criteria verification
- [ ] Performance validation
- [ ] Bug documentation
```

### Environment Health Check

```bash
pm2 status | grep -E "rss-reader|sync"
curl -s http://localhost:3000/api/health/app | jq .status
npm run type-check && npm run lint
```

## 3. Symbol-Level Testing

### A. Unit Test Execution (Memory-Safe)

```bash
# SAFE - Uses optimized test runner
npm run test:optimized

# For specific symbol tests
npx vitest run --no-coverage path/to/symbol.test.ts
```

### B. Symbol Contract Validation

For each modified symbol, validate against contracts:

```
Symbol: ArticleStore/syncArticles
Expected Behavior: [from test contracts]
Actual Behavior: [test execution results]
Status: ✅ PASS | ❌ FAIL [details]

Dependencies Tested:
- SyncService/performSync: [status]
- useArticleStore hook: [status]
```

### C. Integration Testing

Use `test-expert` for comprehensive validation:

```
Context Package:
- Linear Issue: [RR-XXX with full requirements]
- Symbol Changes: [exact functions/classes modified]
- Test Contracts: [from Linear comments]
- Dependency Map: [from find_referencing_symbols]
- Implementation Files: [list from git analysis]

Testing Focus:
- Symbol-level functionality
- Integration point validation
- Contract compliance
- Performance impact
```

## 4. Acceptance Criteria Validation

For each criterion from Linear:

```
✅ Criterion: [Description]
   Symbol: [relevant function/class]
   Evidence: [test results/screenshots]

❌ Criterion: [Description]
   Symbol: [failing function/class]
   Issue: [specific problem]
   Fix Required: [action needed]
```

## 5. Performance & Security Review

### Performance Validation

```bash
# Test execution baseline (<20s)
npm run test:performance

# Memory usage check
pm2 monit

# Symbol call chain analysis (via Serena)
# Check for bottlenecks in modified symbols
```

### Security Review

- No hardcoded secrets in symbol implementations
- Input validation in API route symbols
- Authentication checks maintained
- Error handling consistent across symbol chain

## 6. Bug Documentation & Fixes

Document issues with symbol-level precision:

```
🐛 [Title] - Severity: Critical|High|Medium|Low
Symbol: [exact function/class with issue]
Location: [file:line]
Description: [what's wrong]
Impact: [which dependent symbols affected]
Fix: [specific symbol modification needed]
```

## 7. Comprehensive Test Report

```
📋 Test Report for RR-XXX: [Title]

🔍 Symbol Analysis:
- Primary symbols tested: [list with results]
- Consumer symbols validated: [list]
- Integration points verified: [list]
- Dependencies checked: [count via find_referencing_symbols]

📊 Test Results:
- Unit Tests: X/Y passed (execution time: Xs)
- Symbol Contracts: ✅ All match | ⚠️ [deviations listed]
- Integration: [status by component]
- Acceptance Criteria: X/Y met

✅ Verified Functionality:
- [Symbol-by-symbol breakdown]
- [Contract validations passed]

❌ Issues Found:
- [Symbol-specific bugs with severity]
- [Missing test coverage areas]

🚀 Release Status: Ready | Conditional | Blocked
- [Specific symbol-level conditions if any]
```

## 8. Linear Update & Closure

Use `linear-expert` to:

- Add comprehensive test report as comment
- Update status based on results:
  - Pass → Keep "In Review"
  - Minor issues → "In Review" with conditions
  - Blocking issues → "In Progress"
- Create separate issues for complex bugs found

## Important Notes

- **Symbol-First Testing**: Focus on exact functions/classes changed
- **Use test-expert**: Leverage agent for comprehensive symbol analysis
- **Memory Safety**: Always use optimized test runners
- **Iterative Fixes**: Fix critical issues immediately and re-test
- **Documentation**: Update CHANGELOG.md after successful testing

**Completion Criteria**: All symbols tested, contracts validated, acceptance criteria met, no critical bugs, performance within baseline, manual verification complete.

**Next Step**: If all tests pass, use `07-document` to create comprehensive documentation before final commit.
