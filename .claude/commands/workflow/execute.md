---
description: Execute the implementation plan with test-first development approach. Accepts Linear issue ID as argument for work tracking. Minor fixes (docs, configs, formatting) don't require Linear backing.
argument_hint: [linear-issue-id] [additional-context]
---

# Execute Implementation Plan

## Project Activation

First, activate Serena MCP to access project memories and symbol navigation:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

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

3. **Code Context** (Use Serena MCP):
   - Use `find_symbol` with pattern "\*.test.ts" to locate test files
   - Use `get_symbols_overview` on test files to understand test structure
   - Find test utilities: `find_symbol` with "beforeEach|describe|it|expect"
   - Use `find_symbol` to locate similar API implementations by name
   - Use `find_referencing_symbols` to understand code dependencies
   - Map symbol relationships for the feature being implemented

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

#### 1D. Symbol-Level Test Mapping

Use Serena to ensure complete test coverage:

1. **Map Test-to-Symbol Relationships**:
   - Use `find_symbol` to locate all symbols mentioned in test contracts
   - For each symbol, use `find_referencing_symbols` to find dependencies
   - Ensure tests cover primary symbols and critical dependencies

2. **Validate Coverage Completeness**:
   - Primary symbols: Must have dedicated test cases
   - Consumer symbols: Must have integration tests
   - Utility symbols: Covered through usage tests

3. **Generate Symbol Test Matrix**:
   ```
   Symbol Coverage Matrix:
   - ArticleStore/syncArticles → sync.test.ts (unit)
   - SyncService/performSync → sync-service.test.ts (unit)
   - /api/sync/trigger → api-sync.test.ts (integration)
   - All 3 symbols → sync-flow.test.ts (E2E)
   ```

#### 🔍 VERIFICATION CHECKPOINT: Test Implementation

After completing test writing, present verification menu:

```
📊 IMPLEMENTATION SUMMARY - TEST PHASE

✅ Completed:
- [X] Test contracts extracted from Linear
- [X] Test files written: [list test files]
- [X] Symbol coverage matrix generated
- [X] Tests run and confirmed failing (red phase)

🎯 Next Steps:
- If verified: Proceed to core implementation
- If changes needed: Modify tests based on feedback

🔧 For Manual Verification:
- Review test cases match Linear requirements exactly
- Verify test file structure follows project patterns
- Check that tests are comprehensive but not over-specified
- Ensure tests focus on behavior, not implementation details

Choose: 1) Verify Manually, 2) Needs Changes, 3) Manually Verified
```

Wait for user choice before proceeding to Step 2.

### Step 2: Implementation with Symbol Precision

#### 2A. Choose the Right Editing Approach

**Use Serena's Symbolic Editing for:**

- **Whole function/method replacement**: `replace_symbol_body`
- **Adding new methods to classes**: `insert_after_symbol`
- **Adding imports or initialization**: `insert_before_symbol`
- **Major refactoring**: Complete symbol replacement

**Use Traditional Edit/MultiEdit for:**

- Changing a few lines within a large function
- Updating string literals or constants
- Minor bug fixes within a method
- Configuration value changes

#### 2B. Serena Editing Patterns

1. **Replacing Entire Functions/Methods**:

   ```
   # First, find the symbol to understand current implementation
   find_symbol(name_path="ArticleStore/syncArticles", include_body=true)

   # Then replace the entire body
   replace_symbol_body(
     name_path="ArticleStore/syncArticles",
     relative_path="src/lib/stores/article-store.ts",
     body="async syncArticles() { /* new implementation */ }"
   )
   ```

2. **Adding New Methods to Classes**:

   ```
   # Insert after an existing method
   insert_after_symbol(
     name_path="ArticleStore/syncArticles",
     relative_path="src/lib/stores/article-store.ts",
     body="async newMethod() { /* implementation */ }"
   )
   ```

3. **Adding Imports**:

   ```
   # Find first symbol in file, insert before it
   get_symbols_overview("src/lib/stores/article-store.ts")
   insert_before_symbol(
     name_path="[first symbol name]",
     relative_path="src/lib/stores/article-store.ts",
     body="import { newDependency } from './deps'"
   )
   ```

4. **Hybrid Approach for Partial Edits**:
   ```
   # For changing part of a large function:
   1. Use find_symbol to get current implementation
   2. Modify the specific part in the retrieved code
   3. Use replace_symbol_body with the modified version
   ```

#### 2C. Implementation Workflow

1. **Navigate to symbols from Linear documentation**:
   - Use exact symbol paths documented in analysis
   - Example: "Modify ArticleStore/syncArticles at lines 145-203"

2. **Check impact before modifying**:
   - Always run `find_referencing_symbols` first
   - Understand which code depends on your changes
   - Plan updates for all dependent symbols

3. **Apply modifications systematically**:
   - Start with leaf symbols (no dependencies)
   - Work up to higher-level symbols
   - Test after each symbol modification

4. **Track symbol-level progress**:
   - Document each symbol modified
   - Note if implementation spans multiple sessions
   - Update Linear with symbol-specific progress

