# Shayon's News - RSS Reader PWA

[![GitHub](https://img.shields.io/badge/GitHub-shayonpal%2Frss--news--reader-blue)](https://github.com/shayonpal/rss-news-reader)
[![Status](https://img.shields.io/badge/Status-Active-green)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20iOS%20%7C%20Android-lightgrey)]()
[![Developer](https://img.shields.io/badge/Developer-Shayon%20Pal-orange)](https://shayonpal.com?utm_source=github&utm_medium=readme&utm_campaign=rss-news-reader)

A self-hosted RSS reader with server-client architecture and AI-powered summaries. The server handles all Inoreader API communication while the client provides a clean, authentication-free reading experience.

## Configuration

The application URL is configured via environment variables in `.env`:
- `NEXT_PUBLIC_APP_URL` - Full application URL (e.g., `http://100.96.166.53:3000`)
- `NEXT_PUBLIC_BASE_URL` - Base URL without port (e.g., `http://100.96.166.53`)  
- `PORT` - Application port (default: 3000)

## Features

- **Server-Client Architecture**: Server handles all external APIs, client is presentation only
- **No Client Authentication**: Access control handled at network/deployment level
- **Progressive Web App**: Install on mobile and desktop devices with iOS touch-optimized interface
- **iOS 26 Liquid Glass Design**: Advanced glass morphism with adaptive blur and floating controls
- **Full Content Extraction**: Extract complete articles beyond RSS snippets (v0.6.0)
  - Manual fetch button for any article
  - Smart content priority display
  - Comprehensive fetch statistics dashboard
  - Note: Automatic fetching removed for improved sync performance
- **AI-Powered Summaries**: Generate article summaries using Claude API (server-side)
- **Author Display**: Shows article authors in list and detail views (v0.12.0)
- **Navigation State Preservation**: Articles remain visible when returning from detail view (v0.12.0)
- **Server-Side Sync**: Efficient sync with only 4-5 API calls
- **Bi-directional Sync**: Changes sync back to Inoreader (read/unread, star/unstar)
- **Mark All Read**: Quickly mark all articles in a feed as read with two-tap confirmation
- **Clean Design**: Minimalist interface inspired by Reeder 5
- **Inoreader Integration**: Server syncs with existing subscriptions
- **Feed Hierarchy**: Collapsible folder structure with unread counts
- **Intuitive Sidebar Navigation**: Mutex accordion behavior with clean single-scroll experience
  - Only one sidebar section (Topics OR Feeds) open at a time preventing UI confusion
  - Eliminated nested scrollbars with CSS Grid layout for smooth navigation
  - Mobile-optimized full-width overlay with improved touch targets
  - Smart default state: Topics open, Feeds closed for consistent user experience
- **Responsive Design**: Adaptive layout for mobile and desktop
- **Dark/Light Mode**: Manual theme control
- **Supabase Backend**: All client data served from PostgreSQL

## Server Architecture

The RSS News Reader requires several services to be running for full functionality:

### Services & Infrastructure

**PM2 Managed Services** (via `pm2 list`):
- **RSS Reader Dev** (`rss-reader-dev`) - Port 3000 - Main web application
- **Sync Server** (`rss-sync-server`) - Port 3001 - Bi-directional sync API
- **Sync Cron** (`rss-sync-cron`) - Automated syncing 6x daily (2,6,10,14,18,22 UTC)
- **Services Monitor** (`rss-services-monitor`) - Service health monitoring with auto-restart
- **Kuma Push Monitor** (`kuma-push-monitor`) - Uptime Kuma push notifications daemon
- **Log Rotation Module** (`pm2-logrotate`) - Automatic log rotation

**External Services**:
- **Supabase PostgreSQL** - Cloud-hosted database (Row Level Security enabled)
- **Network Security** - Configurable based on deployment (VPN, firewall, etc.)

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

- **Application Health**: `${NEXT_PUBLIC_APP_URL}/reader/api/health/app`
- **Database Health**: `${NEXT_PUBLIC_APP_URL}/reader/api/health/db`
- **Parsing/Content Health**: `${NEXT_PUBLIC_APP_URL}/reader/api/health/parsing`
- **Cron Service Status**: `${NEXT_PUBLIC_APP_URL}/reader/api/health/cron`
- **Sync Status**: Check via PM2 logs for `rss-sync-cron`

**Development Note**: In development environment, API endpoints work with or without the `/reader` prefix:

- Both `${NEXT_PUBLIC_APP_URL}/api/health/app` and `${NEXT_PUBLIC_APP_URL}/reader/api/health/app` work
- Automatic 307 redirects preserve HTTP methods and request bodies
- Production environment still requires the `/reader` prefix

### Monitoring & Health

Comprehensive health monitoring with automated recovery and alerting.

**Health Endpoints**: `/api/health/*` - Application, database, sync, parsing, and AI status

**Documentation:**
- **Health Endpoints**: See [`docs/monitoring/server-health-endpoints.md`](docs/monitoring/server-health-endpoints.md)
- **Service Monitoring**: See [`docs/operations/service-monitoring.md`](docs/operations/service-monitoring.md)
- **Uptime Kuma**: See [`docs/tech/uptime-kuma-monitoring.md`](docs/tech/uptime-kuma-monitoring.md)

### Network Requirements

**Access Control**: The application has no built-in authentication. Secure it using:

- Network-level security (VPN, firewall rules)
- Reverse proxy with authentication
- Access URLs configured in `NEXT_PUBLIC_BASE_URL`

The application is not accessible via public internet by design for security.

## Technology Stack

Built with Next.js 14+ (App Router), TypeScript, Tailwind CSS, and Supabase.

- **Frontend**: React 18, Zustand state management, iOS 26 Liquid Glass Design
- **Backend**: Node.js, Express sync server, PM2 process management
- **Database**: PostgreSQL with Row Level Security
- **Testing**: Vitest, Playwright, 95%+ coverage

**Detailed Documentation:**
- **Full Stack Details**: See [`docs/tech/technology-stack.md`](docs/tech/technology-stack.md)
- **API Integrations**: See [`docs/tech/api-integrations.md`](docs/tech/api-integrations.md)
- **Security Model**: See [`docs/tech/security.md`](docs/tech/security.md)

## UI/UX Design

iOS 26 Liquid Glass Design System with adaptive glass morphism and floating controls.

**Key Features:**
- Progressive Web App (PWA) with offline support
- Adaptive glass morphism with dynamic blur
- Floating controls architecture
- iOS-native interaction patterns

**Documentation:**
- **Design Guidelines**: See [`docs/ui-ux/liquid-glass-design-guidelines.md`](docs/ui-ux/liquid-glass-design-guidelines.md)
- **Component Library**: See [`docs/ui-ux/ios-liquid-glass-components.md`](docs/ui-ux/ios-liquid-glass-components.md)
- **Implementation**: See [`docs/ui-ux/liquid-glass-implementation-guide.md`](docs/ui-ux/liquid-glass-implementation-guide.md)

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

**📚 For a complete step-by-step guide, see the [Quick Setup Guide](docs/QUICK_SETUP.md)**

### Branch Structure

- **`main`** - Stable, production-ready code
- **`dev`** - Latest features and updates (may contain bugs)

### Prerequisites

- Node.js 18.17 or higher
- npm 9.0 or higher
- Git
- Supabase account (free tier works)
- Inoreader account

### Getting Started

👉 **See the [Quick Setup Guide](docs/QUICK_SETUP.md)** for detailed installation instructions.

**TL;DR:**
```bash
git clone https://github.com/shayonpal/rss-news-reader.git
cd rss-news-reader
npm install
cp .env.example .env  # Then add your credentials
npm run setup:oauth   # One-time OAuth setup
npm run dev          # Start the app
```

Access at: `${NEXT_PUBLIC_APP_URL}/reader`

### Development Commands

```bash
# Server Setup
npm run setup:oauth      # One-time OAuth setup (server-side)

# Development
npm run dev              # Start development server
npm run dev:network      # Start with network access (0.0.0.0)
npm run dev:debug        # Start with Node.js debugger
npm run dev:turbo        # Start with Turbo mode

# Quality Checks & Pre-commit Hook
npm run type-check       # TypeScript compilation check
npm run lint            # ESLint code quality check
npm run format:check    # Prettier formatting check
npm run format          # Fix Prettier formatting issues
npm run docs:validate   # OpenAPI documentation coverage (47/47 endpoints)
npm run pre-commit      # Run all quality checks (same as pre-commit hook)

# Testing (Optimized Execution)
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

# API Documentation Workflow
npm run docs:validate   # ✅ Validate OpenAPI coverage (47/47 endpoints, <2s)
npm run docs:coverage   # ✅ Generate detailed coverage report
npm run docs:serve      # ✅ Start dev server and open Swagger UI

# Build Validation & Safety
./scripts/validate-build.sh --mode basic   # Quick validation
./scripts/validate-build.sh --mode full    # Comprehensive validation
./scripts/build-and-start-prod.sh          # Safe production deployment
./scripts/rollback-last-build.sh           # Emergency rollback
```

### Git Pre-commit Hook

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
4. **OpenAPI Documentation** (60s): `npm run docs:validate` - Ensures 100% API coverage (47/47 endpoints)

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

## CI/CD Pipeline

### Active GitHub Actions

**PR Validation** (`.github/workflows/pr-checks.yml`):
- TypeScript and ESLint validation
- Unit test execution
- Build verification
- Runs on all pull requests

**Project Automation** (`.github/workflows/project-automation.yml`):
- Automatically adds issues to GitHub Projects
- Labels and categorizes work items

### Local Quality Checks

Run these commands locally before pushing:

```bash
# Quality validation
npm run type-check       # TypeScript compilation
npm run lint            # ESLint validation
npm run format:check    # Prettier formatting
npm run build           # Build validation

# Testing
npm test                # Fast test runner (8-20s)
npm run test:parallel   # Parallel execution (8-12s)
npm run test:e2e        # Playwright E2E tests

# Pre-commit (runs all checks)
npm run pre-commit      # Complete quality validation

# Security
npm audit --audit-level moderate
```

### Branch Workflow

- **`main`**: Stable, production-ready code
- **`dev`**: Active development (create PRs to main)

## Testing

Comprehensive testing with unit, integration, E2E, and performance tests.

**Quick Commands:**
```bash
npm test              # Fast test runner (8-20 seconds)
npm run test:parallel # Parallel execution (8-12s)
npm run test:e2e      # Playwright E2E tests
npm run pre-commit    # All quality checks
```

📚 **See [Complete Testing Documentation](docs/testing/README.md)** for writing tests, debugging, and best practices.

**Test Environment Requirements:**

- **IndexedDB Polyfill**: `fake-indexeddb` library provides browser API compatibility for storage tests
- **Environment Validation**: Smoke test validates polyfill setup before test execution
- **Mock Infrastructure**: Comprehensive mocks for browser APIs and external services


### Legacy Emergency Procedures

**Note**: With optimizations, emergency procedures are rarely needed as tests complete reliably in 8-20 seconds.

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
├── app/                # Next.js App Router
│   ├── api/           # API routes (47 endpoints)
│   ├── reader/        # Main PWA application
│   └── globals.css    # Global styles
├── components/        # React components
│   ├── ui/           # Base UI components (buttons, cards, etc.)
│   ├── articles/     # Article list, detail, content
│   ├── feeds/        # Feed sidebar, hierarchy
│   ├── health/       # Health monitoring UI
│   └── layout/       # Headers, navigation
├── lib/              # Core libraries
│   ├── api/         # API client services
│   ├── auth/        # OAuth authentication
│   ├── db/          # Supabase database client
│   ├── stores/      # Zustand state management
│   ├── sync/        # Bi-directional sync logic
│   ├── ai/          # Claude AI integration
│   └── utils/       # Helper functions
├── server/           # Server-side code
├── services/         # Background services
├── hooks/            # Custom React hooks
├── types/            # TypeScript definitions
├── test-utils/       # Testing utilities
└── __tests__/        # Test suites (unit, integration, e2e)
```


## Documentation

- **[Product Requirements](docs/product/PRD.md)**: Detailed product specifications
- **[User Stories](docs/product/user-stories.md)**: All user stories with acceptance criteria
- **[Technical Architecture](docs/tech/)**: Implementation decisions and architecture
- **[Monitoring and Alerting](docs/tech/monitoring-and-alerting.md)**: Multi-layered monitoring system with Discord alerts
- **[Health Monitoring](docs/monitoring/health-monitoring-overview.md)**: Comprehensive health monitoring (client & server)
- **[Automatic Sync](docs/deployment/automatic-sync.md)**: Daily sync service documentation
- **[API Testing with Insomnia](docs/api/insomnia-setup.md)**: Complete guide for importing API collection into Insomnia REST client
- Deployment docs available in `docs/deployment/`.
- **[Article Freshness Analysis](docs/issues/RR-26-freshness-perception-analysis.md)**: Article freshness perception issue analysis

## API Integration

### Interactive API Documentation

**📚 Swagger UI**: Complete API documentation with 100% coverage (47 endpoints)
- **Access**: `${NEXT_PUBLIC_APP_URL}/reader/api-docs`
- **Features**: Try-it-out functionality, OpenAPI spec, Insomnia export

### External APIs

- **Inoreader**: OAuth 2.0, feed sync, 100 calls/day limit
- **Claude AI**: Article summarization (70-80 words)
- **Supabase**: PostgreSQL with Row Level Security

**Documentation:**
- **API Details**: See [`docs/tech/api-integrations.md`](docs/tech/api-integrations.md)
- **Endpoint Reference**: See [`docs/api/server-endpoints.md`](docs/api/server-endpoints.md)
- **Insomnia Setup**: See [`docs/api/insomnia-setup.md`](docs/api/insomnia-setup.md)

## Data Architecture

### Server-Client Separation

```
Inoreader API → Server (Node.js) → Supabase → Client (Next.js)
```

- **Server**: Handles all external API calls, OAuth, sync logic
- **Client**: Presentation only, reads from Supabase
- **Security**: No client authentication, secure at network level

### Database

PostgreSQL with 15 tables, Row Level Security, materialized views for performance.

**Documentation:**
- **Database Schema**: See [`docs/tech/database-schema.md`](docs/tech/database-schema.md)
- **Sync Architecture**: See [`docs/tech/bidirectional-sync.md`](docs/tech/bidirectional-sync.md)
- **API Integrations**: See [`docs/tech/api-integrations.md`](docs/tech/api-integrations.md)

## Contributing

We welcome contributions! Please follow these guidelines:

### Submitting Issues
- Check [existing issues](https://github.com/shayonpal/rss-news-reader/issues) before creating a new one
- Use clear, descriptive titles
- Include steps to reproduce for bugs
- Add relevant labels if possible

### Submitting Pull Requests
1. Fork the repository
2. Create a feature branch from `dev`: `git checkout -b feature/your-feature-name`
3. Make your changes following the existing code style
4. Run quality checks: `npm run pre-commit`
5. Test your changes: `npm test`
6. Commit with clear messages
7. Push to your fork and submit a PR to the `dev` branch
8. Ensure PR description clearly describes the problem and solution

### Development Guidelines
- Follow existing code patterns and style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR
- Keep PRs focused - one feature/fix per PR

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/shayonpal/rss-news-reader/issues)
- **Documentation**: See `/docs` folder for detailed guides
