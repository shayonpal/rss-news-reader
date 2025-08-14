# Technology Stack

## Frontend

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **State Management**: Zustand
- **Notifications**: Sonner (toast)
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Backend

- **Runtime**: Node.js
- **Framework**: Express (for sync server)
- **Database**: Supabase (PostgreSQL)
- **Process Manager**: PM2
- **Cron Jobs**: node-cron
- **OAuth**: Inoreader API integration
- **AI**: Anthropic Claude API for summaries
- **Content Extraction**: Mozilla Readability

## Testing

- **Unit/Integration**: Vitest
- **E2E**: Playwright
- **Coverage**: Built-in Vitest coverage
- **Mocking**: vitest-mock, fake-indexeddb

## Development Tools

- **Linting**: ESLint with Next.js config
- **Formatting**: Prettier with Tailwind plugin
- **Type Checking**: TypeScript compiler
- **Build Tool**: Next.js built-in (Webpack)
- **Environment**: .env files with validation

## Services

- **Main App**: rss-reader-dev (port 3000)
- **Sync Service**: rss-sync-cron (automated)
- **Sync Server**: rss-sync-server (port 3001)
- **Monitoring**: Uptime Kuma (port 3080)
