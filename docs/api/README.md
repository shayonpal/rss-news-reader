# API Documentation

This directory contains documentation for all API endpoints and server-side functionality of the RSS News Reader application.

## Documents

### server-endpoints.md

- **Description**: Comprehensive documentation of all server-side API endpoints including authentication, feed management, article operations, and sync functionality
- **Status**: Current ✅
- **Last Updated**: August 2025
- **Contents**:
  - Inoreader proxy endpoints (`/api/inoreader/*`)
  - Article content operations (`/api/articles/[id]/*`)
  - Tag management endpoints (`/api/tags/*`)
  - Sync endpoints (`/api/sync/*`)
  - Health check endpoints (`/api/health/*`)
  - Analytics endpoints (`/api/analytics/*`)
  - Request/response formats
  - Error handling patterns

## Related Documentation

- **Tech Stack**: See `/docs/tech/technology-stack.md` for information about the API framework and libraries
- **Deployment**: See `/docs/deployment/environment-variables.md` for API configuration
- **Integration Details**: See `/docs/tech/api-integrations.md` for Inoreader API integration specifics

## Architecture Notes

- The API follows a server-client model where the Next.js server handles all Inoreader API calls
- OAuth tokens are stored server-side only in `~/.rss-reader/tokens.json`
- All endpoints require Tailscale network access (no public authentication)
- API rate limiting is handled server-side to respect Inoreader's 100 calls/day limit

## Quick Reference

| Category | Primary Endpoints | Purpose |
| -------- | ----------------- | ------- |
| Inoreader | `/api/inoreader/user-info`, `/api/inoreader/subscriptions`, `/api/inoreader/stream-contents`, `/api/inoreader/unread-counts`, `/api/inoreader/edit-tag` | Proxies to Inoreader API |
| Articles | `/api/articles/[id]/fetch-content`, `/api/articles/[id]/summarize`, `/api/articles/[id]/tags` | Content extraction, AI summaries, tag management |
| Tags | `/api/tags`, `/api/tags/[id]` | Tag listing and management |
| Sync | `/api/sync`, `/api/sync/status/{syncId}`, `/api/sync/last-sync`, `/api/sync/refresh-view` | Start sync, poll status, last sync time, refresh views |
| Health | `/api/health` (alias `/api/health/app`), `/api/health/db`, `/api/health/cron`, `/api/health/parsing`, `/api/health/claude` | Health checks |
| Analytics & Logs | `/api/analytics/fetch-stats`, `/api/logs/inoreader` | Usage analytics, API call logging |

**Note**: Feed and article data are accessed directly via Supabase from the client. Base `/api/feeds` and `/api/articles` endpoints don't exist.

For complete endpoint details, request/response formats, and error envelopes, see: `docs/api/server-endpoints.md`.
