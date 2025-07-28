# RSS Reader Claude Code Hooks

## Smart File Protection & Agent Router Hook

### Overview

This hook intercepts file operations and tool usage to:
1. **Protect critical files** - Requires explicit permission before modifying sensitive files
2. **Route to specialized agents** - Automatically delegates tasks to the appropriate expert agent
3. **Prevent accidental mistakes** - Blocks dangerous operations like uncommitted changes

### Protected Files

The following files require explicit permission before modification:

| File/Pattern | Why Protected |
|--------------|---------------|
| `.env` | Contains all API keys, database credentials, and secrets |
| `ecosystem.config.js` | PM2 configuration - controls all production services |
| `*/LaunchAgents/*` | System startup files - auto-start services on boot |
| `~/.rss-reader/tokens.json` | OAuth tokens for Inoreader authentication |

### Agent Routing Rules

Operations are automatically routed to specialized agents:

| Operation Type | Routes To | Examples |
|----------------|-----------|----------|
| Markdown files (*.md, *.mdx) | `doc-admin` | README.md, CHANGELOG.md |
| Git write operations | `git-expert` | push, merge, rebase, tag |
| Database operations | `supabase-dba` | migrations, SQL queries, schema changes |
| Any Supabase MCP tool | `supabase-dba` | mcp__supabase__execute_sql |

### Special Rules

1. **Git Commits** - Always blocked, requires explicit user permission
2. **Environment Variables** - Warns when editing .env (fix code instead of changing var names)
3. **Database Operations** - Automatically routed to supabase-dba for expertise

### Hook Decisions

The hook can return these decision types:

| Decision | Meaning | Claude's Behavior |
|----------|---------|-------------------|
| `allow` | Operation permitted | Continues normally |
| `block` | Operation forbidden | Stops and explains why |
| `route_to_agent` | Delegate to specialist | Launches specified agent |
| `request_permission` | Needs user approval | Asks user before proceeding |
| `warn` | Caution advised | Shows warning but continues |

### Testing the Hook

Run the test script to verify the hook is working:

```bash
/Users/shayon/DevProjects/rss-news-reader/.claude/hooks/test-hook.sh
```

### Modifying the Hook

To add new rules or modify existing ones:

1. Edit `/Users/shayon/DevProjects/rss-news-reader/.claude/hooks/file-protection-router.sh`
2. Add new patterns to the relevant functions:
   - `is_critical_file()` - Add files needing protection
   - `is_git_operation()` - Add git command patterns
   - `is_db_operation()` - Add database command patterns
   - `is_markdown_file()` - Add documentation file patterns

3. Test your changes with the test script
4. Restart Claude Code for changes to take effect

### Example Hook Response

When Claude tries to edit a protected file:
```json
{
  "decision": "request_permission",
  "reason": "Critical file modification requires explicit permission: .env",
  "severity": "high"
}
```

When Claude tries to run a database migration:
```json
{
  "decision": "route_to_agent",
  "agent": "supabase-dba",
  "reason": "Database operations should be handled by supabase-dba agent"
}
```

### Troubleshooting

If the hook isn't working:
1. Check if the script is executable: `ls -la .claude/hooks/`
2. Verify the hook is registered in `~/.claude/settings.json`
3. Check Claude Code logs for any error messages
4. Run the test script to isolate issues

## Code Quality Enforcer Hook

### Overview

This hook automatically triggers after code file edits to ensure code quality standards are maintained. It reminds Claude to run quality checks and engage the QA engineer for comprehensive testing.

### When It Triggers

The hook activates on `PostToolUse` events when:
- The Edit or MultiEdit tool is used
- The modified file is a TypeScript or JavaScript file (*.ts, *.tsx, *.js, *.jsx)
- The file path contains `/src/` (indicating source code)

### Quality Checks Performed

When triggered, the hook reminds Claude to:

1. **Type Checking** - Run `npm run type-check` to catch TypeScript errors
2. **Linting** - Run `npm run lint` to ensure code style compliance
3. **QA Review** - Suggests calling the `qa-engineer` agent at feature completion (not after every file edit)

### Special Handling

#### API Route Duplication Check
For files in `/api/` directories, the hook specifically checks for:
- Duplicate route handlers
- Conflicting endpoints
- Proper HTTP method handling

#### Environment Variables Reminder
The hook warns about:
- Hardcoded values that should be environment variables
- Missing environment variable validation
- Insecure credential handling

### Hook Response Example

When Claude edits a TypeScript file:
```json
{
  "decision": "allow",
  "recommendation": "Run type-check and lint, then call qa-engineer",
  "checks": ["npm run type-check", "npm run lint"],
  "followUp": "qa-engineer"
}
```

### Benefits

