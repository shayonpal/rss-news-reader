# PRD - Shayon's News RSS Reader PWA

## Product Overview

### Product Name

**Shayon's News**

### Vision

A clean, fast, and intelligent RSS reader that respects the user's time by providing AI-powered summaries and seamless offline access. Built as a Progressive Web Application for cross-device compatibility.

### Core Value Proposition

- **Time-Efficient**: AI summaries let users quickly grasp article content
- **Always Available**: Offline-first design ensures content is always accessible
- **Distraction-Free**: Clean interface inspired by Reeder 5's minimalist design
- **Zero-Maintenance**: Server handles all sync and authentication automatically
- **Private & Secure**: Accessible only via Tailscale network

### Target User

Initially built for personal use, with exactly one user,  with plans to open-source under GPL for the wider community.

### Related Documentation

- [User Flow Diagrams](user-flow-diagrams.md) - Technical flows and system states
- [User Journeys](user-journeys.md) - Emotional journeys and use cases

### Implementation Note

**Current State vs Target Architecture**: This PRD describes the target server-client architecture where all Inoreader API communication happens server-side. The current implementation (as of July 2025) includes client-side OAuth and API calls that will be migrated to the server. 

**Migration Approach**: The migration will use a clean-slate approach:
- Keep all existing Supabase table structures (no schema changes)
- Clear all existing article data before first server sync
- No data migration needed - start fresh with server-side sync
- This eliminates complexity and ensures clean server-controlled data

## Core Features

### Feed Management

- Server synchronizes feeds from Inoreader to Supabase
- Preserve Inoreader's folder hierarchy and tag structure
- Display unread counts at feed, folder, and tag levels
- No manual feed management within the app
- Client reads exclusively from Supabase
- Filter articles by feed OR tag (mutually exclusive)
- Filter articles by read status: Unread only (default), Read only, All articles

### Article Synchronization

- Automatic server-side sync every 24 hours
- Manual sync triggered by client (executes server-side)
- Server fetches up to 100 new articles per sync (max 20 per feed)
- Round-robin fetching to ensure all feeds get representation
- URL-based deduplication in Supabase

### Content Processing

- Server stores RSS content as-is from Inoreader
- User-triggered full content fetching via "Fetch Full Content" button
- Server uses Mozilla Readability for content extraction
- Preserve essential rich media (images, videos, embedded tweets)
- Display 4 lines of RSS content for articles without summaries

### AI Summarization

- On-demand summarization using Anthropic Claude 4 Sonnet
- 150-175 word summaries
- Re-summarize option for unsatisfactory summaries
- Summaries stored in Supabase
- Display full summary in list view when available
- Client triggers summarization via API endpoint

### Full Content Fetching

- User-triggered via "Fetch Full Content" button in article view
- Server fetches article URL and extracts content using Mozilla Readability
- Clean, readable content extracted (ads/navigation removed)
- Stored in separate `full_content` field in Supabase
- Button shows loading state during fetch
- Once fetched, article displays full content instead of RSS snippet

### User Interface

- Clean, minimalist design inspired by Reeder 5
- Dark/light mode based on system preference
- Typography-first approach for optimal readability
- Dense information display without feeling cramped
- Subtle, smooth transitions

### Offline Capabilities

- Basic service worker for PWA functionality
- Handle network errors gracefully
- Show error messages when offline
- Queue actions for when back online (future)

## Detailed Requirements

### Architecture & Access

- Server-side OAuth with Inoreader (one-time setup)
- No client authentication - completely open access
- Inoreader tokens stored on server only
- Access via Tailscale network: http://100.96.166.53/reader
- If server detects Tailscale service down, it should attempt restarting it automatically
- Tailscale must remain accessible for client access - this is critical for the architecture
- Client reads article data from Supabase and calls server API endpoints for operations

### Server OAuth Setup (One-Time Process)

The server requires a one-time OAuth setup to obtain Inoreader tokens:

#### Setup Process

1. **Automated Setup with Playwright**:
   - Uses test credentials from `.env` file
   - No manual login required
   - Runs directly on Mac Mini server

2. **OAuth Flow**:
   ```bash
   # Run on Mac Mini (already there, no SSH needed)
   npm run setup:oauth
   
   # Script automatically:
   # - Starts temporary Express server on localhost:8080
   # - Launches Playwright browser
   # - Logs into Inoreader with test credentials
   # - Authorizes the app
   # - Captures tokens from callback
   # - Stores tokens securely
   ```

