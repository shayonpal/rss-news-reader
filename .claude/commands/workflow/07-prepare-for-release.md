# Prepare and Execute Production Release

## Project Activation

First, activate Serena MCP to access project memories and symbol navigation:

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

I need you to prepare a production release from `dev` to `main` branch using symbol-level analysis for maximum precision and safety.

## Behavioral Rules (Display at Start)

1. NEVER commit code without explicit user permission
2. ALWAYS activate Serena MCP for symbol-level analysis
3. ALWAYS use symbol-specific change tracking for release notes
4. NEVER proceed with release if critical symbols have breaking changes
5. ALWAYS use sub-agents for specialized validation
6. ALWAYS create comprehensive TodoWrite for release tracking

## Prerequisites

**Required Activations**:

- `mcp__serena__activate_project` - Symbol navigation and analysis
- Sub-agents: `test-expert`, `db-expert`, `doc-admin`, `infra-expert`

**Pre-Flight Checklist**:

- [ ] You're on `dev` branch
- [ ] All feature branches are merged
- [ ] Local dev is up to date: `git pull origin dev`
- [ ] No uncommitted changes: `git status`
- [ ] Serena MCP project activated
- [ ] You have push access to `main` branch
- [ ] Current production is stable

## Phase 1: Symbol-Level Release Analysis

**First, activate Serena MCP and create TodoWrite for release tracking.**

1. **Symbol Overview Analysis**:

   ```
   get_symbols_overview - Get complete project symbol inventory
   ```

   - Identify all symbols: components, stores, API routes, utilities
   - Map current symbol structure and dependencies
   - Establish baseline for change analysis

2. **Modified Symbols Detection**:

   ```bash
   git diff main..dev --name-only
   ```

   For each modified file, use:

   ```
   find_symbol [file_path] - Find symbols in modified files
   ```

   - Track exact symbols changed, not just files
   - Categorize by symbol type (component, store, route, utility)
   - Note modification type (new, updated, deleted)

3. **Dependency Impact Assessment**:
   For each modified symbol, use:

   ```
   find_referencing_symbols [symbol_name] - Find all dependencies
   ```

   - Map cascade effects of changes
   - Identify breaking change risks
   - Count affected integration points
   - Flag critical symbol modifications

## Phase 2: Enhanced Quality Validation

Run automated checks IN SEQUENCE, enhanced with symbol context:

1. **Infrastructure Health with Symbol Tracking**:
   - `npm run type-check` - Track TypeScript errors by symbol
   - `npm run lint` - Map lint issues to specific symbols
   - `npm test` - Correlate test failures with modified symbols
   - `npm run pre-commit` - Comprehensive validation

2. **Symbol-Specific Testing**:
   Use `test-expert` with symbol context:
   - Test coverage for modified symbols
   - Integration test validation for affected components
   - E2E scenarios covering changed user flows

3. **Performance & Compatibility**:
   - `node scripts/check-performance-regression.js`
   - `npx playwright test` - Focus on flows using modified symbols
   - Track bundle size impact from symbol changes

4. **Build Validation**:
   - `NODE_ENV=production SKIP_ENV_VALIDATION=true npm run build --no-lint`
   - Verify modified symbols compile correctly
   - Check for tree-shaking impact

**Abort Conditions**: Stop if critical symbols have breaking changes or if dependency cascades are too extensive.

## Phase 3: Symbol-Enhanced Release Planning

1. **Intelligent Version Determination**:
   Based on symbol analysis, suggest version bump:
   - **PATCH**: Bug fixes in existing symbols, no API changes
   - **MINOR**: New symbols added, existing symbols enhanced (backward compatible)
   - **MAJOR**: Breaking changes in public API symbols, removed symbols

2. **Dependency & Security Audit**:
   - `npm audit` - Check vulnerabilities
   - `npm outdated` - Review dependency updates
   - Map security issues to affected symbols

3. **Symbol-Driven Release Notes**:
   Generate detailed release notes by symbol category:

   **New Symbols**:
   - Components: [list new React components]
   - Stores: [list new Svelte stores]
   - API Routes: [list new endpoints]
   - Utilities: [list new helper functions]

   **Modified Symbols**:
   - Enhanced: [symbols with new features]
   - Fixed: [symbols with bug fixes]
   - Refactored: [symbols with internal improvements]

   **Removed Symbols**:
   - Deprecated: [removed symbols with migration path]
   - Breaking: [removed symbols requiring code changes]

   **Dependency Impact Summary**:
   - X symbols directly modified
   - Y symbols indirectly affected
   - Z integration points touched

