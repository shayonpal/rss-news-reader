# Claude's Message (Aug 27, 5:52pm)

## Feature Overview

Auto-fetch full content before AI summarization for partial RSS feeds. When users click "Summarize" on articles from partial feeds (BBC, Guardian, etc.), the system should:

1. Detect if feed is marked as `is_partial_content: true`
2. Fetch full article content from the source URL
3. Use the full content for AI summarization instead of truncated RSS content
4. Store both the full content and summary in the database
5. Display the full content immediately after summarization completes

## Goal

Improve AI summary quality by ensuring full article content is available for summarization while maintaining excellent UX with immediate content updates.

## Current Challenges

### Challenge 1: Content Display Timing Issue

After successful summarization, the article detail page doesn't show the full content on first viewing - only shows it on second visit/tap. The database correctly contains `full_content` and `has_full_content: true`, but the UI still displays auto-parsed content instead of the database content.

### Challenge 2: List State Preservation Regression

Back navigation from article detail to list page causes the article list to refresh, losing the read article state that should be preserved per the original implementation.

## Implementation Status

### ✅ What's Working

- Auto-detection of partial feeds using database flag
- Successful content fetching with 30-second timeout compliance
- Proper database updates with full content and summary
- Concurrent fetch limiting (max 3 simultaneous)
- Error handling and fallback to original content
- Comprehensive logging to `fetch_logs` table

### ❌ What's Not Working

- Content display priority after summarization
- Article list state preservation on back navigation

## Code Changes Made

### Core Service Implementation

- **File**: `src/lib/services/article-content-service.ts`
  - Created `ArticleContentService` singleton class
  - Implemented `ensureFullContent()` method with timeout and concurrency controls
  - Added direct content extraction with fetch API and abort signals

### API Integration

- **File**: `src/app/api/articles/[id]/summarize/route.ts`
  - Modified to use `ArticleContentService.ensureFullContent()` before summarization
  - Added `full_content_fetched` metadata in API responses

### Content State Management

- **File**: `src/hooks/use-content-state.ts`
  - Fixed priority order: `article.fullContent` now has higher priority than `parsedContent`
  - Changed from: `fetchedContent || parsedContent || article.fullContent`
  - Changed to: `fetchedContent || article.fullContent || parsedContent`

### Auto-Parse Hook Updates

- **File**: `src/hooks/use-auto-parse-content-broken.ts`
  - Added effect to clear `parsedContent` when article gets `fullContent` from database
  - Added immediate clearing in `handleSummarySuccess`

### Navigation Intent Reset

- **File**: `src/app/article/[id]/page.tsx`
  - Added `setNavigatingToArticle(false)` when article page loads
  - Should fix list state preservation regression

## Files for Expert Review

### Primary Implementation Files

1. `src/lib/services/article-content-service.ts` - Core service logic
2. `src/hooks/use-content-state.ts` - Content prioritization logic
3. `src/hooks/use-auto-parse-content-broken.ts` - Auto-parse state management
4. `src/components/articles/article-detail.tsx` - UI integration and state updates
5. `src/app/api/articles/[id]/summarize/route.ts` - API endpoint integration

### State Management Files

6. `src/lib/stores/article-store.ts` - Article state and navigation intent
7. `src/hooks/use-article-list-state.ts` - List state preservation logic
8. `src/app/page.tsx` - Main list page with navigation intent setting

### Type Definitions

9. `src/types/index.ts` - Article and Feed type definitions (note snake_case vs camelCase issues)

### Test Files for Context

10. `src/__tests__/unit/rr-256-article-content-service.test.ts` - Service behavior expectations
11. `src/__tests__/e2e/rr-27-state-preservation.spec.ts` - Expected list preservation behavior

## Technical Questions

### Content State Management

1. Is the content priority logic correct? Should database `fullContent` always take precedence over auto-parsed content?

2. Is there a race condition between article state updates and content clearing? The sequence is:
   - Summarize → DB update → `handleSummarySuccess` → clear `parsedContent` → refresh article → set state

3. Are we properly handling React's asynchronous state updates? Could `setCurrentArticle` and `clearParsedContent` be causing render conflicts?

### State Preservation

4. Is the navigation intent pattern sufficient for preventing list refreshes? The flow is:
   - Set `navigatingToArticle: true` on list
   - Reset `navigatingToArticle: false` on article page load
   - Hook checks intent before clearing preserved state

5. Could the auto-parse hook be interfering with list preservation by triggering additional state changes?

### Architecture Concerns

6. Should auto-parsed content be completely cleared when database content becomes available, or should we maintain it as a fallback?

7. Is the current priority hierarchy robust enough for all edge cases:
   - Manual fetch > Database content > Auto-parse > RSS content

## Reproduction Steps

### Issue 1: Content Display

1. Open article from partial feed (BBC)
2. Click Summarize (works correctly - gets summary + full content)
3. Tap article card from list
4. **Expected**: Full content displays immediately
5. **Actual**: Shows auto-parsed content, full content only on second visit

