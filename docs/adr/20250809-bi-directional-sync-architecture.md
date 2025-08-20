# ADR-003: Bi-directional Sync Architecture

- **Status:** Accepted
- **Date:** 2025-08-09

## Context

The application needs to keep the read/unread and starred/unstarred status of articles consistent between the local Supabase database and the source of truth, Inoreader. Changes can be made in either the local application or in other Inoreader clients. Inoreader's API does not expose timestamps for when an item's state was changed, making true timestamp-based conflict resolution impossible.

## Decision

We will implement a bi-directional synchronization system for article statuses. The system will use a server-side queue (`sync_queue` table in Supabase) to batch and push local changes to Inoreader.

For conflict resolution where the state of an article differs between the local database and Inoreader during a sync, the **remote state from Inoreader will always win**. This decision establishes Inoreader as the ultimate source of truth, providing a predictable and consistent resolution policy that avoids sync loops or data fragmentation, at the cost of potentially overwriting recent local changes that have not yet been pushed.

## Consequences

**Positive:**

- Provides a clear and predictable data consistency model.
- Prevents complex sync loops and data divergence.
- The use of a server-side queue makes local UI interactions fast and optimistic.
- Conflicts are logged, providing observability into any data overwrites.

**Negative:**

- A user's local change (e.g., marking an article as read) could be reverted if a conflicting state is pulled from Inoreader before the local change has been pushed. This is an accepted trade-off for a more stable system.

**Neutral:**

- This architecture requires an additional database table (`sync_queue`) and a periodic server-side process to manage the queue.
