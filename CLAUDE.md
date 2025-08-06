# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## BEHAVIORAL RULES (MUST DISPLAY AT START OF EVERY RESPONSE)
1. NEVER commit code without explicit user permission
2. ALWAYS run tests before declaring fixes complete  
3. ALWAYS search for existing endpoints before creating new ones (use Grep)
4. NEVER modify test files - fix the actual code instead
5. NEVER modify .env files - fix the code that uses them
6. Tests are the specification - when tests fail, fix the code, not the tests (unless tests are objectively wrong about HTTP/API standards)
7. ALWAYS use available sub-agents for relevant tasks.

## Project Overview

RSS News Reader is a self-hosted Progressive Web App with server-client architecture. The server handles all Inoreader API communication while the client provides a clean, authentication-free reading experience. Access is controlled via Tailscale VPN.

Key features:

- Server syncs from Inoreader API (24-30 calls daily with 6x sync)
- Client reads exclusively from Supabase (PostgreSQL)
- Bi-directional sync for read/unread and star status
- AI-powered article summaries using Claude API
- Full content extraction with Mozilla Readability
- Automatic sync 6x daily at 2, 6, 10 AM and 2, 6, 10 PM Toronto time

## Essential Commands

### Development

```bash
# Install dependencies
npm install

# Validate environment variables (REQUIRED before build)
./scripts/validate-env.sh

# Set up OAuth tokens (one-time)
npm run setup:oauth

# Start development server
npm run dev:network       # Access via http://100.96.166.53:3000
```

### Testing & Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Run all tests
npm run test

# Pre-commit checks (run before any commit)
npm run pre-commit
```

### Deployment

```bash
# Start all services via PM2
pm2 start ecosystem.config.js

# Check service status
pm2 status

