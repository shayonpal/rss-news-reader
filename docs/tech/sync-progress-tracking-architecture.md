# Sync Progress Tracking Architecture

## Overview

This document describes the dual-write sync progress tracking system implemented to solve critical issues with sync status visibility in the RSS News Reader application. The solution ensures reliable progress tracking across serverless function invocations and server restarts.

## Problem Statement

### The Issue
- **User Experience**: Manual sync operations showed timeout errors after 2 minutes
- **False Negatives**: Syncs actually completed in ~10 seconds but appeared to fail
- **Root Cause**: Next.js serverless functions don't share memory between invocations
- **Impact**: Status endpoint returned 404 for sync IDs stored only in memory

### Technical Challenges
1. **Serverless Architecture**: Each API invocation runs in isolation
2. **PM2 Process Management**: Server restarts would lose all in-memory state
3. **Client Expectations**: Progress bars required real-time updates (polling every 2 seconds)
4. **Resource Constraints**: Single-user application on personal server

## Solution Architecture

### Dual-Write Pattern

The implementation uses a dual-write pattern with automatic fallback:

```
┌─────────────────┐
│   Sync Start    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Write to File  │────▶│ /tmp/sync-status-│
│   (Primary)     │     │   {syncId}.json  │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Write to DB     │────▶│  sync_status     │
│  (Fallback)     │     │     table        │
└─────────────────┘     └──────────────────┘
```

### Read Pattern with Fallback

```
┌─────────────────┐
│ Status Request  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check File      │────────┐
│   System        │        │
└────────┬────────┘        ▼
         │         ┌─────────────────┐
         │         │ File Exists?    │
         │         └────┬───────┬────┘
         │              │ Yes   │ No
         │              ▼       │
         │         ┌─────────┐  │
         │         │ Return  │  │
         │         │  Data   │  │
         │         └─────────┘  │
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│ Check Database  │────▶│ Return DB Data  │
│   (Fallback)    │     │  or 404 Error   │
└─────────────────┘     └─────────────────┘
```

## Implementation Details

### 1. File-Based Storage (Primary)

**Location**: `/tmp/sync-status-{syncId}.json`

**Structure**:
```json
{
  "syncId": "sync_1234567890",
  "status": "in_progress",
  "progress": 45,
  "stage": "Processing articles",
  "startTime": "2025-07-27T08:00:00Z",
  "lastUpdate": "2025-07-27T08:00:15Z",
  "stats": {
    "feeds": { "processed": 10, "total": 22 },
    "articles": { "processed": 450, "total": 1000 }
  }
}
```

**Benefits**:
- Fast read/write operations (no network latency)
- No connection pooling overhead
- Survives across serverless invocations
- Simple JSON serialization

**Limitations**:
- Lost on server restart (PM2 restart, crash, reboot)
- Not accessible across multiple servers
- Limited to server's file system

### 2. Database Storage (Fallback)

**Table**: `sync_status`

**Schema**:
```sql
CREATE TABLE sync_status (
    sync_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    stage TEXT,
    start_time TIMESTAMPTZ DEFAULT now(),
    last_update TIMESTAMPTZ DEFAULT now(),
    stats JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY "Service role has full access to sync_status"
    ON sync_status
    USING (auth.role() = 'service_role');

-- Others: read-only
CREATE POLICY "Authenticated and anon users can read sync_status"
    ON sync_status
    FOR SELECT
    USING (true);
```

**Benefits**:
- Survives server restarts and crashes
- Accessible from any server instance
- Built-in retention with timestamp tracking
- Queryable for analytics and debugging

**Trade-offs**:
- Network latency for each operation
- Database connection overhead
- Requires connection pooling management

### 3. Cleanup Strategy

**Timing**:
- 60-second delay after completion (success or failure)
- Prevents premature 404s for clients still polling
- 24-hour retention for both storage layers

**Implementation**:
```typescript
// Delayed cleanup after completion
setTimeout(async () => {
    // Clean up file
    try {
        await fs.unlink(statusFilePath);
    } catch (error) {
        // File might already be deleted
    }
    
    // Database cleanup handled by scheduled job
}, 60000); // 60 seconds
```

**Database Cleanup**:
```sql
-- Scheduled cleanup of old records
DELETE FROM sync_status 
WHERE created_at < now() - interval '24 hours';
```

## API Endpoints

### 1. Start Sync - POST `/api/sync`

**Request**:
```json
{
  "type": "full" | "incremental",
  "options": {
    "forceRefresh": boolean
  }
}
```

**Response**:
```json
{
  "syncId": "sync_1234567890",
  "status": "started",
  "message": "Sync operation started"
}
```

**Process**:
1. Generate unique sync ID
2. Create initial status in both file and database
3. Start async sync operation
4. Return sync ID immediately

