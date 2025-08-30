# Shayon's News - RSS Reader PWA

[![GitHub](https://img.shields.io/badge/GitHub-shayonpal%2Frss--news--reader-blue)](https://github.com/shayonpal/rss-news-reader)
[![Status](https://img.shields.io/badge/Status-Active-green)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20iOS%20%7C%20Android-lightgrey)]()

A self-hosted RSS reader with server-client architecture, AI-powered summaries, and Tailscale network security. The server handles all Inoreader API communication while the client provides a clean, authentication-free reading experience.

## Features

- **Server-Client Architecture**: Server handles all external APIs, client is presentation only
- **No Client Authentication**: Access controlled by Tailscale network
- **Progressive Web App**: Install on mobile and desktop devices with iOS touch-optimized interface
- **iOS 26 Liquid Glass Design**: Advanced morphing animations with spring easing and enhanced glass effects
- **Floating Controls Architecture**: iOS-inspired floating controls replacing traditional fixed headers
  - **Reusable ScrollHideFloatingElement**: Standardized scroll-responsive behavior for floating UI components
  - **Adaptive Glass System**: Enhanced translucency with automatic dark mode content visibility adjustments
  - **PWA Safe Area Integration**: Consistent spacing and positioning across all iOS devices and orientations
- **Full Content Extraction**: Extract complete articles beyond RSS snippets (v0.6.0)
  - Manual fetch button for any article
  - Smart content priority display
  - Comprehensive fetch statistics dashboard
  - Note: Automatic fetching removed in RR-162 for improved sync performance
- **AI-Powered Summaries**: Generate article summaries using Claude API (server-side)
- **Author Display**: Shows article authors in list and detail views (v0.12.0)
- **Navigation State Preservation**: Articles remain visible when returning from detail view (v0.12.0)
- **Server-Side Sync**: Efficient sync with only 4-5 API calls
- **Bi-directional Sync**: Changes sync back to Inoreader (read/unread, star/unstar)
- **Mark All Read**: Quickly mark all articles in a feed as read with two-tap confirmation
- **Clean Design**: Minimalist interface inspired by Reeder 5
- **Inoreader Integration**: Server syncs with existing subscriptions
- **Feed Hierarchy**: Collapsible folder structure with unread counts
- **Intuitive Sidebar Navigation (RR-193)**: Mutex accordion behavior with clean single-scroll experience
  - Only one sidebar section (Topics OR Feeds) open at a time preventing UI confusion
  - Eliminated nested scrollbars with CSS Grid layout for smooth navigation
  - Mobile-optimized full-width overlay with improved touch targets
  - Smart default state: Topics open, Feeds closed for consistent user experience
- **Responsive Design**: Adaptive layout for mobile and desktop
- **Dark/Light Mode**: Manual theme control
- **Supabase Backend**: All client data served from PostgreSQL

## Server Architecture

The RSS News Reader requires several services to be running for full functionality:

### Services & Ports

| Service Name        | PM2 Process Name | Port | Purpose                              |
| ------------------- | ---------------- | ---- | ------------------------------------ |
| RSS Reader Dev      | rss-reader-dev   | 3000 | Development/main web application     |
| Sync Cron Service   | rss-sync-cron    | N/A  | Automated article syncing (6x daily) |
| Supabase PostgreSQL | N/A              | 5432 | Database server (cloud-hosted)       |
| Tailscale           | N/A              | N/A  | VPN for secure network access        |

### Essential Startup Commands

```bash
# Start all services
pm2 start ecosystem.config.js

# Check service status
pm2 status

# View service logs
pm2 logs rss-reader-dev
pm2 logs rss-sync-cron

# Restart services
pm2 restart rss-reader-dev
pm2 restart rss-sync-cron

# Stop services
pm2 stop all
```

### Health Check Endpoints

- **Application Health**: http://100.96.166.53:3000/reader/api/health/app
- **Database Health**: http://100.96.166.53:3000/reader/api/health/db
- **Parsing/Content Health**: http://100.96.166.53:3000/reader/api/health/parsing
- **Cron Service Status**: http://100.96.166.53:3000/reader/api/health/cron
- **Sync Status**: Check via PM2 logs for `rss-sync-cron`

**Development Note (RR-102)**: In development environment, API endpoints work with or without the `/reader` prefix:

- Both `http://100.96.166.53:3000/api/health/app` and `http://100.96.166.53:3000/reader/api/health/app` work
- Automatic 307 redirects preserve HTTP methods and request bodies
- Production environment still requires the `/reader` prefix

### Monitoring

The RSS News Reader includes comprehensive multi-layered monitoring implemented after RR-26 sync failure resolution:

#### External Monitoring (Uptime Kuma)

- **Access URL**: http://100.96.166.53:3080 (within Tailscale network)
- **Services Monitored**: Complete coverage of all RSS Reader services
  - RSS Reader Development (port 3000)
  - Bi-directional Sync Server (port 3001)
  - Health Endpoint
  - Cron Service Health (file-based check)
  - Sync API Endpoint monitoring
  - Article freshness checks
- **Push Notifications**: Integrated with cron service for sync success/failure tracking
- **Docker Deployment**: Running on Colima Docker for isolation

#### Internal Monitoring Scripts

**Quick Status Dashboard**:

```bash
./scripts/monitor-dashboard.sh
```

Provides comprehensive overview of all services, PM2 processes, sync health, and recent alerts.

**Sync Health Monitor**:

```bash
# Check sync status
./scripts/sync-health-monitor.sh check

# Run as daemon (auto-starts with system)
./scripts/sync-health-monitor.sh daemon
```

Dedicated sync monitoring with alerts for consecutive failures, stale content, and service issues.

**Service Recovery Monitor**:

```bash
./scripts/monitor-services.sh start
```

Auto-restarts failed services with rate limiting and Discord alert integration.

#### Alert Channels

- **Discord Webhook**: Immediate alerts for critical failures with @everyone mentions
- **Uptime Kuma Dashboard**: Visual monitoring with historical data and response times
- **Batched Alerts**: Prevents notification spam during temporary issues

### Network Requirements

**Important**: All access is controlled through Tailscale VPN. Ensure:

- Tailscale is running and connected
- You're connected to the same Tailscale network
- Access URLs via Tailscale IP (100.96.166.53)

The application is not accessible via public internet by design for security.

## Technology Stack

### Server

- **Runtime**: Node.js with Express
- **Authentication**: OAuth 2.0 with encrypted token storage
- **Automation**: Playwright for OAuth setup
- **Data Sync**: Inoreader API → Supabase

### Client

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v3+ with Typography plugin
- **State Management**: Zustand
- **Data Storage**: Supabase (PostgreSQL)
- **UI Components**: Radix UI primitives + custom components
- **PWA**: Service Worker with Workbox

## Automatic Daily Sync

The RSS reader includes an automatic sync service that runs 6 times daily to keep your articles fresh:

- **Schedule**: Every 4 hours at 2, 6, 10 AM and 2, 6, 10 PM (America/Toronto timezone)
- **Implementation**: Node.js cron service running as separate PM2 process
- **API Efficiency**: 24-30 API calls daily (well within 200 daily limit - 100 Zone 1 + 100 Zone 2)
- **Logging**: All sync operations logged to JSONL format for analysis
- **Error Handling**: Automatic retry with exponential backoff

### Sync Features

- **Manual Sync**: On-demand sync with immediate UI updates from sidebar payload data
- **Background Sync**: Automated 6x daily sync with unobtrusive info toasts
- **Real-time Updates**: Sidebar counts and tags refresh immediately after sync completion
- **Incremental Sync**: Only fetches articles newer than last sync using 'ot' parameter
- **Efficiency Optimization**: Excludes read articles from sync using 'xt' parameter
- **Weekly Full Sync**: Every 7 days performs complete sync for data integrity
- Fetches up to 500 new articles per sync (configurable via SYNC_MAX_ARTICLES)
- **Article Retention**: Automatically enforces 1000-article limit during sync
- **Skeleton Loading**: Visual feedback during manual sync operations with rate-limit countdown
- Updates read/unread counts
- Refreshes feed statistics materialized view
- Tracks success/failure metrics

### Build Validation

The RSS Reader includes a comprehensive build validation system:

```bash
# Validate build
./scripts/validate-build.sh --mode full

# Standard PM2 deployment
pm2 start ecosystem.config.js

# Monitor sync logs
tail -f logs/sync-cron.jsonl | jq .
```

**Build Validation Features**:

- **Pre-deployment Validation**: Ensures all API routes are compiled correctly
- **PM2 Integration**: Pre-start hooks prevent broken builds from starting
- **Uptime Kuma Notifications**: Build status pushed to monitoring system

For detailed automatic sync documentation, see [docs/deployment/automatic-sync.md](docs/deployment/automatic-sync.md).

## Bi-directional Sync

Bi-directional sync pushes your reading activity back to Inoreader (read/unread, star/unstar) using a durable queue and batch updates. See the full technical guide:

- Technical doc: `docs/tech/bidirectional-sync.md`
- API reference: `docs/api/server-endpoints.md` (Sync and Inoreader sections)

## Development Setup

### Prerequisites

- Node.js 18.17 or higher
- npm 9.0 or higher
- Git

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/shayonpal/rss-news-reader.git
   cd rss-news-reader
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your API credentials (see .env.example for all required values)

   **Important**: All environment variables are REQUIRED. Use the validation script to verify:

   ```bash
   ./scripts/validate-env.sh
   ```

   The build process will automatically validate environment variables before building.

4. **Set up server OAuth (one-time)**

   ```bash
   npm run setup:oauth
   ```

   This runs a Playwright script that:
   - Starts a local OAuth server on port 8080
   - Opens Inoreader login page
   - Uses test credentials from .env
   - Captures and encrypts tokens
   - Stores them in `~/.rss-reader/tokens.json`

5. **Start development server**

   ```bash
   npm run dev:network
   ```

   **Access the app**: http://100.96.166.53:3000/reader (via Tailscale)

   **Note**: No authentication required in the client. Access is controlled by Tailscale network.

### Important: Server-Client Architecture

**New Architecture (June 2025):**

- **Server**: Handles all Inoreader API communication
- **Client**: No authentication - reads from Supabase only
- **Access**: Controlled by Tailscale network

**Data Flow:**

1. Server syncs from Inoreader API (4-5 calls)
2. Server stores data in Supabase
3. Client reads from Supabase
4. No direct Inoreader API calls from client

**URLs:**

- Development: http://100.96.166.53:3000/reader
- **API Paths (RR-102)**: In development, both `/api/*` and `/reader/api/*` work (automatic redirects)

### Development Commands

```bash
# Server Setup
npm run setup:oauth      # One-time OAuth setup (server-side)

# Development
npm run dev              # Start development server
npm run dev:network      # Start with network access (0.0.0.0)
npm run dev:debug        # Start with Node.js debugger
npm run dev:turbo        # Start with Turbo mode

# Quality Checks & Pre-commit Hook (RR-210)
npm run type-check       # TypeScript compilation check
npm run lint            # ESLint code quality check
npm run format:check    # Prettier formatting check
npm run format          # Fix Prettier formatting issues
npm run docs:validate   # OpenAPI documentation coverage (45/45 endpoints)
npm run pre-commit      # Run all quality checks (same as pre-commit hook)

# Testing (Optimized Execution - RR-183)
npm run test            # ✅ RECOMMENDED: Optimized runner (8-20 seconds)
npm run test:parallel   # ✅ Fastest execution (8-12 seconds) - ideal for CI/CD
npm run test:sequential # ✅ Most reliable (15-20 seconds) - ideal for debugging
npm run test:sharded    # ✅ Balanced execution (10-15 seconds)
npm run test:progressive # ✅ Detailed feedback with progress tracking
npm run test:watch      # ✅ Development mode with hot reload
npm run test:legacy     # ✅ Conservative fallback (legacy safe runner)
npm run test:unit       # ⚠️  Unit tests only (bypasses optimizations)
npm run test:integration:safe # ✅ Integration tests with PM2 service management
npm run test:e2e        # End-to-end tests (Playwright)

# Emergency Test Management (Legacy)
./scripts/kill-test-processes.sh    # Emergency cleanup (only needed for legacy scripts)
./scripts/monitor-test-processes.sh # Real-time process monitoring

# Build & Deploy
npm run build           # Production build
npm run start           # Start production server
npm run analyze         # Bundle size analysis
npm run clean           # Clean build artifacts

# API Documentation Workflow (RR-208)
npm run docs:validate   # ✅ Validate OpenAPI coverage (45/45 endpoints, <2s)
npm run docs:coverage   # ✅ Generate detailed coverage report
npm run docs:serve      # ✅ Start dev server and open Swagger UI

# Build Validation & Safety
./scripts/validate-build.sh --mode basic   # Quick validation
./scripts/validate-build.sh --mode full    # Comprehensive validation
./scripts/build-and-start-prod.sh          # Safe production deployment
./scripts/rollback-last-build.sh           # Emergency rollback
```

### Git Pre-commit Hook (RR-210)

**Automated Quality Gates**: Every commit automatically triggers comprehensive validation through the pre-commit hook:

```bash
# Hook runs automatically on every commit
git commit -m "your changes"

# Manual hook testing
./.git/hooks/pre-commit

# Emergency bypass (not recommended)
git commit --no-verify -m "emergency commit"
```

**Validation Steps** (individual failure tracking with timeouts):

1. **Type Check** (30s): `npm run type-check` - TypeScript compilation
2. **Lint Check** (30s): `npm run lint` - ESLint code quality
3. **Format Check** (30s): `npm run format:check` - Prettier formatting
4. **OpenAPI Documentation** (60s): `npm run docs:validate` - Ensures 100% API coverage (45/45 endpoints)

**Key Features**:

- **Quality Assurance**: Prevents committing code with quality issues
- **Documentation Enforcement**: All API endpoints must be properly documented
- **Fast Feedback**: Individual failure tracking with clear error messages
- **Performance Optimized**: Completes in under 90 seconds with timeout protection
- **Graceful Fallback**: Continues validation when development server unavailable

**Benefits for Development**:

- Catches issues before they reach the CI/CD pipeline
- Ensures consistent code quality across all contributions
- Maintains 100% OpenAPI documentation coverage automatically
- Provides immediate feedback with specific recovery instructions

## CI/CD Pipeline (GitHub Actions)

The RSS News Reader includes comprehensive CI/CD infrastructure (RR-185) with progressive testing strategy and automated quality gates.

### Pipeline Overview

**Main Pipeline** (`.github/workflows/ci-cd-pipeline.yml`):

- **Smoke Tests Stage** (2-3 min): TypeScript compilation, linting, critical tests, build validation
- **Full Test Suite** (8-10 min): Matrix testing across Node 18/20 with 4-way sharding for parallel execution
- **E2E Testing** (5-15 min): Cross-browser testing (Chromium, Firefox, WebKit, Mobile Safari)
- **Performance Testing**: Automated regression detection with baseline comparison
- **Security Scanning**: npm audit and vulnerability assessment
- **Quality Gates**: Automated deployment readiness assessment

**PR Validation** (`.github/workflows/pr-checks.yml`):

- TypeScript and ESLint validation
- Test coverage analysis on changed files
- Bundle size impact assessment
- Security vulnerability checking
- Auto-labeling based on file changes (docs, tests, features, etc.)

### Local CI/CD Equivalent Commands

Run the same validations locally as the CI/CD pipeline:

```bash
# Smoke Tests (equivalent to CI smoke stage)
npm run type-check        # TypeScript compilation
npm run lint             # ESLint validation
npm run test:unit        # Critical unit tests
npm run build            # Build validation

# Full Test Suite (equivalent to CI test matrix)
npm run test:parallel    # Fastest execution (8-12s) - matches CI sharding
npm run test:e2e         # Cross-browser E2E testing

# Performance Testing
npm run test:performance # Performance regression detection

# Pre-commit Quality Gates
npm run pre-commit       # Complete quality validation

# Security Scanning
npm audit --audit-level moderate
```

### Branch Workflow

- **Development**: All work happens on `dev` branch (triggers full pipeline)
- **Stable Releases**: Periodic releases to `main` branch (triggers release pipeline)
- **Pull Requests**: Trigger PR validation workflow with coverage analysis

### Current Status

- ✅ **Pipeline Active**: Comprehensive CI/CD validation on all pushes
- ✅ **Quality Gates**: Automated testing and security scanning
- ✅ **Cross-Browser Testing**: Full E2E validation across 8 browser profiles
- ✅ **Performance Monitoring**: Regression detection with baseline tracking
- ⚠️ **Deployment**: Validation-only (manual deployment as app is in active development)

For detailed CI/CD documentation, see [docs/tech/ci-cd-pipeline.md](docs/tech/ci-cd-pipeline.md).

## Testing & Quality Assurance

The RSS News Reader implements **optimized test execution** (RR-183) achieving 8-20 second test suite completion times, resolving previous timeout issues and enabling CI/CD integration.

### Optimized Test Execution (RR-183)

**Recommended test execution:**

```bash
npm test  # Optimized runner with thread pool (8-20 seconds)
```

**Performance breakthrough:**

- **Execution Time**: 8-20 seconds (vs previous 2+ minute timeouts - 90%+ improvement)
- **Thread Pool Optimization**: Uses threads pool with 4 max threads for optimal performance
- **Resource Management**: Comprehensive cleanup hooks prevent memory leaks
- **CI/CD Ready**: Reliable execution under 10-minute timeout for continuous integration
- **Multiple Execution Modes**: 5 different execution strategies for various development scenarios

**Choose execution mode based on needs:**

- `npm run test:parallel` - Fastest (8-12s) for CI/CD pipelines
- `npm run test:sequential` - Most reliable (15-20s) for debugging
- `npm run test:watch` - Development mode with hot reload
- `npm run test:progressive` - Detailed feedback and progress tracking

### Auto-Generated Files

The following files are automatically generated during build/test processes and should NOT be committed to the repository:

- `performance-baseline.json` - Performance baseline metrics (generated during build)
- `performance-report.json` - Current performance metrics (generated during build)
- `infrastructure-readiness-report.json` - Infrastructure validation report (archived versions kept in docs/infrastructure/)
- `*.tsbuildinfo` - TypeScript incremental build cache
- `next-env.d.ts` - Next.js TypeScript definitions
- `.next/` directories - Next.js build output
- `playwright-report/` - Playwright test results
- `test-results/` - Test execution artifacts

These files are properly configured in `.gitignore` and will be regenerated as needed during build processes.

### Test Types

- **Unit Tests**: Component and utility function testing with mocked dependencies
- **Integration Tests**: API endpoint testing with isolated test environment
- **End-to-End Tests**: Full user workflow testing (Playwright) - See [E2E Testing](#end-to-end-e2e-testing) below
- **Performance Tests**: Resource usage validation and memory leak detection

**Test Environment Requirements (RR-186):**

- **IndexedDB Polyfill**: `fake-indexeddb` library provides browser API compatibility for storage tests
- **Environment Validation**: Smoke test validates polyfill setup before test execution
- **Mock Infrastructure**: Comprehensive mocks for browser APIs and external services

### End-to-End (E2E) Testing

**Comprehensive cross-browser E2E testing with Playwright (RR-184):**

The RSS News Reader includes robust E2E testing infrastructure for validating core user journeys across multiple browsers, with special focus on Safari on iPhone and iPad PWA.

**Run E2E tests:**

```bash
# Run all E2E tests across all browsers
npm run test:e2e

# Run specific test file
npx playwright test src/__tests__/e2e/rr-184-core-user-journeys.spec.ts

# Run iPhone button tappability tests specifically
npx playwright test src/__tests__/e2e/iphone-button-tappability.spec.ts

# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project="Mobile Safari"
npx playwright test --project="iPad Safari"

# Run in headed mode for debugging
npx playwright test --headed

# Run with UI mode for interactive debugging
npx playwright test --ui
```

**Browser Coverage:**

- **Desktop**: Chromium, Firefox, Safari (WebKit)
- **Mobile**: iPhone 14, iPhone 14 Pro Max (Safari)
- **Tablet**: iPad Gen 7, iPad Pro 11" (Safari)
- **Android**: Pixel 5 (Chrome)

**Core Test Scenarios:**

1. **Article Reading Journey**: Browse feeds → Select article → Read content → Navigate back
2. **Sync Validation**: Manual sync triggers and UI updates
3. **Cross-Device State**: Read/unread status persistence
4. **Performance Testing**: Page load times and responsiveness
5. **PWA Installation**: Manifest and service worker validation
6. **iPhone Button Tappability**: iOS touch target compliance (44x44px) and element spacing validation
7. **Touch Interactions**: Swipe gestures, pull-to-refresh, and mobile navigation patterns
8. **ARIA Accessibility**: Screen reader support and keyboard navigation validation

**Test Reports:**

- HTML reports generated in `playwright-report/`
- Videos and screenshots captured on failure
- Trace files for debugging in `test-results/`

**Requirements:**

- Tests require Tailscale VPN connection (access via `100.96.166.53`)
- No authentication needed (network-based access control)
- Development server must be running or will auto-start

**API Path Handling (RR-102)**: Tests benefit from smart redirects - API calls work with or without `/reader` prefix in development, improving test reliability.

### Legacy Emergency Procedures

**Note**: With RR-183 optimizations, emergency procedures are rarely needed as tests complete reliably in 8-20 seconds.

If using legacy test scripts and they become unresponsive:

```bash
# Emergency cleanup (legacy scripts only)
./scripts/kill-test-processes.sh

# Real-time monitoring (legacy scripts)
./scripts/monitor-test-processes.sh
```

**⚠️ Important**: The optimized test runner eliminates previous timeout and memory issues. Legacy emergency procedures are only needed when using `./scripts/safe-test-runner.sh` or direct vitest commands.

For comprehensive testing guidelines, troubleshooting, and best practices, see:
**[Safe Test Practices Documentation](docs/testing/safe-test-practices.md)**

For a complete list of PM2, npm, and helper script commands, see:
**[Operations & Commands Reference](docs/operations-and-commands.md)**

For a concise release process (dev → main tagging), see:
**[Release Process](docs/release-process.md)**

For full API endpoint details (request/response formats, error envelopes), see:
**[Server API Endpoints](docs/api/server-endpoints.md)**

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes (Inoreader proxy, Claude integration)
│   └── globals.css     # Global styles
├── components/         # Reusable UI components
│   ├── ui/            # Base UI components
│   ├── articles/      # Article-related components
│   └── feeds/         # Feed-related components
├── lib/               # Utility libraries
│   ├── api/          # API service layer
│   ├── db/           # Database utilities
│   ├── stores/       # Zustand stores
│   └── utils/        # Helper functions
├── types/             # TypeScript type definitions
├── hooks/             # Custom React hooks
└── constants/         # App constants
```

## Current Development Status

**Phase**: Production Deployed

**Version**: 0.12.0

### Development Access

- **URL**: http://100.96.166.53:3000/reader

### Deployment Status (July 22, 2025)

- ✅ **Production Deployed** - RSS reader running on PM2 with automatic startup
- ✅ **Automatic 6x Daily Sync** - Cron service runs every 4 hours (2, 6, 10, 14, 18, 22 Toronto time)
- ✅ **69 feeds** and **250 articles** synced and available
- ✅ **Tailscale Monitoring** - Auto-restart service ensures constant availability
- ✅ **Database Security** - Row Level Security enabled on all tables
- ✅ **Performance Optimized** - Feed loading reduced from 6.4s to <500ms

> **Note (August 1, 2025)**: The production server on the local machine has been retired. The RSS Reader now runs as a single development environment for improved stability and resource efficiency. For details on this architectural change, see [Production Environment Removal Documentation](docs/infrastructure/production-removal-2025-08.md).

### Key Milestones Achieved

- **Server-Client Architecture** - Complete separation of concerns
- **No Client Authentication** - Access controlled by Tailscale network
- **Automatic 6x Daily Sync** - Cron service runs every 4 hours (2, 6, 10, 14, 18, 22 Toronto time)
- **Database-Driven Filtering** - Real-time counts with 5-minute cache
- **PWA Installable** - Works on mobile and desktop devices
- **Production Ready** - Deployed with PM2 and automatic startup

### Current Features

- **Server-Client Architecture**: Complete separation of concerns
- **No Client Authentication**: Access controlled by Tailscale network
- **Server-Side Sync**: Efficient sync with 4-5 API calls
- **Bi-directional Sync**: Read/unread and star/unstar changes sync back to Inoreader
  - Sync queue pattern for reliable synchronization
  - 5-minute periodic sync with batch processing
  - Automatic retry with exponential backoff
  - Timestamp-based conflict resolution
- **Supabase Data Layer**: All client data from PostgreSQL
- **Database-Driven Read Status Filtering**: Accurate article counts with smart caching
  - Three filter options: Unread only (default), Read only, All articles
  - Real-time database counts with 5-minute cache
  - Dynamic page titles based on active filters
  - Automatic cache invalidation on user actions
- **localStorage Performance Optimization (RR-197)**: Three-tier architecture for instant UI response
  - **LocalStorageQueue**: FIFO queue with 1000-entry limit and graceful degradation
  - **PerformanceMonitor**: 60fps tracking with <1ms response time monitoring
  - **ArticleCounterManager**: Real-time counter updates with race condition prevention
  - **LocalStorageStateManager**: Coordination layer providing 500ms database batching
  - **Performance Targets**: <1ms UI response, 60fps scrolling, 500ms database batching
  - **Memory Management**: FIFO cleanup at 1000 operations to prevent localStorage bloat
- **Installable PWA**: Install on mobile and desktop
- **Responsive Design**: Mobile-first layout with intuitive mutex accordion sidebar (RR-193)
- **Theme System**: Manual light/dark mode control
- **Feed Hierarchy**: Collapsible folders with unread counts
- **Article List**: Infinite scroll with read/unread states
- **Offline Queue**: Actions synced when back online

## Documentation

- **[Product Requirements](docs/product/PRD.md)**: Detailed product specifications
- **[User Stories](docs/product/user-stories.md)**: All user stories with acceptance criteria
- **[Technical Architecture](docs/tech/)**: Implementation decisions and architecture
- **[Monitoring and Alerting](docs/tech/monitoring-and-alerting.md)**: Multi-layered monitoring system with Discord alerts
- **[Health Monitoring](docs/monitoring/health-monitoring-overview.md)**: Comprehensive health monitoring (client & server)
- **[Automatic Sync](docs/deployment/automatic-sync.md)**: Daily sync service documentation
- **[API Testing with Insomnia](docs/api/insomnia-setup.md)**: Complete guide for importing API collection into Insomnia REST client
- Deployment docs focus on the dev-only, Tailscale-protected setup. See `docs/deployment/`.
- **[RR-26 Analysis](docs/issues/RR-26-freshness-perception-analysis.md)**: Article freshness perception issue analysis

## API Integration

### API Documentation & Testing

- **📚 Interactive API Documentation**: Complete Swagger UI with **100% OpenAPI coverage (45/45 endpoints)**
  - **Access URL**: http://100.96.166.53:3000/reader/api-docs
  - **Try it out functionality**: Test all endpoints directly in the browser with operationId support
  - **Real-time validation**: OpenAPI spec validates in <2 seconds
  - **Complete coverage**: Health (6), Sync (7), Articles (4), Tags (5), Inoreader (8), Auth (1), Test (7), Analytics (1), Feeds (2), Users (2), Logs (1), Insomnia (1)
- **🔧 Developer Tools**:
  - **Insomnia Export**: One-click export via "Export to Insomnia" button in Swagger UI
  - **Direct Export Endpoint**: `/api/insomnia.json` for programmatic access to Insomnia v4 collection format
  - **OpenAPI Spec**: `/api-docs/openapi.json` for integration with other tools

### Inoreader API

- OAuth 2.0 authentication
- Feed subscription management
- Article synchronization
- Rate limiting: 100 calls/day

### Claude API (Anthropic)

- AI-powered article summarization
- Model: Configurable via `CLAUDE_SUMMARIZATION_MODEL` env variable
- Default: claude-sonnet-4-20250514
- Summary length: 150-175 words

### Environment Variables

Key configuration options:

- **`SYNC_MAX_ARTICLES`**: Number of articles to fetch per sync (default: 500)
  - Used for incremental syncs to balance freshness with efficiency
  - Higher values ensure more complete article history
  - Weekly full syncs ignore this limit for complete data integrity

  - Controls how many articles are retrieved from Inoreader in each sync operation
  - Lower values reduce API usage and sync time
  - Higher values ensure more complete article history

- **`ARTICLES_RETENTION_LIMIT`**: Number of articles to keep during auto-cleanup (default: 1000)
  - Sets the maximum number of articles to retain in the database
  - Auto-cleanup feature to be implemented in future updates
  - Helps manage storage space and database performance

- **`CLAUDE_SUMMARIZATION_MODEL`**: Claude model for AI summaries (default: claude-sonnet-4-20250514)
  - Allows switching between different Claude models
  - Useful for testing or when new models are released

## Data Architecture

### Server-Client Model

The app uses a **server-client architecture** with complete separation of concerns:

1. **Server** → Handles all Inoreader API communication
2. **Server** → Syncs data to Supabase
3. **Client** → Reads exclusively from Supabase
4. **Client** → No authentication required

### Data Flow

```
Inoreader API → Server (Node.js) → Supabase → Client (Next.js)
```

### Server Responsibilities

- **OAuth Authentication**: Encrypted token storage in `~/.rss-reader/tokens.json`
- **API Communication**: All Inoreader API calls (4-5 per sync)
- **Data Sync**: Efficient sync to Supabase
- **Token Refresh**: Automatic before expiration
- **Content Extraction**: Mozilla Readability for full article content
- **AI Summaries**: Claude API integration for article summaries

### Client Responsibilities

- **Presentation Only**: Display feeds and articles
- **User Actions**: Mark read/unread, star/unstar
- **Offline Queue**: Store actions for later sync
- **No Authentication**: Access via Tailscale network
- **Supabase Only**: All data from PostgreSQL

### API Efficiency

Server sync uses only 4-5 API calls:

1. `/subscription/list` - Get all feeds
2. `/tag/list` - Get tags (if needed)
3. `/stream/contents` - Get ALL articles (max 100)
4. `/unread-count` - Get unread counts
5. `/edit-tag` - Update read states (future)

### Security Model

- **Server**: OAuth tokens encrypted with AES-256-GCM
- **Network**: Tailscale VPN for access control
- **Client**: No authentication, no secrets
- **Database**: Supabase with row-level security

## Database Schema

The RSS reader uses PostgreSQL (via Supabase) with 8 main tables and additional database objects for performance optimization.

### Core Tables

#### 1. Users Table

**Purpose**: Store user accounts (currently single-user application)

| Column       | Type        | Constraints                             | Description                |
| ------------ | ----------- | --------------------------------------- | -------------------------- |
| id           | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier     |
| inoreader_id | text        | UNIQUE, NOT NULL                        | Inoreader account ID       |
| username     | text        |                                         | Inoreader username         |
| email        | text        |                                         | User email address         |
| preferences  | jsonb       | DEFAULT '{}'                            | User preferences storage   |
| created_at   | timestamptz | DEFAULT now()                           | Account creation timestamp |
| updated_at   | timestamptz | DEFAULT now()                           | Last update timestamp      |

**Indexes**:

- Primary key on `id`
- Unique index on `inoreader_id`

#### 2. Feeds Table

**Purpose**: Store RSS feed subscriptions

| Column             | Type        | Constraints                               | Description                      |
| ------------------ | ----------- | ----------------------------------------- | -------------------------------- |
| id                 | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4()   | Unique feed identifier           |
| user_id            | uuid        | REFERENCES users(id) ON DELETE CASCADE    | Associated user                  |
| inoreader_id       | text        | UNIQUE, NOT NULL                          | Inoreader feed ID                |
| title              | text        | NOT NULL                                  | Feed display name                |
| url                | text        |                                           | Feed URL                         |
| site_url           | text        |                                           | Website URL                      |
| icon_url           | text        |                                           | Feed icon/favicon URL            |
| folder_id          | uuid        | REFERENCES folders(id) ON DELETE SET NULL | Parent folder                    |
| is_partial_content | boolean     | DEFAULT false                             | Requires full content extraction |
| created_at         | timestamptz | DEFAULT now()                             | Subscription timestamp           |
| updated_at         | timestamptz | DEFAULT now()                             | Last update timestamp            |

**Indexes**:

- Primary key on `id`
- Foreign key index on `user_id`
- Unique index on `inoreader_id`
- Index on `folder_id`

**Note**: The `is_partial_content` field was consolidated from the previous `is_partial_feed` field as part of RR-176 implementation to standardize content fetching behavior across all feeds.

#### 3. Articles Table

**Purpose**: Store individual articles from feeds

| Column            | Type        | Constraints                             | Description                 |
| ----------------- | ----------- | --------------------------------------- | --------------------------- |
| id                | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique article identifier   |
| feed_id           | uuid        | REFERENCES feeds(id) ON DELETE CASCADE  | Parent feed                 |
| inoreader_id      | text        | UNIQUE, NOT NULL                        | Inoreader article ID        |
| title             | text        | NOT NULL                                | Article title               |
| url               | text        |                                         | Article URL                 |
| content           | text        |                                         | RSS content/summary         |
| full_content      | text        |                                         | Extracted full content      |
| has_full_content  | boolean     | DEFAULT false                           | Full content availability   |
| ai_summary        | text        |                                         | Claude-generated summary    |
| author            | text        |                                         | Article author              |
| published         | timestamptz |                                         | Publication date            |
| is_read           | boolean     | DEFAULT false                           | Read status                 |
| is_starred        | boolean     | DEFAULT false                           | Starred status              |
| last_local_update | timestamptz |                                         | Last local change timestamp |
| last_sync_update  | timestamptz |                                         | Last sync from Inoreader    |
| created_at        | timestamptz | DEFAULT now()                           | Import timestamp            |
| updated_at        | timestamptz | DEFAULT now()                           | Last update timestamp       |

**Indexes**:

- Primary key on `id`
- Foreign key index on `feed_id`
- Unique index on `inoreader_id`
- Compound index on `(feed_id, is_read)` for unread counts
- Index on `published` for sorting
- Index on `is_read` for filtering
- Index on `is_starred` for filtering

#### 4. Folders Table

**Purpose**: Feed organization hierarchy

| Column       | Type        | Constraints                              | Description              |
| ------------ | ----------- | ---------------------------------------- | ------------------------ |
| id           | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4()  | Unique folder identifier |
| user_id      | uuid        | REFERENCES users(id) ON DELETE CASCADE   | Associated user          |
| inoreader_id | text        | UNIQUE                                   | Inoreader folder ID      |
| title        | text        | NOT NULL                                 | Folder name              |
| parent_id    | uuid        | REFERENCES folders(id) ON DELETE CASCADE | Parent folder (nested)   |
| created_at   | timestamptz | DEFAULT now()                            | Creation timestamp       |
| updated_at   | timestamptz | DEFAULT now()                            | Last update timestamp    |

**Indexes**:

- Primary key on `id`
- Foreign key index on `user_id`
- Unique index on `inoreader_id`
- Index on `parent_id`

#### 5. Sync Metadata Table

**Purpose**: Track sync operation statistics

| Column           | Type        | Constraints                             | Description               |
| ---------------- | ----------- | --------------------------------------- | ------------------------- |
| id               | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique sync identifier    |
| user_id          | uuid        | REFERENCES users(id) ON DELETE CASCADE  | Associated user           |
| last_sync        | timestamptz |                                         | Last successful sync time |
| last_sync_status | text        |                                         | Status (success/error)    |
| sync_count       | integer     | DEFAULT 0                               | Total sync operations     |
| success_count    | integer     | DEFAULT 0                               | Successful syncs          |
| error_count      | integer     | DEFAULT 0                               | Failed syncs              |
| last_error       | text        |                                         | Last error message        |
| created_at       | timestamptz | DEFAULT now()                           | First sync timestamp      |
| updated_at       | timestamptz | DEFAULT now()                           | Last update timestamp     |

**Indexes**:

- Primary key on `id`
- Foreign key index on `user_id`

#### 6. API Usage Table

**Purpose**: Track API rate limits and usage

| Column          | Type        | Constraints                             | Description         |
| --------------- | ----------- | --------------------------------------- | ------------------- |
| id              | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique usage record |
| user_id         | uuid        | REFERENCES users(id) ON DELETE CASCADE  | Associated user     |
| date            | date        | NOT NULL                                | Usage date          |
| inoreader_calls | integer     | DEFAULT 0                               | Inoreader API calls |
| claude_calls    | integer     | DEFAULT 0                               | Claude API calls    |
| created_at      | timestamptz | DEFAULT now()                           | Record creation     |
| updated_at      | timestamptz | DEFAULT now()                           | Last update         |

**Indexes**:

- Primary key on `id`
- Compound unique index on `(user_id, date)`
- Index on `date` for cleanup

#### 7. System Config Table

**Purpose**: Cache system configuration to reduce repeated queries

| Column     | Type        | Constraints   | Description           |
| ---------- | ----------- | ------------- | --------------------- |
| key        | text        | PRIMARY KEY   | Configuration key     |
| value      | jsonb       | NOT NULL      | Configuration value   |
| created_at | timestamptz | DEFAULT now() | Creation timestamp    |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Usage**: Caches timezone settings and other system configurations to reduce database overhead

#### 8. Sync Queue Table

**Purpose**: Track local changes for bi-directional sync to Inoreader

| Column           | Type        | Constraints                                          | Description             |
| ---------------- | ----------- | ---------------------------------------------------- | ----------------------- |
| id               | uuid        | PRIMARY KEY, DEFAULT gen_random_uuid()               | Unique queue entry      |
| article_id       | uuid        | REFERENCES articles(id) ON DELETE CASCADE            | Article being synced    |
| inoreader_id     | text        | NOT NULL                                             | Inoreader article ID    |
| action_type      | text        | NOT NULL, CHECK IN ('read','unread','star','unstar') | Action to sync          |
| action_timestamp | timestamptz | NOT NULL                                             | When action occurred    |
| sync_attempts    | integer     | DEFAULT 0                                            | Number of sync attempts |
| last_attempt_at  | timestamptz |                                                      | Last sync attempt time  |
| created_at       | timestamptz | DEFAULT now()                                        | Queue entry creation    |

**Indexes**:

- Primary key on `id`
- Foreign key index on `article_id`
- Index on `sync_attempts` for retry queries
- Index on `created_at` for batch processing

#### 9. Fetch Logs Table

**Purpose**: Track full content extraction attempts

| Column            | Type        | Constraints                               | Description                    |
| ----------------- | ----------- | ----------------------------------------- | ------------------------------ |
| id                | uuid        | PRIMARY KEY, DEFAULT gen_random_uuid()    | Unique log entry               |
| article_id        | uuid        | REFERENCES articles(id) ON DELETE CASCADE | Article being fetched          |
| feed_id           | uuid        | REFERENCES feeds(id) ON DELETE CASCADE    | Parent feed                    |
| fetch_type        | text        | NOT NULL, CHECK IN ('manual','auto')      | Fetch trigger type             |
| success           | boolean     | NOT NULL                                  | Extraction success status      |
| error_reason      | text        |                                           | Error message if failed        |
| response_time_ms  | integer     |                                           | API response time              |
| content_length    | integer     |                                           | Extracted content size         |
| extraction_method | text        |                                           | Method used (readability, etc) |
| created_at        | timestamptz | DEFAULT now()                             | Fetch timestamp                |

**Indexes**:

- Primary key on `id`
- Foreign key index on `article_id`
- Foreign key index on `feed_id`
- Index on `created_at` for time-based queries
- Index on `fetch_type` for analytics

**Security**:

- Row Level Security (RLS) enabled
- Authenticated users can view and insert fetch logs
- No public access allowed

### Performance Optimizations

#### Materialized View: feed_stats

**Purpose**: Pre-calculate unread counts for performance

```sql
CREATE MATERIALIZED VIEW feed_stats AS
SELECT
  f.id as feed_id,
  f.user_id,
  COUNT(a.id) FILTER (WHERE NOT a.is_read) as unread_count,
  COUNT(a.id) as total_count,
  MAX(a.published) as latest_article_date
FROM feeds f
LEFT JOIN articles a ON f.id = a.feed_id
GROUP BY f.id, f.user_id;
```

**Indexes**:

- Unique index on `feed_id` for concurrent refresh
- Index on `user_id`

#### Recent Performance Improvements (July 25, 2025)

1. **Added Missing Index**: Created index on `sync_queue.article_id` foreign key to improve join performance
2. **Removed Duplicate Indexes**: Eliminated redundant indexes on `fetch_logs` table:
   - Dropped `idx_fetch_logs_article_id` (duplicate of `idx_fetch_logs_article`)
   - Dropped `idx_fetch_logs_feed_id` (duplicate of `idx_fetch_logs_feed`)
3. **Fixed RLS Policy Issue**: Resolved multiple permissive policies on `system_config` table by creating specific policies for each operation (SELECT, INSERT, UPDATE, DELETE)

#### Database Functions

1. **get_unread_counts_by_feed(p_user_id uuid)**
   - Returns aggregated unread counts per feed
   - Reduces data transfer by 92.4% (290 rows → 22 rows)

2. **refresh_feed_stats()**
   - Refreshes the materialized view
   - Called automatically after each sync

3. **update_updated_at_column()**
   - Trigger function to maintain `updated_at` timestamps
   - Applied to all tables with `updated_at` column

#### Database Views

1. **sync_queue_stats**
   - Provides summary statistics for the sync queue
   - Shows pending, never attempted, retry pending, and failed counts
   - No SECURITY DEFINER - inherits caller's permissions

### Row Level Security (RLS) Policies

All tables have RLS enabled with the following policies:

1. **Users Table**:
   - SELECT: Only user 'shayon' can read
   - INSERT: Only user 'shayon' can insert
   - UPDATE: Only user 'shayon' can update own record
   - DELETE: No deletes allowed

2. **Feeds, Articles, Folders Tables**:
   - SELECT: Only user 'shayon' can read own data
   - INSERT: Only service role (server) can insert
   - UPDATE: Client can update specific fields (is_read, is_starred)
   - DELETE: Only service role can delete

3. **Sync Metadata, API Usage Tables**:
   - All operations restricted to service role (server only)

4. **Fetch Logs Table**:
   - SELECT: Authenticated users can view all logs
   - INSERT: Authenticated users can insert logs
   - UPDATE/DELETE: No updates or deletes allowed

### Table Relationships

```
users (1) ─┬─── (n) feeds
           ├─── (n) folders
           ├─── (1) sync_metadata
           └─── (n) api_usage

folders (1) ─┬─── (n) feeds
             └─── (n) folders (nested)

feeds (1) ────── (n) articles
```

### Common Queries

```sql
-- Get all feeds with unread counts
SELECT
  f.*,
  fs.unread_count,
  fs.total_count
FROM feeds f
JOIN feed_stats fs ON f.id = fs.feed_id
WHERE f.user_id = $1
ORDER BY f.title;

-- Get unread articles for a feed
SELECT * FROM articles
WHERE feed_id = $1
  AND is_read = false
ORDER BY published DESC
LIMIT 50;

-- Mark article as read
UPDATE articles
SET is_read = true, updated_at = now()
WHERE id = $1;

-- Get sync statistics
SELECT * FROM sync_metadata
WHERE user_id = $1;
```

## Contributing

1. Check [GitHub Issues](https://github.com/shayonpal/rss-news-reader/issues) for open tasks
2. View [Project Board](https://github.com/users/shayonpal/projects/7) for current sprint
3. Run quality gates before committing: `npm run pre-commit`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/shayonpal/rss-news-reader/issues)
- **Project Board**: [Track development progress](https://github.com/users/shayonpal/projects/7)
- **Documentation**: See `/docs` folder for detailed guides
