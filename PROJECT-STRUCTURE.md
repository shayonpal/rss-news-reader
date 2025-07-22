# RSS News Reader - Project Structure

This document provides a complete overview of the project's file structure, excluding node_modules and build artifacts.

```
rss-news-reader/
├── .claude/                     # Claude IDE configuration
│   └── settings.local.json      # Local Claude settings
├── .github/                     # GitHub Actions and workflows
│   └── workflows/               
│       ├── add-to-project5-workflow.yml
│       └── project-automation.yml
├── docs/                        # Project documentation
│   ├── api/                     
│   │   └── server-endpoints.md  # API documentation
│   ├── deployment/              # Deployment guides
│   │   ├── automatic-sync.md
│   │   ├── caddy-pm2-setup.md
│   │   ├── ci-cd-strategy.md
│   │   └── tailscale-monitoring.md
│   ├── product/                 # Product documentation
│   │   ├── PRD.md              # Product Requirements Document
│   │   ├── README.md
│   │   ├── user-flow-diagrams.md
│   │   ├── user-journeys.md
│   │   ├── user-stories.md
│   │   └── wireframes.md
│   ├── tech/                    # Technical documentation
│   │   ├── api-integrations.md
│   │   ├── implementation-strategy.md
│   │   ├── performance-analysis-2025-01-22.md
│   │   ├── README.md
│   │   ├── technology-stack.md
│   │   └── supabase-advisory/   # Database performance reports
│   │       └── 2025-07-21/
│   │           ├── Supabase Performance Security Lints (errors).csv
│   │           ├── Supabase Performance Security Lints (warnings).csv
│   │           ├── Supabase Query Performance (Most Time Consuming).csv
│   │           └── Supabase Query Performance (Slowest Execution).csv
│   ├── health-check-system.md   # Health monitoring documentation
│   └── TODOs.md                 # Master TODO list
├── logs/                        # Application logs
│   ├── caddy-access.log
│   ├── cron-error.log
│   ├── cron-out.log
│   ├── inoreader-api-calls.jsonl
│   ├── launchd-startup-error.log
│   ├── launchd-startup.log
│   ├── prod-error-1.log
│   ├── prod-out-1.log
│   ├── startup.log
│   ├── sync-cron.jsonl
│   ├── tailscale-monitor-error.log
│   ├── tailscale-monitor-out.log
│   └── tailscale-monitor.log
├── public/                      # Static assets
│   ├── apple-touch-icon.png
│   ├── favicon.ico
│   ├── icons/                   # PWA icons
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   └── rss-icon.png
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service worker
├── scripts/                     # Utility scripts
│   ├── check-status.sh          # Service status checker
│   ├── clean-database.sql       # Database cleanup
│   ├── create-api-usage-tables.sql
│   ├── deploy-production.sh     # Production deployment
│   ├── deploy.sh               # General deployment
│   ├── install-tailscale-monitor.sh
│   ├── manage-startup.sh        # Startup management
│   ├── monitor-tailscale.sh     # Tailscale monitoring
│   ├── setup-tailscale-sudo.sh
│   ├── startup.sh              # App startup script
│   ├── test-caddy.sh           # Caddy testing
│   ├── test-cron-sync.js       # Cron sync testing
│   └── test-manual-sync.sh     # Manual sync testing
├── src/                        # Source code
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── articles/      # Article operations
│   │   │   │   └── [id]/
│   │   │   │       ├── fetch-content/route.ts
│   │   │   │       └── summarize/route.ts
│   │   │   ├── auth/          # Authentication
│   │   │   │   ├── callback/inoreader/route.ts
│   │   │   │   └── inoreader/
│   │   │   │       ├── authorize/route.ts
│   │   │   │       ├── logout/route.ts
│   │   │   │       ├── refresh/route.ts
│   │   │   │       └── status/route.ts
│   │   │   ├── debug/         # Debug endpoints
│   │   │   │   └── data-cleanup/route.ts
│   │   │   ├── health/        # Health checks
│   │   │   │   ├── claude/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── inoreader/     # Inoreader API
│   │   │   │   ├── debug/route.ts
│   │   │   │   ├── edit-tag/route.ts
│   │   │   │   ├── stream-contents/route.ts
│   │   │   │   ├── subscriptions/route.ts
│   │   │   │   ├── unread-counts/route.ts
│   │   │   │   └── user-info/route.ts
│   │   │   ├── logs/          # Logging endpoints
│   │   │   │   └── inoreader/route.ts
│   │   │   ├── mark-all-read/route.ts
│   │   │   ├── sync/          # Sync operations
│   │   │   │   ├── bidirectional/route.ts
│   │   │   │   ├── metadata/route.ts
│   │   │   │   ├── route.ts
│   │   │   │   └── status/[syncId]/route.ts
│   │   │   └── test-*/        # Test endpoints
│   │   ├── article/[id]/       # Article detail pages
│   │   │   ├── error.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── page.tsx
│   │   ├── health/page.tsx     # Health dashboard
│   │   ├── offline/page.tsx    # Offline page
│   │   ├── test-*/page.tsx     # Test pages
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/             # React components
│   │   ├── articles/          # Article components
│   │   │   ├── article-detail.tsx
│   │   │   ├── article-header.tsx
│   │   │   ├── article-list.tsx
│   │   │   ├── read-status-filter.tsx
│   │   │   ├── summary-button.tsx
│   │   │   └── summary-display.tsx
│   │   ├── auth/              # Auth components
│   │   │   ├── auth-guard.tsx
│   │   │   ├── auth-status.tsx
│   │   │   ├── login-button.tsx
│   │   │   ├── logout-button.tsx
│   │   │   └── user-profile.tsx
│   │   ├── feeds/             # Feed components
│   │   ├── health/            # Health components
│   │   ├── legacy/            # Legacy components
│   │   ├── sync/              # Sync components
│   │   └── ui/                # UI primitives
│   ├── lib/                   # Utility libraries
│   │   ├── api/              # API services
│   │   ├── db/               # Database utilities
│   │   │   ├── migrations/   # DB migrations
│   │   │   ├── db.ts
│   │   │   ├── storage-manager.ts
│   │   │   ├── supabase.ts
│   │   │   ├── test-connection.ts
│   │   │   └── types.ts
│   │   ├── health/           # Health services
│   │   ├── hooks/            # React hooks
│   │   ├── stores/           # Zustand stores
│   │   │   ├── __tests__/
│   │   │   ├── article-store.ts
│   │   │   ├── auth-store.ts
│   │   │   ├── data-store.ts
│   │   │   ├── feed-store.ts
│   │   │   ├── health-store.ts
│   │   │   ├── sync-store.ts
│   │   │   └── ui-store.ts
│   │   ├── utils/            # Utilities
│   │   ├── sw-registration.ts
│   │   └── utils.ts
│   ├── server/               # Server-side code
│   │   └── cron.js          # Cron job service
│   ├── types/               # TypeScript types
│   │   ├── health.ts
│   │   └── index.ts
│   ├── sw.js               # Service worker source
│   └── test-setup.ts        # Test configuration
├── supabase/                # Supabase migrations
│   └── migrations/
│       ├── 20240122_create_unread_counts_function.sql
│       ├── 20240123_enable_rls_security.sql
│       ├── 20240123_enable_rls_system_config.sql
│       ├── 20240124_fix_function_security.sql
│       ├── 20240125_fix_feed_stats_index.sql
│       ├── 20240125_performance_optimizations_v2.sql
│       └── 20240125_performance_optimizations.sql
├── ~/                       # User home directory (OAuth tokens)
│   └── .rss-reader/
│       └── tokens.json     # Encrypted OAuth tokens
├── .env                    # Environment variables
├── .env.development.local  # Development environment
├── .env.example           # Example environment file
├── .env.server.example    # Server environment example
├── .eslintrc.json        # ESLint configuration
├── .gitignore            # Git ignore rules
├── .prettierrc           # Prettier configuration
├── Caddyfile             # Caddy server config
├── CHANGELOG.md          # Version history
├── CLAUDE.local.md       # Claude AI instructions
├── CPO-BRIEFING.md       # CPO onboarding doc
├── ecosystem.config.js   # PM2 configuration
├── LICENSE               # MIT License
├── Next Session Instructions.md
├── next-env.d.ts         # Next.js TypeScript env
├── next.config.mjs       # Next.js configuration
├── package-lock.json     # NPM lock file
├── package.json          # NPM package config
├── postcss.config.mjs    # PostCSS configuration
├── README.md             # Project README
├── tailscale-monitor.plist # macOS LaunchAgent
├── tailwind.config.ts    # Tailwind CSS config
├── test-rls-security.js  # Security test script
├── tsconfig.json         # TypeScript config
├── tsconfig.tsbuildinfo  # TypeScript build info
└── vitest.config.ts      # Vitest test config
```

## Key Directories

### `/src/app/api/`
Contains all API routes organized by functionality:
- **auth**: OAuth authentication flow
- **articles**: Content extraction and AI summaries
- **inoreader**: External API integration
- **sync**: Data synchronization
- **health**: System health checks

### `/src/components/`
Reusable React components organized by feature:
- **articles**: Article display and interaction
- **auth**: Authentication UI
- **feeds**: Feed management
- **ui**: Base UI components

### `/src/lib/stores/`
Zustand state management stores:
- **article-store**: Article data and operations
- **feed-store**: Feed hierarchy and counts
- **sync-store**: Sync state and queue
- **auth-store**: Authentication state
- **ui-store**: UI preferences

### `/scripts/`
Deployment and management scripts:
- Production deployment scripts
- Tailscale monitoring setup
- Database maintenance
- Testing utilities

### `/docs/`
Comprehensive documentation:
- Product requirements and user stories
- Technical architecture
- API documentation
- Deployment guides