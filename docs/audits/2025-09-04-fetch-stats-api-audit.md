# Audit: `/api/analytics/fetch-stats`

- Endpoint: `GET /api/analytics/fetch-stats`
- Implementation: `src/app/api/analytics/fetch-stats/route.ts`
- Audit date: 2025-09-04
- Reviewer: Claude Code with database investigation

## Summary

The endpoint provides an analytics dashboard payload with:

- Overall fetch stats for `today`, `thisMonth`, and `lifetime`
- Per-feed stats with success rates and average duration
- Top issues: most problematic feeds this month and recent failures

Returns `{ overall, feeds, topIssues }` structure that matches the UI at `src/app/fetch-stats/page.tsx`. Aggregates data by loading the full `fetch_logs` table into memory.

## Behavior Overview

### Data sources

- `fetch_logs` with joins to `feeds` (for titles) and `articles` (for recent failures)
- Selected fields: `fetch_type`, `status`, `created_at`, `duration_ms`, plus `feeds.title` and `articles.title/url` in specific queries

### Queries and flow

1. Query all rows from `fetch_logs` with `feeds!inner(title)` and aggregate in Node into:
   - `overall` (today, thisMonth, lifetime) split by `auto` vs `manual` and `status`
   - Per-feed aggregates with `avgDurationMs` computed from successful runs' `duration_ms`
2. Query "problematic feeds" = failures since start of month grouped by `feeds.title`, top 5
3. Query "recent failures" = last 5 failure rows with `articles` and `feeds` joins
4. Return `{ overall, feeds, topIssues }` with success rate percentages rounded to one decimal

### Response shape

```json
{
  "overall": {
    "today": { "total": 0, "successful": 0, "failed": 0, "successRate": 0, "auto": {...}, "manual": {...} },
    "thisMonth": { ... },
    "lifetime": { ... }
  },
  "feeds": [
    {
      "feedId": "...",
      "feedTitle": "...",
      "today": { "total": 0, "successful": 0, "failed": 0, "successRate": 0, "auto": {...}, "manual": {...}, "avgDurationMs": 1234 },
      "thisMonth": { ... },
      "lifetime": { ... }
    }
  ],
  "topIssues": {
    "problematicFeeds": [{ "feedTitle": "...", "failureCount": 3 }],
    "recentFailures": [{ ... }]
  }
}
```

## Database State

### Current Schema

- **Table**: `fetch_logs` with all required columns (`id`, `article_id`, `feed_id`, `fetch_type`, `status`, `created_at`, `duration_ms`, `error_reason`, `error_details`)
- **Indexes**: 7 total including primary key, with indexes on article_id, feed_id, created_at, status, fetch_type
- **Foreign Keys**: Proper relationships to `articles` and `feeds` tables
- **Constraints**: CHECK constraints on `fetch_type` (manual|auto) and `status` (attempt|success|failure)

### Performance Metrics

- **Table Size**: 2040 KB total (816 KB data, 1224 KB indexes)
- **Record Count**: 19 records over 19 days
- **Storage Anomaly**: 107 KB per record average (expected ~1KB)
- **Index Overhead**: 60% of total storage is indexes
- **Unused Indexes**: `idx_fetch_logs_auto_type` shows zero usage

### Data Statistics

- Average duration (manual): 841ms
- Average duration (auto): 2258ms
- Data consistency: 100%
- Status distribution: 10 success, 9 attempts, 0 failures

## Issues & Risks

### 1. Critical Storage Anomaly

- Database shows 107 KB per record (100x larger than expected)
- Likely caused by oversized `error_details` JSONB values or TOAST table issues
- Will severely impact performance as data grows

### 2. OpenAPI Documentation Mismatch

- `registry.ts` (lines 3972-3989) documents this endpoint as returning `{ fetchStats, syncStats, apiUsage }`
- Actual implementation returns `{ overall, feeds, topIssues }`
- Impact: SDK generation errors, documentation confusion