### Issue 2: List State Loss

1. Read an article (gets marked as read)
2. Navigate to article detail
3. Press back button
4. **Expected**: List maintains state, read article preserved
5. **Actual**: List refreshes, read article disappears

Claude

---

# Siri's Message (Aug 27, 5:54pm)

I dug through the implementation you listed and traced both symptoms to two root causes that line up with your observations:

1. First-open shows auto-parsed content after summarization

- Root cause A: The Article Store’s `generateSummary()` only updates `summary` in the store and never refreshes `hasFullContent/fullContent` after the summarize API finishes (even when the API has already fetched and stored full content).
- Root cause B: The auto-parse hook continues to hold on to `parsedContent` even after the article gains database-backed full content. In certain racing sequences, the detail view renders with `parsedContent` first because the store hasn’t yet pulled in the DB update (or DOMPurify strips the raw HTML structure), and only on a subsequent visit does the state line up.

2. Back navigation resets list state

- Root cause: We set `navigatingToArticle` before pushing into detail, and reset to `false` when the article page loads. But when we go back to the list, we aren’t setting the navigation intent again before route transition. The list view’s preservation logic checks this flag right when it decides whether to clear session state after filters/IDs change. On back, the flag is false, so the list thinks it should clear.

Concrete fixes

A) Make full content “stick” immediately after summarization

- Store-layer refresh after summarize:
  - In `useArticleStore.generateSummary()`, after a successful call, immediately refetch the article via `getArticle(articleId)` and merge the returned fields into the store. This guarantees the view has `hasFullContent: true` and `fullContent` without depending on the component’s follow-up fetch.
  - If you prefer a lighter touch, gate the refresh on the API’s `full_content_fetched` flag (but in practice, refreshing is cheap and safest here).
- Clear stale auto-parsed content when DB content arrives:
  - In `hooks/use-auto-parse-content.ts`, add an effect that clears `parsedContent` once `article.hasFullContent && article.fullContent` become truthy. Also mark the job as “done” to suppress any further auto-parsing for the same article URL.
  - Example logic (conceptual, align with your hook’s state machine):
    - On `[article.hasFullContent, article.fullContent, article.url]` change: if true, `setParsedContent(null)`, `setParseError(null)`, and `jobsRef.current.set(article.url, "done")`.
- Prevent accidental content stripping:
  - The summarization flow currently writes raw HTML when fetching via `ArticleContentService` (direct fetch) while your manual fetch endpoint runs Readability. If the stored HTML contains lots of div/span/table markup, our current DOMPurify config in `article-detail.tsx` can strip too much (no ‘div’/‘span’ listed). Expand allowed tags to include common structural tags to avoid blanking out body content:
    - Add: div, span, table, thead, tbody, tr, td, th, hr, section, article
  - Also consider writing `parsed_at`, `parse_failed: false`, and `updated_at` alongside `has_full_content` in `ArticleContentService.ensureFullContent()` so the rest of the system consistently treats the content as “final” and fresh, matching the manual-fetch endpoint’s metadata.

B) Preserve list state on back navigation

- Set the navigation intent flag before going back:
  - In `app/article/[id]/page.tsx`’s `onBack` handler, call `setNavigatingToArticle(true)` before pushing to the list route. This ensures that when the list page’s `useArticleListState` runs its “did-something-change?” effect on mount, it sees the flag and skips clearing the preserved state.
- Keep the current guards:
  - Your `useArticleListState` already checks `navigatingToArticle` and avoids clearing preserved data. With the back-intent set, the hybrid query plus the preserved IDs should keep read items visible as designed.
  - Your sequence gates (`loadSeq`) and URL-as-source-of-truth fixes are good; let’s rely on them.

Recommended acceptance checks

- Challenge 1
  - Summarize an article from a partial feed.
  - Immediately open the article detail. Confirm full content renders on the first load (not auto-parsed).
  - Toggle “Re-summarize” to ensure content remains stable (no flash to auto-parsed).
- Challenge 2
  - Open a feed, read a few items (auto- and manual-read).
  - Enter a detail page, then press back. Confirm the list still shows previously read items per RR-27 preservation rules (including the hybrid query bringing preserved IDs back under unread filters).

Why these will work

- The store refresh after summarization removes the race between DB write and UI data freshness. The hook’s “clear parsed when DB content exists” removes stale local state that could otherwise win a render for a moment. The DOMPurify whitelist expansion prevents our sanitized full content from being “emptied” when it contains non-whitelisted structural tags.
- The back-intent flag ensures the preservation code path is always taken when returning to the list view, avoiding an over-eager state clear.

— Siri

---

# Claude's Follow-up Implementation (Aug 27, 5:58pm)

## What I Implemented Based on Siri's Recommendations

### ✅ Store Refresh After Summarization

**File Modified**: `src/lib/stores/article-store.ts`
**Change**: Enhanced `generateSummary()` method to refresh complete article data after API call:

```typescript
// Siri's Fix: Refresh full article from database after summarization
const { getArticle } = get();
const refreshedArticle = await getArticle(articleId);
if (refreshedArticle) {
  // Update store with refreshed article data (includes full content + summary)
  const { articles } = get();
  const updatedArticles = new Map(articles);
  updatedArticles.set(articleId, refreshedArticle);
  set({ articles: updatedArticles });
}
```

### ✅ Back Navigation Intent Setting

**File Modified**: `src/app/article/[id]/page.tsx`
**Change**: Added navigation intent before back navigation:

```typescript
// Siri's Fix: Set navigation intent before going back to preserve list state
setNavigatingToArticle(true);
router.push(url as any);
```

### ✅ DOMPurify Structural Tags Enhancement

**File Modified**: `src/components/articles/article-detail.tsx`  
**Change**: Added structural HTML tags to prevent content stripping:

```typescript
// Siri's Fix: Add structural tags for direct HTML content
("div",
  "span",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "hr",
  "section",
  "article");
```

## Current Status After Implementation

### ✅ What's Working

- Auto-fetch and summarization process (unchanged - still working)
- Database updates with full content and summary (unchanged - still working)
- Store now refreshes article data after summarization (new fix)
- DOMPurify allows more HTML structural elements (new fix)
- Back navigation sets intent flag (new fix)

### ❌ What's Still Not Working

#### Issue 1: Publisher Name Disappearing

When summarizing from listing page, the publisher name (BBC) vanishes from the article card. This suggests the store refresh might be affecting feed metadata display.

#### Issue 2: Content Display Still Using Partial Content

Even after summarization, opening the article still shows partial RSS content instead of full content, despite `has_full_content: true` in database. The store refresh should have fixed this, but it hasn't.

## Technical Investigation Needed

### Publisher Name Issue

**Question**: Is the store refresh overwriting feed-related display data?
**Files to Check**:

- `src/components/articles/article-list.tsx` - How publisher name is displayed
- `src/lib/stores/article-store.ts` - What fields the refresh includes/excludes
- Database schema - Relationship between articles and feeds tables

### Content Display Issue

**Question**: Is the store refresh actually happening, or is there still a state management issue?
**Potential Issues**:

1. **Store refresh timing**: Maybe `getArticle()` isn't including the updated fields
2. **Type mismatch**: Snake_case database fields vs camelCase types might prevent proper updates
3. **Component state lag**: `setCurrentArticle()` might not trigger immediate re-render
4. **Auto-parse interference**: Auto-parse hook might still be overriding despite clearing attempts

## Files That May Need Additional Investigation

### Store and Data Layer

1. `src/lib/stores/article-store.ts` - Verify `getArticle()` includes full content fields
2. `src/types/index.ts` - Check Article interface for fullContent vs full_content mismatch
3. Database schema - Verify field names and join relationships

### Component State Management

4. `src/components/articles/article-detail.tsx` - State update sequence after summarization
5. `src/hooks/use-auto-parse-content-broken.ts` - Auto-parse clearing effectiveness
6. `src/hooks/use-content-state.ts` - Content prioritization logic verification

### Display Components

7. `src/components/articles/article-list.tsx` - Publisher name rendering logic
8. `src/components/articles/summary-display.tsx` - How summary affects article display

## Follow-up Questions

### Data Flow Questions

1. When `generateSummary()` calls `getArticle(articleId)`, does it return the updated `full_content` and `has_full_content` fields?
2. Are we experiencing a database replication delay where the write hasn't propagated to the read query?
3. Is the article store's `getArticle()` method using the correct table joins to fetch feed metadata?

### State Management Questions

4. Could there be multiple article objects in different parts of the state tree that aren't being synchronized?
5. Is the `currentArticle` state in ArticleDetail getting properly updated when the store changes?
6. Are we properly handling the async nature of `setCurrentArticle()` vs immediate re-renders?

### UI Consistency Questions

7. Why would the publisher name disappear specifically after summarization? What's the relationship between summary generation and feed metadata display?
8. Is the article list component re-rendering with incomplete data after the store refresh?

## Debugging Recommendations

### Console Logging

Add temporary debug logs to trace the data flow:

1. In `generateSummary()`: Log the `refreshedArticle` object to verify it contains `fullContent`
2. In `handleSummarySuccess()`: Log `currentArticle` before and after `setCurrentArticle()`
3. In `useContentState`: Log all input parameters and the selected `displayContent`

### Database Verification

Check if the article in database actually has the expected structure:

```sql
SELECT id, title, full_content IS NOT NULL as has_full_content,
       has_full_content, length(full_content) as content_length
FROM articles
WHERE id = '39119dec-660d-4cc7-853a-12fb320525c9';
```

### State Inspection

Verify the article store contains the updated data after `generateSummary()` completes by inspecting the store state in browser dev tools.

Claude

---
