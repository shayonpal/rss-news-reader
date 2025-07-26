# Changelog

All notable changes to Shayon's News RSS Reader PWA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Mark All Read Feature** (TODO-040) - Friday, July 25, 2025 at 8:39 PM
  - Added "Mark All Read" button to article header when viewing specific feeds with unread articles
  - Implemented two-tap confirmation pattern with muted red warning state instead of dialog
  - Button shows number of unread articles that will be marked as read
  - Only marks articles that exist in the local database (safety feature)
  - Uses sync queue mechanism for reliable bidirectional sync with Inoreader
  - Each article is individually added to sync_queue with action_type 'read'
  - Removed dangerous API route that was calling Inoreader's mark-all-as-read API endpoint
  - Prevents accidental marking of ALL articles across entire Inoreader account

### Documentation
- **Button Architecture Documentation** - Friday, July 25, 2025 at 9:19 PM
  - Created comprehensive documentation at `docs/tech/button-architecture.md`
  - Documents three-tier button component hierarchy (IOSButton → ArticleActionButton → Specialized Buttons)
  - Provides clear guidance on when to use each component
  - Includes code examples for creating new action buttons
  - Outlines best practices for consistent implementation
  - Added migration guide for converting existing custom buttons
  - Ensures future developers will use the established architecture instead of creating custom implementations

### Fixed
- **Unified Icon Styling Between Summarize and Star Buttons** (TODO-050) - Friday, July 25, 2025 at 9:23 PM
  - Fixed inconsistent visual styling between summarize and star icons in article list
  - Created modular button architecture with ArticleActionButton component
  - Unified hover states, opacity, and transitions for all action buttons
  - Fixed event bubbling issue where clicking buttons would open articles
  - Improved visual consistency especially noticeable in dark mode
  - All article action buttons now share consistent styling and behavior

- **TODO-040 Documentation Update** - Friday, July 25, 2025 at 8:39 PM
  - Updated TODOs.md to mark TODO-040 as completed with implementation details
  - Moved TODO-040 to shipped-todos.md with full resolution details
  - Updated shipped-todos.md header to reflect 49 completed items
  - Added "Mark All Read" feature to README.md features section
  - Updated PRD.md to reflect current implementation approach (client-side with sync queue)
  - Documented safety mechanism that prevents marking ALL articles across entire account

- **TODO-044 Documentation Update** - Friday, July 25, 2025 at 9:31 AM
  - Updated CHANGELOG.md to reflect TODO-044 as partially completed
  - Clarified that links do open in new tabs successfully (main requirement met)
  - Documented iOS double-tap issue as known limitation with attempted fixes
  - Created new TODO-050a specifically for iOS double-tap link issue
  - Added technical documentation in `docs/tech/known-issues.md` for iOS Safari behavior
  - Maintained TODO-044 in shipped-todos.md with partially completed status

### Fixed
- **Bidirectional Sync Overwriting Local Read States** - Friday, July 25, 2025 at 8:26 AM
  - Fixed sync process unconditionally overwriting local article states with Inoreader data
  - Added conflict resolution that compares last_local_update with last_sync_update timestamps
  - Documented need to integrate bidirectional sync into main sync flow (requires triggering sync server after main sync)
  - Fixed race condition in timestamp comparison by properly selecting last_sync_update in queries
  - Preserves local changes made between syncs, preventing data loss
  - Ensures read/unread states sync correctly in both directions

- **Open All Article Links in External Tab** (TODO-044) - PARTIALLY COMPLETED - Friday, July 25, 2025 at 9:31 AM
  - Fixed links within article content opening in the same tab, causing users to lose their reading position
  - All links in article content now successfully open in new tabs with proper security attributes (target="_blank" and rel="noopener noreferrer")
  - Created new link-processor utility for consistent link handling across RSS content, full fetched content, and AI summaries
  - Improved user experience by ensuring external links don't navigate away from the RSS reader
  - **Known Issue**: iOS Safari/PWA double-tap issue remains unresolved despite multiple approaches
    - Attempted fixes: CSS hover state removal, inline styles, touch-action manipulation, JavaScript event handlers
    - The issue appears to be a deeper iOS Safari behavior that requires further investigation
    - Links do open in new tabs successfully, but iOS users still need to tap twice

- **Database Performance and Security Improvements** - Friday, July 25, 2025 at 6:27 AM
  - **Security Fixes**:
    - Enabled Row Level Security on `fetch_logs` table (was exposing data without authorization)
    - Fixed SECURITY DEFINER on `sync_queue_stats` view (was bypassing row-level security)
    - Set explicit search_path for 5 functions to prevent security vulnerabilities
  - **Performance Optimizations**:
    - Added missing index on `sync_queue.article_id` foreign key for faster joins
    - Removed duplicate indexes on `fetch_logs` table (saving storage and maintenance overhead)
    - Consolidated multiple RLS policies on `system_config` table for better query performance
    - Performed VACUUM ANALYZE on all tables to clean up dead rows (eliminated 179 dead rows from articles, 43 from sync_metadata, etc.)
  - **Database Health**:
    - Total database size: ~5.7MB (very lightweight)
    - Autovacuum properly configured and running
    - All critical security and performance issues resolved

### Added
- **Independent Scrolling for Sidebar and Article List** (TODO-055) - COMPLETED ✅
  - Sidebar and article list now scroll independently, each maintaining their own position
  - Fixed viewport layout with overflow containers prevents scroll position loss
  - Header auto-hide is now controlled only by article list scrolling
  - Implemented dual approach for auto-mark-as-read: IntersectionObserver for desktop + manual fallback for iOS
  - Added Apple liquid glass scroll-to-top buttons as workaround for iOS gesture limitation
  - Fixed PWA sidebar overlap with proper safe area padding
  - Smooth scrolling experience with no scroll chaining between areas
  - Completed on Thursday, July 24, 2025 at 10:45 AM

### Changed
- **Documentation Cleanup** - Moved completed TODOs to shipped-todos.md
  - Moved TODO-046 (iOS PWA Status Bar) to shipped documentation
  - Moved TODO-047 (Filter Feeds with No Unread) to shipped documentation
  - Moved TODO-048 (Grey Out Feeds with No Unread) to shipped documentation
  - Moved TODO-049 (Alphabetical Feed Sorting) to shipped documentation
  - Moved TODO-055 (Independent Scrolling) to shipped documentation
  - Updated TODO count in shipped-todos.md from 48 to 49 items

