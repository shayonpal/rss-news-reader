# RR-5: Sync Status Display - Test Contracts

## Overview

This document defines the test contracts for RR-5: Display accurate API usage percentages from Inoreader API response headers.

## API Contracts

### 1. Sync Endpoint Header Capture

**Endpoint**: `POST /api/sync`
**Headers to Capture**:

```
X-Reader-Zone1-Usage: <number>
X-Reader-Zone1-Limit: <number>
X-Reader-Zone2-Usage: <number>
X-Reader-Zone2-Limit: <number>
```

**Expected Response**:

```json
{
  "success": true,
  "apiUsage": {
    "zone1": {
      "usage": 30,
      "limit": 250,
      "percentage": 12
    },
    "zone2": {
      "usage": 450,
      "limit": 500,
      "percentage": 90
    }
  }
}
```

### 2. API Usage Endpoint

**Endpoint**: `GET /api/sync/api-usage`
**Response**:

```json
{
  "zone1": {
    "usage": 30,
    "limit": 250,
    "percentage": 12
  },
  "zone2": {
    "usage": 450,
    "limit": 500,
    "percentage": 90
  },
  "lastUpdated": "2025-01-09T10:00:00Z"
}
```

## Database Contracts

### api_usage Table Schema

```sql
CREATE TABLE api_usage (
  id UUID PRIMARY KEY,
  service VARCHAR(50),
  date DATE,
  count INTEGER,
  zone1_usage INTEGER,
  zone1_limit INTEGER,
  zone2_usage INTEGER,
  zone2_limit INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Storage Contract

- Store zone data with each sync operation
- Update existing record for today's date
- Calculate percentages on retrieval

## Component Contracts

### Sidebar Display Format

```
API Usage: X% (zone 1) | Y% (zone 2)
```

### Color Coding Rules

- Green: < 80%
- Amber: 80-94%
- Red: ≥ 95%

### Display States

1. **Loading**: "API Usage: Loading..."
2. **No Data**: "API Usage: No data"
3. **Error**: "API Usage: Error"
4. **Success**: "API Usage: 12% (zone 1) | 90% (zone 2)"

## Store Contracts

### SyncStore Structure

```typescript
interface ApiUsageData {
  zone1: {
    usage: number;
    limit: number;
    percentage: number;
  };
  zone2: {
    usage: number;
    limit: number;
    percentage: number;
  };
  lastUpdated: string | null;
}

interface SyncStore {
  apiUsage: ApiUsageData | null;
  setApiUsage: (data: ApiUsageData) => void;
  fetchApiUsage: () => Promise<void>;
}
```

## Test Coverage Requirements

### Unit Tests (28)

1. Header parsing (8 tests)
2. Percentage calculations (5 tests)
3. Color determination (6 tests)
4. Database operations (5 tests)
5. Error handling (4 tests)

### Integration Tests (12)

1. Sync endpoint with headers (4 tests)
2. API usage endpoint (4 tests)
3. Database persistence (4 tests)

### Component Tests (20)

1. Sidebar rendering (8 tests)
2. Color styling (6 tests)
3. Loading/error states (4 tests)
4. Accessibility (2 tests)

### E2E Tests (13)

1. Full sync flow (4 tests)
2. UI updates (5 tests)
3. Mobile responsiveness (4 tests)

## Edge Cases to Test

1. **Missing Headers**: Handle gracefully when headers are missing
2. **Zero Limits**: Prevent division by zero
3. **Exceeding Limits**: Display >100% correctly
4. **Network Failures**: Show appropriate error states
5. **Stale Data**: Show last known values with timestamp
6. **First Load**: Handle no previous data scenario
7. **Concurrent Updates**: Ensure data consistency
8. **Invalid Values**: Handle non-numeric or negative values

## Performance Requirements

- API usage fetch: < 100ms
- UI update after sync: < 50ms
- Color change animation: 200ms transition
- Cache duration: 5 minutes

## Accessibility Requirements

- ARIA labels for percentages
- Screen reader announcements for changes
- Color-blind friendly indicators (not just color)
- Keyboard navigation support
