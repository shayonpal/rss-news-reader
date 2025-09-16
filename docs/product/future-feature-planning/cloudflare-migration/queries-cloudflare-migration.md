# Cloudflare Migration Plan — Peer Review Discussion

Last updated: 2025-09-16

I read through the five docs and took a pass over the repo. Overall I like where you’re heading—getting off the Mac Mini and losing the `/reader` base path will make life better. Where I’m a bit nervous is the amount of Node‑only machinery we depend on today that won’t translate to Workers/Pages without some rethinking. Let me walk you through what stood out to me, how I’d approach it, and a few ways we can de‑risk the rollout.

## What feels solid

- A dedicated subdomain (`reader.uberfolks.ca`) and dropping `/reader` cleans up routes and UX.
- Cloudflare Pages + a Worker for scheduled/background tasks is a good fit long‑term.
- One OAuth callback and GitHub‑driven deploys keeps operations simple.

## Where I think we’ll hit friction

The current app leans on Node and the local filesystem pretty hard; Workers don’t offer that environment.

- Filesystem writes/reads:
  - Token storage in `~/.rss-reader/tokens.json` (e.g., `server/lib/token-manager.js`, `src/app/api/auth/inoreader/status/route.ts`).
  - Sync state in `/tmp/sync-status-*.json` (see `src/app/api/sync/route.ts`).
  - JSONL logs in `./logs/*` (e.g., `src/app/api/health/cron/route.ts`, `src/server/cron.js`).

- Long‑running work from request handlers:
  - `/api/sync` returns quickly then continues heavy work via `performServerSync`. Workers end execution with the response unless we move the work into `waitUntil` + queues/cron.

- Node crypto and servers:
  - AES‑GCM via Node `crypto` in `server/lib/token-manager.js` and `src/lib/utils/encryption.ts`.
  - Express (`server/server.js`) and `node-cron` (`src/server/cron.js`). None of that runs in Workers.

- Base path is deeply baked in:
  - `next.config.mjs` has `basePath: "/reader"`, and there are many `/reader/*` links, fetches, and even layout asset paths (manifest/icons). Tests expect those paths, too.

- Deployment assumptions:
  - The example `wrangler.toml` with `main = "src/index.js"` isn’t how we usually ship Next on Cloudflare. We’ll want Pages Functions via `@cloudflare/next-on-pages`, plus bindings for Queues/vars/cron.

## Risks I’d call out early

- `node_compat` won’t grant us fs or full Node parity. If we keep `experimental-edge` and try to `fs.readFile`, things will break fast.
- Wildcard OAuth callbacks may not be supported by Inoreader; I’d plan around a single exact callback.
- Cron scheduling in docs uses `node-cron` with a timezone; Cloudflare scheduled events are UTC on the platform side.
- We currently import the Supabase service role key for server utilities; we must be careful not to accidentally pull that into client bundles after the move.

## How I’d approach it (small, safe chunks)

If I were pairing on this with you, I’d propose we carve it up like this. Same destination, less drama.

1) Prep
- Add an abstraction for storage/crypto so we can swap Node ↔ Edge without touching call sites.
- Sketch DB tables for tokens and sync status/events so we can stop writing to disk.

1) BasePath migration
- Remove `basePath` in `next.config.mjs` and fix layout asset paths to `/manifest.json` and `/icons/*`.
- Replace `/reader/*` in links/fetches. Keep a temporary rewrite from `/reader/*` → `/*` so old links don’t explode.
- Update the heaviest‑used tests to the new paths.

1) OAuth callback
- Build `/api/auth/inoreader/callback` as a Next Function or Worker handler that exchanges the code, encrypts with WebCrypto, and stores tokens in Supabase per user.
- Point the status endpoint at the DB rather than the filesystem.

1) Background jobs
- Introduce a Cloudflare Queue, plus a consumer Worker that runs the current `performServerSync` logic without touching the fs.
- Change `/api/sync` to enqueue a job and return a job ID. `/api/sync/status/:id` reads a `sync_status` row instead of a `/tmp` file.
- Port the 6× daily schedule to a `scheduled` handler (UTC) that enqueues jobs.

1) Deploy to Pages
- Use `@cloudflare/next-on-pages`, add bindings for Queues/vars/cron in `wrangler.toml`, and test preview → production.

1) Observability and clean‑up
- Replace JSONL logs with DB rows (or Cloudflare Analytics/Logs) and a small status view. Retire the Node cron and the Express server.

## A rough DB sketch

This is just to anchor the conversation—we can refine column names as we wire things up.

```sql
-- One row per user/provider; encrypted payload holds access/refresh/etc.
create table if not exists oauth_tokens (
  user_id uuid primary key references users(id) on delete cascade,
  provider text not null default 'inoreader',
  encrypted jsonb not null,     -- { encrypted, iv, authTag }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Job lifecycle + progress/metrics for UI polling
create table if not exists sync_status (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('pending','running','completed','failed')),
  progress int not null default 0,
  message text,
  metrics jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional breadcrumb trail for debugging and audits
create table if not exists sync_events (
  id bigserial primary key,
  sync_id uuid not null references sync_status(id) on delete cascade,
  level text not null default 'info',
  event text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
```

## What “done” feels like to me

- The app runs at root paths; old `/reader/*` links still work during the transition via rewrites.
- OAuth callback exchanges the code and stores encrypted tokens in Supabase; the status endpoint reads the DB.
- `/api/sync` enqueues work and returns quickly; polling hits DB‑backed status; scheduled jobs run via Workers (UTC) and show up in telemetry.
- No local file I/O during normal operation.
- Service role and client secrets are server‑only (never bundled to the client).

## Open questions I’d love to align on

- How much throughput do we expect for the sync queue (now and later)? Any SLOs for completion time?
- Where do we prefer observability to live—Supabase tables, Cloudflare Analytics/Logs, or both?
- Timezone policy for cron—okay with UTC + translated windows, or do we need local‑time semantics year‑round?
- Test strategy for the heaviest flows (OAuth + sync)

Bottom line: I like the destination. With a bit of re‑plumbing (tokens, fs → DB, background work via queues/cron, Next-on-Pages), the move to Cloudflare will be stable and low‑maintenance. I’m happy to spike the first pieces (token manager + queue skeleton) if that helps us firm up the path.