### Added
- **Filter Out Feeds with No Unread Articles in Sidebar** (TODO-047) - COMPLETED ✅
  - When "Unread Only" filter is selected, feeds with zero unread articles are now hidden from sidebar
  - Currently selected feed remains visible even if it has zero unread (until deselected)
  - Filter applies only when "Unread Only" is active; all feeds visible for "Read Only" or "All Articles"
  - Scroll position is preserved when switching between filters
  - Smooth transitions when feeds appear/disappear
  - "All Articles" feed always remains visible
  - Improves focus on feeds with new content when filtering for unread articles
  - Completed on Thursday, July 24, 2025 at 8:15 AM

- **Sort Feed List Alphabetically in Sidebar** (TODO-049) - COMPLETED ✅
  - All feeds are now sorted alphabetically (A-Z) for easier navigation
  - Sorting is case-insensitive using `localeCompare()` for proper internationalization
  - Numeric sorting properly handles feeds with numbers (e.g., "404 Media" before "Ars Technica")
  - "All Articles" special feed remains at the top
  - Sorting applies in both SimpleFeedSidebar component and feed store's getFeedsInFolder method
  - New feeds will automatically appear in correct alphabetical position
  - Consistent sorting across all views for predictable feed discovery

- **Grey Out Feeds with No Unread Articles** (TODO-048) - COMPLETED ✅
  - Feeds with zero unread articles now appear with 35% opacity
  - Visual hierarchy helps users quickly identify feeds with new content
  - Hover state temporarily restores full opacity
  - Selected feeds maintain full opacity regardless of unread count
  - Unread count badges removed for feeds with zero unread
  - Applies to both SimpleFeedSidebar and FeedTreeItem components
  - Works seamlessly in both light and dark themes

### Fixed
- **iOS PWA Status Bar Color and Safe Area Handling** (TODO-046) - COMPLETED ✅
  - Fixed orange status bar appearing above app header when saved as PWA on iPhone
  - Changed status bar style from "default" to "black-translucent" for seamless integration
  - Updated theme colors: white for light mode, black for dark mode
  - Added PWA standalone mode detection with PWADetector component
  - CSS classes apply safe area padding only in PWA mode (not in regular browser)
  - Fixed article title cutoff with conditional padding based on PWA mode
  - Status bar now properly matches app header color in both themes

## [0.6.0] - 2025-07-24

### Added
- **Full Content Extraction Feature (TODO-007)** - COMPLETED ✅
  - Comprehensive system for extracting full article content beyond RSS snippets
  - All 7 sub-tasks successfully implemented
  - Automatic and manual fetch capabilities with rate limiting
  - Smart content priority display in article list
  - Complete monitoring dashboard with analytics
  - Production-ready with proper error handling and logging

- **Fetch Statistics Dashboard (TODO-007g)** - COMPLETED ✅
  - Comprehensive analytics at `/reader/fetch-stats`
  - Real-time statistics for today, this month, and lifetime
  - Per-feed performance metrics with success rates
  - Average fetch duration tracking
  - "Top Issues" section for problematic feeds
  - Mobile-responsive design with theme support

- **Content Priority Display (TODO-007e)** - COMPLETED ✅
  - Smart article list display by content priority
  - Priority 1: AI summary (shown in full)
  - Priority 2: Full extracted content (4-line preview)
  - Priority 3: RSS content (4-line preview)
  - Smooth rendering without layout shifts

- **Auto-Fetch Integration (TODO-007d)** - COMPLETED ✅
  - Automatic full content fetching for partial content feeds
  - Toggle to mark feeds as "partial content"
  - Rate limiting: 50 articles per 30 minutes
  - Silent operation with comprehensive logging
  - Tested with BBC, Forbes Tech, and Wawa News feeds

- **Manual Fetch Button (TODO-007c)** - COMPLETED ✅
  - "Fetch Full Content" button in article view
  - Loading states with spinner feedback
  - Mozilla Readability integration
  - Offline access to extracted content
  - Revert capability to RSS content

- **Database Schema for Full Content (TODO-007a)** - COMPLETED ✅
  - `is_partial_content` flag for feeds
  - `fetch_logs` table for tracking attempts
  - Proper indexing for performance
  - Support for manual and automatic fetching

- **Article Header UI Improvements (TODO-007b)** - COMPLETED ✅
  - Reorganized header with dropdown menu
  - Moved Share and Open Original to More (⋮) menu
  - Fixed IOSButton compatibility with Radix UI
  - Maintained responsive design

### Changed
- **Codebase Cleanup** - Removed duplicate and obsolete files
  - Removed duplicate icons and service workers
  - Removed obsolete SQL scripts and test files
  - Removed old release documentation (preserved in git history)
  - Cleaned up outdated technical documentation

### Fixed
- **Navigation Footer Positioning** - Fixed footer to stay visible at bottom like header
- **Fetch Logs Schema** - Added missing columns for proper metrics tracking
- **Cron Sync URL** - Fixed automatic sync URL missing /reader prefix (TODO-041)

## [0.5.1] - 2025-07-23

### Fixed - July 23, 2025 Session (Critical Bug Fix)
- **Cron Sync URL Missing /reader Prefix** (TODO-041) - COMPLETED ✅
  - Fixed automatic sync failing since deployment due to missing basePath
  - Root cause: Cron service calling `http://localhost:3147/api/sync` instead of `/reader/api/sync`
  - All automatic syncs had been failing with 404 errors since July 22 deployment
  - Solution: Updated ecosystem.config.js to use environment variable with correct default:
    ```javascript
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3147/reader'
    ```
  - Tested with ad-hoc 2:35 AM sync - completed successfully in 4.4 seconds
  - Automatic syncs now working at 2:00 AM and 2:00 PM daily
  - High impact fix - restored critical background sync functionality

### Added - July 22, 2025 Session (Auto-Mark as Read)
- **Auto-Mark Articles as Read on Scroll** (TODO-029) - COMPLETED ✅
  - Implemented Intersection Observer to detect articles leaving viewport
  - Articles automatically marked as read when scrolling down past them
  - Only triggers on downward scroll to prevent accidental marking
  - Batch processing of mark operations for efficiency (500ms debounce)
  - Articles remain visible in current view until navigation/filter change
  - Works on all article views (not just "unread only" filter)
  - Smooth opacity transition (70%) provides visual feedback
  - Created `markMultipleAsRead` batch operation in article store
  - Prevents jarring UI changes by keeping marked articles visible

### Enhanced - July 22, 2025 Session (Header Improvements)
- **Simplified Article Header Titles**
  - Removed redundant filter prefixes from headers
  - Shows just "Articles" for main list instead of "All/Unread/Read Articles"
  - Displays folder/feed name directly when viewing specific collections
  - Cleaner, more intuitive navigation experience

- **Mobile-Responsive Header Text**
  - Fixed folder name truncation on mobile devices
  - Changed from `truncate` to `break-words` for proper text wrapping
  - Added responsive font sizing: `text-lg` (mobile) → `text-xl` (tablet) → `text-2xl` (desktop)
  - Long folder names now wrap instead of being cut off

