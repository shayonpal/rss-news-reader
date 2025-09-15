# RR-297: Article Feed Context Preservation

**Implementation Date:** September 14, 2025
**Issue Type:** Bug Fix
**Status:** ✅ Resolved

## Problem Statement

### User Experience Issue

Users experienced confusing navigation behavior when viewing article details:

- **Feed Name Display**: After refreshing an article detail page, the feed name displayed as "Unknown Feed" instead of the actual feed name (e.g., "BBC", "TechCrunch")
- **Navigation Context Loss**: Feed context was lost during page refreshes, making it unclear which feed the article belonged to
- **State Management**: Zustand feed store doesn't persist across page refreshes, starting empty on every page load

### Root Cause Analysis

```typescript
// Problem: Empty Zustand store after refresh
const { feeds } = useFeedStore(); // Empty Map() after page refresh

// Feed resolution failed due to empty store
const feedTitle = feeds.get(article.feed_id)?.title || "Unknown Feed";
// Result: "Unknown Feed" displayed instead of actual feed name
```

**Technical Details:**

1. **Store State Loss**: Zustand feed store initializes empty on page refresh
2. **Feed Resolution Failure**: Article detail page couldn't resolve feed names without populated store
3. **Navigation Context Missing**: No mechanism to preserve feed context through URL parameters
4. **Back Navigation Issues**: Users lost filtered list context when returning from articles

## Technical Solution

### 1. URL-Based Feed Context Preservation

Enhanced article URLs to include feed context via query parameters:

```typescript
// Before: /article/123
// After: /article/123?feedId=456

const feedIdFromQuery = searchParams.get("feedId");
```

### 2. Automatic Feed Loading

Implemented automatic feed hierarchy loading when store is empty:

```typescript
const [feedsLoaded, setFeedsLoaded] = useState(false);

useEffect(() => {
  const loadFeeds = async () => {
    if (feeds.size === 0 && !feedsLoaded) {
      await loadFeedHierarchy();
      setFeedsLoaded(true);
    }
  };
  loadFeeds();
}, [feeds.size, feedsLoaded, loadFeedHierarchy]);
```

### 3. Enhanced Feed Title Resolution

Added robust feed title resolution with loading states:

```typescript
const resolveFeedTitle = useCallback(() => {
  // Priority order: URL parameter -> store lookup -> fallback
  if (feedIdFromQuery) {
    const feedFromQuery = feeds.get(parseInt(feedIdFromQuery));
    if (feedFromQuery) return feedFromQuery.title;
  }

  if (article?.feed_id) {
    const feedFromStore = feeds.get(article.feed_id);
    if (feedFromStore) return feedFromStore.title;
  }

  // Show loading state while feeds are being loaded
  if (feedsLoaded) {
    return "Unknown Feed";
  }

  return "Loading...";
}, [feedIdFromQuery, feeds, article?.feed_id, feedsLoaded]);
```

### 4. Session Storage for Back Navigation

Preserved feed context for seamless back navigation:

```typescript
// Store feed context for back navigation
useEffect(() => {
  if (feedIdFromQuery && currentArticle) {
    const backContext = {
      feedId: feedIdFromQuery,
      feedTitle: resolveFeedTitle(),
      timestamp: Date.now(),
    };
    sessionStorage.setItem("article-back-context", JSON.stringify(backContext));
  }
}, [feedIdFromQuery, currentArticle, resolveFeedTitle]);

// Reconstruct filtered list URL for back navigation
const handleBack = () => {
  try {
    const backContext = sessionStorage.getItem("article-back-context");
    if (backContext) {
      const { feedId, feedTitle } = JSON.parse(backContext);
      const backUrl = `/?filter=feed&feedId=${feedId}&feedTitle=${encodeURIComponent(feedTitle)}`;
      router.push(backUrl);
      return;
    }
  } catch (error) {
    console.error("Failed to parse back context:", error);
  }

  // Fallback to simple back navigation
  router.push("/");
};
```

### 5. Prev/Next Navigation Context Preservation

Enhanced article navigation to carry feed context through URL parameters:

```typescript
const buildArticleUrl = (targetArticle: Article) => {
  let url = `/article/${targetArticle.id}`;

  // Preserve feed context through navigation
  if (feedIdFromQuery) {
    url += `?feedId=${feedIdFromQuery}`;
  }

  return url;
};

// Apply to both previous and next navigation
const handlePrevious = () => {
  if (previousArticle) {
    router.push(buildArticleUrl(previousArticle));
  }
};

const handleNext = () => {
  if (nextArticle) {
    router.push(buildArticleUrl(nextArticle));
  }
};
```

## Implementation Details

### File Modified: `src/app/article/[id]/page.tsx`

**Key Changes:**