### Step 3: Test & Refine

1. Run tests continuously during development
2. Ensure all tests pass (green phase)
3. Check performance: `node scripts/check-performance-regression.js`
4. For UI changes: Run Playwright tests `npx playwright test --project=chrome`
5. Refactor code while keeping tests green

#### 🔍 VERIFICATION CHECKPOINT: Core Implementation

After completing main implementation, present verification menu:

```
📊 IMPLEMENTATION SUMMARY - CORE IMPLEMENTATION

✅ Completed:
- [X] All symbols implemented according to Linear spec
- [X] Tests passing (green phase): [X/Y tests]
- [X] Symbol dependencies properly updated
- [X] Performance checks completed
- [X] Files modified: [list modified files with symbols]

🎯 Next Steps:
- If verified: Proceed to specialist reviews
- If changes needed: Refine implementation based on feedback

🔧 For Manual Verification:
- Test the actual functionality end-to-end
- Verify edge cases are handled properly
- Check error scenarios and user experience
- Confirm implementation matches Linear requirements exactly
- Test performance and responsiveness

Choose: 1) Verify Manually, 2) Needs Changes, 3) Manually Verified
```

Wait for user choice before proceeding to specialist reviews.

## 3. Specialist Reviews with Symbol Analysis

Based on implementation type, get symbol-aware reviews:

### Database Changes

Use `db-expert-readonly` with symbol context:

- Which symbols interact with modified tables
- Symbol-level query patterns and optimizations
- Impact on data access layer symbols

### Infrastructure Changes

Use `devops-expert-readonly` with symbol mapping:

- Service initialization symbols affected
- Configuration loading symbol modifications
- Deployment script symbol dependencies

### UI Changes

Use `ui-expert` with component symbols:

- Component tree via `find_referencing_symbols`
- State management symbol interactions
- Event handler symbol chains

### Symbol-Level Review Checklist

Each review should verify:

- All modified symbols match Linear requirements
- Symbol dependencies properly updated
- Error handling at symbol boundaries
- Performance impact on symbol call chains
- No orphaned symbols or dead code

#### 🔍 VERIFICATION CHECKPOINT: Specialist Reviews

After completing specialist reviews (DB, UI, Infrastructure), present verification menu:

```
📊 IMPLEMENTATION SUMMARY - SPECIALIST REVIEWS

✅ Completed:
- [X] Database expert review: [findings summary]
- [X] UI expert review: [findings summary]  
- [X] Infrastructure expert review: [findings summary]
- [X] Symbol-level impact analysis completed
- [X] All expert recommendations addressed

🎯 Next Steps:
- If verified: Proceed to comprehensive quality checks
- If changes needed: Address remaining specialist concerns

🔧 For Manual Verification:
- Review specialist feedback for any missed issues
- Verify expert recommendations were properly implemented
- Check that symbol changes don't break existing patterns
- Confirm architecture remains consistent
- Test integration points highlighted by experts

Choose: 1) Verify Manually, 2) Needs Changes, 3) Manually Verified
```

Wait for user choice before proceeding to quality checks.

## 4. Quality Checks

Run comprehensive checks:

1. Full test suite: `npm test` (should complete in <20s)
2. Type check: `npm run type-check`
3. Linter: `npm run lint`
4. OpenAPI documentation: `docs:validate`
5. Build verification: `npm run build`
6. E2E tests (if UI): `npx playwright test`
7. Performance check: `node scripts/check-performance-regression.js`

#### 🔍 VERIFICATION CHECKPOINT: Quality Checks

After completing all automated quality checks, present verification menu:

```
📊 IMPLEMENTATION SUMMARY - QUALITY CHECKS

✅ Completed:
- [X] Full test suite: [X/Y tests passing] (completed in <20s)
- [X] Type check: [passing/failing]
- [X] Linter: [passing/failing] 
- [X] OpenAPI documentation: [validated/issues found]
- [X] Build verification: [successful/failed]
- [X] E2E tests: [X/Y scenarios passing]
- [X] Performance check: [no regressions/issues found]

🎯 Next Steps:
- If verified: Proceed to final review before Linear update
- If changes needed: Address quality check failures

🔧 For Manual Verification:
- Review any test failures or warnings carefully
- Check build output for any concerning messages
- Verify performance metrics are acceptable
- Confirm all documentation is accurate and complete
- Test the complete user journey end-to-end

Choose: 1) Verify Manually, 2) Needs Changes, 3) Manually Verified
```

Wait for user choice before proceeding to final Linear update verification.

## 5. Manual Verification Checkpoints

### Implementation Verification Workflow

**IMPORTANT**: After completing the implementation and quality checks, DO NOT automatically update Linear. Instead, engage in manual verification process.

#### Present Verification Options

After each implementation step, present these choices to the user:

```
🔍 IMPLEMENTATION VERIFICATION CHECKPOINT

Implementation step completed. Please choose:

1. 🧪 Verify Manually - Review the implementation yourself
2. 🔄 Needs Changes - Implementation requires modifications  
3. ✅ Manually Verified. Move on to the next step.

What would you like to do? (Enter 1, 2, or 3)
```

