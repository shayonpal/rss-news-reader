# Deployment Documentation

This directory contains all documentation related to deploying, configuring, and maintaining the RSS News Reader in production.

## Documents

### automatic-sync.md
- **Description**: Configuration and setup for automatic feed synchronization using PM2 and cron jobs
- **Status**: Current ✅
- **Contents**: Cron schedule (2 AM and 2 PM Toronto time), PM2 ecosystem configuration, sync process details

### caddy-pm2-setup.md
- **Description**: Production-grade PM2 process management configuration with stability improvements
- **Status**: Current ✅ (Updated Saturday, July 26, 2025)
- **Contents**: PM2 ecosystem configuration, stability features, memory management, health check integration

### ci-cd-strategy.md
- **Description**: Continuous integration and deployment strategy including GitHub Actions workflows
- **Status**: Current ✅
- **Contents**: Build validation, test automation, deployment pipelines, rollback procedures

### environment-variables.md
- **Description**: Complete documentation of all environment variables required for production deployment
- **Status**: Current ✅
- **Contents**: Database credentials, API keys, server configuration, feature flags

### tailscale-monitoring.md
- **Description**: Tailscale network configuration and monitoring setup for secure access
- **Status**: Current ✅
- **Contents**: Access control, network topology, monitoring endpoints

## Deployment Architecture

### Current Production Setup
- **URL**: http://100.96.166.53:3147/reader
- **Process Manager**: PM2 with ecosystem.config.js
- **Startup**: macOS LaunchAgent → startup-sequence.sh → PM2
- **Access Control**: Tailscale network only (no public access)
- **Database**: Supabase (PostgreSQL)
- **Token Storage**: `~/.rss-reader/tokens.json` (server-side only)

### PM2 Services
1. **rss-reader-prod** (port 3147) - Production Next.js server
2. **rss-reader-dev** (port 3000) - Development server (optional)
3. **rss-sync-server** (port 3001) - Bidirectional sync service
4. **rss-sync-cron** - Automatic sync scheduler

### PM2 Stability Features (Updated July 26, 2025)
- **Production-grade configuration** with 99%+ reduction in service restarts
- **Conservative memory limits**: 512M for Next.js, 256M for support services
- **Intelligent restart patterns**: Exponential backoff, 50 max restarts
- **Graceful shutdowns**: Service-specific timeout configurations
- **Health check integration**: wait_ready coordination with health endpoints
- **Pre-start validation**: Prevents deployment of broken builds

## Related Documentation

- **Health Monitoring**: See `/docs/tech/uptime-kuma-setup.md` for monitoring configuration
- **API Configuration**: See `/docs/api/server-endpoints.md` for endpoint details
- **Known Issues**: See `/docs/tech/known-issues.md` for production considerations

## Quick Commands

```bash
# Check all services
pm2 list

# Restart production
pm2 restart rss-reader-prod

# View logs
pm2 logs rss-reader-prod --lines 100

# Save PM2 state
pm2 save --force
```