# Technology Stack - Shayon's News

## Architecture Overview

### Server-Client Architecture

The RSS Reader uses a clean separation of concerns:

- **Server (Mac Mini)**: Handles ALL Inoreader API communication, OAuth, and processing
- **Client (PWA)**: Reads from Supabase and calls server API endpoints
- **Access**: Via Tailscale network only (http://100.96.166.53/reader)

## Framework Selection

### Primary Framework: **Next.js 14+ (App Router)**

**Rationale:**

- Excellent PWA support with native Service Worker integration
- Server-side rendering capabilities for better SEO and performance
- Built-in optimizations (image optimization, code splitting)
- Strong TypeScript support
- Unified server and client architecture
- API routes for server endpoints

**Key Features Utilized:**

- App Router for modern routing patterns
- Built-in PWA capabilities with `next-pwa` plugin
- API routes for server endpoints (/api/sync, /api/articles/\*, etc.)
- Static generation for improved performance
- Built-in image optimization for article media
- basePath configuration for /reader path

### Alternative Considerations:

- **SvelteKit**: Excellent performance, smaller bundle sizes
- **Nuxt.js**: Vue-based, good PWA support
- **Create React App**: Simpler but less feature-rich

## Styling & UI Framework

### CSS Framework: **Tailwind CSS v3+**

**Rationale:**

- Utility-first approach enables rapid prototyping
- Excellent responsive design support
- Small production bundle size with purging
- Consistent design system through configuration
- Strong typography plugin for readable article layouts

**Key Plugins:**

- `@tailwindcss/typography` for article content styling
- `@tailwindcss/forms` for clean form components
- Custom color palette for dark/light mode

### Component Library: **Radix UI Primitives + Custom Components**

**Benefits:**

- Accessible components by default
- Headless components allow custom styling
- WAI-ARIA compliant
- Keyboard navigation support

**Key Components:**

- Dialog for modals
- Dropdown Menu for actions
- Toggle for theme switching
- Slider for settings

## State Management

### Primary: **Zustand**

**Rationale:**

- Lightweight (2.5KB gzipped)
- Simple boilerplate-free API
- Great TypeScript support
- Built-in persistence middleware
- Excellent React DevTools integration

**Store Structure:**

```typescript
// Store slices
- articlesStore: Article read operations from Supabase
- feedsStore: Feed hierarchy from Supabase
- tagsStore: Tag management from Supabase
- syncStore: Sync status polling
- settingsStore: User preferences and theme
```

### Alternative: **Context API + useReducer**

For simpler state requirements, could use React's built-in state management.

## Data Persistence & Offline Support

### Primary Storage: **Supabase (PostgreSQL)**

**Rationale:**

- Server-controlled data consistency
- Real-time capabilities for future features
- Structured queries with proper relationships
- Server handles all data management
- Client reads only, no local persistence needed

**Tables Used:**

```sql
-- Existing tables (no schema changes needed)
- users: Single user record
- folders: Feed folder hierarchy
- feeds: Feed metadata and unread counts
- articles: Article content and metadata

-- New tables
- tags: User tags from Inoreader
- article_tags: Tag assignments
- sync_metadata: Sync timestamps and status
- sync_errors: Error logging
```

### Secondary Storage: **localStorage**

For theme preference only.

### Service Worker: **Workbox**

**Features:**

- Basic PWA functionality
- Static asset caching
- Offline error page
- Handle Tailscale network requirements

## API Layer & HTTP Client

### Client HTTP: **Native Fetch API**

**Rationale:**

- Minimal client-side API calls (server endpoints only)
- No need for complex auth handling
- Built into modern browsers
- Smaller bundle size

**Client API Endpoints:**

```typescript
// Server API endpoints called by client
- POST /api/sync - Trigger manual sync
- GET /api/sync/status/:syncId - Check sync progress
- POST /api/articles/:id/fetch-content - Fetch full content
- POST /api/articles/:id/summarize - Generate AI summary
```

### Server HTTP: **Axios**

**Features:**

- Token management for Inoreader OAuth
- Automatic token refresh
- Request retries with exponential backoff
- Better error handling for external APIs

**Server API Integrations:**

```typescript
// Server-side only
- inoreaderService: All Inoreader API calls
- anthropicService: Claude AI summarization
- readabilityService: Article content extraction
- cleanupService: Database cleanup and maintenance (RR-129/RR-150)
```

## Development & Build Tools

### Type Safety: **TypeScript 5+**

**Configuration:**

- Strict mode enabled
- Path mapping for clean imports
- API response type definitions
- Component prop type safety

### Code Quality: **ESLint + Prettier**

**Rules:**

- React best practices
- Accessibility rules
- Import organization
- Consistent formatting

### Testing Framework: **Vitest + React Testing Library**

**Test Types:**

- Unit tests for utilities and components
- Integration tests for API services
- E2E tests with Playwright

### Build Tools: **Vite (via Next.js)**

**Optimizations:**

- Tree shaking for smaller bundles
- Code splitting by route
- Dynamic imports for heavy components
- Bundle analysis tools

## PWA Configuration

### Manifest Configuration:

```json
{
  "name": "Shayon's News",
  "short_name": "SNews",
  "theme_color": "#000000",
  "background_color": "#000000",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/"
}
```

### Service Worker Strategy:

- **Cache First**: Static assets, fonts, icons
- **Network First**: API calls, dynamic content
- **Stale While Revalidate**: Article images
- **Background Sync**: Read/unread state changes

## Performance Optimization

### Bundle Optimization:

- Dynamic imports for heavy components
- Code splitting by route
- Tree shaking of unused dependencies
- Compression with gzip/brotli

### Image Optimization:

- Next.js Image component for automatic optimization
- WebP format with fallbacks
- Lazy loading for article images
- Responsive image sizing

### Caching Strategy:

- Service Worker caching for assets
- IndexedDB for application data
- Memory caching for API responses
- HTTP cache headers optimization

## Development Environment

### Package Manager: **npm**

Standard package manager, good lockfile support.

### Development Server:

- Next.js dev server with hot reloading
- HTTPS support for PWA testing
- Environment variable management

### Environment Configuration:

```bash
# Client-side (public)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BASE_PATH=/reader

# Server-side only
INOREADER_CLIENT_ID=
INOREADER_CLIENT_SECRET=
ANTHROPIC_API_KEY=
CLAUDE_SUMMARIZATION_MODEL=claude-sonnet-4-20250514
RSS_READER_TOKENS_PATH=~/.rss-reader/tokens.json
SUPABASE_SERVICE_KEY=
NODE_ENV=development|production

# Development
USE_MOCK_DATA=true
TEST_INOREADER_EMAIL=
TEST_INOREADER_PASSWORD=
```

## Production Deployment

### Hosting Platform: **Self-Hosted on Mac Mini**

**Architecture:**

```
[Caddy Reverse Proxy]
    ↓
[PM2 Process Manager]
    ↓
[Next.js Application]
    ├─ Client PWA
    ├─ API Routes
    └─ Sync Service
```

**Components:**

1. **Caddy**: Reverse proxy routing /reader to Next.js
2. **PM2**: Process management with auto-restart
3. **Node-cron**: Scheduled sync every 24 hours
4. **Tailscale**: Network access control

**Benefits:**

- Complete control over server environment
- No external hosting costs
- Direct access to local token storage
- Simplified OAuth setup with localhost callback

## API Security & Rate Limiting

### Server Authentication:

- OAuth 2.0 tokens stored in encrypted local file
- Automatic token refresh before expiration
- Playwright-based automated OAuth setup
- No client authentication required

### Rate Limiting:

- Server-side Inoreader API tracking (100 calls/day)
- Efficient sync using single stream endpoint
- 4-5 API calls per sync operation
- Daily counter reset at midnight UTC

### Access Control:

- Tailscale network requirement
- No public internet access
- Single user architecture
- Server monitors Tailscale health

## Monitoring & Analytics

### Server Monitoring:

- PM2 logs for process health
- Server-side API call logging
- Sync error tracking in database
- Tailscale service monitoring

### Client Analytics: **None**

- Single-user app, no analytics needed
- All monitoring server-side
- Privacy by design

## Development Tools & Extensions

### VS Code Extensions:

- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- TypeScript Hero
- GitLens

### Browser Extensions:

- React Developer Tools
- Redux DevTools (for Zustand)
- Lighthouse for PWA auditing

## Recommended Folder Structure

```
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # Server API routes
│   │   │   ├── sync/          # Sync endpoints
│   │   │   └── articles/      # Article operations
│   │   └── reader/            # Main PWA (basePath)
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # Base UI components
│   │   ├── articles/         # Article components
│   │   └── feeds/            # Feed components
│   ├── lib/                  # Utility libraries
│   │   ├── supabase/         # Supabase client
│   │   ├── stores/           # Zustand stores
│   │   └── utils/            # Helper functions
│   └── services/             # Server-side services
│       ├── inoreader/        # Inoreader integration
│       ├── sync/             # Sync orchestration
│       └── content/          # Content extraction
├── scripts/                   # Server scripts
│   ├── setup-oauth.ts        # OAuth setup with Playwright
│   └── start-sync.ts         # Cron job initialization
└── ecosystem.config.js       # PM2 configuration
```

## Key Dependencies

### Core Dependencies:

```json
{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "typescript": "^5.0.0",
  "tailwindcss": "^3.0.0",
  "zustand": "^4.0.0",
  "@supabase/supabase-js": "^2.0.0",
  "next-pwa": "^5.0.0",
  "@radix-ui/react-*": "^1.0.0",
  "@tailwindcss/typography": "^0.5.0"
}
```

### Server Dependencies:

```json
{
  "axios": "^1.0.0",
  "node-cron": "^3.0.0",
  "@mozilla/readability": "^0.4.4",
  "jsdom": "^23.0.0",
  "playwright": "^1.0.0",
  "express": "^4.0.0",
  "pm2": "^5.0.0",
  "@anthropic-ai/sdk": "^0.20.0",
  "node-keytar": "^7.0.0",
  "he": "^1.2.0"
}
```

### Development Dependencies:

```json
{
  "@types/node": "^20.0.0",
  "@types/react": "^18.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0",
  "tsx": "^4.0.0"
}
```

## Critical Decision Points

### 1. **Server-Client Architecture**

**Decision**: All Inoreader API calls server-side, client reads from Supabase.
**Impact**: Clean separation, better security, centralized token management.

### 2. **No Client Authentication**

**Decision**: Open access behind Tailscale network.
**Impact**: Simplified architecture, no auth complexity, security via network.

### 3. **Clean-Slate Migration**

**Decision**: No data migration, start fresh with server sync.
**Impact**: Eliminates complexity, ensures data consistency.

### 4. **Automated OAuth Setup**

**Decision**: Playwright automation with test credentials.
**Impact**: One-command setup, no manual OAuth dance.

### 5. **Self-Hosted Deployment**

**Decision**: Mac Mini server instead of cloud hosting.
**Impact**: Complete control, no hosting costs, simplified OAuth.

### 6. **Single-User Design**

**Decision**: Optimize for one user, not multi-tenant.
**Impact**: Dramatic simplification, faster development.

## Server Components

### Sync Service Architecture

```typescript
// Server-side sync orchestration
class SyncService {
  // Efficient API usage: 4-5 calls per sync
  async performSync() {
    // 1. Get feed structure
    const feeds = await this.inoreader.getSubscriptions();
    const tags = await this.inoreader.getTags();

    // 2. Fetch articles (single stream endpoint)
    const articles = await this.inoreader.getStream({
      n: 100,
      ot: lastSyncTimestamp,
    });

    // 3. Get unread counts
    const counts = await this.inoreader.getUnreadCounts();

    // 4. Write to Supabase
    await this.supabase.upsertAll(feeds, tags, articles, counts);
    
    // 5. Execute cleanup operations (RR-129)
    const cleanupService = new ArticleCleanupService(supabase);
    await cleanupService.executeFullCleanup(feedIds, userId);
  }
}

// HTML Entity Decoder Service (RR-154)
class HtmlDecoderService {
  static decodeArticleContent(article: any) {
    // Uses 'he' library for standards-compliant decoding
    return {
      ...article,
      title: decodeHtmlEntities(article.title),
      content: decodeHtmlEntities(article.content),
      description: decodeHtmlEntities(article.description)
    };
  }
  
  // URL-safe decoding - never decode URLs
  static isSafeUrl(text: string): boolean {
    return text?.startsWith('http') || text?.includes('://');
  }
}

// Database cleanup service (RR-129/RR-150)
class ArticleCleanupService {
  async executeFullCleanup(feedIds: string[], userId: string) {
    // Remove feeds no longer in Inoreader
    await this.cleanupDeletedFeeds(feedIds, userId);
    
    // Remove read articles with chunked deletion (RR-150)
    await this.cleanupReadArticles(userId);
  }
  
  // Chunked deletion to handle large datasets (RR-150)
  async processArticleDeletion(articlesToDelete: Article[]) {
    const chunkSize = config.maxIdsPerDeleteOperation || 200;
    
    for (let i = 0; i < articlesToDelete.length; i += chunkSize) {
      const chunk = articlesToDelete.slice(i, i + chunkSize);
      await this.supabase.from('articles').delete()
        .in('id', chunk.map(a => a.id));
      
      // Rate limiting between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

### OAuth Setup Script

```typescript
// Automated OAuth with Playwright
const setupOAuth = async () => {
  // Start local Express server for callback
  const server = express();
  server.get("/auth/callback", captureTokens);

  // Launch Playwright browser
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to Inoreader OAuth
  await page.goto(oauthUrl);

  // Auto-fill credentials from .env
  await page.fill("#email", process.env.TEST_INOREADER_EMAIL);
  await page.fill("#password", process.env.TEST_INOREADER_PASSWORD);
  await page.click("#authorize");

  // Store encrypted tokens
  await storeTokens(tokens);
};
```

This technology stack is specifically designed for the server-client architecture, ensuring clean separation of concerns and optimal performance for a single-user RSS reader.
