# Technical Documentation

This directory contains all technical documentation for the RSS News Reader application, including architecture decisions, integration details, and implementation strategies.

## Documents

### Core Technical Documentation

1. **technology-stack.md**
   - **Description**: Complete technology stack documentation including frameworks, libraries, and tools
   - **Status**: Current ✅
   - **Contents**: Next.js 14, TypeScript, Supabase, PM2, Tailwind CSS, and all dependencies

2. **ci-cd-pipeline.md**
   - **Description**: Comprehensive GitHub Actions CI/CD pipeline documentation with progressive testing strategy
   - **Status**: Current ✅ (Added for RR-185)
   - **Contents**: Pipeline architecture, quality gates, test matrix, performance monitoring, security scanning

3. **implementation-strategy.md**
   - **Description**: High-level implementation approach and architectural decisions
   - **Status**: Current ✅
   - **Contents**: Project phases, development workflow, testing strategy, deployment approach

4. **api-integrations.md**
   - **Description**: Detailed documentation of external API integrations (Inoreader, Claude AI)
   - **Status**: Current ✅ (Updated for RR-171)
   - **Contents**: Authentication flows, rate limits, endpoints, error handling, sidebar payload, concurrency control

### Feature-Specific Documentation

5. **bidirectional-sync-investigation.md**
   - **Description**: Investigation and implementation of two-way sync with Inoreader
   - **Status**: Completed ✅
   - **Contents**: Sync architecture, conflict resolution, implementation details

6. **button-architecture.md**
   - **Description**: Standardized button component architecture and design system
   - **Status**: Current ✅
   - **Contents**: Button variants, states, accessibility, usage guidelines

7. **sync-progress-tracking-architecture.md**
   - **Description**: Dual-write sync progress tracking system with file system and database storage
   - **Status**: Current ✅
   - **Contents**: Architecture patterns, implementation details, API endpoints, monitoring

8. **cleanup-architecture.md**
   - **Description**: Database cleanup system with chunked deletion for handling large datasets
   - **Status**: Current ✅ (Updated for RR-150)
   - **Contents**: Feed and article cleanup, deletion tracking, chunked deletion to solve URI length limits

### Tag Management System (RR-128)

9. **Tag Architecture**
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

### Responsive Design System (RR-206)

10. **Responsive Architecture**
    - **Description**: Comprehensive responsive design implementation with three-tier breakpoint system
    - **Status**: Implemented ✅
    - **Contents**: Viewport detection, breakpoint management, responsive component architecture
    - **Key Features**:
      - `useViewport()` hook with SSR support and 50ms debouncing
      - Centralized breakpoint constants (`src/lib/constants/breakpoints.ts`)
      - Three-tier responsive system: Mobile (<768px), Tablet (768-1023px), Desktop (≥1024px)
      - Responsive components: ArticleHeader, ReadStatusFilter, main layout
      - Automatic sidebar collapse and hamburger menu on mobile
      - Adaptive filter button display (icons-only on mobile/tablet, full text on desktop)
      - Performance-optimized with smooth 60fps transitions

### Monitoring & Infrastructure

11. **uptime-kuma-setup.md**

- **Description**: Setup guide for Uptime Kuma monitoring service
- **Status**: Current ✅
- **Contents**: Docker setup, monitor configuration, alert rules

12. **uptime-kuma-monitoring-strategy.md**

- **Description**: Comprehensive monitoring strategy using Uptime Kuma
- **Status**: Current ✅
- **Contents**: Monitoring objectives, metrics, alerting strategy, dashboards

### Issues & Maintenance

13. **known-issues.md**
    - **Description**: Documentation of known issues, limitations, and workarounds
    - **Status**: Living Document 🔄
    - **Contents**: Current bugs, API limitations, performance considerations, planned fixes

14. **security.md**
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
6. **Race Condition Prevention (RR-216)**: Two-layer protection for filter state preservation

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
      tagStore.refresh(),
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

## RR-216 Filter State Race Condition Architecture

### Problem

Filtered views (tag filters, feed filters) would intermittently show all articles instead of filtered results after back navigation, due to race conditions in the article loading pipeline.

### Solution: Two-Layer Protection

#### Layer 1: Gating with `filtersReady`

```typescript
// src/app/page.tsx
const [filtersReady, setFiltersReady] = useState(false);

useEffect(() => {
  const initializeFilters = async () => {
    await parseFiltersFromUrl(); // Parse URL parameters first
    setFiltersReady(true); // Signal that filters are ready
  };
  initializeFilters();
}, []);
```

#### Layer 2: Sequencing with `loadSeq`

```typescript
// src/lib/stores/article-store.ts
class ArticleStore {
  private loadSeq = 0;

  async loadArticles() {
    const currentSeq = ++this.loadSeq; // Increment sequence

    const data = await api.getArticles();

    // Only apply if this is still the current request
    if (currentSeq === this.loadSeq) {
      this.articles = data;
    }
    // Stale requests are discarded
  }
}
```

#### Component Integration

```typescript
// src/components/articles/article-list.tsx
export function ArticleList() {
  const { filtersReady } = usePageState();

  if (!filtersReady) {
    return <LoadingState />; // Prevent loading until filters ready
  }

  return <ArticleListContent />;
}
```

### Benefits

1. **Eliminates Race Conditions**: Filter state is established before article loading
2. **Prevents Stale Data**: Sequence numbers discard outdated API responses
3. **Improves Navigation**: Back button reliably shows filtered content
4. **Maintains Performance**: Minimal overhead with immediate user feedback

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

# Code Quality & Documentation
npm run type-check          # TypeScript compilation check
npm run lint                 # ESLint code quality check
npm run format:check         # Prettier formatting check
npm run format               # Fix formatting issues
npm run docs:validate        # OpenAPI documentation coverage (45/45 endpoints)
npm run docs:coverage        # Detailed documentation coverage report
npm run docs:serve          # Launch dev server and open Swagger UI

# Testing
npm run test                 # Run test suite
npm run test:parallel        # Optimized parallel test execution
npm run pre-commit          # Full validation pipeline (same as pre-commit hook)
```

### Git Pre-commit Hook (RR-210)

**Automatic Quality Gates**: The project includes a comprehensive pre-commit hook that automatically runs before each commit:

```bash
# Hook runs automatically on commit
git commit -m "your changes"

# Manual hook testing
./.git/hooks/pre-commit

# Emergency bypass (not recommended)
git commit --no-verify -m "emergency commit"
```

**Validation Steps** (run in sequence with individual failure tracking):

1. **Type Check** (30s timeout): Ensures TypeScript compilation success
2. **Lint Check** (30s timeout): Validates code quality standards
3. **Format Check** (30s timeout): Verifies Prettier formatting (non-blocking)
4. **OpenAPI Documentation** (60s timeout): Enforces 100% API documentation coverage

**Benefits**:

- **Quality Assurance**: Prevents committing code that fails basic quality checks
- **Documentation Compliance**: Ensures all API endpoints maintain complete OpenAPI documentation
- **Fast Feedback**: Fails early on critical issues, provides clear error messages
- **Performance Optimized**: Completes in under 90 seconds with timeout protection

---

_This technical documentation provides comprehensive information about the architecture, implementation, and maintenance of the RSS News Reader application._