3. **Token Storage**:
   - Tokens stored in encrypted JSON file
   - Default location: `~/.rss-reader/tokens.json`
   - Environment variable: `RSS_READER_TOKENS_PATH`
   - File permissions: 600 (read/write for owner only)
   - Encryption: Uses system keychain (node-keytar) or AES-256

4. **Token Structure**:
   ```json
   {
     "access_token": "encrypted_token_here",
     "refresh_token": "encrypted_refresh_token",
     "expires_at": 1234567890,
     "token_type": "Bearer",
     "created_at": 1234567890
   }
   ```

5. **Security Considerations**:
   - Never commit tokens to version control
   - Tokens encrypted at rest
   - Automatic token refresh before expiration
   - Audit log for token access

### Feed Synchronization Rules

#### Sync Frequency

- Automatic sync twice daily at 2am and 2pm server time (America/Toronto)
- Manual sync available anytime via UI button
- Respect Inoreader API rate limits (100 calls/day for Zone 1)
- All sync activity logged to JSONL file for troubleshooting

#### Sync Process (Server-Side)

**Efficient API Strategy: 4-5 calls per sync**

1. **Get Feed Structure** (2 calls):
   - `/subscription/list` - All feed subscriptions and folders
   - `/tag/list` - All user tags and labels

2. **Get Articles** (1 call):
   - `/stream/contents/user/-/state/com.google/reading-list`
   - Parameters: `n=100` (max articles), `ot=[timestamp]` (since last sync)
   - Returns ALL articles from ALL feeds in one request

3. **Get Unread Counts** (1 call):
   - `/unread-count` - Returns counts for all feeds/folders

4. **Update Read States** (0-1 call, if needed):
   - `/edit-tag` - Batch update read/unread changes from client

5. **Write to Supabase**:
   - Store all fetched data
   - Update sync timestamp

#### Sync Limits

- Maximum 100 new articles per sync across all feeds
- Maximum 20 new articles per individual feed
- Round-robin distribution when limits are reached
- Prioritize unread articles

#### API Efficiency

- Single stream endpoint for ALL articles (not per-feed)
- Batch read/unread updates in one call
- Actual usage: 4-5 API calls per sync
- Daily estimate: ~24 calls (1 auto + 5 manual syncs)

### Article Management

#### Storage

- Maintain maximum 500 articles
- Daily pruning at midnight (oldest first)
- Separate storage for:
  - Article metadata (always retained for last 500)
  - Article content (retained for viewed articles)
  - AI summaries (retained while article exists)

#### Display Rules

- List View:
  - Show AI summary if available (full text)
  - Otherwise show 4 lines of parsed content
  - Strip all HTML from snippets
  - Include source, author, date
- Article View:
  - Show RSS content from Supabase by default
  - "Fetch Full Content" button for all articles
  - Display full content if already fetched
  - Show all rich media appropriately

#### Read/Unread Management

- Client updates read/unread status in Supabase
- Server syncs status changes to Inoreader periodically
- Visual distinction between read/unread in UI
- Batch updates during sync operations
- Conflict resolution: most recent change wins

#### Read Status Filtering

- **Filter Options**: Dropdown with three choices:
  - "Unread only" (default) - Focus on new content
  - "Read only" - Review previously read articles
  - "All articles" - Complete view of all content
- **Filter Persistence**: User's preference saved in localStorage
- **Dynamic Headers**: Page title changes based on active filter
  - "Unread Articles" when showing unread only
  - "Read Articles" when showing read only  
  - "All Articles" when showing everything
- **Database Counts**: Article counts fetched from database, not loaded articles
  - Smart caching with 5-minute TTL for performance
  - Cache invalidation on user actions (mark read/unread)
  - Accurate counts that respect current feed/folder selection
- **Count Display Examples**:
  - Unread filter: "296 unread articles"
  - Read filter: "1,204 read articles"
  - All filter: "1,500 total articles (296 unread)"
- **Integration**: Works seamlessly with existing feed/folder filters

### Summary Generation

#### AI Configuration

- Model: Anthropic Claude 4 Sonnet
- Summary length: 150-175 words
- Include article metadata in prompt

#### Prompt Configuration (Customizable)

**Default Configuration**:
The system uses a modular approach to construct summarization prompts with these default values:
- **Word Count**: 150-175 words
- **Focus**: key facts, main arguments, and important conclusions
- **Style**: objective and informative

**Environment Variable Customization**:
System administrators can customize the summarization behavior through environment variables:

```env
# Core Summarization Variables
SUMMARY_WORD_COUNT=150-175              # Target summary length
SUMMARY_FOCUS=key facts, main arguments, implications  # What to emphasize
SUMMARY_STYLE=objective                 # Writing style
```

