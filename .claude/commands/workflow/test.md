---
description: Test an implemented feature that's in review. Validates against Linear acceptance criteria and runs comprehensive test suite.
argument_hint: <linear-issue-id>
---

# Test Implementation

Test the implementation for Linear issue $ARGUMENTS against its documented requirements and acceptance criteria. Test on dev server ONLY, and never on production server. Dev server is the development server.

## ⚠️ CRITICAL WARNING: Memory-Safe Test Execution Required

**Previous test runner issues caused severe memory exhaustion requiring system reboots.** All test execution MUST use the safe test runner with resource limits. See Section 2.A for safe execution commands. 

If you must run a test command that might hang the activity, ask me to run it on your behalf instead. Just give me the entire command to run, along with a way to pipe the output to a file so that you can read it easily. `tee` command will be preferred wherever possible.

## Step 0: Linear Validation & Context Recovery

### Verify Issue Status
Use `linear-expert` agent to:
1. Verify issue exists and is in "In Review" status
2. If not in review:
   - If "In Progress": Suggest completing implementation first
   - If "Done": Explain testing was already completed
   - If other status: Explain current status and next steps
3. Get full issue specification (description + ALL comments)
4. Extract:
   - Original requirements
   - Implementation plan from comments
   - **Test Contracts** from comments (API/DB specifications)
   - Test cases from comments
   - Any spec clarifications in comments

### Rebuild Context (Since Cleared)
Gather context to understand what was implemented:

1. **Database Context** (db-expert-readonly):
   - Current schema for affected tables
   - Check if expected changes were made
   - Verify constraints and indexes

2. **Code Changes** (doc-search):
   - Search for files mentioned in Linear comments
   - Find new/modified API endpoints
   - Check test files that were added/modified

3. **Memory Context** (memory MCP):
   - Search for relevant project patterns
   - Retrieve any stored context about this feature

4. **Recent Work** (git-expert):
   - Check recent commits for this issue (RR-XXX)
   - Identify all files changed

### Pre-Test Verification
Check for:
1. **Implementation comment**: Look for implementation summary
2. **Test Contracts**: Verify contracts are documented (from /analyze)
3. **Test documentation**: Verify test cases are documented
4. **Files changed**: Note which files were modified

If missing critical information:
- 🛑 STOP and explain what's needed
- Suggest running `/execute` if implementation incomplete

## 1. Environment Preparation & Test Planning

### Create Test Checklist
Use TodoWrite to track testing progress:
```
- [ ] Environment verification
- [ ] Unit tests execution
- [ ] Test Contract validation
- [ ] Integration tests
- [ ] Acceptance criteria verification (from Linear)
- [ ] Edge case testing
- [ ] Performance validation
- [ ] Security review
- [ ] Bug documentation
- [ ] Final report generation
```

### Verify Testing Environment
```bash
pm2 status | grep -E "rss-reader|sync"
curl -s http://localhost:3000/api/health/app | jq .status
curl -s http://localhost:3000/api/health/db | jq .database
```
Clear test artifacts and ensure clean state for testing.

**Note about Integration Test Setup**: Integration tests now properly load environment variables from .env.test and use the test-server.ts setup for integration tests with real API endpoints.

## 2. Test Execution

### A. Unit Test Verification

⚠️ **CRITICAL: Use Memory-Safe Test Execution**
```bash
# SAFE - Uses safe-test-runner.sh with resource limits
npm test

# AVOID - Coverage can spawn excessive processes
# npm run test:coverage  # Use only for specific files

# If tests hang or cause memory issues:
./scripts/kill-test-processes.sh

# Monitor test execution in another terminal:
./scripts/monitor-test-processes.sh
```

**Resource Limits Enforced:**
- Max 1 concurrent test execution
- Max 2 vitest worker processes  
- 120-second timeout per test
- Automatic cleanup on exit

Document: total tests, pass/fail counts, coverage % (if run), failing test details.

**Note**: Integration tests should use `vitest.integration.config.ts` and fetch is no longer mocked in integration tests.

### B. Test Contract Validation
**Validate implementation matches the Test Contracts from /analyze:**

Compare actual implementation against documented contracts:
```
📝 Test Contract Validation:

API Contract Check:
- Expected: [from Linear comments]
- Actual: [test the actual endpoint]
- Result: ✅ MATCH or ❌ MISMATCH [details]

Database Contract Check:
- Expected changes: [from Linear]
- Actual changes: [query database]
- Result: ✅ MATCH or ❌ MISMATCH [details]

State Transitions:
- Expected: [from Linear]
- Actual: [test the transitions]
- Result: ✅ MATCH or ❌ MISMATCH [details]
```

If contracts don't match:
- Document the deviation
- Determine if it's a test issue or implementation issue
- Note: Implementation should match contracts, not vice versa

### C. Integration & E2E Testing

**Integration Tests**: Based on feature type:
- **Sync**: Manual sync via API, check sync_metadata, verify bi-directional sync
- **Database**: Schema changes, migrations, query performance, RLS policies
- **UI**: Development environment, responsive design, offline functionality