1. **Consistent Quality** - Ensures all code changes meet project standards
2. **Early Error Detection** - Catches issues before they reach production
3. **Automated Workflow** - No need to remember quality checks manually
4. **Comprehensive Testing** - QA engineer provides additional validation

### Customization

To modify the hook behavior:

1. Edit `/Users/shayon/DevProjects/rss-news-reader/.claude/hooks/code-quality-enforcer.sh`
2. Adjust file patterns or add new check types
3. Modify the response recommendations
4. Test changes with sample edits

## Feature Completion Detector Hook

### Overview

This hook monitors user prompts to detect when feature implementation is complete. It automatically reminds Claude to run final checks and engage the QA engineer for comprehensive testing before declaring the feature done.

### When It Triggers

The hook activates on `UserPromptSubmit` events when the user's message contains completion indicators such as:
- "I'm done"
- "finished implementing"
- "ready to test"
- "feature is complete"
- "implementation complete"
- "all done"
- "looks good"
- "ready for QA"

### Actions Taken

When feature completion is detected, the hook:

1. **Reminds Claude** to run final quality checks before completion
2. **Suggests comprehensive testing** - Type checking, linting, and build validation
3. **Prompts QA review** - Explicitly calls for the `qa-engineer` agent
4. **Ensures nothing is missed** - Prevents premature feature completion

### Trigger Phrases

The hook looks for various completion indicators including:
- Direct statements: "done", "finished", "complete", "completed"
- Testing readiness: "ready to test", "ready for testing", "ready for QA"
- Approval phrases: "looks good", "ship it", "LGTM"
- Implementation confirmations: "implemented", "built", "created"

### Hook Response Example

When the user says "I think we're done with this feature":
```json
{
  "decision": "allow",
  "reminder": "Feature appears complete. Run final checks before confirmation.",
  "suggestedActions": [
    "npm run type-check",
    "npm run lint",
    "npm run build",
    "Call qa-engineer for comprehensive testing"
  ]
}
```

### Benefits

1. **Prevents Premature Completion** - Ensures all quality checks are run
2. **Consistent QA Process** - Every feature gets proper testing
3. **Catches Last-Minute Issues** - Final checks often reveal edge cases
4. **Professional Workflow** - Matches industry-standard completion processes

### Customization

To modify completion detection:

1. Edit `/Users/shayon/DevProjects/rss-news-reader/.claude/hooks/feature-completion-detector.sh`
2. Add new trigger phrases to the detection patterns
3. Adjust the suggested actions list
4. Test with various completion phrases

## Commit & Push Detector Hook

### Overview

This hook monitors user prompts to detect when the user explicitly requests a git commit and push operation. It automatically routes these requests to the `git-expert` agent with explicit permission to bypass the usual git commit blocking rules.

### When It Triggers

The hook activates on `UserPromptSubmit` events when the user's message contains commit & push indicators such as:
- "commit & push" or "c&p"
- "commit and push"
- "git commit and push"
- "commit then push"
- "push my changes"
- "commit all changes and push"

### How It Works

When a commit & push request is detected:

1. **Detects Intent** - Recognizes the user's explicit request to commit and push
2. **Routes to git-expert** - Delegates the operation to the specialized git agent
3. **Grants Permission** - Provides explicit permission flag to bypass commit blocking
4. **Ensures Compliance** - The git-expert still follows all safety checks

### Permission System

The hook uses a special permission mechanism:
- Normal git commits are blocked by default (requires user permission)
- When this hook detects explicit commit & push requests, it sets `"explicit_permission": true`
- The git-expert agent recognizes this flag and proceeds with the commit
- This ensures commits only happen when explicitly requested by the user

### Trigger Phrases

The hook recognizes various commit & push patterns:
- Abbreviations: "c&p", "c & p"
- Full phrases: "commit and push", "commit & push"
- Action requests: "push my changes", "push these changes"
- Git commands: "git commit and push", "do a commit and push"

### Hook Response Example

When the user says "c&p these changes please":
```json
{
  "decision": "route_to_agent",
  "agent": "git-expert",
  "reason": "User requested commit & push operation",
  "context": {
    "explicit_permission": true,
    "operation": "commit_and_push",
    "user_request": "c&p these changes please"
  }
}
```

### Benefits

1. **Streamlined Workflow** - One command for commit and push
2. **Explicit Control** - Commits only happen when requested
3. **Expert Handling** - Git operations handled by specialized agent
4. **Safety Maintained** - All git best practices still followed

### Customization

To modify commit & push detection:

1. Edit `/Users/shayon/DevProjects/rss-news-reader/.claude/hooks/commit-push-detector.sh`
2. Add new trigger phrases or abbreviations
3. Adjust the routing behavior
4. Test with various commit & push phrases