---
description: Step 2 - Implementation strategy development with API-first approach and concise output
argument_hint: [issue-id]
---

# Step 2: Plan - Implementation Strategy Development

## Prerequisites

**Note**: Run `01-audit RR-XXX` before this step to validate the issue and gather comprehensive context.

## Project Activation

First, activate Serena MCP to access project memories and context:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

Analyze the Linear issue provided in $ARGUMENTS with comprehensive project understanding, technical expert review, pattern recognition, and automated feasibility validation.

This is a `read-only` mode discussion session. No files will be written during analysis. **No Linear issue status updates will be made.**

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
```

**If ANY check fails:**

- 🛑 STOP - Use `infra-expert` agent for emergency fixes
- DO NOT proceed on broken foundation

**If all pass:** ✅ Continue to Issue Currency Validation

## 3. Linear Issue Currency Validation

**Before deep analysis, validate the issue is current and relevant:**

Use `linear-expert` to ultrathink and perform comprehensive issue validation:

### 3A. Temporal Relevance Check

1. **Issue Age Assessment**:
   - Check issue creation date vs current date
   - If issue is >30 days old: Flag for manual review
   - If issue is >90 days old: STOP and request user confirmation
   - Compare issue creation against last project activity

2. **Status Consistency Validation**:
   - Verify issue is still in appropriate status (not accidentally left open)
   - Check if similar issues have been completed since creation
   - Validate issue hasn't been superseded by newer requirements

### 3B. Project Context Alignment

1. **Parent/Child Issue Analysis**:
   - If part of larger epic/project: Check parent issue status and recent updates
   - Verify child issues haven't changed the implementation approach
   - Check if sibling issues reveal scope changes or new constraints
   - Assess if project priorities have shifted

2. **Dependency Chain Validation**:
   - Check if blocking issues have been resolved as expected
   - Verify dependent issues still reflect current requirements
   - Identify any new blockers that have emerged

### 3C. Scope Drift Detection

1. **Requirements Evolution Check**:
   - Compare original description with recent comments
   - Look for scope creep or requirement changes in comments
   - Check if acceptance criteria have been modified
   - Identify any new technical constraints mentioned

2. **Implementation Reality Check**:
   - Use Serena MCP to quickly scan for related code changes
   - Check if similar functionality has been implemented differently
   - Verify the problem described still exists in current codebase
   - Assess if architectural changes affect the proposed solution

### 3D. Validation Decision Matrix

Based on validation results, ultrathink and determine next steps:

```
🟢 PROCEED CONFIDENTLY:
- Issue <30 days old OR has recent activity
- No scope changes or conflicts detected
- Parent project still active and relevant
- Problem statement matches current codebase state

🟡 PROCEED WITH CAUTION:
- Issue 30-90 days old with some staleness indicators
- Minor scope evolution detected
- Related work has progressed but doesn't conflict
- Solution approach may need minor adjustments

🔴 STOP FOR CLARIFICATION:
- Issue >90 days old or appears abandoned
- Significant scope changes or conflicts detected
- Parent project deprioritized or cancelled
- Problem may no longer exist or approach is outdated
- Implementation requirements fundamentally changed
```

### 3E. Validation Summary Report

Generate clear validation findings:

```
📅 Issue Currency Validation for RR-XXX:

⏱️ Temporal Assessment:
- Created: [date] ([X] days ago)
- Last Updated: [date]
- Age Status: [FRESH/AGING/STALE]

🎯 Project Alignment:
- Parent Issue: [RR-XXX or N/A] - Status: [status]
- Related Work: [X completed, Y in progress]
- Priority Alignment: [HIGH/MEDIUM/LOW/UNCLEAR]

🔍 Scope Consistency:
- Original Requirements: [UNCHANGED/MINOR_UPDATES/MAJOR_CHANGES]
- Implementation Approach: [STILL_VALID/NEEDS_ADJUSTMENT/OUTDATED]
- Technical Constraints: [SAME/EVOLVED/NEW_BLOCKERS]

