---
description: Step 5 - Comprehensive code review with symbol analysis and Linear issue validation
args:
  [
    optional: specific focus area like 'security',
    "performance",
    "architecture",
    or Linear issue ID,
  ]
---

# Step 5: Review - Symbol Analysis & Quality Validation

## Project Activation

First, activate Serena MCP to access project memories and symbol navigation:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

Review implemented code using symbolic navigation and comprehensive analysis: $ARGUMENTS

## 1. Parse Input & Setup

Check $ARGUMENTS:

- If Linear issue ID (RR-XXX) → Review specific implementation (current or historical)
- If focus area → Prioritize that aspect
- If empty → General review of recent changes

### 1A. Detect Review Type

```bash
# Determine if reviewing current work or historical implementation
if git diff --cached --quiet && git diff --quiet; then
  echo "🕐 Historical review mode - no current changes detected"
  REVIEW_MODE="historical"
else
  echo "🔄 Current implementation review mode"
  REVIEW_MODE="current"
fi
```

## 2. Context Gathering

Use Serena MCP for precise code analysis:

### 2A. Changed Files Discovery

**For Current Implementation Review:**

```bash
git status --porcelain
git diff --cached --name-only
git log --oneline -5
```

**For Historical Review:**

```bash
# Find commits related to Linear issue
git log --grep="RR-XXX" --oneline --all
git log --grep="#RR-XXX" --oneline --all

# Get specific commit details
git show [commit-sha] --name-only
git diff [commit-sha]~1 [commit-sha] --name-only
```

### 2B. Symbol-Level Change Analysis

**For Current Implementation:**
Use Serena to understand modifications:

- `get_symbols_overview` on each changed file
- `find_symbol` for modified functions/classes
- `find_referencing_symbols` to assess impact scope
- Map changes to specific symbols for targeted review

**For Historical Implementation:**
Use git and Serena to reconstruct changes:

- Identify files modified in historical commit
- `get_symbols_overview` on those files to understand current state
- `find_symbol` for functions/classes that were likely modified
- Use git diff to understand what specifically changed
- Map historical changes to current symbol state

### 2C. Implementation Context

**For Current Implementation Review:**
If Linear issue provided:

- Use `linear-expert` to get complete issue details with ALL comments
- Check parent/child issues and dependencies for full context
- Extract specific acceptance criteria from issue description and comments
- Extract expected behavior and success metrics from issue
- Identify implementation strategy from planning/staging comments
- Get final specification from most recent comments (living specification)

**For Historical Implementation Review:**
If Linear issue provided:

- Use `linear-expert` to get complete issue details with ALL comments
- Check CHANGELOG.md for entries related to this issue: `grep -n "RR-XXX" CHANGELOG.md`
- Use Serena memories to find implementation learnings:
  ```
  mcp__serena__read_memory: issue_RR-XXX_learnings.md (if exists)
  mcp__serena__read_memory: completed_issue_implementations.md
  Search for RR-XXX in issue_learnings_consolidated.md
  ```
- Reconstruct implementation context from:
  - Original issue requirements and acceptance criteria
  - Implementation strategy from comments
  - Actual changes made (from git commit and CHANGELOG)
  - Lessons learned and challenges faced (from Serena memories)
  - Current state of implemented code

## 3. Invoke Code-Reviewer Agent

Use `code-reviewer` agent with complete symbol-level context:

```
Task: Comprehensive code review with requirements validation

You are reviewing an implementation for the RSS News Reader PWA. This is a Next.js 14+ TypeScript application with Zustand state management, Supabase database, and bi-directional sync with Inoreader API.

Project Context:
- All routes use /reader prefix
- Strict TypeScript compliance required (no 'any' types)
- 8-20s test execution target
- OpenAPI documentation required for all API endpoints
- Server-client split architecture (server handles Inoreader API, client reads from Supabase)

Linear Issue Context:
{
  "issue_id": "RR-XXX",
  "title": "[issue title]",
  "description": "[original issue description with problem statement]",
  "acceptance_criteria": [
    "[Specific measurable criteria 1]",
    "[Specific measurable criteria 2]",
    "[Specific measurable criteria 3]"
  ],
  "complete_comment_history": "[Full chronological comment thread showing requirement evolution]",
  "parent_issue": {
    "id": "RR-YYY",
    "title": "[parent title]",
    "status": "[parent status]"
  },
  "child_issues": [
    {"id": "RR-ZZZ", "title": "[child title]", "status": "[child status]"}
  ],
  "approved_implementation_strategy": "[Final approved strategy from most recent planning/staging comments]",
  "expected_user_behavior": "[What users should experience when this works]",
  "success_definition": "[How to determine if implementation succeeds]",
  "known_constraints": "[Technical limitations or requirements from comments]"
}

Implementation Analysis:
{
  "git_changes": {
    "staged_files": ["src/file1.ts", "src/file2.tsx"],
    "modified_files": ["src/existing.ts"],
    "new_files": ["src/new-feature.ts"],
    "deleted_files": ["src/deprecated.ts"]
  },
  "symbol_modifications": [
    {
      "symbol_path": "ArticleStore/syncArticles",
      "file_location": "src/lib/stores/article-store.ts",
      "change_type": "enhanced",
      "modification_summary": "Added retry mechanism with exponential backoff",
      "lines_changed": "145-203",
      "complexity": "medium"
    },
    {
      "symbol_path": "SyncButton/handleClick",
      "file_location": "src/components/sync/sync-button.tsx",
      "change_type": "modified",
      "modification_summary": "Updated to use new retry-enabled sync function",
      "lines_changed": "23-35",
      "complexity": "low"
    }
  ],
  "dependency_impact_analysis": [
    {
      "affected_symbol": "useArticleStore",
      "affected_file": "src/hooks/use-article-store.ts",
      "impact_type": "signature_compatible",
      "impact_description": "Hook consumers get enhanced sync capabilities automatically",
      "consumer_count": 12
    }
  ],
  "api_endpoint_changes": [
    {
      "endpoint": "POST /api/sync/trigger",
      "change_type": "response_enhanced",
      "modification": "Added retry_count and next_retry_at fields",
      "openapi_status": "documented|missing|incomplete"
    }
  ],
  "review_focus": "[security|performance|architecture|api_documentation|general]"
}

Review Requirements:
1. Validate implementation fulfills ALL acceptance criteria from Linear issue
2. Verify symbol changes align with approved implementation strategy
3. Check that user experience matches expected behavior definition
4. Ensure API changes are properly documented (JSDoc + OpenAPI registry)
5. Validate TypeScript compliance (no 'any' types, proper type annotations)
6. Check performance impact against 8-20s test target
7. Verify security best practices (no exposed secrets, proper validation)
8. Confirm changes follow established project patterns from Serena memories

Expected Output:
Return structured JSON feedback with:
- Requirements compliance assessment
- Symbol-level issues with specific file:line references
- API documentation gaps (if applicable)
- Security/performance concerns
- Recommended fixes with priority levels
```

