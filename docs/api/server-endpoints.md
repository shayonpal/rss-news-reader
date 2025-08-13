# Server API Endpoints

This document lists all internal API endpoints implemented in the codebase, covering both Next.js App Router routes under `/api/*` and the auxiliary Express service under `/server/*`.

- Access model: Internal only; app is reachable via Tailscale network. Client holds no public secrets.
- Authentication: Inoreader OAuth is handled server-side or via secure cookies where applicable.
- **API Base Path (RR-102)**: All endpoints use `/reader` prefix. Development environment automatically redirects `/api/*` → `/reader/api/*` with 307 status.
- Last Updated: 2025-08-12

## Quick Reference

| Category         | Primary Endpoints                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync             | `POST /api/sync`, `GET /api/sync/status/{syncId}`, `GET /api/sync/last-sync`, `POST /api/sync/metadata`, `POST /api/sync/refresh-view`, `POST /api/sync/bidirectional`, `GET /api/sync/api-usage`                                  |
| Articles         | `POST /api/articles/{id}/fetch-content`, `POST /api/articles/{id}/summarize`, `GET /api/articles/{id}/tags`                                                                                                                        |
| Tags             | `GET /api/tags`, `POST /api/tags`, `GET /api/tags/{id}`, `PATCH /api/tags/{id}`, `DELETE /api/tags/{id}`                                                                                                                           |
| Inoreader Proxy  | `GET /api/inoreader/user-info`, `GET /api/inoreader/subscriptions`, `GET /api/inoreader/stream-contents`, `GET /api/inoreader/unread-counts`, `POST /api/inoreader/edit-tag`, `GET /api/inoreader/debug`, `GET /api/inoreader/dev` |
| Health           | `GET /api/health` (and alias `/api/health/app`), `GET /api/health/db`, `GET /api/health/cron`, `GET /api/health/parsing`, `GET /api/health/claude`                                                                                 |
| Analytics & Logs | `GET /api/analytics/fetch-stats`, `POST /api/logs/inoreader`                                                                                                                                                                       |
| Auth Status      | `GET /api/auth/inoreader/status`                                                                                                                                                                                                   |
| Express Service  | `POST /server/sync/trigger`, `GET /server/sync/stats`, `POST /server/sync/clear-failed`, `POST /server/mark-all-read`, `GET /server/health`                                                                                        |

Note: Previous reference to `/api/health/freshness` has been retired; use `/api/health/parsing` and other health endpoints below.

## API Base Path Handling (RR-102)

The RSS News Reader uses a `/reader` base path for all API endpoints. The RR-102 implementation provides smart redirects in development to improve developer experience:

### Production Behavior

- **Requires** the `/reader` prefix: `/reader/api/health/app`
- Missing prefix returns 404 error

### Development Behavior (Smart Redirects)

- **Both paths work**: `/api/health/app` OR `/reader/api/health/app`
- Automatic 307 redirects: `/api/*` → `/reader/api/*`
- **HTTP Method Preservation**: GET, POST, PUT, DELETE, PATCH methods preserved
- **Request Body Preservation**: POST/PUT request bodies maintained during redirect

### Error Handling

- Malformed requests (non-API paths) handled by catch-all route: `/api/[...catch]`
- Provides helpful error messages with debugging information
- Example: `/api/invalid/path` returns clear error with available endpoints

### Implementation Details

- Redirect rules configured in `next.config.mjs` (development only)
- Catch-all error handler at `src/app/api/[...catch]/route.ts`
- Zero production impact - redirects disabled when `NODE_ENV === 'production'`

---

## Next.js App Router Endpoints (/api/\*)

### Sync

- POST `/api/sync` (RR-176, RR-162)
  - Description: Starts server-side sync from Inoreader to Supabase. Handles folders, feeds, unread counts, articles import, tag extraction, cleanup, metadata updates, and triggers bi-directional queue processing. As of RR-162, auto-fetch functionality has been removed to resolve sync performance issues.
  - Response 200: `{ success, syncId, status, message, metrics: { newArticles, deletedArticles, newTags, failedFeeds }, sidebar: { feedCounts: [[feedId, unreadCount], ...], tags: [{ id, name, count }], lastUpdated } }`
  - Response 429: `{ error: "rate_limit_exceeded", ... }`
  - Response 500: `{ error: "sync_start_failed", message, details }`
  - Note: Sync process now maintains `feeds.is_partial_content` field for auto-parse targeting