✅ VALIDATION RESULT: [PROCEED/CAUTION/STOP]
- [Key finding 1]
- [Key finding 2]
- [Recommended action if not PROCEED]
```

**If STOP result:** Request user confirmation to continue with potentially outdated requirements, or suggest issue review/update first.

**If PROCEED or CAUTION:** Continue to context gathering with noted considerations.

## 4. Parallel Context Gathering

**Execute ALL of these IN PARALLEL using agents:**

### 4A. Linear Issue Context

Use `linear-expert` to:

- Get full issue with ALL comments and sub-issues
- Check parent/child issues and dependencies
- If the issue has a parent issue, check other children issues of the parent issue to get a better understanding of the larger picture
- Extract description, labels, priority
- Remember: Issue + comments = living specification
- Get context of all other incomplete + Done issues in the current cycle

### 4B. Project Memory Context

Use Serena MCP to access project memories:

1. **Read project memories** using `mcp__serena__read_memory`:
   - issue_learnings_consolidated.md for relevant gotchas and solutions
   - completed_issue_implementations.md for successful implementation patterns
   - Domain-specific memories based on issue type (UI, API, sync, performance, etc.)
   - Search for project-specific context with keywords from issue title/description
2. **Retrieve relevant memories** to get:
   - Project-specific technical decisions and patterns
   - Stored knowledge about similar features
   - Historical context about architectural choices
   - Any observations related to the current issue topic

### 4C. Recent Work Context

Use `doc-search` and `git-expert` to:

- Check CHANGELOG.md for recently shipped features
- Review last 20 git commits to understand recent changes
- Identify patterns from completed work

### 4D. Database Context

Use `db-expert-readonly` to:

- Get complete database schema and table structures
- Understand existing columns, indexes, and relationships
- Check RLS policies and security advisories
- Identify what data structures already exist

### 4E. Existing Code Context

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

### 4F. Cross-Issue Pattern Recognition

**Use `linear-expert` to identify similar completed issues:**

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

## 5. Automated Feasibility Validation

**Systematic validation before deep analysis:**

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

## 6. Deep Technical Analysis

Based on gathered context, ultrathink and analyze:

### Implementation Requirements:

- Can this use existing API endpoints? (prefer extending over creating new)
- Can this use existing database tables/columns? (prefer extending over new)
- What similar patterns exist in the codebase?
- Use `find_symbol` to locate exact functions/classes to modify
- Use `find_referencing_symbols` to identify ALL code that depends on changes
- Build a complete dependency graph showing ripple effects

### Technical Validation:

- Use `web-researcher` agent for technology research and feasibility validation
- Check performance baselines: Will this impact 8-20s test execution?
- For UI features: Plan E2E tests using Playwright

### Technology Research with web-researcher:

```
Use web-researcher agent for technology validation:

Task: Research latest technology information for RR-XXX implementation

Research Areas:
- Package versions: Check latest versions of dependencies we plan to use
- API documentation: Get current documentation for external services
- Best practices: Find latest implementation patterns for [technology/framework]
- Breaking changes: Research any breaking changes in dependency upgrades
- Security updates: Check for security advisories affecting our stack

Specific Research Items:
- [List specific technologies, APIs, or packages mentioned in implementation strategy]
- Latest versions and compatibility information
- Migration guides for any planned upgrades
- Performance considerations and benchmarks
- Security best practices and recent vulnerabilities

Return focused documentation and version information relevant to implementation.
```

### Code Quality Review:

- Use `tech-expert` agent to validate proposed approach
- Check for security implications and best practices

## 6A. Symbol-Based Impact Assessment

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

## 7. Pragmatic Assessment

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

## 8. Implementation Strategy

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

## 9. Interactive Refinement

Ask:

```
Do you:
1. ✅ Agree with this implementation strategy?
2. 🔄 Want to refine it further?
3. 🔍 Want a domain expert review?
4. 🤖 Want Codex MCP external validation?