- **Reddit-Style Auto-Hiding Header**
  - Implemented scroll-based header show/hide behavior
  - Header hides when scrolling down (after 50px)
  - Header immediately shows when scrolling up (even 1px)
  - Smooth slide animation (300ms transition)
  - Saves valuable screen space, especially on mobile
  - Applied to both article list and article detail views
  - Uses `requestAnimationFrame` for optimal performance

## [0.5.0] - 2025-07-22 - Production Deployment

### Added - July 22, 2025 Session (AI Summarization)
- **Configurable AI Summarization Prompt** (TODO-023, US-704) - COMPLETED ✅
  - Implemented modular prompt configuration through environment variables
  - Created SummaryPromptBuilder service for dynamic prompt generation
  - Added three configurable parameters:
    - `SUMMARY_WORD_COUNT`: Target summary length (e.g., "150-175", "100-125")
    - `SUMMARY_FOCUS`: What to emphasize in summaries (e.g., "key facts, main arguments")
    - `SUMMARY_STYLE`: Writing style (e.g., "objective", "technical", "conversational")
  - Fallback to sensible defaults when variables not set
  - Updated PM2 ecosystem configuration to include new variables
  - Created comprehensive documentation with use case examples:
    - Technical blog summarization (200-250 words, technical focus)
    - Executive briefings (100-125 words, business impact focus)
    - News digests (75-100 words, journalistic style)
  - Added test endpoint `/api/test-prompt-config` for configuration verification
  - Configuration changes require server restart to take effect
  - Prepared system for future multi-provider LLM support (TODO-024)

### Fixed - July 22, 2025 Session (iOS Safari Improvements)
- **iOS Scroll-to-Top Gesture Support** (TODO-030) - COMPLETED ✅
  - Fixed Safari URL bar not collapsing when scrolling in article list
  - Fixed native iOS scroll-to-top gesture (tap status bar) not working
  - Root cause: Safari requires document body to scroll, not inner containers
  - Implementation:
    - Restructured layout from fixed height (`h-screen`) to flexible (`min-h-screen`)
    - Removed all inner scroll containers (`overflow-y-auto`)
    - Changed sidebar from fixed to sticky positioning on desktop
    - Updated scroll position tracking to use `window.scrollY` instead of container refs
    - Removed custom JavaScript solutions in favor of native browser behavior
  - Fixed hydration error with read status filter using client-only hook
  - Both article list and article detail views now support native iOS gestures
  - Safari URL bar now properly collapses when scrolling down
  - **Mobile Responsive Regression Fix**:
    - Fixed content overflow on iPhone where articles expanded beyond viewport
    - Added global CSS constraints to prevent horizontal scrolling
    - Updated `extractTextContent` to properly strip HTML tags and decode entities
    - Added responsive padding (sm:px-6 lg:px-8) to article detail view
    - Improved container constraints with overflow-hidden and min-w-0
    - Preserved original article preview logic (line-clamp-4 for content, full for summaries)

### Added - July 22, 2025 Session (Theme Toggle)
- **Theme Toggle** (TODO-015, US-402) - COMPLETED ✅
  - Implemented icon-based theme toggle in feed sidebar header
  - Added to the left of sync button for easy access
  - Supports three modes: Light (sun icon), Dark (moon icon), System (monitor icon)
  - Cycles through themes on click: Light → Dark → System
  - Theme preference persists across sessions using zustand store
  - Smooth transitions between themes using existing ThemeProvider
  - Works on both mobile and desktop layouts
  - Includes proper accessibility labels
  - Removed unused settings dialog components in favor of simpler icon approach

### Fixed - July 22, 2025 Session (Back Button Navigation)
- **Enhanced Back Button Navigation Logic** (TODO-028) - COMPLETED ✅
  - Back button in article view now always returns to the article listing page
  - Previous behavior would sometimes navigate to previous article when using Previous/Next buttons
  - Preserves feed filter and read status filter when returning to listing
  - Scroll position restoration already handled by existing sessionStorage implementation
  - Simple one-line change: `router.push('/')` instead of `router.back()`
  - Browser back button continues to work normally for overall navigation
  - Improves navigation consistency when browsing through multiple articles

### Added - July 22, 2025 Session (Bi-directional Sync Implementation)
- **Bi-directional Sync to Inoreader** (TODO-037) - COMPLETED ✅
  - Implemented sync queue pattern for tracking local changes
  - Created database migration with sync_queue table and helper functions
  - Added server-side BiDirectionalSyncService with periodic sync (5-minute intervals)
  - Batch processing of sync operations to minimize API calls
  - Automatic retry with exponential backoff for failed syncs
  - Client-side integration to queue read/unread/star/unstar actions
  - Conflict resolution using timestamp-based last-write-wins approach
  - Added sync queue statistics view for monitoring
  - Successfully tested with real user actions

### Fixed - July 22, 2025 Session (Bi-directional Sync Bug Fix)
- **Client-Side Sync Queue RPC Calls** (TODO-038) - COMPLETED ✅
  - Fixed SQL syntax error in add_to_sync_queue function
  - Changed from invalid CASE statement with arrays to IF/ELSIF logic
  - Added error handling to RPC calls in article store
  - Verified sync queue properly records all user actions
  - Tested with Playwright browser automation

### Added - July 22, 2025 Session (First Production Deployment)
- **Blue-Green Deployment Infrastructure** (TODO-033 to TODO-036) - COMPLETED ✅
  - Created development branch and multi-environment configuration
  - Updated PM2 ecosystem.config.js for production (port 3147) and development (port 3000)
  - Created comprehensive deployment scripts with health checks
  - Configured automatic startup with macOS LaunchAgent
  - Successfully deployed to production at http://100.96.166.53:3147/reader
  - Note: Port conflict with Obsidian Docker container on port 80, using port 3147 directly

### Added - July 21, 2025 Session (Automatic Daily Sync)
- **Automatic Daily Sync** (TODO-006, US-102) - COMPLETED ✅
  - Implemented node-cron based automatic sync service
  - Syncs run at 2:00 AM and 2:00 PM (America/Toronto timezone)
  - Created `/src/server/cron.js` with comprehensive JSONL logging
  - Added `/api/sync/metadata` endpoint for sync statistics tracking
  - Integrated with PM2 ecosystem configuration as separate process
  - Tracks success/failure counts and last sync status
  - Efficient API usage: only 4-5 calls per sync
  - Created test scripts for verification
  - PM2 startup configured for persistence across reboots
  - Service successfully running with `pm2 status` confirmation
  - Complete documentation at `/docs/deployment/automatic-sync.md`

