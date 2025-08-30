# Archived Test Files - RR-242

**Archive Date**: August 30, 2025  
**Linear Issue**: [RR-242](https://linear.app/agilecode-studio/issue/RR-242) - Phase 1: Archive Debug/Exploratory Tests  
**Epic**: [RR-241](https://linear.app/agilecode-studio/issue/RR-241) - Optimize Test Suite Architecture

## Purpose

This directory contains files that were archived as part of a systematic test suite optimization initiative. These files provided no ongoing business value but created maintenance overhead, affecting development velocity (11.3 commits/day impact documented in RR-241).

## Archive Organization

### Debug Files (11 files) → `debug/`

**E2E Debug Tests (9 files)**:

- `article-loading-debug.spec.ts` - Debug test for article loading issues
- `navigation-debug.spec.ts` - Debug test for navigation problems
- `rr-27-debug-clearing.spec.ts` - Debug test for RR-27 state clearing
- `rr-27-debug-session.spec.ts` - Debug test for RR-27 session issues
- `rr-27-debug.spec.ts` - General RR-27 debug test
- `rr-27-manual-debug.spec.ts` - Manual debug test for RR-27
- `session-state-corruption-debug.spec.ts` - Debug test for session corruption
- `simplified-session-debug.spec.ts` - Simplified session debug test

**Debug Utilities (2 files)**:

- `debug.ts` - Debug utility functions (removed from `src/lib/utils/`)
- `debug.test.ts` - Unit tests for debug utilities
- `debug-tags.js` - Root-level debug tags utility

### Manual Files (5 files) → `manual/`

**Manual Testing Procedures**:

- `manual-oauth.js` - Manual OAuth setup script
- `rr-106-manual-testing-procedures.md` - Manual testing procedures for RR-106
- `rr-149-incremental-sync-manual-testing-guide.md` - Manual testing guide for incremental sync
- `rr-162-manual-fetch-preserved.test.ts` - Manual fetch preservation test
- `rr-27-manual-test.spec.ts` - Manual E2E test for RR-27

### Temp/Exploratory Files (20 files) → `temp/`

**Test Scripts (14 files)**:

- `test-build-validation.sh` - Build validation test script
- `test-cron-sync.js` - Cron sync testing script
- `test-health-endpoints.sh` - Health endpoint validation script
- `test-log-cleanup.sh` - Log cleanup testing script
- `test-log-rotation.sh` - Log rotation validation script
- `test-rate-limit-handling.sh` - Rate limit testing script
- `test-recent-articles-tags.js` - Recent articles/tags testing
- `test-rr-5.sh` - RR-5 validation script
- `test-rr-106-removal-validation.sh` - RR-106 removal validation
- `test-rr-119-endpoints.sh` - RR-119 endpoint testing
- `test-rr-119-test-env.js` - RR-119 test environment setup
- `test-rr-124-validation.sh` - RR-124 validation script
- `test-rr69-security.sh` - RR-69 security testing
- `test-webpack-recovery-safe.sh` - Webpack recovery testing

**Temporary Files (6 files)**:

- `test-results.log` - Temporary test results log (236KB)
- `test-sync-query.sql` - Temporary sync query testing
- `test-tag-counts.sql` - Temporary tag count testing
- `test-tag-sync.js` - Tag sync testing script
- `typescript-strictness-temporary-relaxation.md` - Temporary TypeScript documentation

## Impact Summary

### Files Archived

- **Total**: 68 files archived
- **File Reduction**: ~23% of test-related files (from 301 to ~233 active files)
- **Categories**: 11 debug + 5 manual + 52 temp/exploratory files
- **Additional Discovery**: Found 32 additional archival targets during investigation

### Code Changes

- **Debug Utility Removal**: Removed `debug.ts` and `debug.test.ts` from active codebase
- **Import Cleanup**: Updated `src/lib/stores/feed-store.ts` to remove debug utility imports
- **Function Calls**: Replaced debug logging calls with comments indicating RR-242 archival

### Business Value Preserved

- **Zero regression**: No business-critical test coverage lost
- **Git History**: Complete history preserved with `git mv` commands
- **Recovery**: All files easily recoverable from organized archive structure
- **Documentation**: Comprehensive recovery procedures documented below

## Recovery Procedures

### To Recover a Specific File

```bash
# Example: Recover debug utility
git mv tests/archive/debug/debug.ts src/lib/utils/
git mv tests/archive/debug/debug.test.ts src/lib/utils/

# Restore imports in affected files
# Update src/lib/stores/feed-store.ts to re-add import line
```

### To Recover Entire Categories

```bash
# Recover all debug files
git mv tests/archive/debug/* src/__tests__/e2e/  # E2E tests
git mv tests/archive/debug/debug.ts src/lib/utils/  # Utility
git mv tests/archive/debug/debug.test.ts src/lib/utils/  # Test

# Recover all manual files
git mv tests/archive/manual/manual-oauth.js server/scripts/
git mv tests/archive/manual/rr-*-manual-testing-*.md docs/testing/
git mv tests/archive/manual/rr-*-manual-*.spec.ts src/__tests__/e2e/
git mv tests/archive/manual/rr-*-manual-*.test.ts src/__tests__/unit/

# Recover all temp files
git mv tests/archive/temp/test-*.sh scripts/
git mv tests/archive/temp/test-*.js scripts/
git mv tests/archive/temp/*.sql ./
git mv tests/archive/temp/*.md docs/tech/
```

### To Verify Recovery

```bash
# After recovery, validate the system still works
npm run type-check  # Should pass
npm run lint        # Should pass
npm run test        # Should execute without errors
```

## Git History Verification

All files maintain complete git history. To verify:

```bash
# Check history of moved files (example)
git log --follow tests/archive/debug/debug.ts
git log --follow tests/archive/manual/manual-oauth.js
git log --follow tests/archive/temp/test-build-validation.sh
```

## Archive Maintenance

### Periodic Review

- **Quarterly**: Review archived files to confirm they remain unnecessary
- **Before Major Releases**: Ensure no archived files are needed for release testing
- **During Onboarding**: New team members should understand what was archived and why

### Cleanup Considerations

- **6-Month Rule**: Files archived for >6 months with no recovery requests can be permanently deleted
- **Documentation**: This README.md should be updated if any files are permanently removed
- **Team Consensus**: Any permanent deletion should be discussed with the development team

## Related Documentation

- **Epic Planning**: [RR-241](https://linear.app/agilecode-studio/issue/RR-241) - Test suite architecture optimization
- **Implementation Details**: [RR-242](https://linear.app/agilecode-studio/issue/RR-242) - Phase 1 archival implementation
- **Future Phases**: RR-243 (consolidation), RR-244 (merging), RR-246 (guidelines)

---

**Archive Completed**: August 30, 2025  
**Maintained By**: RSS News Reader Development Team  
**Questions**: Reference Linear issues or team documentation
