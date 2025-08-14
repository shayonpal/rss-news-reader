# Deployment Documentation

This directory contains all documentation related to deploying, configuring, and maintaining the RSS News Reader dev server on the Mac Mini (Tailscale-only access).

## Documents

### automatic-sync.md

- **Description**: Configuration and setup for automatic feed synchronization using PM2 and cron jobs
- **Status**: Current ✅
- **Contents**: Cron schedule (6x daily: 2, 6, 10, 14, 18, 22 Toronto time), PM2 configuration, sync process details

### environment-variables.md

- **Description**: Environment variables used by the dev server and supporting jobs
- **Status**: Current ✅
- **Contents**: Database credentials, API keys, server configuration, feature flags

### tailscale-monitoring.md

- **Description**: Tailscale network configuration and monitoring setup for secure access
- **Status**: Current ✅
- **Contents**: Access control, network topology, monitoring endpoints

## Deployment Architecture

### Current Setup

- **URL**: http://100.96.166.53:3000/reader
- **Process Manager**: PM2 with ecosystem.config.js
- **Startup**: macOS LaunchAgent → startup-sequence.sh → PM2
- **Access Control**: Tailscale network only (no public access)
- **Database**: Supabase (PostgreSQL)
- **Token Storage**: `~/.rss-reader/tokens.json` (server-side only)

### PM2 Services (Dev Only)

1. **rss-reader-dev** (port 3000) - Main Next.js dev server
2. **rss-sync-cron** - Automatic Inoreader sync scheduler (cron-driven)
3. **rss-sync-server** (port 3001) - Bi-directional sync background service
4. **rss-services-monitor** - Local monitor that watches app/sync health
5. **kuma-push-monitor** - Uptime Kuma push daemon (local metrics)

## Related Documentation

- **Health Monitoring**: See `/docs/tech/uptime-kuma-setup.md` for monitoring configuration
- **API Configuration**: See `/docs/api/server-endpoints.md` for endpoint details
- **Known Issues**: See `/docs/tech/known-issues.md` for production considerations

## Quick Commands

```bash
# Check all services
pm2 list

# Restart main app
pm2 restart rss-reader-dev

# View logs
pm2 logs rss-reader-dev --lines 100

# Save PM2 state
pm2 save --force
```
