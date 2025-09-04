# RSS News Reader — Code Review Findings (September 2, 2025)

This document captures issues identified during a focused review of the repo, concrete remediation steps, and a prioritized Action Plan to drive implementation.

Scope reviewed: Next.js app (App Router), API routes, server/ (Express sidecar), Supabase integration, health/monitoring, PWA SW, test/CI scaffolding.

## Critical Issues

- Server-side sanitization is incomplete in `fetch-content` API
  - Why it matters: Regex-based stripping of `<script>/<style>` is not a robust XSS defense and can miss event handlers/URLs. If any consumer renders HTML without the stricter client sanitizer, XSS risk persists.
  - Evidence: `src/app/api/articles/[id]/fetch-content/route.ts` uses manual regex cleanup; `ArticleContentService.sanitizeContent()` already implements DOMPurify+JSDOM with a hardened config.
  - Fix:
    - Reuse the existing sanitization pipeline from `ArticleContentService`: either import it or extract `sanitizeContent()` to a shared `src/lib/security/html-sanitizer.ts`. Apply server-side before persisting `full_content`.
    - Align allowed tags/attrs between server/client; strongly consider disallowing/strictly sandboxing `iframe`.

- SSRF defenses missing in `fetch-content` API
  - Why it matters: Server fetching arbitrary `article.url` can be abused to access internal endpoints.
  - Evidence: No URL vetting in `src/app/api/articles/[id]/fetch-content/route.ts`; strict validator exists in `ArticleContentService.isValidArticleUrl()`.
  - Fix:
    - Move `isValidArticleUrl()` to a shared module (e.g., `src/lib/security/url-validation.ts`) and check before fetch. Block localhost, RFC1918 ranges, metadata endpoints, non-http(s), internal TLDs.

- BasePath mismatch in Service Worker routes (and offline fallback)
  - Why it matters: With `basePath: /reader`, SW patterns that match `/api/` and `/offline` won’t hit real endpoints, leading to stale/ineffective caching and broken offline page.
  - Evidence: `next.config.mjs` sets `basePath: "/reader"`; `src/sw.js` registers `/api/` (not `/reader/api/`) and `FALLBACK_HTML = "/offline"`.
  - Fix:
    - Change API route match to `url.pathname.startsWith("/reader/api/")` or disable API caching entirely (recommended for dynamic data).
    - Set `FALLBACK_HTML = "/reader/offline"`.

- CORS too permissive
  - Why it matters: `Access-Control-Allow-Origin: *` on sensitive routes increases attack surface, even on a tailnet.
  - Evidence: `src/app/api/sync/route.ts` sets `*`; Express sidecar uses default `cors()`.
  - Fix:
    - Restrict to trusted origins (local dev + tailnet hostnames). In Express: `cors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://100.96.166.53:3000"] })`. In Next API, set headers conditionally in the handler.

- Token health check vs. TokenManager schema mismatch
  - Why it matters: Health may report false negatives, hiding real problems or causing noisy alerts.
  - Evidence: `AppHealthCheck` expects `{ encrypted: true }`; `server/lib/token-manager.js` writes `{ encrypted, iv, authTag }` but does not explicitly include a boolean flag.
  - Fix:
    - When saving tokens, include `encrypted: true` in the JSON envelope (backwards compatible). Also update the health check to treat presence of `iv` and `authTag` as encrypted.

- Production safeguards disabled
  - Why it matters: `ignoreBuildErrors/ignoreDuringBuilds` can ship broken or unsafe code.
  - Evidence: `next.config.mjs` sets both to ignore TS/ESLint errors.
  - Fix:
    - Re-enable TS and ESLint enforcement in production builds. If needed, introduce a temporary CI allowlist for known violations.

