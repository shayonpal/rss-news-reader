# User Stories - Shayon's News RSS Reader PWA

**Created**: January 21, 2025  
**Architecture**: Server-Client Model (Server handles all Inoreader API, Client reads from Supabase)  
**Status**: Ready for Implementation

## Overview

This document contains user stories for completing the RSS Reader PWA based on the new server-client architecture. All complex operations (OAuth, sync, content extraction, AI summarization) happen server-side. The client is a pure presentation layer that reads from Supabase and calls server API endpoints.

The document includes 21 user stories organized into 7 epics, with the existing 2 open GitHub issues (#31, #32) incorporated as future enhancements.

**Key Architecture Principles:**
- Server handles ALL Inoreader API communication (4-5 calls per sync)
- Client has NO authentication - access controlled by Tailscale network
- Data flows: Inoreader → Server → Supabase → Client
- Clean-slate migration: No data migration, start fresh with server sync

## Primary Persona

### Shayon
- **Role**: Tech-savvy Product Manager with ADHD
- **Context**: Single user of a self-hosted RSS reader
- **Goals**: Efficient news consumption with AI summaries
- **Access**: Via Tailscale network only (http://100.96.166.53/reader)
- **Values**: Privacy, simplicity, time-efficiency

---

## Epic 1: Server Foundation 🚀

**Goal**: Establish server-side infrastructure for all external API communication

### US-101: Server OAuth Setup ✅

**As** Shayon  
**I want** the server to handle all Inoreader authentication  
**So that** I never need to authenticate in the client

**Acceptance Criteria:**
- [x] One-time OAuth setup script using Playwright automation
- [x] Uses test credentials from `.env` file
- [x] Runs on Mac Mini with localhost:8080 callback
- [x] Tokens encrypted and stored in `~/.rss-reader/tokens.json`
- [x] File permissions set to 600 (owner read/write only)
- [x] Automatic token refresh before expiration
- [x] Clear success/error messages during setup

**Implementation Notes:**
```bash
npm run setup:oauth
# Automated flow:
# 1. Starts Express server on localhost:8080
# 2. Launches Playwright browser
# 3. Auto-fills Inoreader credentials from .env
# 4. Captures tokens from callback
# 5. Stores encrypted tokens
# 6. Note: OAuth callback URL must be http://localhost:8080/auth/callback
```

**Priority:** P0 - Blocker  
**Story Points:** 8  
**Status:** ✅ DONE (2025-01-21)

---

### US-102: Server Sync Service (Partially Complete)

**As** Shayon  
**I want** the server to automatically sync articles every 24 hours  
**So that** fresh content is always available without manual intervention

**Acceptance Criteria:**
- [ ] Cron job runs daily sync at midnight (future)
- [x] Efficient API usage: 4-5 calls per sync
- [x] Single stream endpoint fetches ALL articles (max 100)
- [ ] Round-robin distribution (max 20 per feed)
- [x] Sync status tracked in memory (MVP)
- [ ] Errors logged to `sync_errors` table (future)
- [x] Token refresh handled automatically
- [ ] Read state changes synced to Inoreader using batch updates (future)

**API Efficiency:**
```typescript
// 4-5 API calls total:
1. /subscription/list     // Get feeds
2. /tag/list             // Get tags  
3. /stream/contents      // Get ALL articles
4. /unread-count         // Get counts
5. /edit-tag             // Update read states (if needed)
```

**Implementation Notes:**
- Created `/api/sync` endpoint for manual sync
- Created `/api/sync/status/:id` for polling sync progress
- Uses server-side OAuth tokens from `~/.rss-reader/tokens.json`
- Successfully syncs feeds and articles to Supabase
- In-memory sync status tracking (should use Redis in production)
- Manual sync works - automatic cron job deferred to later

**Priority:** P0 - Core Feature  
**Story Points:** 13  
**Status:** 🟡 IN PROGRESS - Manual sync working, automatic cron job pending

---

### US-103: Server API Endpoints ✅

**As** Shayon  
**I want** server API endpoints for client operations  
**So that** the client can trigger server-side actions

**Acceptance Criteria:**
- [x] `POST /api/sync` - Trigger manual sync
- [x] `GET /api/sync/status/:id` - Check sync progress
- [x] `POST /api/articles/:id/fetch-content` - Extract full content
- [x] `POST /api/articles/:id/summarize` - Generate AI summary
- [x] All endpoints return proper error codes (429, 500, etc.)
- [x] Rate limiting enforced (100 calls/day)
- [x] Response format consistent across endpoints

**Implementation Notes:**
- Enhanced `/api/sync` with rate limiting and usage tracking
- Created content extraction using Mozilla Readability
- Integrated Claude 4 Sonnet for AI summaries
- Added `api_usage` and `sync_metadata` tables
- Created test page at `/test-server-api`
- All endpoints cache results to minimize API calls

**Priority:** P0 - Core Feature  
**Story Points:** 8  
**Status:** ✅ DONE (2025-01-21)

---

### US-104: Content Extraction Service

**As** Shayon  
**I want** the server to extract clean article content  
**So that** I can read full articles without ads or clutter

**Acceptance Criteria:**
- [ ] Mozilla Readability integration
- [ ] Extracts clean, readable content
- [ ] Preserves essential media (images, videos, tweets)
- [ ] Falls back to RSS content on failure
- [ ] Stores in `full_content` field in Supabase
- [ ] Updates `has_full_content` flag
- [ ] Returns extracted content to client

**Note:** The server endpoint exists at `/api/articles/:id/fetch-content` but needs client integration.

**Priority:** P1 - Important  
**Story Points:** 5

---

### US-105: Tailscale Monitoring

**As** Shayon  
**I want** the server to monitor and maintain Tailscale connectivity  
**So that** the service remains accessible

**Acceptance Criteria:**
- [ ] Health check every 5 minutes
- [ ] Auto-restart with `sudo tailscale up` if down. This might need to be set up passwordless.
- [ ] Sudo configured in `/etc/sudoers.d/tailscale`:
  ```
  nodeuser ALL=(ALL) NOPASSWD: /usr/bin/tailscale up
  ```
- [ ] All restart attempts logged
- [ ] PM2 process management configured
- [ ] Memory limit set to 1GB
- [ ] Critical: Without Tailscale, clients cannot access the service

**Priority:** P0 - Critical Infrastructure  
**Story Points:** 5

---

## Epic 2: Client Simplification 🎯

**Goal**: Convert client to pure presentation layer using Supabase data

### US-201: Remove Client Authentication ✅

**As** Shayon  
**I want** completely open access via Tailscale  
**So that** I don't need any authentication in the client

**Acceptance Criteria:**
- [x] Remove all OAuth code from client
- [x] Remove authentication guards
- [x] Remove token management
- [x] Remove login/logout UI
- [x] Client assumes single user
- [x] Access controlled by Tailscale network only

**Implementation Notes:**
- Removed AuthGuard from all pages
- Updated sync store to use fixed single-user ID
- Removed logout button from feed sidebar
- App now accessible at http://100.96.166.53:3000/reader without login

**Priority:** P0 - Architectural Change  
**Story Points:** 5  
**Status:** ✅ DONE (2025-01-21)

---

### US-202: Supabase-Only Data Layer ✅

**As** Shayon  
**I want** the client to read exclusively from Supabase  
**So that** all data operations are simplified

**Acceptance Criteria:**
- [x] Remove all Inoreader API calls
- [x] Convert stores to Supabase queries only
- [x] Load feeds, articles, tags from Supabase
- [x] Update read/unread directly in Supabase
- [x] No local data persistence needed
- [x] Handle Supabase connection errors gracefully

**Implementation Notes:**
- Updated feed-store.ts to use Supabase queries instead of IndexedDB
- Updated article-store.ts to use Supabase for all article operations
- Removed inoreaderService dependencies from sync store
- All data now flows: Server → Supabase → Client
- Offline queue still maintained for sync back to Inoreader (future)

**Priority:** P0 - Architectural Change  
**Story Points:** 8  
**Status:** ✅ DONE (2025-01-21)

---

### US-203: Server API Integration (Partially Complete)

**As** Shayon  
**I want** the client to call server endpoints for operations  
**So that** complex logic stays on the server

**Acceptance Criteria:**
- [x] Sync button calls `POST /api/sync` - Working perfectly
- [x] Poll sync status with `GET /api/sync/status/:id` - Tested and functional
- [ ] "Fetch Full Content" calls server API (endpoint ready, UI integration pending)
- [ ] "Generate Summary" calls server API (endpoint ready, UI integration pending)
- [x] Loading states for all server operations - Progress bar shows sync percentage
- [x] Error handling for server API failures - Includes rate limit warnings

**Implementation Notes:**
- Fixed API endpoint paths to include `/reader` prefix from Next.js basePath
- Successfully syncs 168 articles across multiple feeds in ~11 seconds
- Rate limit information displayed in sidebar (with yellow/red warnings)
- Progress polling implemented with real-time updates
- Content extraction and summarization endpoints ready for future UI integration

**Priority:** P0 - Core Feature  
**Story Points:** 5
**Status:** 🟡 PARTIALLY COMPLETE (2025-01-21) - Sync working, content/summary UI pending

---

## Epic 3: AI Summarization 🤖

**Goal**: Implement server-side AI summarization with Claude

### US-301: Claude API Integration ✅

**As** Shayon with ADHD  
**I want** AI-generated summaries for articles  
**So that** I can quickly grasp key points without reading full articles

**Acceptance Criteria:**
- [x] Server-side Anthropic Claude 4 Sonnet integration
- [x] 150-175 word summaries
- [x] Summaries stored in `ai_summary` field
- [x] API key stored securely on server
- [x] Token usage tracked server-side
- [x] Error handling for API failures

**Implementation Notes:**
- Server endpoint at `/api/articles/:id/summarize` is fully functional
- Uses Claude 4 Sonnet model: `claude-sonnet-4-20250514`
- Summaries are being successfully stored in database
- Caching implemented to avoid regenerating existing summaries
- Ready for client UI integration
- **Important**: Currently uses RSS content OR full_content (prefers full_content when available)
- **Future Consideration**: Once US-104 (Content Extraction) is complete, consider requiring full_content for all summaries to ensure accuracy, as RSS content may be truncated

**Prompt Template:**
```
You are a news summarization assistant. Create a concise summary
of the following article in 150-175 words. Focus on the key facts,
main arguments, and important conclusions. Maintain objectivity
and preserve the author's core message.

IMPORTANT: Do NOT include the article title in your summary. Start directly with the content summary.

Article Details:
Title: [TITLE]
Author: [AUTHOR]
Published: [DATE]

Article Content:
[BODY]

Write a clear, informative summary that captures the essence of this article without repeating the title.
```

**Priority:** P1 - Key Feature  
**Story Points:** 8
**Status:** ✅ DONE (2025-07-21)

---

### US-302: Summary UI Integration ✅

**As** Shayon  
**I want** to see and manage AI summaries in the UI  
**So that** I can benefit from the summarization feature

**Acceptance Criteria:**
- [x] "Summarize" button on articles without summaries
- [x] "Re-summarize" button for existing summaries
- [x] Loading state during generation (shimmer animation)
- [x] Summaries display in article list view (full summary, not truncated)
- [x] Clear distinction between summary and content (collapsible gray box in article view)
- [x] Error messages for failed generations
- [x] Paragraph formatting preserved in summaries

**Implementation Notes:**
- Created SummaryButton component with icon and full variants
- Created SummaryDisplay component with collapsible UI
- Article list shows full summary replacing content snippet
- Article detail shows both summary and original content
- Summaries display with proper paragraph breaks
- Loading state shows shimmer animation in article list
- No navigation occurs when summarizing from list view

**Priority:** P1 - Key Feature  
**Story Points:** 5  
**Status:** ✅ DONE (2025-07-21)

---

## Epic 4: Reading Experience Polish 📖

**Goal**: Complete the core reading experience

### US-401: Feed and Tag Filtering

**As** Shayon  
**I want** to filter articles by feed OR tag  
**So that** I can focus on specific content

**Acceptance Criteria:**
- [ ] Two-tab interface: "Feeds" and "Tags"
- [ ] Feeds tab shows hierarchical structure
- [ ] Tags tab shows flat list
- [ ] Only one filter active at a time
- [ ] Unread counts display correctly
- [ ] Clear indication of active filter
- [ ] "All Articles" option clears filters

**Priority:** P1 - Core UX  
**Story Points:** 5

---

### US-402: Theme Toggle

**As** Shayon  
**I want** manual theme control  
**So that** I can choose my preferred reading mode

**Acceptance Criteria:**
- [ ] Theme toggle in settings
- [ ] Options: Light, Dark, System
- [ ] Smooth theme transitions
- [ ] Theme preference persists
- [ ] All components styled correctly
- [ ] Article content respects theme

**Priority:** P2 - Nice to Have  
**Story Points:** 3

---

### US-403: Sync Status Display

**As** Shayon  
**I want** to see sync status and history  
**So that** I know when content was last updated

**Acceptance Criteria:**
- [ ] Last sync timestamp in settings
- [ ] Sync progress indicator
- [ ] Success/error messages
- [ ] Number of new articles synced
- [ ] API usage display (X/100 calls today)
- [ ] Manual sync button prominent

**Priority:** P1 - Important  
**Story Points:** 3

---

## Epic 5: Production Deployment 🚀

**Goal**: Deploy the complete system to production

### US-501: Caddy Configuration

**As** Shayon  
**I want** to access the app at /reader path  
**So that** it fits my server organization

**Acceptance Criteria:**
- [ ] Caddy reverse proxy configured
- [ ] Routes `/reader` to Next.js port 3000
- [ ] Next.js basePath set to `/reader`
- [ ] PWA manifest updated for path
- [ ] Service worker handles path correctly
- [ ] All assets load from correct path
- [ ] PM2 ecosystem.config.js configured with:
  - Max memory: 1GB
  - Auto-restart: true
  - Error/output logs configured

**Priority:** P0 - Deployment Blocker  
**Story Points:** 5

---

### US-502: Clean Data Migration

**As** Shayon  
**I want** to start fresh with server-controlled data  
**So that** there's no legacy data inconsistency

**Acceptance Criteria:**
- [ ] Clear all existing article data
- [ ] Keep Supabase schema unchanged
- [ ] First server sync populates clean data
- [ ] No data migration complexity
- [ ] Document the clean-slate approach
- [ ] Backup option for old data (optional)

**Priority:** P0 - Deployment Requirement  
**Story Points:** 3

---

### US-503: Error Handling & Monitoring

**As** Shayon  
**I want** comprehensive error handling  
**So that** I can troubleshoot issues

**Acceptance Criteria:**
- [ ] Server API errors display clearly
- [ ] Tailscale connection errors handled
- [ ] Supabase connection errors handled
- [ ] Rate limit warnings at 80% and 95%
- [ ] Server logs accessible via SSH
- [ ] API call logging (JSONL format)

**Priority:** P1 - Production Quality  
**Story Points:** 5

---

## Epic 6: Performance & Polish ✨

**Goal**: Optimize performance and user experience

### US-601: Performance Optimization

**As** Shayon  
**I want** fast, responsive performance  
**So that** the app feels native

**Acceptance Criteria:**
- [ ] Initial load < 2 seconds
- [ ] Article list renders < 1 second
- [ ] Article opens < 0.5 seconds
- [ ] Smooth 60fps scrolling
- [ ] Images lazy loaded
- [ ] Bundle size minimized

**Priority:** P2 - Quality  
**Story Points:** 8

---

### US-602: PWA Polish

**As** Shayon  
**I want** a polished PWA experience  
**So that** the app works like a native app

**Acceptance Criteria:**
- [ ] Install prompt at right time
- [ ] App icons for all platforms
- [ ] Splash screens configured
- [ ] Offline error messages
- [ ] Update mechanism works
- [ ] Works over HTTP (Tailscale)

**Priority:** P2 - Quality  
**Story Points:** 5

---

## Epic 7: Future Enhancements 🔮

**Goal**: Additional UX improvements for power users

### US-701: Feed Search Functionality

**As** Shayon with many feed subscriptions  
**I want** to search for feeds quickly  
**So that** I can navigate to specific feeds without scrolling

**Acceptance Criteria:**
- [ ] Search input at top of feed sidebar
- [ ] Real-time filtering as user types
- [ ] Searches in feed and folder names  
- [ ] Case-insensitive partial matching
- [ ] Parent folders auto-expand to show matches
- [ ] Clear button to reset search
- [ ] "No feeds match" empty state
- [ ] Keyboard shortcut (Cmd/Ctrl + K)

**Implementation Notes:**
- Client-side only feature
- Works with existing Supabase feeds data
- Use fuzzy matching for better results
- Debounce search input for performance

**Priority:** P3 - Enhancement  
**Story Points:** 5

---

### US-702: Persist Folder Expansion State

**As** Shayon  
**I want** folder expansion states to persist  
**So that** I don't have to re-expand folders every session

**Acceptance Criteria:**
- [ ] Folder states save on expand/collapse
- [ ] States persist across sessions
- [ ] Handle folder structure changes gracefully
- [ ] New folders default to collapsed
- [ ] "Expand/Collapse all" options
- [ ] Use localStorage for persistence

**Implementation Notes:**
- Store state keyed by folder Inoreader ID
- Clean up state for deleted folders
- No server interaction required

**Priority:** P3 - Enhancement  
**Story Points:** 3

---

### US-703: Incremental Sync with Date Parameters (Future Consideration)

**As** Shayon  
**I want** to evaluate whether incremental sync using date parameters would improve efficiency  
**So that** I can optimize API usage and performance if needed

**Context:**
The current sync implementation fetches the latest N articles (configured via `SYNC_MAX_ARTICLES`, default 200) and uses database-level deduplication via upsert operations with `onConflict: 'inoreader_id'`. This approach:
- Ensures no duplicates (database unique constraint)
- Updates existing articles with latest read/starred status
- Handles overlapping time ranges elegantly
- Maintains data integrity without complex state management

**Potential Benefits of Date Parameters (`ot`/`nt`):**
- Reduced API payload size (fetch only new articles)
- Lower Supabase write operations
- Faster sync completion times
- More frequent sync capability within rate limits

**Current Approach Advantages:**
- Simplicity (no timestamp tracking needed)
- Always updates read/starred status for recent articles
- No risk of missing articles due to time gaps
- Robust error recovery (no partial state)

**Acceptance Criteria:**
- [ ] Monitor current sync performance and API usage patterns
- [ ] Track scenarios where >200 new articles accumulate between syncs
- [ ] Evaluate if users experience delays with current approach
- [ ] Consider implementation only if:
  - API rate limits become constraining
  - Sync performance degrades with data growth
  - Need for more frequent syncs (hourly vs daily)
  - Supabase costs become significant

**Implementation Considerations:**
- Would require tracking last successful sync timestamp
- Need to handle edge cases (long gaps, time zone issues)
- Continuation tokens for fetching >1000 new articles
- More complex error recovery logic

**Recommendation:** Keep current implementation unless scaling issues arise. The simplicity and reliability of the current approach outweighs the optimization benefits for a single-user application.

**Priority:** P4 - Future Optimization  
**Story Points:** 8 (if implemented)

---

### US-704: Configurable AI Summarization Prompt

**As** Shayon  
**I want** to customize the AI summarization prompt via environment variables  
**So that** I can adjust summary style, length, and focus without code changes

**Acceptance Criteria:**
- [ ] Default prompt template remains in code as fallback
- [ ] Environment variables override default settings:
  - [ ] `CLAUDE_SUMMARY_WORD_COUNT` - Target word count (default: "150-175")
  - [ ] `CLAUDE_SUMMARY_PROMPT` - Full custom prompt template
  - [ ] `CLAUDE_SUMMARY_FOCUS` - Focus areas (e.g., "facts, conclusions, implications")
- [ ] Prompt template supports variable substitution:
  - `{WORD_COUNT}` - From env var or default
  - `{TITLE}`, `{AUTHOR}`, `{DATE}` - Article metadata
  - `{CONTENT}` - Article body
  - `{FOCUS}` - Custom focus areas
- [ ] Changes take effect without code deployment
- [ ] Invalid prompts fall back to default gracefully
- [ ] Document prompt engineering best practices

**Implementation Notes:**
- Store in `.env` file on server
- Hot-reload not required (restart acceptable)
- Consider prompt versioning for A/B testing
- Log which prompt version was used per summary

**Example Configuration:**
```env
CLAUDE_SUMMARY_WORD_COUNT=200-250
CLAUDE_SUMMARY_FOCUS=key facts, main arguments, implications, and author's perspective
CLAUDE_SUMMARY_PROMPT=Summarize this article in {WORD_COUNT} words focusing on {FOCUS}. Article: {TITLE} by {AUTHOR}\n\n{CONTENT}
```

**Priority:** P2 - Configuration Enhancement  
**Story Points:** 3

---

### US-705: Multi-Provider LLM Support

**As** Shayon  
**I want** to switch between different LLM providers and models via configuration  
**So that** I can optimize for cost, quality, or availability without code changes

**Acceptance Criteria:**
- [ ] Support for multiple LLM providers:
  - [ ] Anthropic (Claude models)
  - [ ] OpenAI (GPT models)
  - [ ] Perplexity (Sonar models)
- [ ] Environment variables for configuration:
  - [ ] `LLM_PROVIDER` - Primary provider (anthropic|openai|perplexity)
  - [ ] `LLM_MODEL` - Specific model for the selected provider
  - [ ] `LLM_FALLBACK_PROVIDER` - Secondary provider if primary fails
  - [ ] `LLM_FALLBACK_MODEL` - Model for fallback provider
- [ ] Provider-specific API keys:
  - [ ] `ANTHROPIC_API_KEY` - For Claude models
  - [ ] `OPENAI_API_KEY` - For GPT models
  - [ ] `PERPLEXITY_API_KEY` - For Perplexity models
- [ ] Automatic fallback on provider errors (rate limits, outages)
- [ ] Model validation - reject invalid model names
- [ ] Response normalization across providers
- [ ] Usage tracking per provider/model

**Supported Models:**
```env
# Anthropic
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307
- claude-sonnet-4-20250514 (current default)

# OpenAI
- gpt-4-turbo-preview
- gpt-4
- gpt-3.5-turbo

# Perplexity
- sonar-small-chat
- sonar-small-online
- sonar-medium-chat
- sonar-medium-online
```

**Implementation Notes:**
- Create provider abstraction layer
- Standardize prompt format across providers
- Handle provider-specific token limits
- Log provider/model used per summary
- Consider cost tracking per provider

**Example Configuration:**
```env
# Primary provider
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307

# Fallback provider
LLM_FALLBACK_PROVIDER=openai
LLM_FALLBACK_MODEL=gpt-3.5-turbo

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
```

**Priority:** P2 - Flexibility Enhancement  
**Story Points:** 8

---

## Success Metrics

### Core Functionality
- [ ] Server sync completes in < 10 seconds
- [ ] API usage stays under 50 calls/day average
- [ ] Zero authentication required in client
- [ ] All data flows through Supabase

### Performance
- [ ] Page loads under 2 seconds
- [ ] 99% sync success rate
- [ ] Smooth offline/online transitions
- [ ] No data loss during operations

### User Experience
- [ ] Can read 50+ articles without friction
- [ ] 80% of AI summaries are helpful
- [ ] Clear error recovery paths
- [ ] Consistent UI responsiveness

## Implementation Priority

### Phase 0: CRITICAL SECURITY (Immediate)
1. **US-801**: Enable Row Level Security (P0 - Critical)
2. **US-802**: Fix Function Security (P0 - Security)
3. **US-803**: Database Performance Optimization (P1)

### Phase 1: Server Foundation (Week 1)
1. US-101: OAuth Setup ✅
2. US-102: Sync Service (Partial)
3. US-103: API Endpoints ✅
4. US-105: Tailscale Monitoring

### Phase 2: Client Simplification (Week 2)
1. US-201: Remove Authentication ✅
2. US-202: Supabase-Only Data ✅
3. US-203: Server API Integration (Partial)

### Phase 3: Core Features (Week 3)
1. US-104: Content Extraction
2. US-301: Claude Integration
3. US-302: Summary UI
4. US-401: Feed/Tag Filtering

### Phase 4: Production (Week 4)
1. US-501: Caddy Configuration
2. US-502: Clean Migration
3. US-503: Error Handling
4. US-403: Sync Status Display
5. US-804: Database Monitoring

### Phase 5: Polish (Week 5)
1. US-402: Theme Toggle
2. US-601: Performance
3. US-602: PWA Polish

### Phase 6: Future Enhancements
1. US-701: Feed Search
2. US-702: Folder State Persistence
3. US-703: Incremental Sync Evaluation
4. US-704: Configurable AI Prompt
5. US-705: Multi-Provider LLM Support

## Technical Notes

### No Client-Side Complexity
- No OAuth flows
- No API rate limiting
- No token management
- No conflict resolution
- No offline sync logic

### Server Handles Everything
- OAuth tokens
- Inoreader API calls
- Content extraction
- AI summarization
- Rate limiting
- Error recovery

### Clean Architecture
- Server: Node.js + Express + Playwright
- Client: Next.js + Tailwind + Zustand
- Data: Supabase (PostgreSQL)
- Network: Tailscale
- Deployment: PM2 + Caddy

This simplified architecture dramatically reduces complexity while maintaining all core functionality. The single-user, self-hosted approach allows for these optimizations that wouldn't be possible in a multi-user SaaS product.

---

## Epic 8: Security & Performance Fixes 🔒

**Goal**: Address critical security vulnerabilities and performance issues identified by Supabase advisors

### US-801: Enable Row Level Security (Critical Security Fix)

**As** Shayon  
**I want** Row Level Security (RLS) enabled on all public tables  
**So that** my data is protected from unauthorized access even if someone obtains the Supabase anon key

**Context:**
Supabase advisory (2025-07-21) identified that RLS is disabled on all public tables, creating a major security vulnerability where anyone with the anon key could read/modify data.

**Acceptance Criteria:**
- [ ] Enable RLS on all public tables:
  - [ ] `public.users` table
  - [ ] `public.feeds` table
  - [ ] `public.folders` table
  - [ ] `public.articles` table
  - [ ] `public.api_usage` table
  - [ ] `public.sync_metadata` table
- [ ] Create appropriate RLS policies for single-user access:
  - [ ] All operations restricted to the single user (shayon)
  - [ ] Read-only access for anon key (client operations)
  - [ ] Write access through service role only (server operations)
- [ ] Test that client can still read data with RLS enabled
- [ ] Test that unauthorized access is blocked
- [ ] Document the RLS policies in migration file

**Implementation Notes:**
```sql
-- Example RLS policy for single-user setup
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Allow read access for the single user
CREATE POLICY "Single user can read articles" ON public.articles
  FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE inoreader_id = 'shayon'));

-- Similar policies needed for all tables
```

**Priority:** P0 - Critical Security Fix  
**Story Points:** 5  
**Status:** 🔴 TODO

---

### US-802: Fix Function Security Vulnerability

**As** Shayon  
**I want** the database function to have explicit search_path  
**So that** it cannot be exploited for SQL injection attacks

**Acceptance Criteria:**
- [ ] Update `public.update_updated_at_column` function with explicit search_path
- [ ] Set search_path to 'public' only
- [ ] Test that the function still works correctly
- [ ] Create migration to update existing function

**Implementation Notes:**
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

**Priority:** P0 - Security Fix  
**Story Points:** 2

---

### US-803: Optimize Database Performance

**As** Shayon  
**I want** optimized database queries and reduced overhead  
**So that** the app performs faster and uses fewer resources

**Context:**
Performance analysis shows timezone queries consuming 45.4% of execution time, schema introspection taking 10.2%, and slow upsert operations.

**Acceptance Criteria:**
- [ ] **Timezone Optimization**:
  - [ ] Investigate why timezone queries are so frequent
  - [ ] Implement caching or alternative approach
  - [ ] Reduce timezone query overhead by >80%
- [ ] **Schema Introspection**:
  - [ ] Identify source of frequent schema queries
  - [ ] Cache schema information if possible
  - [ ] Reduce introspection query frequency
- [ ] **Upsert Optimization**:
  - [ ] Add indexes for upsert conflict columns if missing
  - [ ] Consider batch upsert operations
  - [ ] Optimize article upserts (currently 28-52ms)
  - [ ] Optimize feed upserts (currently 13.7ms)
- [ ] **Additional Optimizations**:
  - [ ] Review and optimize the unread counts function
  - [ ] Add composite indexes for common query patterns
  - [ ] Consider materialized views for complex aggregations

**Performance Targets:**
- [ ] Average query response time < 20ms
- [ ] No single query type consuming > 20% of total time
- [ ] Feed load time < 500ms (down from 6.4s)

**Priority:** P1 - Performance  
**Story Points:** 8

---

### US-804: Implement Database Monitoring

**As** Shayon  
**I want** ongoing monitoring of database performance and security  
**So that** I can proactively identify and fix issues

**Acceptance Criteria:**
- [ ] Set up automated Supabase advisor reports
- [ ] Create alerts for:
  - [ ] Slow queries (> 100ms)
  - [ ] Failed RLS policy checks
  - [ ] High resource usage
- [ ] Document monitoring setup
- [ ] Create runbook for common issues

**Priority:** P2 - Monitoring  
**Story Points:** 3

---

## Updated Success Metrics

### Security
- [ ] All tables have RLS enabled
- [ ] No security warnings in Supabase advisor
- [ ] All functions have explicit search_path
- [ ] Zero unauthorized data access attempts

### Performance  
- [ ] Feed sidebar loads in < 500ms
- [ ] No query consuming > 20% of total execution time
- [ ] Average query response < 20ms
- [ ] Timezone queries reduced by > 80%