1. **Query Parameter Handling**: Added `feedIdFromQuery` extraction from URL search params
2. **Automatic Feed Loading**: Implemented `feedsLoaded` state and loading effect
3. **Enhanced Title Resolution**: Robust feed title resolution with priority hierarchy
4. **Session Storage Integration**: Back navigation context preservation
5. **URL Building Helper**: Consistent URL construction for navigation

### State Management Flow

```typescript
// 1. Page Load
const feedIdFromQuery = searchParams.get("feedId"); // Extract from URL

// 2. Store Check & Auto-Load
if (feeds.size === 0 && !feedsLoaded) {
  await loadFeedHierarchy(); // Populate store
  setFeedsLoaded(true);
}

// 3. Feed Title Resolution
const feedTitle = resolveFeedTitle(); // Use store + query context

// 4. Navigation Context Preservation
// URLs: /article/123?feedId=456
// Back: /?filter=feed&feedId=456&feedTitle=BBC
```

### Error Handling & Fallbacks

```typescript
// Graceful degradation for edge cases
const resolveFeedTitle = () => {
  try {
    // Try URL parameter first
    if (feedIdFromQuery) {
      const feed = feeds.get(parseInt(feedIdFromQuery));
      if (feed?.title) return feed.title;
    }

    // Try article's feed_id from store
    if (article?.feed_id) {
      const feed = feeds.get(article.feed_id);
      if (feed?.title) return feed.title;
    }

    // Loading state while feeds populate
    if (!feedsLoaded) return "Loading...";

    // Final fallback
    return "Unknown Feed";
  } catch (error) {
    console.error("Feed title resolution error:", error);
    return "Unknown Feed";
  }
};
```

## User Experience Improvements

### Before (Problematic Behavior)

1. ❌ **Refresh Issue**: Article detail page showed "Unknown Feed" after refresh
2. ❌ **Context Loss**: No way to identify which feed an article belonged to
3. ❌ **Navigation Confusion**: Back button lost filtered list context
4. ❌ **Inconsistent Display**: Feed name disappeared unpredictably

### After (Enhanced Experience)

1. ✅ **Persistent Feed Names**: Feed names display correctly after refresh
2. ✅ **Context Preservation**: Feed context maintained through URL parameters
3. ✅ **Smart Back Navigation**: Returns to filtered list with proper context
4. ✅ **Loading States**: Clear feedback during feed data loading
5. ✅ **Prev/Next Preservation**: Feed context carried through article navigation

## Testing & Validation

### Manual Test Scenarios

1. **Refresh Test**: Navigate to article → refresh page → verify feed name displays correctly
2. **Direct URL Access**: Access `/article/123?feedId=456` directly → verify feed name resolves
3. **Back Navigation**: Article → back button → verify returns to filtered list
4. **Prev/Next Navigation**: Navigate between articles → verify feed context preserved
5. **Edge Cases**: Empty store, invalid feed IDs, missing query parameters

### Performance Considerations

- **Lazy Loading**: Feeds only loaded when store is empty
- **Single Load**: `feedsLoaded` flag prevents multiple unnecessary loads
- **Session Storage**: Minimal data stored for back navigation context
- **URL Parameters**: Lightweight feed context transmission

## Architecture Benefits

### State Management

- **Store Independence**: Article pages work regardless of store initialization state
- **Context Preservation**: Feed information preserved across navigation and refresh
- **Graceful Degradation**: Multiple fallback strategies for edge cases

### Navigation UX

- **Consistent URLs**: Predictable URL structure with feed context
- **Smart Back Navigation**: Reconstructs appropriate filtered views
- **Context Continuity**: Seamless experience across article browsing

### Maintainability

- **Clear Separation**: Feed loading logic separated from display logic
- **Error Resilience**: Comprehensive error handling and fallbacks
- **Future-Proof**: Foundation for additional context preservation features

## Related Issues & Patterns

### Similar Patterns in Codebase

This pattern can be extended for other context preservation needs:

- **Search Context**: Preserve search terms in article URLs
- **Filter Context**: Maintain read/unread filter state
- **Sort Context**: Preserve article sorting preferences

### Lessons Learned

1. **Zustand Persistence**: Consider persistent storage for critical UI state
2. **URL as State**: URL parameters provide reliable context preservation
3. **Loading States**: Always provide feedback during async operations
4. **Fallback Strategies**: Multiple resolution paths prevent user confusion

## Future Enhancements

### Potential Improvements

1. **Feed Store Persistence**: Implement Zustand persistence for feed data
2. **Enhanced Context**: Include additional metadata (folder, tags) in URLs
3. **Breadcrumb Navigation**: Visual breadcrumbs showing feed → article hierarchy
4. **Deep Linking**: Support for complex filtered views via URL parameters

### Migration Path

This implementation provides a foundation for more sophisticated navigation state management without breaking existing functionality.
