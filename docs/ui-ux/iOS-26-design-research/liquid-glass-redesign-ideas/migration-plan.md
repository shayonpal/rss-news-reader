# Migration Plan: Hamburger Menu to Tab Navigation

## Overview
This document outlines the step-by-step plan to migrate from the current hamburger menu + sidebar pattern to the iOS 26-style bottom tab navigation.

## Components to Remove

### 1. Sidebar Components
```
src/components/feeds/feed-sidebar.tsx       → DELETE
src/components/feeds/simple-feed-sidebar.tsx → DELETE
src/lib/stores/ui-store.ts (sidebar logic)  → MODIFY
```

### 2. Menu Button
```typescript
// In src/components/layout/header.tsx
// REMOVE:
import { Menu } from 'lucide-react';

// REMOVE:
<Button
  variant="ghost"
  size="icon"
  onClick={toggleSidebar}
  className="mr-2 h-9 w-9"
  aria-label="Open menu"
>
  <Menu className="h-5 w-5" />
</Button>
```

### 3. UI Store Sidebar Logic
```typescript
// In src/lib/stores/ui-store.ts
// REMOVE these properties and methods:
interface UIStore {
  isSidebarOpen: boolean;        // DELETE
  toggleSidebar: () => void;      // DELETE
  setSidebarOpen: () => void;     // DELETE
  // Keep other UI state
}
```

## Code Modifications

### 1. Update Layout Structure
```tsx
// src/app/layout.tsx
// BEFORE:
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <div className="flex h-screen">
          <FeedSidebar />  {/* DELETE THIS */}
          <div className="flex-1">
            <Header />
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

// AFTER:
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 pb-[76px]">
            {children}
          </main>
          <TabNavigation /> {/* NEW */}
        </div>
      </body>
    </html>
  );
}
```

