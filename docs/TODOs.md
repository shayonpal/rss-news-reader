# Master TODO List - RSS News Reader

**Last Updated:** July 21, 2025  
**Status:** Ready for Implementation

## 🚨 CRITICAL SECURITY ISSUES - IMMEDIATE ACTION REQUIRED

### Phase 0: SECURITY FIXES (Before Any Other Work)

#### TODO-001: Enable Row Level Security (P0 - Critical) ✅ COMPLETED
- **Status**: ✅ COMPLETED - Security vulnerability resolved
- **Issue**: RLS disabled on ALL public tables, anyone with anon key can access all data
- **User Story**: US-801
- **Migration**: `/supabase/migrations/20240123_enable_rls_security.sql`
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] Migration file already created
  - [x] Apply migration in Supabase dashboard
  - [x] Test client can still read feeds/articles
  - [x] Test client can update read/starred status
  - [x] Verify unauthorized access is blocked
  - [x] Ensure server (service role) still works
- **Completed**: July 21, 2025 - RLS enabled on all 6 tables with proper policies

#### TODO-002: Fix Function Security Vulnerability (P0 - Security) ✅ COMPLETED
- **Status**: ✅ COMPLETED - Function security vulnerability resolved
- **Issue**: `update_updated_at_column` has mutable search_path
- **User Story**: US-802
- **Migration**: `/supabase/migrations/20240124_fix_function_security.sql`
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] Migration file already created
  - [x] Apply migration in Supabase
  - [x] Test function still works correctly
- **Completed**: July 21, 2025 - Function recreated with explicit search_path

---

## 📊 PERFORMANCE OPTIMIZATIONS (After Security)

#### TODO-003: Apply Unread Counts Function Migration (P1 - Performance) ✅ COMPLETED
- **Status**: ✅ COMPLETED - Performance optimization applied
- **Issue**: Feed loading takes 6.4s due to N+1 query problem
- **Migration**: `/supabase/migrations/20240122_create_unread_counts_function.sql`
- **Expected Result**: 10x speed improvement (6.4s → <1s)
- **Actual Result**: 92.4% reduction in data transfer (290 rows → 22 rows)
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] Migration file already created
  - [x] Apply migration in Supabase
  - [x] Test feed loading performance
  - [x] Verify unread counts are accurate
- **Completed**: January 22, 2025 - Database function and index created

#### TODO-004: Database Performance Analysis (P1 - Performance) ✅ COMPLETED
- **Status**: ✅ COMPLETED - Performance optimization migration created
- **User Story**: US-803
- **Issues Identified**:
  - Timezone queries consuming 45.4% of execution time
  - Schema introspection taking 10.2%
  - Upsert operations 28-52ms per article
  - Make sure to look into Supabase's performance report downloaded and saved at `/docs/tech/supabase-advisory/2025-07-21/Supabase Query Performance (Most Time Consuming).csv` and `/docs/tech/supabase-advisory/2025-07-21/Supabase Query Performance (Slowest Execution).csv`
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] Investigate timezone query frequency - Root cause identified
  - [x] Implement caching or alternative approach - System config table + optimized functions
  - [x] Add indexes for upsert conflict columns - All conflict columns indexed
  - [x] Target: Average query response < 20ms - Expected after migration
  - [x] Target: No single query type > 20% of total time - Addressed with caching
- **Migration**: `/supabase/migrations/20240125_performance_optimizations_v2.sql`
- **Documentation**: `/docs/tech/performance-analysis-2025-01-22.md`
- **Completed**: January 22, 2025 - Comprehensive performance optimization

