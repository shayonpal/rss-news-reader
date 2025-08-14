# User Flow Diagrams - Shayon's News

## Overview

This document contains the technical user flow diagrams for the RSS Reader PWA, showing all possible paths users can take through the application. The system uses a server-client architecture where the server handles all Inoreader communication and the client reads from Supabase.

## System Architecture Overview

```
[Inoreader API] ← → [Mac Mini Server]
                           |
                           ├─→ [Sync Service] → [Supabase]
                           |                         ↑
                           └─→ [API Routes]          |
                                    ↑                ↓
                              [Client PWA via Tailscale]
                              http://100.96.166.53/reader
```

## Initial Server Setup

### Server OAuth Setup Flow (One-Time Process)

```
Run OAuth Setup Script on Mac Mini (npm run setup:oauth)
    ↓
Script Starts Components:
    ├─ Express server on localhost:8080
    ├─ Playwright browser instance
    └─ OAuth callback handler ready
        ↓
Playwright Navigates to Inoreader OAuth
    ├─ URL: https://www.inoreader.com/oauth2/authorize
    ├─ client_id: [from .env]
    ├─ redirect_uri: http://localhost:8080/auth/callback
    └─ scope: read write
        ↓
Playwright Auto-fills Credentials
    ├─ Username: [from .env TEST_INOREADER_EMAIL]
    ├─ Password: [from .env TEST_INOREADER_PASSWORD]
    └─ Submits login form
        ↓
Playwright Clicks "Authorize" Button
    ↓
Inoreader Redirects to localhost:8080/auth/callback
    ├─ Express server captures auth code
    └─ Validates state parameter
        ↓
Server Exchanges Code for Tokens
    ├─ POST to Inoreader token endpoint
    ├─ Receives access_token and refresh_token
    └─ Validates token response
        ↓
Store Tokens Securely
    ├─ Encrypt tokens
    ├─ Save to ~/.rss-reader/tokens.json
    ├─ Set file permissions (600)
    └─ Close Playwright browser
        ↓
Setup Complete
    ├─ Display success message
    ├─ Show token info
    └─ Terminate Express server
```

**Error Handling**:

- Invalid authorization code → Retry OAuth flow
- Token exchange failure → Check client credentials
- File write error → Check permissions
- Encryption failure → Fall back to AES-256

## Primary User Flows

### 1. First Time Access Flow (No Client Auth)

```
User Navigates to http://100.96.166.53/reader
    ↓
Tailscale Network Check
    ├─ On Tailscale → Load PWA
    └─ Not on Tailscale → Connection Error
        ↓
Load PWA Client
    ↓
Check Supabase Connection
    ├─ Connected → Check for Articles
    │   ├─ Articles Exist → Show Article List
    │   └─ Empty → Show "No articles" + Sync Button
    └─ Connection Error → Show Error Message
```

### 2. Regular App Launch Flow

```
Access via Tailscale (http://100.96.166.53/reader)
    ↓
Load PWA from Server
    ↓
Connect to Supabase
    ↓
Load Articles from Supabase
    ├─ Articles Available → Display Article List
    └─ No Articles → Show Empty State
        └─ Display "Sync with Inoreader" Button
```

### 3. Article Reading Flow

```
Article List (from Supabase)
    ↓
Tap Article
    ↓
Load Article Detail from Supabase
    ↓
Check Content Type
    ├─ Full Content Exists → Display full_content field
    ├─ RSS Content Only → Display content field
    │   └─ Show "Fetch Full Content" Button
    └─ AI Summary Available → Show summary in header
        ↓
    User Actions:
    ├─ Mark Read/Unread → Update Supabase → Update UI
    ├─ Swipe Left → Previous Article
    ├─ Swipe Right → Next Article
    ├─ Fetch Full Content → Call Server API → Update Display
    ├─ Generate Summary → Call Server API → Update Display
    └─ Back → Return to List (maintain scroll position)
```

### 4. Manual Sync Flow (Server-Side Execution)

```
User Taps Sync Button in Client
    ↓
Client Calls POST /api/sync
    ↓
Server Receives Request
    ├─ Check Rate Limits (100 calls/day)
    │   ├─ Under Limit → Proceed
    │   └─ Over Limit → Return 429 Error
    ↓
Server Executes Sync:
    1. Call Inoreader /subscription/list (1 call)
    2. Call Inoreader /tag/list (1 call)
    3. Call Inoreader /stream/contents (1 call, max 100 articles)
    4. Call Inoreader /unread-count (1 call)
    5. Write all data to Supabase
    ↓
Return syncId to Client
    ↓
Client Polls GET /api/sync/status/:syncId
    ├─ Status: running → Show Progress
    ├─ Status: completed → Refresh from Supabase
    └─ Status: failed → Show Error + Retry
```

