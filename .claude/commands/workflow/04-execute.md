---
description: Complete implementation and delivery phase delivering working, tested, and deployed feature
argument_hint: [#issue|"feature description"]
---

# Execute - Implementation Phase

Complete implementation phase that takes prepared specifications and tests, then implements code to make tests pass. Assumes tests are already validated and comprehensive from the test-design phase.

**Prerequisites from 03-test-design:**

- Comprehensive test suite with quality gates passed
- Implementation contracts clearly defined
- Test validation completed (no further test quality analysis needed)
- Ready for red-green-refactor TDD cycle

**Implementation Focus**: This command focuses purely on implementation against pre-validated tests. Test design, validation, and quality checks are handled by the dedicated `03-test-design` command.

## Help Mode

If user provides `--help` or `help` parameter, display this usage guide instead of running the command:

```
execute - Complete implementation and delivery phase

USAGE:
  execute RR-123              Implement prepared Linear issue
  execute "description"       Implement feature (will run prepare first if needed)
  execute                     Implement current prepared work
  execute help                Show this help

DELIVERABLES:
  ✅ Complete feature implementation
  ✅ All tests passing
  ✅ Code quality checks passed
  ✅ Documentation updated
  ✅ Production-ready deployment

EXAMPLES:
  execute RR-67
  execute "add user preferences API"
  execute
```

## Instructions

**CRITICAL: Always activate Serena MCP at session start:**

```bash
# Activate Serena MCP for project context and symbol navigation
mcp__serena__activate_project
```

**First, check if user needs guidance:**

- If no parameters provided, check for prepared work and ask what to implement
- If `help` or `--help` provided, show the help mode above and stop
- Otherwise proceed with mode detection and implementation

### Phase 1: Preparation Verification and Setup

1. **Validate Test-Design Prerequisites**

   ```bash
   # Look for validated test files from 03-test-design
   find src/__tests__ -name "*[feature-name]*" -type f

   # Verify test quality validation completed
   # (Should show comprehensive test coverage from test-design phase)
   ```

2. **Integration Checks**
   - If no comprehensive tests found, run `03-test-design` first
   - Ensure test validation and quality gates are complete
   - Verify implementation contracts are established

3. **Implementation Context Setup**

   ```bash
   # Update issue status
   # Use linear-expert to update issue status to "In Progress"

   # Run tests to see current state (assume tests are validated)
   npm test -- --testPathPattern="[feature-name]" --verbose
   ```

### Phase 2: Implementation Against Tests

1. **Test-Driven Implementation Cycle** (Using Pre-Validated Tests)

   ```bash
   # Run specific tests to see expected failures (tests are pre-validated)
   npm test -- --testPathPattern="[feature-name]" --watch=false --verbose

   # Implement to make tests pass (no test quality analysis needed)
   # Use Serena MCP for targeted code modifications
   mcp__serena__replace_symbol_body symbol:"[component-name]" new_body:"[implementation]"

   # Re-run tests to verify progress
   npm test -- --testPathPattern="[feature-name]"
   ```

2. **Implementation Pattern** (Against Validated Test Suite)
   - Red: Run pre-validated tests, see expected failures
   - Green: Implement minimal code to pass comprehensive tests
   - Refactor: Clean up implementation
   - Repeat for next failing test (tests already quality-checked)

3. **Basic Quality Checks**

   ```bash
   # Quick quality checks during implementation
   npm run lint
   npm run type-check
   npm run build
   ```

### Phase 3: Final Verification

1. **Complete Test Suite**

   ```bash
   # Run all feature tests
   npm test -- --testPathPattern="[feature-name]"

   # Quick regression check
   npm test

   # Pre-commit validation
   npm run pre-commit
   ```

2. **API Documentation** (if applicable)

   ```bash
   # Validate OpenAPI coverage
   ./scripts/validate-openapi-coverage.js
   ```

3. **Basic Integration Check**
   - Verify feature works with existing functionality
   - Test critical user workflows
   - Check for obvious regressions

### Phase 4: Implementation Complete

1. **Implementation Verification**

   ```bash
   # Verify all changes are ready (but do not commit)
   git status
   git diff

   # Prepare commit message for later use
   # "feat(#[issue-number]): implement [feature-name]
   # - [key implementation detail]
   # - [key implementation detail]
   # Closes #[issue-number]"
   ```

2. **Issue Update**

   ```bash
   # Update Linear issue with implementation complete status
   # Use linear-expert to add completion comment and mark as "Ready for Review"
   ```

## Output Format

```
## 🔧 Implementation Phase: [Feature/Issue Title]

### 📊 Implementation Context
**Serena MCP**: ✅ Activated
**Current Branch**: [branch-name]
**Issue**: #[number] ([title])
**Tests**: ✅ Pre-validated

### 🔄 TDD Implementation Cycle

**Initial Test Status:**
```

FAIL src/**tests**/unit/[feature].test.tsx
✗ [test-case-1] (not implemented)
✗ [test-case-2] (not implemented)

```

**Implementation Progress:**
- [x] Implemented [feature-component-1] ✅
- [x] Implemented [feature-component-2] ✅
- [x] All tests passing ✅

### 🧪 Final Test Results

**Feature Tests:**
```

PASS src/**tests**/unit/[feature].test.tsx
✓ [test-case-1] (12ms)
✓ [test-case-2] (8ms)

Test Suites: 1 passed, 1 total
Tests: 3 passed, 3 total

```

**Quality Checks:**
- TypeScript: ✅ No errors
- Linting: ✅ All rules passed
- Build: ✅ Successful

### 📁 Code Changes

**Files Modified:**
- `src/[component1].ts` - [implementation summary]
- `src/[component2].ts` - [implementation summary]

### ✅ Implementation Complete

**Ready for Next Phase:**
- [x] All tests passing
- [x] Code quality validated
- [x] Ready for documentation

**Prerequisites Met:**
- ✅ Comprehensive tests from `03-test-design`
- ✅ Quality gates passed in test-design phase
- ✅ Implementation contracts established

**Next Step:** Use `05-code-review` for quality validation
```

## Error Handling

- **If no comprehensive tests found**: Run `03-test-design` first to create validated test suite
- **If test quality is questionable**: Return to `03-test-design` for proper validation
- **If tests fail during implementation**: Stop and fix implementation before continuing
- **If quality checks fail**: Address issues before marking complete

## Workflow Integration

**Input Assumptions (from 03-test-design):**

- Tests are comprehensive and validated
- Quality gates have been passed
- Implementation contracts are clear
- No additional test quality analysis needed

**Handoff Deliverables (to 05-code-review):**

- Complete working implementation
- All tests passing
- Code quality validated
- Ready for documentation phase

## Tool Usage Best Practices

- **Serena MCP**: Primary tool for code implementation and symbol modification
- **Linear MCP**: Progress tracking and issue management
- **TodoWrite**: Implementation progress tracking
- **Bash**: Test execution and quality checks
- **Edit/MultiEdit**: File modifications when Serena isn't optimal

## Implementation Philosophy

**Test-Driven Focus**: Assumes tests are pre-validated and comprehensive
**Red-Green-Refactor**: Classic TDD cycle without test validation overhead
**Implementation Efficiency**: Focus on making tests pass, not analyzing test quality
**Clean Handoff**: Ready implementation for documentation phase