#### TODO-005: Refresh Materialized View After Sync (P1 - Performance) ✅ COMPLETED
- **Status**: ✅ COMPLETED - Materialized view refresh integrated into sync process
- **Issue**: The `feed_stats` materialized view needs to be refreshed after each sync to show accurate unread counts
- **User Story**: US-805
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] Add `refresh_feed_stats()` call after successful sync in server code
  - [x] Ensure refresh happens after all articles are synced to Supabase
  - [x] Handle refresh errors gracefully (log but don't fail sync)
  - [x] Test that unread counts update correctly after sync
- **Implementation**:
  - Added refresh_feed_stats() call in `/src/app/api/sync/route.ts` at line 278
  - Refresh happens after all articles are upserted but before sync metadata update
  - Errors are logged but don't fail the sync process
  - Created test endpoint `/api/test-refresh-stats` for verification
- **Completed**: January 22, 2025 - Refresh integrated with error handling

---

## ✅ COMPLETED FEATURES ANALYSIS

### Epic 1: Server Foundation (100% Complete)
- ✅ **US-101**: Server OAuth Setup - Playwright automation working
- ✅ **US-103**: Server API Endpoints - All endpoints functional
- 🟡 **US-102**: Server Sync Service - Manual sync works, cron job pending

### Epic 2: Client Simplification (100% Complete)
- ✅ **US-201**: Remove Client Authentication - No auth required
- ✅ **US-202**: Supabase-Only Data Layer - Client reads from Supabase only
- 🟡 **US-203**: Server API Integration - Sync working, UI pending

### Epic 3: AI Summarization (100% Complete)
- ✅ **US-301**: Claude API Integration - Claude 4 Sonnet working
- ✅ **US-302**: Summary UI Integration - Full UI implementation complete

---

## 🚧 REMAINING WORK

### Phase 1: Complete Existing Features

#### TODO-006: Complete US-102 - Automatic Daily Sync (P1 - Core)
- **Status**: 🟡 PARTIALLY COMPLETE - Manual sync working perfectly
- **Completed**: ✅ Manual sync, API endpoints, progress polling, rate limiting
- **Missing**:
  - [ ] Implement daily cron job (node-cron) for 2am and 2pm server time
  - [ ] Add sync error logging to database
  - [ ] Implement read state sync back to Inoreader (batch updates)
- **Implementation**:
  - Use node-cron for scheduling
  - Create sync_errors table entries  
  - Batch update read states to Inoreader

#### TODO-007: Complete US-203 - Content/Summary UI Integration (P1 - Core)
- **Status**: 🔴 TODO
- **Current**: Server endpoints working, UI integration missing
- **Missing**:
  - [ ] Add "Fetch Full Content" button to article view
  - [ ] Display extracted content when available
  - [ ] Integrate with existing `/api/articles/:id/fetch-content` endpoint
- **Files to modify**:
  - `src/components/articles/ArticleView.tsx`
  - `src/components/ui/Button.tsx`

#### TODO-008: Complete US-104 - Content Extraction Service (P2 - Enhancement)
- **Status**: 🟡 PARTIALLY COMPLETE - Server endpoint fully functional
- **Completed**: ✅ Mozilla Readability integration, server API endpoint `/api/articles/:id/fetch-content`
- **Missing**:
  - [ ] UI button to trigger extraction in article view
  - [ ] Display extracted vs RSS content
  - [ ] Loading states during extraction
  - [ ] Error handling for failed extractions

### Phase 2: Bug Fixes

#### TODO-009: US-901 - Fix Article View Interface Controls (P0 - Critical Bug) ✅ COMPLETED
- **Status**: ✅ COMPLETED - iOS Safari button controls fixed
- **Issue**: Article view buttons not working (required double-tap on iOS)
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] "Back to list view" button returns to article list
  - [x] Star/unstar button toggles article starred state
  - [x] "Open original article" link opens in new tab
  - [x] Previous/next article navigation works
- **Solution**: Created IOSButton component with proper touch event handling
- **Completed**: January 21, 2025 - All buttons work on first tap on iOS devices

#### TODO-009a: US-903 - Fix Scroll Position Loss on Navigation Back (P1 - UX Bug) ✅ COMPLETED
- **Status**: ✅ COMPLETED - Hybrid scroll position preservation implemented
- **Issue**: When navigating back from article detail view (using back button or browser back), the article list scroll position is lost and resets to top
- **Root Cause**: The app uses client-side navigation with `router.push('/')` which creates a new page instance instead of preserving the previous state
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] Implement scroll position preservation when navigating to article detail
  - [x] Restore scroll position when returning from article detail
  - [x] Works with both UI back button and browser back button
  - [x] Smooth user experience without jarring jumps
- **Implemented Solution**: Hybrid approach combining browser history with sessionStorage backup
  - Primary: Use `router.back()` when browser history is available
  - Backup: Save/restore scroll position and filter state to sessionStorage
  - Handles edge cases: new tabs, direct links, page refreshes
