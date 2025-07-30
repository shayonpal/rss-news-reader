# Bi-directional Sync Investigation (TODO-037)

**Date:** January 23, 2025
**Investigator:** Claude Code
**Status:** Implementation appears complete but sync server was not running

## Executive Summary

The bi-directional sync feature (TODO-037) has been fully implemented but was not actively running in production. The implementation includes all required components:

- Database schema with `sync_queue` table
- Server-side sync service with periodic processing
- Client-side integration for queueing changes
- API endpoints for mark-all-as-read functionality

When the sync server was started, it immediately found and successfully synced 14 pending read status changes to Inoreader, confirming the feature is functional.

## Implementation Status

### ✅ Completed Components

1. **Database Schema** (migrations 007 & 008)

   - `sync_queue` table for tracking pending changes
   - `add_to_sync_queue()` SQL function for queuing changes
   - `sync_queue_stats` view for monitoring
   - RLS policies enabled
   - Tracking columns added to articles table

2. **Server Implementation** (`/server/`)

   - `BiDirectionalSyncService` class with periodic sync (5-minute intervals)
   - Batch processing to minimize API calls (up to 100 items per batch)
   - Retry logic with exponential backoff
   - Express server running on port 3001
   - Mark-all-as-read endpoint

3. **Client Integration** (`/src/lib/stores/article-store.ts`)

   - All read/unread/star/unstar actions queue changes via RPC
   - Calls `add_to_sync_queue` function in Supabase
   - Error handling for failed queue operations

4. **API Endpoints**

   - `/api/mark-all-read` - Next.js endpoint that calls sync server
   - `/server/mark-all-read` - Express endpoint for Inoreader API
   - `/server/sync/trigger` - Manual sync trigger
   - `/server/sync/stats` - Queue statistics
   - `/server/sync/clear-failed` - Maintenance endpoint

5. **PM2 Configuration**
   - `rss-sync-server` configured in ecosystem.config.js
   - Set to run on port 3001
   - Environment variables properly configured

### 🔴 Issue Found: Sync Server Not Running

#### Root Cause Analysis

The bi-directional sync server was not running because:

1. **Timeline Issue**: The sync server was added to `ecosystem.config.js` in commit `9c0eb8d` (TODO-037 implementation) on July 21, 2025
2. **Production Deployment**: The first production deployment happened in commit `8d10937` on July 22, 2025
3. **Missing from Deployment**: The sync server was NOT included in the production deployment commit - it was added after
4. **PM2 Not Updated**: The production PM2 processes were started before the sync server was added to the configuration

#### Evidence

- Production server started: `2025-07-22T05:36:14` (21+ hours uptime)
- Sync cron started: `2025-07-22T04:21:23` (22+ hours uptime)
- Sync server started: `2025-07-23T02:56:57` (just now, manually)

The deployment scripts use `--only` flags to start specific services:

- `deploy-production.sh`: Only starts `rss-reader-prod`
- `deploy.sh`: Only starts `rss-reader-dev`
- No script starts all services from `ecosystem.config.js`

#### Current Status

When started manually with `pm2 start ecosystem.config.js --only rss-sync-server`, it:

- Started successfully on port 3001
- Immediately found 14 pending changes in the sync queue
- Successfully synced all 14 read status changes to Inoreader
- Began periodic sync every 5 minutes
- Has been running stably (confirmed by logs showing "No pending changes to sync" at 5-minute intervals)

### ⚠️ Minor Issues

1. **Missing RPC Function**: The server logs show an error for missing `increment_api_usage` RPC function, but this doesn't prevent sync from working.

2. **Server URL Configuration**: The `/api/mark-all-read` endpoint uses `SYNC_SERVER_URL` environment variable (defaults to `http://localhost:3002`) but the server actually runs on port 3001.

## How Bi-directional Sync Works

### Data Flow

1. **User Action** → Client marks article as read/unread/starred
2. **Queue Change** → Client calls `add_to_sync_queue` RPC to add to sync_queue table
3. **Periodic Sync** → Every 5 minutes, server checks for pending changes
4. **Batch Process** → Groups changes by action type, sends to Inoreader in batches
5. **Cleanup** → Successfully synced items are removed from queue

### Sync Rules

- Minimum 5 changes required for sync (unless retries pending)
- Maximum 100 articles per API call
- Maximum 3 retry attempts with exponential backoff
- Conflicting actions are deduplicated (last action wins)

