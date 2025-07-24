# Tab Navigation Component

## Overview
This document defines the implementation structure for the iOS 26-style bottom tab navigation, replacing the current hamburger menu pattern with a persistent, glass-morphic tab bar.

## Component Structure

### Tab Configuration
```typescript
// Tab item interface
interface TabItem {
  id: 'articles' | 'feeds' | 'stats' | 'settings';
  label: string;
  shortLabel: string;
  icon: {
    outline: IconComponent;
    solid: IconComponent;
  };
  badge?: number | null;
  route: string;
}

// Navigation configuration
const navigationTabs: TabItem[] = [
  {
    id: 'articles',
    label: 'Articles',
    shortLabel: 'Articles',
    icon: {
      outline: BookOpenIcon,
      solid: BookIcon,
    },
    badge: null, // Badge removed as filtering happens in-page
    route: '/reader'
  },
  {
    id: 'feeds',
    label: 'Feeds',
    shortLabel: 'Feeds',
    icon: {
      outline: RssIcon,
      solid: RadioIcon,
    },
    badge: null,
    route: '/reader/feeds'
  },
  {
    id: 'stats',
    label: 'Statistics',
    shortLabel: 'Stats',
    icon: {
      outline: BarChart3Icon,
      solid: BarChartIcon,
    },
    badge: null,
    route: '/reader/stats'
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: {
      outline: SettingsIcon,
      solid: CogIcon,
    },
    badge: null,
    route: '/reader/settings'
  }
];
```

## Component Implementation

### Main Tab Bar Component
```tsx
interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isVisible?: boolean;
  badges?: {
    unread?: number;
    feeds?: number;
  };
}

export function TabNavigation({ 
  activeTab, 
  onTabChange, 
  isVisible = true,
  badges = {}
}: TabNavigationProps) {
  const router = useRouter();
  const [isPressed, setIsPressed] = useState<string | null>(null);

  const handleTabPress = (tab: TabItem) => {
    setIsPressed(tab.id);
    
    // Haptic feedback on iOS
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    // Navigate and update state
    onTabChange(tab.id);
    router.push(tab.route);
    
    // Reset pressed state
    setTimeout(() => setIsPressed(null), 100);
  };

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "px-safe pb-safe", // Safe area padding
        "transition-transform duration-500",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="glass-tab-bar mx-auto max-w-md">
        <div className="flex items-center justify-around px-2 py-2">
          {navigationTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              isPressed={isPressed === tab.id}
              badge={badges[tab.id]}
              onPress={handleTabPress}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
```

### Individual Tab Button
```tsx
interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  isPressed: boolean;
  badge?: number;
  onPress: (tab: TabItem) => void;
}

function TabButton({ 
  tab, 
  isActive, 
  isPressed,
  badge,
  onPress 
}: TabButtonProps) {
  const Icon = isActive ? tab.icon.solid : tab.icon.outline;
  
  return (
    <button
      onClick={() => onPress(tab)}
      className={cn(
        "group relative flex flex-col items-center justify-center",
        "min-w-[60px] min-h-[44px] px-4 py-3",
        "rounded-2xl transition-all duration-300",
        "transform-gpu", // GPU acceleration
        isActive && "glass-tab-active",
        isPressed && "scale-95",
        !isActive && "hover:bg-white/30 dark:hover:bg-slate-700/30"
      )}
      aria-label={tab.label}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Glass overlay for active state */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl glass-shine" />
      )}
      
      {/* Badge */}
      {badge !== null && badge !== undefined && badge > 0 && (
        <span className={cn(
          "absolute -top-1 -right-1",
          "min-w-[18px] h-[18px] px-1",
          "rounded-full bg-blue-500 text-white",
          "text-[10px] font-medium",
          "flex items-center justify-center",
          "transform transition-transform",
          isActive && "scale-110"
        )}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      
      {/* Icon with morph animation */}
      <div className="relative w-6 h-6 mb-1">
        <Icon
          className={cn(
            "w-6 h-6 transition-all duration-300",
            isActive ? [
              "text-blue-600 dark:text-blue-400",
              "scale-110 drop-shadow-lg"
            ] : [
              "text-slate-600 dark:text-slate-400",
              "group-hover:text-slate-800 dark:group-hover:text-slate-200"
            ]
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />
      </div>
      
      {/* Label */}
      <span
        className={cn(
          "text-xs transition-all duration-300",
          isActive ? [
            "text-blue-600 dark:text-blue-400",
            "font-semibold"
          ] : [
            "text-slate-600 dark:text-slate-400",
            "font-medium",
            "group-hover:text-slate-800 dark:group-hover:text-slate-200"
          ]
        )}
      >
        {tab.shortLabel}
      </span>
    </button>
  );
}
```

## State Management

### Tab Navigation Store
```typescript
// stores/navigation-store.ts
interface NavigationStore {
  activeTab: TabId;
  isTabBarVisible: boolean;
  // Article filter state persists across tab switches
  articleFilter: FilterState;
  setActiveTab: (tab: TabId) => void;
  setTabBarVisible: (visible: boolean) => void;
  setArticleFilter: (filter: FilterState) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activeTab: 'articles',
  isTabBarVisible: true,
  articleFilter: {
    readStatus: 'unread',
    sourceType: 'all',
    sourceId: null,
    sourceTitle: ''
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTabBarVisible: (visible) => set({ isTabBarVisible: visible }),
  setArticleFilter: (filter) => set({ articleFilter: filter }),
}));
```