Please respond with 1, 2, 3, or 4.
```

### If 2 (Refine):

- Ask for specific concerns
- Iterate on strategy
- Return to options

### If 3 (Expert Review):

- Ask which expert (db-expert, devops-expert, ui-expert, test-expert)
- Get expert validation and recommendations
- Incorporate feedback and return to options

### If 4 (Codex MCP Review):

Use Codex MCP for external strategy validation:

**Available Codex MCP Tools:**

- `mcp__codex-bridge__consult_codex` - Single query with structured output (RECOMMENDED)
- `mcp__codex-bridge__consult_codex_with_stdin` - Pipeline-friendly with file content
- `mcp__codex-bridge__consult_codex_batch` - Multiple queries in batch

**Recommended Tool**: `consult_codex` with format="json" for structured strategy analysis

```
Task: External strategy validation via Codex MCP

Use: mcp__codex-bridge__consult_codex with:
  query: "Provide unbiased technical review of this implementation strategy:

  Problem Statement: [Extract and include the actual problem description from Linear issue]

  Proposed Implementation Strategy:
  [Include complete implementation strategy from section 8]

  Technical Context:
  - Project: RSS News Reader PWA
  - Stack: Next.js 14+, TypeScript, Tailwind CSS, Supabase PostgreSQL
  - Architecture: Server-client split, bi-directional sync with Inoreader API
  - Constraints: All routes use /reader prefix, 8-20s test execution target

  Relevant Files for Context (to focus analysis):
  [List 3-5 key files from symbol analysis that relate to this strategy, e.g.:
  - src/lib/stores/article-store.ts (if state management involved)
  - src/app/api/sync/route.ts (if API changes involved)
  - src/components/articles/article-list.tsx (if UI changes involved)
  - src/lib/supabase/client.ts (if database changes involved)
  - server/services/sync-service.js (if server logic involved)]

  Review Questions:
  1. Is this implementation approach technically sound for the given stack?
  2. Are there simpler or more efficient alternatives?
  3. What risks or edge cases might be overlooked?
  4. Does the strategy align with Next.js/TypeScript/Supabase best practices?
  5. Any red flags or architectural concerns based on existing code patterns?

  IMPORTANT: This is a READ-ONLY analysis. Do not suggest file modifications or implementations. Focus analysis on the provided relevant files."

  directory: "/Users/shayon/DevProjects/rss-news-reader"
  format: "json"
  timeout: 120

Return structured validation with alternative approaches and risk assessment.
```

Incorporate Codex feedback and return to refinement options.

### If 1 (Agree):

**Strategy approved! Ready to proceed to implementation phase.**

## 9A. Technical Expert Review

Use `tech-expert` agent for comprehensive architecture validation:

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

## 10. Concise Final Output

**Present clean, actionable strategy:**

```
✅ RR-XXX Planning Complete

Strategy: [One sentence summary of approach]
Files: [X files to modify] | APIs: [New/Extended] | DB: [Changes needed/None]

Implementation:
1. [Key step 1 with file reference]
2. [Key step 2 with file reference]
3. [Key step 3 with file reference]

Risks: [Main risk factor or "Low risk"]
Time: [Estimated hours/days]

Next: 03-stage RR-XXX (if complex) or 04-implement RR-XXX (if standard)
```

### If no option chosen:

- The user is providing more context and has more doubts
- This is same as choosing 2. They want to continue evolving the strategy.
- Iterate and return to options again
- Continue until the user has provided an option

## Important Rules

- 🚫 NO file operations during analysis
- 🚫 NO Linear issue status updates (this is planning only)
- ✅ ALWAYS check CHANGELOG.md and recent commits
- ✅ ALWAYS check database schema
- ✅ ALWAYS search for existing code patterns
- ✅ ALWAYS conduct technical expert review
- ✅ ALWAYS analyze historical patterns for confidence scoring
- ✅ ALWAYS perform automated feasibility validation
- ✅ ALWAYS provide concise, actionable output
- Prefer extending existing code over creating new
- Use read-only agents for all analysis
- Be pragmatic and challenge assumptions
- Strategy must be approved before proceeding to implementation phase
