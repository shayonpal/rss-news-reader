# Master TODO List - RSS News Reader

**Last Updated:** Thursday, July 24, 2025 at 8:29 AM

## 🎉 PRODUCTION DEPLOYMENT COMPLETE

The RSS News Reader is now successfully deployed to production:

- **Production URL**: http://100.96.166.53:3147/reader
- **Automatic Startup**: Configured with macOS LaunchAgent
- **Daily Sync**: Running at 2:00 AM and 2:00 PM Toronto time

## 🚧 IN PROGRESS & TODO ITEMS

### TODO-014c: Tag Filtering (P3 - Post-Production)

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

### TODO-016: Sync Status Display (P1 - UX)

- **Status**: 🔴 TODO
- **Current**: Basic progress display exists
- **Note**: As of July 22, 2025 5pm check, some sync status info is already displayed in the sidebar:
  - ✅ Last sync timestamp shown below feed list (but spec wants it "in settings")
  - ✅ API usage (X/100 calls today) with warnings at 80% and 95%
  - ❌ Number of new articles synced - NOT shown
  - ❌ Enhanced success/error messages - basic errors shown but not enhanced
- **Design Decision Needed**: Original spec mentions "in settings" but current implementation shows info in sidebar status area. Need to decide if a separate settings dialog is actually needed or if the sidebar display is sufficient.
- **Missing per original spec**:
  - [ ] Last sync timestamp in settings (currently in sidebar - may not need settings)
  - [ ] Number of new articles synced
  - [ ] API usage display (X/100 calls today) - ALREADY IMPLEMENTED in sidebar
  - [ ] Enhanced success/error messages

### TODO-019: Feed Search Functionality

- **GitHub Issue**: #32
- **Status**: 🔵 Future
- **Acceptance Criteria**:
  - [ ] Search input at top of feed sidebar
  - [ ] Real-time filtering as user types
  - [ ] Keyboard shortcut (Cmd/Ctrl + K)

### TODO-021: Performance Optimization (P2 - Quality)

- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Initial load < 2 seconds
  - [ ] Article list renders < 1 second
  - [ ] Article opens < 0.5 seconds
  - [ ] Smooth 60fps scrolling
  - [ ] Images lazy loaded
  - [ ] Bundle size minimized

### TODO-022: PWA Polish (P3 - Quality)

- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Install prompt at right time
  - [ ] App icons for all platforms
  - [ ] Splash screens configured
  - [ ] Offline error messages
  - [ ] Update mechanism works
  - [ ] Works over HTTP (Tailscale)

### TODO-024: Multi-Provider LLM Support (P2 - Flexibility)

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

### TODO-025: Incremental Sync Evaluation (P4 - Future Optimization)

- **Status**: 🔵 Future Consideration
- **Context**: Evaluate if date parameters would improve sync efficiency
- **Acceptance Criteria**:
  - [ ] Monitor current sync performance patterns
  - [ ] Track scenarios where >200 new articles accumulate
  - [ ] Consider implementation only if API limits become constraining
  - [ ] Maintain current simplicity unless scaling issues arise

### TODO-031: Document Internal APIs (P2 - Documentation)

- **Status**: 🔴 TODO
- **Issue**: Internal API endpoints need better documentation
- **Current State**: Basic documentation exists in `docs/api/server-endpoints.md` but needs enhancement
- **Expected Result**: Complete API reference in `docs/api/server-endpoints.md`
- **Acceptance Criteria**:
  - [ ] Update `docs/api/server-endpoints.md` with any missing endpoints
  - [ ] Add curl command examples for each endpoint
  - [ ] Document any new endpoints added since initial documentation
  - [ ] Add authentication/security notes
  - [ ] Include troubleshooting section
  - [ ] Add examples of error scenarios
- **Additional Endpoints to Document**:
  - `GET /api/test-supabase` - Database connection test
  - `GET /api/test-refresh-stats` - Refresh materialized view test
  - `POST /api/sync/metadata` - Update sync metadata
  - Any other endpoints not currently in the docs