**E2E Tests**: For UI features, run Playwright:
```bash
# Run all browser profiles
npx playwright test
# Or specific: chrome, firefox, safari, iphone, ipad
npx playwright test --project=iphone
```

### D. Acceptance Criteria Testing
Test each criterion from Linear issue. Document as:
```
✅ Criterion: [Description] - PASS - [Evidence]
❌ Criterion: [Description] - FAIL - [Issue + Log/Screenshot]
```

### E. Edge Case & Regression Testing
Test edge cases: boundary conditions, error scenarios, concurrent operations, network failures, memory constraints.
Verify core functionality: article reading, sync pipeline, OAuth, performance, critical user paths.

## 2.5. Optional: `test-expert` Quality Review

**When you want a second opinion on implementation quality:**

Use `test-expert` agent for implementation review (not test execution):
```
Task: Review the implementation for RR-XXX
Context:
- Linear requirements: [provide full details]
- Test Contracts: [from Linear comments]
- Implementation files: [list changed files]
- Test results so far: [your findings]

Review for:
- Code quality and patterns
- Security vulnerabilities
- Performance implications
- Test coverage adequacy
- Adherence to specifications
```

This gives you expert assessment without losing visibility of test execution.

## 3. Performance Validation

Check against baselines:
```bash
# Test suite performance (target: <20s)
node scripts/check-performance-regression.js

# Runtime memory usage
pm2 show rss-reader-dev | grep memory

# Database query performance
# Use db-expert-readonly to run EXPLAIN on new queries
```

## 4. Security Review

Verify: no exposed secrets, proper error handling, input validation, XSS/SQL injection prevention, authentication checks.

## 5. Bug Documentation

Document bugs as:
```
🐛 [Title] - Severity: Critical|High|Medium|Low
Description: [What's wrong]
Reproduce: [Steps] → Expected vs Actual
Evidence: [Screenshot/Logs/Test output]
Fix: [If obvious]
```
Severity: Critical (data loss, security, crashes) → High (major features) → Medium (minor issues) → Low (cosmetic).

## 6. Test Report Generation

```
📋 Test Report for RR-XXX: [Title]

📊 Test Summary:
- Unit Tests: X/Y passed (execution time: Xs)
- Test Contracts: ✅ Match | ⚠️ Deviations [list]
- Integration: Tested [components]
- E2E Tests: [browsers tested]
- Acceptance Criteria: X/Y met
- Performance: ✅ Within baseline | ❌ Regression detected

✅ Working:
- [List verified features]
- [Contract validations that passed]

❌ Issues Found:
- [List bugs with severity]
- [Contract mismatches if any]

🔧 Performance:
- [Metrics vs baseline]
- Memory usage: [amount]
- Query performance: [timing]

🔒 Security: [Status]

📱 Test Coverage:
- Desktop browsers: [tested versions]
- iOS PWA: [version tested]
- Responsive: [breakpoints verified]

🚀 Release Ready: [Ready|Ready with conditions|Not ready]
- [Conditions/Blockers if any]

📝 TodoWrite Progress:
- [Show completed test checklist]
```

## 7. Update Linear

Ask `linear-expert` agent to ddd test report as comment. Update labels (add "has-bugs" if needed). Update status: pass → stay "In Review", minor issues → stay "In Review" with comment, blocking → "In Progress". Create separate issues for complex bugs.

## 8. Bug Fixing Loop

Fix Critical/High bugs immediately. Fix Medium/Low if affecting core functionality.
For each bug: write failing test → implement fix → verify test passes → run full test suite.
Continue until all critical/high bugs fixed, acceptance criteria pass, no regressions, acceptable performance.
After fixes, return to Step 2.

## 9. Final Summary & Issue Closure

```
✅ Testing Complete for RR-XXX - Result: PASS
Iterations: [X], Bugs Fixed: [X critical, Y high, Z medium/low]
Ready for manual verification and issue closure.
```

### Wait for Manual Verification
Wait for manual testing, address concerns, make adjustments if needed.

### Update Documentation (After Manual Verification)
Update relevant project documentation:
- **API Documentation**: New/changed endpoints with examples and schemas  
- **Configuration**: Environment variables, PM2 services, monitoring, OAuth
- **Development**: Build scripts, testing requirements, troubleshooting

#### Update CHANGELOG.md
```markdown
## [Unreleased]
### Added
- [RR-XXX features]
### Changed  
- [RR-XXX modifications]
### Fixed
- [Bugs fixed]
### Technical
- [Internal improvements]
```
Include: date, Linear reference, user impact, breaking changes (⚠️), migration steps.

### Close Linear Issue using `linear-expert` agent
After confirmation: Change status to "Done", add final comment with timestamp, ensure linked issues resolved, confirm deployment readiness, note follow-ups.

## Important Notes

- Never close without manual verification
- Iterate until ALL bugs fixed  
- Test after every fix to prevent regressions
- Update documentation and CHANGELOG
- Fix new issues discovered during testing

Job complete when: tests pass, bugs fixed, docs updated, CHANGELOG current, manually verified and approved, Linear closed.