- GET `/api/sync/status/{syncId}`
  - Description: Poll sync status; primary source is a temp file with DB fallback.
  - Response 200: `{ status: "pending"|"running"|"completed"|"partial"|"failed", progress, message, error?, itemsProcessed, totalItems }`
  - Response 404: `{ error: "sync_not_found", message }`

- GET `/api/sync/last-sync`
  - Description: Returns last sync time, preferring database truth: `sync_metadata` → `sync_status` → log fallback. Includes cache prevention headers to ensure fresh data.
  - Response Headers: `Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache`, `Expires: 0`
  - Response 200: `{ lastSyncTime: string|null, source: "sync_metadata"|"sync_status"|"sync-log"|"none" }`

- POST `/api/sync/metadata`
  - Description: Update sync metadata keys; supports direct value or `{ increment: number }`.
  - Request: `{ [key: string]: string | number | { increment: number } }`
  - Response 200: `{ success: true }`

- POST `/api/sync/refresh-view`
  - Description: Refreshes `feed_stats` materialized view.
  - Response 200: `{ status: "success", message, timestamp }`

- POST `/api/sync/bidirectional`
  - Description: Back-compat placeholder; bi-directional sync runs as separate service.
  - Response 501: `{ error, message }`

- GET `/api/sync/api-usage` (RR-5)
  - Description: Returns current Inoreader API usage with zone percentages for display in sidebar. Values are sourced from Inoreader response headers captured on every call.
  - Response 200: `{ zone1: { used, limit, percentage }, zone2: { used, limit, percentage }, resetAfterSeconds, timestamp }`
  - Cache-Control: 30 seconds (near real-time updates)
  - Notes:
    - Free tier limits: 100/day for Zone 1 and 100/day for Zone 2 (limits come from headers and may vary by plan)
    - To mitigate occasional header lag during bursts, Zone 1 `used` is computed as `max(header_usage, daily_call_count)`, capped at `limit`

### Articles

- POST `/api/articles/{id}/fetch-content` (RR-176, RR-162)
  - Description: Fetches article URL, extracts full content via Readability, stores `full_content`, marks parsing metadata, and logs attempts in `fetch_logs`. Manual fetch only - auto-fetch functionality removed in RR-162.
  - Request JSON (optional): `{ forceRefresh?: boolean }`
  - Responses:
    - 200: `{ success: true, content, title?, excerpt?, byline?, length?, siteName?, parsedAt }`
    - 200 (fallback): `{ success: false, content, fallback: true, error, canRetry? }`
    - 400: `{ error: "no_url", message }`
    - 404: `{ error: "article_not_found", ... }`
    - 408: `{ error: "timeout", ... }`
    - 500: `{ error: "extraction_failed" | "unexpected_error", ... }`
  - Notes:
    - Auto-parsing logic (RR-176): Only triggered for feeds with `is_partial_content = true` OR content <500 chars OR truncation indicators
    - Manual fetching via UI buttons works for all articles regardless of feed type

- POST `/api/articles/{id}/summarize`
  - Description: Generates AI summary using Claude; caches summary in `articles.ai_summary`.
  - Request JSON: `{ regenerate?: boolean }`
  - Responses:
    - 200: `{ success, summary, model, regenerated, input_tokens, output_tokens, config }`
    - 400: `{ error: "no_content", ... }`
    - 404: `{ error: "article_not_found", ... }`
    - 401: `{ error: "invalid_api_key" }`
    - 429: `{ error: "rate_limit" }`
    - 503: `{ error: "api_not_configured" }`
    - 500: `{ error: "summarization_failed", ... }`

- GET `/api/articles/{id}/tags`
  - Description: Returns tags linked to the article.
  - Response 200: `{ tags: [{ id, name, slug, color, description }] }`

### Feeds

**Note (RR-176)**: Feed management operations are currently handled through the client-side store (`updateFeedPartialContent`). A future API endpoint may be added for:

- `PATCH /api/feeds/{id}` - Update feed settings including `is_partial_content` toggle

### Tags

