---
description: Step 8 - Final commit and push with symbol analysis and comprehensive validation
argument_hint: [linear-issue-id]
---

# Step 8: Commit - Final Commit & Push with Symbol Analysis

## Project Activation

First, activate Serena MCP to access project memories and symbol analysis:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

Prepare, validate, and commit changes with symbol-level precision for Linear issue $ARGUMENTS.

## 1. Symbol-Level Change Analysis

### 1A. Discover Implementation Changes

Use Serena MCP to understand what was implemented:

1. **Find Modified Symbols**:

   ```bash
   git status --porcelain
   git diff --cached --name-only
   ```

2. **Analyze Symbol Changes**:
   - `get_symbols_overview` on each modified file
   - `find_symbol` for specific functions/classes changed
   - `find_referencing_symbols` to identify impact scope

3. **Map Implementation to Requirements**:
   - Cross-reference symbol changes with Linear issue
   - Identify which acceptance criteria are addressed
   - Validate symbol-level completeness

### 1B. Linear Context Recovery

If Linear issue provided:

- Use `linear-expert` to verify issue status and requirements
- Extract implementation summary from comments
- Confirm all symbol changes align with planned approach

### 1C. Branch & Environment Validation

```bash
# Verify correct branch (NOT main)
git branch --show-current

# Validate environment
npm run type-check
npm run lint
npm run test  # Use optimized runner (8-20s execution)
```

## 2. Symbol-Based Documentation Check

### 2A. CHANGELOG with Symbol Details

Use `doc-admin` to update CHANGELOG.md with symbol-specific information:

```
Task: Update CHANGELOG.md with symbol-level details

First check if RR-XXX entry already exists in CHANGELOG.md:
- If entry exists and is complete: Skip CHANGELOG update
- If entry missing or incomplete: Add/update entry

Exclude config directory changes from CHANGELOG:
- Skip changes in: .claude, .code, .cursor, .gemini-clipboard, .github, .serena
- Only include actual implementation changes

Add entry under [Unreleased] section with timestamp format "Sep 13, 2025 - 07:32 AM EDT":

### Added (if new features)
- [RR-XXX] New sync functionality in ArticleStore/syncArticles - Sep 13, 2025 - 07:32 AM EDT
- Enhanced error handling in SyncService/performSync

### Changed (if modifications)
- [RR-XXX] Modified useArticleStore hook for better state management - Sep 13, 2025 - 07:32 AM EDT
- Updated API endpoint /api/sync/trigger for improved response format

### Fixed (if bug fixes)
- [RR-XXX] Resolved memory leak in article cleanup (ArticleManager/cleanup) - Sep 13, 2025 - 07:32 AM EDT

Include:
- Linear issue reference
- Specific symbol changes
- Timestamp in required format
- Brief impact description
```

### 2B. Comprehensive Documentation Review

Use `doc-admin` to identify and update all relevant documentation:

```
Task: Review and update all documentation for RR-XXX changes

Symbol Changes Analysis:
- [Provide list of modified symbols from Section 1A]
- [API endpoints added/modified]
- [Configuration changes]
- [New features or behavior changes]

Documentation Review Checklist:
- docs/api/ for new/changed endpoints
- docs/features/ for user-facing changes
- docs/tech/ for technical architecture updates
- docs/ui-ux/ for interface changes
- docs/testing/ for new test patterns
- docs/performance/ for optimization changes
- docs/security/ for security-related changes
- README.md for setup/usage changes (high priority only)
- Other relevant documents based on change type

Update Requirements:
- Include Linear reference (RR-XXX)
- Add timestamps and version info
- Update table of contents if needed
- Ensure all cross-references are valid
```

### 2C. Update Project Memory

Use Serena MCP to store implementation knowledge:

```
Task: Update Serena memories with implementation knowledge

Priority 1 - Update Existing Memories:
- Use mcp__serena__list_memories to find relevant existing memories
- Update issue_learnings_consolidated.md with new insights
- Update completed_issue_implementations.md with new patterns
- Update relevant technical domain memories (sync, UI, API, performance, etc.)

Priority 2 - Create New Memory (only if needed):
- If no existing relevant memory found
- If implementation represents completely new technical domain
- If significant enough to warrant standalone documentation

Memory name (if new): issue_RR-XXX_implementation_summary.md

Content for new/updated memories:
- Symbol-level changes made
- Integration patterns used
- Performance considerations
- Future enhancement opportunities
- Implementation challenges and solutions
- Reusable patterns for similar issues
```

