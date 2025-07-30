---
description: Test an implemented feature that's in review. Validates against Linear acceptance criteria and runs comprehensive test suite.
argument_hint: <linear-issue-id>
---

# Test Implementation

Test the implementation for Linear issue $ARGUMENTS against its documented requirements and acceptance criteria. Test on dev server ONLY, and never on production server. Dev server is the development server. 

## Step 0: Linear Validation

### Verify Issue Status
Use Linear MCP server to:
1. Verify issue exists and is in "In Review" status
2. If not in review:
   - If "In Progress": Suggest completing implementation first
   - If "Done": Explain testing was already completed
   - If other status: Explain current status and next steps
3. Get full issue specification (description + ALL comments)
4. Extract:
   - Original requirements
   - Implementation plan from comments
   - Test cases from comments
   - Any spec clarifications in comments

### Pre-Test Verification
Check for:
1. **Implementation comment**: Look for implementation summary
2. **Test documentation**: Verify test cases are documented
3. **Files changed**: Note which files were modified

If missing critical information:
- 🛑 STOP and explain what's needed
- Suggest running `/execute` if implementation incomplete

## 1. Environment Preparation

Verify testing environment:
```bash
pm2 status | grep -E "rss-reader|sync"
curl -s http://localhost:3000/api/health/app | jq .status
curl -s http://localhost:3000/api/health/db | jq .database
```
Clear test artifacts and ensure clean state for testing.

## 2. Test Execution

### A. Unit Test Verification
```bash
npm test
npm run test:coverage
```
Document: total tests, pass/fail counts, coverage %, failing test details.

### B. Integration Testing
Test based on feature type:
- **Sync**: Manual sync via API, check sync_metadata, verify bi-directional sync, monitor API usage
- **Database**: Schema changes, migrations, query performance, RLS policies, transactions
- **UI**: Development environment, responsive design, iOS PWA, offline functionality, accessibility

### C. Acceptance Criteria Testing
Test each criterion from Linear issue. Document as:
```
✅ Criterion: [Description] - PASS - [Evidence]
❌ Criterion: [Description] - FAIL - [Issue + Log/Screenshot]
```

### D. Edge Case & Regression Testing
Test edge cases: boundary conditions, error scenarios, concurrent operations, network failures, memory constraints.
Verify core functionality: article reading, sync pipeline, OAuth, performance, critical user paths.

## 3. Performance Validation

Measure: page load times, sync completion, memory usage, database queries, API efficiency.
```bash
pm2 show rss-reader-dev | grep memory
# Monitor for memory leaks during 5-minute active use
# Run EXPLAIN on new database queries
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

📊 Summary: Unit Tests (X/Y, Z%), Integration (tested), Acceptance Criteria (X/Y), Edge Cases (X/Y), Regression (status)
✅ Working: [List verified features]
❌ Issues: [List bugs with severity]
🔧 Performance: [Metrics vs baseline, memory usage, query performance]
🔒 Security: [Status]
📱 Devices: [Desktop browsers, iOS PWA version, responsive breakpoints]
🚀 Ready: [Ready|Ready with conditions|Not ready] - [Conditions/Blockers]
```

## 7. Update Linear

Add test report as comment. Update labels (add "has-bugs" if needed). Update status: pass → stay "In Review", minor issues → stay "In Review" with comment, blocking → "In Progress". Create separate issues for complex bugs.

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
- **CLAUDE.md**: Architecture, commands, env vars, database schema, services
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

### Close Linear Issue
After confirmation: Change status to "Done", add final comment with timestamp, ensure linked issues resolved, confirm deployment readiness, note follow-ups.

## Important Notes

- Never close without manual verification
- Iterate until ALL bugs fixed  
- Test after every fix to prevent regressions
- Update documentation and CHANGELOG
- Fix new issues discovered during testing

Job complete when: tests pass, bugs fixed, docs updated, CHANGELOG current, manually verified and approved, Linear closed.
