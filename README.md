# Shayon's News - RSS Reader PWA

[![GitHub](https://img.shields.io/badge/GitHub-shayonpal%2Frss--news--reader-blue)](https://github.com/shayonpal/rss-news-reader)
[![Status](https://img.shields.io/badge/Status-Active-green)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20iOS%20%7C%20Android-lightgrey)]()

A Progressive Web Application (PWA) RSS reader with AI-powered article summarization, inspired by Reeder 5's clean design aesthetic.

## Features

- **Progressive Web App**: Install on mobile and desktop devices
- **AI-Powered Summaries**: Generate article summaries using Claude API
- **Offline-First**: Read articles without internet connection
- **Clean Design**: Minimalist interface inspired by Reeder 5
- **Inoreader Integration**: Sync with existing Inoreader subscriptions
- **Feed Hierarchy**: Collapsible folder structure with unread counts
- **Responsive Design**: Adaptive layout for mobile and desktop
- **Dark/Light Mode**: Automatic theme switching
- **Mobile-First**: Optimized for touch interactions with swipe gestures
- **Health Monitoring**: Comprehensive system health checks and monitoring

## Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v3+ with Typography plugin
- **State Management**: Zustand
- **Data Storage**: IndexedDB with Dexie.js
- **UI Components**: Radix UI primitives + custom components
- **PWA**: Service Worker with Workbox
- **Testing**: Vitest, React Testing Library, Playwright

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

   Edit `.env` with your API credentials:

   ```bash
   # Inoreader OAuth Configuration
   NEXT_PUBLIC_INOREADER_CLIENT_ID=your_client_id_here
   INOREADER_CLIENT_SECRET=your_client_secret_here
   NEXT_PUBLIC_INOREADER_REDIRECT_URI=https://strong-stunning-worm.ngrok-free.app/api/auth/callback/inoreader

   # Anthropic Claude API
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

   **Important**: For development with authentication, use the ngrok URL instead of localhost:
   - Development URL: https://strong-stunning-worm.ngrok-free.app (reserved domain)
   - The OAuth redirect URI must match the ngrok URL for authentication to work properly
   - This project uses a reserved ngrok domain that remains consistent

   For Inoreader credentials:
   - Go to [Inoreader Developer Portal](https://www.inoreader.com/developers/register-app)
   - Create a new application
   - Set redirect URI to match your development/production URL

4. **Start development server**
   ```bash
   npm run dev
   ```
   
   **For authentication testing**, access the app via ngrok:
   - https://strong-stunning-worm.ngrok-free.app
   
   **Note**: Direct localhost access (http://localhost:3000) will NOT work for OAuth authentication. Always use the ngrok URL for testing.

### Important: Authentication & Network Access

This app requires HTTPS for OAuth authentication with Inoreader. 

**Always use the ngrok URL for development:**
- URL: https://strong-stunning-worm.ngrok-free.app (reserved domain)
- Start ngrok with: `ngrok http --domain=strong-stunning-worm.ngrok-free.app 3000`
- The OAuth redirect is configured for this specific URL
- Authentication cookies are domain-specific and won't work on localhost

**If you see "Failed to sync feeds":**
1. Make sure you're accessing via the ngrok URL
2. Try signing out and signing in again
3. Check that your Inoreader credentials are valid

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run dev:network      # Start with ngrok for OAuth (REQUIRED)
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

**Phase**: Data Storage Implementation Complete ✅ - Ready for Feed Management

**Version**: 0.3.0

### Completed ✅

- ✅ **Development Environment**: Fully configured with quality gates
- ✅ **Project Infrastructure**: GitHub Projects, automation workflows  
- ✅ **Foundation**: Next.js 14 + TypeScript setup
- ✅ **Issue #5**: Initial App Setup - Full PWA functionality implemented
  - ✅ **Issue #9**: PWA Manifest and Service Worker
  - ✅ **Issue #10**: PWA Icons and Assets  
  - ✅ **Issue #12**: App Layout and Navigation
  - ✅ **Issue #11**: Offline Caching Strategy
- ✅ **Issue #6**: Inoreader OAuth Authentication - **COMPLETE & TESTED** ✅
  - ✅ **Issue #13**: OAuth API routes with secure state handling
  - ✅ **Issue #14**: Secure token storage with httpOnly cookies
  - ✅ **Issue #15**: Authentication state management in Zustand
  - ✅ **Issue #16**: Login/logout UI components with user profile
  - ✅ **Issue #17**: Protected routes with AuthGuard
  - ✅ **Issue #18**: API service layer with auto token refresh
  - ✅ **Issue #19**: Rate limiting awareness (100 calls/day)
  - ✅ **Critical Fix (June 9, 2025)**: Resolved infinite polling loop, implemented request deduplication, optimized API usage from 100+ calls to 1 call per session
- ✅ **Issue #7**: IndexedDB Data Storage - **COMPLETE** ✅
  - ✅ Dexie.js integration with TypeScript
  - ✅ 10 object stores for comprehensive data management
  - ✅ Storage quota monitoring system
  - ✅ User preferences management
  - ✅ API usage tracking integration

### Current Features

- **Installable PWA**: Users can install on mobile and desktop
- **Responsive Design**: Mobile-first layout with sidebar navigation
- **Theme System**: Light/dark/system theme support with smooth transitions
- **Offline Functionality**: Service worker with intelligent caching strategies
- **Network Awareness**: Visual indicators for connection status
- **Sync Management**: Queue system for offline actions with retry logic
- **Authentication System**: OAuth 2.0 integration with Inoreader
- **Protected Routes**: Main app requires authentication
- **User Profile**: Display authenticated user info with logout option
- **Rate Limiting**: Track and manage API usage limits
- **Data Storage**: IndexedDB with Dexie.js for offline-first data management
- **Storage Management**: Quota monitoring and automatic cleanup
- **User Preferences**: Persistent settings across sessions
- **Health Monitoring**: Real-time system health checks with alerts
- **Service Monitoring**: Track database, API, cache, auth, and network status
- **Performance Metrics**: Response time tracking and uptime monitoring

### Open Issues & Next Steps

**Currently Open**: 2 admin tasks
- [Issue #3](https://github.com/shayonpal/rss-news-reader/issues/3): Set up testing infrastructure and CI/CD (P2)
- [Issue #4](https://github.com/shayonpal/rss-news-reader/issues/4): Configure deployment pipeline (P3)

**Upcoming Development**:
- **Epic 2**: Core Reading Features (Article fetching, reading interface)  
- **Epic 3**: AI Integration (Claude API article summaries)
- **Epic 4**: Production Deployment

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

## Data Synchronization

### Sync Architecture

The app uses an **offline-first architecture** with IndexedDB as the primary data store:

1. **Fetch from Inoreader API** → **Store in IndexedDB** → **Display from Local DB**
2. All UI reads are from the local database for instant performance
3. Changes are queued and synced back to Inoreader when online

### When Sync Triggers

1. **Initial Setup (Auto-sync)**
   - Triggers automatically when a new user signs in and the database is empty
   - Only happens once per user account

2. **After Authentication (Conditional)**
   - When OAuth callback includes `?sync=true` parameter
   - **Only syncs if the database is empty** (prevents unnecessary API calls for returning users)

3. **Manual Sync Button**
   - User-initiated sync via the "Sync" button in the feed sidebar
   - Available at any time when online

4. **Pull-to-Refresh (Local Only)**
   - In the article list, pull-to-refresh reloads from IndexedDB
   - Does NOT trigger an API sync to conserve rate limit

### What Does NOT Trigger Sync

- Navigating between feeds (reads from local DB)
- Marking articles as read/unread (queued for next sync)
- Starring/unstarring articles (queued for next sync)
- Page refresh (uses cached IndexedDB data)
- Returning to the app (no auto-sync on focus)

### API Rate Limiting

The app implements smart rate limiting to work within Inoreader's free tier limits:

- **Daily Limit**: 100 API calls per day (resets at midnight UTC)
- **Per Sync Usage**: ~12 API calls (2 for metadata + 10 for top feeds)
- **Rate Limiter**: Tracks usage in localStorage and prevents sync if limit would be exceeded
- **Visual Indicators**: Shows API usage percentage when above 80%
- **Smart Sync**: Only fetches articles from top 10 feeds with unread content

### Sync Optimization Strategies

1. **Reduced Feed Fetching**: Limited to top 10 feeds by unread count (down from 20)
2. **Conditional Auto-sync**: Only for empty databases, not returning users
3. **Offline Queue**: Batches read/unread operations for next sync
4. **Usage Tracking**: Real-time API call monitoring with warnings
5. **No Periodic Sync**: Manual control to preserve API calls

### Database Storage

All synced data is stored in IndexedDB tables:

- **feeds**: RSS feed subscriptions with metadata
- **folders**: Feed categories and folder hierarchy
- **articles**: Individual news articles with content
- **summaries**: AI-generated article summaries
- **pendingActions**: Offline action queue
- **apiUsage**: API call tracking
- **userPreferences**: User settings

Benefits:
- **Offline Access**: Full functionality without internet
- **Fast Performance**: Instant loading from local database
- **Data Persistence**: Survives page refreshes and app restarts
- **Large Storage**: Can store thousands of articles locally

## Health Monitoring

The application includes a comprehensive health monitoring system:

### Monitored Services

- **Database**: IndexedDB connection, storage usage, data integrity
- **APIs**: Inoreader and Claude API availability, rate limits
- **Cache**: Service Worker cache status, LocalStorage health
- **Authentication**: Token validity, refresh capability
- **Network**: Online/offline status, external connectivity

### Health Features

- **Real-time Monitoring**: Automatic health checks every 5 minutes
- **Visual Indicators**: Status icons in header with color coding
- **Alert System**: Severity-based alerts for issues
- **Metrics Dashboard**: Performance tracking and uptime statistics
- **API Endpoint**: `/api/health` for external monitoring

Access the full health dashboard at `/health` when logged in.

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
