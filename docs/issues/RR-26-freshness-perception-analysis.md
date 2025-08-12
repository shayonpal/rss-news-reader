# Article Freshness Perception Issue Analysis (RR-26)

## Issue Summary

Users are experiencing a perception that articles are "stale" or "old" despite having recent content. This analysis examines the current implementation and identifies potential causes.

## Current Implementation Analysis

### 1. Timestamp Display Format

- **Location**: `src/components/articles/article-list.tsx` (line 312-318)
- **Implementation**: Uses `date-fns` library's `formatDistanceToNow` function
- **Format**: Shows relative time (e.g., "2 hours ago", "3 days ago")
- **Fallback**: Falls back to `toLocaleDateString()` if formatting fails

```typescript
const formatTimestamp = (date: Date) => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return new Date(date).toLocaleDateString();
  }
};
```

### 2. Article Sorting

- **Location**: `src/lib/stores/article-store.ts` (line 89, 192)
- **Implementation**: Articles are sorted by `published_at` in descending order (newest first)
- **Database Query**: `.order('published_at', { ascending: false })`
- **Consistency**: Both initial load and pagination use the same sorting

### 3. Timezone Handling

- **Cron Jobs**: Server uses `America/Toronto` timezone for scheduled syncs
- **Database**: Uses `TIMESTAMPTZ` (timestamp with timezone) for all date columns
- **Client Display**: Relies on browser's local timezone for display
- **No explicit timezone conversion** in the UI layer

### 4. Date-fns Version

- **Current Version**: `^4.1.0` (latest major version)
- **No known issues** with this version regarding time calculations

## Identified Issues

### 1. Timezone Mismatches

- Articles stored in UTC in database
- No explicit timezone conversion when displaying to users
- Browser's `toLocaleDateString()` fallback doesn't show time
- Users may see articles as "older" if they're in different timezones

### 2. Relative Time Perception

- "23 hours ago" might feel stale compared to seeing actual timestamp
- No indication of the actual publication date/time
- Users can't distinguish between "published at 11:59 PM yesterday" vs "published at 12:01 AM today"

### 3. Missing Visual Freshness Indicators

- No visual distinction between very recent (< 1 hour) and older articles
- All unread articles look the same regardless of age
- No "new" badges or highlighting for fresh content

### 4. Sync Schedule Perception

- Syncs only happen at 2 AM and 2 PM Toronto time
- If user checks at 1 PM, they see articles from 2 AM sync (11 hours old)
- No indication of when the last sync occurred
- **Note**: RR-177 has resolved the cache-related issue where sync times appeared stale due to browser caching

### 5. Feed-Level Timestamps

- No display of when a feed was last updated
- Users can't tell if a feed is actively publishing or dormant

## Recommendations

### 1. Immediate Improvements

1. **Add Actual Timestamp on Hover**
   - Show full date/time on hover over relative time
   - Format: "Monday, December 2, 2024 at 3:45 PM EST"

2. **Visual Freshness Indicators**
   - Add "NEW" badge for articles < 2 hours old
   - Use color coding: green for < 6h, normal for < 24h, muted for older
   - Add subtle animation for very fresh content (< 30 minutes)

3. **Show Last Sync Time**
   - Add "Last synced: X minutes ago" in the header
   - Allow manual refresh with visual feedback

### 2. Medium-term Improvements

1. **Enhanced Time Display**
   - For today: "Today at 3:45 PM"
   - For yesterday: "Yesterday at 10:30 AM"
   - For this week: "Tuesday at 2:15 PM"
   - Older: Current format

2. **Feed Freshness Indicators**
   - Show "Last updated" timestamp for each feed
   - Visual indicator for "active" vs "dormant" feeds

3. **Smart Sync Scheduling**
   - More frequent syncs during peak reading hours
   - Allow users to trigger manual sync

### 3. Long-term Improvements

1. **User Timezone Preferences**
   - Store user's preferred timezone
   - Convert all timestamps to user's timezone consistently

2. **Customizable Freshness Settings**
   - Let users define what "fresh" means to them
   - Customizable highlighting thresholds

3. **Real-time Updates**
   - WebSocket connection for live updates
   - Show articles as they arrive

## Technical Implementation Notes

### Example Enhanced Timestamp Component

```typescript
const EnhancedTimestamp = ({ date }: { date: Date }) => {
  const now = new Date();
  const articleDate = new Date(date);
  const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);

  const formatTimestamp = () => {
    if (hoursDiff < 1) return { text: "Just now", fresh: true };
    if (hoursDiff < 24 && articleDate.getDate() === now.getDate()) {
      return { text: `Today at ${articleDate.toLocaleTimeString()}`, fresh: true };
    }
    // ... more formatting logic
  };

  const { text, fresh } = formatTimestamp();

  return (
    <time
      dateTime={articleDate.toISOString()}
      title={articleDate.toLocaleString()}
      className={fresh ? "text-green-600" : "text-muted-foreground"}
    >
      {text}
      {fresh && <span className="ml-1 text-xs">NEW</span>}
    </time>
  );
};
```

## Conclusion

The freshness perception issue is likely caused by a combination of:

1. Relative time display without context
2. No visual differentiation for recent content
3. Fixed sync schedule creating long gaps
4. Lack of transparency about sync timing

Implementing the immediate improvements would significantly enhance the perception of content freshness without requiring major architectural changes.