## 4. API Documentation Checks (If APIs Modified)

### 4A. Detect API Changes

Check for modified or created API routes:

```bash
git diff --cached --name-only | grep -E "src/app/api/.*route\.ts$"
git status --porcelain | grep -E "src/app/api/.*route\.ts$"
```

If API files detected, proceed with comprehensive documentation validation.

### 4B. JSDoc Documentation Verification

For each API route file, use Serena MCP to verify JSDoc completeness:

```
find_symbol with:
  query: "export async function GET|POST|PUT|DELETE|PATCH"
  file_path: [each API route file]
```

Check each route handler for:

- **Function Description**: Clear summary of endpoint purpose
- **Parameter Documentation**: @param tags for request parameters
- **Return Type Documentation**: @returns with response structure
- **Error Handling Documentation**: @throws for error conditions
- **Example Usage**: @example with sample request/response

### 4C. OpenAPI Registry Validation

Verify API endpoints are documented in `src/lib/openapi/registry.ts`:

```
search_for_pattern with:
  pattern: "registerApiEndpoint|registerGet|registerPost|registerPut|registerDelete"
  directory: "src/lib/openapi"
```

For each API endpoint, ensure:

- **Zod Schemas**: Request/response validation schemas defined
- **Endpoint Description**: Clear description in registry
- **Response Examples**: 200 and 500 status code examples
- **Parameter Documentation**: All parameters documented

### 4D. Coverage Script Validation

Run OpenAPI coverage validation:

```bash
node scripts/validate-openapi-coverage.js
```

Parse output to identify:

- Undocumented endpoints
- Missing schema definitions
- Incomplete response examples
- Coverage percentage

### 4E. Documentation Quality Assessment

Flag as **Must Fix** issues:

- API routes without JSDoc comments
- Missing Zod schemas in OpenAPI registry
- Endpoints not registered in OpenAPI
- Missing 200/500 response examples
- Coverage below project standards

## 5. Review Focus Areas

Based on change analysis:

**Symbol-Level Reviews**:

- Primary symbols: Core logic implementation
- Consumer symbols: Components using the changes
- Dependency symbols: Called functions/services
- Integration symbols: API routes, database operations

**Quality Checks**:

- Requirements adherence (if Linear provided)
- Security vulnerabilities and exposed secrets
- Performance bottlenecks and optimization opportunities
- Error handling and edge cases
- Test coverage and quality
- **API Documentation completeness** (if APIs modified)

## 6. Concise Review Output

```
✅ RR-XXX Code Review Complete

Quality: [APPROVED/NEEDS_CHANGES/MAJOR_ISSUES] | Risk: [LOW/MEDIUM/HIGH/CRITICAL]

Issues Found:
- [CRITICAL]: [specific issue with symbol reference]
- [HIGH]: [important issue with fix suggestion]
- [MEDIUM]: [improvement opportunity]

API Documentation: [COMPLETE/INCOMPLETE/MISSING] (if APIs modified)
- Missing: [list undocumented endpoints]
- Coverage: [X]% ([increased/decreased] from baseline)

Files: [X files reviewed] | Symbols: [Y symbols analyzed]

Next:
1. If APPROVED: Update Linear with implementation details, then run 06-test RR-XXX
2. If NEEDS_CHANGES: Fix issues, then re-run 05-review RR-XXX
3. If MAJOR_ISSUES: Return to 04-implement RR-XXX for significant fixes
```

## Requirements

- Serena MCP activated for symbolic analysis
- Git repository with staged changes
- Code-reviewer agent available
- Optional: Linear issue for context
