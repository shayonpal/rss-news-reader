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

**Description:** Generates a 150-175 word summary using Claude 3.5 Sonnet

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
  "model": "claude-3-5-sonnet-latest",
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

Visit `/test-server-api` to interactively test all endpoints with a user-friendly interface.

---

## Implementation Notes

1. **Server-Side Only:** These endpoints run on the server to protect API keys and handle rate limiting
2. **Caching:** Both content extraction and summaries are cached to minimize API calls
3. **Background Processing:** Sync runs asynchronously to avoid timeouts
4. **Error Recovery:** All operations handle failures gracefully with proper error messages
5. **Security:** No authentication required as access is controlled by Tailscale network