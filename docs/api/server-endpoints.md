# Server API Endpoints (US-103)

This document describes the server API endpoints implemented as part of US-103.

## Overview

All server API endpoints are designed to handle complex operations that should not run on the client:

- External API communication (Inoreader)
- Content extraction (Mozilla Readability)
- AI summarization (Claude API)
- Rate limiting and usage tracking

## Endpoints

### 1. Trigger Manual Sync

**Endpoint:** `POST /api/sync`

**Description:** Triggers a server-side sync with Inoreader API

**Request:**

```json
POST /api/sync
Content-Type: application/json
```

**Response (Success):**

```json
{
  "success": true,
  "syncId": "uuid-string",
  "message": "Sync started successfully",
  "rateLimit": {
    "remaining": 96,
    "limit": 100,
    "used": 4
  }
}
```

**Response (Rate Limited):**

```json
{
  "error": "rate_limit_exceeded",
  "message": "Inoreader API rate limit exceeded",
  "limit": 100,
  "used": 100,
  "remaining": 0
}
```

**Status Codes:**

- 200: Success
- 429: Rate limit exceeded
- 500: Server error

---

### 2. Check Sync Status

**Endpoint:** `GET /api/sync/status/:syncId`

**Description:** Polls the status of an ongoing sync operation

**Request:**

```
GET /api/sync/status/123e4567-e89b-12d3-a456-426614174000
```

**Response:**

```json
{
  "syncId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "running",
  "progress": 70,
  "message": "Processing 164 articles...",
  "startTime": 1737510123456
}
```

**Status Values:**

- `pending`: Sync queued but not started
- `running`: Sync in progress
- `completed`: Sync finished successfully
- `failed`: Sync failed with error

---

### 3. Extract Article Content

**Endpoint:** `POST /api/articles/:id/fetch-content`

**Description:** Extracts clean, readable content from article URL using Mozilla Readability

**Request:**

```json
POST /api/articles/550e8400-e29b-41d4-a716-446655440000/fetch-content
Content-Type: application/json
```

**Response (Success):**

```json
{
  "success": true,
  "content": "<p>Clean article content...</p>",
  "title": "Extracted Article Title",
  "excerpt": "Article excerpt...",
  "byline": "Author Name",
  "length": 2345,
  "siteName": "Example News",
  "cached": false
}
```

**Response (Cached):**

```json
{
  "success": true,
  "content": "<p>Previously extracted content...</p>",
  "cached": true
}
```

**Response (Fallback):**

```json
{
  "success": true,
  "content": "<p>RSS feed content...</p>",
  "fallback": true
}
```

**Status Codes:**

- 200: Success
- 400: No URL available
- 404: Article not found
- 408: Timeout (10 second limit)
- 500: Extraction failed

---

### 4. Generate AI Summary

**Endpoint:** `POST /api/articles/:id/summarize`

**Description:** Generates a 150-175 word summary using Claude 4 Sonnet

**Request:**

```json
POST /api/articles/550e8400-e29b-41d4-a716-446655440000/summarize
Content-Type: application/json

{
  "regenerate": true  // Optional, forces new summary
}
```

**Response (Success):**

```json
{
  "success": true,
  "summary": "This article discusses the latest developments in...",
  "model": "claude-sonnet-4-20250514",
  "regenerated": false,
  "input_tokens": 1234,
  "output_tokens": 175
}
```

**Response (Cached):**

```json
{
  "success": true,
  "summary": "Previously generated summary...",
  "cached": true
}
```

**Status Codes:**

- 200: Success
- 400: No content to summarize
- 401: Invalid API key
- 404: Article not found
- 429: Claude API rate limit
- 503: Claude API not configured
- 500: Summarization failed

---

### 5. Application Health Check

**Endpoint:** `GET /api/health/app`

**Description:** Comprehensive health check for the main Next.js application

**Request:**

```
GET /api/health/app
```

**Response (Healthy):**

```json
{
  "status": "healthy",
  "service": "rss-reader-app",
  "uptime": 3456,
  "lastActivity": "2025-07-26T22:30:00Z",
  "errorCount": 0,
  "dependencies": {
    "database": "healthy",
    "oauth": "healthy"
  },
  "performance": {
    "avgResponseTime": 45
  },
  "details": {
    "version": "0.7.0",
    "nodeVersion": "20.11.0",
    "syncStatus": "idle",
    "memoryUsage": 56789012,
    "tokenExpiry": "2025-07-27T10:00:00Z"
  }
}
```

**Status Codes:**

- 200: Healthy or degraded
- 503: Unhealthy

---

### 6. Database Health Check

**Endpoint:** `GET /api/health/db`

**Description:** Tests database connectivity and query performance

**Request:**

```
GET /api/health/db
```

**Response (Healthy):**

```json
{
  "status": "healthy",
  "service": "database",
  "timestamp": "2025-07-26T22:30:00Z",
  "performance": {
    "queryTime": 12,
    "connectionTime": 5
  },
  "details": {
    "host": "db.rgfxyraamghqnechkppg.supabase.co",
    "database": "postgres",
    "ssl": true,
    "rowCount": 1
  }
}
```