- **Enhancement Areas**:
  - Add curl examples for testing
  - Document response headers
  - Include timing/performance notes
  - Add debugging tips

### TODO-039: Server Stability, Monitoring, and Deployment Pipeline Improvements (P1 - Infrastructure)

- **Status**: 🟡 IN PROGRESS (4 of 10 sub-tasks completed)
- **Issue**: Frequent server crashes, incomplete builds, and lack of monitoring causing production instability
- **Context**: Investigation revealed cascading failures from incomplete builds, PM2 misconfigurations, and missing recovery mechanisms
- **Implementation Strategy**: Comprehensive approach to stability including monitoring, validation, and safe deployment
- **Reference**: See `docs/server-instability-issues/investigation-report-2025-07-26_14-30-20.md` for detailed findings

#### Parent Task Overview:

This is the main task for all server stability improvements. The investigation found multiple issues:

- API routes not being compiled in production builds
- PM2 restarting services excessively (16+ times in 30 minutes)
- Environment variables not reaching client-side code
- No validation or recovery mechanisms
- Missing monitoring and alerting

#### Implementation Architecture:

- External Monitoring: Uptime Kuma (Docker on port 3080)
- Internal Recovery: Existing monitor-services.sh script
- Strategy: Dual monitoring with Kuma for visibility, monitor-services.sh for quick recovery
- Order: Set up monitoring first, then fix root causes, then enhance

#### Sub-tasks:


##### TODO-039d: Environment Variable Management (P1 - Critical)

- **Status**: ✅ COMPLETED Saturday, July 26, 2025
- **Issue**: Client-side code not receiving NEXT*PUBLIC*\* variables
- **Context**: PM2 runtime injection doesn't work for Next.js client builds
- **Implementation Details**:
  - Critical fix - ensures client-side code receives NEXT_PUBLIC_* variables at build time
  - Create centralized environment validation system
  - Keep single .env file with clear sections (not separate files)
  - All variables are critical - any missing variable should fail the build
  - Fix missing variables: NEXT_PUBLIC_BASE_URL and NEXT_PUBLIC_APP_URL
  - Standardize naming: use SUPABASE_SERVICE_ROLE_KEY consistently
- **Revised Acceptance Criteria**:
  - [x] Create scripts/validate-env.sh that validates ALL required variables exist
  - [x] Validation script fails build if ANY variable is missing (all are critical)
  - [x] Add missing NEXT_PUBLIC_BASE_URL and NEXT_PUBLIC_APP_URL to .env
  - [x] Update .env.example with all variables documented (marking all as required)
  - [x] Modify build-and-start-prod.sh to export all NEXT_PUBLIC_* variables before build
  - [x] Fix SUPABASE_SERVICE_KEY naming inconsistency in codebase
  - [x] Add pre-build validation to ensure variables are available at build time
  - [x] Document variable loading order, build-time vs runtime requirements
  - [x] Test validation works in both development and production modes
  - [x] Ensure client-side code receives all NEXT_PUBLIC_* variables correctly
- **Resolution**:
  - Created comprehensive scripts/validate-env.sh that validates ALL 30+ environment variables
  - Modified scripts/build-and-start-prod.sh to export NEXT_PUBLIC_* vars before build
  - Added "prebuild" script to package.json for automatic validation
  - Fixed SUPABASE_SERVICE_KEY → SUPABASE_SERVICE_ROLE_KEY naming across 7 files
  - Deleted redundant .env.server.example and .env.test files
  - Created comprehensive .env.example with all required variables
  - Created docs/deployment/environment-variables.md with complete documentation
  - Result: Environment variable issues resolved, critical issues reduced from 5 to 3

##### TODO-039a: Create Health Check Endpoints (P1 - Prerequisite)

