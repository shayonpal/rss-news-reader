# Release Process (Dev-only environment)

This project currently runs only as a development server on a Tailscale-protected Mac Mini. There is no production deployment. The `main` branch is used to host stable code (releases), and the `dev` branch is used for active development and staging.

## Branch Strategy

- `dev`: Active development and staging (the machine runs this branch)
- `main`: Stable releases only (no server attached)

## Versioning

- Use semantic versioning tags: `v0.X.Y`
- Keep `CHANGELOG.md` up to date for each release

## Checklist before releasing

- All tests pass: `npm test`
- Type check/lint clean: `npm run type-check && npm run lint`
- PM2 services healthy (no errors in logs)
- `CHANGELOG.md` updated with notes for the new version

## Steps

```bash
# 1) Ensure dev has all desired changes
git checkout dev
git pull origin dev

# 2) Update CHANGELOG.md with the new version and notes
#    (optional) bump version in package.json if you track versions there

# 3) Merge dev → main
git checkout main
git pull origin main
# Use a merge commit to preserve release history
git merge --no-ff dev -m "release: v0.X.Y"

# 4) Tag the release
git tag -a v0.X.Y -m "release: v0.X.Y"

# 5) Push main and the tag
git push origin main
git push origin v0.X.Y

# 6) (Optional) Create a GitHub Release from the tag
#    - Title: v0.X.Y
#    - Body: paste notes from CHANGELOG.md

# 7) Switch back to dev to continue work
git checkout dev
```

Notes:
- No deployment step is needed (no production server). The dev machine continues running the PM2-managed dev services on `dev`.
- If you need to hotfix `main`, branch from `main`, apply the fix, tag a patch release, and merge back into `dev`.


