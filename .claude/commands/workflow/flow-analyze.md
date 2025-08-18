---
description: Enhanced Linear issue analysis with comprehensive context, expert review, and pattern recognition
argument_hint: <issue-id>
---

# Flow Analyze - Comprehensive Linear Issue Analysis

## Project Activation

First, activate Serena MCP to access project memories and context:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

Analyze the Linear issue provided in $ARGUMENTS with comprehensive project understanding, technical expert review, pattern recognition, and automated feasibility validation.

This is a `read-only` mode discussion session. No files will be written during analysis.

## 1. Parse Input

Check $ARGUMENTS:

- If starts with "RR-" or just a number → Linear issue analysis (continue)
- If Linear URL → Extract project/issue ID and continue
- If empty or other text → Error: "Please provide a Linear issue ID (e.g., RR-123). Use /capture-idea for new ideas."

## 2. Infrastructure Health Check (MANDATORY)

**Validate testing infrastructure before analysis:**

```bash
# Critical checks - ALL must pass
npm run type-check  # TypeScript compilation
npm run lint  # Code quality
npx vitest run --no-coverage src/__tests__/unit/rr-176-auto-parse-logic.test.ts  # Test discovery
```

**If ANY check fails:**

- 🛑 STOP - Use `infra-expert` agent for emergency fixes
- DO NOT proceed on broken foundation

**If all pass:** ✅ Continue to Context Gathering

## 3. Parallel Context Gathering

**Execute ALL of these IN PARALLEL using agents:**

### 3A. Linear Issue Context

Use `linear-expert` to:

- Get full issue with ALL comments and sub-issues
- Check parent/child issues and dependencies
- If the issue has a parent issue, check other children issues of the parent issue to get a better understanding of the larger picture
- Extract description, labels, priority
- Remember: Issue + comments = living specification
- Get context of all other incomplete + Done issues in the current cycle

### 3B. Project Memory Context

Use memory MCP in two steps:

1. **Search for relevant nodes** using `mcp__memory__search_nodes`:
   - Search with query "RSS Reader" OR "RSS News Reader" for project context
   - Also search with keywords from the issue title/description
   - Look for technical terms mentioned in the issue
2. **Open found nodes** using `mcp__memory__open_nodes` to retrieve:
   - Project-specific technical decisions and patterns
   - Stored knowledge about similar features
   - Historical context about architectural choices
   - Any observations related to the current issue topic

### 3C. Recent Work Context

Use `doc-search` and `git-expert` to:

- Check CHANGELOG.md for recently shipped features
- Review last 20 git commits to understand recent changes
- Identify patterns from completed work

### 3D. Database Context

Use `db-expert-readonly` to:

- Get complete database schema and table structures
- Understand existing columns, indexes, and relationships
- Check RLS policies and security advisories
- Identify what data structures already exist

### 3E. Existing Code Context

Use Serena MCP for precise symbolic analysis:

1. **API Endpoint Discovery**:
   - Use `get_symbols_overview` on src/app/api/ to map all route handlers
   - Use `find_symbol` with pattern "GET|POST|PUT|DELETE" for HTTP methods
   - For each endpoint found, use `find_referencing_symbols` to trace usage

2. **Similar Feature Analysis**:
   - Use `find_symbol` with substring_matching=true for related functionality
   - Example: For sync issue, search "sync" to find all sync-related symbols
   - Use depth=1 to understand method signatures without reading full implementations

3. **Dependency Mapping**:
   - For key symbols, use `find_referencing_symbols` to build dependency graph
   - Identify which components, stores, and services will be affected
   - Generate exact modification scope with symbol paths

4. **Pattern Recognition**:
   - Use `search_for_pattern` with semantic awareness for implementation patterns
   - Find similar data flows: store → service → API → database
   - Identify reusable utility functions via symbol relationships

### 3F. Cross-Issue Pattern Recognition