### 5. AI Summarization Flow (Server-Side)

```
Article Detail View
    ↓
Check ai_summary field in Supabase
    ├─ Summary Exists → Display Summary + "Re-summarize" Button
    └─ No Summary → Show "Summarize" Button
        ↓
    User Taps Summarize/Re-summarize
        ↓
    Client Calls POST /api/articles/:id/summarize
        ↓
    Server Processing:
    ├─ Fetch Article from Supabase
    ├─ Send to Anthropic Claude 4 Sonnet
    ├─ Generate 150-175 word summary
    ├─ Store Summary in Supabase
    └─ Return Summary to Client
        ↓
    Client Updates Display
    ├─ Success → Show Summary in Article View
    └─ Error → Show Error Message + Retry
```

### 6. Feed/Tag Navigation Flow

```
Feed List (Sidebar/Drawer)
    ↓
Two Tabs: "Feeds" | "Tags"
    ↓
Feeds Tab (Hierarchical):
├─ All Articles (total unread count)
├─ Folder 1 ▼ (folder unread count)
│   ├─ Feed A (10)
│   └─ Feed B (5)
└─ Folder 2 ▶ (collapsed)
    ↓
Tags Tab (Flat List):
├─ Tag 1 (15)
├─ Tag 2 (8)
└─ Tag 3 (22)
    ↓
User Actions:
├─ Switch Tabs → Load Different View
├─ Tap Folder → Toggle Expand/Collapse
├─ Tap Feed → Filter Articles by Feed (clear tag filter)
├─ Tap Tag → Filter Articles by Tag (clear feed filter)
└─ Tap "All Articles" → Clear All Filters

Note: Only one filter active at a time (feed OR tag, not both)
```

### 7. Settings Flow (Simplified - No Client Auth)

```
Settings Screen
    ↓
Display Options:
├─ Theme
│   └─ Light/Dark/System Toggle
├─ Sync Information
│   ├─ Last Sync: [timestamp from sync_metadata]
│   └─ Manual Sync Button → Triggers Server Sync
└─ About
    ├─ Version Information
    └─ Server Status (Tailscale connection)
```

### 8. Full Content Fetching Flow (Server-Side)

```
Article Detail View (RSS content only)
    ↓
User Taps "Fetch Full Content"
    ↓
Client Calls POST /api/articles/:id/fetch-content
    ↓
Server Processing:
├─ Fetch Article URL from Supabase
├─ Download Web Page
├─ Extract with Mozilla Readability
├─ Clean Content (remove ads/navigation)
├─ Store in full_content field
└─ Return Cleaned Content
    ↓
Client Updates Display
├─ Success → Replace RSS with Full Content
└─ Failure → Show Error + Keep RSS Content
```

### 9. Error Handling Flows

#### Tailscale Connection Error

```
User Attempts Access
    ↓
Not on Tailscale Network
    ↓
Show Error: "Access restricted to Tailscale network"
    ↓
Provide Instructions:
└─ "Connect to Tailscale VPN and try again"
```

#### Server API Error

```
Client API Call to Server
    ↓
Server Returns Error
    ├─ 429: "Daily sync limit reached (100 calls)"
    ├─ 500: "Server error. Please try again."
    └─ 503: "Sync service unavailable"
        ↓
    Display Error to User
    └─ Offer Retry (if applicable)
```

#### Supabase Connection Error

```
Client Attempts Supabase Read
    ↓
Connection Failed
    ↓
Show Error: "Cannot connect to database"
    ↓
Retry Automatically (3 attempts)
    ├─ Success → Load Data
    └─ Failed → Show Persistent Error
        └─ "Please check your connection"
```

## State Diagrams

### Article States (Stored in Supabase)

```
UNREAD (is_read = false)
    ↓ User Opens Article
READING (Client State Only)
    ↓ User Closes or Marks Read
READ (is_read = true in Supabase)
    ↔ User Toggles Read/Unread
UNREAD (is_read = false)
```

### Server Sync States

```
IDLE (No sync running)
    ↓ Client calls POST /api/sync
PENDING (syncId created)
    ↓ Server starts processing
RUNNING (Fetching from Inoreader)
    ├─ Success → COMPLETED → Update Supabase
    ├─ Partial → COMPLETED (with errors logged)
    └─ Failure → FAILED
        └─ Client can retry
```

