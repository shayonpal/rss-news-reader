---
description: Commit and push changes to the repository with comprehensive validation and my approval
argument-hint: [commit-message or linear-issue-id]
---

# Commit and Push Changes

Commit and push changes to the repository after ensuring all quality checks pass and documentation is updated, especially CHANGELOG.md.

## 1. Pre-Commit Validation

### Check Git Status
```bash
# Check current branch and changes
git status
git diff --stat

# Ensure we're on the correct branch
git branch --show-current
```

If on `main`:
- **STOP** and ask if I really want to commit directly to main
- Suggest creating a feature branch first

### Verify Linear Issue (if provided)
If $ARGUMENTS contains "RR-" pattern:
1. Use Linear MCP server to verify issue exists
2. Check issue is in Done status
3. Extract issue details, including comments, for commit message context

## 2. Quality Checks

Run all quality checks before committing:

### Code Quality
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm test

# Build verification
npm run build
```

If any checks fail:
- 🛑 **STOP** - Do not commit
- Show me the errors
- Ask if I want to fix them first or commit anyway

### Documentation Review

Check if changes require documentation updates:

1. **CHANGELOG.md**:
   - Review recent changes
   - Check if CHANGELOG reflects current work
   - If missing entries:
     ```markdown
     ## [Unreleased]
     
     ### Added/Changed/Fixed/Security
     - Description of changes (RR-XXX)
     ```

2. **Technical Documentation**:
   - API docs for endpoint changes
   - Architecture docs for structural changes
   - Deployment docs for config changes
   - README for major features

If documentation is outdated:
- List what needs updating
- Ask if I want to update docs before committing

## 3. Commit Message Preparation

### Parse Commit Intent
From $ARGUMENTS, determine:
- If it's a Linear issue reference → fetch title and create conventional commit
- If it's a custom message → use as provided
- If empty → generate from staged changes

### Conventional Commit Format
```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests
- `chore`: Maintenance tasks
- `build`: Build system changes
- `ci`: CI configuration changes

### Generate Commit Message
Based on changes:
1. Analyze staged files to determine type and scope
2. Create concise subject line (50 chars max)
3. Add body if needed (wrap at 72 chars)
4. Reference Linear issue if applicable: `Fixes RR-XXX`

Example:
```
feat(sync): implement bi-directional sync for read states

- Add sync queue processing for read/unread states
- Update sync metadata tracking
- Handle conflict resolution with server timestamp

Fixes RR-123
```

## 4. Commit Confirmation

Present commit summary:
```
📝 Ready to Commit:

Branch: feature/sync-improvements
Changes: 12 files (+245, -89)

Commit Message:
--------------
[Generated message here]
--------------

Quality Checks:
✅ Type check: Passing
✅ Linter: Passing
✅ Tests: All passing
✅ Build: Successful

Documentation:
✅ CHANGELOG.md: Updated
⚠️ API docs: May need update

Proceed with commit? (yes/no/edit)
```

Wait for my response:
- `yes` → Proceed to commit
- `no` → Cancel operation
- `edit` → Let me modify the commit message

## 5. Execute Commit

After I approve:

```bash
# Stage all changes (or specific files if requested)
git add -A

# Commit with the message
git commit -m "commit message here"

# Show commit details
git show --stat HEAD
```

## 6. Pre-Push Validation

Before pushing:

### Check Remote Status
```bash
# Fetch latest from remote
git fetch origin

# Check if we're behind
git status -sb

# If behind, show me the situation
git log --oneline HEAD..origin/$(git branch --show-current)
```

If branch is behind:
- Explain the situation
- Ask if I want to:
  1. Pull and merge/rebase first
  2. Force push (dangerous!)
  3. Cancel and handle manually

### Verify CI Requirements
Check if the project has:
- Required PR checks
- Protected branch rules
- CI/CD pipeline requirements

Remind me if this push will trigger:
- Automated tests
- Deployment pipelines
- Other CI workflows

## 7. Push Confirmation

Present push summary:
```
🚀 Ready to Push:

Branch: feature/sync-improvements
Remote: origin
Commits: 3 new commits

Latest commit:
[commit hash] feat(sync): implement bi-directional sync

This will:
- Push to origin/feature/sync-improvements
- Trigger CI pipeline
- Be ready for PR creation

Proceed with push? (yes/no)
```

## 8. Execute Push

After I confirm:

```bash
# Push to remote
git push origin $(git branch --show-current)

# If new branch, set upstream
git push -u origin $(git branch --show-current)

# Show push result
git log --oneline -5
```

## 9. Post-Push Actions

After successful push:

### Create Pull Request (if feature branch)
Ask: "Would you like me to create a Pull Request for this branch?"

If yes:
```bash
# Use GitHub CLI to create PR
gh pr create --title "Title from commit" --body "Description"
```

### Update Linear
If Linear issue was referenced:
1. Use Linear MCP server to:
   - Add comment about code being pushed
   - Update status if appropriate
   - Link to PR if created

### Final Summary
```
✅ Successfully Committed and Pushed!

Commit: [hash] commit message
Branch: feature/sync-improvements
Remote: origin

Next steps:
- Create PR: gh pr create
- View on GitHub: [URL]
- Update Linear: RR-XXX

Anything else needed?
```

## Important Notes

- Always run quality checks before committing
- Never force push without explicit permission
- Keep commit messages clear and conventional
- Update documentation before committing
- Reference Linear issues when applicable
- Wait for my confirmation at key steps
- Protect main/master branches from direct commits

Remember: Good commits tell a story. Each commit should be atomic, tested, and well-documented.