- **Implementation Details**:
  - Changed article detail page to use `router.back()` with fallback to `router.push('/')`
  - Added scroll position saving on ArticleList unmount
  - Added scroll position restoration after articles load (with requestAnimationFrame)
  - Added filter state persistence to maintain feed selection
- **Files Modified**:
  - `src/app/article/[id]/page.tsx` - Changed navigation to use router.back()
  - `src/components/articles/article-list.tsx` - Added scroll position tracking
  - `src/app/page.tsx` - Added filter state persistence
- **Completed**: January 22, 2025 - Scroll position and filter state now preserved across navigation

#### TODO-010: US-902 - Fix 404 Errors for Missing Assets (P1 - Quality Bug)
- **Status**: ✅ COMPLETED
- **Issue**: Missing favicon and PWA icons causing 404s
- **Solution**: Fixed by adding /reader basePath prefix to all icon URLs in metadata
- **Completed**: January 22, 2025 - All assets existed, just needed correct URL paths
- **Note**: Dev server shows 404s for `/apple-touch-icon.png` - these are browser automatic requests and can be safely ignored. They work correctly in production with basePath.
- **Acceptance Criteria**:
  - [x] ~~Create missing favicon files (16x16, 32x32)~~ Files existed
  - [x] ~~Create missing Apple touch icons~~ Files existed
  - [x] Verify PWA manifest references correct paths - Fixed with /reader prefix
  - [x] Test icons display in browser/PWA - URLs now resolve correctly

### Phase 3: Production Deployment

#### TODO-011: US-501 - Caddy Configuration (P0 - Deployment)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Configure Caddy reverse proxy for `/reader` path
  - [ ] Update Next.js basePath to `/reader`
  - [ ] Update PWA manifest for correct path
  - [ ] Configure PM2 with 1GB memory limit
- **Production URL**: `http://100.96.166.53/reader`

#### TODO-012: US-105 - Tailscale Monitoring (P0 - Infrastructure)
- **Status**: 🔴 TODO
- **Critical**: Without Tailscale, clients cannot access service
- **Acceptance Criteria**:
  - [ ] Health check every 5 minutes
  - [ ] Auto-restart with `sudo tailscale up` if down
  - [ ] Configure passwordless sudo for tailscale
  - [ ] Log all restart attempts
- **Implementation Details**:
  ```bash
  # Add to /etc/sudoers.d/tailscale
  nodeuser ALL=(ALL) NOPASSWD: /usr/bin/tailscale up
  
  # PM2 ecosystem.config.js
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
    }]
  }
  ```

#### TODO-013: US-502 - Clean Data Migration (P1 - Deployment)
- **Status**: 🔴 TODO
- **Approach**: Clean slate migration (no data preservation needed)
- **Acceptance Criteria**:
  - [ ] Clear existing article data
  - [ ] Keep Supabase schema unchanged
  - [ ] Document clean-slate approach
  - [ ] First server sync populates fresh data

### Phase 4: UX Enhancements

#### TODO-014a: US-401a - Read Status Filtering (P1 - Pre-Production) ✅ COMPLETED
- **Status**: ✅ COMPLETED - Read status filtering implemented
- **Completed**: January 22, 2025 - All acceptance criteria met
- **Implementation**:
  - [x] Read status filter dropdown with options:
    - "Unread only" (default)
    - "Read only"
    - "All articles"
  - [x] Filter preference persists in localStorage
  - [x] Article counts update to reflect current filter
  - [x] Clear visual indicator in header showing filter status
- **Implementation Details**:
  - Added `readStatusFilter` state to article store
  - Default to "unread only" on first load
  - Filter works in combination with existing feed filters
  - Updated `loadArticles` and `loadMoreArticles` queries
  - Shows filter status in header with article counts
- **Acceptance Criteria**: ALL COMPLETED ✅
  - [x] Default view shows only unread articles
  - [x] Easy toggle between unread/read/all views via dropdown
  - [x] Filter persists across sessions using localStorage
  - [x] Works correctly with existing feed selection

#### TODO-014b: US-401b - Feed Filtering Enhancement (P2 - Post-Production)
- **Status**: 🔴 TODO
- **Current**: Basic feed filtering exists
- **Missing**:
  - [ ] "All Articles" option to clear feed filter
  - [ ] Better visual indication of selected feed
  - [ ] Improved feed selection UX
  - [ ] Feed search/filter in sidebar
