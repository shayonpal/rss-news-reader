---
description: Staging phase with Linear updates, test generation, and preparation for implementation
argument_hint: <issue-id>
---

# Flow Stage - Implementation Staging Phase

## 1. Parse Input and Validate Prerequisites

Check $ARGUMENTS:

- If starts with "RR-" or just a number → Linear issue ID (continue)
- If Linear URL → Extract project/issue ID and continue
- If empty or other text → Error: "Please provide a Linear issue ID (e.g., RR-123)"

**Note:** This command assumes planning has been completed with an approved strategy that will be recorded in Linear during this stage.

## 2. Update Linear Status

Use `linear-expert` to:

- Move issue to "In Progress"
- Add comment noting staging phase has begun

## 3. Mandatory Documentation

**These steps are REQUIRED - do not skip:**

### 3A. Generate Concrete Test Contracts

Based on the approved strategy from planning phase, create explicit contracts:

```
📝 Test Contracts for RR-XXX:

API Contracts:
- Endpoint: [exact path]
- Method: [GET/POST/PUT/DELETE]
- Request Body: [exact JSON structure]
- Success Response: [exact JSON with status code]
- Error Responses:
  - 400: [exact error format]
  - 404: [exact error format]
  - 500: [exact error format]

Database Contracts:
- Table: [table name]
- Operation: [INSERT/UPDATE/DELETE]
- Fields Changed: [field: old_value → new_value]
- Constraints: [any constraints that must be checked]

State Transitions:
- Before: [exact database state]
- Action: [what triggers the change]
- After: [exact expected state]
```

### 3B. Update Linear with Strategy and Contracts

Use `linear-expert` to add comment:

```
**Implementation Strategy (Approved)**
[Full strategy details from planning phase]

**Test Contracts**
[All contracts from 3A]

Timestamp: [current time]
```

### 3C. Gather Symbol-Level Context for test-expert

Use Serena for precise test context:

1. **Symbol Signatures** (via `find_symbol`):
   - Exact function signatures with parameter types
   - Return types and error conditions
   - Class constructors and methods

2. **Test Pattern Discovery** (via `search_for_pattern`):
   - Find test files: pattern "_.test.ts" or "_.spec.ts"
   - Use `get_symbols_overview` on test files to understand test structure
   - Find test utilities: `find_symbol` with "beforeEach|afterEach|describe|it"

3. **Implementation Patterns** (via `find_referencing_symbols`):
   - Trace how similar features are tested
   - Find mock patterns and test helpers
   - Identify integration points needing test coverage

### 3D. Generate Symbol-Aware Test Cases

Provide test-expert with symbol-precise specifications:

```
Symbols to Test:
- Primary: [Exact symbol path with file location]
- Dependencies: [List of dependent symbols from find_referencing_symbols]
- API: [Route handler symbols from get_symbols_overview]

Symbol Contracts:
- Input: [Exact parameters from symbol signature]
- Output: [Return type from symbol analysis]
- Side Effects: [Store updates and service calls traced via references]

Coverage Requirements:
- Unit: Test symbol in isolation with mocked dependencies
- Integration: Test symbol interaction with dependent symbols
- E2E: Test complete flow through symbol call chain
```

IMPORTANT: These tests are the SPECIFICATION. Write them to define exact behavior that implementation must conform to. Tests should NOT be modified later to match implementation.

### 3E. Update Linear with Test Cases

Use `linear-expert` to add comment:

```
**Test Cases (Specification)**
[All test scenarios with exact input/output]

Note: These tests define the specification. Implementation must conform to these tests.
```

## 4. Enhanced Synthesis and Final Summary

**Comprehensive synthesis of all analysis components:**

### Integration of All Analysis Components

Combine insights from planning phase:

1. **Technical Expert Review**: Architecture, security, performance feedback
2. **Pattern Recognition**: Historical success patterns and gotchas
3. **Feasibility Validation**: Automated compatibility and constraint checks
4. **Implementation Strategy**: Detailed technical approach

### Comprehensive Recommendations with Confidence Scores

```
🎯 Enhanced Analysis Summary for RR-XXX:

📊 Confidence Scores:
- Technical Feasibility: [85%] - Based on compatibility checks and expert review
- Implementation Success: [92%] - Based on similar pattern success rates
- Performance Impact: [78%] - Based on benchmark analysis
- Resource Requirements: [67%] - Based on complexity and constraint assessment

🔄 Pattern-Based Insights:
- Similar Issues: [List of 3-5 similar completed issues]
- Success Rate: [X/Y similar issues completed successfully]
- Common Gotchas: [List of frequently encountered problems]
- Proven Solutions: [Reusable patterns from successful implementations]

🏗️ Architecture Validation:
- Expert Approval: [APPROVED/CONDITIONAL/REJECTED]
- Security Assessment: [SECURE/NEEDS_REVIEW/VULNERABLE]
- Performance Validation: [OPTIMAL/ACCEPTABLE/CONCERNING]
- Scalability Rating: [EXCELLENT/GOOD/LIMITED]

🚦 Final Recommendation:
[PROCEED/PROCEED_WITH_CAUTION/REDESIGN_REQUIRED/REJECT]

Justification: [Comprehensive reasoning based on all analysis components]
```