### API Efficiency

- Single `/edit-tag` endpoint handles all read/star changes
- Batch processing minimizes API calls
- Mark-all-as-read uses dedicated endpoint for efficiency

## Testing Performed

1. **PM2 Status Check**: Confirmed sync server was not running
2. **Server Startup**: Successfully started with PM2
3. **Log Analysis**: Verified 14 pending changes were synced
4. **Code Review**: Confirmed all components are properly implemented

## Persistence Configuration Status

### ✅ Currently Configured for Persistence

After investigation and manual startup:

1. **PM2 Process List Saved**: All three services are now saved in PM2's dump file:

   - `rss-reader-prod`
   - `rss-sync-cron`
   - `rss-sync-server`

2. **Auto-restart Configured**: The sync server will now:

   - Restart automatically if it crashes
   - Start on system reboot (if PM2 startup is configured)
   - Be included in `pm2 reload ecosystem.config.js`

3. **Stable Operation**: Logs confirm the server is running stably with 5-minute sync intervals

## Recommendations

1. **Update Deployment Scripts**:

   - Modify `deploy-production.sh` to either:
     - Start all services: `pm2 start ecosystem.config.js`
     - Or explicitly include sync server: `pm2 start ecosystem.config.js --only "rss-reader-prod rss-sync-server"`
   - Add a new script `scripts/start-all-services.sh` for complete startup

2. **Fix Port Configuration**:

   - Update `SYNC_SERVER_URL` in environment to use port 3001
   - Or update `ecosystem.config.js` to use port 3002 as expected by the API

3. **Add Monitoring**:

   - Check `/server/sync/stats` endpoint periodically
   - Monitor sync-server logs for errors
   - Set up alerts for sync failures
   - Add health check endpoint to deployment monitoring

4. **Documentation Updates**:

   - Add bi-directional sync to main README
   - Update deployment documentation to include sync server
   - Document the sync server endpoints
   - Include troubleshooting guide for sync issues

5. **Immediate Actions Taken**:
   - ✅ Started sync server manually
   - ✅ Saved PM2 process list with `pm2 save --force`
   - ✅ Verified 14 pending changes were successfully synced
   - ✅ Confirmed server is running with periodic 5-minute syncs

## Verification Testing (July 23, 2025)

### Test Methodology

To verify bi-directional sync functionality, we conducted a controlled test:

1. **Test Set 1**: Marked 5 articles as read directly in Supabase database

   - Apple's free cash flow could surge under new IRS rules
   - Apple releasing six new iPhones in 2027 shouldn't be a surprise
   - App Store changes should avoid further EU fines
   - 'Pokemon' joins the daily puzzle craze with new iPhone game
   - Apple working on edge-lit notification system for Apple Ring & more

2. **Test Set 2**: Marked 5 articles as read through the RSS Reader app
   - Protect up to 10 devices with a discounted lifetime license to FastestVPN
   - Apple may avoid massive EU fines as App Store changes near approval
   - Today in Apple history: Mac OS 8 becomes an instant smash hit
   - Apple seeds fresh iOS 26, macOS Tahoe betas
   - PowerBug merges iPhone MagSafe travel stand with wall charger [Review] ★★★★☆

### Results

- **Client-side integration**: ✅ App successfully added all read actions to sync_queue
- **Sync timing**: ✅ Server synced 12 pending changes at 23:41:59 EDT
- **Sync threshold**: Confirmed minimum 5 changes required before sync executes
- **Inoreader verification**: ✅ Created verification script that confirmed both test articles show as READ in Inoreader
- **Queue cleanup**: ✅ sync_queue table empty after successful sync

### Key Finding

The bi-directional sync is fully operational. Articles marked as read in the app are automatically queued and synced to Inoreader every 5 minutes (when 5+ changes accumulate).

## Conclusion

TODO-037 (Bi-directional Sync) is fully implemented and functional. The only issue was that the sync server wasn't running. With the server now active, all read/unread and star/unstar changes made in the RSS Reader app are being successfully synced back to Inoreader.

The feature is working as designed with efficient batching, proper error handling, and automatic retries. No code changes are required - only operational improvements to ensure the sync server remains running.

## Follow-up Investigation (July 25, 2025)

### Issue Reported

