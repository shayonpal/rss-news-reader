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

### TODO-017: Error Handling & Monitoring (P1 - Production Quality)

- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Server API errors display clearly in UI
  - [ ] Tailscale connection errors handled gracefully
  - [ ] Supabase connection errors handled
  - [ ] Rate limit warnings at 80% and 95%

### TODO-018: Database Monitoring (P2 - Monitoring)

- **Status**: 🔴 TODO
- **Acceptance Criteria**:
  - [ ] Set up automated Supabase advisor reports
  - [ ] Create alerts for slow queries (>100ms)
  - [ ] Create alerts for failed RLS policy checks
  - [ ] Document monitoring setup

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

### TODO-039: Implement Server Health Monitoring and Auto-Recovery Service (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Issue**: No automated monitoring for critical servers (sync server stopped without detection)
- **Context**: Bi-directional sync server was not running for hours without any alerts
- **Acceptance Criteria**:
  - [ ] Create health check endpoints for all critical services:
    - [ ] Main Next.js app (ports 3000/3147)
    - [ ] Bi-directional sync server (port 3001)
    - [ ] Sync cron service
  - [ ] Implement monitoring service that checks health every 5 minutes
  - [ ] Auto-restart failed services with PM2
  - [ ] Log all health check results and recovery actions
  - [ ] Track service uptime and crash frequency
  - [ ] Implement exponential backoff for repeated failures
  - [ ] Create GitHub webhook integration for exception notifications
  - [ ] Send alerts when services fail or require manual intervention
- **Technical Requirements**:
  - [ ] Health endpoints should return: status, uptime, last activity, error count
  - [ ] Monitor should detect: process not running, port not responding, health check failures
  - [ ] Use PM2 API for process management
  - [ ] Store health history in logs/health-monitoring.jsonl
  - [ ] GitHub webhook for critical alerts (crashes, repeated failures)
- **Implementation Approach**:
  - Create `/server/health` endpoint for sync server
  - Add `/api/health/services` endpoint to check all services
  - Create monitoring script with PM2 integration
  - Use node-cron for periodic health checks
  - Configure GitHub Actions or webhooks for notifications
- **Related**: Tailscale monitoring (TODO-012) already implemented similar pattern

### TODO-039a: Add Health Check Endpoints to All Services (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Parent**: TODO-039 (Server Health Monitoring)
- **Issue**: Services lack health check endpoints for monitoring
- **Acceptance Criteria**:
  - [ ] Add `/api/health/app` endpoint to Next.js app
  - [ ] Add `/server/health` endpoint to sync server (port 3001)
  - [ ] Add health check capability to cron service
  - [ ] Each endpoint returns: status, uptime, version, last_activity
  - [ ] Test endpoints respond within 1 second
  - [ ] Add startup check that verifies all services start correctly after system reboot
- **Implementation**:
  - Extend existing `/api/health` route for app health
  - Create new Express route in sync server
  - Add process.send() health reporting for cron
  - Include startup verification in monitor to catch post-reboot failures

### TODO-039b: Create Basic Health Monitor Script (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Parent**: TODO-039 (Server Health Monitoring)
- **Depends On**: TODO-039a (Health endpoints must exist first)
- **Issue**: Need automated health checking of all services
- **Acceptance Criteria**:
  - [ ] Create `/scripts/monitor-services.js` script
  - [ ] Check health endpoints every 5 minutes
  - [ ] Log results to `logs/health-monitoring.jsonl`
  - [ ] Detect: HTTP errors, timeouts, process not running
  - [ ] Simple console output for manual testing
- **Implementation**:
  - Use node-fetch for HTTP health checks
  - Check PM2 process list for running status
  - JSONL format: timestamp, service, status, response_time, error

