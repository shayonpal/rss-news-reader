# User Flow Diagrams - Shayon's News

## Overview
This document contains the technical user flow diagrams for the RSS Reader PWA, showing all possible paths users can take through the application.

## Primary User Flows

### 1. First Time Setup Flow
```
App Launch
    ↓
Check Auth Status
    ↓
No Auth Found
    ↓
Welcome Screen
    ↓
Connect Inoreader Button
    ↓
OAuth Flow → Inoreader Login
    ↓
Return to App with Token
    ↓
Initial Sync
    ├─ Success → Show Article List
    └─ Failure → Show Error + Retry Option
```

### 2. Regular App Launch Flow
```
App Launch
    ↓
Check Auth Status
    ↓
Auth Found
    ↓
Check Network Status
    ├─ Online → Check Last Sync Time
    │   ├─ > 6 hours → Auto Sync → Article List
    │   └─ < 6 hours → Article List
    └─ Offline → Show Cached Content + Offline Banner
```

### 3. Article Reading Flow
```
Article List
    ↓
Tap Article
    ↓
Load Article Detail
    ↓
Check Content Status
    ├─ Full Content Available → Display Article
    └─ Partial Content → Display Partial + "Fetch Full Content" Button
        ↓
    User Actions:
    ├─ Read → Mark as Read → Update UI
    ├─ Swipe Left → Previous Article
    ├─ Swipe Right → Next Article
    └─ Back → Return to List (maintain scroll position)
```

### 4. Manual Sync Flow
```
Article List View
    ↓
Pull to Refresh OR Tap Sync Button
    ↓
Check Network Status
    ├─ Online → Check API Limit
    │   ├─ Under Limit → Start Sync
    │   │   ↓
    │   │   Fetch Updates (max 100 articles)
    │   │   ↓
    │   │   Update UI Incrementally
    │   │   ↓
    │   │   Show Result: "X new articles"
    │   └─ Over Limit → Show Warning
    └─ Offline → Show "No Connection" Message
```

### 5. AI Summarization Flow
```
Article Detail View
    ↓
Check Summary Status
    ├─ Summary Exists → Show Summary + "Re-summarize" Button
    └─ No Summary → Show "Summarize" Button
        ↓
    Tap Summarize/Re-summarize
        ↓
    Check Network Status
        ├─ Online → Send to Claude API
        │   ├─ Success → Display Summary
        │   │   └─ Update List View
        │   └─ Failure → Show Error + Retry
        └─ Offline → Show "Connection Required"
```

### 6. Folder/Feed Navigation Flow
```
Feed List (Sidebar/Drawer)
    ↓
Display Structure:
├─ All Articles (with unread count)
├─ Folder 1 ▼ (expanded)
│   ├─ Feed A (10)
│   └─ Feed B (5)
└─ Folder 2 ▶ (collapsed)
    ↓
User Actions:
├─ Tap Folder → Toggle Expand/Collapse
├─ Tap Feed → Filter Article List
└─ Tap "All Articles" → Show All
```

### 7. Settings Flow
```
Settings Screen
    ↓
Display Options:
├─ Inoreader Account
│   ├─ Connected: Show Email + Disconnect Option
│   └─ Disconnected: Show Connect Button
├─ Theme
│   └─ Auto/Light/Dark Toggle
├─ Sync Settings
│   └─ Last Sync Time + Manual Sync Button
└─ API Usage
    └─ Link to Dashboard
        ↓
    API Dashboard:
    ├─ Inoreader Calls Today: X/100
    ├─ AI Summaries Today: X
    └─ Historical Graph
```

### 8. Offline to Online Transition Flow
```
Offline State (Cached Content Displayed)
    ↓
Network Becomes Available
    ↓
Auto-detect Connection
    ↓
Process Queued Actions:
├─ Sync Read/Unread States
├─ Check for New Articles
└─ Update UI Indicators
    ↓
Remove Offline Banner
```

### 9. Error Handling Flows

#### API Rate Limit Error
```
API Call
    ↓
429 Rate Limit Error
    ↓
Show Warning: "API limit reached. Try again tomorrow."
    ↓
Disable Sync Functions
    ↓
Display Cached Content Only
```

#### Network Error
```
Network Request
    ↓
Connection Failed
    ↓
Retry with Backoff (3 attempts)
    ├─ Success → Continue Flow
    └─ All Failed → Show Error Message
        └─ "Check your connection and try again"
```

#### Content Parsing Error
```
Fetch Full Content
    ↓
Parse with Readability
    ├─ Success → Display Clean Content
    └─ Failure → Show Original + Warning
        └─ "Could not parse article. Showing original."
```

## State Diagrams

### Article States
```
NEW (Unread)
    ↓ Open Article
READING
    ↓ Close or Mark Read
READ
    ↔ Toggle Read/Unread
UNREAD
```

### Sync States
```
IDLE
    ↓ Trigger Sync
SYNCING
    ├─ Success → IDLE
    ├─ Partial → IDLE (with warning)
    └─ Failure → ERROR
        └─ Retry → SYNCING
```

### Summary States
```
NO_SUMMARY
    ↓ Request Summary
GENERATING
    ├─ Success → HAS_SUMMARY
    └─ Failure → ERROR
        └─ Retry → GENERATING
HAS_SUMMARY
    ↓ Re-summarize
GENERATING
```

## Navigation Hierarchy

```
Root
├─ Feed List (Drawer/Sidebar)
├─ Article List (Main View)
│   └─ Article Detail
│       ├─ Summarize Action
│       └─ Fetch Content Action
├─ Settings
│   └─ API Dashboard
└─ PWA Install Prompt
```

## Decision Points

1. **Network Status Check**
   - Online → Proceed with network operations
   - Offline → Use cached data only

2. **Auth Status Check**
   - Authenticated → Load user data
   - Not authenticated → Show setup flow

3. **Content Type Check**
   - Full content → Display immediately
   - Partial content → Show fetch option

4. **API Limit Check**
   - Under limit → Allow operation
   - Near limit (80%) → Show warning
   - Over limit (95%) → Block operation

5. **Sync Timing Check**
   - Last sync > 6 hours → Auto sync
   - Last sync < 6 hours → Skip auto sync

## Edge Cases

1. **Mid-sync Connection Loss**
   - Save partial results
   - Queue remaining operations
   - Show partial success message

2. **Expired Inoreader Token**
   - Detect 401 error
   - Prompt re-authentication
   - Preserve local data

3. **Storage Limit Reached**
   - Trigger immediate pruning
   - Remove oldest articles first
   - Notify user if critical

4. **Simultaneous Sync Requests**
   - Queue subsequent requests
   - Show "Sync in progress"
   - Prevent duplicate operations