## 3. Pre-Commit Symbol Validation

### 3A. Symbol-Level Quality Checks

```bash
# Stage all changes
git add .

# Comprehensive validation
npm run pre-commit

# Symbol-specific checks if available
npm run test:performance
```

### 3B. Symbol Coverage Analysis

Verify all modified symbols are properly:

- Tested (unit and integration)
- Documented (comments and external docs)
- Integrated (dependencies updated)
- Secured (no vulnerabilities introduced)

## 4. Generate Commit with Symbol Context

### 4A. Prepare Symbol-Aware Commit Message

Gather comprehensive context for git-expert:

```
Task: Commit symbol-level changes for RR-XXX

Symbol Changes:
- Primary: ArticleStore/syncArticles (enhanced sync logic)
- Consumer: useArticleStore hook (state management updates)
- Integration: /api/sync/trigger (response format changes)
- Dependencies: SyncService/performSync (error handling)

Implementation Summary:
- [Brief description of what symbols do]
- [Integration points modified]
- [Performance/security considerations]

Quality Validation:
- Tests: All passing ([X]s execution time)
- Type-check: Clean compilation
- Performance: No regression detected
- Documentation: CHANGELOG and memory updated

Commit Type: feat|fix|docs|chore
Breaking Changes: [yes/no with symbol details]
Linear Reference: RR-XXX
```

### 4B. Execute Commit via git-expert

Use `git-expert` with symbol-level context:

- Include specific symbol paths in commit message
- Reference Linear issue and acceptance criteria
- Inform them exactly which files should be committed and pushed
- Highlight integration points affected
- Push to dev/feature branch (never main)

## 5. Post-Commit Symbol Tracking

### 5A. Update Linear with Symbol Details

Use `linear-expert` to add comment:

```
✅ Implementation Complete - Commit: [SHA]

Symbol Changes:
- ArticleStore/syncArticles: Enhanced sync performance
- SyncService/performSync: Added retry mechanism
- /api/sync/trigger: Updated response schema
- useArticleStore: Improved state management

Impact Analysis:
- X symbols modified
- Y dependent components updated
- Z integration points validated

Quality Metrics:
- Test coverage: 100% of modified symbols
- Performance: No regression in sync operations
- Security: All input validation maintained

Documentation:
- CHANGELOG: Updated with timestamped entries
- Technical docs: Updated in appropriate locations
- Serena memory: Implementation patterns stored
```

### 5B. Verify Push Success

Confirm:

- Commit SHA and message recorded
- Push successful to correct branch
- No merge conflicts

### 5C. Verify Issue Status

Use `linear-expert` to verify the issue has been resolved and update status appropriately.

## 6. Symbol-Level Commit Report

```
✅ RR-XXX Commit Complete

Implementation Summary: [One sentence description]

Symbol Changes:
- ArticleStore/syncArticles: [brief description]
- SyncService/performSync: [brief description]
- /api/sync/trigger: [brief description]

Files: [X files modified] | Symbols: [Y symbols changed]
Tests: ✅ All passing ([X]s) | Documentation: ✅ Updated

Quality Validation:
- TypeScript: ✅ Clean compilation
- Linting: ✅ No issues
- Performance: ✅ No regression
- Security: ✅ No vulnerabilities

Git Status:
- Branch: [dev/feature-branch]
- Commit: [SHA]
- Push: ✅ Successful
- Linear: ✅ Updated and resolved

Status: Implementation complete and deployed
```

## Execution Principles

1. **Symbol-First**: Track changes at function/class level, not just files
2. **Impact-Aware**: Use `find_referencing_symbols` to understand ripple effects
3. **Quality-Gated**: Never commit without comprehensive validation
4. **Documentation-Rich**: Include symbol details in all documentation
5. **Traceability**: Maintain clear symbol-to-requirement mapping

## Key Rules

- ✅ ALWAYS use Serena MCP for symbolic navigation and precise change tracking
- ✅ ALWAYS run comprehensive quality validation before commit
- ✅ ALWAYS update CHANGELOG with timestamped entries
- ✅ ALWAYS reference exact functions/classes in documentation
- ✅ ALWAYS push to correct branch (never main directly)
- ✅ ALWAYS update Linear with implementation completion
- ✅ ALWAYS let git-expert handle actual git operations with symbol context
- 🚫 NO commits without comprehensive validation
- 🚫 NO branch safety violations
- Focus on symbol-level precision and complete traceability