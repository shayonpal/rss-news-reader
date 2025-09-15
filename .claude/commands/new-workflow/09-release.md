---
description: Step 9 - Release preparation with comprehensive validation and documentation updates
argument_hint: [version|auto]
---

# Step 9: Release - Comprehensive Release Preparation

Prepare a new release with comprehensive validation, documentation updates, and structured release process. Uses release-manager agent for coordinated release management.

## Instructions

Check $ARGUMENTS for version specification:

- If version provided (e.g., "v0.8.0") → Use specified version
- If "auto" provided → Auto-increment patch version
- If empty → Determine version based on changes since last release

## 1. Release Context Analysis

### 1A. Change Analysis Since Last Release

```bash
# Get last release tag
LAST_TAG=$(git describe --tags --abbrev=0)

# Analyze changes since last release
git log ${LAST_TAG}..HEAD --oneline
git diff ${LAST_TAG}..HEAD --name-only

# Count Linear issues resolved
git log ${LAST_TAG}..HEAD --grep="RR-" --oneline | wc -l
```

### 1B. Version Determination

```
Analyze changes to determine version bump:
- Major (X.0.0): Breaking changes, architecture changes
- Minor (X.Y.0): New features, significant enhancements
- Patch (X.Y.Z): Bug fixes, minor improvements

Based on commit analysis and Linear issues resolved since last release.
```

## 2. Use release-manager Agent

Use `release-manager` agent for comprehensive release preparation:

```
Task: Prepare release for RSS News Reader

Release Context:
{
  "proposed_version": "[version from arguments or determined]",
  "last_release": "[last tag from git]",
  "changes_since_last": [
    "[list of commits since last release]"
  ],
  "linear_issues_resolved": [
    "RR-XXX: [title]",
    "RR-YYY: [title]"
  ],
  "change_analysis": {
    "breaking_changes": "[any breaking changes identified]",
    "new_features": "[list of new features]",
    "bug_fixes": "[list of bug fixes]",
    "performance_improvements": "[performance changes]"
  }
}

Release Requirements:
1. Validate all Linear issues are properly resolved
2. Update version numbers in package.json and relevant files
3. Generate comprehensive CHANGELOG for this release
4. Update README.md if significant changes
5. Validate all tests pass and quality gates
6. Prepare release notes and documentation
7. Coordinate merge from dev to main branch
8. Create git tag with proper annotations

Execute comprehensive release preparation workflow.
```

## 3. Release Validation

### 3A. Quality Gate Validation

```bash
# Comprehensive quality checks
npm run type-check
npm run lint
npm run test
npm run docs:validate

# Performance validation
npm run test:performance

# Build validation
npm run build
```

### 3B. Integration Testing

```bash
# E2E testing for release validation
npm run test:e2e

# Integration testing
npm run test:integration:safe
```

## 4. Release Documentation

### 4A. Release Notes Generation

Based on changes since last release:

```
Generate release notes covering:
- New features and capabilities
- Bug fixes and improvements
- Performance optimizations
- Breaking changes (if any)
- Migration instructions (if needed)
- Known issues or limitations
```

### 4B. Documentation Updates

Update relevant documentation:

```
Documentation checklist for release:
- README.md: Update version badges and feature list
- CHANGELOG.md: Move [Unreleased] entries to new version section
- docs/release-notes/: Create version-specific release notes
- package.json: Update version number
- Any API documentation with version-specific information
```

## 5. Branch Management

### 5A. Dev to Main Merge Preparation

```bash
# Ensure dev branch is ready for merge
git checkout dev
git pull origin dev

# Check for any uncommitted changes
git status

# Validate main branch is up to date
git checkout main
git pull origin main

# Check for merge conflicts
git merge-tree $(git merge-base main dev) main dev
```

### 5B. Merge Strategy

```
Release merge strategy:
1. Merge dev to main with --no-ff for clear release history
2. Create annotated git tag with release notes
3. Push main branch and tags
4. Update Linear issues to released status
5. Generate GitHub release (if applicable)
```

## 6. Final Release Output

```
✅ Release v[X.Y.Z] Prepared

Changes:
- Linear Issues: [X] resolved since v[last]
- New Features: [count]
- Bug Fixes: [count]
- Performance: [improvements made]

Quality Validation:
- Tests: ✅ All passing
- Build: ✅ Successful
- TypeScript: ✅ Clean
- API Docs: ✅ Validated
- E2E Tests: ✅ Cross-browser verified

Documentation:
- CHANGELOG: ✅ Updated for v[X.Y.Z]
- Release Notes: ✅ Generated
- README: ✅ Updated (if needed)
- Version Bumps: ✅ Applied

Git Status:
- Branch: main
- Tag: v[X.Y.Z]
- Merge: ✅ Dev merged to main

Next Steps:
1. Push release: git push origin main && git push origin v[X.Y.Z]
2. Deploy to production (if applicable)
3. Update Linear project status
4. Announce release
```

## Key Rules

- ✅ ALWAYS use release-manager agent for comprehensive preparation
- ✅ ALWAYS validate all quality gates before release
- ✅ ALWAYS update documentation and version numbers
- ✅ ALWAYS create proper git tags with annotations
- ✅ ALWAYS merge dev to main (never commit directly to main)
- ✅ ALWAYS resolve all Linear issues before release
- 🚫 NO releases without comprehensive testing
- 🚫 NO direct commits to main branch
- Focus on quality, documentation, and proper versioning
