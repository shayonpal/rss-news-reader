---
description: Analyze a Linear issue in comprehensive context of the app
argument-hint: <issue-id>
---

# Analyze Linear Issue with Full Context

Analyze the Linear issue provided in $ARGUMENTS with comprehensive project understanding.

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
- Extract description, labels, priority
- Remember: Issue + comments = living specification

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
Use `doc-search` to find:
- **API Endpoints**: Search for "app.get", "app.post", "router.get", "router.post", "export async function GET", "export async function POST" patterns
- **Similar Features**: Search for related functionality already implemented
- **Test Patterns**: Identify existing test approaches
- Review docs/api/server-endpoints.md for documented endpoints

## 4. Update Linear Status

Use `linear-expert` to:
- Move issue to "In Progress" 

## 5. Deep Technical Analysis

Based on gathered context, analyze:

### Implementation Requirements:
- Can this use existing API endpoints? (prefer extending over creating new)
- Can this use existing database tables/columns? (prefer extending over new)
- What similar patterns exist in the codebase?
- Which files will need modification?

### Technical Validation:
- Use `web-researcher` agent to verify feasibility
- Check performance baselines: Will this impact 8-20s test execution?
- For UI features: Plan E2E tests using Playwright

### Code Quality Review:
- Use `code-reviewer` agent to validate proposed approach
- Check for security implications and best practices

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
Continue to step 8

### If no option chosen:
- The user is providing more context and has more doubts
- This is same as choosing 2. They want to continue evolving the strategy.
- Iterate and return to options again
- Continue until the user has provided an option

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
[All contracts from 8A]

Timestamp: [current time]
```

### 9C. Gather Complete Context for test-expert
Before invoking test-expert, gather ALL necessary context:

1. **Database Schema** (from db-expert-readonly):
   - Relevant table structures
   - Column types and constraints
   - Existing indexes

2. **Existing Test Patterns** (from doc-search):
   - Search for similar *.test.ts files
   - Identify test utilities and helpers
   - Find test setup patterns

3. **Existing Code Patterns** (from doc-search):
   - Similar API endpoints
   - Similar database operations
   - Error handling patterns

### 9D. Generate Test Cases with Full Context
Use `test-expert` providing COMPLETE context package:
```
Linear Issue: [full details including all comments]
Implementation Strategy: [from 9A]
Test Contracts: [from 9A]

Database Context:
[Complete schema for relevant tables]

Existing Test Patterns:
[Examples of similar tests from codebase]

Existing Code Patterns:
[Similar implementations found]

IMPORTANT: These tests are the SPECIFICATION. Write them to define exact behavior that implementation must conform to. Tests should NOT be modified later to match implementation.
```

### 9E. Update Linear with Test Cases
Use `linear-expert` to add comment:
```
**Test Cases (Specification)**
[All test scenarios with exact input/output]

Note: These tests define the specification. Implementation must conform to these tests.
```

## 10. Final Summary

```
✅ Analysis Complete for RR-XXX

📝 Actions Completed:
1. ✅ Comprehensive context gathered (memory, recent work, DB, existing code)
2. ✅ Implementation strategy documented in Linear
3. ✅ Test cases generated and documented
4. ✅ Issue status updated to "In Progress"

🔍 Key Findings:
- Existing code to reuse: [list]
- New code required: [list]
- API Endpoints:
   - Existing to reuse/extend: [list]
   - New to create: [list]
- Database changes: [if any]
- Related context from memory: [if any]

📋 Next Steps:
- Use /execute RR-XXX to begin implementation
- All requirements documented in Linear issue

🔗 Linear Issue: [Link]
```

## Important Rules

- 🚫 NO file operations during analysis
- ✅ ALWAYS update Linear with strategy and tests
- ✅ ALWAYS check CHANGELOG.md and recent commits
- ✅ ALWAYS check database schema
- ✅ ALWAYS search for existing code patterns
- Prefer extending existing code over creating new
- Use read-only agents for all analysis
- Be pragmatic and challenge assumptions