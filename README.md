# Shayon's News - RSS Reader PWA

[![GitHub](https://img.shields.io/badge/GitHub-shayonpal%2Frss--news--reader-blue)](https://github.com/shayonpal/rss-news-reader)
[![Status](https://img.shields.io/badge/Status-Active-green)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20iOS%20%7C%20Android-lightgrey)]()

A self-hosted RSS reader with server-client architecture, AI-powered summaries, and Tailscale network security. The server handles all Inoreader API communication while the client provides a clean, authentication-free reading experience.

## Features

- **Server-Client Architecture**: Server handles all external APIs, client is presentation only
- **No Client Authentication**: Access controlled by Tailscale network
- **Progressive Web App**: Install on mobile and desktop devices
- **Full Content Extraction**: Extract complete articles beyond RSS snippets (v0.6.0)
  - Manual fetch button for any article
  - Automatic fetching for partial content feeds
  - Smart content priority display
  - Comprehensive fetch statistics dashboard
- **AI-Powered Summaries**: Generate article summaries using Claude API (server-side)
- **Server-Side Sync**: Efficient sync with only 4-5 API calls
- **Bi-directional Sync**: Changes sync back to Inoreader (read/unread, star/unstar)
- **Mark All Read**: Quickly mark all articles in a feed as read with two-tap confirmation
- **Clean Design**: Minimalist interface inspired by Reeder 5
- **Inoreader Integration**: Server syncs with existing subscriptions
- **Feed Hierarchy**: Collapsible folder structure with unread counts
- **Responsive Design**: Adaptive layout for mobile and desktop
- **Dark/Light Mode**: Manual theme control
- **Supabase Backend**: All client data served from PostgreSQL

## Server Architecture

The RSS News Reader requires several services to be running for full functionality:

### Services & Ports

| Service Name | PM2 Process Name | Port | Environment | Purpose |
|--------------|------------------|------|-------------|---------|
| RSS Reader App | rss-reader-prod | 3147 | Production | Main web application server |
| RSS Reader Dev | rss-reader-dev | 3000 | Development | Development server (when running) |
| Sync Cron Service | rss-sync-cron | N/A | Both | Automated article syncing (2AM & 2PM) |
| Supabase PostgreSQL | N/A | 5432 | Both | Database server (cloud-hosted) |
| Tailscale | N/A | N/A | Both | VPN for secure network access |

### Essential Startup Commands

```bash
# Start all production services
pm2 start ecosystem.config.js

# Check service status
pm2 status

# View service logs
pm2 logs rss-reader-prod
pm2 logs rss-sync-cron

# Restart services
pm2 restart rss-reader-prod
pm2 restart rss-sync-cron

# Stop services
pm2 stop all
```

### Health Check Endpoints

- **Application Health**: http://100.96.166.53:3147/api/health/app
- **Database Health**: http://100.96.166.53:3147/api/health/db
- **Sync Status**: Check via PM2 logs for `rss-sync-cron`

### Monitoring

The RSS News Reader includes comprehensive monitoring with dual strategy:

- **Uptime Kuma**: External monitoring dashboard running on port 3080
  - **Access URL**: http://localhost:3080
  - **Services Monitored**: 6 monitors covering all RSS Reader services
    - RSS Reader Production (port 3147)
    - RSS Reader Development (port 3000)
    - Bi-directional Sync Server (port 3001)
    - Production Health Endpoint
    - Development Health Endpoint
    - Cron Service Health (file-based check)
  - **Notifications**: Push notifications integrated with cron service
  - **Docker Deployment**: Running on Colima Docker for isolation

- **Internal Recovery**: monitor-services.sh script for automatic service recovery
  - Checks service status and automatically restarts failed services
  - Integrates with existing PM2 ecosystem
  - Complements external monitoring with immediate recovery actions

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

The RSS reader includes an automatic sync service that runs twice daily to keep your articles fresh:

- **Schedule**: 2:00 AM and 2:00 PM (America/Toronto timezone)
- **Implementation**: Node.js cron service running as separate PM2 process
- **API Efficiency**: Only 4-5 API calls per sync (out of 100 daily limit)
- **Logging**: All sync operations logged to JSONL format for analysis
- **Error Handling**: Automatic retry with exponential backoff

### Sync Features
- Fetches up to 100 new articles per sync
- Round-robin distribution across feeds (max 20 per feed)
- Updates read/unread counts
- Refreshes feed statistics materialized view
- Tracks success/failure metrics

### Production Deployment

The RSS Reader includes a comprehensive build validation system to prevent deployment of broken builds:

```bash
# Build and deploy with validation (recommended)
./scripts/build-and-start-prod.sh

# Validate existing build before deployment
./scripts/validate-build.sh --mode full

# Emergency rollback to last working build
./scripts/rollback-last-build.sh

# Standard PM2 deployment (without validation)
pm2 start ecosystem.config.js

# Monitor sync logs
tail -f logs/sync-cron.jsonl | jq .
```

**Build Validation Features**:
- **Pre-deployment Validation**: Ensures all API routes are compiled correctly
- **Automatic Backup**: Creates backup before each deployment
- **Rollback Capability**: Restore last known good build if deployment fails
- **PM2 Integration**: Pre-start hooks prevent broken builds from starting
- **Uptime Kuma Notifications**: Build status pushed to monitoring system

For detailed automatic sync documentation, see [docs/deployment/automatic-sync.md](docs/deployment/automatic-sync.md).

## Bi-directional Sync

The RSS reader includes bi-directional sync that pushes your reading activity back to Inoreader:

- **Supported Actions**: Read/unread status, star/unstar articles
- **Sync Interval**: Changes sync every 5 minutes automatically
- **Batch Processing**: Multiple changes are batched to minimize API calls
- **Conflict Resolution**: Last-write-wins based on timestamps
- **Retry Logic**: Failed syncs retry with exponential backoff
- **Sync Queue**: Local changes queued until successfully synced

### How It Works
1. User actions (marking read, starring) are tracked locally
2. Changes are added to a sync queue with timestamps
3. Every 5 minutes, the sync service processes the queue
4. Changes are batched and sent to Inoreader's `/edit-tag` endpoint
5. Successfully synced items are removed from the queue
6. Failed items retry up to 3 times with increasing delays

This ensures your reading progress stays synchronized across all Inoreader clients.

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

**New Architecture (January 2025):**
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
- Production: http://100.96.166.53/reader (requires Caddy setup)

### Development Commands

```bash
# Server Setup
npm run setup:oauth      # One-time OAuth setup (server-side)

# Development
npm run dev              # Start development server
npm run dev:network      # Start with network access (0.0.0.0)
npm run dev:debug        # Start with Node.js debugger
npm run dev:turbo        # Start with Turbo mode

# Quality Checks
npm run type-check       # TypeScript compilation check
npm run lint            # ESLint code quality check
npm run format:check    # Prettier formatting check
npm run pre-commit      # Run all quality checks

# Testing
npm run test            # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # End-to-end tests
npm run test:watch      # Tests in watch mode

# Build & Deploy
npm run build           # Production build
npm run start           # Start production server
npm run analyze         # Bundle size analysis
npm run clean           # Clean build artifacts

# Build Validation & Safety
./scripts/validate-build.sh --mode basic   # Quick validation
./scripts/validate-build.sh --mode full    # Comprehensive validation
./scripts/build-and-start-prod.sh          # Safe production deployment
./scripts/rollback-last-build.sh           # Emergency rollback
```


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

**Version**: 0.6.0

### Production Access

- **Production URL**: http://100.96.166.53:3147/reader
- **Development URL**: http://100.96.166.53:3000/reader (when dev server running)
- **Note**: Using port 3147 due to Obsidian Docker container on port 80

### Deployment Status (July 22, 2025)

- ✅ **Production Deployed** - RSS reader running on PM2 with automatic startup
- ✅ **Automatic Daily Sync** - Cron service syncing at 2:00 AM and 2:00 PM Toronto time
- ✅ **69 feeds** and **250 articles** synced and available
- ✅ **Tailscale Monitoring** - Auto-restart service ensures constant availability
- ✅ **Database Security** - Row Level Security enabled on all tables
- ✅ **Performance Optimized** - Feed loading reduced from 6.4s to <500ms

### Key Milestones Achieved

- **Server-Client Architecture** - Complete separation of concerns
- **No Client Authentication** - Access controlled by Tailscale network  
- **Automatic Daily Sync** - Cron service runs at 2 AM and 2 PM Toronto time
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
- **Installable PWA**: Install on mobile and desktop
- **Responsive Design**: Mobile-first layout with sidebar
- **Theme System**: Manual light/dark mode control
- **Feed Hierarchy**: Collapsible folders with unread counts
- **Article List**: Infinite scroll with read/unread states
- **Offline Queue**: Actions synced when back online

## Documentation

- **[Product Requirements](docs/product/PRD.md)**: Detailed product specifications
- **[User Stories](docs/product/user-stories.md)**: All user stories with acceptance criteria
- **[Technical Architecture](docs/tech/)**: Implementation decisions and architecture
- **[Health Check System](docs/health-check-system.md)**: System monitoring and health checks
- **[Automatic Sync](docs/deployment/automatic-sync.md)**: Daily sync service documentation
- **[Deployment Guide](docs/deployment/caddy-pm2-setup.md)**: Production deployment instructions

## API Integration

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

- **`SYNC_MAX_ARTICLES`**: Number of articles to fetch per sync (default: 100)
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

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| inoreader_id | text | UNIQUE, NOT NULL | Inoreader account ID |
| username | text | | Inoreader username |
| email | text | | User email address |
| preferences | jsonb | DEFAULT '{}' | User preferences storage |
| created_at | timestamptz | DEFAULT now() | Account creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Indexes**: 
- Primary key on `id`
- Unique index on `inoreader_id`

#### 2. Feeds Table
**Purpose**: Store RSS feed subscriptions

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique feed identifier |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE | Associated user |
| inoreader_id | text | UNIQUE, NOT NULL | Inoreader feed ID |
| title | text | NOT NULL | Feed display name |
| url | text | | Feed URL |
| site_url | text | | Website URL |
| icon_url | text | | Feed icon/favicon URL |
| folder_id | uuid | REFERENCES folders(id) ON DELETE SET NULL | Parent folder |
| is_partial_content | boolean | DEFAULT false | Requires full content extraction |
| created_at | timestamptz | DEFAULT now() | Subscription timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Indexes**:
- Primary key on `id`
- Foreign key index on `user_id`
- Unique index on `inoreader_id`
- Index on `folder_id`

#### 3. Articles Table
**Purpose**: Store individual articles from feeds

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique article identifier |
| feed_id | uuid | REFERENCES feeds(id) ON DELETE CASCADE | Parent feed |
| inoreader_id | text | UNIQUE, NOT NULL | Inoreader article ID |
| title | text | NOT NULL | Article title |
| url | text | | Article URL |
| content | text | | RSS content/summary |
| full_content | text | | Extracted full content |
| has_full_content | boolean | DEFAULT false | Full content availability |
| ai_summary | text | | Claude-generated summary |
| author | text | | Article author |
| published | timestamptz | | Publication date |
| is_read | boolean | DEFAULT false | Read status |
| is_starred | boolean | DEFAULT false | Starred status |
| last_local_update | timestamptz | | Last local change timestamp |
| last_sync_update | timestamptz | | Last sync from Inoreader |
| created_at | timestamptz | DEFAULT now() | Import timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

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

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique folder identifier |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE | Associated user |
| inoreader_id | text | UNIQUE | Inoreader folder ID |
| title | text | NOT NULL | Folder name |
| parent_id | uuid | REFERENCES folders(id) ON DELETE CASCADE | Parent folder (nested) |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Indexes**:
- Primary key on `id`
- Foreign key index on `user_id`
- Unique index on `inoreader_id`
- Index on `parent_id`

#### 5. Sync Metadata Table
**Purpose**: Track sync operation statistics

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique sync identifier |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE | Associated user |
| last_sync | timestamptz | | Last successful sync time |
| last_sync_status | text | | Status (success/error) |
| sync_count | integer | DEFAULT 0 | Total sync operations |
| success_count | integer | DEFAULT 0 | Successful syncs |
| error_count | integer | DEFAULT 0 | Failed syncs |
| last_error | text | | Last error message |
| created_at | timestamptz | DEFAULT now() | First sync timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Indexes**:
- Primary key on `id`
- Foreign key index on `user_id`

#### 6. API Usage Table
**Purpose**: Track API rate limits and usage

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique usage record |
| user_id | uuid | REFERENCES users(id) ON DELETE CASCADE | Associated user |
| date | date | NOT NULL | Usage date |
| inoreader_calls | integer | DEFAULT 0 | Inoreader API calls |
| claude_calls | integer | DEFAULT 0 | Claude API calls |
| created_at | timestamptz | DEFAULT now() | Record creation |
| updated_at | timestamptz | DEFAULT now() | Last update |

**Indexes**:
- Primary key on `id`
- Compound unique index on `(user_id, date)`
- Index on `date` for cleanup

#### 7. System Config Table
**Purpose**: Cache system configuration to reduce repeated queries

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| key | text | PRIMARY KEY | Configuration key |
| value | jsonb | NOT NULL | Configuration value |
| created_at | timestamptz | DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Usage**: Caches timezone settings and other system configurations to reduce database overhead

#### 8. Sync Queue Table
**Purpose**: Track local changes for bi-directional sync to Inoreader

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique queue entry |
| article_id | uuid | REFERENCES articles(id) ON DELETE CASCADE | Article being synced |
| inoreader_id | text | NOT NULL | Inoreader article ID |
| action_type | text | NOT NULL, CHECK IN ('read','unread','star','unstar') | Action to sync |
| action_timestamp | timestamptz | NOT NULL | When action occurred |
| sync_attempts | integer | DEFAULT 0 | Number of sync attempts |
| last_attempt_at | timestamptz | | Last sync attempt time |
| created_at | timestamptz | DEFAULT now() | Queue entry creation |

**Indexes**:
- Primary key on `id`
- Foreign key index on `article_id`
- Index on `sync_attempts` for retry queries
- Index on `created_at` for batch processing

#### 9. Fetch Logs Table
**Purpose**: Track full content extraction attempts

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique log entry |
| article_id | uuid | REFERENCES articles(id) ON DELETE CASCADE | Article being fetched |
| feed_id | uuid | REFERENCES feeds(id) ON DELETE CASCADE | Parent feed |
| fetch_type | text | NOT NULL, CHECK IN ('manual','auto') | Fetch trigger type |
| success | boolean | NOT NULL | Extraction success status |
| error_reason | text | | Error message if failed |
| response_time_ms | integer | | API response time |
| content_length | integer | | Extracted content size |
| extraction_method | text | | Method used (readability, etc) |
| created_at | timestamptz | DEFAULT now() | Fetch timestamp |

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
