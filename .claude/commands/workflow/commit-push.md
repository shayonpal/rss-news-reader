---
description: Commit and push changes using symbolic analysis for precise change tracking and validation
argument-hint: [linear-issue-id]
---

# Commit and Push Changes with Symbol Analysis

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
npm run test:optimized  # <20s execution
```

## 2. Symbol-Based Documentation Check

### 2A. CHANGELOG with Symbol Details

Use `doc-admin` to update CHANGELOG.md with symbol-specific information:

```markdown
## [Unreleased]

### Added

- [RR-XXX] New sync functionality in ArticleStore/syncArticles
- Enhanced error handling in SyncService/performSync

### Changed

- [RR-XXX] Modified useArticleStore hook for better state management
- Updated API endpoint /api/sync/trigger for improved response format

### Fixed

- [RR-XXX] Resolved memory leak in article cleanup (ArticleManager/cleanup)
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
- API documentation (docs/api/) for new/changed endpoints
- README.md for setup/usage changes
- Environment variables documentation (.env.example)
- Service configuration (PM2, monitoring)
- Testing documentation for new test patterns
- Architecture docs for significant changes
- User guides for feature changes
- Deployment instructions if needed

Update Requirements:
- Include Linear reference (RR-XXX)
- Add timestamps and version info
- Update table of contents if needed
- Ensure all cross-references are valid
```

Expected outputs:

- List of documentation files updated
- Summary of changes made to each file
- Confirmation that all relevant docs are current

### 2C. Update Project Memory

Use memory MCP to store implementation knowledge:

- Symbol-level changes made
- Integration patterns used
- Performance considerations
- Future enhancement opportunities

## 3. Learning Memory Documentation

### 3A. Assess Learning Documentation Need

Determine if this implementation qualifies for learning memory:

**Major Feature Criteria** (any of these triggers learning documentation):
- Modified more than 10 symbols
- Encountered test infrastructure failures
- Required infrastructure fixes or workarounds
- Implemented new architectural patterns
- Fixed long-standing bugs or complex issues
- Required system limitation workarounds
- Significant integration challenges resolved

**Quick Assessment**:
```bash
# Count modified symbols
git diff --cached --name-only | wc -l

# Check for infrastructure/test files
git diff --cached --name-only | grep -E "(test|spec|config|infra|deploy)"

# Review commit scope from Symbol Analysis (Section 1A)
```

### 3B. Generate Learning Memory (If Qualifying)

If criteria met, use Serena MCP to create learning memory:

```
Task: Create learning memory for RR-XXX implementation

Memory Name: issue_RR-XXX_learnings.md

Content Structure:
---
# RR-XXX Implementation Learnings: [Issue Title]

## Issue Context
- Linear ID: RR-XXX
- Implementation Date: [current date]
- Primary Challenge: [main problem solved]

## Implementation Challenges Encountered

### Technical Challenges
- [Symbol-specific issues encountered]
- [Integration point difficulties]
- [Performance/memory considerations]

### Infrastructure Issues
- [Test infrastructure problems]
- [Build/deployment challenges]
- [Environment configuration issues]

### Architectural Decisions
- [New patterns introduced]
- [Design trade-offs made]
- [Future scalability considerations]

## Solutions Applied

### Symbol-Level Solutions
- [Specific function/class fixes]
- [Integration pattern implementations]
- [Error handling improvements]

### Workarounds & Fixes
- [System limitation workarounds]
- [Temporary solutions with future todo]
- [Performance optimizations]

## Key Symbols & Complexity

### Most Complex Symbols
- [Function/class]: [why complex, solution applied]
- [Integration point]: [challenge, resolution]

### Problematic Areas
- [Areas that caused multiple iterations]
- [Symbols requiring extensive testing]
- [Performance bottlenecks resolved]

## Future Implementation Notes

### Patterns to Reuse
- [Successful approaches for similar problems]
- [Testing strategies that worked well]
- [Integration patterns to replicate]

