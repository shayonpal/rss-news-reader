# RR-177 Test Contracts: Cache Prevention for /api/sync/last-sync

## Test Specification Overview

These test contracts define the EXACT behavior that `/api/sync/last-sync` must implement to prevent browser caching issues. The implementation MUST conform to these specifications.

## Required Cache Headers

ALL responses from `/api/sync/last-sync` MUST include these headers:

```
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
Expires: 0
```

## Response Format

Success responses (200):

```json
{
  "lastSyncTime": "ISO-8601 string or null",
  "source": "sync_metadata | sync_status | sync-log | none"
}
```

Error responses (500):

```json
{
  "error": "Failed to fetch last sync time"
}
```

## Test Scenarios

### 1. Cache Headers Presence Tests

#### Test 1.1: Headers present with sync_metadata source

- **Setup**: Mock sync_metadata table returns valid last_sync_time
- **Request**: GET /api/sync/last-sync
- **Expected Response**:
  - Status: 200
  - Headers:
    - Cache-Control: "no-store, no-cache, must-revalidate"
    - Pragma: "no-cache"
    - Expires: "0"
  - Body: `{ lastSyncTime: "2025-08-10T10:00:00.000Z", source: "sync_metadata" }`

#### Test 1.2: Headers present with sync_status source

- **Setup**:
  - Mock sync_metadata returns null
  - Mock sync_status returns completed sync
- **Request**: GET /api/sync/last-sync
- **Expected Response**:
  - Status: 200
  - Headers: Same cache prevention headers
  - Body: `{ lastSyncTime: "2025-08-10T09:00:00.000Z", source: "sync_status" }`

#### Test 1.3: Headers present with sync-log source

- **Setup**:
  - Mock sync_metadata returns null
  - Mock sync_status returns null
  - Mock log file contains valid sync entry
- **Request**: GET /api/sync/last-sync
- **Expected Response**:
  - Status: 200
  - Headers: Same cache prevention headers
  - Body: `{ lastSyncTime: "2025-08-10T08:00:00.000Z", source: "sync-log" }`

#### Test 1.4: Headers present when no sync data found

- **Setup**: All data sources return null/empty
- **Request**: GET /api/sync/last-sync
- **Expected Response**:
  - Status: 200
  - Headers: Same cache prevention headers
  - Body: `{ lastSyncTime: null, source: "none" }`

#### Test 1.5: Headers present on error response

- **Setup**: Database connection throws error
- **Request**: GET /api/sync/last-sync
- **Expected Response**:
  - Status: 500
  - Headers: Same cache prevention headers
  - Body: `{ error: "Failed to fetch last sync time" }`

### 2. Data Source Priority Tests

#### Test 2.1: sync_metadata takes priority over sync_status

- **Setup**:
  - sync_metadata has time: "2025-08-10T10:00:00Z"
  - sync_status has time: "2025-08-10T09:00:00Z"
- **Expected**: Returns sync_metadata time and source

#### Test 2.2: sync_status takes priority over log file

- **Setup**:
  - sync_metadata returns null
  - sync_status has time: "2025-08-10T09:00:00Z"
  - log file has time: "2025-08-10T08:00:00Z"
- **Expected**: Returns sync_status time and source

### 3. Fresh Data Verification Tests

#### Test 3.1: Multiple sequential requests return fresh data

- **Setup**: Mock data that changes between requests
- **Action**:
  1. First request: sync_metadata returns "10:00:00"
  2. Update mock: sync_metadata returns "11:00:00"
  3. Second request immediately after
- **Expected**: Second request returns "11:00:00" (not cached "10:00:00")

#### Test 3.2: Browser cache simulation

- **Setup**: Simulate browser caching behavior
- **Action**:
  1. Make request and store response
  2. Check that Cache-Control headers prevent storage
  3. Verify no If-None-Match or If-Modified-Since behavior
- **Expected**: Each request hits the server, no 304 responses

### 4. Edge Cases

#### Test 4.1: Invalid date in sync_metadata

- **Setup**: sync_metadata.value = "invalid-date"
- **Expected**:
  - Falls back to sync_status source
  - Still includes cache headers

#### Test 4.2: Malformed JSON in log file

- **Setup**: Log file contains invalid JSON lines
- **Expected**:
  - Skips invalid lines, finds valid entry
  - Still includes cache headers

#### Test 4.3: Empty log file

- **Setup**: Log file exists but is empty
- **Expected**:
  - Returns `{ lastSyncTime: null, source: "none" }`
  - Still includes cache headers

#### Test 4.4: Missing log file

- **Setup**: Log file doesn't exist
- **Expected**:
  - Returns `{ lastSyncTime: null, source: "none" }`
  - Still includes cache headers

### 5. Database Error Handling

#### Test 5.1: Supabase connection timeout

- **Setup**: Mock createClient to throw timeout error
- **Expected**:
  - Status: 500
  - Error message in body
  - Cache headers still present

#### Test 5.2: Partial database failure

- **Setup**: sync_metadata query succeeds but returns null, sync_status query throws
- **Expected**:
  - Falls back to log file
  - Cache headers present

## Implementation Requirements

1. **NextResponse.json() modification**: Must accept headers option:

   ```typescript
   return NextResponse.json(data, {
     headers: {
       "Cache-Control": "no-store, no-cache, must-revalidate",
       Pragma: "no-cache",
       Expires: "0",
     },
   });
   ```

2. **Error responses**: Must also include cache prevention headers:

   ```typescript
   return NextResponse.json(
     { error: "Failed to fetch last sync time" },
     {
       status: 500,
       headers: {
         /* cache headers */
       },
     }
   );
   ```

3. **Consistency**: ALL return statements must include headers, no exceptions

## Testing Utilities

Use these patterns from existing tests:

```typescript
// Header assertion pattern
expect(response.headers.get("Cache-Control")).toBe(
  "no-store, no-cache, must-revalidate"
);
expect(response.headers.get("Pragma")).toBe("no-cache");
expect(response.headers.get("Expires")).toBe("0");

// Mock Supabase pattern
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockData })),
        })),
      })),
    })),
  })),
}));
```

## Acceptance Criteria

✅ All responses include cache prevention headers
✅ Headers prevent browser caching (no stale "18 hours ago")
✅ Each request fetches fresh data from server
✅ All data source branches covered
✅ Error responses also prevent caching
✅ No regression in existing functionality