### Added - July 21, 2025 Session (Production Deployment Infrastructure)
- **Caddy Configuration** (TODO-011, US-501) - COMPLETED ✅
  - Created Caddyfile for reverse proxy configuration routing `/reader/*` to Next.js
  - Created PM2 ecosystem.config.js with 1GB memory limit
  - Created deployment scripts for easy production deployment
  - Added service status checking and monitoring scripts
  - Comprehensive documentation for Caddy and PM2 setup
  - Ready for production deployment at http://100.96.166.53/reader
  
- **Tailscale Monitoring** (TODO-012, US-105) - COMPLETED ✅
  - Automated monitoring script checks Tailscale connection every 5 minutes
  - Auto-restart functionality with `sudo tailscale up` if disconnected
  - Passwordless sudo configuration for automatic restarts
  - Comprehensive logging of all monitoring activities
  - macOS launchd service for automatic startup on boot
  - Service successfully installed and running continuously
  - Critical infrastructure to ensure clients can always access the service

### Enhanced - July 21, 2025 Session (Database-Driven Read Status Filtering)
- **Enhanced Read Status Filtering** (TODO-014a Re-implementation) - COMPLETED ✅
  - Re-implemented following PRD specifications for database-driven counts
  - **Database-Driven Counts**: Replaced in-memory counts with actual database queries
  - **Smart Caching**: 5-minute cache TTL for performance optimization
  - **Cache Invalidation**: Automatic cache refresh on article read/unread actions
  - **Dynamic Headers**: Page titles change based on active filter and selection:
    - "Unread Articles" / "Unread from [Feed Name]"
    - "Read Articles" / "Read from [Feed Name]"
    - "All Articles" / "All from [Feed Name]"
  - **Accurate Count Display**: Shows real database counts, not just loaded articles:
    - Unread filter: "296 unread articles"
    - Read filter: "22 read articles"
    - All filter: "318 total articles (296 unread)"
  - **Enhanced Filter UI**: Dropdown shows descriptions for each filter option
  - **Hydration Fix**: Resolved Next.js hydration error on iOS Safari
  - **New Components**: ArticleCountManager for caching, enhanced ArticleHeader
  - Filter preference still persists across sessions using localStorage
  - Works seamlessly with existing feed/folder selection

### Added - July 21, 2025 Session (Read Status Filtering)
- **Read Status Filtering** (TODO-014a, US-401a) - COMPLETED ✅
  - Added dropdown filter to toggle between Unread only/Read only/All articles
  - Default view shows only unread articles for better focus
  - Filter preference persists across sessions using localStorage
  - Article counts in header update based on active filter
  - Shows "X unread" for unread filter, "X read" for read filter, "X total, Y unread" for all
  - Filter works seamlessly with existing feed/folder selection
  - Clean UI with Radix UI dropdown menu component
  - Improves reading workflow by hiding already-read articles by default

### Fixed - July 21, 2025 Session (PWA Asset 404 Errors)
- **PWA Asset 404 Errors** (TODO-010, US-902) - COMPLETED ✅
  - Fixed 404 errors for favicon and apple-touch-icon files
  - All assets already existed in correct locations
  - Fixed by adding `/reader` basePath prefix to all icon URLs in app metadata
  - Updated icon paths: `/reader/icons/favicon-16x16.png`, `/reader/icons/favicon-32x32.png`
  - Updated apple-touch-icon path: `/reader/apple-touch-icon.png`
  - Aligns with `basePath: '/reader'` configuration in next.config.mjs
  - Note: Dev server still shows 404s for browser automatic icon requests - safely ignored
  - Icons work correctly in production with proper basePath handling

### Fixed - July 21, 2025 Session (Scroll Position Preservation)
- **Scroll Position Loss on Navigation Back** (TODO-009a, US-903) - COMPLETED ✅
  - Fixed scroll position resetting to top when returning from article detail view
  - Fixed feed filter not being preserved when navigating back
  - Implemented hybrid solution combining browser history with sessionStorage backup
  - Primary method: Use `router.back()` when browser history is available
  - Backup method: Save/restore scroll position and filter state to sessionStorage
  - Handles edge cases: new tabs, direct links, page refreshes
  - Works with both UI back button and browser back button
  - Initialized feed filter immediately from storage to prevent race condition
  - Save scroll position only when clicking article (not on unmount)
  - Restore scroll position after articles are loaded and rendered
  - Tested successfully on iPhone and iPad Safari browsers

### Fixed - July 21, 2025 Session (iOS Safari Button Controls)
- **Article View Interface Controls** (TODO-009, US-901) - COMPLETED ✅
  - Fixed iOS Safari button click issues requiring double-tap
  - Created IOSButton component with proper touch event handling
  - Disabled hover states on touch devices to prevent click delays
  - Updated all article view buttons (back, star, share, external link, navigation)
  - Updated SummaryButton component to use IOSButton
  - Added iOS-specific CSS fixes for button interaction
  - Buttons now respond immediately on first tap on iPhone/iPad Safari
  - Maintained full compatibility with desktop browsers

### Fixed - July 21, 2025 Session (Critical Security Vulnerabilities) ✅ COMPLETED
- **Row Level Security Implementation** (TODO-001, US-801) - COMPLETED ✅
  - Enabled RLS on all 6 public tables (users, feeds, folders, articles, api_usage, sync_metadata)
  - Created comprehensive RLS policies restricting access to 'shayon' user only
  - Client (anon key) can read feeds/articles and update article read/starred status
  - Server (service role) maintains full access for sync operations
  - Successfully tested: client access works, unauthorized access blocked
  - Applied migration: `enable_rls_security_simple` via Supabase MCP
  - Verified in Supabase dashboard: All tables show RLS enabled
  - Security advisor shows no warnings - critical vulnerability resolved

- **Function Security Vulnerability Fix** (TODO-002, US-802) - COMPLETED ✅
  - Fixed `update_updated_at_column` function with mutable search_path vulnerability
  - Recreated function with explicit `SET search_path = public` directive
  - Recreated all associated triggers for updated_at columns
  - Applied migration: `fix_function_security` via Supabase MCP
  - Function tested and working correctly with enhanced security

- **Security Testing Implementation** - COMPLETED ✅
  - Created comprehensive security test script at `test-rls-security.js`
  - Automated tests verify client access, server access, and RLS enforcement
  - All security tests pass: ✅ Client sees 5 feeds/articles, ✅ Server sees all data, ✅ RLS blocks unauthorized access
  - Database now production-ready with proper security policies