- GET `/api/tags`
  - Description: List tags with filtering, sorting, pagination, and real-time unread counts per user.
  - Query:
    - `search?: string`
    - `sortBy?: "name" | "count" | "recent"` (default `name`)
    - `order?: "asc" | "desc"` (default `asc`)
    - `limit?: number` (default 50)
    - `offset?: number` (default 0)
    - `includeEmpty?: "true" | "false"` (default false)
  - Response 200: `{ tags: [{ ...tag, unread_count: number }], pagination: { limit, offset, total, hasMore } }`
  - Note: Each tag now includes `unread_count` field calculated from user's feeds to ensure accurate per-user unread article counts

- POST `/api/tags`
  - Description: Create a new tag for the user.
  - Request JSON: `{ name: string, color?: string, description?: string }`
  - Responses: 201 with new tag; 400 missing name; 404 user not found; 409 duplicate; 500 on error.

- GET `/api/tags/{id}`
  - Description: Get tag details; optionally include recent associated articles.
  - Query: `includeArticles?: "true"`, `limit?: number` (default 10)
  - Response 200: tag object, optionally `{ ...tag, articles: [...] }`
  - Response 404: Tag or user not found.

- PATCH `/api/tags/{id}`
  - Description: Update tag fields: `name`, `color`, `description`. Slug auto-updates from `name`.
  - Responses: 200 updated tag; 404 not found; 500 on error.

- DELETE `/api/tags/{id}`
  - Description: Delete a tag (cascades `article_tags`).
  - Response 200: `{ message: "Tag deleted successfully" }`

### Inoreader Proxy

- GET `/api/inoreader/user-info`
  - Description: Proxies Inoreader user info; enforces internal rate-limiter and logs call.
  - Query: `trigger?: string` (for logging)
  - Responses: 200 user info; 401 unauthenticated/expired; 429 rate limit; 500 error.

- GET `/api/inoreader/subscriptions`
  - Description: Proxies Inoreader subscription list; refreshes token if expired; logs call.
  - Query: `trigger?: string`
  - Responses: 200 JSON from Inoreader; 401/5xx passthrough.

- GET `/api/inoreader/stream-contents`
  - Description: Proxies Inoreader stream contents for a given `streamId`.
  - Query:
    - `streamId` (required)
    - Optional passthrough: `n`, `r`, `c`, `xt`, `ot`
    - `trigger?: string` (logging)
  - Responses: 200 JSON from Inoreader; 400 missing streamId; 401 unauthenticated; 5xx passthrough.

- GET `/api/inoreader/unread-counts`
  - Description: Proxies Inoreader unread counts; logs call.
  - Query: `trigger?: string`
  - Responses: 200 unread counts; 401; 5xx passthrough.

- POST `/api/inoreader/edit-tag`
  - Description: Proxies Inoreader edit-tag to update read/star states in batch (bi-directional sync).
  - Body: `application/x-www-form-urlencoded` (forwarded as-is). Includes item IDs and add/remove state labels.
  - Responses:
    - 200: `{ success: true }`
    - 401/403: auth failures (OAuth tokens missing/expired)
    - 429: rate limited (honor `Retry-After` header)
    - 5xx: upstream error passthrough

- GET `/api/inoreader/debug`
  - Description: Returns cookie/token presence and expiry diagnostics (for debugging).
  - Response 200: `{ hasAccessToken, hasRefreshToken, expiresAt, expiresIn, isExpired, cookies: { ... } }`

- GET `/api/inoreader/dev` (RR-5, Development Only)
  - Description: Development proxy for testing Inoreader API calls and capturing rate limit headers.
  - Query: `endpoint` (required), `method=GET|POST` (default GET)
  - Response 200: `{ data, headers, debug: { zone1: { usage, limit }, zone2: { usage, limit }, resetAfter } }`
  - Response 403: In production environment
  - Note: Automatically captures and stores rate limit headers in api_usage table

- POST `/api/inoreader/dev` (RR-5, Development Only)
  - Description: POST variant for write operations testing.
  - Query: `endpoint` (required)
  - Body: Raw form data to pass through
  - Response: Same as GET variant

### Health

- GET `/api/health` (alias endpoint also exposed as `/api/health/app`)
  - Description: App health check. Supports lightweight ping.
  - Query: `ping=true` returns `{ status: "ok", ping: true }`
  - Response 200 or 503 with `{ ...health, version, timestamp }`

- GET `/api/health/db`
  - Description: DB connectivity health with timings and environment info.
  - Responses:
    - 200: `{ status: "healthy" | "degraded", database|connection, queryTime, environment, timestamp }`
    - 503: `{ status: "unhealthy", ... }`

