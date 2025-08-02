# Prepare and Execute Release

I need to prepare a release from `dev` to `main` branch. Since production has been retired, the single development environment (port 3000) serves all traffic.

## Phase 1: Pre-Release Quality Checks
Run these automated checks in parallel on the `dev` branch:
- `npm run type-check`
- `npm run lint` 
- `npm run test` (if tests exist)
- `npm run build` (validate build)
- Check git status for uncommitted changes
- Ensure there are no webpack build corruptions

Stop immediately if any check fails.

## Phase 2: Specialist Reviews
If automated checks pass, use these read-only agents IN PARALLEL for review:
- `test-expert` - Check for bugs, test coverage, and feature completeness
- `db-expert-readonly` - Review database schema, migrations, and performance
- `devops-expert-readonly` - Verify sync pipeline integrity and monitoring

Each agent returns structured data on:
1. Critical issues (release blockers)
2. High-priority concerns
3. Low-priority suggestions

## Phase 3: Release Decision & Creation
Based on the consolidated report, if we decide to proceed:

Use `release-manager` agent to coordinate the release:
1. Update CHANGELOG.md with release notes
2. Determine version bump (patch/minor/major)
3. Create release commit on dev
4. Merge dev → main with --no-ff
5. Create and push release tag (vX.Y.Z)
6. Return to dev branch

## Phase 4: Post-Release Verification
After the release is created:
- Latest tag exists: `git describe --tags`
- Main branch is clean: `git status`
- Release notes are complete in CHANGELOG.md

## Success Criteria
- All quality checks pass
- No critical issues from reviews
- Clean merge to main
- Successful release tag creation

## Context
- Dev branch: Active development
- Main branch: Release-ready code
- Environment: Single dev environment on port 3000
- App URL: http://100.96.166.53:3000/reader
