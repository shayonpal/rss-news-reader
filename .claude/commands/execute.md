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
- **STOP** and ask user for Linear issue ID
- Explain that all significant work must be tracked in Linear
- Suggest creating an issue if one doesn't exist

### If Linear ID Provided
Coordinate with `program-manager` to:
1. Verify issue exists and is assigned to the user
2. Get full specification (description + all comments)
3. Confirm issue is in "In Progress" status
4. Store the specification for QA reference throughout implementation

### What Constitutes "Minor Work"
Minor work that doesn't require Linear backing includes:
- **Documentation updates**: README, CHANGELOG, code comments
- **Configuration changes**: .env examples, config files, build settings
- **Formatting/linting fixes**: Code style, import organization
- **Dependency updates**: Package version bumps (unless breaking)
- **Emergency hotfixes**: Critical production fixes (create Linear issue after)

## 1. Pre-Implementation Setup

Invoke the `program-manager` agent to:
1. Verify issue is "In Progress" status
2. Add comment: "Starting implementation - [timestamp]"
3. Check for any new comments since analysis
4. Confirm implementation plan is still valid

## 2. Test-First Development

### Step 1: Write Tests FIRST
Ask `qa-engineer` to:
1. Write tests based on the Linear specification obtained in Step 0
2. Ensure tests validate against the official requirements only
3. Include:
   - Happy path scenarios from Linear spec
   - Edge cases identified during analysis
   - Error handling scenarios
   - Integration points mentioned in Linear
4. Save tests in appropriate test directory
5. Run tests to confirm they fail (red phase)

### Step 2: Implementation
1. Implement the solution to make tests pass
2. Follow the implementation plan from analysis
3. Commit frequently with descriptive messages
4. Keep `program-manager` updated on progress

### Step 3: Test & Refine
1. Run tests continuously during development
2. Ensure all tests pass (green phase)
3. Refactor code while keeping tests green
4. Add any additional tests discovered during implementation

## 3. Specialist Reviews

Based on implementation type, get reviews from:
- **Database changes**: `supabase-dba` reviews schema/queries
- **Sync changes**: `sync-reliability-monitor` reviews sync logic
- **UI changes**: `ux-engineer` reviews user experience
- **General code**: `qa-engineer` reviews all implementations

Each reviewer should check:
- Does implementation match requirements?
- Are there any security concerns?
- Is error handling adequate?
- Are there performance implications?

## 4. Fix Review Feedback

If reviewers identify issues:
1. Address each concern
2. Update tests if requirements changed
3. Re-run all tests
4. Get re-review from relevant agents
5. Continue until all agents approve

## 5. Final Verification

Once all reviews pass:
1. Run full test suite: `npm test`
2. Run type check: `npm run type-check`
3. Run linter: `npm run lint`
4. Test manually in dev environment
5. Verify against original acceptance criteria

## 6. Update Linear

`program-manager` updates the issue:
1. Change status to "In Review"
2. Add implementation summary as comment
3. List all files changed
4. Note any discovered issues or follow-ups
5. Add test results confirmation

## 7. Implementation Report

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

🚀 Ready for commit

Any follow-up tasks needed? (will create new issues)
```

## 8. Wait for Approval

Do NOT:
- Commit changes
- Update documentation
- Move to next task

Wait for user to:
- Test the implementation
- Approve for commit
- Decide on next steps

Remember: Test-first development ensures quality and prevents regressions!