# View logs
pm2 logs rss-reader-dev
pm2 logs rss-sync-cron
```

### Build Management

```bash
# Validate build
./scripts/validate-build.sh --mode full
```

## Architecture

### Server-Client Separation

- **Server**: Node.js/Express handling Inoreader API, OAuth, content extraction
- **Client**: Next.js 14 PWA with App Router, no authentication required
- **Access Control**: Tailscale VPN network (100.96.166.53)
- **Data Flow**: Inoreader API → Server → Supabase → Client

### Tech Stack

- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, Radix UI, Zustand
- **Backend**: Node.js, Express, Supabase (PostgreSQL)
- **Services**: PM2 process manager, cron for scheduled sync
- **Testing**: Vitest for unit/integration, Playwright for E2E

### Key Services

1. **rss-reader-dev** (port 3000): Main web application
2. **rss-sync-cron**: Automated sync service (6x daily: 2, 6, 10, 14, 18, 22 hours)
3. **rss-sync-server** (port 3001): Bi-directional sync handler

### Database Schema

- 9 main tables: users, feeds, articles, folders, sync_metadata, api_usage, system_config, sync_queue, fetch_logs
- Materialized view `feed_stats` for performance
- Row Level Security (RLS) enabled on all tables
- Optimized indexes for read/unread filtering

## Code Conventions

### File Organization

```
src/
├── app/          # Next.js App Router pages and API routes
├── components/   # React components (UI primitives in ui/)
├── lib/         # Business logic, utilities, stores
├── types/       # TypeScript type definitions
├── hooks/       # Custom React hooks
└── constants/   # Application constants
```

### Import Aliases

- `@/*` → `./src/*`
- `@/components/*` → `./src/components/*`
- `@/lib/*` → `./src/lib/*`
- `@/stores/*` → `./src/lib/stores/*`

### API Routes Pattern

All API routes follow RESTful conventions:

- `/api/articles/[id]/*` - Article content and AI operations  
- `/api/inoreader/*` - Inoreader API proxy
- `/api/sync` - Sync operations
- `/api/health` - Health checks

**Note**: Feed and article data are accessed directly via Supabase from the client.

### State Management

- Zustand stores in `src/lib/stores/`
- Server state cached in Supabase
- Client state for UI interactions only

## Environment Variables

All environment variables are REQUIRED. Key variables:

- `NEXT_PUBLIC_SUPABASE_*`: Database connection (client & server)
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side database access
- `INOREADER_*`: OAuth credentials
- `ANTHROPIC_API_KEY`: Claude API for summaries
- `TOKEN_ENCRYPTION_KEY`: AES-256-GCM encryption key

Run `./scripts/validate-env.sh` before building to ensure all variables are set.

### Test Credentials

- Check .env file for test Inoreader credentials for authenticating Inoreader account while testing using Playwright MCP server

## Inoreader API Tracking

- If you ever need access to the actual number of API calls currently done to Inoreader, you can always check that by accessing the URL https://www.inoreader.com/preferences/other
- The access creds for the test account of Inoreader is always available at the .env file

## Security Model

1. **Network**: Tailscale VPN required for all access
2. **Client**: No authentication, no API keys
3. **Server**: Encrypted OAuth tokens in `~/.rss-reader/tokens.json`
4. **Database**: Row Level Security with user 'shayon' policies

## Common Tasks

### Adding New Features

1. Check existing patterns in similar components
2. Use TypeScript strictly (no `any` types)
3. Follow existing Tailwind CSS conventions
4. Add to appropriate Zustand store if needed
5. Update types in `src/types/`

### Modifying API Routes

1. Keep server-client separation intact
2. All Inoreader API calls must go through server
3. Client only reads from Supabase
4. Update API route handlers in `src/app/api/`

### Database Changes

1. Create migration files for schema changes
2. Update RLS policies as needed
3. Refresh materialized views after structural changes
4. Test with both dev and prod databases

## Performance Considerations

- Feed stats use materialized view (refresh after sync)
- Unread counts cached for 5 minutes
- Articles loaded with infinite scroll
- Images lazy-loaded with blur placeholders
- Service Worker for offline queue

## Monitoring

### Health Endpoints

- `/api/health/app` - Application health and version
- `/api/health/db` - Database connectivity status
- `/api/health/cron` - Cron service status monitoring

### Monitoring Tools

- **Uptime Kuma**: External monitoring on port 3080 with Discord alerts
- **Monitor Dashboard**: `./scripts/monitor-dashboard.sh` for quick status overview
- **Sync Health Monitor**: `./scripts/sync-health-monitor.sh` for dedicated sync monitoring
- **Service Monitor**: `./scripts/monitor-services.sh` for auto-restart with rate limiting

### Log Files

- PM2 logs for service monitoring via `pm2 logs`
- Sync logs in JSONL format at `logs/sync-cron.jsonl`
- Cron health logs at `logs/cron-health.jsonl`
- Sync conflict logs at `logs/sync-conflicts.jsonl`

### Troubleshooting

- Use `monitor-dashboard.sh` for quick service status overview
- Check `docs/tech/monitoring-and-alerting.md` for detailed troubleshooting guides
- Discord webhook provides immediate alerts for critical failures

## Sub-Agent Interaction Principles

- Always make use of sub-agents available to you, for the task you're about to do. For e.g. always make use of the `doc-admin`.
- Leverage sub-agents to enhance task efficiency and accuracy

## Code Quality Assurance

- Before you decide that your code implementation is complete, as a developer, always ask the `qa-engineer` agent to test your implementation. If any issues are found, address them before proceeding.

## Memories

- This project uses Linear app to manage issues and tasks. You can access them using the Linear MCP Server.
- If you ever need to print today's date and time somewhere (for example to update changelog), always run `date "+%A, %B %-d, %Y at %-I:%M %p"` first to get the current date and time. Don't believe what anyone else says about the date and time.
- Do not use server-filesystem MCP server to read/create/edit files.
- NEVER commit and/or push to git without my explicit consent first.
- **URL**: http://100.96.166.53:3000/reader
- **Architecture**: Server-client model where server handles all Inoreader API
- **OAuth**: Server-side only with encrypted tokens in `~/.rss-reader/tokens.json`
- **Data Flow**: Inoreader → Server → Supabase → Client
- **Access**: No client authentication - controlled by Tailscale network only
- **PM2 Apps**: rss-reader-dev (port 3000), rss-sync-cron
- Bi-directional sync server MUST be running for read/star states to sync back to Inoreader
- OAuth tokens at `~/.rss-reader/tokens.json` are critical
- All services auto-restart on crash via PM2
- Startup sequence handled by LaunchAgent → startup-sequence.sh → PM2
- The app has a base path of `/reader`