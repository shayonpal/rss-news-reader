# State Machine Diagrams - Shayon's News

## Overview

This document defines the state machines for critical processes in the RSS Reader PWA, helping ensure consistent behavior across different scenarios.

## 1. Main Application State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application States                        │
└─────────────────────────────────────────────────────────────────┘

                            ┌──────────┐
                            │  START   │
                            └────┬─────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   INITIALIZING  │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Check Auth Token        │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
        ┌──────────────┐                ┌──────────────┐
        │ UNAUTHORIZED │                │  AUTHORIZED  │
        └──────┬───────┘                └──────┬───────┘
               │                               │
               │ Connect to                    │
               │ Inoreader                     ▼
               │                      ┌─────────────────┐
               └─────────────────────►│     READY       │
                                      └────────┬────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
                  │   SYNCING    │    │   OFFLINE    │    │    ERROR     │
                  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
                         │                    │                    │
                         └────────────────────┴────────────────────┘
                                              │
                                              ▼
                                      Returns to READY
```

## 2. Sync Process State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                         Sync States                              │
└─────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │    IDLE     │◄─────────────┐
                        └──────┬──────┘              │
                               │                     │
                               │ Trigger Sync        │
                               │ (Manual/Auto)       │
                               ▼                     │
                        ┌─────────────┐              │
                        │  CHECKING   │              │
                        │   LIMITS    │              │
                        └──────┬──────┘              │
                               │                     │
                ┌──────────────┴──────────────┐     │
                │ API Calls < 95              │     │
                ▼                             ▼     │
        ┌─────────────┐              ┌─────────────┐│
        │ SYNCING    │              │ RATE_LIMITED││
        │  FEEDS     │              └──────┬──────┘│
        └──────┬──────┘                     │       │
               │                            │       │
               ▼                            └───────┘
        ┌─────────────┐
        │  FETCHING   │
        │  ARTICLES   │
        └──────┬──────┘
               │
               ├─── Network Error ──────┐
               │                        ▼
               │                 ┌─────────────┐
               │                 │   FAILED    │
               │                 └──────┬──────┘
               │                        │
               ▼                        │
        ┌─────────────┐                 │
        │  UPDATING   │                 │
        │   STATES    │                 │
        └──────┬──────┘                 │
               │                        │
               ├─── Partial Success ────┤
               │                        │
               ▼                        ▼
        ┌─────────────┐         ┌─────────────┐
        │  COMPLETE   │         │   PARTIAL   │
        └──────┬──────┘         └──────┬──────┘
               │                        │
               └────────┬───────────────┘
                        │
                        ▼
                ┌─────────────┐
                │  NOTIFYING  │
                │    USER     │
                └──────┬──────┘
                       │
                       └─────────► IDLE
```

## 3. Article Summary Generation State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Summary Generation States                     │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │ NO_SUMMARY  │◄──────────────┐
                    └──────┬──────┘               │
                           │                      │
                           │ User taps ⚡          │ Re-summarize
                           ▼                      │
                    ┌─────────────┐               │
                    │  CHECKING   │               │
                    │   NETWORK   │               │
                    └──────┬──────┘               │
                           │                      │
            ┌──────────────┴──────────────┐      │
            │ Online                      │      │
            ▼                             ▼      │
    ┌─────────────┐              ┌─────────────┐ │
    │ GENERATING  │              │  DISABLED   │ │
    └──────┬──────┘              └─────────────┘ │
           │                                      │
           ├─── Timeout (30s) ────┐              │
           │                      ▼              │
           │              ┌─────────────┐        │
           │              │   TIMEOUT   │        │
           │              └──────┬──────┘        │
           │                     │               │
           ├─── API Error ───────┤               │
           │                     ▼               │
           │              ┌─────────────┐        │
           │              │    ERROR    │────────┘
           │              └──────┬──────┘
           │                     │
           │                     │ Retry
           ▼                     │
    ┌─────────────┐              │
    │  GENERATED  │              │
    └──────┬──────┘              │
           │                     │
           ├─────────────────────┘
           │
           ▼
    ┌─────────────┐
    │ HAS_SUMMARY │
    └─────────────┘
```

## 4. Article Content Fetching State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                   Content Fetching States                        │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   PARTIAL   │
                    │   CONTENT   │
                    └──────┬──────┘
                           │
                           │ User taps
                           │ "Fetch Full Content"
                           ▼
                    ┌─────────────┐
                    │  FETCHING   │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  SUCCESS    │ │   NETWORK   │ │   PARSE     │
    │             │ │    ERROR    │ │   ERROR     │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           │               └───────┬───────┘
           ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │    FULL     │         │   FAILED    │
    │   CONTENT   │         │  (PARTIAL)  │
    └─────────────┘         └─────────────┘
```