### Areas for Improvement
- [Technical debt created]
- [Performance optimizations deferred]
- [Documentation gaps to address]

### Related Work
- [Connected issues that might benefit]
- [Similar patterns in other parts of codebase]
- [Dependencies to monitor]

## Testing Insights
- [Test failures and resolutions]
- [New testing patterns established]
- [Coverage gaps discovered]

## Performance & Security Notes
- [Performance implications]
- [Security considerations addressed]
- [Monitoring requirements added]
---

Symbol Change Summary from Section 1A:
[Include the modified symbols list from earlier analysis]

Quality Validation Results:
[Include test results, performance metrics, security scan results]
```

### 3C. Store Learning Memory

Execute memory creation via Serena MCP if qualifying issue.

## 4. Pre-Commit Symbol Validation

### 4A. Symbol-Level Quality Checks

```bash
# Stage all changes
git add .

# Comprehensive validation
npm run pre-commit

# Symbol-specific checks
npm run test:performance
```

### 4B. Symbol Coverage Analysis

Verify all modified symbols are properly:

- Tested (unit and integration)
- Documented (comments and external docs)
- Integrated (dependencies updated)
- Secured (no vulnerabilities introduced)

## 5. Generate Commit with Symbol Context

### 5A. Prepare Symbol-Aware Commit Message

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
- Tests: All passing (Xs execution time)
- Type-check: Clean compilation
- Performance: No regression detected
- Documentation: CHANGELOG and memory updated

Commit Type: feat|fix|docs|chore
Breaking Changes: [yes/no with symbol details]
Linear Reference: RR-XXX
```

### 5B. Execute Commit via git-expert

Use `git-expert` with symbol-level context:

- Include specific symbol paths in commit message
- Reference Linear issue and acceptance criteria
- Highlight integration points affected
- Push to dev/feature branch (never main)

## 6. Post-Commit Symbol Tracking

### 6A. Update Linear with Symbol Details

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
```

### 6B. Verify Push Success

Confirm with git-expert:

- Commit SHA and message recorded
- Push successful to correct branch
- CI/CD pipeline triggered
- No merge conflicts

## 7. Symbol-Level Commit Report

```
✅ Commit Complete for RR-XXX: [Title]

🔍 Symbol Analysis:
Primary Changes:
- ArticleStore/syncArticles: [brief description]
- SyncService/performSync: [brief description]
- /api/sync/trigger: [brief description]

Dependency Updates:
- X consumer symbols updated
- Y integration points modified
- Z test files enhanced

📊 Quality Validation:
- Type Compilation: ✅ Clean
- Linting: ✅ No issues
- Tests: ✅ All passing (Xs)
- Performance: ✅ No regression
- Security: ✅ No vulnerabilities

📚 Documentation:
- CHANGELOG: ✅ Updated with symbol details
- Memory: ✅ Implementation patterns stored
- Linear: ✅ Commented with symbol changes

🚀 Deployment:
- Branch: [dev/feature-branch]
- Commit: [SHA]
- CI/CD: ✅ Pipeline triggered
- Status: Ready for review/merge

🔗 References:
- Linear: RR-XXX
- Changed Files: [count]
- Modified Symbols: [count]
```

## Execution Principles

1. **Symbol-First**: Track changes at function/class level, not just files
2. **Impact-Aware**: Use `find_referencing_symbols` to understand ripple effects
3. **Quality-Gated**: Never commit without comprehensive validation
4. **Documentation-Rich**: Include symbol details in all documentation
5. **Traceability**: Maintain clear symbol-to-requirement mapping

## Important Notes

- **Use Serena**: Leverage symbolic navigation for precise change tracking
- **Quality Gates**: All validation must pass before commit
- **Symbol Precision**: Reference exact functions/classes in documentation
- **Branch Safety**: Never push directly to main branch
- **Agent Coordination**: Let git-expert handle actual git operations with symbol context

**Success Criteria**: All symbols validated, documentation updated, tests passing, Linear referenced, correct branch pushed.
