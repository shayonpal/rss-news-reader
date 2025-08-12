# RR-149 Incremental Sync Implementation - Manual Testing Guide

**Created:** Thursday, August 7, 2025 at 2:14 AM  
**Version:** 1.0  
**Application URL:** http://100.96.166.53:3000/reader  
**Target Feature:** Incremental sync with ot (older than) parameter implementation

## Overview

This guide provides comprehensive manual testing procedures for validating the RR-149 incremental sync implementation. The feature optimizes sync performance by only fetching articles newer than the last sync timestamp using Inoreader's `ot` parameter.

## Prerequisites

1. **Environment Access**
   - SSH access to RSS News Reader server (100.96.166.53)
   - PM2 process manager available
   - Application running at http://100.96.166.53:3000/reader
   - Monitoring dashboard accessible via `./scripts/monitor-dashboard.sh`

2. **Required Tools**
   - `curl` for API testing
   - `jq` for JSON parsing
   - `pm2` command line tool
   - Browser access to application

3. **Test Data Requirements**
   - Active Inoreader account with test credentials in `.env`
   - At least 5-10 feeds with recent articles
   - Mixed read/unread article states

## Testing Sections

### Section 1: Current Sync State Verification

#### 1.1 Check Current Sync Metadata

**Purpose:** Verify current sync timestamps and metadata

```bash
# Check sync metadata in database
curl -s "http://100.96.166.53:3000/reader/api/sync/metadata" | jq '.'

# Check last sync time via API
curl -s "http://100.96.166.53:3000/reader/api/sync/last-sync" | jq '.'
```

**Expected Results:**

- `last_sync_time`: Recent ISO timestamp
- `last_incremental_sync_timestamp`: Unix timestamp (seconds)
- Timestamps should be within expected sync intervals (6x daily)

#### 1.2 Verify Current Service Status

```bash
# Check all PM2 services
pm2 status

# Use monitoring dashboard
./scripts/monitor-dashboard.sh

# Check specific service logs
pm2 logs rss-reader-dev --lines 10
pm2 logs rss-sync-cron --lines 10
pm2 logs rss-sync-server --lines 10
```

**Expected Results:**

- All services showing "online" status
- Memory usage within normal ranges (<800MB each)
- Recent log activity indicating healthy operation

#### 1.3 Check API Rate Limits

```bash
# Check current API usage
curl -s "http://100.96.166.53:3000/reader/api/logs/inoreader" | jq '.usage'

# Alternative: Check log file directly
tail -20 /Users/shayon/DevProjects/rss-news-reader/logs/inoreader-api-calls.jsonl | jq -r '.timestamp + " " + .endpoint'
```

**Expected Results:**

- API calls < 90 per day (staying within 100 call limit)
- Recent calls distributed across sync intervals
- No rate limit errors in logs

### Section 2: Manual Sync Triggering

#### 2.1 Trigger Manual Sync

**Purpose:** Manually trigger sync and observe behavior

```bash
# Trigger manual sync and capture sync ID
RESPONSE=$(curl -s -X POST "http://100.96.166.53:3000/reader/api/sync")
echo "$RESPONSE" | jq '.'

# Extract sync ID for tracking
SYNC_ID=$(echo "$RESPONSE" | jq -r '.syncId')
echo "Sync ID: $SYNC_ID"
```

**Expected Results:**

- HTTP 200 response
- Valid UUID sync ID returned
- Rate limit information showing remaining calls
- Success message: "Sync started successfully"

#### 2.2 Monitor Sync Progress

```bash
# Monitor sync progress (replace SYNC_ID)
watch -n 2 "curl -s 'http://100.96.166.53:3000/reader/api/sync/status/$SYNC_ID' | jq '.'"

# Alternative: Check without watch
curl -s "http://100.96.166.53:3000/reader/api/sync/status/$SYNC_ID" | jq '.'
```

**Expected Progress Stages:**