### 2. Check Status - GET `/api/sync/status/[syncId]`

**Response**:
```json
{
  "syncId": "sync_1234567890",
  "status": "in_progress",
  "progress": 75,
  "stage": "Updating read states",
  "startTime": "2025-07-27T08:00:00Z",
  "stats": {
    "feeds": { "processed": 22, "total": 22 },
    "articles": { "processed": 750, "total": 1000 }
  }
}
```

**Read Strategy**:
1. First check file system (fast path)
2. If not found, check database (fallback)
3. If not found in either, return 404

## Connection Management

### Singleton Pattern for Database

**File**: `src/lib/db/supabase-admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return supabaseAdmin;
}
```

**Benefits**:
- Single connection instance per process
- Reduced connection overhead
- Proper connection reuse
- Prevents connection pool exhaustion

## Monitoring and Operations

### Health Checks

**Sync Health Endpoint**: `/api/health/sync`
```json
{
  "status": "healthy",
  "activeSyncs": 1,
  "recentSyncs": [
    {
      "syncId": "sync_1234567890",
      "status": "completed",
      "duration": 12.5,
      "completedAt": "2025-07-27T08:00:12.500Z"
    }
  ]
}
```

### Logging

**Log Locations**:
- Sync operations: `logs/sync-cron.jsonl`
- API calls: `logs/inoreader-api-calls.jsonl`
- Health checks: `logs/sync-health.jsonl`

**Log Analysis Commands**:
```bash
# Monitor active syncs
tail -f logs/sync-cron.jsonl | jq 'select(.status == "in_progress")'

# Check sync durations
cat logs/sync-cron.jsonl | jq 'select(.status == "completed") | .duration' | stats

# Find failed syncs
cat logs/sync-cron.jsonl | jq 'select(.status == "failed")'
```

### Debugging

**Common Issues**:

1. **Status returns 404 immediately**
   - Check if file system is writable
   - Verify database connection
   - Check for permission issues

2. **Progress stuck at certain percentage**
   - Check API rate limits
   - Review error logs for specific stage
   - Verify network connectivity

3. **Cleanup happening too early**
   - Verify 60-second delay is working
   - Check for multiple cleanup attempts
   - Monitor file system and database

**Debug Commands**:
```bash
# Check active sync files
ls -la /tmp/sync-status-*.json

# Monitor database sync status
psql -c "SELECT sync_id, status, progress, stage FROM sync_status ORDER BY created_at DESC LIMIT 10;"

# Check for orphaned records
psql -c "SELECT count(*) FROM sync_status WHERE created_at < now() - interval '24 hours';"
```

## Performance Considerations

### Benchmarks

- **File Write**: ~1ms
- **File Read**: ~1ms
- **Database Write**: ~20-50ms (with connection pooling)
- **Database Read**: ~15-30ms (with connection pooling)
- **Total Overhead**: <2% of sync operation time

### Optimization Strategies

1. **Write Throttling**: Update progress every 5% instead of every item
2. **Batch Updates**: Group multiple progress updates
3. **Async Writes**: Don't await database writes in hot path
4. **Connection Pooling**: Reuse database connections

## Future Enhancements

### Potential Improvements

1. **Redis Integration** (if multi-server deployment needed)
   - Faster than database
   - Built-in TTL support
   - Pub/sub for real-time updates

2. **WebSocket Support** (for true real-time updates)
   - Eliminate polling overhead
   - Instant progress updates
   - Better user experience

3. **Sync Queue Management**
   - Prevent concurrent syncs
   - Queue multiple sync requests
   - Priority-based processing

4. **Enhanced Analytics**
   - Sync performance trends
   - Failure pattern analysis
   - Resource usage tracking

## Architecture Decision Record (ADR)

**Date**: July 27, 2025

**Status**: Implemented

**Context**: Single-user RSS reader with serverless architecture needs reliable sync progress tracking

**Decision**: Dual-write pattern with file system (primary) and database (fallback)

**Consequences**:
- ✅ Reliable progress tracking across all scenarios
- ✅ Fast performance for normal operations
- ✅ Survives server restarts with database fallback
- ✅ Simple implementation without external dependencies
- ⚠️ Slightly increased complexity with dual storage
- ⚠️ Requires cleanup management for both layers

**Alternatives Considered**:
1. **Database-only**: Too slow for frequent updates
2. **Redis**: Overkill for single-user application
3. **In-memory only**: Lost on serverless function cycling
4. **Local SQLite**: Not accessible across serverless instances

## Conclusion

The dual-write sync progress tracking system successfully solves the timeout error issue while providing real-time progress updates. The architecture balances performance (file system) with reliability (database fallback) and is well-suited for a single-user application running on serverless infrastructure.

The implementation demonstrates how architectural patterns can be adapted to specific constraints and requirements, resulting in a solution that is both performant and resilient.