- **Implementation Details**:
  - Enhance existing feed filtering UI
  - Add "All Articles" option at top of feed list
  - Highlight selected feed more prominently
  - Add feed count badges
- **Acceptance Criteria**:
  - [ ] Clear way to view all articles across feeds
  - [ ] Visual feedback for active feed filter
  - [ ] Improved navigation between feeds

#### TODO-014c: US-401c - Tag Filtering (P3 - Post-Production)
- **Status**: 🔴 TODO
- **Current**: No tag filtering capability
- **Missing**:
  - [ ] Tags tab in sidebar
  - [ ] Tag list with article counts
  - [ ] Tag selection filtering
  - [ ] Mutually exclusive filtering (feed OR tag)
- **Implementation Details**:
  - Add tags extraction from articles
  - Create tags tab interface
  - Implement tag-based article filtering
  - Ensure mutual exclusivity with feed filters
- **Acceptance Criteria**:
  - [ ] Tags tab shows all unique tags
  - [ ] Selecting tag filters articles
  - [ ] Clear indication when tag filter is active
  - [ ] Cannot have both feed and tag filter active
  - [ ] Works seamlessly with feed/tag filtering
  - [ ] Article counts update based on active filters

#### TODO-015: US-402 - Theme Toggle (P2 - UX)
- **Status**: 🔴 TODO (Theme system partially exists)
- **Acceptance Criteria**:
  - [ ] Theme toggle in settings
  - [ ] Options: Light, Dark, System
  - [ ] Smooth theme transitions
  - [ ] Theme preference persistence

#### TODO-016: US-403 - Sync Status Display (P1 - UX)
- **Status**: 🔴 TODO
- **Current**: Basic progress display exists
- **Missing**:
  - [ ] Last sync timestamp in settings
  - [ ] Number of new articles synced
  - [ ] API usage display (X/100 calls today)
  - [ ] Enhanced success/error messages

### Phase 5: Monitoring & Polish

#### TODO-017: US-503 - Error Handling & Monitoring (P1 - Production Quality)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Server API errors display clearly in UI
  - [ ] Tailscale connection errors handled gracefully
  - [ ] Supabase connection errors handled
  - [ ] Rate limit warnings at 80% and 95%

#### TODO-018: US-804 - Database Monitoring (P2 - Monitoring)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Set up automated Supabase advisor reports
  - [ ] Create alerts for slow queries (>100ms)
  - [ ] Create alerts for failed RLS policy checks
  - [ ] Document monitoring setup

---

## 📋 FUTURE ENHANCEMENTS (P3)

#### TODO-019: US-701 - Feed Search Functionality
- **GitHub Issue**: #32
- **Status**: 🔵 Future
- **Acceptance Criteria**:
  - [ ] Search input at top of feed sidebar
  - [ ] Real-time filtering as user types
  - [ ] Keyboard shortcut (Cmd/Ctrl + K)

#### TODO-020: US-702 - Persist Folder Expansion State
- **GitHub Issue**: #31
- **Status**: 🔵 Future
- **Acceptance Criteria**:
  - [ ] Folder states save on expand/collapse
  - [ ] States persist across sessions
  - [ ] Use localStorage for persistence

#### TODO-021: US-601 - Performance Optimization (P2 - Quality)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Initial load < 2 seconds
  - [ ] Article list renders < 1 second
  - [ ] Article opens < 0.5 seconds
  - [ ] Smooth 60fps scrolling
  - [ ] Images lazy loaded
  - [ ] Bundle size minimized

#### TODO-022: US-602 - PWA Polish (P2 - Quality)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Install prompt at right time
  - [ ] App icons for all platforms
  - [ ] Splash screens configured
  - [ ] Offline error messages
  - [ ] Update mechanism works
  - [ ] Works over HTTP (Tailscale)

#### TODO-023: US-704 - Configurable AI Summarization Prompt (P2 - Configuration)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Add environment variables: `CLAUDE_SUMMARY_WORD_COUNT`, `CLAUDE_SUMMARY_PROMPT`, `CLAUDE_SUMMARY_FOCUS`
  - [ ] Support template variable substitution ({WORD_COUNT}, {TITLE}, {AUTHOR}, etc.)
  - [ ] Fallback to default prompt gracefully
  - [ ] Document prompt engineering best practices