1. `status: "pending"` (0-10%)
2. `status: "running"` with increasing progress:
   - 10%: "Loading server tokens..."
   - 20%: "Fetching subscriptions..."
   - 30%: "Found X feeds..."
   - 40%: "Syncing feeds to Supabase..."
   - 60%: "Fetching recent articles..."
   - 70%: "Processing X articles..."
   - 90%: "Refreshing feed statistics..."
   - 95%: "Updating sync metadata..."
   - 99%: "Syncing local changes to Inoreader..."
3. `status: "completed"` (100%)

### Section 3: Incremental vs Full Sync Verification

#### 3.1 Identify Sync Type

**Purpose:** Determine if current sync is incremental or full

```bash
# Check PM2 logs during sync for sync type indicators
pm2 logs rss-reader-dev --lines 50 | grep -i "incremental\|full sync"

# Check cron logs
tail -50 /Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl | jq -r 'select(.level == "info") | .message' | grep -i sync
```

**Incremental Sync Indicators:**

- Log message: "Performing incremental sync (articles newer than [timestamp])"
- API URL contains `&ot=` parameter
- Typically processes fewer articles

**Full Sync Indicators:**

- Log message: "Performing full sync (weekly refresh OR no previous timestamp)"
- API URL does NOT contain `&ot=` parameter
- Processes more articles (up to `SYNC_MAX_ARTICLES` limit)

#### 3.2 Force Different Sync Types

**Force Full Sync (weekly refresh simulation):**

```bash
# Method 1: Clear incremental sync timestamp
curl -X POST "http://100.96.166.53:3000/reader/api/sync/metadata" \
  -H "Content-Type: application/json" \
  -d '{"last_incremental_sync_timestamp": null}'

# Method 2: Set old timestamp (>7 days ago)
OLD_TIMESTAMP=$(($(date +%s) - (8 * 24 * 60 * 60)))  # 8 days ago
curl -X POST "http://100.96.166.53:3000/reader/api/sync/metadata" \
  -H "Content-Type: application/json" \
  -d "{\"last_incremental_sync_timestamp\": \"$OLD_TIMESTAMP\"}"

# Trigger sync
curl -X POST "http://100.96.166.53:3000/reader/api/sync"
```

**Force Incremental Sync:**

```bash
# Set recent timestamp (1 hour ago)
RECENT_TIMESTAMP=$(($(date +%s) - 3600))  # 1 hour ago
curl -X POST "http://100.96.166.53:3000/reader/api/sync/metadata" \
  -H "Content-Type: application/json" \
  -d "{\"last_incremental_sync_timestamp\": \"$RECENT_TIMESTAMP\"}"

# Trigger sync
curl -X POST "http://100.96.166.53:3000/reader/api/sync"
```

### Section 4: API Calls Monitoring

#### 4.1 Monitor Inoreader API Calls

**Purpose:** Track API calls being made to Inoreader during sync

```bash
# Real-time monitoring of API calls
tail -f /Users/shayon/DevProjects/rss-news-reader/logs/inoreader-api-calls.jsonl | jq -r '.timestamp + " " + .method + " " + .endpoint'

# Check calls made in last sync
tail -20 /Users/shayon/DevProjects/rss-news-reader/logs/inoreader-api-calls.jsonl | jq '.'
```

**Expected API Call Pattern (per sync):**

1. **Token Refresh** (if needed): `POST /oauth2/access_token`
2. **Subscriptions**: `GET /reader/api/0/subscription/list`
3. **Unread Counts**: `GET /reader/api/0/unread-count`
4. **Stream Contents**: `GET /reader/api/0/stream/contents/user/-/state/com.google/reading-list`

**Key Verification Points:**

- Total calls per sync: ~4-5 calls
- Stream contents URL includes `xt=user/-/state/com.google/read` (exclude read)
- For incremental sync: URL includes `&ot=[timestamp]`
- For full sync: URL does NOT include `&ot=` parameter

#### 4.2 Verify API Parameters

```bash
# During sync, check for ot parameter in stream request
pm2 logs rss-reader-dev --lines 100 | grep -A 5 -B 5 "stream/contents" | head -20

# Check sync cron logs for URL construction
tail -100 /Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl | jq -r 'select(.endpoint) | .endpoint' | grep stream
```