- **Status**: ✅ COMPLETED Sunday, July 27, 2025
- **Issue**: Need standardized health endpoints for all services
- **Implementation Strategy**: Comprehensive health monitoring with Uptime Kuma integration
- **Completion Notes**: Successfully implemented comprehensive health check endpoints for all services:
  - Enhanced `/api/health/app` endpoint with database checks, OAuth validation, performance metrics
  - Enhanced `/server/health` endpoint for bi-directional sync server with queue stats
  - Created `/api/health/cron` endpoint that reads cron health status from JSONL file
  - Standardized JSON response format across all endpoints
  - Configured Uptime Kuma monitors for all health endpoints
  - Implemented performance tracking with rolling averages
  - All endpoints properly return HTTP status codes (200 for healthy/degraded, 503 for unhealthy)
  - Fully integrated with monitor-services.sh for automated recovery

**Overview:**
Enhance existing health endpoints and create new ones to provide comprehensive monitoring for all RSS Reader services, with full Uptime Kuma integration.

**Key Design Decisions:**
1. **No Authentication**: Health endpoints will be public (already protected by Tailscale network)
2. **JSONL Logging**: All log files will use .jsonl format for consistency
3. **HTTP Monitoring Only**: Remove redundant TCP port monitors in Uptime Kuma
4. **Standardized Response Format**: All endpoints return consistent JSON structure
5. **Performance Tracking**: Track rolling averages for key operations

**Implementation Details:**

1. **Enhanced /api/health/app endpoint (Main Next.js App):**
   - Add real database connectivity check (test Supabase connection)
   - Validate OAuth token status and expiration time
   - Track uptime since service started (stored in memory)
   - Monitor error counts from last hour (rolling window)
   - Include performance metrics (avg response times)
   - Return appropriate HTTP status codes (200 for healthy/degraded, 503 for unhealthy)

2. **Enhanced /server/health endpoint (Bi-directional Sync Server):**
   - Add database connectivity check
   - Check OAuth token validity
   - Display sync queue statistics (pending, failed, retry counts)
   - Show last sync activity timestamp
   - Include service uptime and error counts
   - Add performance metrics for sync operations

3. **Health Check for Sync Cron Service:**
   - Write health status to `/logs/cron-health.jsonl` after each run
   - Include: last run time, next scheduled run, success/failure counts
   - Create new `/api/health/cron` endpoint that reads and serves this file
   - Update file after each sync attempt with results

4. **Standardized Response Format:**
   ```json
   {
     "status": "healthy|degraded|unhealthy",
     "service": "service-name",
     "uptime": 12345,                    // seconds since start
     "lastActivity": "2025-01-26T10:00:00Z",
     "errorCount": 0,                    // errors in last hour
     "dependencies": {
       "database": "healthy",
       "oauth": "healthy"
     },
     "performance": {
       "avgSyncTime": 2500,             // ms (last 100 operations)
       "avgDbQueryTime": 45,            // ms
       "avgApiCallTime": 350            // ms
     },
     "details": {
       // Service-specific metrics
     }
   }
   ```

5. **Logging Strategy:**
   - Performance metrics: `/logs/performance-metrics.jsonl`
   - Health check history: `/logs/health-checks.jsonl`
   - Cron health status: `/logs/cron-health.jsonl`
   - All files use JSONL format (one JSON object per line)

6. **Uptime Kuma Integration:**
   - Configure HTTP(s) monitors for each health endpoint:
     - Production App: http://localhost:3147/api/health/app
     - Dev App: http://localhost:3000/api/health/app
     - Sync Server: http://localhost:3001/server/health
     - Cron Service: http://localhost:3147/api/health/cron
   - Remove redundant TCP port monitors
   - Enable JSON response parsing for detailed status
   - Set up alerts based on status field and error counts

**Migration Notes:**
- Keep existing `/fetch-stats` page for detailed analytics
- Consider future migration of fetch stats to Uptime Kuma dashboard
- Existing monitor-services.sh script will continue to work with simple endpoints

**Testing Strategy:**
1. Test each endpoint returns correct status codes
2. Verify Uptime Kuma can parse JSON responses
3. Test degraded and unhealthy states
4. Ensure performance tracking doesn't impact response times
5. Verify JSONL files are created and rotated properly