**NEW ENHANCEMENT:** Use `linear-expert` to identify similar completed issues:

1. **Historical Analysis**:
   - Search for completed issues with similar tags/labels
   - Find issues that modified similar code areas
   - Extract common implementation patterns and gotchas
   - Identify what worked well vs what caused problems

2. **Pattern Extraction**:
   - Use Serena MCP to analyze symbols from similar implementations
   - Build template solutions from successful patterns
   - Document common failure modes and prevention strategies
   - Generate confidence scores based on historical success rates

3. **Reusable Solution Templates**:
   - Extract proven code patterns from similar completed work
   - Identify which approaches consistently succeed
   - Build decision trees based on issue characteristics
   - Document required adaptations for different contexts

## 4. Update Linear Status

Use `linear-expert` to:

- Move issue to "In Progress"

## 4A. Automated Feasibility Validation

**NEW ENHANCEMENT:** Systematic validation before deep analysis:

### Database Compatibility Assessment

Use `db-expert-readonly` for automated checks:

1. **Schema Compatibility**:
   - Verify required tables/columns exist or can be added
   - Check constraint conflicts and migration feasibility
   - Assess index requirements and performance impact
   - Validate data type compatibility

2. **Performance Impact**:
   - Estimate query complexity and execution time
   - Check for potential N+1 query problems
   - Assess need for new indexes or optimizations
   - Validate against current performance budgets

### API Endpoint Conflict Detection

Use Serena MCP for systematic endpoint analysis:

1. **Route Conflict Detection**:
   - Use `get_symbols_overview` to map all existing routes
   - Check for path conflicts with proposed endpoints
   - Validate HTTP method compatibility
   - Assess middleware and authentication requirements

2. **Breaking Change Assessment**:
   - Use `find_referencing_symbols` to identify API consumers
   - Check for backwards compatibility requirements
   - Assess versioning needs for API changes
   - Validate contract compliance with existing clients

### Performance Budget Validation

Cross-reference with existing performance benchmarks:

1. **Test Suite Impact**:
   - Estimate additional test execution time
   - Validate against 8-20s target test duration
   - Assess parallel test execution feasibility
   - Check for potential test isolation issues

2. **Runtime Performance**:
   - Estimate feature performance impact
   - Check against UI responsiveness requirements
   - Assess memory and CPU usage implications
   - Validate caching and optimization opportunities

### Resource Constraint Assessment

Evaluate development and infrastructure constraints:

1. **Development Complexity**:
   - Estimate implementation time and effort
   - Assess required expertise and knowledge gaps
   - Check for external dependency requirements
   - Validate testing and deployment complexity

2. **Infrastructure Requirements**:
   - Assess server resource needs
   - Check for third-party service dependencies
   - Validate monitoring and observability needs
   - Estimate operational overhead

### Feasibility Recommendations

Generate clear decision guidance:

```
🚦 Feasibility Assessment for RR-XXX:

✅ GO (High Confidence):
- All compatibility checks pass
- Low implementation risk
- Proven patterns available
- Clear success metrics

🟡 CAUTION (Medium Confidence):
- Some complexity or risk factors identified
- Mitigation strategies available
- Additional planning recommended
- Performance monitoring required

🛑 STOP (Low Confidence):
- Significant technical barriers
- High risk of breaking changes
- Insufficient resources or expertise
- Alternative approaches recommended
```

## 5. Deep Technical Analysis

Based on gathered context, analyze:

### Implementation Requirements:

- Can this use existing API endpoints? (prefer extending over creating new)
- Can this use existing database tables/columns? (prefer extending over new)
- What similar patterns exist in the codebase?
- Use `find_symbol` to locate exact functions/classes to modify
- Use `find_referencing_symbols` to identify ALL code that depends on changes
- Build a complete dependency graph showing ripple effects

### Technical Validation:

- Use `web-researcher` agent to verify feasibility
- Check performance baselines: Will this impact 8-20s test execution?
- For UI features: Plan E2E tests using Playwright

### Code Quality Review:

- Use `tech-expert` agent to validate proposed approach
- Check for security implications and best practices

## 5A. Symbol-Based Impact Assessment

Execute precise symbol-level analysis:

### Symbol Discovery:

Use Serena to map the feature's symbol footprint:

1. Primary symbols: Classes/functions that implement core logic
2. Secondary symbols: Supporting utilities and helpers
3. Consumer symbols: Components/services that use the feature

### Impact Graph:

Build complete dependency graph:

- Forward dependencies: What this feature will call
- Reverse dependencies: What calls this feature
- Cross-file impacts: Symbols in other files affected

### Modification Precision:

Instead of: "Modify src/lib/stores/article-store.ts"
Provide: "Replace symbol body: ArticleStore/syncArticles (lines 145-203)"
"Insert after symbol: ArticleStore/constructor to add new state"
"17 call sites need updating: [list with symbol paths]"

## 6. Pragmatic Assessment

**Challenge Everything:**

- Does this actually solve the stated problem?
- Is the effort worth the value? (e.g., "3 days for 2% improvement?")
- Are there simpler alternatives?
- Is this even a valid issue that needs solving?
- What could go wrong with this approach?

**Be Direct:**

- "This won't work because..." with clear reasoning
- "Consider X instead because..."
- "This might cause Y issue..."

## 7. Implementation Strategy

Create detailed strategy based on issue type:

### For All Types:

1. List specific files to modify (with line references if applicable)
2. Identify which existing endpoints/functions to extend
3. Database changes needed (if any)
4. Test scenarios to implement
5. Documentation updates required

### Present Strategy:

```
📋 Analysis for RR-XXX: [Title]

📝 Summary:
[2-3 sentences in PM-friendly language]

🔄 Reusing Existing Code:
- API: [Existing endpoint to extend or "New endpoint required"]
- Database: [Existing tables/columns or "New migration needed"]
- Patterns: [Similar features to follow]

🎯 Implementation Strategy:
1. [Specific file/component - what and why]
2. [Next step with file reference]
3. [Continue with concrete steps]

⚠️ Considerations:
- [Technical constraint or risk]
- Performance impact on test suite (target: <20s)

📝 Tests Required:
- Unit tests: [scenarios]
- E2E tests: [Playwright scenarios if UI]

📚 Documentation Updates:
- [Files needing updates]

❓ Clarifications Needed:
- [Any ambiguities]
```

## 8. Interactive Refinement

Ask:

```
Do you:
1. ✅ Agree with this implementation strategy?
2. 🔄 Want to refine it further?
3. 🔍 Want a domain expert review?

Please respond with 1, 2, or 3.
```

### If 2 (Refine):

- Ask for specific concerns
- Iterate on strategy
- Return to options

### If 3 (Expert Review):

- Ask which expert (db-expert, devops-expert, ui-expert, test-expert)
- Get expert validation and recommendations
- Incorporate feedback and return to options

### If 1 (Agree):

Continue to step 9

### If no option chosen:

- The user is providing more context and has more doubts
- This is same as choosing 2. They want to continue evolving the strategy.
- Iterate and return to options again
- Continue until the user has provided an option

## 8A. Technical Expert Review

**NEW ENHANCEMENT:** Use `tech-expert` agent for comprehensive architecture validation:

### Architecture Validation

Engage `tech-expert` to review the proposed implementation:

1. **Scalability Assessment**:
   - Evaluate approach for handling increased load
   - Assess caching and optimization opportunities
   - Review data flow efficiency and bottlenecks
   - Validate horizontal scaling considerations

2. **Security Review**:
   - Check for potential security vulnerabilities
   - Validate authentication and authorization flows
   - Assess data privacy and protection measures
   - Review input validation and sanitization

