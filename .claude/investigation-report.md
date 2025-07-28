# Investigation Report: Agent and Command Updates Needed

Generated on: July 28, 2025

## Summary of Findings

### 1. Playwright MCP References (pm-17)
**Files that need updating:**
- `devops-expert.md` - Has extensive playwright MCP tools
- `qa-engineer.md` - Has extensive playwright MCP tools, but also mentions direct Playwright as preferred
- `ux-engineer.md` - Has extensive playwright MCP tools
- `analyze-todo.md` - May reference playwright testing

**Action needed:** Remove playwright MCP tools and update instructions to use direct Playwright npm package

### 2. Excessive Tool Access (pm-18)
**Agents with excessive tools:**
- `devops-expert.md` - Has 32+ MCP tools including all playwright and filesystem tools
- `qa-engineer.md` - Has 30+ MCP tools including all playwright tools
- `ux-engineer.md` - Has 30+ MCP tools including all playwright and filesystem tools
- `git-expert.md` - Has NotebookRead/Edit which seems unnecessary
- `doc-admin.md` - Has ExitPlanMode which seems unnecessary
- `sync-reliability-monitor.md` - Has ExitPlanMode which seems unnecessary

**Recommended minimal toolsets:**
- Most agents only need: Bash, Glob, Grep, LS, Read, TodoWrite
- Doc-admin needs: + Edit, MultiEdit, Write
- Supabase-dba/sync-monitor need: + Supabase MCP tools
- Git-expert needs: + Task (to call doc-admin)
- Program-manager needs: + Linear MCP tools

### 3. Shipped-todos.md References (pm-23)
**Files that need updating:**
- `doc-admin.md` - References moving TODOs to shipped-todos.md
- `release-manager.md` - Mentions verifying TODOs moved to shipped-todos.md
- `analyze-todo.md` - Old command that analyzes TODO.md (needs archiving)
- `cleanup-todos.md` - Manages TODO.md files
- `get-project-context.md` - References TODO.md
- `impactful-task.md` - Old command for TODO selection (needs archiving)
- `investigate-server-crashes.md` - May reference TODO tracking
- `quick-win-task.md` - Old command for TODO selection (needs archiving)

**Action needed:** Remove all references to shipped-todos.md and TODO.md file-based tracking

### 4. Tailscale Network Context (pm-27)
**Files that already have Tailscale context:**
- `devops-expert.md` - Mentions Tailscale
- `program-manager.md` - References 100.96.166.53
- `qa-engineer.md` - Has extensive network context
- `release-manager.md` - References production URL
- `sync-reliability-monitor.md` - Has network URLs
- `investigate-server-crashes.md` - Has network context
- `prepare-for-release.md` - Has production URL

**Files that might need Tailscale context added:**
- `supabase-dba.md` - For database access context
- `ux-engineer.md` - For testing on actual network

## Detailed Analysis

### Agents Needing Major Updates

#### 1. devops-expert.md
- Remove all playwright MCP tools
- Remove filesystem MCP tools (use built-in Read/Write)
- Add explicit Tailscale network management context

#### 2. qa-engineer.md
- Remove all playwright MCP tools (already prefers direct Playwright)
- Remove filesystem MCP tools
- Keep only essential tools for testing

#### 3. ux-engineer.md
- Remove all playwright MCP tools
- Remove filesystem MCP tools
- Add Tailscale network context for testing

#### 4. doc-admin.md
- Remove ExitPlanMode tool
- Remove all shipped-todos.md references
- Update workflow to use Linear instead

### Commands Needing Updates/Archival

#### To Archive (pm-10):
- `analyze-todo.md` - Replaced by /analyze
- `quick-win-task.md` - Replaced by /next-task
- `impactful-task.md` - Replaced by /next-task

#### To Update:
- `cleanup-todos.md` - Update for new workflow
- `get-project-context.md` - Remove TODO.md references
- `investigate-server-crashes.md` - Update if needed

## Recommended Update Order

1. **First Wave - Tool Cleanup:**
   - Update devops-expert, qa-engineer, ux-engineer tools
   - Update git-expert, doc-admin, sync-reliability-monitor tools

2. **Second Wave - Content Updates:**
   - Remove shipped-todos.md references from all files
   - Add Tailscale context where missing

3. **Third Wave - Archive Old Commands:**
   - Move old commands to legacy folder
   - Update any remaining references

## Notes

- The program-manager agent is well-designed with appropriate tools
- The release-manager has already been updated and has minimal tools
- Some agents may legitimately need web search tools (keep those)