**Parameter Verification:**

- `n=[number]`: Article limit (default: 100)
- `xt=user/-/state/com.google/read`: Exclude already read articles
- `ot=[timestamp]`: Only for incremental sync, timestamp in seconds

### Section 5: Results Validation

#### 5.1 Database State Verification

**Purpose:** Verify sync results were properly stored

```bash
# Check article counts before and after sync
# (Note: These are example queries - adapt based on your Supabase access method)

# Via application health endpoint (includes database stats)
curl -s "http://100.96.166.53:3000/reader/api/health/db" | jq '.stats'

# Check sync metadata updates
curl -s "http://100.96.166.53:3000/reader/api/sync/last-sync" | jq '.'
```

**Expected Results:**

- `last_sync_time` updated to recent timestamp
- `last_incremental_sync_timestamp` updated to sync start time
- Article counts reflect new articles (if any)
- Feed statistics refreshed

#### 5.2 Application State Verification

**Browser Testing:**

1. **Open Application**: Navigate to http://100.96.166.53:3000/reader
2. **Check Feed List**: Verify feeds display with current unread counts
3. **Check Articles**:
   - New articles appear in article list
   - Read status matches Inoreader state
   - Star status matches Inoreader state
4. **Cross-Reference**: Compare with actual Inoreader web interface

#### 5.3 Conflict Resolution Verification

**Purpose:** Verify bidirectional sync conflict handling

```bash
# Check for conflict logs
tail -50 /Users/shayon/DevProjects/rss-news-reader/logs/sync-conflicts.jsonl | jq '.'

# Check recent sync logs for conflict messages
pm2 logs rss-reader-dev --lines 100 | grep -i conflict

# Verify bidirectional sync triggered
pm2 logs rss-sync-server --lines 20 | grep -i "sync triggered"
```

**Expected Conflict Behaviors:**

- Local changes newer than last sync: **Local wins**
- Remote changes newer than local: **Remote wins**
- Conflicts logged to `sync-conflicts.jsonl`
- Bidirectional sync triggered to push local changes

### Section 6: Performance & Health Monitoring

#### 6.1 Sync Performance Metrics

```bash
# Check sync duration and performance
tail -20 /Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl | jq -r 'select(.status) | .timestamp + " " + .status + " " + (.duration // "N/A")'

# Memory usage during sync
watch -n 5 "pm2 list | grep -E 'rss-reader|rss-sync'"
```

**Performance Benchmarks:**

- **Incremental Sync**: 30-60 seconds, <50 articles typically
- **Full Sync**: 60-120 seconds, up to 100 articles
- **Memory Usage**: Should stay <800MB during sync
- **API Calls**: Exactly 4-5 calls per sync

#### 6.2 Error Detection

```bash
# Check for sync errors
pm2 logs rss-reader-dev --lines 50 | grep -i error

# Check cron error logs
tail -20 /Users/shayon/DevProjects/rss-news-reader/logs/cron-error.log

# Check health endpoints for errors
curl -s "http://100.96.166.53:3000/reader/api/health/app" | jq '.errors'
```

**Common Error Patterns to Watch:**

- **Rate Limit**: "rate_limit_exceeded"
- **Token Issues**: "Failed to refresh token"
- **Network**: "ETIMEDOUT", "ECONNREFUSED"
- **Database**: "Failed to connect to Supabase"

### Section 7: Scheduled Sync Testing

#### 7.1 Verify Cron Schedule

```bash
# Check current cron configuration
pm2 show rss-sync-cron | grep -A 10 -B 10 "cron\|schedule"

# Verify cron service is running
pm2 list | grep cron
```

**Expected Schedule:**

- **Cron Pattern**: `0 2,6,10,14,18,22 * * *`
- **Sync Times**: 2 AM, 6 AM, 10 AM, 2 PM, 6 PM, 10 PM (Toronto time)
- **Service Status**: Online with restart schedule

