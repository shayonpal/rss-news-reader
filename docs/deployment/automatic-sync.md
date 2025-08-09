# Automatic Daily Sync Documentation

## Overview

The RSS Reader includes an automatic sync service that runs twice daily to fetch new articles from Inoreader. This service is implemented using `node-cron` and runs as a separate PM2 process alongside the main Next.js application.

## Schedule

The sync runs automatically at:

- Default (current dev server): **2:00, 6:00, 10:00, 14:00, 18:00, 22:00** America/Toronto (EST/EDT)
- To change cadence, update `SYNC_CRON_SCHEDULE` in PM2. Example for twice daily: `0 2,14 * * *`.

This schedule ensures fresh content is available for morning and evening reading sessions.

## Components

### 1. Cron Service (`/src/server/cron.js`)

- Manages the scheduled sync tasks
- Logs all sync operations to JSONL format
- Handles sync orchestration and error recovery
- Updates sync metadata in Supabase

### 2. Sync API Endpoint (`/api/sync`)

- Handles the actual sync logic
- Fetches data from Inoreader API
- Updates Supabase with new articles
- Tracks API usage and rate limits

### 3. Metadata Endpoint (`/api/sync/metadata`)

- Updates sync statistics in Supabase
- Tracks success/failure counts
- Stores last sync timestamp and status

## Configuration

### Environment Variables (Dev)

```bash
# Enable automatic sync (required)
ENABLE_AUTO_SYNC=true

# Cron schedule (optional, defaults to 2am/2pm)
SYNC_CRON_SCHEDULE="0 2,14 * * *"

# Log file path (optional)
SYNC_LOG_PATH="./logs/sync-cron.jsonl"

# Browser-facing URL (used by client code)
NEXT_PUBLIC_APP_URL="http://100.96.166.53:3000"

# Internal URL for PM2 cron to call app APIs
# (ecosystem.config.js currently uses localhost)
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Incremental sync configuration (RR-149)
SYNC_MAX_ARTICLES=500
ARTICLES_RETENTION_LIMIT=1000
```

### New Environment Variables

- **`SYNC_MAX_ARTICLES`**: Number of articles to fetch per incremental sync (default: 500)
  - Used for incremental syncs to balance freshness with efficiency
  - Weekly full syncs ignore this limit for complete data integrity
  - Higher values accommodate higher-volume feeds

- **`ARTICLES_RETENTION_LIMIT`**: Maximum articles to retain in database (default: 1000)
  - Enforced during sync operations to prevent unbounded growth
  - Older articles are automatically cleaned up when limit is exceeded
  - Helps maintain database performance

### PM2 Configuration (Dev Only)

The cron service is configured in `ecosystem.config.js`:

```javascript
{
  name: 'rss-sync-cron',
  script: './src/server/cron.js',
  instances: 1,
  max_memory_restart: '256M',
  env: {
    NODE_ENV: 'development',
    ENABLE_AUTO_SYNC: 'true',
    SYNC_CRON_SCHEDULE: '0 2,14 * * *',
    SYNC_LOG_PATH: './logs/sync-cron.jsonl',
    // Internal API base used by the cron job
    NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
    SYNC_MAX_ARTICLES: '500',
    ARTICLES_RETENTION_LIMIT: '1000'
  }
}
```

## Deployment

### Starting the Service

```bash
# Start only the cron service
pm2 start ecosystem.config.js --only rss-sync-cron

# Check status
pm2 status
```

### Monitoring

```bash
# View cron service logs
pm2 logs rss-sync-cron

# Watch sync logs in real-time
tail -f logs/sync-cron.jsonl | jq .

# View PM2 process details
pm2 show rss-sync-cron
```

## JSONL Log Format

Each sync operation generates multiple log entries:

```jsonl
{"timestamp":"2025-01-22T07:00:00.123Z","trigger":"cron-2am","status":"started","syncId":"uuid-here"}
{"timestamp":"2025-01-22T07:00:02.456Z","trigger":"cron-2am","status":"running","progress":30,"message":"Found 22 feeds..."}
{"timestamp":"2025-01-22T07:00:45.789Z","trigger":"cron-2am","status":"completed","duration":45666,"feeds":22,"articles":156}
```

### Log Fields

