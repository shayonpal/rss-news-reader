# Technical Documentation

This directory contains all technical documentation for the RSS News Reader application, including architecture decisions, integration details, and implementation strategies.

## Documents

### Core Technical Documentation

1. **technology-stack.md**

   - **Description**: Complete technology stack documentation including frameworks, libraries, and tools
   - **Status**: Current ✅
   - **Contents**: Next.js 14, TypeScript, Supabase, PM2, Tailwind CSS, and all dependencies

2. **implementation-strategy.md**

   - **Description**: High-level implementation approach and architectural decisions
   - **Status**: Current ✅
   - **Contents**: Project phases, development workflow, testing strategy, deployment approach

3. **api-integrations.md**
   - **Description**: Detailed documentation of external API integrations (Inoreader, Claude AI)
   - **Status**: Current ✅ (Updated for RR-171)
   - **Contents**: Authentication flows, rate limits, endpoints, error handling, sidebar payload, concurrency control

### Feature-Specific Documentation

4. **bidirectional-sync-investigation.md**

   - **Description**: Investigation and implementation of two-way sync with Inoreader
   - **Status**: Completed ✅
   - **Contents**: Sync architecture, conflict resolution, implementation details

5. **button-architecture.md**

   - **Description**: Standardized button component architecture and design system
   - **Status**: Current ✅
   - **Contents**: Button variants, states, accessibility, usage guidelines

6. **sync-progress-tracking-architecture.md**
   - **Description**: Dual-write sync progress tracking system with file system and database storage
   - **Status**: Current ✅
   - **Contents**: Architecture patterns, implementation details, API endpoints, monitoring

7. **cleanup-architecture.md**
   - **Description**: Database cleanup system with chunked deletion for handling large datasets
   - **Status**: Current ✅ (Updated for RR-150)
   - **Contents**: Feed and article cleanup, deletion tracking, chunked deletion to solve URI length limits

### Tag Management System (RR-128)

8. **Tag Architecture**
   - **Description**: Comprehensive tag management system with full CRUD operations and XSS protection
   - **Status**: Implemented ✅ 
   - **Contents**: Tag creation, filtering, article association, HTML entity decoding, sidebar integration
   - **Key Features**: 
     - Tag API endpoints (`/api/tags`, `/api/articles/[id]/tags`)
     - Database schema with `tags` and `article_tags` tables
     - XSS protection via React's built-in safeguards and HTML entity decoding
     - Tag sync from Inoreader categories
     - Sidebar "Topics" section display
     - Comprehensive test coverage

### Monitoring & Infrastructure

9. **uptime-kuma-setup.md**

   - **Description**: Setup guide for Uptime Kuma monitoring service
   - **Status**: Current ✅
   - **Contents**: Docker setup, monitor configuration, alert rules

10. **uptime-kuma-monitoring-strategy.md**
   - **Description**: Comprehensive monitoring strategy using Uptime Kuma
   - **Status**: Current ✅
   - **Contents**: Monitoring objectives, metrics, alerting strategy, dashboards

### Issues & Maintenance

11. **known-issues.md**

    - **Description**: Documentation of known issues, limitations, and workarounds
    - **Status**: Living Document 🔄
    - **Contents**: Current bugs, API limitations, performance considerations, planned fixes

12. **security.md**
    - **Description**: Security measures, policies, and incident documentation
    - **Status**: Current ✅ (Updated for RR-128)
    - **Contents**: Network security, authentication, security fixes (RR-69, RR-128), XSS protection, best practices

## Architecture Overview

### System Architecture

```
┌────────────────┐
│   Inoreader    │
│   (External)   │
└───────┬───────┘
        │
┌───────┴───────┐
│  Next.js Server │
│  (Port 3147)    │
└───────┬───────┘
        │
┌───────┴───────┐
│    Supabase     │
│  (PostgreSQL)   │
└────────────────┘
```

### Key Technical Decisions

1. **Server-Side OAuth**: All authentication handled server-side for security
2. **Hybrid Storage**: Supabase for persistence, IndexedDB for offline
3. **PM2 Process Management**: Reliable process management with auto-restart
4. **Tailscale Access Control**: Network-level security instead of app auth
5. **PWA Architecture**: Offline-first with service workers

## RR-171 RefreshManager Pattern

### Overview

The RefreshManager pattern coordinates UI updates across multiple store sections after sync operations, ensuring consistent state management and user feedback.

### Implementation

```typescript
class RefreshManager {
  async refreshAll(): Promise<void> {
    await Promise.all([
      feedStore.refresh(),
      articleStore.refresh(), 
      tagStore.refresh()
    ]);
  }
  
  async handleManualSync(): Promise<void> {
    showSkeletons();
    const result = await syncApi.triggerSync();
    applySidebarData(result.sidebar);
    hideSkeletons();
    showToast(formatSyncResult(result));
  }
  
  async handleBackgroundSync(): Promise<void> {
    const result = await syncApi.triggerSync();
    applySidebarData(result.sidebar);
    if (result.metrics.newArticles > 0) {
      showInfoToast(`${result.metrics.newArticles} new articles available`);
    }
  }
}
```

### Key Features

- **Skeleton States**: Visual loading feedback during manual sync operations
- **Sidebar Application**: Direct application of sync response data to avoid timing issues
- **Toast Formatting**: Consistent user feedback with sync metrics (no emojis)
- **Background Sync Behavior**: Silent updates with optional refresh action notifications

## Development Guidelines

### Code Organization

- `/app` - Next.js 14 app directory structure
- `/components` - Reusable React components
- `/lib` - Utility functions and helpers
- `/services` - API integration services
- `/types` - TypeScript type definitions

### Testing Strategy

- Unit tests for utilities and services
- Integration tests for API endpoints
- E2E tests for critical user flows
- Manual testing for PWA features

### Performance Targets

- Page load: < 2 seconds
- API response: < 500ms
- Sync operation: < 10 seconds
- Memory usage: < 512MB

## Related Documentation

- **API Details**: See `/docs/api/server-endpoints.md`
- **Deployment**: See `/docs/deployment/` directory
- **Product Specs**: See `/docs/product/` directory
- **UI/UX**: See `/docs/ui-ux/` directory

## Quick Reference

### Technology Versions

- Next.js: 14.2.5
- React: 18.3.1
- TypeScript: 5.5.4
- Node.js: 18+
- PM2: Latest

### Key Dependencies

- Supabase Client: 2.45.4
- Tailwind CSS: 3.4.1
- SWR: 2.2.5
- Radix UI: Latest

### Development Commands

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start

# Type check
npm run type-check
```

---

_This technical documentation provides comprehensive information about the architecture, implementation, and maintenance of the RSS News Reader application._
