---
description: Performs comprehensive code review on implementation using symbolic analysis and structured feedback
args: "[optional: specific focus area like 'security', 'performance', 'architecture', or Linear issue ID]"
---

# Code Review with Symbol Analysis

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

## 4. Review Focus Areas

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

## 5. Structured Output

Expect structured feedback with:

**Assessment**: Approved | Needs Changes | Major Issues
**Risk Level**: Low | Medium | High | Critical
**Symbol-Level Issues**: Specific function/class problems

### Critical Issues (If Any)

- Issue → Symbol:Line → Required fix

### Improvements

- **Must Fix**: Blocking issues with symbol references
- **Should Fix**: Important improvements
- **Consider**: Optional enhancements

### Next Steps

1. Address critical issues at symbol level
2. Run verification: `npm run type-check && npm run lint && npm run test`
3. Re-review if major changes needed

## Requirements

- Serena MCP activated for symbolic analysis
- Git repository with staged changes
- Code-reviewer agent available
- Optional: Linear issue for context
