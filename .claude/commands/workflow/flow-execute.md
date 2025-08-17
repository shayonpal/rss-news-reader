---
description: Complete implementation and delivery phase delivering working, tested, and deployed feature
argument_hint: [#issue|"feature description"]
---

# Flow Execute - Vertical Slice Implementation Phase

Complete implementation and delivery phase that takes a prepared specification and delivers a working, tested, and deployed feature. This command follows vertical slicing principles where implementation delivers complete, production-ready functionality.

**Vertical Slicing Principle**: This command represents the complete implementation slice that takes a fully-prepared specification and delivers working, tested, production-ready functionality. All code is implemented, tests pass, and the feature is ready for deployment.

## Help Mode

If user provides `--help` or `help` parameter, display this usage guide instead of running the command:

```
flow-execute - Complete implementation and delivery phase

USAGE:
  flow-execute #123           Implement prepared GitHub issue
  flow-execute "description"  Implement feature (will run prepare first if needed)
  flow-execute                Implement current prepared work
  flow-execute help           Show this help

DELIVERABLES:
  ✅ Complete feature implementation
  ✅ All tests passing
  ✅ Code quality checks passed
  ✅ Documentation updated
  ✅ Production-ready deployment

EXAMPLES:
  flow-execute #67
  flow-execute "add user preferences API"
  flow-execute
```

## Prerequisites

**Expected Input**: A fully prepared specification from `flow-prepare` including:

- Written and verified test specifications
- Complete implementation plan
- API documentation (if applicable)
- Clear acceptance criteria

**Auto-Preparation**: If no preparation found, will automatically run `flow-prepare` first

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

1. **Check for Existing Preparation**

   ```bash
   # Look for prepared specifications
   # Check GitHub issue for preparation comments
   gh issue view <number> --comments --json comments

   # Look for existing test files that define the feature
   find src/__tests__ -name "*[feature-name]*" -type f

   # Check TodoWrite tasks for implementation plan
   ```

2. **Auto-Prepare if Needed**
   - If no preparation found, automatically run `flow-prepare` first
   - Wait for preparation to complete before continuing
   - Verify all preparation deliverables are ready

3. **Implementation Context Setup**

   ```bash
   # Update issue status
   gh issue edit <number> --remove-label "preparing" --add-label "implementing"

   # Post implementation start comment
   gh issue comment <number> --body "🔧 **Implementation Phase Started**\n\nBeginning implementation against prepared specifications..."

   # Load prepared task list
   # Verify test files exist and fail correctly
   npm test -- --testPathPattern="[feature-name]" --verbose
   ```

### Phase 2: Implementation Against Tests

1. **Test-Driven Implementation**

   ```bash
   # Run specific tests to see current failures
   npm test -- --testPathPattern="[feature-name]" --watch=false --verbose

   # Implement features to make tests pass, one test at a time
   # Use Serena MCP for targeted code modifications
   mcp__serena__replace_symbol_body symbol:"[component-name]" new_body:"[implementation]"
   ```

2. **Incremental Implementation**
   - Implement one test case at a time
   - Commit working code incrementally
   - Keep implementation focused on test requirements
   - Use TodoWrite to track progress against prepared plan

3. **Code Quality During Implementation**

   ```bash
   # Run linting as you implement
   npm run lint

   # Fix TypeScript errors
   npm run type-check

   # Verify builds pass
   npm run build
   ```

4. **Progress Tracking and Communication**

   ```bash
   # Update GitHub issue with progress
   gh issue comment <number> --body "✅ Implemented: [completed-feature]\n🔄 Working on: [current-task]\n📋 Remaining: [remaining-tasks]"

   # Commit incrementally with descriptive messages
   git add -A
   git commit -m "feat: implement [specific-functionality] for issue #[number]"
   ```

### Phase 3: Integration and Verification

1. **Full Test Suite Execution**

   ```bash
   # Run all related tests
   npm test -- --testPathPattern="[feature-name]"

   # Run full test suite to check for regressions
   npm test

   # Run pre-commit checks
   npm run pre-commit
   ```

2. **API Documentation Verification** (if applicable)

   ```bash
   # Validate OpenAPI coverage
   ./scripts/validate-openapi-coverage.js

   # Test API endpoints if created
   curl -X GET "http://100.96.166.53:3000/reader/api/[endpoint]" -H "accept: application/json"
   ```

3. **Integration Testing**
   - Test with real data where applicable
   - Verify database migrations (if any)
   - Check cross-browser compatibility (if UI changes)
   - Validate performance requirements

4. **Manual Quality Assurance**
   - Test user workflows manually
   - Verify acceptance criteria are met
   - Check edge cases and error handling
   - Screenshot UI changes for documentation

### Phase 4: Production Readiness and Deployment

1. **Final Quality Checks**

   ```bash
   # Comprehensive test run
   npm run test:all

   # Build verification
   npm run build

   # Security and dependency check
   npm audit

   # Performance check if applicable
   npm run test:performance
   ```

2. **Documentation Updates**

   ```bash
   # Update CHANGELOG.md
   # Update README.md if new features
   # Update inline code documentation
   # Verify API documentation is current
   ```

3. **Deployment Preparation**

   ```bash
   # Final commit with complete implementation
   git add -A
   git commit -m "feat(#[issue-number]): complete [feature-name] implementation

   - [Implemented feature 1]
   - [Implemented feature 2]
   - [Documentation updates]

   Closes #[issue-number]"

   # Push to remote
   git push origin [branch-name]
   ```

4. **Issue Completion**

   ```bash
   # Final issue update
   gh issue comment <number> --body "$(cat <<'EOF'
   ## 🎉 **Implementation Complete**

   ### ✅ **Deliverables Completed**
   - ✅ Feature fully implemented
   - ✅ All tests passing ([test-count] tests)
   - ✅ Code quality checks passed
   - ✅ Documentation updated
   - ✅ Production-ready deployment

   ### 🧪 **Test Results**
   - Unit tests: ✅ [count] passing
   - Integration tests: ✅ [count] passing
   - E2E tests: ✅ [count] passing
   - Performance tests: ✅ [metrics]

   ### 📊 **Quality Metrics**
   - TypeScript: ✅ No errors
   - Linting: ✅ All rules passed
   - Build: ✅ Successful
   - Security: ✅ No vulnerabilities

   ### 🚀 **Ready for Production**
   This feature is now complete and ready for deployment.
   EOF
   )"

   # Close issue
   gh issue close <number> --comment "Implementation complete and ready for production."
   ```

## Output Format

```
## 🔧 Implementation Phase: [Feature/Issue Title]

### 📊 Implementation Context
**Serena MCP**: ✅ Activated
**Current Branch**: [branch-name]
**Issue**: #[number] ([title])
**Preparation Status**: ✅ Complete

### 🧪 Test-Driven Implementation

**Current Test Status:**
```

FAIL src/**tests**/unit/[feature].test.tsx
✗ [test-case-1] (not implemented)
✗ [test-case-2] (not implemented)
✗ [edge-case] (not implemented)

```

**Implementation Progress:**
- [x] Task 1: [Description] ✅
- [ ] Task 2: [Description] 🔄
- [ ] Task 3: [Description] ⏳

### 🔧 Code Changes

**Modified Files:**
- `src/[component1].ts` - [changes made]
- `src/[component2].ts` - [new functionality added]
- `src/__tests__/unit/[feature].test.tsx` - [test updates if needed]

**Commits Made:**
- `abc1234` - feat: implement [feature-part-1] for issue #[number]
- `def5678` - feat: add [feature-part-2] with error handling
- `ghi9012` - feat: complete [feature-name] implementation

### 🧪 Test Results

**Latest Test Run:**
```

PASS src/**tests**/unit/[feature].test.tsx
✓ [test-case-1] (12ms)
✓ [test-case-2] (8ms)
✓ [edge-case] (15ms)

Test Suites: 1 passed, 1 total
Tests: 3 passed, 3 total

```

**Full Suite Status:**
- Unit tests: ✅ [count] passing
- Integration tests: ✅ [count] passing
- E2E tests: ✅ [count] passing

### 📊 Quality Assurance

**Code Quality:**
- TypeScript: ✅ No errors
- ESLint: ✅ All rules passed
- Prettier: ✅ Code formatted
- Build: ✅ Successful

**Performance:**
- Bundle size: ✅ Within limits
- Load time: ✅ [metrics]
- Memory usage: ✅ [metrics]

### 📚 Documentation

**Updated Documentation:**
- ✅ CHANGELOG.md updated with new features
- ✅ README.md updated (if applicable)
- ✅ API documentation current
- ✅ Inline code documentation complete

### ✅ Implementation Complete

**Production Readiness Checklist:**
- [x] All acceptance criteria met
- [x] Tests passing (100% of new tests)
- [x] No regressions in existing tests
- [x] Code quality standards met
- [x] Documentation updated
- [x] Security considerations addressed
- [x] Performance requirements met

**Deployment Status:**
- [x] Code committed and pushed
- [x] Issue closed with completion summary
- [x] Ready for production deployment

## 🎉 Feature Delivered

This feature is now complete and production-ready. All tests pass, code quality checks are satisfied, and documentation is current.

**Next Steps:**
- Use `flow-ship` if additional deployment steps needed
- Monitor production metrics after deployment
- Gather user feedback for future iterations
```

## Error Handling

- **If no preparation found**: Automatically run `flow-prepare` first
- **If tests fail during implementation**: Stop and fix implementation before continuing
- **If quality checks fail**: Address issues before marking complete
- **If deployment fails**: Document issues and provide recovery steps

## Tool Usage Best Practices

- **Serena MCP**: Primary tool for code implementation and symbol modification
- **GitHub CLI**: Progress tracking and issue management
- **TodoWrite**: Implementation progress tracking
- **Bash**: Test execution and quality checks
- **Edit/MultiEdit**: File modifications when Serena isn't optimal

## Implementation Patterns

### Test-First Development

```bash
# Always run tests first to understand requirements
npm test -- --testPathPattern="[feature]" --verbose

# Implement to make tests pass
mcp__serena__replace_symbol_body

# Verify tests pass after implementation
npm test -- --testPathPattern="[feature]"
```

### Incremental Commits

```bash
# Commit working functionality frequently
git add [specific-files]
git commit -m "feat: implement [specific-functionality] for #[issue]"

# Push regularly to keep remote updated
git push origin [branch]
```

### Quality Gates

```bash
# Before marking any task complete:
npm run lint          # Code style
npm run type-check    # TypeScript
npm run build         # Build verification
npm test              # Test suite
```

## Vertical Slicing Benefits

**Complete Feature Delivery**: Implementation phase delivers fully working, tested features
**Production Ready**: All quality checks ensure deployment readiness
**Independent Execution**: Can implement any prepared specification
**Quality Assurance**: Tests and documentation guarantee feature completeness
**Deployment Ready**: Feature is immediately usable in production

## Workflow Integration

- **Requires**: `flow-prepare` (preparation phase with specifications)
- **Precedes**: `flow-ship` (deployment and monitoring)
- **Integrates with**: `manage-issue` (issue management)
- **Supports**: Implementing multiple prepared features independently
