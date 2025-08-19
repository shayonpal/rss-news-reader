---
description: Complete preparation and test planning phase delivering fully tested specification ready for implementation
argument_hint: [#issue|"feature description"]
---

# Flow Prepare - Vertical Slice Preparation Phase

Complete preparation and test planning that delivers a fully tested specification ready for implementation. This command follows vertical slicing principles where each phase delivers complete, standalone value.

**Vertical Slicing Principle**: Each command represents a complete slice of value delivery. Flow-prepare delivers a fully-specified, test-verified implementation plan that could be handed to any developer for execution.

## Help Mode

If user provides `--help` or `help` parameter, display this usage guide instead of running the command:

```
flow-prepare - Complete preparation and test planning phase

USAGE:
  flow-prepare #123           Prepare implementation for GitHub issue
  flow-prepare "description"  Prepare new feature with issue creation
  flow-prepare                Interactive preparation mode
  flow-prepare help           Show this help

DELIVERABLES:
  ✅ Requirements analysis and acceptance criteria
  ✅ Implementation plan with task breakdown
  ✅ Test specifications written and verified
  ✅ API documentation (if applicable)
  ✅ Ready-to-implement specification

EXAMPLES:
  flow-prepare #67
  flow-prepare "add user preferences API"
  flow-prepare
```

## Usage Modes

### 1. Issue Mode (with issue number)

`flow-prepare #123` - Prepare implementation for a specific GitHub issue

### 2. Feature Mode (with description)

`flow-prepare "add dark mode"` - Create issue and prepare complete specification

### 3. Interactive Mode (no parameters)

`flow-prepare` - Interactive preparation with user guidance

## Instructions

**CRITICAL: Always activate Serena MCP at session start:**

```bash
# Activate Serena MCP for project context and symbol navigation
mcp__serena__activate_project
```

**First, check if user needs guidance:**

- If no parameters provided, show preparation options and ask what they want to do
- If `help` or `--help` provided, show the help mode above and stop
- Otherwise proceed with mode detection and preparation

### Phase 1: Requirements Gathering and Analysis

1. **Determine Mode and Context**
   - If input contains `#\d+`, use Issue Mode
   - If input contains quoted text, use Feature Mode
   - Otherwise, use Interactive Mode

2. **Issue Mode Steps**

   ```bash
   # Fetch complete issue context
   gh issue view <number> --comments --json title,body,assignees,labels,state

   # Update issue status to in-progress
   gh issue edit <number> --add-label "in-progress" --add-label "preparing"

   # Post preparation start comment
   gh issue comment <number> --body "🔍 **Preparation Phase Started**\n\nAnalyzing requirements and creating implementation specification..."
   ```

3. **Feature Mode Steps**
   - Create GitHub issue with detailed description
   - Set appropriate labels (enhancement, feature)
   - Continue with created issue number

4. **Interactive Mode Steps**
   - Ask user to describe what they want to build
   - Help refine requirements through conversation
   - Create issue if needed

### Phase 2: Technical Analysis and Planning

1. **Codebase Analysis Using Serena**

   ```bash
   # Get project overview and understand architecture
   mcp__serena__get_symbols_overview

   # Search for related patterns and existing implementations
   mcp__serena__search_for_pattern query:"[relevant-pattern]"

   # Find symbols that might need modification
   mcp__serena__find_symbol name:"[component-name]"
   ```

2. **Requirements Breakdown**
   - Parse acceptance criteria from issue or user input
   - Identify functional and non-functional requirements
   - Define success metrics and validation criteria
   - Document any assumptions or constraints

3. **Implementation Plan Creation**
   - Use TodoWrite to create detailed task breakdown
   - Identify affected files and components
   - Plan API changes (if applicable)
   - Consider backward compatibility
   - Estimate complexity and effort

4. **Architecture Design**
   - Design component interactions
   - Plan data flow and state management
   - Identify integration points
   - Consider performance implications
   - Document security considerations

### Phase 3: Test Specification and Verification

1. **Test Planning**
   - Write comprehensive test specifications for all functionality
   - Include unit tests, integration tests, and e2e tests where applicable
   - Define test data requirements
   - Plan negative test cases and edge cases
   - Consider performance and security test scenarios

2. **API Documentation (if applicable)**
   - Update OpenAPI specifications in `src/lib/openapi/registry.ts`
   - Define request/response schemas with Zod
   - Include example requests and responses
   - Document error conditions and status codes
   - Validate OpenAPI coverage with `scripts/validate-openapi-coverage.js`

3. **Test Implementation and Verification**

   ```bash
   # Create test files with complete test specifications
   # For RSS reader project, follow existing patterns:
   # - Unit tests: src/__tests__/unit/
   # - Integration tests: src/__tests__/integration/
   # - E2E tests: src/__tests__/e2e/
   # - Performance tests: src/__tests__/performance/

   # Write failing tests that define the expected behavior
   # Verify tests fail for the right reasons
   npm test -- --testPathPattern="new-feature"
   ```

4. **Test Verification Checkpoint**
   - All test specifications written and validated
   - Tests fail with clear error messages indicating missing implementation
   - Test coverage plan documented
   - API documentation complete (if applicable)
   - No test implementation bugs (tests should fail because feature doesn't exist, not because tests are broken)

### Phase 4: Specification Finalization

1. **Implementation Readiness Review**
   - Verify all requirements are testable
   - Confirm implementation plan is complete
   - Validate that tests define expected behavior clearly
   - Ensure handoff documentation is comprehensive

2. **Documentation and Communication**

   ```bash
   # Update issue with complete specification
   gh issue comment <number> --body "$(cat <<'EOF'
   ## 📋 **Preparation Phase Complete**

   ### ✅ Deliverables Ready
   - Requirements analysis and acceptance criteria documented
   - Implementation plan with detailed task breakdown
   - Test specifications written and verified
   - API documentation updated (if applicable)
   - Ready-to-implement specification available

   ### 🎯 **Implementation Plan**
   [Detailed task breakdown from TodoWrite]

   ### 🧪 **Test Specifications**
   - Unit tests: [file paths and descriptions]
   - Integration tests: [file paths and descriptions]
   - E2E tests: [file paths and descriptions]

   ### 📚 **Documentation**
   - API changes: [OpenAPI updates]
   - Architecture decisions: [key design choices]

   **Ready for implementation phase with `flow-execute`**
   EOF
   )"
   ```

3. **Handoff Preparation**
   - Create comprehensive handoff document
   - Include all context needed for implementation
   - Document any research findings or decisions made
   - Ensure implementation can proceed independently

## Output Format

```
## 🔍 Preparation Phase: [Feature/Issue Title]

### 📊 Project Context
**Serena MCP**: ✅ Activated
**Current Branch**: [branch-name]
**Issue**: #[number] ([title])

### 📋 Requirements Analysis
**Functional Requirements:**
- [Requirement 1 with acceptance criteria]
- [Requirement 2 with acceptance criteria]

**Non-Functional Requirements:**
- [Performance requirements]
- [Security considerations]
- [Compatibility requirements]

### 🏗️ Implementation Plan
**Architecture Overview:**
[High-level design description]

**Task Breakdown:**
- [ ] Task 1: [Description with file paths]
- [ ] Task 2: [Description with estimated complexity]
- [ ] Task 3: [Description with dependencies]

**Affected Components:**
- `src/[component1].ts` - [modifications needed]
- `src/[component2].ts` - [new functionality]

### 🧪 Test Specifications

**Unit Tests:** `src/__tests__/unit/[feature].test.tsx`
- ✅ Test case 1: [description]
- ✅ Test case 2: [description]
- ✅ Edge case handling: [description]

**Integration Tests:** `src/__tests__/integration/[feature].test.ts`
- ✅ API integration: [description]
- ✅ Database interaction: [description]

**E2E Tests:** `src/__tests__/e2e/[feature].test.ts`
- ✅ User workflow: [description]
- ✅ Cross-browser compatibility: [description]

### 📚 Documentation Updates

**API Documentation:**
- ✅ OpenAPI schema updated in `src/lib/openapi/registry.ts`
- ✅ New endpoints documented with examples
- ✅ Error responses defined

**Architecture Documentation:**
- ✅ Design decisions recorded
- ✅ Integration points documented

### ✅ Preparation Complete

**Deliverables Ready:**
- [x] Requirements fully analyzed and documented
- [x] Implementation plan created with task breakdown
- [x] Test specifications written and verified to fail correctly
- [x] API documentation updated (if applicable)
- [x] Handoff documentation complete

**Test Verification Status:**
- All tests written and failing for correct reasons
- Test coverage plan documented
- No test implementation bugs detected

**Ready for Implementation:**
Use `flow-execute` to begin implementation against these specifications.

## 🎯 Handoff Summary

This feature is now fully prepared for implementation. All requirements are documented, tests are written and verified, and the implementation plan is complete. The next developer can proceed immediately with `flow-execute` using these specifications.
```

## Error Handling

- **If GitHub issue not found**: Clear error with suggestion to check issue number
- **If Serena MCP fails to activate**: Fallback to manual code analysis with Read/Grep
- **If test writing fails**: Document the failure and suggest manual test creation
- **If requirements unclear**: Engage user in clarification conversation

## Tool Usage Best Practices

- **Serena MCP**: Primary tool for codebase analysis and symbol navigation
- **GitHub CLI**: Issue management and communication
- **TodoWrite**: Task breakdown and progress tracking
- **Read/Edit**: Test file creation and documentation updates
- **WebSearch**: Research existing patterns and best practices

## Vertical Slicing Benefits

**Complete Value Delivery**: Preparation phase delivers a fully-specified, implementable plan
**Clear Handoff**: Implementation can proceed independently with clear specifications
**Quality Assurance**: Tests are written and verified before implementation begins
**Risk Reduction**: All technical decisions and research completed upfront
**Parallelization**: Multiple features can be prepared while others are being implemented