- **Acceptance Criteria**:
  - [x] Create `/api/health/app` endpoint for main Next.js app
  - [x] Create `/server/health` endpoint for bi-directional sync server
  - [x] Create health check mechanism for sync cron service
  - [x] Health endpoints return: status, uptime, last activity, error count
  - [x] Include dependency checks (DB connection, OAuth tokens)
  - [x] Standardize response format across all endpoints

##### TODO-039e: PM2 Configuration Improvements (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Issue**: Cluster mode causing crashes, low restart limits, missing health delays
- **Context**: Investigation found PM2 misconfigured for Next.js and cron services
- **Acceptance Criteria**:
  - [ ] Change rss-sync-cron to fork mode
  - [ ] Increase max_restarts to 50 for all services
  - [ ] Add min_uptime: '10s' to prevent rapid restarts
  - [ ] Add kill_timeout: 5000 for graceful shutdowns
  - [ ] Configure exponential backoff for restart delays
  - [ ] Add wait_ready: true for health check integration
  - [ ] Set proper memory limits based on available resources
  - [ ] Test configuration changes thoroughly

##### TODO-039c: Uptime Kuma Webhook Handler for PM2 Auto-Recovery (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Parent**: TODO-039 (Server Health Monitoring)
- **Depends On**: TODO-039a (Health endpoints must exist first)
- **Issue**: Webhook for critical failures only - when monitor-services.sh fails
- **Context**: Uptime Kuma will detect failures and call this webhook to trigger PM2 restarts
- **Implementation Details**:
  - Let monitor-services.sh handle routine restarts
- **Acceptance Criteria**:
  - [ ] Create `/api/webhooks/uptime-kuma-recovery` endpoint
  - [ ] Authenticate webhook requests (shared secret)
  - [ ] Parse Uptime Kuma payload to identify failed service
  - [ ] Use PM2 API to restart the specific failed process
  - [ ] Implement retry limit (3 attempts per hour per service)
  - [ ] Track restart history in `logs/auto-recovery.jsonl`
  - [ ] Add exponential backoff for repeated failures
  - [ ] Return appropriate status to Uptime Kuma
- **Implementation**:
  - Webhook receives: monitor name, status, error details
  - Map monitor names to PM2 process names
  - Use PM2 programmatic API for restarts
  - Track restart attempts in memory/Redis
  - Wait 1min, 5min, 15min between retries
  - Log all recovery attempts with outcomes
- **Uptime Kuma Configuration**:
  - Configure webhook URL in each monitor
  - Set up webhook only for DOWN events
  - Include monitor details in payload
  - Test with manual trigger from Uptime Kuma

##### TODO-039g: Error Handling & Monitoring (P1 - Production Quality)

- **Status**: 🔴 TODO
- **Issue**: Poor error visibility and handling (formerly TODO-017)
- **Context**: Consolidated from TODO-017 into comprehensive monitoring
- **Acceptance Criteria**:
  - [ ] Server API errors display clearly in UI
  - [ ] Tailscale connection errors handled gracefully
  - [ ] Supabase connection errors handled
  - [ ] Rate limit warnings at 80% and 95%
  - [ ] Create unified error logging system
  - [ ] Add error tracking dashboard
  - [ ] Implement user-friendly error messages

##### TODO-039h: Database Monitoring (P2 - Monitoring)

- **Status**: 🔴 TODO
- **Issue**: No database performance monitoring (formerly TODO-018)
- **Context**: Consolidated from TODO-018 into comprehensive monitoring
- **Acceptance Criteria**:
  - [ ] Set up automated Supabase advisor reports
  - [ ] Create alerts for slow queries (>100ms)
  - [ ] Create alerts for failed RLS policy checks
  - [ ] Document monitoring setup
  - [ ] Add query performance tracking
  - [ ] Monitor connection pool health
  - [ ] Track database size and growth