### Added - July 21, 2025 Session (Summary UI Integration)
- **Summary UI Integration** (US-302) - COMPLETED ✅
  - Created SummaryButton component with icon and full button variants
  - Implemented loading states with shimmer animation in article list
  - Summaries display as full text (not truncated) in article list view
  - Created collapsible SummaryDisplay component for article detail view
  - Article detail shows BOTH summary and original content side-by-side
  - Proper paragraph formatting preserved from Claude API responses
  - No navigation occurs when clicking summary button in list view
  - Summary generation tracked per-article to show loading state
  - Event propagation properly handled to prevent unwanted navigation

### Added - July 21, 2025 Session (Claude API Integration)
- **Claude API Integration** (US-301) - COMPLETED ✅
  - Updated to Claude 4 Sonnet model (`claude-sonnet-4-20250514`)
  - 150-175 word AI-powered article summaries
  - Summaries successfully stored in `ai_summary` database field
  - Token usage tracking for cost monitoring
  - Caching mechanism to avoid regenerating existing summaries
  - Comprehensive error handling for rate limits and API failures
  - All documentation updated to reference Claude 4 Sonnet
  - Tested and verified with real article data

- **Configurable Claude Model** - Enhancement
  - Added `CLAUDE_SUMMARIZATION_MODEL` environment variable
  - Allows easy switching between Claude models without code changes
  - Defaults to `claude-sonnet-4-20250514` if not specified
  - Updated all environment example files
  - Tested with different model configurations

- **Improved Summary Prompt** - Enhancement
  - Updated prompt to explicitly exclude article title from summaries
  - Prevents duplicate titles in UI when displaying summaries
  - Summaries now start directly with content

### In Progress - July 20, 2025 Session (Server API Integration)
- **Server API Integration** (US-203) - Sync functionality working, UI integration pending
  - ✅ Sync button successfully calls `POST /api/sync` endpoint
  - ✅ Progress polling with `GET /api/sync/status/:id` works perfectly
  - ✅ Progress bar displays real-time sync percentage in button
  - ✅ Sync messages show current operation status
  - ✅ Rate limit information display in sidebar
    - Shows current usage (X/100 calls)
    - Yellow warning at 80% usage
    - Red warning at 95% usage
  - ✅ Enhanced error handling for server failures
    - Special handling for 429 rate limit errors
    - Clear error messages with retry button
  - ✅ API endpoint paths fixed to include `/reader` prefix from Next.js basePath
  - ✅ Rate limit data persisted across sessions
  - ✅ Successfully syncs 168 articles across multiple feeds
  - ✅ OAuth setup completed with encrypted tokens
  - ❌ "Fetch Full Content" UI integration pending (server endpoint ready)
  - ❌ "Generate Summary" UI integration pending (server endpoint ready)

### Added - July 20, 2025 Session (Server API Endpoints)
- **Server API Endpoints** (US-103) - Complete server-side API implementation
  - Created `POST /api/articles/:id/fetch-content` for content extraction
    - Integrates Mozilla Readability for clean article extraction
    - Removes scripts, styles, and clutter from HTML
    - Falls back to RSS content if extraction fails
    - Caches extracted content in `full_content` field
    - 10-second timeout for slow sites
  - Created `POST /api/articles/:id/summarize` for AI summarization
    - Uses Claude 4 Sonnet for 150-175 word summaries
    - Supports regeneration with `regenerate: true` parameter
    - Tracks token usage for cost monitoring
    - Caches summaries in `ai_summary` field
    - Handles rate limiting and API errors gracefully
  - Enhanced `/api/sync` with proper rate limiting
    - Checks daily API usage before syncing
    - Returns rate limit info in response
    - Warns at 80% and 95% usage thresholds
  - All endpoints follow consistent response format
  - Proper HTTP status codes (200, 400, 404, 429, 500, etc.)
  - Created test page at `/test-server-api` for verification
  - Added comprehensive API documentation

### Database - July 20, 2025 Session (Server API Endpoints)
- **New Tables** for API functionality
  - Created `api_usage` table for tracking API rate limits
  - Created `sync_metadata` table for storing sync state
  - Added columns to `articles` table:
    - `full_content` - Stores extracted article content
    - `has_full_content` - Boolean flag for content availability
    - `ai_summary` - Stores Claude-generated summaries
    - `author` - Article author information
  - Updated TypeScript types for all database changes
  - Created migration script at `scripts/create-api-usage-tables.sql`
  - Successfully ran migration in Supabase

### Technical Notes - July 20, 2025 Session
- **Dependencies Added**:
  - `@mozilla/readability` - For content extraction
  - `@anthropic-ai/sdk` - For Claude API integration
  - `@types/jsdom` - TypeScript types
- **Important**: US-103 creates the server endpoints only. Client integration (US-203) is still needed for users to access these features through the UI.

### Added - July 20, 2025 Session (Server-Client Architecture)
- **Server OAuth Setup** (US-101) - Server handles all Inoreader authentication
  - Created one-time OAuth setup script using Playwright automation
  - Uses test credentials from `.env` file
  - Runs on Mac Mini with localhost:8080 callback
  - Tokens encrypted and stored in `~/.rss-reader/tokens.json`
  - File permissions set to 600 (owner read/write only)
  - Automatic token refresh before expiration
  - Clear success/error messages during setup

- **Server Sync Service** (US-102 - Partially Complete) - Server-side data sync
  - Created `/api/sync` endpoint for manual sync
  - Created `/api/sync/status/:id` for polling sync progress
  - Efficient API usage: 4-5 calls per sync (subscriptions, counts, articles)
  - Single stream endpoint fetches all articles (max 100)
  - Sync status tracked in memory (should use Redis in production)
  - Token refresh handled automatically
  - Successfully syncs 69 feeds and 100 articles to Supabase
  - Manual sync working - automatic cron job deferred to later

- **Remove Client Authentication** (US-201) - Client has no auth
  - Removed all OAuth code from client
  - Removed authentication guards
  - Removed token management
  - Removed login/logout UI
  - Client assumes single user
  - App now accessible at http://100.96.166.53:3000/reader without login

- **Supabase-Only Data Layer** (US-202) - Client reads from Supabase only
  - Removed all Inoreader API calls from client
  - Converted feed-store.ts to use Supabase queries
  - Converted article-store.ts to use Supabase for all operations
  - Removed IndexedDB dependencies
  - All data flows: Inoreader → Server → Supabase → Client
  - Offline queue maintained for future sync back to Inoreader
  - Synced data now visible in UI without authentication

### Changed - July 20, 2025 Session
- **Architecture**: Migrated from client-side OAuth to server-client model
- **Data Flow**: Server handles all external APIs, client is presentation only
- **Authentication**: Removed from client, controlled by Tailscale network
- **Storage**: Moved from IndexedDB to Supabase for all client data

