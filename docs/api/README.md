# API Documentation

This directory contains documentation for all API endpoints and server-side functionality of the RSS News Reader application.

## Documents

### server-endpoints.md
- **Description**: Comprehensive documentation of all server-side API endpoints including authentication, feed management, article operations, and sync functionality
- **Status**: Current ✅
- **Last Updated**: July 2025
- **Contents**:
  - Authentication endpoints (`/api/auth/*`)
  - Feed management endpoints (`/api/feeds/*`)
  - Article operations (`/api/articles/*`)
  - Sync endpoints (`/api/sync/*`)
  - Health check endpoints (`/api/health/*`)
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
|----------|------------------|----------|
| Auth | `/api/auth/login`, `/api/auth/status` | OAuth flow and session management |
| Feeds | `/api/feeds`, `/api/feeds/[id]` | Feed CRUD operations |
| Articles | `/api/articles`, `/api/articles/[id]` | Article management and state |
| Sync | `/api/sync/manual`, `/api/sync/status` | Manual and automatic sync |
| Health | `/api/health/app`, `/api/health/db` | System health monitoring |