# Bi-directional Sync

This document explains how the app synchronizes read/unread and star/unstar changes between the local database (Supabase) and Inoreader. It focuses on current behavior, using high-level flows and pseudocode grounded in the existing implementation.

## What syncs

- Read/unread status
- Star/unstar status

Article metadata (titles, authors, content, tags) is handled by the main Inoreader→Supabase sync and is out of scope here except where it intersects with status updates.

## Triggers and timing

- Manual sync: user clicks the sync button
  - Returns a response with sidebar data (fresh feed counts and tags) for immediate UI updates
  - Applies rate-limit guard with a visual cooldown when applicable
- Background sync: automated runs (6× daily) for content; bi‑directional queue processing also runs on its own cadence
- Queue processor: every ~5 minutes checks `sync_queue` and pushes batched changes to Inoreader
- Concurrency guard: single-sync in flight; manual requests are debounced by 500 ms

## High-level flow

```
User marks article read/star → add_to_sync_queue RPC → row in sync_queue
                                          ↓ (periodic)
Queue processor groups by action → POST /api/inoreader/edit-tag (batch)
                                          ↓
On success: dequeue rows → update metrics/logs
On failure: retry with backoff → keep rows until success or max retries
```

### Pseudocode sketch

```ts
// Client: queue local change
await supabase.rpc("add_to_sync_queue", {
  p_article_id: articleId,
  p_inoreader_id: inoreaderId,
  p_action_type: action /* 'read'|'unread'|'star'|'unstar' */,
});

// Server: periodic processor
const pending = await supabase
  .from("sync_queue")
  .select("*")
  .order("created_at");

const groups = groupByActionType(pending);
for (const [action, items] of Object.entries(groups)) {
  const batches = chunk(items, 100); // Inoreader batch guidance
  for (const batch of batches) {
    const response = await fetch("/api/inoreader/edit-tag", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: buildEditTagForm(
        action,
        batch.map((b) => b.inoreader_id)
      ),
    });

    if (response.ok) {
      await supabase
        .from("sync_queue")
        .delete()
        .in(
          "id",
          batch.map((b) => b.id)
        );
    } else if (response.status === 429) {
      // honor Retry-After; backoff & try later
      scheduleRetryWithDelay(batch, parseRetryAfter(response));
    } else {
      markRetry(batch);
    }
  }
}
```

## Database integration

`sync_queue` (see migrations 007/008) tracks pending changes:

- `article_id`, `inoreader_id`, `action_type` ('read'|'unread'|'star'|'unstar')
- `action_timestamp`, `sync_attempts`, `last_attempt_at`, `created_at`

Supporting SQL functions:

- `add_to_sync_queue(...)` inserts or deduplicates by `inoreader_id` + last action
- `clean_old_sync_queue_entries()` performs maintenance/cleanup

## Inoreader API integration

All state updates are sent via the single `edit-tag` endpoint using batch payloads:

- Endpoint: proxied as `POST /api/inoreader/edit-tag`
- Payload: `application/x-www-form-urlencoded`
- Category parameters map to read/star states per Inoreader’s contract (add/remove state labels)
- Typical batch size: up to 100 item IDs per call

Rate limits are detected through HTTP 429 and `Retry-After`, which drive cooldown UX on the manual sync button and delayed retries in the queue processor.

## Conflict detection and resolution

Because Inoreader does not expose timestamps for remote state changes, conflicts are state-based:

- Detect: local state differs from incoming/remote state and there were recent local changes
- Resolution policy: remote wins for status conflicts
- Observability: conflicts are logged to `logs/sync-conflicts.jsonl` with local/remote values and resolution

This preserves a consistent source-of-truth behavior while offering visibility into overwrites.

## Manual sync response and UI refresh

`POST /api/sync` returns:

- `syncId`, `status` (completed|partial|failed)
- `metrics` (new/deleted articles, failed feeds, etc.)
- `sidebar` payload with fresh feed counts and tags

The client applies the sidebar payload immediately (no materialized-view timing gap) and shows a succinct toast (e.g., “Sync complete • 15 new articles”). Debounce/guard avoids duplicate syncs.

## Monitoring and health

- API call logging to `logs/inoreader-api-calls.jsonl`
- Sync conflicts to `logs/sync-conflicts.jsonl`
- Health endpoints (see Server API Endpoints doc): app/db/cron/sync
- Uptime Kuma monitors push overall sync health

## Scenarios (what happens)

1. Few reads, then pause (below batch threshold)

- Behavior: Changes queue immediately. If fewer than the batch minimum, they will still sync when the oldest queued change passes the age threshold (e.g., ~15 minutes) or when additional actions accumulate to reach the batch size. No user action required.

2. Mark star/unstar while offline or briefly disconnected

- Behavior: RPC insert succeeds when client is online with DB; the change persists in `sync_queue`. Processor retries on network/API failures with exponential backoff until the `edit-tag` call succeeds, then dequeues.

3. Inoreader rate limiting (HTTP 429)

- Behavior: Manual `POST /api/sync` responds with a structured 429 and `Retry-After` seconds. UI shows a cooldown timer on the sync button. The queue processor defers batches until the window elapses, then resumes.

4. Remote/local disagreement (conflict)

- Behavior: Remote wins. The conflict is recorded with both local and remote values plus resolution for analysis. The app continues with the resolved state.

5. Manual sync just completed; counts and tags stale in DB views

- Behavior: The `/api/sync` response includes `sidebar` counts/tags. The UI applies them immediately (no wait for materialized views), ensuring the sidebar reflects current state.

6. OAuth token missing/expired on server

- Behavior: `edit-tag` proxy returns 401/403; queue entries remain with incremented retries. Monitoring shows auth errors; once tokens are restored, the next processor run clears the queue.

## References

- Client queueing: `src/lib/stores/article-store.ts` (calls `add_to_sync_queue` RPC)
- Queue processing: `server/services/bidirectional-sync.js` (reads `sync_queue`, posts to `edit-tag`)
- Proxy route: `src/app/api/inoreader/edit-tag/route.ts`
- Sync endpoints: `src/app/api/sync/route.ts` (metrics + sidebar payload)
- DB migrations: `src/lib/db/migrations/007_add_bidirectional_sync.sql`, `008_fix_sync_queue_function.sql`
- Security hardening: RR-67 fixes for views/functions