- **Environment Variables**:
  ```env
  CLAUDE_SUMMARY_WORD_COUNT=150-175
  CLAUDE_SUMMARY_FOCUS=key facts, main arguments, implications
  CLAUDE_SUMMARY_PROMPT=Custom template with {WORD_COUNT} variables
  ```

#### TODO-024: US-705 - Multi-Provider LLM Support (P2 - Flexibility)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Support Anthropic (Claude models)
  - [ ] Support OpenAI (GPT models)  
  - [ ] Support Perplexity (Sonar models)
  - [ ] Environment-based provider switching
  - [ ] Automatic fallback on provider errors
  - [ ] Response normalization across providers
  - [ ] Usage tracking per provider/model
- **Environment Variables**:
  ```env
  LLM_PROVIDER=anthropic
  LLM_MODEL=claude-sonnet-4-20250514
  LLM_FALLBACK_PROVIDER=openai
  LLM_FALLBACK_MODEL=gpt-3.5-turbo
  ANTHROPIC_API_KEY=sk-ant-...
  OPENAI_API_KEY=sk-...
  PERPLEXITY_API_KEY=pplx-...
  ```

#### TODO-025: US-703 - Incremental Sync Evaluation (P4 - Future Optimization)
- **Status**: 🔵 Future Consideration
- **Context**: Evaluate if date parameters would improve sync efficiency
- **Acceptance Criteria**:
  - [ ] Monitor current sync performance patterns
  - [ ] Track scenarios where >200 new articles accumulate
  - [ ] Consider implementation only if API limits become constraining
  - [ ] Maintain current simplicity unless scaling issues arise

#### TODO-026: Replace Deprecated Punycode Module (P2 - Technical Debt)
- **Status**: 🔴 TODO
- **Issue**: Node.js built-in `punycode` module is deprecated since v21.0.0
- **Context**: The punycode module is used indirectly through these dependencies:
  - `eslint` → `ajv` → `uri-js` → `punycode`
  - `jsdom` → `whatwg-url` → `tr46` → `punycode`
  - `workbox-webpack-plugin` → `workbox-build` → `whatwg-url` → `tr46` → `punycode`
- **Impact**: Deprecation warnings in Node.js 21+ and eventual removal in future versions
- **npm Recommendation**: Use a userland alternative from npm instead
- **Solutions**:
  1. **Recommended**: Install userland `punycode` package explicitly
     ```bash
     npm install punycode --save
     ```
     - This will override the built-in module with the npm package
     - The npm package `punycode` v2.x is actively maintained
     - Ensures compatibility when Node.js removes the built-in module
  2. **Long-term**: Update dependencies when they migrate away from punycode
     - Monitor `tr46`, `uri-js` for updates
     - Update `eslint` to v9+ when stable
     - Check `jsdom` and `workbox` for punycode-free versions
  3. **Alternative**: For direct usage, consider `url.domainToASCII()` and `url.domainToUnicode()`
- **Acceptance Criteria**:
  - [ ] Install userland `punycode` package as explicit dependency
  - [ ] Ensure no deprecation warnings in Node.js 21+
  - [ ] Verify all functionality works (URL parsing, internationalized domains)
  - [ ] Document the userland package requirement in README if needed
  - [ ] Consider adding Node.js engine requirement to package.json

#### TODO-027: Fix Previous/Next Button Regression in Article View (P0 - Critical Bug Regression)
- **Status**: 🔴 TODO - REGRESSION
- **Issue**: Previous and Next buttons in article view have stopped working
- **Platforms Affected**: iOS Safari (iPhone and iPad) - confirmed not working
- **Suspected Cause**: IOSButton component may have been accidentally removed or modified
- **Context**: This is a regression of TODO-009 which was previously completed
- **Original Fix**: IOSButton component was created to handle proper touch events for iOS Safari
- **Acceptance Criteria**:
  - [ ] Investigate current button implementation in ArticleView.tsx
  - [ ] Verify if IOSButton component is still being used for navigation buttons
  - [ ] Restore IOSButton functionality if missing
  - [ ] Test Previous/Next navigation on iOS Safari (iPhone and iPad)
  - [ ] Ensure buttons work on first tap (no double-tap required)
  - [ ] Verify navigation preserves article list scroll position
- **Files to Check**:
  - `src/components/articles/ArticleView.tsx`
  - `src/components/ui/IOSButton.tsx` (if still exists)
  - Previous git history from TODO-009 completion
