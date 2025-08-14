# Service Health Monitoring

## Overview

The RSS News Reader includes an automated service health monitoring system that detects and recovers from API failures, particularly when Next.js API routes return HTML error pages instead of JSON responses.

## Components

### 1. Monitor Service (rss-services-monitor)

A PM2-managed service that continuously monitors the health of all RSS Reader components:

- **Script**: `/scripts/monitor-services-pm2.sh`
- **Check Interval**: Every 2 minutes
- **Process Manager**: PM2 (auto-restarts if monitor crashes)

### 2. Health Endpoints

The monitor checks these endpoints:

- `/api/health` - Main application health
- (retired) `/api/health/freshness` - use `/api/health/parsing` and sync server health instead
- `/api/health/cron` - Cron service status
- `http://localhost:3001/health` - Sync server health

### 3. Automatic Recovery

When the monitor detects failures:

1. **HTML Response Detection**: Identifies when JSON endpoints return HTML (404/500 errors)
2. **Auto-Restart**: Triggers PM2 restart of affected service
3. **Rate Limiting**: Maximum 3 restarts per hour per service
4. **Cooldown Period**: 5-minute wait between restart attempts
5. **Discord Notifications**: Alerts sent for critical failures (if webhook configured)

## PM2 Configuration

The monitoring service is defined in `ecosystem.config.js`:

```javascript
{
  name: "rss-services-monitor",
  script: "./scripts/monitor-services-pm2.sh",
  instances: 1,
  exec_mode: "fork",
  interpreter: "/bin/bash",
  // ... additional PM2 settings
}
```

## Management Commands

### Start Monitoring

```bash
pm2 start ecosystem.config.js --only rss-services-monitor
```

### Check Status

```bash
pm2 status rss-services-monitor
pm2 logs rss-services-monitor
```

### Stop Monitoring

```bash
pm2 stop rss-services-monitor
```

### View Monitoring Logs

```bash
# JSONL structured logs
tail -f logs/services-monitor.jsonl

# PM2 process logs
pm2 logs rss-services-monitor --lines 50
```

## Restart Tracking

The monitor tracks restart attempts to prevent restart loops:

- **Location**: `/logs/restart-tracking/`
- **Files**: `{service}_count` and `{service}_time`
- **Reset**: Counters reset after 1 hour of stability

## Configuration

Environment variables (set in ecosystem.config.js):

- `CHECK_INTERVAL`: Seconds between checks (default: 120)
- `MAX_RESTARTS_PER_HOUR`: Rate limit (default: 3)
- `RESTART_COOLDOWN`: Seconds between restarts (default: 300)
- `DISCORD_WEBHOOK_URL`: Optional Discord alerts

## Troubleshooting

### Monitor Not Running

Check PM2 status:

```bash
pm2 list
pm2 describe rss-services-monitor
```

### False Positives

If services are being restarted unnecessarily:

1. Check the health endpoint responses
2. Review logs in `services-monitor.jsonl`
3. Adjust CHECK_INTERVAL or RESTART_COOLDOWN

### Rate Limit Hit

If a service hits the restart limit:

1. Manual intervention required
2. Check service logs for root cause
3. Reset counters: `rm logs/restart-tracking/{service}_*`

## Integration with Startup

The monitoring service automatically starts on system boot via PM2's resurrection feature:

1. LaunchAgent triggers `startup.sh`
2. PM2 resurrects all saved processes
3. Monitor service starts automatically

To ensure persistence:

```bash
pm2 save
pm2 startup  # Follow the instructions if not already configured
```

## Logs and Metrics

### Structured Logs (JSONL)

- **Location**: `logs/services-monitor.jsonl`
- **Format**: JSON Lines with timestamp, event, service, status, message
- **Events**: health_check, restart_attempt, restart_complete, restart_throttled

### Example Log Entry

```json
{
  "timestamp": "2025-08-05T22:58:29.3NZ",
  "event": "restart_attempt",
  "service": "rss-reader-dev",
  "status": "starting",
  "message": "Attempting automatic restart"
}
```

## Sync Conflict Log

- **Location**: `logs/sync-conflicts.jsonl`
- **Format**: JSON Lines with detailed conflict information
- **Purpose**: Tracks conflicts when local article states differ from Inoreader during sync
- **Fields**: timestamp, syncSessionId, articleId, conflictType, localValue, remoteValue, resolution
- **Conflict Types**: read_status, starred_status, both
- **Resolution**: Indicates whether local or remote values won

### Example Conflict Entry

```json
{
  "timestamp": "2025-08-06T21:20:00.000Z",
  "syncSessionId": "sync_2025-08-06T21:20:00.000Z",
  "articleId": "article-123",
  "conflictType": "read_status",
  "localValue": { "read": true, "starred": false },
  "remoteValue": { "read": false, "starred": false },
  "resolution": "remote",
  "note": "Remote wins: local changes overwritten (API limitation: no remote timestamps)"
}
```

## Database Cleanup Monitoring

### Cleanup Operations

The sync process includes automatic database cleanup to prevent unbounded growth:

- **Feed Cleanup**: Removes feeds that no longer exist in Inoreader
- **Article Cleanup**: Removes read articles with deletion tracking to prevent re-import
- **Chunked Deletion**: Large cleanup operations are processed in chunks of 200 articles to avoid URI length limits (RR-150)

### Cleanup Monitoring Metrics

- **Articles Deleted**: Count of read articles removed during cleanup
- **Feeds Deleted**: Count of obsolete feeds removed
- **Tracking Records**: Count of deletion tracking records created
- **Chunk Processing**: Number of chunks processed for large deletions
- **Processing Time**: Duration of cleanup operations

### Cleanup Configuration

Cleanup behavior is controlled through the `system_config` table:

| Configuration                    | Default | Description                           |
| -------------------------------- | ------- | ------------------------------------- |
| `deletion_tracking_enabled`      | `true`  | Enable/disable deletion tracking      |
| `cleanup_read_articles_enabled`  | `true`  | Enable/disable read article cleanup   |
| `feed_deletion_safety_threshold` | `0.5`   | Max percentage of feeds to delete     |
| `max_articles_per_cleanup_batch` | `1000`  | Max articles per cleanup batch        |
| `max_ids_per_delete_operation`   | `200`   | Max IDs per delete operation (RR-150) |

### Cleanup Error Monitoring

Monitor these cleanup-specific errors:

- **URI Length Errors**: Should be resolved with chunked deletion (RR-150)
- **Safety Threshold Violations**: When too many feeds would be deleted
- **Partial Cleanup Failures**: When some chunks fail but others succeed

## Related Documentation

- [PM2 Process Management](./pm2-management.md)
- [Health Endpoints](../api/health-endpoints.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Cleanup Architecture](../tech/cleanup-architecture.md)