### TODO-039c: Integrate PM2 Auto-Recovery (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Parent**: TODO-039 (Server Health Monitoring)
- **Depends On**: TODO-039b (Monitor must detect failures first)
- **Issue**: Failed services need automatic restart
- **Acceptance Criteria**:
  - [ ] Monitor script can restart failed PM2 processes
  - [ ] Implement retry limit (3 attempts per hour)
  - [ ] Track restart history in monitoring log
  - [ ] Add exponential backoff for repeated failures
  - [ ] Test with intentional service crashes
- **Implementation**:
  - Use PM2 programmatic API
  - Track restart attempts in memory/file
  - Wait 1min, 5min, 15min between retries

### TODO-039d: Deploy Monitor as PM2 Service (P1 - Infrastructure)

- **Status**: 🔴 TODO
- **Parent**: TODO-039 (Server Health Monitoring)
- **Depends On**: TODO-039c (Monitor script must be complete)
- **Issue**: Monitor needs to run continuously
- **Acceptance Criteria**:
  - [ ] Add health-monitor to ecosystem.config.js
  - [ ] Configure to start on system boot
  - [ ] Set memory limit and restart policy
  - [ ] Update deployment scripts to include monitor
  - [ ] Test monitor survives PM2 reload
- **Implementation**:
  - Add as fourth app in PM2 ecosystem
  - Use cron_restart for daily refresh
  - Log rotation for monitoring logs

### TODO-039e: Add Discord Webhook Notifications (P2 - Enhancement)

- **Status**: 🔴 TODO
- **Parent**: TODO-039 (Server Health Monitoring)
- **Depends On**: TODO-039d (Monitor must be running first)
- **Issue**: Critical failures need external notifications
- **Acceptance Criteria**:
  - [ ] Configure Discord webhook for server alerts
  - [ ] Send notifications for: repeated failures, manual intervention needed
  - [ ] Include service name, error details, timestamp, suggested actions
  - [ ] Rate limit notifications (max 1 per service per hour)
  - [ ] Format messages with Discord embeds for clarity
  - [ ] Test with simulated failures
- **Implementation**:
  - Store Discord webhook URL in environment variable
  - Use Discord webhook format with embeds
  - Color code by severity (red=critical, yellow=warning)
  - Queue notifications to prevent spam
  - Include recovery suggestions in alerts

### TODO-040: Fix or Remove Unused Mark-All-Read Route (P2 - Technical Debt)

- **Status**: 🔴 TODO
- **Issue**: `/api/mark-all-read` route exists but is not integrated into the UI
- **Context**:
  - Route was created but never connected to any frontend components
  - Causes build issues because it initializes Supabase client at module level
  - Build fails when environment variables aren't available during static generation
  - Currently worked around by temporarily renaming file during build
- **Root Cause**: Supabase client is initialized outside the POST function, which runs during build time when env vars may not be available
- **Options**:
  1. **Fix the route**: Move Supabase client initialization inside the POST function (lazy loading)
  2. **Remove the route**: Delete if the feature isn't planned for implementation
  3. **Implement the feature**: Add UI buttons to mark all articles as read in a feed/folder
- **Acceptance Criteria**:
  - [ ] Decide whether to fix, remove, or implement the feature
  - [ ] If fixing: Move `createClient()` call inside the POST handler
  - [ ] If removing: Delete the route file entirely
  - [ ] If implementing: Add "Mark all as read" buttons to feed/folder context menus
  - [ ] Build completes without workarounds
- **Implementation Notes**:
  - The route is designed to mark all articles in a feed or folder as read
  - Would be useful for users who want to clear unread counts quickly
  - Similar functionality exists in most RSS readers

### TODO-042: Fix Sync Overwriting Local Star/Read Status (P0 - Critical Bug)