### Technical - July 20, 2025 Session
- **Server**: Node.js with encrypted token storage
- **Client**: Next.js reading from Supabase only
- **Security**: Server-side OAuth, encrypted tokens, Tailscale network control
- **Performance**: ~5 second sync for 69 feeds and 100 articles

### Added - July 16, 2025 Session (Issue #35 - COMPLETED ✅)
- **API Logging Service** - Track and monitor Inoreader API calls
  - Created `/api/logs/inoreader` endpoint for centralized logging
  - Logs all API calls to `logs/inoreader-api-calls.jsonl` file
  - Each log entry includes: timestamp, endpoint, trigger source, and HTTP method
  - Modified all Inoreader API routes to include trigger parameter
  - Updated client-side API service to pass trigger information
  - Implemented direct file writing for server-side logging
  - Non-blocking fire-and-forget pattern to avoid performance impact
  - Enables debugging of rate limit issues and API usage patterns
  - Simple analysis with standard Unix tools (jq, grep, sort)

### Added - July 16, 2025 Session (Issue #43 - COMPLETED ✅)
- **Supabase Sync Integration** - Cross-domain data persistence
  - Modified sync-store.ts to sync data to both IndexedDB and Supabase
  - Implemented automatic user creation/retrieval based on Inoreader ID
  - Added batch processing for articles to handle large datasets efficiently
  - Created ID mapping between Inoreader IDs and Supabase IDs
  - Implemented error handling that preserves local sync if Supabase fails
  - Added unique constraints to database for proper upsert operations
  - Successfully tested with real data: 69 feeds, 50 articles, 12 folders synced
  - Maintains backward compatibility with existing IndexedDB-only functionality

### Added - July 16, 2025 Session (Issue #39 - COMPLETED ✅)
- **Legacy IndexedDB Data Recovery** - Recover data from previous sessions
  - Implemented comprehensive legacy database detection across domains
  - Created recovery dialog with database selection UI
  - Added migration process from legacy IndexedDB to current format
  - Built test utilities for creating and managing legacy data
  - Successfully tested recovery of 50 articles, 69 feeds, 12 folders
  - Added error handling and user feedback for migration issues
  - Integrated with existing sync and storage systems

### Fixed - July 16, 2025 Session (Issue #39)
- **Supabase Schema** - Added missing 'preferences' column to users table
  - Fixed migration blocker by adding jsonb preferences column with default '{}'
  - Enabled successful testing of legacy data recovery feature

### Added - July 16, 2025 Session (Issue #38 - COMPLETED ✅)
- **Supabase Database Schema & Client Setup** - Foundation for hybrid architecture
  - Created 4-table PostgreSQL schema (users, feeds, articles, folders)
  - Implemented complete Supabase client with connection helpers
  - Added comprehensive TypeScript types for all database operations
  - Built CRUD operations for all database tables
  - Created both client-side and server-side test suites
  - Verified database operations with interactive test pages
  - Set up proper environment configuration with API keys
  - Established foundation for hybrid IndexedDB + Supabase architecture

### Technical - July 16, 2025 Session (Issue #38 - COMPLETED ✅)
- **Database Architecture** - Production-ready PostgreSQL schema with proper relationships
- **Performance Optimization** - Indexes on all foreign keys and common query fields
- **Code Quality** - 100% TypeScript coverage, ESLint compliance, comprehensive testing
- **Development Tools** - Interactive test page at `/test-supabase` for verification
- **Issue Management** - Broke down Issue #37 into 5 child issues for phased implementation

### Added - July 16, 2025 Session (Issue #36 - COMPLETED ✅)
- **365-Day Token Persistence** - Users stay logged in for a full year
  - Changed access token expiration from 1 hour to 365 days
  - Updated token refresh endpoint to maintain 365-day expiration
  - Implemented proactive token refresh at 360-day mark (5-day buffer)
  - Added periodic 24-hour auth checks for long-running sessions
  - Eliminates daily login requirement for users

### Fixed - July 16, 2025 Session (Issue #36 - COMPLETED ✅)
- **Removed Auto-Sync Behaviors** - App now loads instantly from cache
  - Removed ?sync=true parameter from OAuth callback redirect
  - Eliminated auto-sync logic from SimpleFeedSidebar and FeedList components
  - App no longer makes API calls on startup (previously ~10 calls per open)
  - Preserves 100 calls/day rate limit for manual sync operations only
  - Added URL parameter cleanup for backward compatibility

### Added - July 16, 2025 Session (Issue #36 - COMPLETED ✅)
- **Manual Sync Control** - Users have full control over when to sync
  - Enhanced sync button in feed sidebar with progress indicators
  - Added prominent empty state UI with "No feeds yet" message
  - Sync button becomes primary variant when database is empty
  - Clear call-to-action for first-time users to sync with Inoreader
  - Improved user experience with manual sync workflow

### Technical - July 16, 2025 Session (Issue #36 - COMPLETED ✅)
- **API Optimization** - Reduced API consumption from ~10 calls per app open to 0 calls
- **Development Environment** - Updated to use reserved ngrok domain (strong-stunning-worm.ngrok-free.app)
- **Documentation** - Updated README.md and CLAUDE.local.md with ngrok configuration

### Added - July 16, 2025 Session (Issue #34)
- **Theme Toggle Control** - Added UI control for switching between light/dark/system themes
  - Theme toggle button added to feed sidebar header
  - Cycles through light (sun icon), dark (moon icon), and system (monitor icon) modes
  - Theme preference persists across sessions via zustand store
  - Works on both mobile and desktop layouts
  - Includes proper accessibility labels
  - [UPDATE July 22, 2025: Moved from sync button area to dedicated icon in header]

### Fixed - July 16, 2025 Session
- **Sync Race Condition** - Fixed unnecessary API calls on login
  - Added loading state check before sync evaluation
  - Prevents sync when existing feeds are still loading from database
  - Significantly reduces API call consumption for returning users
  - Helps preserve the 100 calls/day rate limit

### Added - July 15, 2025 Session (Issue #26)
- **Auto-sync on Authentication** - Feeds now sync automatically after login
  - OAuth callback redirects to `/reader?sync=true` instead of home page
  - Empty feed state triggers automatic sync on first load
  - Loading message "Syncing your feeds..." displays during initial sync
  - Error handling with retry button if sync fails
  - Prevents duplicate syncs by checking URL parameters and sync state
  - Respects existing sync timestamps to avoid unnecessary API calls

