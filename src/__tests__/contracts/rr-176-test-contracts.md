# RR-176: Auto-Parse Content Regression - Test Contracts

## Overview

This document defines the test contracts for RR-176: Fix critical regression where ALL articles incorrectly trigger full content fetching and ensure Fetch/Revert buttons work correctly.

## Problem Statement

- **BUG**: ALL articles trigger auto-parse, not just partial feeds
- **BUG**: Fetch/Revert buttons show visual state changes but don't actually work
- **BUG**: Button state not synchronized between header and bottom instances

## Implementation Requirements

### 1. Auto-Parse Logic Contract

**Function**: `useAutoParseContent.needsParsing()`

**MUST ONLY trigger when**:

1. Article doesn't already have full content (`!article.hasFullContent || !article.fullContent`)
2. AND one of:
   - Feed is marked as partial (`feed.isPartialContent === true`)
   - Content < 500 chars (existing behavior)
   - Contains truncation indicators (existing behavior)

**MUST NOT trigger when**:

- Feed is NOT marked as partial (`feed.isPartialContent === false` or `undefined`)
- AND content is >= 500 chars
- AND no truncation indicators

### 2. Content State Management Contract

**State Variables**:

```typescript
// In ArticleDetail component
currentArticle: Article; // Main article state
parsedContent: string | null; // From useAutoParseContent hook
fetchedContent: string | null; // Manual fetch state
forceOriginalContent: boolean; // Force show RSS content (NEW)

// Display priority via useContentState hook
contentToDisplay = forceOriginalContent
  ? article.content
  : fetchedContent ||
    parsedContent ||
    currentArticle.fullContent ||
    currentArticle.content;
```

**State Transitions**:

1. **Auto-parse Success**: `parsedContent` = content, `forceOriginalContent` = false
2. **Manual Fetch Success**: `fetchedContent` = content, `forceOriginalContent` = false
3. **Revert**: `fetchedContent` = null, `forceOriginalContent` = true, clears parsedContent
4. **Navigation**: Reset all temporary states (`fetchedContent`, `forceOriginalContent`)

### 3. Button Synchronization Contract

**IMPORTANT**: Bottom button instance has been REMOVED for cleaner UI.
Only header button exists now.

**Single button must**:

- Show correct icon (Download vs Undo2)
- Show correct label ("Full Content" vs "Original Content")
- Execute correct action (fetch vs revert)
- Update based on unified content state

**Computed State**:

```typescript
hasEnhancedContent = !!(
  fetchedContent ||
  parsedContent ||
  (article.fullContent && !forceOriginalContent)
);
buttonState = {
  icon: hasEnhancedContent ? Undo2 : Download,
  label: hasEnhancedContent ? "Original Content" : "Full Content",
  action: hasEnhancedContent ? handleRevert : handleFetch,
};
```

### 4. API Contracts

#### Fetch Content Endpoint

**Request**: `POST /api/articles/:id/fetch-content`
**Response Success**:

```json
{
  "success": true,
  "content": "<full HTML content>",
  "parsedAt": "2025-01-10T10:00:00Z"
}
```

**Response Failure**:

```json
{
  "success": false,
  "error": "Failed to fetch content",
  "parseFailed": true
}
```

### 5. Database Contract

**Articles Table** (no changes):

- `content`: Original RSS content
- `full_content`: Fetched content (persisted)
- `has_full_content`: Boolean flag
- `parsed_at`: Timestamp of last fetch
- `parse_failed`: Boolean for permanent failures

**Feeds Table** (key field):

- `is_partial_content`: Boolean (default false)
  - 4/66 feeds currently marked true (AppleInsider, BBC, Cult of Mac, Forbes - Tech)
  - **BREAKING CHANGE**: `is_partial_feed` column has been DROPPED

**Note**: Revert is TEMPORARY - doesn't update database

### 6. Toast Notifications Contract (NEW)

**Partial Feed Toggle**:

```typescript
// Loading toast (amber)
toast.loading(
  `${newState ? "Marking" : "Unmarking"} ${feedName} as partial feed...`,
  {
    style: { background: "#f59e0b", color: "white" },
  }
);

// Success toast (green)
toast.success(
  `${feedName} ${newState ? "marked" : "unmarked"} as partial feed`,
  {
    style: { background: "#10b981", color: "white" },
    duration: 3000,
  }
);

// Error toast (red)
toast.error(`Failed to update ${feedName}. Please try again.`, {
  style: { background: "#ef4444", color: "white" },
  duration: 0,
});
```

## Test Scenarios

### Unit Tests - useAutoParseContent Hook (12 tests)

#### Test Group 1: needsParsing Logic (6 tests)

