---
description: Step 6 - Performs comprehensive code review on implementation using symbolic analysis and structured feedback
args: "[optional: specific focus area like 'security', 'performance', 'architecture', or Linear issue ID]"
---

# Step 6: Code Review - Symbol Analysis & Structured Feedback

## Project Activation

First, activate Serena MCP to access project memories and symbol navigation:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

Review implemented code using symbolic navigation and comprehensive analysis: $ARGUMENTS

## 1. Parse Input & Setup

Check $ARGUMENTS:

- If Linear issue ID (RR-XXX) → Review specific implementation
- If focus area → Prioritize that aspect
- If empty → General review of recent changes

## 2. Context Gathering

Use Serena MCP for precise code analysis:

### 2A. Changed Files Discovery

```bash
git status --porcelain
git diff --cached --name-only
git log --oneline -5
```

### 2B. Symbol-Level Change Analysis

Use Serena to understand modifications:

- `get_symbols_overview` on each changed file
- `find_symbol` for modified functions/classes
- `find_referencing_symbols` to assess impact scope
- Map changes to specific symbols for targeted review

### 2C. Implementation Context

If Linear issue provided:

- Use `linear-expert` to get requirements and test contracts
- Extract expected behavior from issue comments
- Identify implementation strategy from analysis phase

## 3. Invoke Code-Reviewer Agent

Use `code-reviewer` agent with complete symbol-level context:

```
Context Package:
- Linear Issue: [RR-XXX details if provided]
- Changed Files: [list from git status]
- Symbol Changes: [specific functions/classes modified]
- Dependency Impact: [symbols affected via find_referencing_symbols]
- Focus Area: [from $ARGUMENTS or inferred from changes]
- Project Patterns: [relevant existing implementations]
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

## 6. Structured Output

Expect structured feedback with:

**Assessment**: Approved | Needs Changes | Major Issues
**Risk Level**: Low | Medium | High | Critical
**Symbol-Level Issues**: Specific function/class problems
**API Documentation Status**: Complete | Incomplete | Missing (if APIs modified)

### Critical Issues (If Any)

- Issue → Symbol:Line → Required fix

### Improvements

- **Must Fix**: Blocking issues with symbol references
  - API documentation gaps (JSDoc, OpenAPI registry)
  - Missing Zod schemas for API endpoints
  - Undocumented response examples
- **Should Fix**: Important improvements
- **Consider**: Optional enhancements

### API Documentation Report (If APIs Modified)

- **JSDoc Coverage**: X/Y endpoints documented
- **OpenAPI Registry**: X/Y endpoints registered
- **Schema Coverage**: X/Y endpoints with Zod validation
- **Missing Documentation**: List of undocumented endpoints

### Next Steps

1. Address critical issues at symbol level
2. **If APIs modified**: Fix documentation gaps identified in coverage report
3. Run verification: `npm run type-check && npm run lint && npm run test`
4. **Validate API docs**: `node scripts/validate-openapi-coverage.js`
5. Re-review if major changes needed
6. If approved: Use `07-test` to run comprehensive testing

## Requirements

- Serena MCP activated for symbolic analysis
- Git repository with staged changes
- Code-reviewer agent available
- Optional: Linear issue for context
