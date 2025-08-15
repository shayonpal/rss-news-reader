# API Documentation

This directory contains documentation for all API endpoints and server-side functionality of the RSS News Reader application.

## Documents

### server-endpoints.md

- **Description**: Comprehensive documentation of all server-side API endpoints including authentication, feed management, article operations, and sync functionality
- **Status**: Current ✅ (100% OpenAPI Coverage)
- **Last Updated**: August 15, 2025 (RR-208)
- **Coverage**: 45/45 endpoints documented with full OpenAPI 3.1 schemas
- **Contents**:
  - Inoreader proxy endpoints (`/api/inoreader/*`)
  - Article content operations (`/api/articles/[id]/*`)
  - Tag management endpoints (`/api/tags/*`)
  - Sync endpoints (`/api/sync/*`)
  - Health check endpoints (`/api/health/*`)
  - Analytics endpoints (`/api/analytics/*`)
  - OpenAPI documentation endpoints (`/api-docs/*`)
  - Insomnia export endpoint (`/api/insomnia.json`)
  - Request/response formats
  - Error handling patterns

### insomnia-setup.md

- **Description**: Complete guide for importing and configuring the RSS Reader API collection in Insomnia REST client
- **Status**: Current ✅
- **Last Updated**: August 2025 (RR-204)
- **Contents**:
  - Export methods (Swagger UI button, direct API download, CLI script)
  - Import procedure into Insomnia
  - Environment configuration and authentication setup
  - Example workflows and troubleshooting guide

## Related Documentation

- **Tech Stack**: See `/docs/tech/technology-stack.md` for information about the API framework and libraries
- **Deployment**: See `/docs/deployment/environment-variables.md` for API configuration
- **Integration Details**: See `/docs/tech/api-integrations.md` for Inoreader API integration specifics

## Architecture Notes

- The API follows a server-client model where the Next.js server handles all Inoreader API calls
- OAuth tokens are stored server-side only in `~/.rss-reader/tokens.json`
- All endpoints require Tailscale network access (no public authentication)
- API rate limiting is handled server-side to respect Inoreader's 100 calls/day limit
- **Base Path (RR-102)**: All endpoints use `/reader` prefix. Development environment provides automatic redirects from `/api/*` → `/reader/api/*` for improved developer experience

## Interactive API Documentation

**🎯 Complete OpenAPI Coverage Achieved (RR-208)**

- **Swagger UI**: http://100.96.166.53:3000/reader/api-docs
- **Coverage**: 100% (45/45 endpoints documented)
- **Validation**: <2 second performance with `npm run docs:validate`
- **Workflow**: `npm run docs:serve` to launch development server + Swagger UI

### New Documentation Workflow Scripts

```bash
npm run docs:validate   # Validate OpenAPI coverage (45/45 endpoints)
npm run docs:coverage   # Generate detailed coverage report  
npm run docs:serve      # Launch dev server and open Swagger UI
```

## Quick Reference

| Category         | Count | Primary Endpoints                                                                                                                                       | Purpose                                                                                                     |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Health           | 6     | `/api/health` (alias `/api/health/app`), `/api/health/db`, `/api/health/cron`, `/api/health/parsing`, `/api/health/claude`                              | Health checks                                                                                               |
| Sync             | 7     | `/api/sync`, `/api/sync/status/{syncId}`, `/api/sync/last-sync`, `/api/sync/refresh-view`                                                               | Start sync with sidebar payload, poll status, last sync time (with cache prevention headers), refresh views |
| Inoreader        | 8     | `/api/inoreader/user-info`, `/api/inoreader/subscriptions`, `/api/inoreader/stream-contents`, `/api/inoreader/unread-counts`, `/api/inoreader/edit-tag` | Proxies to Inoreader API                                                                                    |
| Articles         | 4     | `/api/articles/[id]/fetch-content`, `/api/articles/[id]/summarize`, `/api/articles/[id]/tags`                                                           | Content extraction, AI summaries, tag management                                                            |
| Tags             | 5     | `/api/tags`, `/api/tags/[id]`                                                                                                                           | Tag listing and management                                                                                  |
| Test             | 7     | `/api/test/check-headers`, `/api/test/simulate-rate-limit` (dev only)                                                                                   | Development testing endpoints                                                                               |
| Analytics & Logs | 2     | `/api/analytics/fetch-stats`, `/api/logs/inoreader`                                                                                                     | Usage analytics, API call logging                                                                           |
| Developer Tools  | 3     | `/api/insomnia.json`, `/api-docs`, `/api-docs/openapi.json`                                                                                             | Insomnia export, OpenAPI documentation, Swagger UI                                                          |
| Auth, Feeds, Users | 5   | `/api/auth/inoreader/status`, `/api/feeds/{id}/stats`, `/api/users/{id}/timezone`                                                                       | Authentication status, feed statistics, user management                                                     |

**Note**: Feed and article data are accessed directly via Supabase from the client. Base `/api/feeds` and `/api/articles` endpoints don't exist.

## Key API Response Formats

### POST /api/sync Response

The sync endpoint returns comprehensive metrics and sidebar payload data for immediate UI updates:

```json
{
  "syncId": "uuid-string",
  "status": "completed|partial|failed",
  "metrics": {
    "newArticles": 15,
    "deletedArticles": 3,
    "newTags": 2,
    "failedFeeds": 0,
    "totalFeeds": 25,
    "duration": 2340
  },
  "sidebar": {
    "feedCounts": [{ "feedId": "uuid", "unreadCount": 12, "totalCount": 45 }],
    "tags": [{ "id": "uuid", "name": "Technology", "count": 8 }]
  }
}
```

### GET /api/sync/status/{syncId} Response

```json
{
  "syncId": "uuid-string",
  "status": "pending|running|completed|failed",
  "startedAt": "2025-08-09T13:18:00Z",
  "completedAt": "2025-08-09T13:18:02Z",
  "progress": {
    "currentStep": "Syncing articles",
    "totalSteps": 5,
    "completedSteps": 3
  }
}
```

### 429 Rate Limit Response

```json
{
  "error": "RATE_LIMITED",
  "message": "Sync rate limited. Please wait before trying again.",
  "retryAfter": 25,
  "headers": {
    "Retry-After": "25"
  }
}
```

For complete endpoint details, request/response formats, and error envelopes, see: `docs/api/server-endpoints.md`.