### 2. Simplify Header Component
```tsx
// src/components/layout/header.tsx
// AFTER:
export function Header() {
  const { isSyncing, performFullSync } = useSyncStore();
  const pathname = usePathname();
  
  // Dynamic title based on route
  const getTitle = () => {
    if (pathname.includes('unread')) return 'Unread Articles';
    if (pathname.includes('feeds')) return 'Feeds & Folders';
    if (pathname.includes('stats')) return 'Statistics';
    return 'All Articles';
  };

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="container flex h-14 items-center justify-between">
        <h1 className="text-lg font-semibold">
          {getTitle()}
        </h1>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={performFullSync}
            disabled={isSyncing}
            className="glass-minimal shape-capsule"
          >
            <RefreshCw className={cn(
              "h-5 w-5",
              isSyncing && "animate-spin"
            )} />
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

### 3. Create New Routes

#### Feeds List Page with Drill-Down Navigation
```tsx
// src/app/reader/feeds/page.tsx (NEW)
export default function FeedsPage() {
  const { feeds, folders } = useFeedStore();
  const { handleFolderSelect, handleFeedSelect } = useFeedNavigation();
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  return (
    <div className="container py-4">
      <div className="space-y-2">
        {folders.map(folder => (
          <div key={folder.id}>
            {/* Folder row - clickable for navigation */}
            <button
              onClick={() => handleFolderSelect(folder.id, folder.name)}
              className="w-full glass-card-minimal"
            >
              <div className="flex items-center gap-3 p-3">
                {/* Expand/collapse button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(folder.id);
                  }}
                  className="p-1 hover:bg-white/30"
                >
                  <ChevronIcon expanded={expandedFolders.has(folder.id)} />
                </button>
                
                <FolderIcon />
                <span className="flex-1">{folder.name}</span>
                <Badge count={folder.unread_count} />
              </div>
            </button>
            
            {/* Expanded feeds */}
            {expandedFolders.has(folder.id) && (
              <div className="ml-6 space-y-1">
                {feeds
                  .filter(f => f.folder_id === folder.id)
                  .map(feed => (
                    <FeedListItem 
                      key={feed.id} 
                      feed={feed}
                      onClick={() => handleFeedSelect(feed.id, feed.title)}
                    />
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Stats & Settings Pages
```tsx
// src/app/reader/stats/page.tsx (NEW)
export default function StatsPage() {
  // Placeholder for now - to be expanded
  return (
    <div className="container py-4">
      <div className="glass-card p-6">
        <h2>Statistics Dashboard</h2>
        {/* Stats content */}
      </div>
    </div>
  );
}

// src/app/reader/settings/page.tsx (NEW)
export default function SettingsPage() {
  return (
    <div className="container py-4">
      <div className="glass-card p-6">
        <h2>Settings</h2>
        {/* Settings content */}
      </div>
    </div>
  );
}
```

### 4. Update Article List with Dual Filtering
```tsx
// src/app/reader/page.tsx
export default function ReaderPage() {
  const { articleFilter } = useNavigationStore();
  const { articles } = useArticleStore();
  const isFilterVisible = useFloatingFilter();
  
  const filteredArticles = filterArticles(articles, articleFilter);
  
  return (
    <div className="container">
      {/* Floating read status filter */}
      <FloatingFilterPill
        currentFilter={articleFilter.readStatus}
        onFilterChange={handleReadStatusChange}
        isVisible={isFilterVisible}
      />
      
      <ArticleList articles={filteredArticles} />
    </div>
  );
}
```

## CSS Cleanup

### Remove Sidebar Styles
```css
/* DELETE from globals.css */
.sidebar-container { ... }
.sidebar-scroll { ... }
.feed-tree { ... }

/* ADD new utility classes */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

.px-safe {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

## Migration Steps

### Phase 1: Preparation (Day 1)
1. Create new tab navigation component
2. Add new route files for feeds and stats pages
3. Update navigation store
4. Test tab navigation in isolation

### Phase 2: Integration (Day 2)
1. Update app layout to include tab navigation
2. Modify header component (remove menu button)
3. Wire up route navigation
4. Test navigation flow

### Phase 3: Cleanup (Day 3)
1. Remove sidebar components
2. Clean up UI store
3. Remove unused CSS
4. Update imports

### Phase 4: Polish (Day 4)
1. Add glass morphism styles
2. Implement badge updates
3. Add animations
4. Test on all devices

## Rollback Plan

If issues arise, revert by:
1. Git revert to previous commit
2. Re-enable sidebar components
3. Hide tab navigation with feature flag

```typescript
// Quick toggle for testing
const USE_TAB_NAV = process.env.NEXT_PUBLIC_USE_TAB_NAV === 'true';

export default function Layout() {
  return (
    <>
      {!USE_TAB_NAV && <FeedSidebar />}
      {USE_TAB_NAV && <TabNavigation />}
    </>
  );
}
```

## Testing Checklist

### Functionality
- [ ] All navigation routes work
- [ ] Badge counts update correctly
- [ ] Active states display properly
- [ ] Back/forward navigation works
- [ ] Deep links function correctly

### Visual
- [ ] Glass effects render properly
- [ ] Dark mode looks correct
- [ ] Animations are smooth (60fps)
- [ ] No layout shifts
- [ ] Proper safe area handling

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen readers announce correctly
- [ ] Touch targets are 44x44pt minimum
- [ ] Focus indicators visible
- [ ] Reduced motion respected

### Performance
- [ ] No increase in bundle size > 10KB
- [ ] Navigation feels instant
- [ ] No memory leaks
- [ ] Smooth scrolling maintained

## Files Summary

### To Create
```
src/components/navigation/tab-navigation.tsx
src/components/filters/floating-filter-pill.tsx
src/app/reader/feeds/page.tsx
src/app/reader/stats/page.tsx
src/app/reader/settings/page.tsx
src/lib/stores/navigation-store.ts
src/hooks/useFloatingFilter.ts
src/hooks/useFeedNavigation.ts
```

### To Modify
```
src/app/layout.tsx
src/components/layout/header.tsx
src/app/reader/page.tsx
src/app/globals.css
src/components/filters/filter-dropdown.tsx
```

### To Delete
```
src/components/feeds/feed-sidebar.tsx
src/components/feeds/simple-feed-sidebar.tsx
src/components/feeds/feed-tree-item.tsx
```

## Success Criteria

1. **User Experience**: Navigation is faster and more intuitive
2. **Performance**: No degradation in app performance
3. **Consistency**: Feels native on iOS devices
4. **Accessibility**: Meets WCAG 2.1 AA standards
5. **Code Quality**: Cleaner, more maintainable structure