### Added - July 15, 2025 Session (Issue #21)
- **Article List Component** - Comprehensive article browsing implementation
  - Created dedicated ArticleList component with all required features
  - Implemented infinite scroll with IntersectionObserver for performance
  - Added pull-to-refresh gesture support for mobile devices
  - Created skeleton loading states for better perceived performance
  - Added star/unstar functionality with visual feedback
  - Implemented 4-line content preview with proper line clamping
  - Added relative timestamp formatting using date-fns
  - Ensured 44x44px minimum touch targets for mobile accessibility
  - Visual distinction between read (opacity 70%) and unread (bold) articles
  - AI summary indicator (⚡) for articles with generated summaries

### Fixed - July 15, 2025 Session
- **React Rendering Error** - Fixed "Objects are not valid as a React child" error by properly extracting content from InoreaderContent objects
- **Data Corruption** - Cleaned up corrupted article data where content/summary were stored as objects instead of strings
- **Hydration Mismatches** - Fixed server/client rendering differences with dates and browser APIs
- **Type Safety** - Corrected StreamContentsResponse to use InoreaderItem[] instead of Article[]
- **Console Errors** - Resolved all major console errors and warnings

### Added
- **Data Cleanup Utilities** - Created comprehensive data cleanup functions for corrupted articles
- **Debug Endpoint** - Added /api/debug/data-cleanup for corruption detection and cleanup
- **Error Prevention** - Article store now auto-cleans corrupted data on load
- **Test Page Tools** - Added corruption check and cleanup buttons to test page

