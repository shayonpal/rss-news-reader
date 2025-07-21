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

#### TODO-003: Apply Unread Counts Function Migration (P1 - Performance)
- **Status**: 🟡 Ready
- **Issue**: Feed loading takes 6.4s due to N+1 query problem
- **Migration**: `/supabase/migrations/20240122_create_unread_counts_function.sql`
- **Expected Result**: 10x speed improvement (6.4s → <1s)
- **Acceptance Criteria**:
  - [x] Migration file already created
  - [ ] Apply migration in Supabase
  - [ ] Test feed loading performance
  - [ ] Verify unread counts are accurate

#### TODO-004: Database Performance Analysis (P1 - Performance)
- **Status**: 🔴 TODO
- **User Story**: US-803
- **Issues Identified**:
  - Timezone queries consuming 45.4% of execution time
  - Schema introspection taking 10.2%
  - Upsert operations 28-52ms per article
- **Acceptance Criteria**:
  - [ ] Investigate timezone query frequency
  - [ ] Implement caching or alternative approach
  - [ ] Add indexes for upsert conflict columns
  - [ ] Target: Average query response < 20ms
  - [ ] Target: No single query type > 20% of total time

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

#### TODO-005: Complete US-102 - Automatic Daily Sync (P1 - Core)
- **Status**: 🟡 PARTIALLY COMPLETE - Manual sync working perfectly
- **Completed**: ✅ Manual sync, API endpoints, progress polling, rate limiting
- **Missing**:
  - [ ] Implement daily cron job (node-cron)
  - [ ] Add sync error logging to database
  - [ ] Implement read state sync back to Inoreader (batch updates)
- **Implementation**:
  - Use node-cron for scheduling
  - Create sync_errors table entries  
  - Batch update read states to Inoreader

#### TODO-006: Complete US-203 - Content/Summary UI Integration (P1 - Core)
- **Status**: 🔴 TODO
- **Current**: Server endpoints working, UI integration missing
- **Missing**:
  - [ ] Add "Fetch Full Content" button to article view
  - [ ] Display extracted content when available
  - [ ] Integrate with existing `/api/articles/:id/fetch-content` endpoint
- **Files to modify**:
  - `src/components/articles/ArticleView.tsx`
  - `src/components/ui/Button.tsx`

#### TODO-007: Complete US-104 - Content Extraction Service (P2 - Enhancement)
- **Status**: 🟡 PARTIALLY COMPLETE - Server endpoint fully functional
- **Completed**: ✅ Mozilla Readability integration, server API endpoint `/api/articles/:id/fetch-content`
- **Missing**:
  - [ ] UI button to trigger extraction in article view
  - [ ] Display extracted vs RSS content
  - [ ] Loading states during extraction
  - [ ] Error handling for failed extractions

### Phase 2: Production Deployment

#### TODO-008: US-501 - Caddy Configuration (P0 - Deployment)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Configure Caddy reverse proxy for `/reader` path
  - [ ] Update Next.js basePath to `/reader`
  - [ ] Update PWA manifest for correct path
  - [ ] Configure PM2 with 1GB memory limit
- **Production URL**: `http://100.96.166.53/reader`

#### TODO-009: US-105 - Tailscale Monitoring (P0 - Infrastructure)
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

#### TODO-010: US-502 - Clean Data Migration (P1 - Deployment)
- **Status**: 🔴 TODO
- **Approach**: Clean slate migration (no data preservation needed)
- **Acceptance Criteria**:
  - [ ] Clear existing article data
  - [ ] Keep Supabase schema unchanged
  - [ ] Document clean-slate approach
  - [ ] First server sync populates fresh data

### Phase 3: UX Enhancements

#### TODO-011: US-401 - Feed and Tag Filtering (P1 - UX)
- **Status**: 🔴 TODO
- **Current**: Basic feed filtering exists
- **Missing**:
  - [ ] Two-tab interface: "Feeds" and "Tags"
  - [ ] Tags tab with flat list
  - [ ] Mutually exclusive filtering (feed OR tag)
  - [ ] "All Articles" option to clear filters

#### TODO-012: US-402 - Theme Toggle (P2 - UX)
- **Status**: 🔴 TODO (Theme system partially exists)
- **Acceptance Criteria**:
  - [ ] Theme toggle in settings
  - [ ] Options: Light, Dark, System
  - [ ] Smooth theme transitions
  - [ ] Theme preference persistence

#### TODO-013: US-403 - Sync Status Display (P1 - UX)
- **Status**: 🔴 TODO
- **Current**: Basic progress display exists
- **Missing**:
  - [ ] Last sync timestamp in settings
  - [ ] Number of new articles synced
  - [ ] API usage display (X/100 calls today)
  - [ ] Enhanced success/error messages

