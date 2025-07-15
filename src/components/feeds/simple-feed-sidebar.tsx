'use client';

import { useEffect, useRef } from 'react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useSyncStore } from '@/lib/stores/sync-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SimpleFeedSidebarProps {
  selectedFeedId: string | null;
  onFeedSelect: (feedId: string | null) => void;
}

export function SimpleFeedSidebar({ selectedFeedId, onFeedSelect }: SimpleFeedSidebarProps) {
  const router = useRouter();
  const { feeds, feedsWithCounts, totalUnreadCount } = useFeedStore();
  const { isSyncing, lastSyncTime, performFullSync, syncError } = useSyncStore();
  const { logout } = useAuthStore();
  const hasTriggeredAutoSync = useRef(false);

  // Auto-sync on mount if no feeds exist
  useEffect(() => {
    const shouldAutoSync = () => {
      // Check URL parameters for sync flag
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('sync') === 'true') {
          // Remove sync param to prevent re-sync on refresh
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('sync');
          window.history.replaceState({}, '', newUrl.pathname);
          return true;
        }
      }

      // Auto-sync if no feeds and haven't synced recently
      if (feeds.size === 0 && !lastSyncTime && !hasTriggeredAutoSync.current) {
        return true;
      }

      return false;
    };

    if (shouldAutoSync() && !isSyncing) {
      hasTriggeredAutoSync.current = true;
      performFullSync();
    }
  }, [feeds.size, isSyncing, lastSyncTime, performFullSync]);

  return (
    <div className="w-80 border-r bg-muted/10 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Feeds</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={performFullSync}
              disabled={isSyncing}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={async () => {
                await logout();
                router.push('/');
              }}
              className="p-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalUnreadCount} unread articles
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading State for Initial Sync */}
        {isSyncing && feeds.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Syncing your feeds...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
          </div>
        ) : syncError && feeds.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <p className="text-sm text-destructive mb-2">Failed to sync feeds</p>
            <p className="text-xs text-muted-foreground mb-4">{syncError}</p>
            <button
              onClick={performFullSync}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* All Articles */}
            <div 
              className={`p-3 cursor-pointer hover:bg-muted/50 ${!selectedFeedId ? 'bg-muted font-medium' : ''}`}
              onClick={() => onFeedSelect(null)}
            >
              <div className="flex items-center justify-between">
                <span>All Articles</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {totalUnreadCount}
                </span>
              </div>
            </div>

            {/* Individual Feeds */}
            {Array.from(feeds.values()).map((feed) => {
          const feedWithCount = feedsWithCounts.get(feed.id);
          const unreadCount = feedWithCount?.unreadCount || 0;
          
          return (
            <div
              key={feed.id}
              className={`p-3 cursor-pointer hover:bg-muted/50 ${selectedFeedId === feed.id ? 'bg-muted font-medium' : ''}`}
              onClick={() => onFeedSelect(feed.id)}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{String(feed.title || 'Untitled Feed')}</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {unreadCount > 999 ? '999+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}

            {/* Status */}
            <div className="p-3 text-xs text-muted-foreground">
              {lastSyncTime && (
                <div>Last sync: <span suppressHydrationWarning>{new Date(lastSyncTime).toLocaleTimeString()}</span></div>
              )}
              <div>{feeds.size} feeds total</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}