### Actionable Next Steps with Risk Mitigation

```
✅ Staging Phase Complete for RR-XXX

📝 Actions Completed:
1. ✅ Implementation strategy retrieved from planning phase
2. ✅ Linear issue status updated to "In Progress"
3. ✅ Test contracts generated and documented
4. ✅ Symbol-level test specifications created
5. ✅ Linear updated with comprehensive documentation
6. ✅ Risk mitigation strategies documented

🔍 Key Implementation Details:
- Existing code to reuse: [list with confidence scores]
- New code required: [list with complexity estimates]
- API Endpoints:
  - Existing to reuse/extend: [list with modification effort]
  - New to create: [list with implementation complexity]
- Database changes: [with migration complexity assessment]
- Historical patterns: [relevant successful implementations]
- Expert recommendations: [key architectural guidance]

⚠️ Risk Factors and Mitigations:
- [Risk 1]: [probability] - [mitigation strategy]
- [Risk 2]: [probability] - [mitigation strategy]
- [Risk 3]: [probability] - [mitigation strategy]

📋 Prioritized Implementation Steps:
1. [High Priority]: [action with timeline estimate]
2. [Medium Priority]: [action with dependencies]
3. [Low Priority]: [action for future consideration]

🎯 Success Metrics:
- Implementation Time: [estimated range based on patterns]
- Test Coverage: [target percentage with key scenarios]
- Performance Impact: [acceptable thresholds]
- User Experience: [measurable improvements]

🔗 Linear Issue: [Link with all documentation]
📊 Pattern Analysis: [Reference to similar successful issues]
🧠 Expert Review: [Summary of technical validation]
```

## 5. Implementation Readiness Check

Before concluding, perform final validation:

### 5A. Documentation Completeness

Verify all required documentation exists:

- ✅ Implementation strategy in Linear
- ✅ Test contracts documented
- ✅ Symbol-level specifications ready
- ✅ Risk mitigation strategies documented

### 5B. Stakeholder Communication

```
📧 Implementation Phase Summary for RR-XXX:

🎯 Objective: [Clear problem statement]
📋 Strategy: [Approved implementation approach]
⏱️ Timeline: [Estimated effort based on patterns]
🧪 Testing: [Comprehensive test coverage plan]
⚠️ Risks: [Key risk factors and mitigations]

📍 Current Status: Ready for development
🔗 Full Details: [Linear issue link]
```

### 5C. Development Environment Preparation

Provide setup checklist:

```
🛠️ Pre-Implementation Checklist:

Environment Setup:
□ Development environment is working
□ All required dependencies are installed
□ Database migrations are up to date
□ Test suite is passing

Code Preparation:
□ Feature branch created from main
□ Baseline tests are green
□ Code analysis tools are working
□ Development server is running

Documentation:
□ Implementation strategy is clear
□ Test specifications are complete
□ Success criteria are defined
□ Risk mitigation plans are ready
```

## 6. Next Steps and Handoff

```
🚀 Ready to Begin Implementation for RR-XXX

✅ All Prerequisites Complete:
- Planning phase completed with approved strategy
- Linear issue updated with comprehensive documentation
- Test specifications generated as implementation contract
- Risk mitigation strategies documented
- Development environment validated

🔧 Next Step - Use flow-execute:
1. Run `flow-execute RR-XXX` to begin actual implementation
2. flow-execute will handle:
   - Feature branch creation
   - Test-driven development approach
   - Following the documented implementation strategy
   - Using test contracts as specification
   - Symbol-level code modifications

📊 Progress Tracking:
- Update Linear with regular progress comments
- Mark tests green as implementation progresses
- Document any deviations from strategy with rationale
- Update risk assessments if new issues emerge

🆘 Support Resources:
- Use `tech-expert` for architecture questions
- Use `db-expert` for database-related issues
- Use `test-expert` for testing problems
- Reference historical patterns from similar issues

⚖️ Success Criteria:
- All test contracts pass
- Performance benchmarks met
- Code review approval received
- Documentation updated
- Linear issue marked complete

🔄 Continuous Validation:
Run `npm run pre-commit` regularly to ensure:
- TypeScript compilation succeeds
- All tests pass (target: <20s execution)
- Code quality checks pass
- Test coverage meets requirements
```

## Important Rules

- ✅ ALWAYS update Linear with strategy and tests
- ✅ ALWAYS check that planning phase was completed first
- ✅ ALWAYS generate test contracts as specifications
- ✅ ALWAYS provide symbol-level implementation guidance
- ✅ Tests are the specification - implementation must conform to tests
- ✅ Update Linear issue status to "In Progress"
- 🚫 NO file modifications during this phase (staging/documentation only)
- Be pragmatic about risk assessment and mitigation
- Ensure comprehensive handoff to implementation phase (flow-execute)
- Document everything for future reference and pattern learning
- This command STAGES for implementation, it doesn't implement