- GET `/api/health/cron`
  - Description: Cron service health by reading `logs/cron-health.jsonl`; test env returns healthy skip.
  - Responses: 200 healthy; 503 unknown/unhealthy; includes `{ lastCheck, ageMinutes, lastRun, nextRun, recentRuns, uptime }`

- GET `/api/health/parsing` (RR-176)
  - Description: Parsing/fetching health metrics and recommendations, using `articles`, `fetch_logs`, `feeds`, and `system_config`. Uses `feeds.is_partial_content` field to identify partial feeds (updated from deprecated `is_partial_feed`).
  - Response 200: `{ status, timestamp, metrics: { parsing: {...}, fetch: {...}, configuration: {...} }, recommendations: string[] }`

- GET `/api/health/claude`
  - Description: Claude API connectivity check (models endpoint).
  - Responses: 200 healthy; 501 not configured; 503 unhealthy.

### Analytics & Logs

- GET `/api/analytics/fetch-stats`
  - Description: Aggregated manual fetch stats by period (today, thisMonth, lifetime), per-feed summaries, top issues, and recent failures. Auto-fetch statistics removed in RR-162.
  - Response 200: `{ overall: { today, thisMonth, lifetime }, feeds: [...], topIssues: { problematicFeeds, recentFailures } }`

- POST `/api/logs/inoreader`
  - Description: Append Inoreader API call log entry to `logs/inoreader-api-calls.jsonl`. Non-fatal on failure.
  - Request JSON: `{ endpoint: string, trigger: string, method?: string, timestamp?: string }`
  - Response 200: `{ success: true|false }` (always 200)

### Auth Status

- GET `/api/auth/inoreader/status`
  - Description: Validates presence and age of encrypted OAuth tokens stored in `~/.rss-reader/tokens.json`.
  - Responses (200): `{ authenticated: boolean, status: "valid"|"expiring_soon"|"expired"|"no_tokens"|"config_error"|"invalid_format"|"unencrypted"|"empty_tokens"|"error", message, tokenAge, daysRemaining, timestamp }`
  - Other methods (POST/PUT/DELETE/PATCH): 405 Method Not Allowed

---

## Express Service Endpoints (/server/\*)

These run in the auxiliary Express server (`server/server.js`).

- POST `/server/sync/trigger`
  - Description: Triggers bi-directional sync to push local changes back to Inoreader.
  - Response 200: `{ success: true, message }`
  - Response 500: `{ error }`

- GET `/server/sync/stats`
  - Description: Returns sync queue statistics.
  - Response 200: JSON with queue stats.

- POST `/server/sync/clear-failed`
  - Description: Clears failed items from sync queue.
  - Response 200: `{ success: true, cleared }`

- POST `/server/mark-all-read`
  - Description: Proxy to Inoreader “mark-all-as-read”.
  - Request JSON: `{ streamId: string }`
  - Responses: 200 `{ success: true }`; 400 missing `streamId`; 4xx/5xx passthrough; logs to `logs/inoreader-api-calls.jsonl`.

- GET `/server/health`
  - Description: Service health summary (integrates sync/dependency checks). Returns 200 healthy, 503 unhealthy with details.

---

## Rate Limiting

- Inoreader: 100 calls/day (Zone 1) + 100/day (Zone 2). Tracked in `api_usage`. Sync aims for ~4–5 calls.
- Claude: Tracked in `api_usage` with per-call increments; cost-sensitive usage.

## Error Handling

Standard error envelope:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": "optional"
}
```

Common codes:

- `rate_limit_exceeded`, `sync_start_failed`, `article_not_found`, `extraction_failed`, `timeout`, `api_not_configured`, `invalid_api_key`, `summarization_failed`

## Testing

- Use integration tests under `src/__tests__/integration/**` to validate API responses.
- Curl quick checks:
  - Health: `/api/health`, `/api/health/db`, `/api/health/cron`, `/api/health/parsing`, `/api/health/claude`
  - Sync: `POST /api/sync` then `GET /api/sync/status/{id}`
  - Articles: `POST /api/articles/{id}/fetch-content`, `POST /api/articles/{id}/summarize`
  - Tags: `GET /api/tags`, `POST /api/tags`, `GET|PATCH|DELETE /api/tags/{id}`
  - Inoreader: `/api/inoreader/*`
  - Analytics: `GET /api/analytics/fetch-stats`
