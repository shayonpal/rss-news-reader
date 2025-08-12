---
description: Investigate this codebase for redundant files, outdated documentation, and restructuring opportunities. Provides non-destructive recommendations only.
argument-hint: [focus area - docs, code, config, test, all]
---

# Codebase Cleanup Analysis

Perform a comprehensive read-only analysis of the codebase and think hard to identify files that can be deleted, consolidated, or restructured.

## Analysis Scope

Parse $ARGUMENTS for focus area:

- **docs**: Focus on documentation files
- **code**: Focus on source code and components
- **config**: Focus on configuration files
- **test**: Focus on test files and structure
- **all** or empty: Complete codebase analysis (default)

## 1. Documentation Analysis

Use `doc-search` to examine:

- Outdated documentation that no longer matches implementation
- Duplicate information across multiple files
- Empty or placeholder documentation files
- Documentation that could be consolidated
- Missing critical documentation

Check for:

- Files with last modified dates > 1 month ago
- Documentation referencing deprecated features
- Overlap between README.md, docs/, and inline comments
- Temporary documentation

## 2. Code Structure Analysis

Use `git-expert` to analyze:

- Unused files (no imports/exports)
- Dead code branches
- Duplicate implementations
- Files that haven't been touched in months
- Temporary or experimental files

Look for patterns:

- Components with no references
- Utility functions that duplicate built-in methods
- Old API routes that are no longer used
- Commented-out code blocks that should be removed
- Test pages/routes that shouldn't exist in production (e.g., /test-\*)
- Debug endpoints exposing internal information
- Deprecated code still being imported

## 3. Configuration Redundancy

Examine configuration files for:

- Duplicate configuration across files
- Development configs in production
- Obsolete environment variables
- Unused dependencies in package.json
- Build artifacts that shouldn't be in version control

## 4. Database & Migration Analysis

Use `db-expert-readonly` to check:

- Unused database tables or columns
- Old migration files that could be consolidated
- Orphaned data relationships
- Redundant indexes
- Multiple users in single-user architecture
- Tables without retention policies (e.g., logs)

## 5. Test Coverage Gaps

Analyze test structure:

- Test files for deleted components
- Duplicate test scenarios
- Missing test coverage for critical paths
- Outdated test fixtures

## 6. Asset & Resource Review

Check static assets and resources:

- Unused images, fonts, or icons
- Duplicate assets with different names
- Large files that could be optimized
- Old build outputs

## 7. Dependency Analysis

Review project dependencies:

- Unused npm packages
- Duplicate functionality across packages
- Outdated packages with security issues
- Dev dependencies in production

## 8. Report Format

Present findings in this structure:

```
📊 Codebase Cleanup Analysis Report

🗑️ Files Recommended for Deletion:
Priority: HIGH (Security Risk)
- [file path] - Reason: [specific reason]
- [file path] - Reason: [specific reason]

Priority: MEDIUM (Architecture Cleanup)
- [file path] - Reason: [specific reason]

Priority: LOW (Documentation/Housekeeping)
- [file path] - Reason: [specific reason]

🔄 Restructuring Opportunities:
1. [Area/Pattern]:
   - Current: [current structure]
   - Suggested: [proposed structure]
   - Benefits: [why this improves the codebase]

📁 Consolidation Candidates:
- Merge [file1, file2] → [target file]
  Reason: [duplication/overlap explanation]

⚠️ Risk Assessment:
- [file]: [potential impact if deleted]
- [file]: [dependencies to check]

💡 Quick Wins (Safe to Delete):
- [file] - No references, no imports
- [file] - Empty placeholder file
- [file] - Superseded by [newer file]

📈 Potential Impact:
- Files to remove: X
- Estimated size reduction: Y KB/MB
- Improved maintainability score: [assessment]

🎯 Recommended Action Plan:
1. [First safe batch to clean]
2. [Second batch requiring verification]
3. [Complex restructuring for future]
```

## Important Notes

- 🚫 This is a READ-ONLY analysis - no files are modified or deleted
- All recommendations require manual review before implementation
- Use git history to understand why files exist before recommending deletion
- Consider build processes and deployment when analyzing
- Check for documentation value even in old files
- Verify no external tools or scripts depend on files

## Special Considerations

- `.claude/` directory files should be ignored for this analysis
- Migration files should generally be preserved for rollback capability
- Test files might seem unused but provide regression protection
- Some "duplicate" code might be intentional for decoupling
