# ADR-004: Dual-Write Sync Progress Tracking

- **Status:** Accepted
- **Date:** 2025-07-27

## Context

The application's manual sync operation is a long-running process. The client UI needs to display real-time progress. However, the server runs on a Next.js serverless architecture, where each API invocation is isolated and does not share memory. Furthermore, the PM2 process manager can restart the server at any time. This makes in-memory state tracking unreliable, leading to sync status polls returning 404 errors and a poor user experience where syncs appeared to fail when they were actually succeeding.

## Decision

We will implement a dual-write pattern for tracking sync progress.

1.  **Primary Storage:** A local temporary file (`/tmp/sync-status-{syncId}.json`). This is extremely fast for frequent progress updates during a sync, and persists across isolated serverless function calls.
2.  **Fallback Storage:** A `sync_status` table in the Supabase database. This provides durability and ensures that sync status can be retrieved even if the server restarts or the temporary file is lost.

The status endpoint (`/api/sync/status/[syncId]`) will first attempt to read from the file system. If the file is not found, it will fall back to querying the database.

## Consequences

**Positive:**

- Provides reliable and performant sync progress tracking that is resilient to both serverless function cycling and server restarts.
- The user experience is significantly improved, with accurate progress bars and no more false-negative timeout errors.
- The file-based primary storage is very low-overhead and avoids burdening the database with frequent small writes.

**Negative:**

- The implementation is slightly more complex than a single-storage solution.
- Requires a cleanup strategy for both the file system and the database to avoid accumulating stale data.

**Neutral:**

- This solution is well-suited for a single-server deployment but would need to be re-evaluated (likely in favor of a solution like Redis) in a multi-server environment.
