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
Use Linear MCP server to:
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

### Verify Gates Are Passed
Check that Linear issue has:
1. **Status**: Must be "In Progress"
2. **Plan**: Implementation approach documented in comments
3. **Tests**: Test scenarios documented in comments
4. **Analysis**: Shows `/analyze` was run (look for analysis comment)

If any gate fails:
- 🛑 **STOP** - Do not write any files
- Explain what's missing
- Suggest next steps (e.g., "Run /analyze RR-XXX first")

### Add Implementation Start Comment
Use Linear MCP server to add comment:
- "Starting implementation - [timestamp]"
- Note any spec changes discovered since analysis

## 2. Test-First Development

### Step 1: Write Tests FIRST
Generate tests based on Linear specification:
1. Extract test requirements from Linear issue comments
2. Create test files for:
   - Happy path scenarios from Linear spec
   - Edge cases identified during analysis
   - Error handling scenarios
   - Integration points mentioned in Linear
3. Structure tests following project conventions:
   - Unit tests: `src/lib/feature.test.ts` next to `src/lib/feature.ts`
   - Integration tests: `src/__tests__/integration/`
   - E2E tests: `tests/e2e/` or `src/__tests__/e2e/`
4. Write tests using Vitest framework:
   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   
   describe('Feature Name', () => {
     beforeEach(() => {
       // Setup and reset mocks
     });
     
     it('should meet acceptance criteria from Linear', async () => {
       // Test implementation
     });
   });
   ```
5. Run tests to confirm they fail (red phase): `npm test`

### Step 2: Implementation
1. Implement the solution to make tests pass
2. Follow the implementation plan from Linear comments
3. Commit frequently with descriptive messages referencing RR-XXX
4. Update Linear with progress if implementation takes multiple sessions

### Step 3: Test & Refine
1. Run tests continuously during development
2. Ensure all tests pass (green phase)
3. Refactor code while keeping tests green
4. Add any additional tests discovered during implementation

## 3. Specialist Reviews

Based on implementation type, perform specialized reviews:

### Database Changes Review
If database changes were made:
- Verify schema changes match requirements
- Check query performance using EXPLAIN
- Ensure RLS policies are appropriate
- Validate foreign key relationships
- Test migration scripts
- Check for data integrity issues

### Infrastructure Changes Review
If infrastructure/deployment changes were made:
- Check PM2 configuration updates
- Verify environment variable usage
- Test deployment scripts
- Ensure service health endpoints work
- Validate memory/resource constraints
- Check sync pipeline impacts

### UI Changes Review
If UI changes were made:
- Test responsive design
- Verify accessibility standards
- Check iOS PWA specific behaviors
- Test offline functionality
- Validate loading states
- Ensure optimistic UI updates work

Each review should verify:
- Does implementation match Linear requirements?
- Are there any security concerns?
- Is error handling adequate?
- Are there performance implications?

## 4. Quality Checks

Run comprehensive checks:
1. Full test suite: `npm test`
2. Type check: `npm run type-check`
3. Linter: `npm run lint`
4. Build verification: `npm run build`
5. Manual testing in dev environment

## 5. Update Linear

Use Linear MCP server to:
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

Remember: The Linear issue and its comments are the contract. No implementation without proper documentation and tracking!