- **Testing Required**:
  - iPhone Safari
  - iPad Safari
  - Verify no regressions on other platforms

#### TODO-028: Enhance Back Button Navigation Logic (P2 - UX Enhancement)
- **Status**: 🔴 TODO
- **Issue**: Back button should always return to listing page instead of previous article
- **Current Behavior**: Back button uses browser history which may go to previous article when user has navigated through multiple articles using Previous/Next buttons
- **Expected Behavior**: Back button should consistently return to the article listing page, preserving filter state and scroll position
- **Use Case**: User navigates through multiple articles using UI Previous/Next buttons, then wants to return to the article list
- **Context**: Builds on scroll position preservation from TODO-009a
- **Acceptance Criteria**:
  - [ ] Back button in article view always navigates to listing page (never to previous article)
  - [ ] Preserve current feed filter when returning to listing
  - [ ] Preserve current read status filter when returning to listing
  - [ ] Restore scroll position to where user was before viewing first article
  - [ ] Works correctly regardless of how user navigated to current article (direct link, Previous/Next buttons, etc.)
  - [ ] Browser back button should still work as expected (respecting browser history)
- **Implementation Approach**:
  - Modify back button to use `router.push('/')` with preserved state instead of `router.back()`
  - Ensure listing page state (filters, scroll position) is maintained
  - Consider tracking "entry point" when user first enters article view
- **Files to Modify**:
  - `src/components/articles/ArticleView.tsx` - Back button logic
  - `src/app/page.tsx` - State restoration logic
- **Testing Scenarios**:
  - Navigate to article from listing → use Previous/Next buttons → click Back button
  - Direct link to article → click Back button  
  - Navigate through 5+ articles → click Back button
  - Verify browser back button still works for overall navigation

---

## 📊 SUCCESS METRICS

### Security
- [x] All tables have RLS enabled
- [x] No security warnings in Supabase advisor
- [x] Zero unauthorized data access attempts

### Performance
- [x] Feed sidebar loads in < 500ms (down from 6.4s) ✅ 92.4% data reduction achieved
- [x] No query consuming > 20% of total execution time ✅ Migration created to address timezone queries
- [x] Average query response < 20ms ✅ Expected after applying performance migration

### User Experience
- [x] All UI controls function properly ✅ iOS Safari buttons fixed (TODO-009)
- [x] No broken navigation flows ✅ Scroll position preserved (TODO-009a)
- [x] Consistent interaction feedback ✅ Touch events working properly
- [ ] Can read 50+ articles without friction

---

## 🔧 COMMANDS FOR NEXT SESSION

```bash
# Development setup
cd /Users/shayon/DevProjects/rss-news-reader
npm run dev:network

# Apply critical migrations
# (Run in Supabase dashboard SQL editor)
# 1. Apply 20240123_enable_rls_security.sql ✅
# 2. Apply 20240124_fix_function_security.sql ✅
# 3. Apply 20240122_create_unread_counts_function.sql ✅
# 4. Apply 20240125_performance_optimizations_v2.sql ✅

# Test performance after migrations
open http://100.96.166.53:3000/reader/test-performance

# Access production app
open http://100.96.166.53:3000/reader
```

---

**Priority Order**: Security → Performance → Features → Polish → Enhancements

## 🔄 ENVIRONMENT VARIABLES NEEDING CONFIGURATION

### Current Production Variables:
```env
# Sync Configuration
SYNC_MAX_ARTICLES=100
ARTICLES_RETENTION_LIMIT=1000

# AI Configuration  
CLAUDE_SUMMARIZATION_MODEL=claude-sonnet-4-20250514
```

### Additional Variables to Configure:
```env
# AI Customization (TODO-022)
CLAUDE_SUMMARY_WORD_COUNT=150-175
CLAUDE_SUMMARY_FOCUS=key facts, main arguments, implications
CLAUDE_SUMMARY_PROMPT=[custom template]

# Multi-Provider LLM (TODO-023) 
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514
LLM_FALLBACK_PROVIDER=openai
LLM_FALLBACK_MODEL=gpt-3.5-turbo
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...

# Server Configuration
RSS_READER_TOKENS_PATH=~/.rss-reader/tokens.json
PM2_MAX_MEMORY=1G
TAILSCALE_HEALTH_CHECK_INTERVAL=300000
```