##### TODO-039f: Deployment Safety Mechanisms (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Issue**: No safe deployment process, causing production outages
- **Context**: Need blue-green deployment and rollback capabilities
- **Acceptance Criteria**:
  - [ ] Implement blue-green deployment strategy
  - [ ] Build new version in separate directory
  - [ ] Run validation tests before switching
  - [ ] Keep previous version for instant rollback
  - [ ] Create rollback script for emergencies
  - [ ] Add deployment checklist and automation
  - [ ] Document deployment procedures
  - [ ] Test rollback mechanism regularly

##### TODO-039j: Log Management and Rotation (P2 - Infrastructure)

- **Status**: 🔴 TODO
- **Issue**: Logs growing unbounded, causing disk space issues
- **Context**: Investigation found stale monitoring data and unbounded log growth
- **Acceptance Criteria**:
  - [ ] Implement log rotation for all services
  - [ ] Set maximum log file sizes
  - [ ] Archive old logs automatically
  - [ ] Clean up PM2 logs regularly
  - [ ] Monitor disk space usage
  - [ ] Create log retention policy
  - [ ] Document log locations and formats

### TODO-043: Fix Favicon Not Loading on iPad in Production (P1 - Bug)

- **Status**: 🔴 TODO
- **Issue**: Favicon not loading in production app on iPad
- **Context**:
  - Production URL: http://100.96.166.53:3147/reader
  - The favicon may not be loading due to basePath configuration or PWA manifest issues
  - Related to previous TODO-010 which fixed 404 errors for missing assets
- **Evidence**: User reports favicon not appearing when accessing the app on iPad
- **Potential Causes**:
  - Incorrect favicon path with /reader basePath prefix
  - PWA manifest not properly configured for iPad
  - Safari-specific favicon requirements not met
  - Missing Apple touch icon variants
- **Acceptance Criteria**:
  - [ ] Investigate current favicon configuration in metadata
  - [ ] Check if favicon URLs include proper /reader basePath prefix
  - [ ] Verify PWA manifest icons configuration
  - [ ] Test favicon loading on iPad Safari in production
  - [ ] Ensure all required Apple touch icon sizes are present
  - [ ] Add appropriate meta tags for Safari/iOS if missing
- **Implementation Notes**:
  - Check `src/app/layout.tsx` metadata configuration
  - Verify files exist in `public/` directory
  - May need iPad-specific icon sizes (152x152, 167x167, 180x180)
  - Consider using absolute URLs for production environment

### TODO-045: Enable Native Share Sheet on Apple Devices (P2 - Enhancement)

- **Status**: 🔴 TODO
- **Issue**: Share button doesn't use native share functionality on Apple devices
- **Context**:
  - Share button currently exists in the article dropdown menu
  - On Apple devices (iOS/macOS), users expect native share sheet
  - On other devices, copying URL with toast notification is sufficient
- **User Story**: As a user on an Apple device, I want the share button to open the native share sheet so I can easily share articles using my preferred apps
- **Acceptance Criteria**:
  - [ ] Detect if user is on Apple device (iOS Safari, macOS Safari, or PWA)
  - [ ] On Apple devices: Use Web Share API to open native share sheet
  - [ ] On non-Apple devices: Copy article URL to clipboard
  - [ ] Show toast notification when URL is copied (non-Apple devices)
  - [ ] Include article title and URL in share data
  - [ ] Fallback to clipboard copy if Web Share API fails
  - [ ] Test on iPad, iPhone, Mac, and non-Apple devices
- **Implementation Details**:
  - Use `navigator.share()` API for native sharing
  - Check `navigator.userAgent` or feature detection
  - Share data should include: title, text (description), url
  - Toast notification using existing UI patterns
- **Code Example**:

  ```typescript
  const shareArticle = async () => {
    const shareData = {
      title: article.title,
      text: article.description || article.title,
      url: article.url,
    };

    if (navigator.share && /iPhone|iPad|Mac/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Fallback to clipboard
      }
    } else {
      // Copy to clipboard with toast
    }
  };
  ```

- **Files to Modify**:
  - `src/components/articles/article-detail.tsx` - Share button implementation
  - May need a utility function for device detection
  - Toast notification component/hook
