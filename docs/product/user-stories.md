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

### US-302: Summary UI Integration

**As** Shayon  
**I want** to see and manage AI summaries in the UI  
**So that** I can benefit from the summarization feature

**Acceptance Criteria:**
- [ ] "Summarize" button on articles without summaries
- [ ] "Re-summarize" button for existing summaries
- [ ] Loading state during generation (< 5 seconds)
- [ ] Summaries display in article list view
- [ ] Clear distinction between summary and content
- [ ] Error messages for failed generations

**Priority:** P1 - Key Feature  
**Story Points:** 5

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

### Phase 1: Server Foundation (Week 1)
1. US-101: OAuth Setup
2. US-102: Sync Service
3. US-103: API Endpoints
4. US-105: Tailscale Monitoring

### Phase 2: Client Simplification (Week 2)
1. US-201: Remove Authentication
2. US-202: Supabase-Only Data
3. US-203: Server API Integration

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

### Phase 5: Polish (Week 5)
1. US-402: Theme Toggle
2. US-601: Performance
3. US-602: PWA Polish

### Phase 6: Future Enhancements
1. US-701: Feed Search
2. US-702: Folder State Persistence

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