- Admin writes may fall back to anon key
  - Why it matters: Server routes that write must use the service role key; falling back to anon can silently fail with RLS or tempt adding overly-permissive policies.
  - Evidence: `src/app/api/articles/[id]/fetch-content/route.ts` creates a client with `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Fix:
    - Use `getAdminClient()` everywhere server-side writes occur; fail fast if service role key is missing.

- Possible PM2 `wait_ready` misconfiguration
  - Why it matters: `wait_ready: true` requires `process.send('ready')`; `npm run dev` (Next dev) does not emit that. May cause restart loops in some setups.
  - Evidence: `ecosystem.config.js` sets `wait_ready: true` for `rss-reader-dev` without a ready signal.
  - Fix:
    - Either disable `wait_ready` for the dev app or wrap the dev server in a small script that calls `process.send('ready')` after it’s listening.

## Correctness/Consistency Issues

- Field name inconsistencies (partial feed/parse flags)
  - Why it matters: Auto-fetch logic can silently skip when field names don’t align across layers.
  - Evidence:
    - DB types: `feeds.is_partial_feed` (snake_case).
    - `ContentParsingService` selects `feeds(is_partial_feed)`.
    - `ArticleContentService.shouldFetchContent` checks `feed.is_partial_content` and `feed.fetch_full_content` (fields not in types), returning skip.
    - Hook `useAutoParseContent` checks `feed?.isPartialContent` and `article.hasFullContent` etc. (domain-layer names differ from DB).
  - Fix:
    - Standardize naming and provide a mapping layer. Use one canonical server-side flag: `is_partial_feed`. Update `ArticleContentService` and hooks to read the correct field (and update local `Article/Feed` domain types accordingly). If a user override like `fetch_full_content` is desired, add it to schema + types and wire it end-to-end.

- Server/client sanitization policy drift
  - Why it matters: Different policies between client and server can lead to unexpected rendering or missed hardening.
  - Evidence: Client `article-detail.tsx` allows `iframe`, `class`, `id`; server route currently regex-cleans only.
  - Fix:
    - Centralize the policy (shared module). Consider removing `id` and `class` unless needed for styles; if kept, document why. For `iframe`, either disallow or enforce `sandbox`/`referrerpolicy`/host allowlist in a post-sanitize hook.

- Logging verbosity in production
  - Why it matters: Excess logs can leak details and degrade performance.
  - Evidence: `supabase.ts` logs timing; many `console.log` calls across services.
  - Fix:
    - Introduce a leveled logger (pino/winston) and gate debug logs behind env flags; keep structured logs for server-only paths.

- API rate usage dual-tracking
  - Why it matters: Displaying both header-derived counts and legacy `count` can be confusing.
  - Evidence: `capture-rate-limit-headers` + `api_usage.count` with discrepancy logs.
  - Fix:
    - Treat header-derived “zone usage” as authoritative for read/write quotas; keep `count` for legacy or remove it from UI. Document precedence.

- Service Worker caches Inoreader API
  - Why it matters: The app’s architecture routes all Inoreader calls through the server/sidecar; caching direct `www.inoreader.com` calls is likely dead code.
  - Evidence: `src/sw.js` includes a route for the Inoreader hostname; client doesn’t call it directly.
  - Fix:
    - Remove that route to reduce attack surface and complexity.

- Hard-coded tailnet URL in tests/docs
  - Why it matters: Makes local dev brittle and mixes concerns.
  - Evidence: `playwright.config.ts`, README, Swagger UI controls include `http://100.96.166.53:3000/reader`.
  - Fix:
    - Centralize base URL into env/test config; keep tailnet entry only as an optional server in the UI dropdown.

- Server-only modules not marked
  - Why it matters: Accidental client import of `supabase-admin.ts` could break builds or leak patterns.
  - Evidence: `src/lib/db/supabase-admin.ts` lacks `import 'server-only'`.
  - Fix:
    - Add `import 'server-only'` to server-only modules (admin client, token utilities, Node fs usage helpers).

## Security/Headers

- Add a strict Content Security Policy (CSP)
  - Why it matters: Provides defense-in-depth.
  - Fix:
    - In `next.config.mjs`, add a `Content-Security-Policy` header. Example starting point (adjust for Swagger UI/workbox):
      - default-src 'self';
      - script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: (tighten once Next dev/Swagger constraints are handled);
      - style-src 'self' 'unsafe-inline';
      - img-src 'self' data: https:;
      - font-src 'self' https://fonts.gstatic.com data:;
      - connect-src 'self' https://\*.supabase.co https://api.anthropic.com;
      - frame-src 'self' (or allowlist needed providers only);
      - object-src 'none';
      - base-uri 'self';

- Add `Referrer-Policy`, COOP/COEP where safe
  - Referrer-Policy: `no-referrer` or `strict-origin-when-cross-origin`.
  - Cross-Origin-Opener-Policy: `same-origin`; Cross-Origin-Embedder-Policy as needed.

