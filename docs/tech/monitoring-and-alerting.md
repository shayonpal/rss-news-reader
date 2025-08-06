# RSS Reader Monitoring and Alerting

## Overview

The RSS Reader uses a multi-layered monitoring approach to ensure sync reliability and prevent stale content issues. This was implemented after a 2-day sync failure (July 26-28, 2025) that went undetected.

## Monitoring Layers

### 1. Uptime Kuma (External Monitoring)

**Access**: http://100.96.166.53:3080 (within Tailscale network)

#### Existing Monitors

- **Production App**: HTTP check every 60s on health endpoint
- **Sync Server**: HTTP check every 60s on port 3001
- **Database**: Health check every 300s
- **Cron Service**: Push monitor expecting heartbeat every 4 hours (6x daily sync)

#### New Sync-Specific Monitors (To Configure)

1. **Sync API Endpoint** - Verify `/reader/api/sync` availability
2. **Article Freshness** - Check if articles are being updated
3. **Sync Success Rate** - Push monitor for successful syncs
4. **Cron Health File** - Monitor cron service health status

### 2. Internal Service Monitor

**Script**: `/scripts/monitor-services.sh`

- Runs every 2 minutes
- Auto-restarts failed services (with rate limiting)
- Sends batched Discord alerts
- Tracks consecutive failures

### 3. Sync Health Monitor

**Script**: `/scripts/sync-health-monitor.sh`

- Dedicated sync monitoring
- Tracks:
  - Consecutive sync failures
  - Time since last successful sync
  - Cron service activity
- Alerts when:
  - 2+ consecutive sync failures
  - No successful sync in 5+ hours (4-hour interval + 1 hour buffer)
  - No sync attempts in 6+ hours (4-hour interval + 2 hour buffer)
  - No new articles in 5+ hours

### 4. Enhanced Cron Service

**Updates to** `src/server/cron.js`:

- Immediate Discord alerts for 404/500 errors
- Uptime Kuma push notifications
- Detailed error logging
- Health file generation

## Health Check Endpoints

### Existing

- `/api/health/app` - Application health
- `/api/health/db` - Database connectivity

### New

- `/api/health/cron` - Cron service status

## Alert Channels

### Discord Webhook

- Immediate alerts for critical failures
- Batched alerts for service issues
- @everyone mentions for critical situations

### Uptime Kuma Dashboard

- Visual monitoring interface
- Historical uptime data
- Response time graphs

## Monitoring Scripts

### Quick Status Check

```bash
./scripts/monitor-dashboard.sh
```

Shows comprehensive status of:

- All services
- PM2 processes
- Sync health
- Recent alerts

### Start Monitoring

```bash
# Start internal monitor
./scripts/monitor-services.sh start

# Start sync health monitor
./scripts/sync-health-monitor.sh daemon

# Both start automatically via startup-sequence.sh
```

### Manual Sync Check

```bash
# Check sync status
./scripts/sync-health-monitor.sh check

# View recent sync logs
tail -20 logs/sync-cron.jsonl | jq .
```

## Troubleshooting Sync Failures

### Common Issues

1. **404 Errors** - API endpoint mismatch

   - Check `NEXT_PUBLIC_BASE_URL` in ecosystem.config.js
   - Verify production app is on port 3147
   - Check API route handlers exist

2. **500 Errors** - Server errors

   - Check OAuth tokens: `~/.rss-reader/tokens.json`
   - Verify Inoreader API limits (100/day)
   - Check server logs: `pm2 logs rss-sync-cron`

3. **No Sync Attempts** - Cron service down
   - Check PM2: `pm2 status rss-sync-cron`
   - Verify cron schedule in ecosystem.config.js
   - Check cron health: `cat logs/cron-health.jsonl | tail -1 | jq`

### Recovery Steps

1. **Immediate Actions**

   ```bash
   # Check all services
   ./scripts/monitor-dashboard.sh

   # Restart sync services
   pm2 restart rss-sync-cron rss-sync-server

   # Manual sync
   curl -X POST http://localhost:3147/reader/api/sync
   ```

2. **Verify OAuth Tokens**

   ```bash
   # Check token file exists
   ls -la ~/.rss-reader/tokens.json

   # Test OAuth (if needed)
   npm run setup:oauth
   ```

3. **Check API Endpoints**

   ```bash
   # Test sync endpoint
   curl -I http://localhost:3147/reader/api/sync

   # Should return 405 (Method Not Allowed) for GET
   ```

## Preventing Future Failures

1. **Monitor Dashboard** - Check daily via `monitor-dashboard.sh`
2. **Discord Alerts** - Respond immediately to sync failures
3. **Uptime Kuma** - Review dashboard for patterns
4. **Log Review** - Weekly check of sync-cron.jsonl
5. **API Testing** - After any deployment, test sync manually

## Configuration Files

- **PM2 Config**: `/ecosystem.config.js` - Service definitions
- **Monitoring Scripts**: `/scripts/monitor-*.sh`
- **Health Endpoints**: `/src/app/api/health/*`
- **Cron Service**: `/src/server/cron.js`

## Future Enhancements

1. **Automated Recovery** - Webhook handler for PM2 restarts
2. **Metrics Dashboard** - Grafana for long-term trends
3. **Predictive Alerts** - Warn before failures occur
4. **Backup Sync** - Fallback sync mechanism