## 5. Network Connection State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Network Connection States                     │
└─────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │   ONLINE    │◄─────┐
                        └──────┬──────┘      │
                               │             │
                               │ Connection  │ Connection
                               │ Lost        │ Restored
                               ▼             │
                        ┌─────────────┐      │
                        │  OFFLINE    │──────┘
                        └──────┬──────┘
                               │
                               ├─── Actions Queued
                               │
                               ▼
                        ┌─────────────┐
                        │   QUEUED    │
                        │  ACTIONS    │
                        └─────────────┘

When ONLINE → OFFLINE:
- Disable sync buttons
- Disable summary generation
- Show offline indicator
- Enable action queuing

When OFFLINE → ONLINE:
- Process queued actions
- Enable sync buttons
- Enable summary generation
- Remove offline indicator
- Auto-sync if needed
```

## 6. Read/Unread Status State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Article Read Status States                    │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   UNREAD    │◄───────┐
                    └──────┬──────┘        │
                           │               │
                           │ Open or       │ Mark as
                           │ Mark Read     │ Unread
                           ▼               │
                    ┌─────────────┐        │
                    │  MARKING    │        │
                    └──────┬──────┘        │
                           │               │
                           ▼               │
                    ┌─────────────┐        │
                    │    READ     │────────┘
                    └──────┬──────┘
                           │
                           │ If Offline
                           ▼
                    ┌─────────────┐
                    │   QUEUED    │
                    │  FOR SYNC   │
                    └──────┬──────┘
                           │
                           │ When Online
                           ▼
                    ┌─────────────┐
                    │   SYNCED    │
                    └─────────────┘
```

## State Transition Rules

### Application State Rules

1. **INITIALIZING → UNAUTHORIZED**: No valid auth token found
2. **INITIALIZING → AUTHORIZED**: Valid auth token exists
3. **UNAUTHORIZED → READY**: Successful Inoreader OAuth
4. **READY → SYNCING**: Manual sync or auto-sync timer
5. **READY → OFFLINE**: Network connection lost
6. **READY → ERROR**: Unrecoverable error occurred
7. **ANY STATE → READY**: Error recovery or network restoration

### Sync State Rules

1. **IDLE → CHECKING_LIMITS**: Sync triggered (manual or auto)
2. **CHECKING_LIMITS → SYNCING_FEEDS**: API calls < 95
3. **CHECKING_LIMITS → RATE_LIMITED**: API calls ≥ 95
4. **SYNCING_FEEDS → FETCHING_ARTICLES**: Feed list obtained
5. **FETCHING_ARTICLES → UPDATING_STATES**: Articles fetched
6. **FETCHING_ARTICLES → FAILED**: Network error
7. **UPDATING_STATES → COMPLETE**: All updates successful
8. **UPDATING_STATES → PARTIAL**: Some updates failed
9. **ANY_FINAL_STATE → IDLE**: After user notification

### Summary Generation Rules

1. **NO_SUMMARY → CHECKING_NETWORK**: User taps ⚡
2. **CHECKING_NETWORK → GENERATING**: Online
3. **CHECKING_NETWORK → DISABLED**: Offline
4. **GENERATING → GENERATED**: Success (< 30s)
5. **GENERATING → TIMEOUT**: > 30s elapsed
6. **GENERATING → ERROR**: API error
7. **ERROR/TIMEOUT → GENERATING**: User retries
8. **HAS_SUMMARY → GENERATING**: User taps 🔄

## Error Handling State Patterns

### Retry Pattern

```
ERROR → RETRY_WAIT → RETRYING → SUCCESS/ERROR
         (backoff)
```

### Graceful Degradation Pattern

```
OPTIMAL → DEGRADED → MINIMAL → OFFLINE
  (API)    (Cache)    (Queue)   (Read)
```

### Recovery Pattern

```
FAILED → RECOVERING → VALIDATING → READY
          (cleanup)    (integrity)
```

## Implementation Notes

1. **State Persistence**

   - Current state should be persisted
   - State history for debugging
   - Crash recovery to last stable state

2. **Timeouts**

   - Sync: 60 seconds total
   - Summary: 30 seconds
   - Content fetch: 20 seconds
   - Network check: 5 seconds

3. **Retry Logic**

   - Network errors: 3 attempts, exponential backoff
   - API errors: 2 attempts, 5-second delay
   - Parse errors: No retry (log and skip)

4. **Queue Management**

   - Read/unread changes: Batch every 30 min
   - Failed syncs: Retry next cycle
   - Summary requests: Cancel if offline

5. **State Broadcasting**
   - UI components subscribe to state changes
   - Toast notifications on state transitions
   - Loading indicators for transitional states