### Feed Navigation Integration
```typescript
// Handle feed/folder selection from Feeds tab
export function useFeedNavigation() {
  const { setActiveTab, setArticleFilter } = useNavigationStore();
  
  const navigateToArticles = (filter: Partial<FilterState>) => {
    setArticleFilter(prev => ({
      ...prev,
      ...filter
    }));
    setActiveTab('articles');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleFolderSelect = (folderId: number, folderTitle: string) => {
    navigateToArticles({
      sourceType: 'folder',
      sourceId: folderId,
      sourceTitle: folderTitle
    });
  };
  
  const handleFeedSelect = (feedId: number, feedTitle: string) => {
    navigateToArticles({
      sourceType: 'feed',
      sourceId: feedId,
      sourceTitle: feedTitle
    });
  };
  
  return { handleFolderSelect, handleFeedSelect };
}
```

## Layout Integration

### App Layout Changes
```tsx
// app/layout.tsx modifications
export default function RootLayout({ children }) {
  const { activeTab, isTabBarVisible } = useNavigationStore();
  useTabBadges(); // Sync badge counts
  
  return (
    <html>
      <body>
        <div className="flex flex-col min-h-screen">
          {/* Content area with padding for tab bar */}
          <main className={cn(
            "flex-1",
            isTabBarVisible && "pb-[76px]" // Tab bar height + padding
          )}>
            {children}
          </main>
          
          {/* Tab navigation */}
          <TabNavigation 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isVisible={isTabBarVisible}
          />
        </div>
      </body>
    </html>
  );
}
```

### Header Modifications
```tsx
// Remove menu button, keep only sync and theme
export function Header() {
  return (
    <header className="glass-header">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-2xl font-semibold">
          {getPageTitle(activeTab)}
        </h1>
        
        <div className="flex items-center gap-3">
          <SyncButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

## Route Structure

### Updated Routes
```
/reader              → Articles (with persistent filter state)
/reader/feeds        → Feeds list with drill-down navigation
/reader/stats        → Statistics dashboard
/reader/settings     → Settings page
/reader/article/[id] → Article detail view
```

### Filter State Persistence
```typescript
// Article filters are maintained in navigation store
// No URL params needed - filter state persists across navigation
interface FilterState {
  readStatus: 'all' | 'unread' | 'read';
  sourceType: 'all' | 'folder' | 'feed';
  sourceId: number | null;
  sourceTitle: string;
}
```

## Responsive Behavior

### Visibility Rules
```typescript
// Hide tab bar on article detail for more reading space
useEffect(() => {
  const isArticleDetail = pathname.includes('/article/');
  setTabBarVisible(!isArticleDetail);
}, [pathname]);

// Auto-hide on scroll (optional)
export function useAutoHideTabBar() {
  const [lastScrollY, setLastScrollY] = useState(0);
  const { setTabBarVisible } = useNavigationStore();
  
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setTabBarVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setTabBarVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);
}
```

## Icon Implementation

### SF Symbols + Heroicons Setup
```tsx
// icons/navigation-icons.tsx
import { 
  Circle,
  CircleDot,
  FileText,
  Rss,
  ChartBar,
  Settings 
} from 'lucide-react'; // or heroicons

// Map to filled variants (from Lucide or Heroicons)
export const navigationIcons = {
  articles: {
    outline: BookOpen,
    solid: Book,
  },
  feeds: {
    outline: Rss,
    solid: Radio, // Alternative filled RSS icon
  },
  stats: {
    outline: BarChart3,
    solid: BarChart,
  },
  settings: {
    outline: Settings,
    solid: Cog,
  }
};
```

## Accessibility

### ARIA Implementation
```tsx
<nav role="navigation" aria-label="Main navigation">
  <ul role="tablist" className="flex">
    {tabs.map(tab => (
      <li role="presentation" key={tab.id}>
        <button
          role="tab"
          aria-selected={isActive}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
        >
          {/* Tab content */}
        </button>
      </li>
    ))}
  </ul>
</nav>
```

### Keyboard Navigation
```typescript
// Add keyboard support
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    
    switch(e.key) {
      case 'ArrowLeft':
        const prevTab = tabs[currentIndex - 1] || tabs[tabs.length - 1];
        setActiveTab(prevTab.id);
        break;
      case 'ArrowRight':
        const nextTab = tabs[currentIndex + 1] || tabs[0];
        setActiveTab(nextTab.id);
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [activeTab]);
```

## Testing Considerations

1. **Touch targets**: Ensure 44x44pt minimum
2. **Icon morphing**: Smooth transition between outline/filled states
3. **Micro-bounce**: Scale animation on press (0.95 → 1.0)
4. **Filter persistence**: Maintain filter state when switching tabs
5. **Animation performance**: 60fps on all devices
6. **Haptic feedback**: `navigator.vibrate(10)` on tab press