**Generated Prompt Template** (constructed from variables):
```
You are a news summarization assistant. Create a {STYLE} summary of the following article in {WORD_COUNT} words. Focus on {FOCUS}. Maintain objectivity and preserve the author's core message.

IMPORTANT: Do NOT include the article title in your summary. Start directly with the content summary.

Article Details:
Title: [TITLE]
Author: [AUTHOR]
Published: [DATE]

Article Content:
[BODY]

Write a clear, informative summary that captures the essence of this article without repeating the title.
```

**Customization Examples**:

1. **Technical Blog Summarization**:
   ```env
   SUMMARY_WORD_COUNT=200-250
   SUMMARY_FOCUS=technical details, implementation steps, and code examples
   SUMMARY_STYLE=technical and detailed
   ```

2. **Executive Briefing Style**:
   ```env
   SUMMARY_WORD_COUNT=100-125
   SUMMARY_FOCUS=business impact, key decisions, and action items
   SUMMARY_STYLE=concise and actionable
   ```

3. **News Digest Format**:
   ```env
   SUMMARY_WORD_COUNT=75-100
   SUMMARY_FOCUS=who, what, when, where, why
   SUMMARY_STYLE=journalistic
   ```

**Implementation Details**:
- Invalid configuration values silently fall back to defaults
- Changes require server restart to take effect
- Configuration is provider-agnostic (works with future LLM providers)
- See [[TODO-023]] and [[Implementation Strategy#AI-Summarization-Configuration]] for technical details

#### Summary Management

- Summaries generated server-side via API endpoint
- Store summaries in Supabase with articles
- Update list view immediately after generation
- Allow re-summarization with same prompt
- Track API usage server-side for monitoring

### Navigation & Information Architecture

#### Views

1. **Feed List** (Sidebar/Drawer)

   - Two tabs: "Feeds" and "Tags"
   - **Feeds Tab**:
     - Hierarchical folder structure
     - Collapsible folders
     - Individual feed items within folders
     - Unread counts per feed and folder
   - **Tags Tab**:
     - Flat list of all tags
     - Unread counts per tag
   - Only one filter active at a time (feed OR tag)
   - Visual indicators for sync status

2. **Article List** (Main View)

   - Shows articles based on selected filters:
     - Feed/tag filter: All articles, specific feed, or specific tag
     - Read status filter: Unread only (default), Read only, All articles
   - Dynamic header based on active filters:
     - "Unread Articles" / "Unread from [Feed Name]"
     - "Read Articles" / "Read from [Feed Name]"
     - "All Articles" / "All from [Feed Name]"
   - Accurate article counts from database (not just loaded articles)
   - Newest first, no sorting options
   - Clear visual hierarchy
   - Read/unread distinction
   - Summary/snippet display
   - Current filters shown in header

3. **Article Detail**

   - RSS content displayed by default
   - Article metadata header
   - "Fetch Full Content" button (calls server API)
   - Summarize/Re-summarize button (calls server API)
   - Swipe navigation (previous/next article)

4. **Settings** (Simplified)

   - Theme preference
   - Last sync timestamp
   - Manual sync button

5. **Server Admin Dashboard** (Optional, server-side only)
   - Inoreader API usage
   - AI summarization count
   - Sync history and errors
   - Token status

### Data Persistence

#### Storage Strategy

**Server Storage:**
- Inoreader tokens in local file/environment
- Sync logs and state

**Supabase Storage:**
- All article metadata and RSS content (in 'content' column)
- Full content (when fetched by user, in 'full_content' column)
- Feed and folder structure (existing tables)
- Tag assignments per article (new article_tags table)
- Read/unread states (is_read column)
- AI summaries (new ai_summary column)
- Last sync timestamp (in sync_metadata table)
- Content fetch status flags (new has_full_content column)
- Unread counts by feed/folder/tag (stored in respective tables)

**Client Storage (PWA):**
- Service worker for basic PWA features
- No article caching (always fetch from Supabase)

#### Offline Behavior

- Show error message when Supabase unreachable
- Disable all interactive features
- Display "No connection" state
- Retry connection periodically

### Sync Conflict Resolution

- Track modification timestamps
- Most recent change wins
- Apply changes in order during sync
- No user intervention required

## User Interface Specifications

### Design Principles

1. **Typography First**: Large, readable fonts with clear hierarchy
2. **Minimal Chrome**: Focus on content, reduce UI elements
3. **Smart Whitespace**: Generous padding without wasting space
4. **Subtle Interactions**: Smooth transitions, no flashy animations
5. **Monochrome Base**: Grayscale palette with accent colors
6. **Information Density**: Fit more content without cramping

### Views & Layouts

#### Mobile Layout (Primary)

- Bottom navigation for main sections
- Swipe from left edge for feed list
- Full-width article list
- Edge-to-edge article reading

#### Tablet/Desktop Layout

- Persistent sidebar with feed list
- Multi-column article list (tablet landscape)
- Wider reading column with margins
- Keyboard navigation support (future)

### Visual Hierarchy

1. Article titles (largest, boldest)
2. Source and metadata (smaller, muted)
3. Summary/snippet text (readable, moderate size)
4. UI controls (small, unobtrusive)
5. Status indicators (subtle, contextual)

### Interaction Patterns

- Tap to read article
- Tap feed/folder to filter articles
- Tap tag to filter articles
- Tap read status filter to toggle between unread/read/all
- Clear filter to show all articles
- Long-press for quick actions (future)
- Swipe between articles in detail view
- Pull-to-refresh in list view
- Smooth scrolling with momentum

### Responsive Behavior

- Single layout system that adapts
- Breakpoints at 640px, 768px, 1024px
- Font sizes scale with viewport
- Touch targets minimum 44x44px

## System Behaviors

### Sync Process & Limits

#### Automatic Sync (Server-Side)

- Node.js cron service runs at 2am and 2pm daily (America/Toronto)
- Server fetches from Inoreader → writes to Supabase
- Handle token refresh automatically
- Log all operations to JSONL file:
  - Sync start/completion with timestamps
  - Progress updates and article counts
  - Error details with duration tracking
  - Analysis-friendly format for troubleshooting

#### Manual Sync

- User triggers via button in client
- Client calls server API endpoint
- Server executes sync process
- Client polls Supabase for updates
- Show progress indicator during sync

#### Rate Limit Management

- Server tracks API calls per day
- Server handles rate limiting internally
- Log warnings when approaching limits
- Reset counter at midnight UTC

### Error Handling

#### Network Errors

- Retry with exponential backoff
- Fall back to cached content
- Clear error messages
- Suggest offline mode

#### API Errors

- Handle rate limits gracefully
- Display Inoreader service status
- Provide manual retry option
- Log errors for debugging

#### Content Parsing Errors

- Show original content as fallback
- Log problematic feeds
- Allow manual refresh
- Skip malformed articles

### Offline Mode

- Automatic detection
- Disable sync buttons
- Enable read/unread queue
- Show cached content indicator
- Sync automatically when online

### Performance Targets

- Initial load: < 2 seconds
- Article list render: < 1 second
- Article open: < 0.5 seconds
- Summary generation: < 5 seconds
- Article count queries: < 200ms (with 5-minute caching)
- Smooth 60fps scrolling

### API Usage Monitoring (Server-Side)

#### Tracking

- Server logs all Inoreader API calls
- Server logs Anthropic API usage
- Stored in server logs/database
- Optional admin dashboard for viewing

#### Logging

- Server maintains 30 days of logs
- Accessible via SSH to Mac Mini
- Export functionality (future)
- Debug mode for development

## Future Considerations

### Explicitly Out of Scope for v1

- Multiple user support
- Feed management within app
- Full-text search
- Bookmarking/favorites
- Note-taking/annotations
- Keyboard shortcuts
- Push notifications
- Email digests
- Custom AI providers
- OPML import/export
- Reading statistics
- Social sharing

### Architecture Decisions for Future Features

- Design with search index in mind
- Abstract AI provider interface
- Plan for user preference storage
- Consider real-time sync architecture
- Prepare for collaborative features

## Success Metrics

### Core Success Criteria

1. **Performance**: Page loads under 2 seconds consistently
2. **Reliability**: 99% successful sync rate
3. **Efficiency**: Stay under 50 API calls/day average
4. **Usability**: Read 50+ articles without friction
5. **AI Value**: 80% of summaries are helpful

### Quality Indicators

- Smooth offline/online transitions
- No data loss during syncs
- Accurate unread counts
- Consistent UI responsiveness
- Clear error recovery paths

## Technical Architecture

### System Overview

The RSS Reader uses a hybrid architecture where:
- **Client (PWA)** reads article data directly from Supabase for performance
- **Client** calls server API endpoints for operations requiring server-side logic
- **Server (Mac Mini)** handles all Inoreader communication and processing

### Data Flow Diagram

```
[Inoreader API] ← → [Mac Mini Server]
                           |
                           ├─→ [Sync Service] → [Supabase]
                           |                         ↑
                           └─→ [API Routes]          |
                                    ↑                |
                                    |                ↓
                              [Client PWA via Tailscale]
```

### Server Architecture

Single Next.js application with:
- **API Routes**: Handle client requests (/api/*)
- **Sync Service**: Background service using node-cron
- **Process Manager**: PM2 manages the Node.js process
- **Reverse Proxy**: Caddy routes /reader to Next.js port

## Data Schema

### Existing Supabase Tables (No Changes Needed)

```sql
-- Users table (existing - will use single record)
-- Already has: id, email, inoreader_id, preferences (JSONB)

-- Folders table (existing - already perfect)
-- Already has: id, user_id, inoreader_id, name, parent_id (self-ref)

-- Feeds table (existing - minor update needed)
-- Already has: id, user_id, inoreader_id, title, url, folder_id (TEXT), unread_count
-- Note: folder_id is TEXT storing Inoreader folder ID directly
```

### Tables Requiring Minor Updates

```sql
-- Articles table (add new columns)
ALTER TABLE articles 
ADD COLUMN author TEXT,
ADD COLUMN full_content TEXT,
ADD COLUMN ai_summary TEXT,
ADD COLUMN has_full_content BOOLEAN DEFAULT FALSE;

-- Note: 'content' column already exists for RSS content
```

### New Tables to Create

```sql
-- Tags table (new)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  inoreader_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article-Tag junction table (new)
CREATE TABLE article_tags (
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- Sync metadata table (new)
CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New indexes needed
CREATE INDEX idx_article_tags_tag_id ON article_tags(tag_id);
CREATE INDEX idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_tags_inoreader_id ON tags(inoreader_id);

-- Sync errors table (new)
CREATE TABLE sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id TEXT,
  error_type TEXT,
  error_message TEXT,
  item_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_errors_sync_id ON sync_errors(sync_id);
CREATE INDEX idx_sync_errors_created_at ON sync_errors(created_at DESC);
```

### Schema Notes

1. **Minimal Changes**: We're reusing the existing schema structure
2. **folder_id**: Kept as TEXT in feeds table (stores Inoreader folder ID)
3. **user_id**: Present in all tables for future multi-user support, but we'll use a single user
4. **content vs rss_content**: Using existing 'content' column for RSS content
5. **is_starred**: Already exists in articles table for future use
6. **Indexes**: Most required indexes already exist

## API Contract

### Server API Endpoints

#### 1. Trigger Manual Sync
```typescript
POST /api/sync
Request: {}
Response: {
  success: boolean,
  syncId: string,     // UUID for tracking
  message: string
}
Errors: {
  429: "Rate limit exceeded",
  500: "Sync service error"
}
```

#### 2. Check Sync Status
```typescript
GET /api/sync/status/:syncId
Response: {
  status: 'pending' | 'running' | 'completed' | 'failed',
  progress: number,          // 0-100
  itemsProcessed?: number,
  totalItems?: number,
  message?: string,
  error?: string
}
```

#### 3. Fetch Full Article Content
```typescript
POST /api/articles/:id/fetch-content
Request: {}
Response: {
  success: boolean,
  content?: string,    // HTML content from Readability
  error?: string       // Falls back to RSS content on failure
}
Errors: {
  404: "Article not found",
  500: "Content extraction failed"
}
```

#### 4. Generate AI Summary
```typescript
POST /api/articles/:id/summarize
Request: {
  regenerate?: boolean  // Force new summary
}
Response: {
  success: boolean,
  summary?: string,     // 150-175 words
  error?: string
}
Errors: {
  404: "Article not found",
  429: "AI rate limit exceeded",
  500: "Summary generation failed"
}
```

### Error Response Format
```typescript
interface ErrorResponse {
  error: string,
  message: string,
  details?: any
}
```

## Sync State Management

### Sync Process Flow

1. **Client initiates sync**: POST /api/sync → receives syncId
2. **Server updates status**: Writes to sync_metadata table
3. **Client monitors progress**: 
   - Simple polling: GET /api/sync/status/:syncId every 2 seconds
   - (Future enhancement: Supabase realtime subscription)
4. **Completion**: Client refreshes data when status = 'completed'

### Conflict Resolution

- **Strategy**: Last write wins based on timestamps
- **Implementation**: All updates include updated_at timestamp
- **Sync order**: 
  1. Fetch from Inoreader
  2. Apply client changes to Inoreader (read/unread)
  3. Write merged state to Supabase

### Failure Handling

- **Partial sync failures**: Continue with remaining items
- **Failed items**: Logged to JSONL file with:
  - timestamp: ISO 8601 format
  - trigger: 'cron-2am' or 'cron-2pm' or 'manual-sync'
  - status: 'error'
  - error: Detailed error message
  - duration: How long sync ran before failure
- **Sync metadata tracking**: Update sync_metadata table with:
  - last_sync_time: Timestamp of last attempt
  - last_sync_status: 'success' or 'failed'
  - last_sync_error: Error message if failed
  - sync_success_count: Running total
  - sync_failure_count: Running total
- **Log analysis**: Use jq commands to analyze JSONL logs
- **User notification**: Clear error messages in UI

## Article Limit Algorithm

### Round-Robin Distribution

When fetching 100 articles across multiple feeds:

```typescript
// Pseudocode for article distribution
const MAX_TOTAL = 100;
const MAX_PER_FEED = 20;

1. Get all feeds with unread articles
2. Sort by last_fetched timestamp (oldest first)
3. While totalFetched < MAX_TOTAL:
   - For each feed in rotation:
     - Fetch min(remainingTotal, MAX_PER_FEED, feed.unreadCount)
     - Update last_fetched timestamp
     - Add to totalFetched
4. Store fetched articles in Supabase
```

## Additional Technical Details

### Unread Counts
- **Storage**: Cached in feeds.unread_count and tags.unread_count
- **Update**: Recalculated during each sync
- **Real-time**: Updated immediately when user marks read/unread

### Content Extraction Fallback
- **Primary**: Mozilla Readability extracts clean content
- **Fallback**: If Readability fails, show original RSS content
- **User feedback**: "Content extraction failed" message with option to view RSS

### Tailscale Monitoring
- **Health check**: Server monitors Tailscale service every 5 minutes
- **Auto-restart**: `sudo tailscale up` if service is down
- **Sudo configuration**: Add to `/etc/sudoers.d/tailscale`:
  ```
  nodeuser ALL=(ALL) NOPASSWD: /usr/bin/tailscale up
  ```
- **Logging**: All restart attempts logged for debugging
- **Critical**: Without Tailscale, clients cannot access the service

### PM2 Configuration
- **Auto-restart**: Yes, enable on crashes
- **Memory limit**: 1GB for Next.js app, 256MB for cron service
- **Config file** (`ecosystem.config.js`):
  ```javascript
  module.exports = {
    apps: [{
      name: 'rss-reader',
      script: 'npm',
      args: 'start',
      max_memory_restart: '1G',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true
    }, {
      name: 'rss-sync-cron',
      script: './src/server/cron.js',
      instances: 1,
      max_memory_restart: '256M',
      error_file: 'logs/cron-error.log',
      out_file: 'logs/cron-out.log',
      merge_logs: true,
      time: true,
      env: {
        ENABLE_AUTO_SYNC: true,
        SYNC_CRON_SCHEDULE: '0 2,14 * * *',
        SYNC_LOG_PATH: './logs/sync-cron.jsonl'
      }
    }]
  }
  ```

## Development Milestones

### Milestone 1: Server Foundation

- Server-side Inoreader OAuth setup (localhost callback)
- Token storage mechanism
- Basic sync service (Inoreader → Supabase)
- Node-cron automatic sync service (2am/2pm daily)
- JSONL logging for all sync operations
- Sync metadata tracking in database
- API endpoints: manual sync, full content fetch
- Mozilla Readability integration

### Milestone 2: Client Simplification

- Remove all Inoreader API calls
- Convert to Supabase-only data source
- Simplify authentication (remove it)
- Update sync button to call server API
- Configure Caddy reverse proxy

### Milestone 3: Core Reading Experience

- Article list and detail views
- Folder/feed hierarchy from Supabase
- Tag display and filtering
- Read/unread status management
- "Fetch Full Content" button implementation
- Responsive design

### Milestone 4: AI Integration

- Server-side Anthropic API integration
- API endpoint for summary requests
- Summary storage in Supabase
- Re-summarize functionality
- Server-side API usage tracking

### Milestone 5: Polish & Optimization

- Dark/light mode
- Performance optimization
- Error handling improvements
- PWA manifest and icons
- Service worker optimization for Tailscale

### Milestone 6: Production Ready

- Tailscale network configuration
- Caddy setup for /reader path
- Update Next.js basePath configuration
- Service worker adjustments for HTTP
- Documentation updates
- Open source preparation

## Development Notes

### API Conservation During Development

- Use mock data whenever possible
- Cache API responses aggressively
- Implement "development mode" with stale data
- Share test accounts to minimize API usage
- Log all API calls for optimization

### Technology Stack

**Server (Mac Mini):**
- **Runtime**: Node.js for sync service
- **Scheduler**: node-cron for automated sync
- **OAuth**: Automated Playwright setup using test credentials
- **Token Storage**: Encrypted JSON file with system keychain integration
- **Content Extraction**: Mozilla Readability + jsdom
- **API Endpoints**: Express for manual sync, full content, summarization

**Client (PWA):**
- **Framework**: Next.js (already in use)
- **Styling**: Tailwind CSS + Typography plugin
- **Components**: Radix UI for accessibility
- **State**: Zustand for simplicity
- **Data**: Supabase JS client
- **PWA**: Workbox for service worker

**Infrastructure:**
- **Reverse Proxy**: Caddy for path routing
- **Network**: Tailscale for secure access
- **Database**: Supabase (existing)

### Deployment Architecture

**Access URL:** `http://100.96.166.53/reader`

**Server Components:**
1. **Sync Service** - Runs on Mac Mini, handles all Inoreader communication
2. **API Service** - Handles full content fetching, summarization
3. **Next.js App** - Serves the PWA client
4. **Caddy** - Routes `/reader` to Next.js port
5. **Cron** - Triggers daily sync

**Data Flow:**
```
[Inoreader API] ← → [Mac Mini Sync Service] → [Supabase]
                                                    ↑
                                                    ↓
                          [Client PWA via Tailscale]
```

### Development Environment

- **Supabase**: Use SAME project for both dev and production
  - Single user project - no risk of affecting others
  - Saves costs and complexity
  - Test data can be easily cleaned up via SQL
- **Test Credentials**: Already configured in .env file
  - Inoreader test account credentials available
  - Dev API calls count against same daily limit anyway
- **Mock Data**: 
  - Mock Inoreader responses in `mocks/` directory
  - Environment variable `USE_MOCK_DATA=true` for development
  - Preserves API calls during testing
- **Local Development**:
  ```bash
  # .env.development
  NEXT_PUBLIC_SUPABASE_URL=https://[same-project].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[same-anon-key]
  USE_MOCK_DATA=true  # For Inoreader API calls only
  TEST_USER_EMAIL=test@example.com  # Different from production user
  ```

### Testing Strategy

#### Playwright MCP vs Integrated Tests Analysis

**Current Setup**: Playwright MCP server already configured with test credentials

**Option A: Playwright MCP (Recommended for Initial Development)**
- ✅ **Pros**:
  - Already configured and ready to use
  - Visual testing through browser automation
  - Can test full OAuth flow and user interactions
  - Good for acceptance testing during development
  - No additional setup required
- ❌ **Cons**:
  - Slower than unit tests
  - More brittle (UI changes break tests)
  - Manual intervention required

**Option B: Integrated Playwright Tests**
- ✅ **Pros**:
  - Automated regression testing
  - CI/CD integration possible
  - Consistent test environment
  - Better for long-term maintenance
- ❌ **Cons**:
  - More setup work initially
  - Another system to maintain
  - Over-engineering for single-user project

**Recommendation**: Use Playwright MCP for development testing. Tech lead must make the final decision on testing strategy using an established decision framework (see below).

#### Decision Frameworks for Testing Strategy

The tech lead should choose one of these frameworks to guide their testing strategy decision:

**1. Risk-Impact Matrix**
- **Evaluate**: Risk of bugs vs Impact on user
- **Criteria**:
  - Bug probability (Low/Medium/High)
  - User impact severity (Low/Medium/High)
  - Cost of fixing in production
- **Decision**: High risk + High impact = Integrated tests

**2. ROI (Return on Investment) Analysis**
- **Calculate**: Test value vs Implementation cost
- **Formula**: ROI = (Bug prevention value - Test maintenance cost) / Test setup time
- **Factors**:
  - Setup time (hours)
  - Maintenance time per month
  - Potential debugging time saved
- **Decision**: Positive ROI = Implement tests

**3. Technical Debt Quadrant**
- **Categorize**: Testing approach by debt type
- **Options**:
  - Prudent-Deliberate: "We choose MCP now, migrate later"
  - Prudent-Inadvertent: "Now we know integrated tests would help"
  - Reckless-Deliberate: "No time for any tests"
  - Reckless-Inadvertent: "What's Playwright?"
- **Decision**: Stay in prudent quadrants only

**Tech Lead Action Required**: Document which framework was used and the rationale for the final testing decision.

#### Testing Approach

1. **Development Phase**: Use Playwright MCP for manual testing
2. **Key Test Scenarios**:
   - OAuth flow with test credentials
   - Article sync and display
   - Full content fetching
   - AI summarization
   - Read/unread state management
3. **API Testing**: Use mock data to preserve daily limits
4. **Production Testing**: Limited manual verification

### Open Source Considerations

- GPL license for community use
- Document server setup process
- Make sync service configurable
- Provide Docker compose for easy deployment
- Consider multi-user support in future versions

## Bi-directional Sync Feature (TODO-037)

### Overview

Enable two-way synchronization of read/unread and starred status between the RSS Reader app and Inoreader, ensuring consistency across all reading platforms.

### Feature Requirements

#### Sync Scope
- **Read/Unread Status**: Sync both directions for all articles
- **Starred Status**: Sync both directions for all articles
- **Excluded**: Tags, folders, and other metadata (not supported in current UI)

#### Sync Timing
- **Automatic Sync**: Every 5 minutes while app is open
- **Manual Sync**: Include bi-directional sync in manual sync operations
- **Daily Sync**: Include bi-directional sync in 2am/2pm automated syncs
- **Configurable**: All timing parameters via environment variables

#### Sync Architecture

**Sync Queue Design**:
- Track all local changes with timestamps
- Persist queue across browser sessions
- Batch changes for efficient API usage
- Clear queue after successful sync

**Conflict Resolution**:
- Use timestamp-based resolution (most recent change wins)
- Track change timestamps in milliseconds
- Prevent sync loops by tracking sync source

**Error Handling**:
- Retry with exponential backoff (max 3 attempts)
- Backoff intervals: 10 minutes, 20 minutes, 40 minutes
- After 3 failures, defer to next scheduled sync
- Silent failures (no user notification unless critical)

#### API Strategy

**Individual Article Sync** (`/edit-tag` endpoint):
- Batch size: 100 articles per API call (configurable)
- Supports both read/unread and starred/unstarred
- Multiple article IDs in single request

**Bulk Operations** (`/mark-all-as-read` endpoint):
- Use for "Mark all as read" operations
- Single API call per feed/folder
- Much more efficient than individual marking

**Auto-mark on Scroll** (TODO-029 integration):
- Queue articles marked as read during scrolling
- Sync with same 5-minute interval
- Handle potentially 300+ articles per session

#### Configuration

```env
# Bi-directional Sync Configuration
SYNC_INTERVAL_MINUTES=5              # How often to sync while app is open
SYNC_MIN_CHANGES=5                   # Minimum changes before triggering sync
SYNC_BATCH_SIZE=100                  # Articles per edit-tag API call
SYNC_RETRY_BACKOFF_MINUTES=10        # Initial retry delay
SYNC_MAX_RETRIES=3                   # Maximum retry attempts

# Article Retention Configuration  
ARTICLES_RETENTION_LIMIT=2000        # Total articles to keep (was 500)
ARTICLES_RETENTION_STARRED_EXEMPT=true  # Never delete starred articles
```

#### Database Schema

**New Sync Queue Table**:
```sql
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  inoreader_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'read', 'unread', 'star', 'unstar'
  action_timestamp TIMESTAMPTZ NOT NULL,
  sync_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_created ON sync_queue(created_at);
CREATE INDEX idx_sync_queue_attempts ON sync_queue(sync_attempts);
```

**Article Table Updates**:
```sql
ALTER TABLE articles
ADD COLUMN last_local_update TIMESTAMPTZ,
ADD COLUMN last_sync_update TIMESTAMPTZ;
```

#### Implementation Notes

1. **Sync Loop Prevention**:
   - Only sync changes made after last Inoreader sync
   - Track sync source to avoid re-syncing Inoreader changes
   - Use `last_local_update` vs `last_sync_update` comparison

2. **Performance Optimization**:
   - Batch database operations
   - Use single Supabase transaction per sync
   - Implement request coalescing for rapid changes

3. **API Usage Efficiency**:
   - 5-minute sync: ~12 calls/hour while active
   - Daily syncs: 2 calls
   - Manual syncs: Variable
   - Estimated total: 30-40 calls/day for bi-directional sync

4. **User Experience**:
   - Completely invisible to user
   - No sync status indicators
   - Changes appear seamless

### Success Metrics

- Zero sync conflicts reported
- <1% sync failure rate
- API usage stays under 100 calls/day
- Read status consistency across devices
