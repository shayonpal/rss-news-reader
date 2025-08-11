---
description: Execute the implementation plan with test-first development approach. Accepts Linear issue ID as argument for work tracking. Minor fixes (docs, configs, formatting) don't require Linear backing.
argument_hint: [linear-issue-id] [additional-context]
---

# Execute Implementation Plan

## Step 0: Linear Validation

### Check for Linear Issue ID
1. Check if a Linear issue ID is provided as argument
2. If not provided, check if the request mentions minor fixes:
   - Documentation updates
   - Configuration changes
   - Formatting/linting fixes
   - Dependency updates
   - Emergency hotfixes (create issue after)

### For Non-Minor Work Without Linear ID
- **STOP** and ask me for Linear issue ID
- Explain that all significant work must be tracked in Linear
- Suggest creating an issue if one doesn't exist

### If Linear ID Provided
Use `linear-expert` to:
1. Verify issue exists and get full specification (description + all comments)
2. Check for required documentation in comments:
   - Look for "Implementation Plan" or "Approach" in any comment
   - Look for "Test Cases" or "Test Scenarios" in any comment
3. If either is missing:
   - 🛑 STOP - Explain what's missing
   - Suggest: "Please document the implementation plan and test cases in Linear before executing"
   - Do not proceed with any file operations
4. If both exist, verify issue is in "In Progress" status

### What Constitutes "Minor Work"
Minor work that doesn't require Linear backing includes:
- **Documentation updates**: README, CHANGELOG, code comments
- **Configuration changes**: .env examples, config files, build settings
- **Formatting/linting fixes**: Code style, import organization
- **Dependency updates**: Package version bumps (unless breaking)
- **Emergency hotfixes**: Critical production fixes (create Linear issue after)

## 1. Pre-Implementation Verification

### Infrastructure Health
```bash
# Quick health check before coding
npm run type-check && npm run lint
```
If fails → Use `infra-expert` for emergency fixes

### Verify Gates Are Passed
Check that Linear issue has:
1. **Status**: Must be "In Progress"
2. **Plan**: Implementation approach documented in comments
3. **Tests**: Test scenarios documented in comments
4. **Analysis**: Shows `/analyze` was run (look for analysis comment)

If any gate fails:
- 🛑 **STOP** - Do not write any files
- Suggest next steps (e.g., "Run /analyze RR-XXX first")

### Add Implementation Start Comment
Use `linear-expert` to add comment:
- "Starting implementation - [timestamp]"
- Note any spec changes discovered since analysis

## 2. Test-First Development

### Step 1: Rebuild Context and Write Tests FIRST

#### 1A. Gather Complete Context (Since context was cleared)
Use agents IN PARALLEL to rebuild understanding:

1. **Linear Context** (linear-expert):
   - Get full issue with all comments
   - Extract Test Contracts from comments
   - Find Implementation Strategy

2. **Database Context** (db-expert-readonly):
   - Get schema for relevant tables
   - Understand constraints and relationships
   - Check existing data patterns

3. **Code Context** (doc-search):
   - Find similar test files (*.test.ts)
   - Identify test utilities and helpers
   - Find similar API implementations
   - Check existing error handling patterns

4. **Memory Context** (memory MCP):
   - Search for project-specific patterns
   - Retrieve any stored testing approaches

#### 1B. Invoke test-expert with FULL Context
Provide test-expert with complete context package:
```
Linear Issue: [full details]
Test Contracts: [from Linear comments]
Implementation Strategy: [from Linear]

Database Schema:
[Complete relevant table structures]

Existing Test Examples:
[Similar tests from codebase]

Test Utilities Available:
[Helper functions, setup patterns]

CRITICAL: These tests are the SPECIFICATION. They define what the implementation must do. Tests should NEVER be modified to match implementation - implementation must be modified to pass tests.
```

#### 1C. Validate Tests Are Specifications
Ensure test-expert has written tests that:
1. Match the Test Contracts exactly
2. Use existing test patterns from codebase
3. Test behavior, not implementation details
4. Include all acceptance criteria from Linear
5. Run tests to confirm they fail (red phase)

### Step 2: Implementation
1. Implement the solution to make tests pass
2. Follow the implementation plan from Linear comments
3. Track performance: Keep test execution under 20s baseline
4. Update Linear with progress if implementation takes multiple sessions

### Step 3: Test & Refine
1. Run tests continuously during development
2. Ensure all tests pass (green phase)
3. Check performance: `node scripts/check-performance-regression.js`
4. For UI changes: Run Playwright tests `npx playwright test --project=chrome`
5. Refactor code while keeping tests green

## 3. Specialist Reviews

Based on implementation type, get reviews from read-only agents:
- **Database changes**: Use `db-expert-readonly` to verify schema/queries
- **Infrastructure changes**: Use `devops-expert-readonly` to check deployment impact
- **UI changes**: Use `ui-expert` to review user experience

Each review should check:
- Does implementation match Linear requirements?
- Are there any security concerns?
- Is error handling adequate?
- Are there performance implications?

## 4. Quality Checks

Run comprehensive checks:
1. Full test suite: `npm test` (should complete in <20s)
2. Type check: `npm run type-check`
3. Linter: `npm run lint`
4. Build verification: `npm run build`
5. E2E tests (if UI): `npx playwright test`
6. Performance check: `node scripts/check-performance-regression.js`

## 5. Update Linear

Use `linear-expert` to:
1. Change status to "In Review"
2. Add implementation summary as comment:
   - List all files changed
   - Note any discovered issues
   - Confirm all tests passing
   - Link to any follow-up issues created

## 6. Implementation Report

Provide summary:
```
📋 Implementation Complete: RR-XXX

✅ What was implemented:
- [Key change 1]
- [Key change 2]

🧪 Tests written:
- X unit tests (all passing)
- Y integration tests (all passing)

📁 Files changed:
- src/... (implementation)
- src/__tests__/... (tests)

✅ Quality checks:
- Type check: Passing
- Linter: Passing
- Build: Successful
- Manual testing: Completed

🚀 Ready for review

Any follow-up tasks needed? (will create new issues)
```

## Important Notes

- 🚫 NO file operations without Linear verification gates passed
- Test-first development is mandatory (tests before implementation)
- All work must trace to Linear issues (except minor fixes)
- Implementation plan must be documented before coding
- Status must be "In Progress" before writing code
- When implementing the task, ensure existing code, functions, api endpoints and methods are used and extended as much as possible, instead of creating new ones.

Remember: The Linear issue and its comments are the contract. No implementation without proper documentation and tracking!