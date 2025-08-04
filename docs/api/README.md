# API Documentation

This directory contains documentation for all API endpoints and server-side functionality of the RSS News Reader application.

## Documents

### server-endpoints.md

- **Description**: Comprehensive documentation of all server-side API endpoints including authentication, feed management, article operations, and sync functionality
- **Status**: Current ✅
- **Last Updated**: July 2025
- **Contents**:
  - Inoreader proxy endpoints (`/api/inoreader/*`)
  - Article content operations (`/api/articles/[id]/*`)
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

| Category | Primary Endpoints                               | Purpose                           |
| -------- | ----------------------------------------------- | --------------------------------- |
| Inoreader| `/api/inoreader/user-info`, `/api/inoreader/subscriptions` | Proxy to Inoreader API |
| Articles | `/api/articles/[id]/fetch-content`, `/api/articles/[id]/summarize` | Content extraction and AI summaries |
| Sync     | `/api/sync`, `/api/sync/status`                 | Manual and automatic sync         |
| Health   | `/api/health/app`, `/api/health/db`             | System health monitoring          |
| Analytics| `/api/analytics/fetch-stats`                    | Usage analytics                   |

**Note**: Feed and article data are accessed directly via Supabase from the client. Base `/api/feeds` and `/api/articles` endpoints don't exist.
