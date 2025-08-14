# Uptime Kuma Monitoring Documentation

## Overview

RSS News Reader uses Uptime Kuma for comprehensive external monitoring of all critical services. This provides an independent monitoring layer that complements the internal PM2 process management and health checks.

## Access Information

- **URL**: http://100.96.166.53:3080
- **Network**: Requires Tailscale VPN connection
- **Container**: Docker container (`uptime-kuma`)
- **Uptime**: Typically runs continuously with high availability

## Monitor Configuration

### HTTP Monitors (Active Polling)

These monitors actively poll health endpoints to verify service availability:

| Monitor                       | URL                                                         | Interval | Keyword Check | Uptime Target |
| ----------------------------- | ----------------------------------------------------------- | -------- | ------------- | ------------- |
| **Sync Server**               | `http://localhost:3001/server/health`                       | 60s      | -             | 99%           |
| **Database**                  | `http://100.96.166.53:3000/reader/api/health/db`            | 60s      | -             | 95%           |
| **Dev App**                   | `http://100.96.166.53:3000/reader/api/health/app?ping=true` | 60s      | -             | 90%           |
| **Bi-directional Sync Queue** | `http://100.96.166.53:3001/server/health`                   | 300s     | `"pending":0` | 95%           |

### Push Monitors (Heartbeat)

These monitors expect to receive periodic heartbeats from the services:

| Monitor                | Push URL                  | Expected Interval | Data Source         | Current Uptime |
| ---------------------- | ------------------------- | ----------------- | ------------------- | -------------- |
| **RSS Sync Cron**      | `.../api/push/RJqSog9FTL` | 14400s (4h)       | Cron job completion | 87.6%          |
| **Sync Status**        | `.../api/push/pTHkU4CS4Y` | 3600s (1h)        | sync-cron.jsonl     | 93.43%         |
| **API Usage**          | `.../api/push/rVHrwub5la` | 3600s (1h)        | Health endpoint     | 46.51%         |
| **Database Health**    | `.../api/push/IPaa8EaXSY` | 600s (10m)        | Server health       | 66.87%         |
| **Fetch Success Rate** | `.../api/push/QTA4U3LMl8` | 1800s (30m)       | Fetch analytics     | 27.04%         |

## Push Monitor Daemon

### Service Details

- **Script**: `/scripts/kuma-push-daemon.sh`
- **PM2 Name**: `kuma-push-monitor`
- **PM2 ID**: 9
- **Status**: Running (6 restarts as of 2025-08-06)
- **Logs**:
  - Output: `/logs/kuma-push-out.log`
  - Errors: `/logs/kuma-push-error.log`

### Push Schedule

The daemon runs continuously with the following schedule:

- **Every 5 minutes**: Sync status push
- **Every 10 minutes**: Database health push
- **Every 30 minutes**: Fetch statistics push
- **Every 60 minutes**: API usage push

### Configuration

Push URLs are stored in `.kuma-push-urls`:

```bash
export KUMA_SYNC_URL="http://localhost:3080/api/push/pTHkU4CS4Y"
export KUMA_API_URL="http://localhost:3080/api/push/rVHrwub5la"
export KUMA_FETCH_URL="http://localhost:3080/api/push/OTA4U3LMl8"
export KUMA_DB_URL="http://localhost:3080/api/push/IPaa8EaXSY"
```

## Current Status (2025-08-06)

### Working Well ✅

- All HTTP monitors operational with good uptime
- Sync Server showing 100% uptime
- Bi-directional sync queue monitoring active
- Push daemon recently restarted and pushing data

### Known Issues ⚠️

- Push monitor uptime percentages are low due to recent daemon restart
- API Usage monitor showing only 46% uptime
- Fetch Success Rate monitor at 27% uptime
- Database monitor occasionally showing 404/500 errors

## Troubleshooting Guide

### Push Monitor Not Working

1. **Check daemon status**:

   ```bash
   pm2 status kuma-push-monitor
   ```

2. **View recent logs**:

   ```bash
   pm2 logs kuma-push-monitor --lines 50
   ```

3. **Restart if needed**:

   ```bash
   pm2 restart kuma-push-monitor
   ```

4. **Verify URLs configuration**:
   ```bash
   cat .kuma-push-urls
   ```

### Low Uptime on Push Monitors

**Common Causes**:

- Daemon was recently restarted (check PM2 uptime)
- Sleep process being killed (check error logs)
- Source data not available (check sync logs)

**Resolution**:

- Allow 24-48 hours for uptime to stabilize after restart
- Monitor logs for consistent pushing
- Verify source endpoints are responding

### Database Monitor Errors (404/500)

**Known Issue**: Next.js API routes occasionally fail and return HTML instead of JSON

**Mitigation**:

- `rss-services-monitor` (PM2 ID: 8) auto-restarts the service
- Manual fix: `pm2 restart rss-reader-dev`

## Related Services

| Service                | Purpose                      | PM2 ID | Status                 |
| ---------------------- | ---------------------------- | ------ | ---------------------- |
| `rss-services-monitor` | Auto-restart on API failures | 8      | Waiting (473 restarts) |
| `kuma-push-monitor`    | Push metrics to Uptime Kuma  | 9      | Online                 |
| `rss-sync-cron`        | Scheduled article sync       | 2      | Online                 |
| `rss-sync-server`      | Bi-directional sync          | 3      | Online                 |
| `rss-reader-dev`       | Main application             | 1      | Online                 |

## Maintenance Tasks

### Daily

- Check Uptime Kuma dashboard for any red monitors
- Review push monitor uptime trends
- Verify all services show "Up" status

### Weekly

- Check PM2 restart counts for stability issues
- Review error logs for patterns
- Validate push daemon is running continuously

### Monthly

- Archive old log files
- Review and update uptime targets
- Document any new issues or resolutions

## Integration Points

### PM2 Ecosystem

The kuma-push-monitor is now fully integrated into `ecosystem.config.js` for unified configuration and management with all other services.

### Discord Notifications

Currently not configured but webhook URLs can be added to each monitor for alert notifications.

### Health Endpoints

All health endpoints follow standardized format returning JSON with status codes:

- 200: Healthy
- 500: Unhealthy
- 404: Endpoint not found (Next.js routing issue)

## Future Improvements

1. ~~**Add kuma-push-monitor to ecosystem.config.js**~~ ✅ Completed 2025-08-06
2. **Configure Discord webhook notifications** for critical failures
3. **Implement retry logic** in push script for failed pushes
4. **Add monitoring for the monitor** - meta-monitoring to ensure push daemon stays alive
5. **Create status page** for external visibility

## References

- [Uptime Kuma Documentation](https://github.com/louislam/uptime-kuma)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- Internal Scripts:
  - `/scripts/push-to-kuma.sh`
  - `/scripts/kuma-push-daemon.sh`
  - `/scripts/setup-kuma-push-monitors.sh`