```typescript
describe("needsParsing logic", () => {
  it("should NOT trigger for non-partial feed with >500 chars", () => {
    const article = { content: "a".repeat(600), hasFullContent: false };
    const feed = { isPartialContent: false };
    expect(needsParsing(article, feed)).toBe(false);
  });

  it("should trigger for partial feed regardless of content length", () => {
    const article = { content: "a".repeat(600), hasFullContent: false };
    const feed = { isPartialContent: true };
    expect(needsParsing(article, feed)).toBe(true);
  });

  it("should trigger for ANY feed with <500 chars", () => {
    const article = { content: "short", hasFullContent: false };
    const feed = { isPartialContent: false };
    expect(needsParsing(article, feed)).toBe(true);
  });

  it("should trigger for truncation indicators", () => {
    const article = {
      content: "Long content... Read more",
      hasFullContent: false,
    };
    const feed = { isPartialContent: false };
    expect(needsParsing(article, feed)).toBe(true);
  });

  it("should NOT trigger when already has full content", () => {
    const article = { hasFullContent: true, fullContent: "content" };
    const feed = { isPartialContent: true };
    expect(needsParsing(article, feed)).toBe(false);
  });

  it("should handle undefined feed gracefully", () => {
    const article = { content: "a".repeat(600), hasFullContent: false };
    expect(needsParsing(article, undefined)).toBe(false);
  });
});
```

#### Test Group 2: Auto-trigger Behavior (6 tests) - Updated RR-182

**⚠️ Race Condition Prevention**: All tests in this group require proper `act()` wrappers and mock cleanup (RR-182 fixes).

```typescript
describe("auto-trigger behavior", () => {
  beforeEach(() => {
    // ✅ RR-182: Prevent mock contamination
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("should auto-fetch ONLY for partial feeds on mount", async () => {
    const { result } = renderHook(() =>
      useAutoParseContent({
        article: mockArticle,
        feed: { isPartialContent: true },
        enabled: true,
      })
    );

    // ✅ RR-182: Wrap async state updates in act()
    await act(async () => {
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/reader/api/articles/123/fetch-content",
          expect.any(Object)
        );
      });
    });
  });

  it("should NOT auto-fetch for normal feeds >500 chars", async () => {
    const { result } = renderHook(() =>
      useAutoParseContent({
        article: {
          ...mockArticle,
          content: "a".repeat(600),
          parseAttempts: 0, // ✅ RR-182: Required for shouldShowRetry logic
        },
        feed: { isPartialContent: false },
        enabled: true,
      })
    );

    await wait(100);
    expect(fetch).not.toHaveBeenCalled();
  });

  // More tests for edge cases...
});
```

### Unit Tests - FetchContentButton (8 tests)

```typescript
describe('FetchContentButton', () => {
  it('should show Download icon when no full content', () => {
    render(<FetchContentButton articleId="123" hasFullContent={false} />);
    expect(screen.getByLabelText('Full Content')).toBeInTheDocument();
  });

  it('should show Undo2 icon when has full content', () => {
    render(<FetchContentButton articleId="123" hasFullContent={true} />);
    expect(screen.getByLabelText('Original Content')).toBeInTheDocument();
  });

  it('should call onSuccess with content on fetch success', async () => {
    const onSuccess = vi.fn();
    render(<FetchContentButton articleId="123" onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('<p>Full content</p>');
    });
  });

  it('should call onRevert when clicking revert', async () => {
    const onRevert = vi.fn();
    render(<FetchContentButton
      articleId="123"
      hasFullContent={true}
      onRevert={onRevert}
    />);

    await userEvent.click(screen.getByRole('button'));
    expect(onRevert).toHaveBeenCalled();
  });

  // More tests for error handling, loading states...
});
```

### Integration Tests - Content State Management (10 tests)

```typescript
describe('Content State Management', () => {
  it('should prioritize fetchedContent over parsedContent', async () => {
    const { container } = render(<ArticleDetail
      article={mockArticle}
      feed={{ isPartialContent: true }}
    />);

    // Wait for auto-parse
    await waitFor(() => {
      expect(container.querySelector('.article-content')).toHaveTextContent('Auto-parsed content');
    });

    // Manual fetch
    await userEvent.click(screen.getByLabelText('Full Content'));
    await waitFor(() => {
      expect(container.querySelector('.article-content')).toHaveTextContent('Manually fetched content');
    });
  });

  it('should revert to original RSS when forceOriginalContent is true', async () => {
    // Setup with stored fullContent in database
    const articleWithStored = { ...mockArticle, fullContent: 'Stored full content' };
    render(<ArticleDetail article={articleWithStored} />);

    // Should show stored content initially
    expect(screen.getByText('Stored full content')).toBeInTheDocument();

    // Click revert
    await userEvent.click(screen.getByLabelText('Original Content'));

    // Should show original RSS content, bypassing stored content
    expect(screen.getByText('Original RSS content')).toBeInTheDocument();
  });

  it('should show single button with correct state', async () => {
    render(<ArticleDetail article={mockArticle} />);

    // Should have only one button (bottom button removed)
    const buttons = screen.getAllByLabelText(/Full Content|Original Content/);
    expect(buttons).toHaveLength(1);

    // Click to fetch
    await userEvent.click(buttons[0]);

    // Button should update to "Original Content"
    await waitFor(() => {
      expect(screen.getByLabelText('Original Content')).toBeInTheDocument();
    });
  });

  // More tests for state transitions...
});
```

### E2E Tests - Full User Flows (8 tests)