### Phase 4: Bug Fixes

#### TODO-014: US-901 - Fix Article View Interface Controls (P0 - Critical Bug)
- **Status**: 🔴 TODO
- **Issue**: Article view buttons not working
- **Acceptance Criteria**:
  - [ ] "Back to list view" button returns to article list
  - [ ] Star/unstar button toggles article starred state
  - [ ] "Open original article" link opens in new tab
  - [ ] Previous/next article navigation works
- **Files**: `src/components/articles/ArticleView.tsx`

#### TODO-015: US-902 - Fix 404 Errors for Missing Assets (P1 - Quality Bug)
- **Status**: 🔴 TODO
- **Issue**: Missing favicon and PWA icons causing 404s
- **Acceptance Criteria**:
  - [ ] Create missing favicon files (16x16, 32x32)
  - [ ] Create missing Apple touch icons
  - [ ] Verify PWA manifest references correct paths
  - [ ] Test icons display in browser/PWA

### Phase 5: Monitoring & Polish

#### TODO-016: US-503 - Error Handling & Monitoring (P1 - Production Quality)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Server API errors display clearly in UI
  - [ ] Tailscale connection errors handled gracefully
  - [ ] Supabase connection errors handled
  - [ ] Rate limit warnings at 80% and 95%

#### TODO-017: US-804 - Database Monitoring (P2 - Monitoring)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Set up automated Supabase advisor reports
  - [ ] Create alerts for slow queries (>100ms)
  - [ ] Create alerts for failed RLS policy checks
  - [ ] Document monitoring setup

---

## 📋 FUTURE ENHANCEMENTS (P3)

#### TODO-018: US-701 - Feed Search Functionality
- **GitHub Issue**: #32
- **Status**: 🔵 Future
- **Acceptance Criteria**:
  - [ ] Search input at top of feed sidebar
  - [ ] Real-time filtering as user types
  - [ ] Keyboard shortcut (Cmd/Ctrl + K)

#### TODO-019: US-702 - Persist Folder Expansion State
- **GitHub Issue**: #31
- **Status**: 🔵 Future
- **Acceptance Criteria**:
  - [ ] Folder states save on expand/collapse
  - [ ] States persist across sessions
  - [ ] Use localStorage for persistence

#### TODO-020: US-601 - Performance Optimization (P2 - Quality)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Initial load < 2 seconds
  - [ ] Article list renders < 1 second
  - [ ] Article opens < 0.5 seconds
  - [ ] Smooth 60fps scrolling
  - [ ] Images lazy loaded
  - [ ] Bundle size minimized

#### TODO-021: US-602 - PWA Polish (P2 - Quality)
- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Install prompt at right time
  - [ ] App icons for all platforms
  - [ ] Splash screens configured
  - [ ] Offline error messages
  - [ ] Update mechanism works
  - [ ] Works over HTTP (Tailscale)

#### TODO-022: US-704 - Configurable AI Summarization Prompt (P2 - Configuration)
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

#### TODO-023: US-705 - Multi-Provider LLM Support (P2 - Flexibility)
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

#### TODO-024: US-703 - Incremental Sync Evaluation (P4 - Future Optimization)
- **Status**: 🔵 Future Consideration
- **Context**: Evaluate if date parameters would improve sync efficiency
- **Acceptance Criteria**:
  - [ ] Monitor current sync performance patterns
  - [ ] Track scenarios where >200 new articles accumulate
  - [ ] Consider implementation only if API limits become constraining
  - [ ] Maintain current simplicity unless scaling issues arise

---

## 📊 SUCCESS METRICS

### Security
- [x] All tables have RLS enabled
- [x] No security warnings in Supabase advisor
- [x] Zero unauthorized data access attempts

### Performance
- [ ] Feed sidebar loads in < 500ms (down from 6.4s)
- [ ] No query consuming > 20% of total execution time
- [ ] Average query response < 20ms

### User Experience
- [ ] All UI controls function properly
- [ ] No broken navigation flows
- [ ] Consistent interaction feedback
- [ ] Can read 50+ articles without friction

---

## 🔧 COMMANDS FOR NEXT SESSION

```bash
# Development setup
cd /Users/shayon/DevProjects/rss-news-reader
npm run dev:network

# Apply critical security migrations
# (Run in Supabase dashboard SQL editor)
# 1. Apply 20240123_enable_rls_security.sql
# 2. Apply 20240124_fix_function_security.sql
# 3. Apply 20240122_create_unread_counts_function.sql

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