### Changed
- **Documentation** - Updated README.md and CLAUDE.local.md to specify ngrok URL (https://d2c0493e4ec2.ngrok-free.app) for all testing
- **Sync Store** - Enhanced to properly extract .content from Inoreader API responses
- **Network Status Hook** - Made SSR-safe with proper window/navigator checks
- **Headers** - Added Permissions-Policy header to suppress browsing-topics warning

### Previous Session Work (July 15, 2025 - Early Morning)
- **Authentication System** - Resolved Next.js 15+ cookie handling in API routes
- **API Integration** - All Inoreader API endpoints now return 200 status codes
- **Data Sync** - Successfully syncing 69 feeds + 100 articles in 1.6 seconds
- **Performance** - Optimized sync with only 22 API calls (under rate limits)

## [0.3.0] - 2025-07-15

### Major Breakthrough
- **Issue #25 Backend Complete** - Authentication and sync functionality working
- **Real Data Integration** - Successfully connected to live Inoreader account
- **Production Ready Sync** - Efficient batched API calls with error handling

### Added

- **Feed Hierarchy Display Component** (2025-07-14) - Issue #20
  - Created FeedList component with hierarchical folder structure display
  - Implemented collapsible folders using Radix UI Collapsible with smooth animations
  - Added unread count badges for feeds and folders with real-time updates
  - Created responsive sidebar that switches between persistent (desktop) and drawer (mobile)
  - Implemented swipe gestures for mobile drawer open/close functionality
  - Added feed selection that filters the article list
  - Included sync status indicators (syncing, last synced, errors, offline)
  - Created dedicated `/reader` page integrating feeds and articles
  - Updated home page to redirect to new reader interface
  - All acceptance criteria from US-004 successfully implemented

- **Network Access and Authentication Improvements** (2025-07-14)
  - Fixed authentication loading loop that prevented login screen display
  - Added ngrok integration for secure HTTPS access from any device
  - Updated OAuth callback handling to support proxied requests
  - Added `dev:network` and `dev:https` npm scripts for easier development
  - Created SSL certificates with mkcert for local HTTPS development
  - Fixed redirect URL handling in authentication callback route

- **Complete IndexedDB Data Storage System** 
  - **Article Store**: Full CRUD operations with pagination, filtering, and offline sync queue
  - **Feed Store**: Hierarchical feed management with real-time unread count tracking
  - **Enhanced Sync Store**: Offline action queuing with Inoreader API integration
  - **Data Persistence**: User preferences, API usage tracking, and storage management
  - **Error Recovery**: Database corruption handling and graceful degradation
  - **Performance**: Memory-efficient caching, automatic pruning, storage optimization
  - **Testing**: Comprehensive test suite with browser verification at `/test-stores`
  - **Type Safety**: Full TypeScript integration with proper interfaces
  - **Production Ready**: 2,000+ lines of robust, tested data management code

### Completed
- **Epic 1: Foundation & Authentication** - All user stories complete (US-001, US-002, US-003)
- **Issue #7**: US-003 Initial Data Storage - Implementation verified and tested
- **Data Layer**: Production-ready foundation for Epic 2 (Core Reading Experience)

- **Comprehensive Health Check System**
  - **Core Health Service**: Monitors database, APIs, cache, authentication, and network
  - **Real-time Monitoring**: Automatic health checks every 5 minutes with pause/resume
  - **Health Dashboard**: Full system health visualization at `/health`
  - **Status Widget**: Quick health indicator in application header
  - **Alert System**: Severity-based alerts (info, warning, error, critical)
  - **Performance Metrics**: Track uptime, response times, and success rates
  - **API Endpoints**: `/api/health` for external monitoring
  - **Service-specific Checks**:
    - Database: Connection, storage usage, data integrity
    - APIs: Inoreader/Claude availability, rate limit monitoring
    - Cache: Service Worker and LocalStorage health
    - Auth: Token validity and refresh capability
    - Network: Online status and external connectivity
  - **Comprehensive Test Suite**: Unit tests for health service and store
  - **Documentation**: Complete health check system documentation

### Changed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- N/A

### Security

- N/A

## [0.4.0] - 2025-06-24 16:27:19 EDT

### Added

- **Complete IndexedDB Data Storage System** (Issue #7: US-003)
  - **Database Implementation**
    - Dexie.js integration for IndexedDB management
    - 10 object stores: articles, feeds, folders, summaries, readStatus, syncState, userPreferences, syncQueue, apiUsage, errorLog
    - TypeScript interfaces for all data models
    - Automatic database versioning and migrations
  - **Storage Management**
    - Storage quota monitoring with real-time updates
    - Automatic cleanup when approaching quota limits
    - Configurable article retention policies
    - Efficient indexing for fast queries
  - **Data Models**
    - Article storage with full content and metadata
    - Feed hierarchy with folder organization
    - AI summary caching system
    - Read/unread status tracking
    - Sync state management for conflict resolution
  - **API Integration**
    - API usage tracking across all services
    - Rate limit monitoring with daily reset
    - Error logging for debugging
    - Request history for analytics
  - **User Preferences**
    - Persistent settings storage
    - Theme preferences
    - Sync configuration
    - Display options

### Technical Implementation

- **Database**: IndexedDB with Dexie.js wrapper
- **Type Safety**: Full TypeScript interfaces for all stores
- **Performance**: Compound indexes for efficient queries
- **Reliability**: Transaction support with rollback capability
- **Monitoring**: Real-time storage quota tracking

### Fixed

- **Critical API Rate Limiting Issues** (Issue #6 Follow-up - June 9, 2025)
  - **Infinite Authentication Polling**: Fixed React hooks dependency loop causing continuous `/api/auth/inoreader/status` calls
  - **Request Deduplication**: Implemented singleton pattern to prevent multiple simultaneous auth checks
  - **Smart Auth Caching**: Added user info caching to avoid redundant external API calls
  - **Rate Limiting Protection**: Added proper rate limiting to `/api/inoreader/user-info` route
  - **Component Optimization**: Reduced auth checks to only run when no cached user data exists
  - **ESLint Compliance**: Fixed all React hooks exhaustive dependencies warnings

### Security

- Enhanced API rate limiting protection prevents quota exhaustion

## [0.3.0] - 2025-01-06

### Added

- **Complete Inoreader OAuth 2.0 Authentication System** (Issue #6: US-002)
  - **OAuth API Routes** (Issue #13)
    - Authorization endpoint with secure state parameter generation
    - Callback route for authorization code exchange
    - Token refresh endpoint for automatic renewal
    - Logout route to clear authentication
    - Status endpoint for auth state checking
  - **Secure Token Storage** (Issue #14)
    - HttpOnly cookies for access and refresh tokens
    - Proper security flags (Secure, SameSite, Path)
    - Token expiration tracking
    - CSRF protection implementation
  - **Authentication State Management** (Issue #15)
    - Zustand store for auth state with persistence
    - Automatic token refresh before expiration
    - User profile data management
    - Loading and error state handling
  - **Authentication UI Components** (Issue #16)
    - Login button with loading states
    - Logout functionality
    - User profile dropdown with avatar
    - Authentication status indicator in header
  - **Protected Routes** (Issue #17)
    - AuthGuard component for route protection
    - Graceful loading states during auth check
    - Fallback UI for unauthenticated users
    - HOC wrapper for page-level protection
  - **API Service Layer** (Issue #18)
    - Axios client with request/response interceptors
    - Automatic token refresh on 401 errors
    - Type-safe Inoreader API methods
    - Error handling and retry logic
  - **Rate Limiting** (Issue #19)
    - 100 calls/day tracking for Inoreader API
    - Usage statistics and warnings
    - Daily reset at midnight UTC
    - Persistent usage tracking

### Technical Implementation

- **Security**: OAuth 2.0 flow with state validation, httpOnly cookies, CSRF protection
- **UI Components**: Radix UI primitives for dropdown and avatar
- **HTTP Client**: Axios with automatic retry and token refresh
- **Dependencies**: Added axios, @radix-ui/react-dropdown-menu, @radix-ui/react-avatar

### User Experience

- **Seamless Authentication**: One-click Inoreader connection
- **Persistent Sessions**: Auth state survives browser refresh
- **Auto Token Refresh**: No manual re-authentication needed
- **Clear Status**: User profile visible when authenticated
- **Protected Content**: Main app requires authentication

### Next Milestone

- IndexedDB data storage implementation (Issue #7)
- Article fetching and display (Epic 2)

## [0.2.0] - 2025-01-06

### Added

- **Complete PWA Foundation** (Issue #5: US-001 Initial App Setup)
  - **PWA Manifest & Service Worker** (Issue #9)
    - Progressive Web App manifest with proper configuration
    - Service worker with Workbox integration for caching strategies
    - Offline-first architecture with multiple cache layers
    - PWA installability on mobile and desktop devices
  - **PWA Icons & Assets** (Issue #10)
    - High-quality RSS icon with orange gradient design
    - Complete icon set: 192x192, 512x512, favicons, Apple touch icons
    - Theme color integration (#FF6B35) across manifest and metadata
  - **App Layout & Navigation** (Issue #12)
    - Responsive header with hamburger menu and sync controls
    - Slide-out navigation sidebar with feed list
    - Complete theme system (light/dark/system) with smooth transitions
    - Mobile-first responsive design with touch-friendly interactions
    - Clean article list layout following Reeder 5 design principles
  - **Offline Caching Strategy** (Issue #11)
    - Multi-layered caching: static assets, API responses, images
    - Network status detection and visual indicators
    - Offline action queue with retry logic for sync operations
    - Cache management utilities with size tracking
    - Graceful offline fallbacks

### Technical Implementation

- **State Management**: Zustand stores for UI, sync, and theme state
- **Caching**: Workbox with Cache First, Network First, and Stale While Revalidate strategies
- **Performance**: 87.1 kB total bundle size, optimized for fast loading
- **Build Quality**: TypeScript strict mode, ESLint compliance, production build success
- **Mobile Support**: Responsive design with proper viewport configuration

### User Experience

- **Installation**: PWA can be installed on home screen across platforms
- **Offline Reading**: Full functionality without internet connection
- **Theme Switching**: Seamless light/dark mode with system preference support
- **Visual Feedback**: Clear indicators for read/unread articles, sync status, and network state
- **Touch Interactions**: Mobile-optimized navigation and touch targets

### Performance Metrics

- **First Load**: ~87 kB compressed JavaScript bundle
- **Static Generation**: All pages pre-rendered for optimal performance
- **Caching**: Intelligent resource caching for offline functionality
- **Loading**: Target <2s initial load, <0.5s navigation

## [0.1.0] - 2025-01-06

### Added

- **Development Environment** (Issue #2)
  - Environment variables template with Inoreader OAuth setup (3 values)
  - Enhanced npm scripts for development workflow
  - Pre-commit quality gates (type-check, lint, format)
  - Development setup documentation
  - Clean, format, and debug scripts
- **Project Infrastructure** (Issue #1)

  - GitHub Project board with custom fields and automation
  - Issue templates and labels system
  - Automated project workflow for issue management
  - Milestone planning for 12-week development cycle

- **Next.js Foundation** (Issue #8)
  - Next.js 14 with App Router configuration
  - TypeScript 5+ with strict mode
  - Tailwind CSS v3+ with Typography plugin
  - ESLint and Prettier configuration
  - Basic project structure and dependencies

### Technical Details

- **Quality Gates**: All builds pass type-check, lint, and format validation
- **Development Scripts**:
  - `npm run dev:debug` - Development with Node.js debugger
  - `npm run dev:turbo` - Development with Turbo mode
  - `npm run pre-commit` - Complete quality check pipeline
  - `npm run clean` - Clean build artifacts and cache
- **Documentation**: Comprehensive setup guide in `docs/development-setup.md`

### Environment

- Node.js 18.17+ required
- Environment variables: Inoreader Client ID/Secret, Anthropic API key
- Development port: 3000 (configurable)

### Next Milestone

Epic 1: Foundation & Authentication - PWA implementation starting with Issue #5 (US-001: Initial App Setup)