### 3. Supabase Client Inconsistency

- Creates fresh client with `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` (lines 4-8)
- Other routes use shared client from `@/lib/db/supabase`
- Risk: Anon key fallback may miss rows due to RLS

### 4. Performance Issues

- Loads entire `fetch_logs` table into memory for aggregation
- All processing done in Node.js instead of SQL
- Won't scale beyond ~1000 records efficiently

### 5. Timezone Boundary Errors

- Uses server local dates while `created_at` is UTC
- Causes off-by-one errors around midnight

### 6. Missing Type Safety

- Uses `any` types throughout (line 42+)
- `fetch_logs` not declared in `src/lib/db/types.ts`
- No compile-time validation

### 7. RLS Policy Issues

- Policies allow anonymous INSERT/SELECT operations
- May be overly permissive for production

### 8. Index Optimization Needed

- 60% index overhead (1224 KB indexes vs 816 KB data)
- Multiple unused indexes detected by performance advisors

## Recommendations

### CRITICAL - Immediate Action

1. **Fix Storage Anomaly**
   - Run `VACUUM FULL fetch_logs;` to reclaim space
   - Query: `SELECT pg_column_size(error_details), * FROM fetch_logs ORDER BY pg_column_size(error_details) DESC LIMIT 5;`
   - Add size limit to error_details inserts
   - Consider storing large errors in separate table

2. **Update OpenAPI Documentation**
   - Fix `src/lib/openapi/registry.ts` lines 3972-3989
   - Document actual `{ overall, feeds, topIssues }` structure
   - Add proper examples and field descriptions

3. **Standardize Supabase Client**

   ```typescript
   // src/lib/db/supabase-server.ts
   import { createClient } from "@supabase/supabase-js";

   export const supabaseServer = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!,
     { auth: { persistSession: false, autoRefreshToken: false } }
   );
   ```

### HIGH PRIORITY - This Week

4. **Implement SQL Aggregation**

   ```sql
   -- Overall stats
   SELECT
     status, fetch_type,
     COUNT(*) as count,
     AVG(duration_ms) FILTER (WHERE status = 'success') as avg_duration
   FROM fetch_logs
   WHERE created_at >= $1  -- UTC timestamp
   GROUP BY status, fetch_type;
   ```

5. **Fix UTC Boundaries**

   ```typescript
   const now = new Date();
   const startOfTodayUtc = new Date(
     Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
   ).toISOString();
   ```

6. **Optimize Indexes**
   - Drop `idx_fetch_logs_auto_type`
   - Add composite index: `(feed_id, status, created_at)`
   - Monitor with `pg_stat_user_indexes`

### MEDIUM PRIORITY - Next Sprint

7. **Add Type Safety**
   - Extend `Database` type with `fetch_logs` table
   - Remove all `any` types
   - Use Zod schemas for runtime validation

8. **Clean Migration Files**
   - Remove duplicate table creation from `20250123_add_full_content_extraction.sql`
   - Keep canonical definition in `20250124_create_fetch_logs_table.sql`

9. **Review RLS Policies**
   - Evaluate if anonymous access is needed
   - Consider service-role-only pattern

### LOW PRIORITY - Backlog

10. **Add Pagination**
    - Limit feeds array to top N by activity
    - Add `?limit` and `?offset` parameters

11. **Improve Error Handling**
    - Structured error codes
    - Correlation IDs for tracing

## Testing Considerations

- OpenAPI unit tests need enhancement to catch schema drift
- UI tests depend on current response shape
- Add integration tests for SQL aggregation changes

## Conclusion

The endpoint functions correctly but has critical performance and scalability issues. The storage anomaly (107 KB/record) requires immediate investigation. Moving aggregation to SQL and fixing the OpenAPI documentation are the next priorities. The codebase would benefit from stronger type safety and consistent Supabase client usage patterns.
