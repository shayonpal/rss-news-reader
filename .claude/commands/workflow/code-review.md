---
description: Performs comprehensive code review on staged git changes using OpenAI's o3 model for advanced reasoning
args: "[optional: specific focus area like 'security', 'performance', 'architecture', or file path to prioritize]"
---

# o3 Code Review
Review staged git changes using OpenAI o3: $ARGUMENTS

## Execution Steps

### 1. Verify API Key Setup
```bash
# Check if OPENAI_API_KEY is set in environment
grep "export OPENAI_API_KEY" ~/.zshrc || echo "⚠️ OPENAI_API_KEY not found in ~/.zshrc"
# Verify key is loaded in current session
[[ -z "$OPENAI_API_KEY" ]] && echo "❌ OPENAI_API_KEY not set. Add to ~/.zshrc and run: source ~/.zshrc" || echo "✅ API key configured"
```
If API key is not set, inform user to add `export OPENAI_API_KEY="your-key"` to ~/.zshrc

### 2. Stage Current Changes
```bash
git add -A  # Stage all current changes for review
```

### 3. Context Gathering (Parallel)
- `git status` → modified files
- `git diff --cached` → staged changes
- `git log --oneline -5` → recent commits

### 4. Determine Review Focus
Based on change type and $ARGUMENTS:
- **New Feature** → "Architecture fit, completeness, edge cases, integration points"
- **Bug Fix** → "Root cause analysis, regression testing, fix validation"
- **Refactor** → "Code clarity, functionality preservation, performance impact"
- **Performance** → "Optimization effectiveness, benchmarks, trade-offs"
- **Security** → "Vulnerability assessment, input validation, auth checks"
- **Custom from $ARGUMENTS** → Use provided focus area directly

### 5. Execute Review
Call `mcp__code-reviewer__perform_code_review` with:
```javascript
{
  target: "staged",
  taskDescription: // Build from git log and changes context
  llmProvider: "openai",
  modelName: "o3",
  reviewFocus: // From step 3 based on changes or $ARGUMENTS
  projectContext: // Extract from CLAUDE.md and project files
  maxTokens: 32000 // Default, increase if needed
}
```

## Output Format

**Assessment**: Approved | Needs Changes | Major Issues  
**Risk Level**: Low | Medium | High  
**Issues Found**: [count]

### Critical Issues
- Issue description → File:line → Fix required

### Improvements (if any)
**Must Fix**: Blocking issues  
**Should Fix**: Important improvements  
**Consider**: Optional enhancements

### Next Steps
1. Fix critical issues
2. Run tests: `npm run test`
3. Commit with insights from review

## Requirements
- MCP server installed: `@praneybehl/code-review-mcp`
- Environment variable: `OPENAI_API_KEY` must be set
- Must run from git repository root