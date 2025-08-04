# Prepare and Execute Production Release

I need you to prepare a production release from `dev` to `main` branch, then deploy it as a separate step.

## Pre-Flight Checklist
Before starting, ensure:
- [ ] You're on `dev` branch
- [ ] All feature branches are merged
- [ ] Local dev is up to date: `git pull origin dev`
- [ ] No uncommitted changes: `git status`
- [ ] Tests are passing locally (if applicable)
- [ ] You have push access to `main` branch
- [ ] Current production is stable

## Phase 1: Pre-Release Quality Checks
Run these automated checks IN SEQUENCE on the `dev` branch:

1. **Git Status Check**:
   - Verify on `dev` branch: `git branch --show-current`
   - Check for uncommitted changes: `git status --porcelain`
   - If changes exist, list them and ask user to commit or stash

2. **Code Quality Checks**:
   - `npm run lint` - Fix any linting errors first
   - `npm run type-check` - Check TypeScript compilation
   - `npm run test` (if test script exists in package.json)
   - `npm run pre-commit` (if available - combines multiple checks)

3. **Build Validation**:
   - `NODE_ENV=production SKIP_ENV_VALIDATION=true npm run build --no-lint`
   - Verify build completes without errors
   - Check build output size and warnings

Stop immediately if any check fails. For each failure:
- Show the specific error
- Suggest fixes (e.g., "Run `npm run lint:fix` for auto-fixable issues")
- Ask if user wants you to fix it automatically

## Phase 2: Pre-Release Analysis
Before specialist reviews, gather release information:

1. **Version Determination**:
   - Check current version in `package.json`
   - Review commits since last release: `git log main..dev --oneline`
   - Suggest version bump based on changes:
     - PATCH: Bug fixes only
     - MINOR: New features, backwards compatible
     - MAJOR: Breaking changes

2. **Dependency Audit**:
   - Run `npm audit` to check for vulnerabilities
   - Check for outdated dependencies: `npm outdated`
   - Flag any critical security issues

3. **Release Notes Preparation**:
   - List all commits since last release
   - Group by category: Features, Fixes, Chores, Dependencies
   - Draft release notes for CHANGELOG.md

## Phase 3: Specialist Reviews
If automated checks pass, use these read-only agents IN PARALLEL for review:
- `test-expert` - Check for bugs, test coverage, and feature completeness
- `db-expert-readonly` - Review database schema, migrations, and performance
- `devops-expert-readonly` - Verify sync pipeline integrity and monitoring
- `ui-expert` - Check PWA functionality and iOS compatibility

Each agent returns structured data on:
1. Critical issues (release blockers)
2. High-priority concerns (should fix before release)
3. Low-priority suggestions (can be addressed later)

## Phase 4: Release Decision & Creation
Based on the consolidated report, present a release summary:

```
RELEASE READINESS REPORT
========================
Version: current → proposed
Quality: ✅ All checks passed / ❌ Issues found
Security: ✅ No vulnerabilities / ⚠️ X vulnerabilities
Reviews: X critical, Y high, Z low priority issues

Recommendation: PROCEED / HOLD / ABORT
```

If user approves, use `release-manager` agent to coordinate:
1. Create release branch: `git checkout -b release/vX.Y.Z`
2. Update version in package.json
3. Update CHANGELOG.md with finalized release notes
4. Commit changes: `git commit -m "chore: prepare release vX.Y.Z"`
5. Merge to main: `git checkout main && git merge --no-ff release/vX.Y.Z`
6. Create and push tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
7. Push everything: `git push origin main --tags`
8. Merge back to dev: `git checkout dev && git merge main`
9. Clean up: `git branch -d release/vX.Y.Z`

## Phase 5: Post-Release Verification
After the release is created, verify:

1. **Git State**:
   - Confirm tag exists: `git describe --tags --abbrev=0`
   - Verify main is clean: `git status`
   - Check dev is updated: `git log dev..main` (should be empty)

2. **Build Verification**:
   - Checkout main: `git checkout main`
   - Run production build: `npm run build`
   - Verify all services start: `pm2 status`

3. **Documentation Check**:
   - CHANGELOG.md has new release entry
   - Version in package.json is correct
   - README.md version badge is updated (if applicable)

## Phase 6: Deployment Preparation
Generate deployment checklist:

1. **Pre-Deployment**:
   - [ ] Backup database
   - [ ] Note current PM2 service IDs
   - [ ] Save current environment variables

2. **Deployment Steps**:
   - [ ] Pull latest main branch
   - [ ] Run `npm install --production`
   - [ ] Run database migrations (if any)
   - [ ] Restart PM2 services
   - [ ] Clear CDN cache (if applicable)

3. **Post-Deployment**:
   - [ ] Verify app loads at http://100.96.166.53:3000/reader
   - [ ] Check health endpoints
   - [ ] Test critical user flows
   - [ ] Monitor logs for errors

## Success Criteria
- ✅ All quality checks pass
- ✅ No critical issues from reviews
- ✅ Clean merge to main with proper tag
- ✅ Build succeeds on main branch
- ✅ All documentation updated
- ✅ Deployment checklist ready

## Rollback Plan
If issues arise post-release:
```bash
# Quick rollback to previous release
git checkout main
git reset --hard <previous-tag>
git push --force-with-lease origin main
```

## Common Issues & Solutions

### Linting Errors
- **Auto-fix**: Try `npm run lint:fix` first
- **Manual fixes**: Focus on production code first, tests can be addressed later
- **Type errors in tests**: Can use `--no-lint` flag for production build if needed

### Build Failures
- **ENV validation**: Use `SKIP_ENV_VALIDATION=true` for local builds
- **Memory issues**: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
- **Module errors**: Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Git Conflicts
- **Dev-Main divergence**: Rebase dev on main first: `git rebase main`
- **Tag conflicts**: Use `git tag -d <tag>` locally, then recreate
- **Protected branch**: Ensure you have push permissions to main

### PM2 Issues
- **Services not starting**: Check logs with `pm2 logs`
- **Port conflicts**: Ensure port 3000 is free: `lsof -i :3000`
- **Ecosystem file**: Validate with `pm2 start ecosystem.config.js --dry-run`

## Context
- Dev branch: Active development
- Main branch: Release-ready code
- Versioning: Semantic (vX.Y.Z)
- Environment: Single dev on port 3000
- App URL: http://100.96.166.53:3000/reader
- PM2 Services: rss-reader-dev, rss-sync-cron
- Database: Supabase PostgreSQL
- CI/CD: Manual process with PM2
