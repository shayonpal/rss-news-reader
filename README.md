# Shayon's News - RSS Reader PWA

[![GitHub](https://img.shields.io/badge/GitHub-shayonpal%2Frss--news--reader-blue)](https://github.com/shayonpal/rss-news-reader)
[![Status](https://img.shields.io/badge/Status-Active-green)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20iOS%20%7C%20Android-lightgrey)]()

A self-hosted RSS reader with server-client architecture, AI-powered summaries, and Tailscale network security. The server handles all Inoreader API communication while the client provides a clean, authentication-free reading experience.

## Features

- **Server-Client Architecture**: Server handles all external APIs, client is presentation only
- **No Client Authentication**: Access controlled by Tailscale network
- **Progressive Web App**: Install on mobile and desktop devices
- **AI-Powered Summaries**: Generate article summaries using Claude API (server-side)
- **Server-Side Sync**: Efficient sync with only 4-5 API calls
- **Clean Design**: Minimalist interface inspired by Reeder 5
- **Inoreader Integration**: Server syncs with existing subscriptions
- **Feed Hierarchy**: Collapsible folder structure with unread counts
- **Responsive Design**: Adaptive layout for mobile and desktop
- **Dark/Light Mode**: Manual theme control
- **Supabase Backend**: All client data served from PostgreSQL

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
```

For detailed setup instructions, see [docs/development-setup.md](docs/development-setup.md).

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

**Phase**: Server-Client Architecture Implementation

**Version**: 0.4.0

### Completed ✅

**January 21, 2025 - Server-Client Architecture**
- ✅ **US-101**: Server OAuth Setup - Server handles all Inoreader authentication
  - One-time OAuth setup script using Playwright
  - Encrypted token storage in `~/.rss-reader/tokens.json`
  - Automatic token refresh
- ✅ **US-102**: Server Sync Service (Partial) - Manual sync working
  - `/api/sync` endpoint for server-side sync
  - Efficient 4-5 API calls per sync
  - Syncs 69 feeds and 100 articles to Supabase
  - Automatic cron job pending
- ✅ **US-103**: Server API Endpoints - Complete server-side implementation
  - `POST /api/sync` - Trigger manual sync with rate limiting
  - `GET /api/sync/status/:id` - Check sync progress
  - `POST /api/articles/:id/fetch-content` - Extract full content with Readability
  - `POST /api/articles/:id/summarize` - Generate AI summary with Claude
  - All endpoints tested and working
- ✅ **US-201**: Remove Client Authentication
  - No OAuth in client
  - No login/logout UI
  - Access via Tailscale network only
- ✅ **US-202**: Supabase-Only Data Layer
  - Client reads exclusively from Supabase
  - No Inoreader API calls in client
  - All data flows: Server → Supabase → Client
- 🟡 **US-203**: Server API Integration (Partial) - Sync working, UI pending
  - ✅ Sync button calls server API endpoints
  - ✅ Progress polling with real-time updates
  - ✅ Rate limit display with warnings
  - ❌ Content extraction UI integration pending
  - ❌ AI summary UI integration pending

**Previous Milestones**
- ✅ **Development Environment**: Fully configured with quality gates
- ✅ **Foundation**: Next.js 14 + TypeScript + PWA
- ✅ **Supabase Integration**: 4-table schema with TypeScript types
- ✅ **Feed Display**: Hierarchical feed list with unread counts
- ✅ **Article List**: Infinite scroll with read/unread states

### Current Features

- **Server-Client Architecture**: Complete separation of concerns
- **No Client Authentication**: Access controlled by Tailscale network
- **Server-Side Sync**: Efficient sync with 4-5 API calls
- **Supabase Data Layer**: All client data from PostgreSQL
- **Installable PWA**: Install on mobile and desktop
- **Responsive Design**: Mobile-first layout with sidebar
- **Theme System**: Manual light/dark mode control
- **Feed Hierarchy**: Collapsible folders with unread counts
- **Article List**: Infinite scroll with read/unread states
- **Offline Queue**: Actions synced when back online

### Next Steps

**To Complete US-102 (Server Sync Service)**:
- [ ] Implement automatic daily cron job
- [ ] Add round-robin distribution (max 20 per feed)
- [ ] Create sync_errors table and error logging
- [ ] Implement read state sync back to Inoreader

**To Complete US-203 (Server API Integration)**:
- [ ] Add "Fetch Full Content" button UI for articles
- [ ] Add "Generate Summary" button UI for articles
- [ ] Display extracted content in article view
- [ ] Display AI summaries in article list/view

**Upcoming User Stories**:
- **US-104**: Content Extraction Service (UI integration for existing endpoint)
- **US-105**: Tailscale Monitoring (auto-restart if down)
- **US-301**: Claude API Integration (UI integration for existing endpoint)
- **US-401**: Feed and Tag Filtering
- **US-501**: Caddy Configuration for production

See all issues on the [GitHub Issues page](https://github.com/shayonpal/rss-news-reader/issues) or [Project Board](https://github.com/users/shayonpal/projects/7).

## Documentation

- **[Development Setup](docs/development-setup.md)**: Complete development environment guide
- **[Development Strategy](docs/development-strategy.md)**: GitHub workflow and project management
- **[Product Requirements](docs/product/PRD.md)**: Detailed product specifications
- **[User Stories](docs/product/user-stories.md)**: All user stories with acceptance criteria
- **[Technical Architecture](docs/tech/)**: Implementation decisions and architecture
- **[Health Check System](docs/health-check-system.md)**: System monitoring and health checks

## API Integration

### Inoreader API

- OAuth 2.0 authentication
- Feed subscription management
- Article synchronization
- Rate limiting: 100 calls/day

### Claude API (Anthropic)

- AI-powered article summarization
- Model: claude-3-5-sonnet-latest
- Summary length: 100-120 words

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
- **Future**: Content extraction, AI summaries, cron jobs

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


## Contributing

1. Check [GitHub Issues](https://github.com/shayonpal/rss-news-reader/issues) for open tasks
2. View [Project Board](https://github.com/users/shayonpal/projects/7) for current sprint
3. Follow development workflow in [docs/development-strategy.md](docs/development-strategy.md)
4. Run quality gates before committing: `npm run pre-commit`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/shayonpal/rss-news-reader/issues)
- **Project Board**: [Track development progress](https://github.com/users/shayonpal/projects/7)
- **Documentation**: See `/docs` folder for detailed guides