#### Verification Process Flow

1. **Option 1 - Verify Manually**: 
   - Wait for user to review implementation
   - Present the same menu again after user returns
   - User can test functionality, review code quality, check edge cases

2. **Option 2 - Needs Changes**:
   - Ask user to specify what needs to be changed
   - Implement the requested changes
   - Re-run quality checks
   - Present verification menu again
   - Continue this cycle until user is satisfied

3. **Option 3 - Manually Verified**:
   - User confirms implementation meets requirements
   - Proceed to next step or Linear update
   - Only move forward when explicitly approved

#### Verification Points

Apply this verification workflow after:

- **Test Implementation**: After writing tests but before main implementation
- **Core Implementation**: After implementing main functionality  
- **Specialist Reviews**: After each expert review (DB, UI, Infrastructure)
- **Quality Checks**: After all automated checks pass
- **Final Review**: Before updating Linear status

#### Implementation Quality Summary

Before each verification checkpoint, provide a clear summary:

```
📊 IMPLEMENTATION SUMMARY

✅ Completed:
- [List what was just implemented]
- [Files modified and functions changed]
- [Tests passing status]

🎯 Next Steps:
- [What happens if user chooses option 3]
- [Remaining work if any]

🔧 For Manual Verification:
- [Specific areas to focus on]
- [Testing suggestions]
- [Edge cases to verify]
```

#### Handling Verification Iterations

- **Track Changes**: Keep record of what was modified in each iteration
- **Maintain Context**: Remember user feedback across verification cycles
- **Progressive Refinement**: Each iteration should improve implementation quality
- **No Shortcuts**: Don't proceed without explicit user approval (option 3)

### Pre-Linear Update Verification

**CRITICAL**: Before updating Linear, run final verification checkpoint:

```
🚨 FINAL VERIFICATION BEFORE LINEAR UPDATE

All implementation work is complete. Ready to update Linear issue status.

Current Implementation Status:
- ✅ All tests passing
- ✅ Code quality checks passed  
- ✅ User manually verified implementation
- ✅ Ready to mark as "In Review"

Choose:
1. 🧪 Final Manual Review - One last check before Linear update
2. 🔄 Additional Changes Needed - More work required
3. ✅ Approve Linear Update - Mark issue as "In Review"

This is your last chance to make changes before updating Linear.
What would you like to do? (Enter 1, 2, or 3)
```

Only proceed to Linear update after receiving option 3 from user.

## 6. Update Linear

Use `linear-expert` to:

1. Change status to "In Review"
2. Add implementation summary as comment:
   - List all files changed
   - Note any discovered issues
   - Confirm all tests passing
   - Link to any follow-up issues created

## 7. Implementation Report

**ONLY PROVIDE AFTER USER APPROVES LINEAR UPDATE** (Section 6 verification complete)

Provide symbol-precise summary:

```
📋 Implementation Complete: RR-XXX

✅ Symbols Modified:
- ArticleStore/syncArticles: Updated sync logic
- SyncService/performSync: Added retry mechanism
- /api/sync/trigger: Enhanced error responses

🔗 Symbol Dependencies Updated:
- 12 components updated via useArticleStore hook
- 3 API routes modified for new response format
- 5 test files updated for new behavior

🧪 Test Coverage:
- X unit tests (all passing) - covering Y symbols
- Z integration tests (all passing) - covering cross-symbol flows

📁 Precise Changes:
- src/lib/stores/article-store.ts: ArticleStore class (3 methods)
- src/services/sync-service.ts: SyncService class (2 methods)
- src/app/api/sync/trigger/route.ts: POST handler

✅ Quality checks:
- Type check: Passing
- Linter: Passing
- Build: Successful
- Symbol coverage: 100%

✅ Manual Verification:
- User verified implementation quality at each checkpoint
- All verification iterations completed successfully
- Final approval received for Linear update

🚀 Linear Status: Updated to "In Review"

Any follow-up tasks needed? (will create new issues)
```

## Important Notes

### Critical Workflow Rules

- 🚫 **NO file operations** without Linear verification gates passed
- 🚫 **NO Linear updates** without user manual verification and approval
- ✅ **Test-first development** is mandatory (tests before implementation)
- ✅ **Manual verification required** at every major checkpoint
- ✅ **User must explicitly approve** each step with option 3

### Verification Requirements

- **Wait for user choice** at each verification checkpoint
- **Present verification menu** after every implementation phase
- **Do not skip verification** even if automated checks pass
- **Keep iterating** until user chooses "Manually Verified" (option 3)
- **Track all changes** made during verification iterations

### Implementation Standards

- All work must trace to Linear issues (except minor fixes)
- Implementation plan must be documented before coding
- Status must be "In Progress" before writing code
- Use existing code, functions, API endpoints and methods when possible
- Extend rather than create new implementations

### Linear Integration

- Linear issue and comments are the implementation contract
- No implementation without proper documentation and tracking
- Only update Linear status after final user approval
- Document all verification iterations in implementation comments

Remember: **User controls quality gates** - proceed only when they explicitly verify each step!