## Phase 4: Specialized Symbol-Aware Reviews

Use enhanced sub-agents IN PARALLEL with symbol context:

**Core Validation**:

- `test-expert` - Validate test coverage for modified symbols, integration test completeness
- `db-expert` - Review database schema changes, performance impact of data layer modifications
- `infra-expert` - Check deployment readiness, infrastructure compatibility

**Quality & Compatibility**:

- `doc-admin` - Comprehensive documentation review, ensure all symbol changes documented
- Enhanced code review using Serena symbol analysis

**Review Protocol**: Each agent receives:

- List of modified symbols with categories
- Dependency impact maps from `find_referencing_symbols`
- Integration points affected
- Breaking change risk assessment

Each returns structured feedback with symbol-specific recommendations.

## Phase 5: Symbol-Driven Release Decision

Present comprehensive release readiness report:

```
SYMBOL-LEVEL RELEASE READINESS REPORT
=====================================
Version: current → proposed (based on symbol impact analysis)

MODIFIED SYMBOLS SUMMARY:
- Direct Changes: X symbols
- Dependency Impact: Y symbols affected
- Integration Points: Z touchpoints
- Breaking Changes: A critical symbols

VALIDATION STATUS:
Infrastructure: ✅ Healthy / ❌ X symbol compilation errors
Tests: ✅ All coverage / ⚠️ Y symbols need tests
E2E: ✅ All flows / ❌ Z user journeys broken
Performance: ✅ No regression / ⚠️ A% impact from [symbols]
Security: ✅ Clean audit / ⚠️ B vulnerabilities affecting [symbols]
Documentation: ✅ Complete / ⚠️ C symbols undocumented

SPECIALIST REVIEWS:
- Critical Issues: X (symbol-specific)
- High Priority: Y (integration concerns)
- Low Priority: Z (minor improvements)

RELEASE COMPLEXITY SCORE: [LOW/MEDIUM/HIGH/CRITICAL]
Recommendation: PROCEED / HOLD / ABORT

1. Go ahead with the Release Process?
2. Change/Modify something about this release?
3. Abandon this release effort for now?
```

## Phase 6: Enhanced Release Execution

If user approves, coordinate release with symbol tracking:

**Pre-Release Documentation**:
Use `doc-admin` to:

1. Update CHANGELOG.md with symbol-specific release notes
2. Update API documentation for modified endpoints
3. Document any breaking changes with migration guides
4. Verify all cross-references are valid

**Release Branch Creation**:

```bash
git checkout -b release/vX.Y.Z
```

**Release Preparation**:

1. Update version in package.json
2. Finalize CHANGELOG.md with symbol impact summary
3. Commit: `git commit -m "chore: prepare release vX.Y.Z - [X symbols modified]"`

**Release Execution**:

1. Merge to main: `git checkout main && git merge --no-ff release/vX.Y.Z`
2. Create annotated tag with symbol summary:

   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z

   Modified Symbols: X direct, Y affected
   Breaking Changes: [list if any]
   Key Features: [symbol-based list]"
   ```

3. Push: `git push origin main --tags`
4. Merge back to dev: `git checkout dev && git merge main`
5. Clean up: `git branch -d release/vX.Y.Z`

## Phase 7: Symbol-Aware Post-Release Verification

After release creation, verify with symbol context:

1. **Git State with Symbol Tracking**:
   - Confirm tag exists: `git describe --tags --abbrev=0`
   - Verify main is clean: `git status`
   - Check dev is updated: `git log dev..main` (should be empty)
   - Validate symbol integrity with `get_symbols_overview`

2. **Build Verification with Symbol Validation**:
   - Checkout main: `git checkout main`
   - Run production build: `npm run build`
   - Verify all modified symbols compile correctly
   - Check bundle analysis for symbol impact
   - Verify all services start: `pm2 status`

3. **Documentation Verification**:
   Use `doc-admin` to verify:
   - CHANGELOG.md has symbol-specific release entry
   - Version in package.json is correct
   - API documentation reflects modified endpoints
   - All symbol changes are documented
   - Cross-references are valid

## Phase 8: Enhanced Deployment Preparation

Generate symbol-aware deployment checklist:

1. **Pre-Deployment with Symbol Context**:
   - [ ] Backup database (especially if schema symbols modified)
   - [ ] Note current PM2 service IDs
   - [ ] Save current environment variables
   - [ ] Document symbols that affect runtime behavior
   - [ ] Identify rollback-critical symbols

2. **Deployment Steps with Symbol Awareness**:
   - [ ] Pull latest main branch
   - [ ] Run `npm install --production`
   - [ ] Run database migrations (if data layer symbols changed)
   - [ ] Restart PM2 services
   - [ ] Clear CDN cache (if static assets or API symbols modified)
   - [ ] Verify symbol-specific configurations

3. **Post-Deployment Symbol Validation**:
   - [ ] Verify app loads at http://100.96.166.53:3000/reader
   - [ ] Test modified API endpoints specifically
   - [ ] Run E2E tests focusing on changed user flows
   - [ ] Validate modified component rendering
   - [ ] Check performance impact of modified symbols
   - [ ] Monitor PM2 logs for symbol-related errors

## Success Criteria

**Symbol-Level Success Metrics**:

- ✅ All modified symbols pass validation
- ✅ No breaking changes in critical symbols
- ✅ Dependency impact assessed and documented
- ✅ Symbol-specific tests pass
- ✅ Clean merge to main with symbol-aware tag
- ✅ Build succeeds with all symbols intact
- ✅ Symbol-specific documentation updated
- ✅ Symbol-aware deployment checklist ready

## Enhanced Rollback Plan

**Symbol-Aware Rollback Strategy**:

```bash
# Quick rollback to previous release
git checkout main
git reset --hard <previous-tag>
git push --force-with-lease origin main

# Verify symbol integrity after rollback
get_symbols_overview
```

**Symbol-Specific Rollback Considerations**:

- Identify which symbols caused the issue
- Check for database schema rollback needs
- Verify API endpoint backward compatibility
- Test affected integration points

## Symbol-Enhanced Troubleshooting

### Symbol Compilation Errors

- **Type errors in symbols**: Use `find_symbol` to locate exact issues
- **Dependency conflicts**: Use `find_referencing_symbols` to map impact
- **Missing symbols**: Check for import/export issues in modified files
- **Auto-fix approach**: Focus on symbol-level fixes first

### Symbol Integration Issues

- **API endpoint failures**: Verify route symbol implementations
- **Component rendering errors**: Check component symbol dependencies
- **Store state issues**: Validate store symbol modifications
- **Cross-symbol dependencies**: Use dependency mapping for resolution

### Performance Issues from Symbols

- **Bundle size increases**: Analyze symbol import patterns
- **Runtime performance**: Profile symbol execution impact
- **Memory issues**: Check for symbol-level memory leaks
- **Load time regressions**: Identify heavy symbols affecting startup

### Symbol Documentation Issues

- **Missing documentation**: Use `doc-admin` for comprehensive updates
- **Outdated API docs**: Ensure endpoint symbols are documented
- **Broken cross-references**: Validate symbol references in docs
- **Migration guides**: Document breaking symbol changes

## Execution Principles

1. **Symbol-First Approach**: Always analyze at symbol level, not just file level
2. **Dependency Awareness**: Map symbol dependencies before making changes
3. **Breaking Change Detection**: Flag any modifications to public API symbols
4. **Documentation Consistency**: Ensure all symbol changes are documented
5. **Rollback Safety**: Identify rollback-critical symbols upfront
6. **Testing Correlation**: Link test failures to specific symbols
7. **Performance Tracking**: Monitor performance impact by symbol category

## Context & Integration

**Project Architecture**:

- **Symbol Types**: React components, Svelte stores, API routes, utilities
- **Critical Symbols**: Authentication, sync pipeline, data stores
- **Integration Points**: Database layer, external APIs, service workers

**Release Environment**:

- Dev branch: Active development with symbol tracking
- Main branch: Release-ready code with symbol validation
- Versioning: Semantic based on symbol impact analysis
- Environment: Single dev server with symbol-aware monitoring
- App URL: http://100.96.166.53:3000/reader
- PM2 Services: rss-reader-dev, rss-sync-cron, rss-sync-server
- Database: Supabase PostgreSQL with schema symbol tracking
- CI/CD: Manual process enhanced with symbol analysis

**Serena MCP Integration**:

- Symbol navigation and analysis throughout release process
- Dependency mapping for impact assessment
- Symbol-specific change tracking for precise release notes
- Integration with all sub-agents for symbol-aware validation
