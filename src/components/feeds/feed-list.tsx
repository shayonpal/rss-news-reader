'use client';

import { useEffect, useState } from 'react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useSyncStore } from '@/lib/stores/sync-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { FeedTreeItem } from './feed-tree-item';
import { cn } from '@/lib/utils';
import { Loader2, WifiOff, AlertCircle, RefreshCw, Sun, Moon, Monitor, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiRateLimiter } from '@/lib/utils/api-rate-limiter';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useRouter } from 'next/navigation';

interface FeedListProps {
  selectedFeedId: string | null;
  onFeedSelect: (feedId: string | null) => void;
  className?: string;
}

export function FeedList({ selectedFeedId, onFeedSelect, className }: FeedListProps) {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const { 
    feeds, 
    folders, 
    feedsWithCounts, 
    folderUnreadCounts,
    totalUnreadCount,
    loadingFeeds, 
    feedsError,
    loadFeedHierarchy,
    getFeedsInFolder,
    getSubfolders 
  } = useFeedStore();
  
  const { isSyncing, lastSyncTime, syncError, performFullSync } = useSyncStore();
  const { theme, setTheme } = useUIStore();
  const { logout } = useAuthStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [apiUsage, setApiUsage] = useState(ApiRateLimiter.getUsagePercentage());

  useEffect(() => {
    loadFeedHierarchy();
  }, [loadFeedHierarchy]);

  useEffect(() => {
    // Don't check sync until feeds have been loaded from DB
    if (loadingFeeds) return;
    
    // Check URL parameters for sync flag
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sync') === 'true') {
        // Remove sync param to prevent re-sync on refresh
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('sync');
        window.history.replaceState({}, '', newUrl.pathname);
        
        // Only sync if database is empty (new user)
        if (feeds.size === 0 && !isSyncing) {
          performFullSync();
          return;
        }
      }
    }
    
    // If no feeds loaded and no last sync time, trigger initial sync
    if (feeds.size === 0 && !lastSyncTime && !isSyncing) {
      performFullSync();
    }
  }, [loadingFeeds, feeds.size, lastSyncTime, isSyncing, performFullSync]); // Proper dependencies

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system'] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const renderFeedTree = (parentId: string | null = null, depth: number = 0) => {
    const subfolders = getSubfolders(parentId);
    const feedsInFolder = getFeedsInFolder(parentId);
    
    const items = [];
    
    // Render subfolders first
    for (const folder of subfolders) {
      items.push(
        <FeedTreeItem
          key={`folder-${folder.id}`}
          type="folder"
          id={folder.id}
          title={String(folder.title || 'Untitled Folder')}
          unreadCount={folderUnreadCounts.get(folder.id) || 0}
          depth={depth}
          isExpanded={expandedFolders.has(folder.id)}
          onToggle={() => toggleFolder(folder.id)}
          isSelected={false}
          onSelect={() => {}}
        >
          {expandedFolders.has(folder.id) && renderFeedTree(folder.id, depth + 1)}
        </FeedTreeItem>
      );
    }
    
    // Then render feeds
    for (const feed of feedsInFolder) {
      const feedWithCount = feedsWithCounts.get(feed.id);
      items.push(
        <FeedTreeItem
          key={`feed-${feed.id}`}
          type="feed"
          id={feed.id}
          title={String(feed.title || 'Untitled Feed')}
          unreadCount={feedWithCount?.unreadCount || 0}
          depth={depth}
          isSelected={selectedFeedId === feed.id}
          onSelect={() => onFeedSelect(feed.id)}
        />
      );
    }
    
    return items;
  };

  if (loadingFeeds) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (feedsError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{feedsError}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Sync Status */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isSyncing && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Syncing...</span>
              </>
            )}
            {syncError && (
              <>
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-destructive">Sync error</span>
              </>
            )}
            {!isOnline && (
              <>
                <WifiOff className="h-3 w-3" />
                <span>Offline</span>
              </>
            )}
            {!isSyncing && !syncError && isOnline && lastSyncTime && (
              <span>
                Last sync: <span suppressHydrationWarning>{new Date(lastSyncTime).toLocaleTimeString()}</span>
              </span>
            )}
            {ApiRateLimiter.shouldWarnUser() && (
              <span className="text-orange-500 text-xs ml-2">
                API: {apiUsage}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={cycleTheme}
              className="h-7 w-7 px-0"
              aria-label={`Switch theme (current: ${theme})`}
              title={`Theme: ${theme}`}
            >
              {getThemeIcon()}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await performFullSync();
                setApiUsage(ApiRateLimiter.getUsagePercentage());
              }}
              disabled={isSyncing || !isOnline}
              className="h-7 px-2"
            >
              <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
              <span className="ml-1 text-xs">Sync</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await logout();
                router.push('/');
              }}
              className="h-7 w-7 px-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {/* All Articles */}
          <FeedTreeItem
            type="all"
            id="all"
            title="All Articles"
            unreadCount={totalUnreadCount}
            depth={0}
            isSelected={selectedFeedId === null}
            onSelect={() => onFeedSelect(null)}
          />
          
          {/* Feed Tree */}
          {renderFeedTree()}
        </div>
      </div>
    </div>
  );
}