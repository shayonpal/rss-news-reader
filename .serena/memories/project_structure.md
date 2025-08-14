# RSS News Reader Project Structure

## Root Directory

```
rss-news-reader/
├── src/                    # Source code
├── server/                 # Express sync server
├── scripts/                # Utility scripts
├── docs/                   # Documentation
├── tests/                  # Test specifications
├── public/                 # Static assets
├── migrations/             # Database migrations
├── supabase/              # Supabase config
├── .env                   # Environment variables
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── next.config.mjs        # Next.js config
├── ecosystem.config.js    # PM2 config
├── CLAUDE.md             # AI assistant guide
└── README.md             # Project overview
```

## Source Code Structure (`src/`)

```
src/
├── app/                   # Next.js App Router
│   ├── page.tsx          # Home page
│   ├── article/[id]/     # Article detail page
│   ├── api/              # API routes
│   │   ├── articles/     # Article endpoints
│   │   ├── sync/         # Sync endpoints
│   │   ├── health/       # Health checks
│   │   └── inoreader/    # Inoreader proxy
│   └── pocs/             # Proof of concepts
├── components/           # React components
│   ├── articles/         # Article components
│   ├── feeds/            # Feed sidebar
│   ├── layout/           # Layout components
│   └── ui/               # UI primitives
├── lib/                  # Core libraries
│   ├── stores/           # Zustand stores
│   ├── db/               # Database utilities
│   ├── api/              # API helpers
│   ├── utils/            # Utilities
│   ├── services/         # Business logic
│   └── ai/               # AI integration
├── hooks/                # Custom React hooks
├── types/                # TypeScript types
└── __tests__/            # Test files
```

## Key Directories

### `/server`

- Express server for bi-directional sync
- OAuth token management
- Inoreader API integration
- Content extraction services

### `/scripts`

- `validate-env.sh` - Environment validation
- `monitor-dashboard.sh` - Service monitoring
- `sync-health-monitor.sh` - Sync status
- Build and test utilities

### `/docs`

- `/tech` - Technical documentation
- `/api` - API documentation
- `/testing` - Test plans
- `/ui-ux` - Design guidelines

## Configuration Files

- `.env` - Environment variables (never commit)
- `ecosystem.config.js` - PM2 process management
- `next.config.mjs` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS
- `vitest.config.ts` - Test configuration

## Database

- Supabase PostgreSQL
- 9 main tables
- Row Level Security enabled
- Materialized view for performance

## Services (PM2)

1. `rss-reader-dev` - Main web app (port 3000)
2. `rss-sync-cron` - Scheduled sync
3. `rss-sync-server` - Bi-directional sync (port 3001)
