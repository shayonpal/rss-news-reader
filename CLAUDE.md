# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.
**Most project knowledge is maintained in Serena MCP memories (.serena/memories/)**

## BEHAVIORAL RULES (MUST DISPLAY AT START OF EVERY RESPONSE)

1. NEVER commit code without explicit user permission
2. ALWAYS run tests before declaring fixes complete
3. ALWAYS search for existing endpoints before creating new ones
4. NEVER modify test files - fix the actual code instead
5. NEVER modify .env files - fix the code that uses them
6. Tests are the specification - when tests fail, fix the code, not the tests
7. ALWAYS use available sub-agents for relevant tasks
8. ALWAYS activate Serena MCP at session start: `mcp__serena__activate_project`

## Critical Project Context

**Access**: http://100.96.166.53:3000/reader (Tailscale VPN required)
**Base Path**: All routes MUST use `/reader` prefix
**OAuth Tokens**: Stored at `~/.rss-reader/tokens.json` (never modify directly)
**Sync**: Bi-directional sync server MUST be running (port 3001)

## Serena MCP Usage

**Activate at session start**: Contains all project knowledge in memories:

- `project_overview.md` - Architecture and features
- `tech_stack.md` - Technologies and tools
- `suggested_commands.md` - All development commands
- `code_conventions.md` - Style and patterns
- `task_completion_checklist.md` - Pre-commit requirements
- `project_structure.md` - Directory organization

### Use Serena Instead Of:

- **Read/Grep** → `find_symbol`, `search_for_pattern`, `get_symbols_overview`
- **Edit/Write** → `replace_symbol_body`, `insert_after_symbol`
- **Full file reads** → Navigate to specific symbols

## Environment Variables

All required. Run `./scripts/validate-env.sh` before building.
Key variables stored in `.env` (never commit):

- `NEXT_PUBLIC_SUPABASE_*` - Database
- `INOREADER_*` - OAuth credentials
- `ANTHROPIC_API_KEY` - AI summaries

## Active Issues & Workarounds

### Linear Integration

- Use Linear MCP Server for issue management
- Update issue status when completing work
- Reference issue numbers in commits (e.g., RR-102)

## Sub-Agents

Always use specialized agents when available:

- `doc-admin` - Documentation file operations
- `linear-expert` - Linear API operations
- `db-expert` - Database operations
- `test-expert` - Testing implementation
- `infra-expert` - Infrastructure issues

## Memories

- NEVER commit without explicit permission
- PM2 Apps: rss-reader-dev (3000), rss-sync-cron, rss-sync-server (3001)
- Always run `npm run pre-commit` before declaring complete
- Test credentials in .env for Playwright testing