- **Testing Notes**:
  - Test native share sheet on iOS Safari
  - Test native share sheet on macOS Safari
  - Test PWA on iPad/iPhone
  - Test clipboard fallback on Chrome/Firefox
  - Ensure share data formats correctly for different apps

### TODO-050a: Fix iOS Safari Double-Tap Link Issue (P3 - Quality)

- **Status**: 🔴 TODO
- **Parent**: TODO-044 (partially completed)
- **Issue**: iOS Safari/PWA users must tap links twice before they open in new tabs
- **Context**:
  - Links do successfully open in new tabs with proper target="\_blank" attributes
  - However, iOS requires two taps: first tap seems to "focus", second tap opens link
  - Issue specific to iOS Safari and PWA mode, not present on desktop or Android
  - Multiple attempted fixes have failed to resolve the issue
- **User Story**: As an iOS user, I want to tap links once to open them, not twice
- **Previous Attempts That Failed**:
  - Removing CSS hover states
  - Adding inline styles to override hover behavior
  - Manipulating touch-action CSS property
  - JavaScript event handlers for touch events
  - iOS-specific button component approach
- **Acceptance Criteria**:
  - [ ] Links open on first tap in iOS Safari
  - [ ] Links open on first tap in iOS PWA mode
  - [ ] Solution doesn't break desktop hover states
  - [ ] Solution doesn't affect Android behavior
  - [ ] No visual regression in link appearance
- **Potential Solutions to Investigate**:
  - Use `onclick` handler instead of relying on href behavior
  - Implement custom touch handling with preventDefault
  - Research iOS-specific link handling patterns
  - Consider using buttons styled as links
  - Investigate if issue is related to focus management
  - Check if parent container event handling interferes
- **Technical Notes**:
  - Issue may be related to iOS's tap delay for detecting double-tap zoom
  - Could be interaction between React event handling and iOS Safari
  - May need to disable certain iOS gestures on link containers
- **Files to Investigate**:
  - `src/lib/utils/link-processor.ts` - Current link processing logic
  - Components that display processed content
  - Any parent containers that might have touch handlers
- **Testing Requirements**:
  - Test on physical iOS device (not just simulator)
  - Test in both Safari and PWA mode
  - Test with various link types (short, long, with/without protocols)
  - Verify solution works across iOS versions

### TODO-051: Create AI Summarization Logging and Analytics Page (P2 - Analytics)

- **Status**: 🔴 TODO
- **Issue**: No visibility into AI summarization usage, costs, or patterns
- **Context**:
  - Currently no logging for which articles get summarized
  - No analytics on summarization success/failure rates
  - No tracking of API costs or usage patterns
  - `/fetch-stats` page exists as a good model for similar analytics
  - Need visibility for cost management and usage optimization
- **User Story**: As a user, I want to see my AI summarization history and statistics to understand usage patterns and costs
- **Acceptance Criteria**:
  - [ ] Create `summary_logs` table to track all summarization attempts
  - [ ] Log: article_id, feed_id, timestamp, success, error_reason, model_used, tokens_used, cost_estimate
  - [ ] Create `/summary-stats` page similar to `/fetch-stats`
  - [ ] Show time-based aggregation (hourly, daily, weekly)
  - [ ] Display success/failure rates by feed
  - [ ] Show estimated costs based on token usage
  - [ ] Add link to summary stats from article dropdown menu
  - [ ] Include most/least summarized feeds
- **Database Schema**:
  ```sql
  CREATE TABLE summary_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES articles(id),
    feed_id UUID REFERENCES feeds(id),
    user_id TEXT DEFAULT 'shayon',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    error_reason TEXT,
    model_used TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost DECIMAL(10, 6),
    response_time_ms INTEGER
  );
  ```
- **Analytics to Display**:
  - Total summaries generated
  - Success rate percentage
  - Average response time
  - Total estimated cost
  - Cost by time period
  - Most summarized feeds
  - Recent failures with reasons
  - Token usage trends
- **Implementation Approach**:
  1. Create database migration for summary_logs table
  2. Update summarize API to log all attempts
  3. Create `/api/analytics/summary-stats` endpoint
  4. Build `/summary-stats` page component
  5. Add navigation link near fetch-stats link