- Express sidecar: add Helmet
  - `server/server.js`: `app.use(helmet({ contentSecurityPolicy: false }))` initially, then layer CSP if aligned with the app.

## Testing & Build

- Re-enable build gates
  - Remove `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` once the below cleanup lands.

- Stabilize test profiles
  - Provide `.env.test` and a single “offline” test profile that stubs Next cookies, fetch, and Supabase calls. Skip E2E unless tailnet/server running.

- Fix minor lint warnings
  - ESLint surfaced a handful of easy fixes (mostly hook dependency hints and `prefer-const` in tests).

## Action Plan (Prioritized TODOs)

1. Security hardening (blockers)

- [ ] Replace regex cleanup in `src/app/api/articles/[id]/fetch-content/route.ts` with shared DOMPurify+JSDOM sanitizer (extract from `ArticleContentService`).
- [ ] Add SSRF validation in the same route by reusing a shared `isValidArticleUrl()` utility.
- [ ] Restrict CORS
  - [ ] Next API: return `Access-Control-Allow-Origin` only for trusted origins.
  - [ ] Express sidecar: configure `cors({ origin: [trusted list] })`.
- [ ] Add CSP + Referrer-Policy headers in `next.config.mjs`.
- [ ] Add Helmet to `server/server.js` (disable CSP initially to avoid conflict; iterate later).

2. Correctness & consistency

- [ ] Unify partial feed flags
  - [ ] Standardize on `feeds.is_partial_feed` end-to-end.
  - [ ] Update `ArticleContentService.shouldFetchContent` to check the canonical field.
  - [ ] If a per-feed override (`fetch_full_content`) is desired, add it to DB + types and wire UI control accordingly.
- [ ] Fix SW basePath issues
  - [ ] Change API match to `/reader/api/` or remove API caching.
  - [ ] Set `FALLBACK_HTML = "/reader/offline"`.
  - [ ] Remove Inoreader hostname caching route.
- [ ] Supabase admin usage
  - [ ] Replace ad-hoc clients in server routes with `getAdminClient()`; fail fast if service role key is missing.
  - [ ] Add `import 'server-only'` to `src/lib/db/supabase-admin.ts` and other server-only modules.
- [ ] Token health alignment
  - [ ] Ensure `TokenManager.saveTokens()` writes `{ encrypted: true }` along with `iv`/`authTag`.
  - [ ] Update `AppHealthCheck` to treat either explicit flag or presence of `iv`/`authTag` as encrypted.

3. Headers & logging

- [ ] Add `Referrer-Policy`, COOP/COEP where appropriate.
- [ ] Introduce a leveled logger; gate verbose logs in production.

4. Build quality gates

- [ ] Remove build ignores for ESLint/TS in `next.config.mjs`.
- [ ] Fix current lint warnings (hooks deps, `prefer-const` in tests).

5. Testing posture

- [ ] Add `.env.test` template and document how to run unit vs integration vs E2E.
- [ ] Provide a fully stubbed “offline” unit test config (mock Supabase, Next `cookies`, network).
- [ ] Parameterize tailnet URL in tests and Swagger UI (env-driven), default to localhost.

6. PM2/dev ergonomics

- [ ] Disable `wait_ready` for `rss-reader-dev` or add a wrapper that signals `process.send('ready')` after the dev server starts.

7. Documentation

- [ ] Document sanitizer policy (allowed tags/attrs) and the iframe stance.
- [ ] Document rate limit precedence (header-derived zone usage vs legacy count).

## Appendix: Implementation Notes

- Sanitizer extraction:
  - New `src/lib/security/html-sanitizer.ts` exporting `sanitizeHtml(html: string): string` using DOMPurify+JSDOM with the hardened options from `ArticleContentService`.
  - Update both the API route and service to import and use it.

- URL validator extraction:
  - New `src/lib/security/url-validation.ts` exporting `isSafeHttpUrl(url: string): boolean` (moved from `ArticleContentService`).

- CSP rollout strategy:
  - Start with report-only (`Content-Security-Policy-Report-Only`) in non-prod, collect violations, then enforce. Keep Swagger UI constraints in mind.

- Supabase admin client:
  - Ensure no accidental client-side imports; mark server-only modules explicitly.

- Naming alignment:
  - Decide canonical domain types (`Article`, `Feed`) and create a mapping from DB → domain types to avoid leaking snake_case fields into UI.

---