### Content States

```
RSS_ONLY (content field only)
    ↓ Fetch Full Content
FETCHING (Server processing)
    ├─ Success → FULL_CONTENT (full_content field populated)
    └─ Failure → RSS_ONLY (with error)
```

### Summary States

```
NO_SUMMARY (ai_summary = null)
    ↓ Request Summary
GENERATING (Server calling Claude)
    ├─ Success → HAS_SUMMARY (ai_summary populated)
    └─ Failure → NO_SUMMARY (with error)
HAS_SUMMARY
    ↓ Re-summarize
GENERATING
```

## Navigation Hierarchy

```
Root (http://100.96.166.53/reader)
├─ Feed/Tag List (Drawer/Sidebar)
│   ├─ Feeds Tab (Hierarchical)
│   └─ Tags Tab (Flat List)
├─ Article List (Main View)
│   └─ Article Detail
│       ├─ Fetch Full Content (Server API)
│       ├─ Generate Summary (Server API)
│       └─ Mark Read/Unread (Supabase)
├─ Settings
│   ├─ Theme Toggle
│   └─ Sync Information
└─ PWA Install Prompt
```

## Decision Points

1. **Tailscale Network Check**
   - On Tailscale → Allow access
   - Not on Tailscale → Block access

2. **Supabase Connection Check**
   - Connected → Load articles
   - Disconnected → Show error

3. **Content Type Check**
   - full_content exists → Display full content
   - Only content exists → Display RSS + fetch button
   - ai_summary exists → Show summary

4. **Filter State Check**
   - No filter → Show all articles
   - Feed filter active → Show feed articles only
   - Tag filter active → Show tag articles only
   - Note: Filters are mutually exclusive

5. **Server API Availability**
   - Available → Allow sync/fetch/summarize
   - Rate limited → Block with message
   - Server down → Show error

## Edge Cases

1. **Server Sync Failures**
   - Partial sync → Log errors in sync_errors table
   - Continue with successful items
   - Show "X articles synced, Y failed"

2. **Tailscale Service Down**
   - Server auto-restarts Tailscale (sudo configured)
   - Client shows connection error
   - User must wait for service restoration

3. **Article Limit Reached (500)**
   - Server automatically prunes oldest articles
   - Maintains most recent 500
   - No user notification needed

4. **Simultaneous Sync Requests**
   - Server returns existing syncId if sync running
   - Client continues polling same syncId
   - Prevents duplicate Inoreader API calls

5. **Readability Extraction Fails**
   - Server returns error to client
   - Client continues showing RSS content
   - "Unable to fetch full content" message

6. **Claude API Errors**
   - Rate limit → Show "Summary limit reached"
   - API down → Show "Summary service unavailable"
   - Bad response → Allow retry with same prompt

## Server-Side Processes

### Automatic Daily Sync (Cron Job)

```
Cron Trigger (Every 24 hours)
    ↓
Server Sync Service Starts
    ↓
Check Inoreader Token
    ├─ Valid → Proceed
    └─ Expired → Refresh Token
        ↓
Execute Sync Sequence:
    1. Get feed/folder structure
    2. Get tag list
    3. Fetch articles (max 100)
    4. Get unread counts
    5. Write to Supabase
    ↓
Log Results
    ├─ Success → Update last_sync timestamp
    └─ Errors → Log to sync_errors table
```

### API Rate Limit Management

```
Each Sync Operation:
├─ /subscription/list (1 call)
├─ /tag/list (1 call)
├─ /stream/contents (1 call)
├─ /unread-count (1 call)
└─ Total: 4-5 calls per sync

Daily Budget:
├─ Auto sync: 5 calls
├─ Manual syncs: ~20 calls (4-5 syncs)
├─ Buffer: 75 calls
└─ Total: Well under 100 limit
```

## Data Flow Examples

### New Article Flow

```
1. Inoreader has new articles
2. Server sync fetches via API
3. Server writes to Supabase:
   - articles table (content, metadata)
   - Update feed unread_counts
   - Update tag unread_counts
4. Client refreshes from Supabase
5. New articles appear in list
```

### Read State Sync Flow

```
1. User marks article as read in client
2. Client updates Supabase is_read = true
3. Client updates local UI immediately
4. Next server sync:
   - Reads changed states from Supabase
   - Sends batch update to Inoreader
   - Confirms sync completion
```