- **Status**: ✅ COMPLETED - Friday, July 25, 2025
- **Issue**: Sync from Inoreader overwrites local star/read status changes
- **Root Cause**:
  - User stars/marks articles as read locally → Updates `is_starred`/`is_read` in DB
  - Changes are queued for bidirectional sync → Added to `sync_queue` table
  - Bidirectional sync runs (every 5 min) → Sends changes to Inoreader
  - BUT: Regular sync from Inoreader (2AM/2PM) → Fetches articles and overwrites ALL fields including `is_starred`/`is_read`
  - This happens because sync uses `upsert` without checking `last_local_update` timestamp
- **Evidence**:
  - 0 articles currently starred in DB (despite user starring articles)
  - 26 articles have `last_local_update > last_sync_update`
  - Sync code unconditionally sets: `is_starred: article.categories?.includes('user/-/state/com.google/starred') || false`
- **Acceptance Criteria**:
  - [x] Sync should check `last_local_update` before overwriting `is_read`/`is_starred`
  - [x] If local update is newer than sync timestamp, preserve local values
  - [x] Add tests to verify local changes aren't overwritten
  - [x] Ensure bidirectional sync changes are preserved
- **Resolution**: Added conflict resolution in `/src/app/api/sync/route.ts` that compares `last_local_update` with `last_sync_update` to preserve local changes during sync. Integrated bidirectional sync into main sync flow.
- **Files to modify**:
  - `src/app/api/sync/route.ts` - Add timestamp comparison logic
  - Consider creating a merge strategy for sync conflicts
- **Testing**:
  - Star an article locally
  - Wait for bidirectional sync to complete
  - Trigger manual sync from Inoreader
  - Verify starred status is preserved

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

### TODO-044: Open All Article Links in External Tab (P2 - Enhancement)

- **Status**: 🔴 TODO
- **Issue**: Links within article content open in the same tab, causing users to lose their place
- **Context**:
  - Users reading articles may click on links within the content
  - Currently these links navigate away from the RSS reader
  - Users must use browser back button to return to their article
- **User Story**: As a user reading articles, I want all links within article content to open in new tabs so I don't lose my reading position
- **Acceptance Criteria**:
  - [ ] All links in article content open in new tab (target="\_blank")
  - [ ] Add rel="noopener noreferrer" for security
  - [ ] Apply to both RSS content and full fetched content
  - [ ] Apply to AI summary content if it contains links
  - [ ] Ensure external link icon indicator if space permits
  - [ ] Test on both desktop and mobile/iPad
- **Implementation Approach**:
  - Option 1: Add link processing in article content rendering
  - Option 2: Use CSS/JavaScript to add target="\_blank" to all links
  - Option 3: Process content server-side before storing
  - Consider using DOMParser or regex to modify links
- **Files to Modify**:
  - `src/components/articles/article-detail.tsx` - Article content display
  - Utility function for link processing
  - May need to handle different content types (RSS, full content, AI summary)
- **Testing Notes**:
  - Test with articles containing various link types
  - Ensure no breaking of existing link functionality
  - Verify security attributes are properly added

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

### TODO-050: Unify Summarize Icon Style with Star Icon in Article List (P3 - UI Consistency)

- **Status**: 🔴 TODO
- **Issue**: Summarize icon in article list has different styling than star icon, especially noticeable in dark mode
- **Context**:
  - Star icon and summarize icon appear next to each other in article list
  - They currently have different visual styles/weights
  - Inconsistency is more prominent in dark mode
  - Creates visual imbalance in the UI
- **User Story**: As a user, I want consistent icon styling in the article list for a polished visual experience
- **Acceptance Criteria**:
  - [ ] Summarize icon matches star icon style (size, weight, color)
  - [ ] Both icons have same hover states
  - [ ] Both icons have same opacity when not active
  - [ ] Consistent styling in both light and dark modes
  - [ ] Icons align properly and have same spacing
  - [ ] Active/inactive states are visually consistent
- **Current vs Expected**:
  - Current: Different icon weights/styles create visual inconsistency
  - Expected: Uniform icon appearance for professional look