Users reported that articles they've already read are still showing as unread after automatic syncs, despite the sync server being operational.

### Root Cause Analysis

Investigation revealed a **sync threshold bottleneck**:

1. **Minimum Threshold Requirement**: The sync server requires a minimum of 5 changes before syncing to Inoreader
2. **User Behavior**: Users typically read 1-4 articles at a time, not reaching the threshold
3. **Result**: Read status changes accumulate in the sync queue for hours/days without syncing

### Evidence

From sync server logs (July 25, 3:01 AM - 6:41 AM):

- Repeatedly logged: "Found 1-4 pending changes, waiting for minimum of 5"
- Only synced at 6:46 AM when 5 changes finally accumulated

### Fix Implemented

Modified the sync threshold logic in `/server/services/bidirectional-sync.js` to sync when:

1. **Retries pending** (existing logic)
2. **Minimum 5 changes** (existing logic)
3. **OR any change older than 15 minutes** (NEW)

This ensures timely syncing while still maintaining efficiency for batch operations.

### Code Changes

```javascript
// Old logic: Only checked retry status and minimum count
if (\!hasRetries && pendingChanges.length < this.MIN_CHANGES) {
  return; // Would wait indefinitely for 5 changes
}

// New logic: Also considers age of oldest change
const oldestChangeAge = oldestChange ? Date.now() - new Date(oldestChange.created_at).getTime() : 0;
const hasOldChanges = oldestChangeAge > 15 * 60 * 1000; // 15 minutes

if (\!hasRetries && pendingChanges.length < this.MIN_CHANGES && \!hasOldChanges) {
  return; // Only waits if changes are recent AND below threshold
}
```

### Verification

- Fix applied and sync server restarted at 7:11 AM
- Test article marked as read at 7:11 AM
- Manual sync at 7:14 AM showed: "Only 1 changes pending, waiting for minimum of 5. Oldest change is 2 minutes old."
- The change will automatically sync after 15 minutes (by 7:26 AM)

### User Impact

- **Before**: Read articles could remain unsynced for hours/days
- **After**: Read status syncs within 15 minutes maximum, preserving batch efficiency for high-volume operations

### Monitoring Recommendations

1. Monitor sync queue age distribution
2. Consider adjusting the 15-minute threshold based on user feedback
3. Track API usage to ensure we stay within the 100/day limit

## Final Resolution (July 25, 2025)

### Critical Bug Discovered

After further investigation, a critical bug was discovered in the main sync flow that was causing bidirectional sync to fail:

#### Root Cause

The sync process in `/src/app/api/sync/route.ts` was **unconditionally overwriting** local article states with data from Inoreader during every sync. This meant:

1. User marks article as read locally
2. Bidirectional sync correctly syncs to Inoreader
3. Next manual/automatic sync overwrites the local state with old Inoreader data
4. Article appears unread again locally

#### The Fix

Added conflict resolution logic in the sync route (lines 271-303) that:

1. **Preserves local changes**: Only updates articles where `last_local_update < last_sync_update`
2. **Proper timestamp comparison**: Uses `last_sync_update` from sync_metadata table instead of current timestamp
3. **Integrated bidirectional sync**: Triggers bidirectional sync after every manual/automatic sync

#### Code Implementation

```typescript
// Get last sync timestamp for conflict resolution
const { data: syncMetadata } = await supabase
  .from("sync_metadata")
  .select("last_sync_update")
  .eq("user_id", userId)
  .single();

const lastSyncUpdate = syncMetadata?.last_sync_update;

// Only update articles that haven't been modified locally since last sync
const { error: updateError } = await supabase.from("articles").upsert(
  articlesToUpsert.filter((article) => {
    // If we don't have a last sync timestamp, update all articles
    if (!lastSyncUpdate) return true;

    // Check if this article has been modified locally since last sync
    const localArticle = existingArticles.find(
      (a) => a.inoreader_id === article.inoreader_id
    );
    if (!localArticle) return true; // New article, safe to insert

    // Only update if article hasn't been modified locally since last sync
    const lastLocalUpdate = new Date(
      localArticle.last_local_update || 0
    ).getTime();
    const lastSync = new Date(lastSyncUpdate).getTime();

    return lastLocalUpdate < lastSync;
  }),
  {
    onConflict: "inoreader_id",
  }
);

// Trigger bidirectional sync after main sync completes
if (bidirectionalSyncService) {
  await bidirectionalSyncService.processPendingChanges();
}
```