- `timestamp`: ISO 8601 timestamp
- `trigger`: One of: `cron-2am`, `cron-2pm`, `manual`
- `status`: One of: `started`, `running`, `completed`, `error`
- `syncId`: Unique identifier for this sync operation
- `progress`: Percentage complete (0-100)
- `message`: Human-readable status message
- `duration`: Total sync time in milliseconds
- `feeds`: Number of feeds synced (on completion)
- `articles`: Number of articles synced (on completion)
- `error`: Error message (on failure)

## Log Analysis

### Common Analysis Commands

```bash
# Count syncs by status
cat logs/sync-cron.jsonl | jq -r .status | sort | uniq -c

# View failed syncs
cat logs/sync-cron.jsonl | jq 'select(.status == "error")'

# Calculate average sync duration
cat logs/sync-cron.jsonl | jq 'select(.duration) | .duration' | awk '{sum+=$1; count++} END {print sum/count/1000 "s"}'

# Get daily sync summary
cat logs/sync-cron.jsonl | jq 'select(.status == "completed") | {date: .timestamp[0:10], articles: .articles}' | jq -s 'group_by(.date) | map({date: .[0].date, total_articles: map(.articles) | add})'

# Find long-running syncs (>1 minute)
cat logs/sync-cron.jsonl | jq 'select(.duration > 60000)'
```

## Sync Metadata

The service tracks sync statistics in the `sync_metadata` table:

| Key                  | Description                    |
| -------------------- | ------------------------------ |
| `last_sync_time`     | Timestamp of last sync attempt |
| `last_sync_status`   | Either 'success' or 'failed'   |
| `last_sync_error`    | Error message if failed        |
| `sync_success_count` | Total successful syncs         |
| `sync_failure_count` | Total failed syncs             |

## API Rate Limits

The sync service respects Inoreader's API limits:

- Maximum 100 API calls per day
- Each sync uses approximately 4-5 API calls
- Automatic syncs (2 per day) use ~10 calls
- Leaves ~90 calls for manual syncs

## Error Handling

The service handles various error scenarios:

1. **Rate Limit Exceeded**: Sync is skipped, logged as error
2. **Network Errors**: Retried with exponential backoff
3. **Token Expiration**: Automatic refresh attempted
4. **Partial Failures**: Continues with remaining items
5. **Timeout**: Sync cancelled after 2 minutes

## Testing

### Manual Test

```bash
# Test the cron service
node scripts/test-cron-sync.js

# Test manual sync trigger
./scripts/test-manual-sync.sh
```

### Production Test

```bash
# Trigger a manual sync
curl -X POST http://localhost:3000/api/sync

# Check sync status
curl http://localhost:3000/api/sync/status/{syncId}
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
pm2 logs rss-sync-cron --lines 50

# Verify environment variables
pm2 env rss-sync-cron
```

### Sync Failures

1. Check API rate limits in logs
2. Verify Inoreader tokens are valid
3. Check network connectivity
4. Review error logs for specific issues

### No Syncs Running

1. Verify `ENABLE_AUTO_SYNC=true`
2. Check cron schedule format
3. Ensure PM2 process is running
4. Check timezone settings

## Maintenance

### Log Rotation

Logs should be rotated periodically to prevent disk space issues:

```bash
# Archive old logs
mv logs/sync-cron.jsonl logs/sync-cron-$(date +%Y%m%d).jsonl

# Or use logrotate configuration
/path/to/logs/sync-cron.jsonl {
    daily
    rotate 30
    compress
    missingok
    notifempty
}
```

### Performance Monitoring

Monitor sync performance over time:

```bash
# Average sync duration by day
cat logs/sync-cron.jsonl | jq 'select(.status == "completed") | {date: .timestamp[0:10], duration: .duration}' | jq -s 'group_by(.date) | map({date: .[0].date, avg_duration: (map(.duration) | add / length / 1000)})'
```

## macOS Power Settings

- Ensure the Mac Mini does not sleep during scheduled sync windows.
- Recommended: System Settings → Displays → Prevent automatic sleeping on power adapter, or use `caffeinate -dimsu` in a background service during sync windows.

## Best Practices

1. **Monitor API Usage**: Check daily API call counts regularly
2. **Review Logs**: Check for patterns in failures
3. **Test Changes**: Always test schedule changes in development first
4. **Backup Logs**: Archive logs before major updates
5. **Document Changes**: Update this documentation when modifying the service