- **Implementation Details**:
  - Review current star icon classes and apply to summarize icon
  - Ensure both use same icon library style (outline vs filled)
  - Match opacity, size, and hover transitions
  - Consider using same base classes for both
- **Visual Specifications**:

  ```css
  /* Consistent icon styling */
  .article-action-icon {
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .article-action-icon:hover {
    opacity: 1;
  }

  .article-action-icon.active {
    opacity: 1;
    color: theme("colors.primary");
  }
  ```

- **Files to Modify**:
  - `src/components/articles/article-list.tsx` - Article list item icons
  - Check for separate icon components if they exist
  - May need to update icon imports or sizes
- **Testing Notes**:
  - Compare visual appearance side-by-side
  - Test in both light and dark themes
  - Verify hover states work consistently
  - Check on different screen sizes

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

### TODO-052: Investigate Read Status Sync Issues with Inoreader (P0 - Critical Bug)

- **Status**: ✅ COMPLETED - Friday, July 25, 2025 (Duplicate of TODO-042)
- **Issue**: Read status appears to be lost after sync, articles marked as read become unread again
- **Context**:
  - User reports losing read status of articles after every sync
  - This could be related to TODO-042 (Sync Overwriting Local Star/Read Status)
  - Bi-directional sync was implemented in TODO-037 but may have issues
  - Critical bug affecting core functionality and user experience
- **Evidence**:
  - User feels read status is lost after sync operations
  - Articles previously marked as read appear as unread
  - May be happening during the 2 AM/2 PM automatic syncs
- **Potential Root Causes**:
  1. Sync overwriting local changes (similar to TODO-042)
  2. Bi-directional sync not working correctly
  3. Timing issue between local update and sync
  4. Sync queue not processing read status changes
  5. Inoreader API not accepting read status updates
  6. Conflict resolution favoring Inoreader state over local
- **Investigation Steps**:
  - [ ] Check sync_queue table for pending read status changes
  - [ ] Verify bi-directional sync server is running (port 3001)
  - [ ] Monitor sync logs during read status changes
  - [ ] Check if last_local_update timestamps are being respected
  - [ ] Test manual sync after marking articles as read
  - [ ] Verify Inoreader API calls are successful
  - [ ] Check for any error logs in bidirectional sync
- **Acceptance Criteria**:
  - [x] Identify root cause of read status loss
  - [x] Document the exact sync flow and timing
  - [x] Implement fix to preserve read status
  - [x] Test that read status persists through multiple sync cycles
  - [x] Ensure both manual and automatic syncs preserve status
  - [x] Add logging to track read status changes
- **Resolution**: This was a duplicate of TODO-042. The root cause was sync unconditionally overwriting local states. Fixed by implementing conflict resolution based on timestamps. See TODO-042 for details.
- **Debugging Queries**:

  ```sql
  -- Check sync queue for pending items
  SELECT * FROM sync_queue
  WHERE action = 'mark_read'
  ORDER BY created_at DESC;

  -- Check articles with local updates newer than sync
  SELECT id, title, is_read, last_local_update, last_sync_update
  FROM articles
  WHERE last_local_update > last_sync_update;

  -- Check recent sync operations
  SELECT * FROM sync_metadata
  ORDER BY last_sync DESC
  LIMIT 10;
  ```

- **Related TODOs**:
  - TODO-037: Bi-directional sync implementation
  - TODO-042: Sync overwriting local star/read status
  - TODO-038: Fixed sync queue RPC calls
- **Files to Investigate**:
  - `/src/app/api/sync/route.ts` - Main sync logic
  - `/src/server/bidirectional-sync.js` - Bi-directional sync server
  - `/src/lib/stores/article-store.ts` - Local read status updates
  - Check PM2 logs for sync errors
- **Testing Plan**:
  1. Mark several articles as read
  2. Check sync_queue for entries
  3. Wait for bi-directional sync (5 min)
  4. Trigger manual sync
  5. Verify read status is preserved

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
