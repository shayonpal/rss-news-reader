# Prepare and Execute Production Release

I need to prepare a production release from `dev` to `main` branch, then deploy it as a separate step.

## Phase 1: Pre-Release Quality Checks
Run these automated checks in parallel on the `dev` branch:
- `npm run type-check`
- `npm run lint` 
- `npm run test` (if tests exist)
- `npm run build` (validate production build)
- Check git status for uncommitted changes

Stop immediately if any check fails.

## Phase 2: Specialist Reviews
If automated checks pass, invoke these agents IN PARALLEL for read-only review:
- `qa-engineer` - Check for bugs, test coverage, and feature completeness
- `supabase-dba` - Review database schema, migrations, and performance
- `sync-reliability-monitor` - Verify sync pipeline integrity and monitoring

Each agent provides:
1. Critical issues (release blockers)
2. High-priority concerns
3. Low-priority suggestions

## Phase 3: Release Decision & Creation
Based on the consolidated report, if we decide to proceed:

Invoke the `release-manager` agent to:
1. Update CHANGELOG.md via `doc-admin`
2. Determine version bump (patch/minor/major)
3. Create release commit on dev
4. Merge dev → main with --no-ff
5. Create and push release tag (vX.Y.Z)
6. Return to dev branch

**STOP HERE** - Release is created but NOT deployed.

## Phase 4: Pre-Deployment Verification
Before deploying, verify on the `main` branch:
- Latest tag exists: `git describe --tags`
- Main branch is clean: `git status`
- Release notes are complete in CHANGELOG.md
- No .claude directory in production (security check)

## Phase 5: Production Deployment
If everything looks good, invoke the `devops-expert` agent to:
1. Execute `./scripts/deploy-production.sh` which will:
   - Verify we're on main branch
   - Pull latest changes
   - Run quality checks again
   - Build production bundle
   - Reload PM2 with zero downtime
   - Perform health checks
2. Monitor deployment logs
3. Verify production at http://100.96.166.53:3147/reader
4. Return to dev branch

## Phase 6: Post-Deployment Verification
After deployment completes:
- Check PM2 status: `pm2 status`
- Verify health endpoints: `/api/health/app` and `/api/health/db`
- Test manual sync functionality
- Monitor logs for first 5 minutes

## Rollback Plan
If issues arise post-deployment:
1. Document the specific issue
2. Use `devops-expert` to execute rollback:
   - Checkout previous tag
   - Re-run deployment script
   - Verify rollback success

## Success Criteria
- All quality checks pass
- No critical issues from reviews
- Clean merge to main
- Successful deployment with health checks
- No errors in first 5 minutes

## Context
- Dev branch: Staging environment
- Main branch: Production-ready code
- Deployment script: `./scripts/deploy-production.sh`
- Production URL: http://100.96.166.53:3147/reader