3. **Performance Analysis**:
   - Evaluate computational complexity
   - Assess memory usage patterns
   - Review database query optimization
   - Validate caching strategies

4. **Code Quality Standards**:
   - Check compliance with project patterns
   - Validate error handling strategies
   - Assess testability and maintainability
   - Review code organization and modularity

### Alternative Approach Recommendations

Request `tech-expert` to provide:

1. **Alternative Implementation Strategies**:
   - Different architectural approaches
   - Trade-offs between approaches
   - Pros and cons of each option
   - Recommendation with justification

2. **Risk Mitigation Strategies**:
   - Potential failure modes and prevention
   - Monitoring and alerting recommendations
   - Rollback and recovery procedures
   - Performance degradation safeguards

3. **Future-Proofing Considerations**:
   - Extensibility for future requirements
   - Migration path for improvements
   - Deprecation strategy for old patterns
   - Integration with planned features

### Expert Review Summary

Document expert findings:

```
🧠 Technical Expert Review for RR-XXX:

🏗️ Architecture Assessment:
- Scalability: [GOOD/NEEDS_WORK/POOR] - [specific feedback]
- Security: [GOOD/NEEDS_WORK/POOR] - [specific feedback]
- Performance: [GOOD/NEEDS_WORK/POOR] - [specific feedback]
- Code Quality: [GOOD/NEEDS_WORK/POOR] - [specific feedback]

🔄 Alternative Approaches:
1. [Alternative 1]: [brief description] - [pros/cons]
2. [Alternative 2]: [brief description] - [pros/cons]
3. [Recommended approach with justification]

⚠️ Risk Factors:
- [Risk 1]: [mitigation strategy]
- [Risk 2]: [mitigation strategy]

🔮 Future Considerations:
- [Extensibility concerns]
- [Migration requirements]
- [Integration dependencies]
```

## 9. Mandatory Documentation

**These steps are REQUIRED - do not skip:**

### 9A. Generate Concrete Test Contracts

Based on the approved strategy, create explicit contracts:

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

### 9B. Update Linear with Strategy and Contracts

Use `linear-expert` to add comment:

```
**Implementation Strategy (Approved)**
[Full strategy details]

**Test Contracts**
[All contracts from 9A]

Timestamp: [current time]
```

### 9C. Gather Symbol-Level Context for test-expert

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

### 9D. Generate Symbol-Aware Test Cases

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

### 9E. Update Linear with Test Cases

Use `linear-expert` to add comment:

```
**Test Cases (Specification)**
[All test scenarios with exact input/output]

Note: These tests define the specification. Implementation must conform to these tests.
```

## 10. Enhanced Synthesis and Final Summary

**NEW ENHANCEMENT:** Comprehensive synthesis of all analysis components:

### Integration of All Analysis Components

Combine insights from:

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
✅ Analysis Complete for RR-XXX

📝 Actions Completed:
1. ✅ Comprehensive context gathered (memory, recent work, DB, existing code)
2. ✅ Cross-issue pattern analysis completed
3. ✅ Automated feasibility validation performed
4. ✅ Technical expert review conducted
5. ✅ Implementation strategy documented in Linear
6. ✅ Test cases generated and documented
7. ✅ Issue status updated to "In Progress"

🔍 Key Findings:
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

📋 Prioritized Next Steps:
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

## Important Rules

- 🚫 NO file operations during analysis
- ✅ ALWAYS update Linear with strategy and tests
- ✅ ALWAYS check CHANGELOG.md and recent commits
- ✅ ALWAYS check database schema
- ✅ ALWAYS search for existing code patterns
- ✅ ALWAYS conduct technical expert review
- ✅ ALWAYS analyze historical patterns for confidence scoring
- ✅ ALWAYS perform automated feasibility validation
- Prefer extending existing code over creating new
- Use read-only agents for all analysis
- Be pragmatic and challenge assumptions
- Integrate all analysis components for comprehensive recommendations