- **Files to Create/Modify**:
  - `/supabase/migrations/xxx_add_summary_logs.sql` - New table
  - `/src/app/api/articles/[id]/summarize/route.ts` - Add logging
  - `/src/app/api/analytics/summary-stats/route.ts` - New endpoint
  - `/src/app/summary-stats/page.tsx` - New analytics page
  - Update navigation to include link
- **Cost Calculation**:
  - Claude Sonnet pricing: ~$3/1M input, ~$15/1M output tokens
  - Store rates in environment variables for easy updates
  - Calculate estimated cost per summary
- **Testing Notes**:
  - Test logging for both successful and failed summaries
  - Verify cost calculations are accurate
  - Ensure page loads quickly with many logs
  - Test different time range filters

### TODO-053: Investigate Article Freshness Perception Issue (P2 - Investigation)

- **Status**: 🔴 TODO
- **Issue**: User perceives articles as being 5 hours old when latest is actually 3 hours old
- **Context**:
  - Investigation on July 24, 2025 at 4:07 AM EDT showed:
  - 2 AM sync ran successfully (completed at 6:00:06 UTC)
  - Latest article in DB is from 1:17 AM EDT (5:17 UTC)
  - This is ~3 hours old, not 5 hours as reported
  - Sync fetched 69 articles during 2 AM run
- **Potential Causes**:
  1. UI showing incorrect timestamps or timezone conversion issues
  2. Article list not sorting correctly by published date
  3. User looking at filtered view that excludes recent articles
  4. Client-side caching showing stale data
  5. Articles being marked as read automatically, hiding recent unread ones
- **Investigation Steps**:
  - [ ] Check how timestamps are displayed in the UI
  - [ ] Verify timezone handling in article list component
  - [ ] Check if any filters are hiding recent articles
  - [ ] Test article sorting logic
  - [ ] Verify client-side data freshness
- **Evidence Gathered**:
  - Database shows sync completed successfully at 2 AM EDT
  - 69 articles were synced at that time
  - Latest article is from 1:17 AM EDT (not 5 hours old)
  - Only 5 articles published in last 6 hours (RSS feeds quiet at night)
  - Sync is limited to 300 articles per run (SYNC_MAX_ARTICLES)
- **Acceptance Criteria**:
  - [ ] Identify why user sees older articles than what's in database
  - [ ] Fix any timezone display issues
  - [ ] Ensure article list shows most recent articles first
  - [ ] Verify filters aren't hiding recent content
  - [ ] Document findings and implement fix if needed

### TODO-054: Implement Comprehensive Sync Logging and Analytics (P0 - Debugging)

- **Status**: 🔴 TODO
- **Issue**: Need detailed logging to investigate sync issues (TODO-052 & TODO-053)
- **Context**:
  - Currently no visibility into how many articles are synced
  - Can't track when read/starred status changes occur
  - No way to detect sync conflicts or overwrites
  - Need to differentiate between auto and manual syncs
- **Benefits**:
  - Debug read/starred status preservation issues
  - Understand article freshness perception gaps
  - Monitor sync health and performance
  - Detect and resolve sync conflicts
- **Architecture**: Similar to existing fetch-stats implementation
- **Sub-tasks**: Broken into independently shippable user stories

#### TODO-054a: Add Sync Metrics to Sync Process

- **Status**: 🔴 TODO
- **User Story**: As a developer, I want to see how many articles were synced in each operation
- **Tasks**:
  - [ ] Add article counting logic to sync process
  - [ ] Track new vs updated articles
  - [ ] Store counts in sync status object
  - [ ] Update status endpoint to return counts
  - [ ] Log metrics to sync-cron.jsonl
- **Acceptance Criteria**:
  - [ ] Sync logs show: articles_fetched, articles_new, articles_updated
  - [ ] Status endpoint returns feedsCount and articlesCount
  - [ ] Cron logs display article counts after each sync
  - [ ] Works for both auto and manual syncs
