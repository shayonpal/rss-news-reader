# Console Log Audit - Pre-commit Hook

## Overview

The RSS News Reader project includes an automated console log audit system that runs as part of the pre-commit hook. This prevents accidental console.log statements from being committed to the repository while allowing them during development.

## How It Works

The audit system:

- ✅ **Runs automatically** when `git commit` is executed (including via git-expert agent)
- ✅ **Only checks staged changes** - ignores existing console.log statements in unchanged code
- ✅ **Blocks problematic statements** - prevents commits with new console.log/debug/info/trace
- ✅ **Allows legitimate logging** - permits console.error and console.warn in production code
- ✅ **Ignores comments** - doesn't block console.log mentioned in comments or strings

## What Gets Blocked

The hook will **block commits** containing new lines with:

- `console.log(...)`
- `console.debug(...)`
- `console.info(...)`
- `console.trace(...)`

## What's Allowed

The hook **allows commits** with:

- `console.error(...)` - for legitimate production error logging
- `console.warn(...)` - for production warnings
- `console.log` in comments (`// console.log was used here`)
- `console.log` in existing unchanged code (even if the file is modified)

## Example Scenarios

### ❌ Blocked - New console.log statement

```javascript
// Your staged changes include:
+ console.log("Debug info"); // This will block the commit
+ const newFeature = "implementation";
```

### ✅ Allowed - Existing console.log, no new ones

```javascript
// File has existing console.log but you're only adding:
+ const newFeature = "implementation"; // This commit is allowed
  console.log("Old debug from months ago"); // Unchanged, ignored
```

### ✅ Allowed - Comment mentioning console.log

```javascript
+ // TODO: Remove console.log statements before production
+ const newFeature = "implementation";
```

### ✅ Allowed - Production error logging

```javascript
+console.error("Critical error occurred:", error); // Production logging OK
+console.warn("Deprecation warning"); // Production warning OK
```

## Integration Points

### Pre-commit Hook Integration

Located in `.git/hooks/pre-commit`, the audit runs:

1. After type-check, lint, and format validation
2. Before OpenAPI documentation validation
3. As part of existing validation flow (doesn't slow down commits)

### Claude Code Workflow Integration

When using the `09-commit-push.md` workflow command:

1. git-expert agent executes `git commit`
2. Pre-commit hook automatically runs console log audit
3. Commit is blocked if new console statements found
4. Clear error message explains what needs to be fixed

## Production Log Removal

While the pre-commit hook prevents new debug logs, production builds automatically remove console statements via:

**Next.js SWC Compiler** (recommended for this project):

```javascript
// next.config.mjs
module.exports = {
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] } // Keep errors and warnings
        : false, // Keep all logs in development
  },
};
```

## Troubleshooting

### Hook Not Running

If commits aren't being audited:

```bash
# Check if hook exists and is executable
ls -la .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit  # If needed
```

### False Positives

If the hook incorrectly blocks a commit:

1. Check if the console statement is in a comment (should be ignored)
2. Verify you're not adding new console.log statements
3. Use console.error or console.warn for legitimate production logging

### Bypassing the Hook (Emergency)

For emergency commits (not recommended):

```bash
git commit --no-verify -m "Emergency fix"
```

## Technical Implementation

The audit logic in `.git/hooks/pre-commit`:

```bash
# Check staged JavaScript/TypeScript files only
for file in $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx|ts|tsx)$'); do
    # Match console statements, excluding comments and existing code
    CONSOLE_COUNT=$(git diff --cached "$file" | grep "^+" | grep -v -E "^\s*\+.*(/\*|\*/|//)" | grep -c -E "console\.(log|debug|info|trace)\s*\(")
done
```

This ensures only new, non-comment console statements trigger the audit failure.

## Benefits

1. **Development Freedom**: Use console.log freely during development
2. **Production Quality**: Prevents debug logs from reaching production
3. **Zero Configuration**: Works automatically with existing workflow
4. **Selective Blocking**: Only prevents problematic statements, not legitimate logging
5. **Integration**: Works seamlessly with Claude Code git-expert agent

## Related Documentation

- [Pre-commit Hook Configuration](./pre-commit-hooks.md)
- [Development Workflow](./development-workflow.md)
- [Code Quality Standards](./code-quality.md)