```typescript
test.describe("RR-176: Content Fetching Regression", () => {
  test("should NOT auto-fetch for normal feeds", async ({ page }) => {
    // Navigate to article from normal feed
    await page.goto("http://localhost:3000/reader");
    await page.click('[data-feed-id="normal-feed"]');
    await page.click('[data-article-id="test-article"]');

    // Verify no auto-fetch triggered
    await expect(page.locator(".content-parsing-indicator")).not.toBeVisible();

    // Verify shows RSS content
    await expect(page.locator(".article-content")).toContainText(
      "Original RSS content"
    );
  });

  test("should auto-fetch ONLY for partial feeds", async ({ page }) => {
    // Navigate to article from partial feed (BBC, AppleInsider, etc.)
    await page.goto("http://100.96.166.53:3000/reader");
    await page.click('[data-feed-title="BBC"]'); // Known partial feed
    await page.click('[data-article-id="test-article"]');

    // Verify auto-fetch triggered
    await expect(page.locator(".content-parsing-indicator")).toBeVisible();

    // Wait for completion
    await page.waitForSelector(".content-parsing-indicator", {
      state: "hidden",
    });

    // Verify shows full content
    await expect(page.locator(".article-content")).toContainText(
      "Full parsed content"
    );
  });

  test("fetch and revert buttons should work correctly", async ({ page }) => {
    await page.goto("http://100.96.166.53:3000/reader/article/123");

    // Initial state - Download icon
    const fetchButton = page.locator('[data-testid="fetch-button"]');
    await expect(fetchButton).toHaveAttribute("aria-label", "Full Content");

    // Click to fetch
    await fetchButton.click();

    // Wait for fetch to complete
    await page.waitForResponse("**/api/articles/*/fetch-content");

    // Should now show Undo icon
    await expect(fetchButton).toHaveAttribute("aria-label", "Original Content");

    // Content should update
    await expect(page.locator(".article-content")).toContainText(
      "Fetched full content"
    );

    // Click to revert
    await fetchButton.click();

    // Should revert to Download icon
    await expect(fetchButton).toHaveAttribute("aria-label", "Full Content");

    // Content should revert to original RSS (not just previous enhanced content)
    await expect(page.locator(".article-content")).toContainText(
      "Original RSS content"
    );
  });

  test("partial feed toggle shows toast notifications", async ({ page }) => {
    await page.goto("http://100.96.166.53:3000/reader");

    // Navigate to an Ars Technica article (not currently partial)
    await page.click('[data-feed-title*="Ars Technica"]');
    await page.click("[data-article-id]:first-child");

    // Open dropdown menu
    await page.click('[aria-label="More options"]');

    // Toggle to partial feed
    await page.click("text=Partial Feed");

    // Should see success toast (green)
    await expect(page.locator(".sonner-toast")).toContainText(
      "marked as partial feed"
    );
    await expect(page.locator(".sonner-toast")).toHaveCSS(
      "background-color",
      "rgb(16, 185, 129)"
    ); // green-500
  });

  // More E2E tests...
});
```

## Edge Cases to Test

1. **Rapid Clicks**: Prevent multiple fetches while loading
2. **Navigation During Fetch**: Cancel fetch on navigation
3. **Failed Fetch**: Show error, allow retry
4. **Permanently Failed**: Don't auto-retry if parse_failed = true
5. **Memory Cleanup**: Abort controllers cleaned on unmount
6. **Race Conditions**: Last fetch wins if multiple triggered
7. **Network Errors**: Handle timeouts gracefully
8. **Large Content**: Handle content >1MB
9. **Invalid HTML**: Sanitize and display safely
10. **Missing Feed Data**: Handle undefined feed object

## Performance Requirements

- Auto-parse decision: < 1ms
- Manual fetch: < 5s timeout
- State updates: < 16ms (single frame)
- Button sync: Immediate (same render cycle)
- Memory: No leaks on repeated fetch/revert

## Success Criteria

1. ✅ Auto-parse triggers ONLY for:
   - Partial feeds (is_partial_feed = true)
   - Short content (<500 chars)
   - Truncation indicators

2. ✅ Manual fetch/revert works:
   - Fetch retrieves full content
   - Revert shows previous state
   - Both update UI correctly

3. ✅ Buttons synchronized:
   - Same state in both locations
   - Update together
   - No desync on rapid clicks

4. ✅ No regressions:
   - Existing features still work
   - Performance unchanged
   - No memory leaks

5. ✅ Test Reliability (RR-182):
   - 100% consistent test execution
   - No React race condition warnings
   - Proper mock cleanup between tests
   - All async state updates wrapped in act()

## Test Execution Plan

### Phase 1: Unit Tests (20 tests)

- useAutoParseContent hook logic
- FetchContentButton component
- State management helpers

### Phase 2: Integration Tests (10 tests)

- Content state priorities
- Button synchronization
- API interactions

### Phase 3: E2E Tests (8 tests)

- Full user flows
- Real feed scenarios
- Mobile/desktop variants

### Phase 4: Performance Tests (5 tests)

- Memory leak detection
- Render performance
- Network efficiency

Total: 43 tests covering all scenarios
