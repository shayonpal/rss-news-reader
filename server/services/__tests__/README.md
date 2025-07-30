# BiDirectional Sync Service Tests

This directory contains comprehensive unit and integration tests for the BiDirectional Sync Service, created to address issue RR-66 (sync API endpoint stability).

## Test Coverage

### Unit Tests (`bidirectional-sync.test.js`)

The unit tests focus on:

1. **API Usage Tracking**

   - Correctly tracks new API usage records
   - Updates existing records
   - Handles database errors gracefully
   - Continues sync even if tracking fails
   - No database schema errors occur

2. **Sync Queue Processing**

   - Skips when already processing
   - Handles empty queues
   - Processes when minimum threshold met
   - Processes old changes regardless of threshold
   - Handles database errors gracefully

3. **Inoreader API Integration**

   - Sends correct parameters for each action type
   - Handles API errors appropriately
   - Validates action types

4. **Error Handling & Retries**

   - Updates retry attempts correctly
   - Respects max retry limits
   - Maintains retry state properly

5. **Memory Management**

   - Resets processing flags after errors
   - Tracks retry attempts without unbounded growth
   - Handles large batches efficiently

6. **Periodic Sync**
   - Starts with correct intervals
   - Prevents concurrent processing
   - Stops cleanly

### Integration Tests (`bidirectional-sync.integration.test.js`)

The integration tests simulate realistic scenarios:

1. **Full Sync Cycles**

   - Multiple action types in one cycle
   - Partial failures with retry logic
   - Batch size limits
   - Rate limiting handling

2. **Memory Usage Patterns**

   - Large batch processing (1000+ items)
   - Memory leak prevention
   - Retry map accumulation

3. **Edge Cases**
   - Malformed sync queue items
   - Database connection loss
   - Invalid action types

## Running Tests

From the server directory:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Key Assertions

1. **API Usage Tracking Never Blocks Sync**

   - Even if the API usage tracking fails completely, the sync process continues
   - Database errors are logged but don't throw exceptions

2. **Memory Stays Within Limits**

   - Processing 1000 items increases heap by less than 50MB
   - No unbounded growth of internal data structures

3. **Error Recovery**

   - Failed syncs are retried with exponential backoff
   - Max retries prevent infinite loops
   - Processing flags are always reset

4. **Database Resilience**
   - Handles missing RPC functions
   - Works with direct table updates
   - Gracefully handles connection loss

## Test Environment

The tests use:

- Vitest as the test runner
- Mocked Supabase client
- Mocked Token Manager
- Controlled environment variables
- In-memory data structures for integration tests

## Coverage Goals

These tests ensure:

- ✅ API usage is tracked without RPC dependency
- ✅ Sync continues even if tracking fails
- ✅ No database schema errors
- ✅ Memory usage stays within limits
- ✅ Error handling is robust
- ✅ Retry logic works correctly
  EOF < /dev/null