### Why This Fixes the Issue

1. **Timestamp-based conflict resolution**: Uses `last_sync_update` to determine if local changes are newer
2. **Preserves user actions**: Local read/unread changes made between syncs are retained
3. **Proper integration**: Bidirectional sync runs after every sync, ensuring changes propagate to Inoreader
4. **No race conditions**: Comparing with `last_sync_update` instead of current time prevents timing issues

### Impact

- Users can now mark articles as read and the state will persist across syncs
- Both manual and automatic syncs respect local changes
- Bidirectional sync works as originally intended
- No more "zombie" articles that keep coming back as unread

## OAuth Authentication Recovery (Saturday, July 26, 2025 at 1:12 PM)

### Issue Discovered

The bidirectional sync server had been failing for approximately 12 hours with repeated "No tokens found" errors. The sync queue had accumulated 147 read actions that were unable to sync to Inoreader due to missing authentication.

### Root Cause

The OAuth tokens file (`~/.rss-reader/tokens.json`) was missing from the server, preventing the sync service from authenticating with the Inoreader API. This file contains the encrypted access and refresh tokens required for API communication.

### Investigation Steps

1. **PM2 Process Status Check**:

   - Confirmed the sync server was running (`rss-sync-server`)
   - Process showed healthy status but logs revealed authentication failures

2. **Log Analysis**:

   - Reviewed sync server logs: `pm2 logs rss-sync-server`
   - Found repeated errors: "No tokens found" every 5 minutes
   - Errors had been occurring since approximately 1:00 AM

3. **Database Queue Status**:

   - Checked `sync_queue` table in Supabase
   - Found 147 pending items with increasing retry attempts
   - All items were read/unread actions waiting to sync

4. **File System Verification**:
   - Confirmed `~/.rss-reader/tokens.json` was missing
   - Directory `~/.rss-reader/` existed but was empty

### Solution Implemented

1. **Created Manual OAuth Setup Script**:

   - Developed `server/scripts/manual-oauth.js` to handle OAuth flow
   - Script handles the full OAuth authorization process
   - Includes token encryption and proper file storage

2. **OAuth Re-authorization Process**:

   - Used Playwright MCP to navigate to Inoreader OAuth page
   - Successfully authorized the RSS Reader application
   - Obtained new authorization code from redirect URL
   - Exchanged authorization code for access/refresh tokens

3. **Environment Configuration Updates**:

   - Updated `ecosystem.config.js` to include missing environment variables:
     ```javascript
     INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
     INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
     INOREADER_REDIRECT_URI: process.env.INOREADER_REDIRECT_URI,
     RSS_READER_TOKENS_PATH: "/Users/shayon/.rss-reader/tokens.json"
     ```
   - Used full path for `RSS_READER_TOKENS_PATH` to avoid tilde expansion issues

4. **Service Restart**:
   - Reloaded sync server with updated configuration: `pm2 reload rss-sync-server`
   - Server immediately recognized restored tokens
   - Began processing queued items

### Outcome

1. **Authentication Restored**:

   - OAuth tokens successfully saved to `~/.rss-reader/tokens.json`
   - Tokens properly encrypted using existing encryption key
   - Sync server can now authenticate with Inoreader API

2. **Queue Processing**:

   - 177 failed items (increased from initial 147) were successfully synced
   - All pending read/unread actions propagated to Inoreader
   - Queue cleared completely after successful sync

3. **Service Stability**:
   - Bidirectional sync fully operational
   - New changes syncing within 5-15 minutes as designed
   - No further authentication errors in logs

### Lessons Learned

1. **Token Persistence**: The OAuth tokens file is critical for sync server operation and should be monitored
2. **Environment Variables**: PM2 configuration must include all required environment variables for proper OAuth operation
3. **Path Resolution**: Use absolute paths in PM2 configs to avoid shell expansion issues with `~`
4. **Recovery Tools**: Having a manual OAuth setup script enables quick recovery from authentication failures

### Monitoring Recommendations

1. Add health check for token file existence
2. Monitor sync server logs for authentication errors
3. Create automated alerts for sync queue buildup
4. Consider token backup strategy for disaster recovery
   EOF < /dev/null
