# UX NOTE: Floating Controls Hide/Show & Glass Styling — Aug 19, 2025

## Summary of Findings

1. Hide-on-scroll drift for fixed-position floating controls

- Current behavior in `ScrollHideFloatingElement` translates by the full scroll amount. For `position: fixed` elements, this effectively double-applies scroll and pushes controls far off-screen, causing disappearance and tappability issues.
- Reference (logic that over-translates): `src/components/ui/scroll-hide-floating-element.tsx` around the scroll handler that applies `transform: translateY(-currentScrollY)`.

2. Black/thick borders on glass buttons

- Design tokens define subtle 1px translucent borders (via `--glass-nav-border`), but default UA button appearance or a conflicting Tailwind border utility can override them, yielding heavy black borders.

3. Overlap with article content

- Floating controls use `top-2` (8px) offsets by default. In article detail, content begins near the top, so 8px is too tight and can overlap visible text.

4. Glass styling inconsistencies

- Some floating elements may lack `glass-adaptive` in dark/busy contexts, reducing contrast. UA appearance bleed-through also harms the glass look.

5. ChunkLoadError on dynamic import

- Likely due to stale Service Worker caches or stale `.next` artifacts; the failing chunk referenced a lazy-loaded store module (e.g., tag store) during an error path.

---

## Recommendations (aligned with product spec: hide on scroll down, show on scroll up)

A) Clamp translation distance for fixed elements (keep opacity hide/show)

- Maintain directionality: Hide on scroll-down past a threshold; show on scroll-up or near top.
- Translate by a small, fixed distance (e.g., element height + 12–16px; fallback 56–64px) instead of `-currentScrollY`.
- Also set `opacity: 0` and `pointer-events: none` when hidden; restore when shown.
- Respect `prefers-reduced-motion` by skipping transform (opacity-only).

Pseudocode snippet:

```
const hideDistance = measuredHeight + 16; // fallback ~64px
const delta = currentY - lastY;
const isDown = delta > 0;
const pastThreshold = currentY > hideThreshold;

const shouldHide = isDown && pastThreshold;
const translate = shouldHide
  ? (position.startsWith("top") ? -hideDistance : hideDistance)
  : 0;

el.style.transform = `translateY(${translate}px)`;
el.style.opacity = shouldHide ? "0" : "1";
el.style.pointerEvents = shouldHide ? "none" : "auto";
```

B) Increase top offsets for floating clusters to avoid overlap

- Use the `offset` prop of `ScrollHideFloatingElement` to raise top offsets to 16–24px on pages with content near the top (e.g., article detail). Keep the existing PWA safe-area helpers intact.

C) Normalize button appearance to eliminate heavy borders

- Add `appearance: none; -webkit-appearance: none;` to:
  - `.glass-icon-btn`
  - `.glass-toolbar-btn`
  - `.liquid-glass-btn`
- This prevents UA default borders/gradients from bleeding through, especially on iOS Safari. Retain accessible focus styles (`:focus-visible` ring) already provided by the button component.

D) Apply `glass-adaptive` where background contrast is low

- Ensure floating glass elements over arbitrary/dark content use `glass-adaptive` to maintain clarity and consistent “liquid glass” design language.
- Optional: consider auto-toggling with a heuristic in the future; for now, apply explicitly in known contexts.

E) Operational recovery for `ChunkLoadError`

- Stop app processes (PM2: `rss-reader-dev`, `rss-sync-server`).
- Clean build artifacts: remove `.next-dev`, `.next-build` (and any lingering build caches).
- Rebuild and restart app.
- In browser DevTools → Application:
  - Unregister the Service Worker for `/reader`.
  - Clear Cache Storage entries for `_next` / Workbox.
  - Hard reload `/reader`.
- Optional (code hygiene): inline the dynamic import used only in error/rollback paths to reduce chunk boundaries during failures.

---

## Testing Checklist

- Listing (mobile/desktop):
  - Hamburger and filter/“Mark All Read” cluster hide on scroll down (small slide + fade), reappear on scroll up; no drift off-screen.
- Article detail:
  - Back button and action toolbar behave similarly; no overlap with headings/metadata at the top; tappability remains ≥44px.
- Dark mode:
  - Borders are subtle per `--glass-nav-border`; no heavy black borders; focus-visible states remain.
- PWA safe areas:
  - Top offsets respect safe-area insets.

## Scope & Risk

- Changes are localized to `ScrollHideFloatingElement` behavior and CSS normalizations for glass buttons; no API or state architecture changes required.
- Behavior remains aligned with spec (hide on down, show on up).
- Operational steps address `ChunkLoadError` without code changes.
