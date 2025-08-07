---
description: Commit and push changes to the repository after validation.
argument-hint: [linear-issue-id]
---

# Commit and Push Changes

Prepare, validate, and commit changes for Linear issue $ARGUMENTS (or current work if no issue provided).

## Step 1: Context Recovery & Validation

### 1A. Gather Context
If Linear issue provided in $ARGUMENTS:
- Use `linear-expert` to get issue details and status
- Verify issue is in "Done" or ready for commit
- Extract implementation summary from comments

If no Linear issue:
- Use `git-expert` to check staged changes
- Determine if changes require Linear tracking

### 1B. Branch Verification
Ensure we're on the correct branch:

```bash
# Check current branch
git branch --show-current

# Verify we're NOT on main
if [ "$(git branch --show-current)" = "main" ]; then
  echo "❌ ERROR: Cannot commit directly to main branch"
  echo "Switch to dev or feature branch first"
  exit 1
fi
```

**Branch Rules:**
- Primary development: Push to `dev` branch
- Feature work: Push to feature branch, if work was done on a feature branch (e.g., `feature/RR-XXX-description`)
- NEVER push directly to `main` (only via PR/merge from dev)

### 1C. Pre-Commit Checks
Run validation to ensure code is ready:

```bash
# Check what's being committed
git status
git diff --cached

# Run pre-commit checks (REQUIRED)
npm run pre-commit

# Verify no debug code or console.logs
git diff --cached | grep -E "console\.(log|debug|warn|error)" || echo "✅ No console statements"

# Check for sensitive data
git diff --cached | grep -E "(API_KEY|SECRET|TOKEN|PASSWORD)" || echo "✅ No exposed secrets"
```

If any checks fail:
- 🛑 STOP - Fix issues before committing
- Document what needs fixing

## Step 2: Documentation Verification

### 2A. Check CHANGELOG Status
Review if CHANGELOG.md needs updating:
- For features: REQUIRED (Added section)
- For bug fixes: REQUIRED (Fixed section)  
- For refactoring: Optional (Changed section)
- For docs/chores: Usually not needed

If CHANGELOG needs updating and isn't:
- Use `doc-admin` to update CHANGELOG.md with:
  - Current date and time
  - Linear issue reference
  - Clear description of changes
  - User impact

### 2B. Check Other Documentation
Verify if other docs need updates:
- API documentation for new endpoints
- README for new features or setup changes
- Configuration docs for new env vars

## Step 3: Generate Commit Context for git-expert

Prepare comprehensive context for git-expert:

```
Task: Commit and push changes for RR-XXX

Context:
- Linear Issue: [title and description if available]
- Change Summary: [what was implemented]
- Test Status: [confirm tests passed]
- Documentation: [confirm CHANGELOG updated]

Commit Type: [feat|fix|docs|chore]
Breaking Changes: [yes/no with details]

Special Instructions:
- Include Linear reference (RR-XXX) in commit message
- Use conventional commit format
- Stage all relevant files including .claude updates
```

## Step 4: Execute Commit with git-expert

Use `git-expert` agent with full context:
- Provide Linear issue details
- Confirm documentation is updated
- Specify target branch explicitly (dev or feature/RR-XXX)
- Request commit and push operation
- git-expert will handle:
  - Proper commit message format
  - Git hooks compliance
  - Linear reference inclusion
  - Push to specified branch (NOT main)

**Example context for git-expert:**
```
Push to: dev branch (or feature/RR-XXX if on feature branch)
IMPORTANT: Never push to main branch directly
```

## Step 5: Post-Commit Actions

### 5A. Update Linear Issue
If Linear issue was referenced:
- Use `linear-expert` to add comment with commit SHA
- Update status if needed (In Review → Done if all tests passed)
- Note deployment readiness

### 5B. Verify Push Success
Confirm with git-expert response:
- Commit SHA recorded
- Push successful
- No conflicts
- Hooks passed

## Step 6: Final Report

```
✅ Commit Complete for RR-XXX

📝 Commit Details:
- SHA: [commit hash]
- Message: [commit message]
- Files: X changed, Y insertions, Z deletions

📚 Documentation:
- CHANGELOG: ✅ Updated
- Other Docs: [list if updated]

🔗 Linear:
- Issue: RR-XXX
- Status: [current status]
- Ready for: [next step]

🚀 Next Steps:
- [Manual verification if needed]
- [Deployment if ready]
- [Follow-up tasks]
```

## Important Notes

- Never commit without pre-commit checks passing
- Always update CHANGELOG for user-facing changes
- Include Linear reference for significant work
- Let git-expert handle the actual git operations
- Don't duplicate git-expert's validation logic