**Response (Unhealthy):**

```json
{
  "status": "unhealthy",
  "service": "database",
  "timestamp": "2025-07-26T22:30:00Z",
  "error": "Connection timeout",
  "details": {
    "message": "Unable to connect to database"
  }
}
```

**Status Codes:**

- 200: Healthy
- 503: Database connection error

---

### 7. Cron Service Health Check

**Endpoint:** `GET /api/health/cron`

**Description:** Returns the health status of the sync cron service by reading health file

**Request:**

```
GET /api/health/cron
```

**Response:**

```json
{
  "status": "healthy",
  "service": "rss-sync-cron",
  "lastRun": "2025-07-26T14:00:00Z",
  "nextRun": "2025-07-27T02:00:00Z",
  "lastRunSuccess": true,
  "consecutiveFailures": 0,
  "details": {
    "articlesSync": 69,
    "feedsSync": 45,
    "duration": 4500
  }
}
```

### 8. Article Freshness Health Check

**Endpoint:** `GET /api/health/freshness`

**Description:** Checks if articles are fresh by analyzing recent article timestamps and sync activity

**Request:**

```
GET /api/health/freshness
```

**Response (Fresh Articles):**

```json
{
  "status": "healthy",
  "lastSyncAt": "2025-07-28T12:00:00Z",
  "newestArticleAt": "2025-07-28T11:45:00Z",
  "articlesInLast12Hours": 42,
  "totalArticles": 1847,
  "details": {
    "hoursSinceLastSync": 1.1,
    "hoursSinceNewestArticle": 1.25,
    "stalenessStatus": "fresh"
  }
}
```

**Response (Stale Articles):**

```json
{
  "status": "warning",
  "lastSyncAt": "2025-07-26T14:00:00Z",
  "newestArticleAt": "2025-07-26T13:45:00Z",
  "articlesInLast12Hours": 0,
  "totalArticles": 1805,
  "details": {
    "hoursSinceLastSync": 46.1,
    "hoursSinceNewestArticle": 46.25,
    "stalenessStatus": "stale",
    "warning": "No new articles in 12+ hours"
  }
}
```

---

## Rate Limiting

### Inoreader API

- **Limit:** 100 calls per day
- **Reset:** Midnight UTC
- **Tracking:** Stored in `api_usage` table
- **Sync Usage:** ~4-5 calls per sync

### Claude API

- **Limit:** Based on Anthropic account tier
- **Tracking:** Each summarization tracked in `api_usage` table
- **Cost:** Approximately $0.003 per summary

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": "Additional error details (optional)"
}
```

Common error codes:

- `rate_limit_exceeded`: API rate limit hit
- `article_not_found`: Article ID not found
- `sync_start_failed`: Failed to initiate sync
- `extraction_failed`: Content extraction failed
- `summarization_failed`: AI summary generation failed
- `api_not_configured`: Required API key missing

---

## Database Tables

### api_usage

Tracks API usage for rate limiting:

```sql
CREATE TABLE api_usage (
  id UUID PRIMARY KEY,
  service VARCHAR(50),     -- 'inoreader', 'claude'
  date DATE,
  count INTEGER,
  created_at TIMESTAMP
);
```

### sync_metadata

Stores sync-related metadata:

```sql
CREATE TABLE sync_metadata (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP
);
```

### articles (extended columns)

```sql
ALTER TABLE articles ADD COLUMN full_content TEXT;
ALTER TABLE articles ADD COLUMN has_full_content BOOLEAN;
ALTER TABLE articles ADD COLUMN ai_summary TEXT;
ALTER TABLE articles ADD COLUMN author VARCHAR(255);
```

---

## Testing

Use curl commands or tools like Postman to test endpoints directly. All test/debug endpoints have been removed for security reasons.

### Curl Examples

#### Health Checks

```bash
# Application health
curl http://100.96.166.53:3147/reader/api/health/app

# Database health
curl http://100.96.166.53:3147/reader/api/health/db

# Cron health
curl http://100.96.166.53:3147/reader/api/health/cron

# Article freshness
curl http://100.96.166.53:3147/reader/api/health/freshness
```

#### Manual Sync

```bash
# Trigger manual sync
curl -X POST http://100.96.166.53:3147/reader/api/sync \
  -H "Content-Type: application/json"
```

#### Article Operations

```bash
# Fetch full article content
curl -X POST http://100.96.166.53:3147/reader/api/articles/ARTICLE_ID/fetch-content \
  -H "Content-Type: application/json"

# Generate AI summary
curl -X POST http://100.96.166.53:3147/reader/api/articles/ARTICLE_ID/summarize \
  -H "Content-Type: application/json"
```

---

## Implementation Notes

1. **Server-Side Only:** These endpoints run on the server to protect API keys and handle rate limiting
2. **Caching:** Both content extraction and summaries are cached to minimize API calls
3. **Background Processing:** Sync runs asynchronously to avoid timeouts
4. **Error Recovery:** All operations handle failures gracefully with proper error messages
5. **Security:** No authentication required as access is controlled by Tailscale network