#### 7.2 Test Automatic Sync

```bash
# Wait for next scheduled sync or trigger manually
# Monitor sync health logs
tail -f /Users/shayon/DevProjects/rss-news-reader/logs/sync-health.jsonl | jq '.'

# Check last automatic sync result
tail -5 /Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl | jq -r 'select(.status) | .timestamp + " " + .status'
```

## Test Scenarios

### Scenario 1: Fresh Installation (Full Sync)

1. Clear sync metadata to simulate fresh install
2. Trigger sync and verify it performs full sync
3. Verify all feeds and articles are imported
4. Confirm sync metadata is properly initialized

### Scenario 2: Regular Incremental Sync

1. Ensure recent sync timestamp exists
2. Trigger sync and verify incremental behavior
3. Verify only new articles since last sync are processed
4. Confirm API calls include `ot=` parameter

### Scenario 3: Weekly Full Sync

1. Set sync timestamp >7 days old
2. Trigger sync and verify full sync behavior
3. Verify all recent articles are refreshed
4. Confirm weekly reset logic works

### Scenario 4: Rate Limit Handling

1. Simulate high API usage (90+ calls)
2. Attempt sync and verify rate limit response
3. Confirm sync is blocked with appropriate error
4. Verify system recovers after rate limit reset

### Scenario 5: Conflict Resolution

1. Make local changes to article read/star status
2. Make different changes in Inoreader web interface
3. Trigger sync and verify conflict resolution
4. Check conflict logs for proper documentation

## Troubleshooting

### Common Issues

**Sync Stuck in "running" state:**

```bash
# Check for hanging sync processes
ps aux | grep -i sync

# Restart sync service if needed
pm2 restart rss-sync-cron
```

**No incremental sync timestamp:**

```bash
# Manually set recent timestamp
curl -X POST "http://100.96.166.53:3000/reader/api/sync/metadata" \
  -H "Content-Type: application/json" \
  -d "{\"last_incremental_sync_timestamp\": \"$(date +%s)\"}"
```

**API rate limit exceeded:**

```bash
# Check current usage
curl -s "http://100.96.166.53:3000/reader/api/logs/inoreader" | jq '.usage'

# Wait for daily reset (UTC midnight) or reduce sync frequency temporarily
```

**Memory issues during sync:**

```bash
# Check memory usage
pm2 list
free -h

# Restart services if memory is high
pm2 restart ecosystem.config.js
```

### Verification Checklist

- [ ] Services are online and healthy
- [ ] API rate limit is within safe range (<90 calls/day)
- [ ] Sync metadata timestamps are current
- [ ] Manual sync completes successfully
- [ ] Incremental sync uses `ot=` parameter correctly
- [ ] Full sync omits `ot=` parameter correctly
- [ ] Article counts reflect sync results
- [ ] Conflict resolution works as expected
- [ ] Bidirectional sync triggers correctly
- [ ] Scheduled syncs run on time
- [ ] Performance metrics are within expected ranges
- [ ] Error handling works for common failure scenarios

## Success Criteria

The RR-149 implementation is working correctly when:

1. **Incremental Sync Logic**:
   - Recent syncs use `ot=` parameter with last sync timestamp
   - Full syncs occur weekly or when no previous timestamp exists

2. **API Efficiency**:
   - Total API calls remain at ~4-5 per sync
   - No unnecessary duplicate calls

3. **Data Integrity**:
   - All new articles since last sync are imported
   - Read/star states sync correctly in both directions
   - Conflict resolution preserves user intent

4. **System Stability**:
   - Sync completes within reasonable time (30-120 seconds)
   - Memory usage remains under limits
   - Services auto-recover from failures

5. **Monitoring & Observability**:
   - Sync type (incremental/full) is clearly logged
   - API calls are tracked and visible
   - Conflicts are detected and logged appropriately

---

_This testing guide covers the comprehensive validation of RR-149 incremental sync implementation. For issues or questions, refer to the main project documentation or monitoring dashboards._
EOF < /dev/null