- **Testing**: Trigger manual sync and verify counts in logs

#### TODO-054b: Create Status Change Tracking System

- **Status**: 🔴 TODO
- **User Story**: As a developer, I want to track every read/starred status change with timestamps
- **Tasks**:
  - [ ] Create status-changes.jsonl log file
  - [ ] Add logging to article store's toggleRead method
  - [ ] Add logging to article store's toggleStar method
  - [ ] Include trigger source (user, auto-scroll, sync)
  - [ ] Log when items are queued for bi-directional sync
  - [ ] Log when the queues are cleared
- **Acceptance Criteria**:
  - [ ] Every status change creates a log entry
  - [ ] Log includes: timestamp, article_id, action, trigger, previous/new state
  - [ ] Auto-scroll read marking is differentiated from user clicks
  - [ ] File is git-ignored and doesn't grow unbounded
- **Testing**: Mark articles read/starred and verify log entries

#### TODO-054c: Implement Sync Conflict Detection

- **Status**: 🔴 TODO
- **User Story**: As a developer, I want to know when sync overwrites local changes
- **Tasks**:
  - [ ] Create sync-conflicts.jsonl log file
  - [ ] Compare last_local_update vs last_sync_update before upsert
  - [ ] Log conflicts with local and remote values
  - [ ] Track resolution (which value won)
  - [ ] Count conflicts per sync operation
- **Acceptance Criteria**:
  - [ ] Conflicts logged with full details
  - [ ] Can identify patterns of data loss
  - [ ] Sync metrics include conflict count
  - [ ] Works for both read and starred status
- **Testing**: Change status locally, then sync, verify conflict detection

#### TODO-054d: Create Sync Analytics Dashboard

- **Status**: 🔴 TODO
- **User Story**: As a user, I want to see sync statistics and history
- **Tasks**:
  - [ ] Create `/api/analytics/sync-stats` endpoint
  - [ ] Create `/sync-stats` page (similar to `/fetch-stats`)
  - [ ] Show time-based sync history with article counts
  - [ ] Display conflict frequency by sync type
  - [ ] Show read/starred status change patterns
  - [ ] Add navigation link in header
- **Acceptance Criteria**:
  - [ ] Dashboard shows sync history with metrics
  - [ ] Can filter by auto vs manual syncs
  - [ ] Shows conflicts and resolutions
  - [ ] Identifies problematic patterns
  - [ ] Loads quickly with many log entries
- **Testing**: Navigate to /sync-stats and verify all metrics display

#### TODO-054e: Add Bi-directional Sync Queue Monitoring

- **Status**: 🔴 TODO
- **User Story**: As a developer, I want to see if status changes are reaching Inoreader
- **Tasks**:
  - [ ] Enhance bidirectional-sync.js logging
  - [ ] Log batch details (size, action breakdown)
  - [ ] Track Inoreader API responses
  - [ ] Log failed sync attempts with reasons
  - [ ] Add queue depth monitoring
- **Acceptance Criteria**:
  - [ ] Can see what's being sent to Inoreader
  - [ ] API failures are logged with details
  - [ ] Queue processing delays are visible
  - [ ] Success/failure rates are tracked
- **Testing**: Star articles and verify queue processing logs

#### TODO-054f: Create Sync Health Summary API

- **Status**: 🔴 TODO
- **User Story**: As a developer, I want a quick health check endpoint for sync status
- **Tasks**:
  - [ ] Create `/api/sync/health` endpoint
  - [ ] Return last sync time, success rate, conflict rate
  - [ ] Include queue depth and processing delays
  - [ ] Show if bi-directional sync is running
  - [ ] Return current starred/read article counts
- **Acceptance Criteria**:
  - [ ] Single endpoint shows sync system health
  - [ ] Identifies common issues automatically
  - [ ] Returns actionable information
  - [ ] Can be used for monitoring/alerts
- **Testing**: Call endpoint and verify all metrics returned

## ✅ COMPLETED TODOS

All completed TODOs have been moved to `docs/shipped-todos.md`.
