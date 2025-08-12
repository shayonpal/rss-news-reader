# Feed Drill-Down Navigation Pattern

## Overview

The feed drill-down navigation allows users to navigate from the Feeds tab to filtered article views by tapping on folders or individual feeds, while maintaining expand/collapse functionality for organizing the feed list.

## Interaction Model

### Dual-Purpose UI Elements

```
Feeds List
├── [Chevron] [Folder Icon] Technology (40)     ← Tap row: Show all articles from folder
│   └── Expanded View (tap chevron to toggle)
│       ├── TechCrunch (12)                      ← Tap: Show only TechCrunch articles
│       ├── The Verge (8)                        ← Tap: Show only The Verge articles
│       └── Ars Technica (20)                    ← Tap: Show only Ars Technica articles
└── [Chevron] [Folder Icon] News (48)           ← Tap row: Show all articles from folder
```

### Click Targets

1. **Chevron Button**: Toggle expand/collapse (stays on Feeds tab)
2. **Folder Row**: Navigate to Articles tab with folder filter
3. **Feed Row**: Navigate to Articles tab with feed filter

## Implementation

### Feed List Component

```tsx
interface FeedListProps {
  onFeedSelect: (feedId: number, feedTitle: string) => void;
  onFolderSelect: (folderId: number, folderTitle: string) => void;
}

export function FeedsList({ onFeedSelect, onFolderSelect }: FeedListProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set()
  );

  const toggleFolder = (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent folder navigation
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleFolderClick = (folder: Folder) => {
    onFolderSelect(folder.id, folder.name);
  };

  const handleFeedClick = (feed: Feed, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent folder selection
    onFeedSelect(feed.id, feed.title);
  };

  return (
    <div className="space-y-2">
      {folders.map((folder) => (
        <div key={folder.id}>
          {/* Folder Header - Clickable for navigation */}
          <button
            onClick={() => handleFolderClick(folder)}
            className="group w-full cursor-pointer"
          >
            <div className="glass-card-minimal hover:glass-card p-3">
              <div className="flex items-center gap-3">
                {/* Expand/Collapse Button */}
                <button
                  onClick={(e) => toggleFolder(folder.id, e)}
                  className="rounded-lg p-1 hover:bg-white/30"
                  aria-label={
                    expandedFolders.has(folder.id) ? "Collapse" : "Expand"
                  }
                >
                  {expandedFolders.has(folder.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {/* Folder Info */}
                <FolderIcon className="h-5 w-5" />
                <span className="flex-1 font-semibold">{folder.name}</span>
                <Badge count={folder.unread_count} />
              </div>
            </div>
          </button>

          {/* Expanded Feeds */}
          {expandedFolders.has(folder.id) && (
            <div className="ml-6 mt-1 space-y-1">
              {folder.feeds.map((feed) => (
                <button
                  key={feed.id}
                  onClick={(e) => handleFeedClick(feed, e)}
                  className="group w-full"
                >
                  <div className="glass-card-minimal hover:glass-card p-3">
                    <div className="flex items-center gap-3">
                      <RssIcon className="h-4 w-4" />
                      <span className="flex-1 text-sm">{feed.title}</span>
                      <Badge count={feed.unread_count} size="sm" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Navigation Hook

```typescript
export function useFeedNavigation() {
  const { setActiveTab, setArticleFilter } = useNavigationStore();
  const router = useRouter();

  const navigateToArticles = (filter: Partial<FilterState>) => {
    // Update filter state
    setArticleFilter((prev) => ({
      ...prev,
      ...filter,
    }));

    // Switch to Articles tab
    setActiveTab("articles");

    // Smooth transition
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const handleFolderSelect = (folderId: number, folderTitle: string) => {
    navigateToArticles({
      sourceType: "folder",
      sourceId: folderId,
      sourceTitle: folderTitle,
    });
  };

  const handleFeedSelect = (feedId: number, feedTitle: string) => {
    navigateToArticles({
      sourceType: "feed",
      sourceId: feedId,
      sourceTitle: feedTitle,
    });
  };

  return { handleFolderSelect, handleFeedSelect };
}
```

### Filter State Management

```typescript
interface FilterState {
  readStatus: "all" | "unread" | "read";
  sourceType: "all" | "folder" | "feed";
  sourceId: number | null;
  sourceTitle: string;
}

// Navigation store maintains filter state
const useNavigationStore = create((set) => ({
  articleFilter: {
    readStatus: "unread", // Default to unread
    sourceType: "all",
    sourceId: null,
    sourceTitle: "",
  },

  setArticleFilter: (filter: FilterState) => set({ articleFilter: filter }),

  // Preserve read status when changing source
  updateSource: (source: Partial<FilterState>) =>
    set((state) => ({
      articleFilter: {
        ...state.articleFilter,
        ...source,
      },
    })),
}));
```

### Article Filtering Logic

```typescript
function filterArticles(articles: Article[], filter: FilterState): Article[] {
  let filtered = articles;

  // Apply source filter
  if (filter.sourceType === "folder" && filter.sourceId) {
    const feedIds = getFeedIdsByFolder(filter.sourceId);
    filtered = filtered.filter((a) => feedIds.includes(a.feed_id));
  } else if (filter.sourceType === "feed" && filter.sourceId) {
    filtered = filtered.filter((a) => a.feed_id === filter.sourceId);
  }

  // Apply read status filter
  if (filter.readStatus === "unread") {
    filtered = filtered.filter((a) => !a.is_read);
  } else if (filter.readStatus === "read") {
    filtered = filtered.filter((a) => a.is_read);
  }

  return filtered;
}
```

## Visual Feedback

### Hover States

```css
/* Folder row hover */
.folder-row:hover {
  transform: scale(1.002);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

/* Feed row hover */
.feed-row:hover {
  transform: scale(1.002);
  background: rgba(255, 255, 255, 0.45);
}

/* Chevron button hover */
.chevron-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}
```

### Active States

```css
/* Pressed state */
.folder-row:active,
.feed-row:active {
  transform: scale(0.998);
}

/* Navigation in progress */
.navigating {
  opacity: 0.8;
  pointer-events: none;
}
```

## User Experience Flow

1. **User taps folder row**
   - Navigate to Articles tab
   - Show all articles from that folder's feeds
   - Header shows folder name
   - Read status filter persists

2. **User taps chevron**
   - Folder expands/collapses
   - Stay on Feeds tab
   - Smooth height animation

3. **User taps feed row**
   - Navigate to Articles tab
   - Show only that feed's articles
   - Header shows feed name
   - Read status filter persists

4. **Return to Feeds**
   - Tap Feeds tab
   - Previous expansion state maintained
   - Filter state preserved for next visit

## Animation Details

### Expand/Collapse Animation

```css
@keyframes expand-folder {
  from {
    height: 0;
    opacity: 0;
  }
  to {
    height: var(--content-height);
    opacity: 1;
  }
}

.folder-content {
  overflow: hidden;
  animation: expand-folder 300ms ease-out;
}
```

### Navigation Transition

```typescript
// Smooth transition when navigating
const handleNavigation = async (filter: FilterState) => {
  // Start transition
  setTransitioning(true);

  // Update filter
  setArticleFilter(filter);

  // Wait for tab animation
  await sleep(200);

  // Switch tab
  setActiveTab("articles");

  // Complete transition
  setTransitioning(false);
};
```

## Accessibility

1. **Keyboard Navigation**
   - Tab through folders and feeds
   - Space/Enter to select
   - Arrow keys for expand/collapse

2. **Screen Readers**
   - Announce folder/feed names
   - State changes (expanded/collapsed)
   - Navigation announcements

3. **Focus Management**
   - Maintain focus on return
   - Focus first article after navigation
   - Trap focus in expanded sections

## Best Practices

1. **Performance**
   - Virtualize long feed lists
   - Debounce rapid clicks
   - Preload article data

2. **State Persistence**
   - Remember expansion state
   - Preserve filter selections
   - Cache navigation history

3. **Error Handling**
   - Handle missing feeds gracefully
   - Show loading states
   - Provide retry options
