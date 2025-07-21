'use client';

import { useEffect } from 'react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useSyncStore } from '@/lib/stores/sync-store';
import { Loader2 } from 'lucide-react';

interface SimpleFeedSidebarProps {
  selectedFeedId: string | null;
  onFeedSelect: (feedId: string | null) => void;
}

export function SimpleFeedSidebar({ selectedFeedId, onFeedSelect }: SimpleFeedSidebarProps) {
  const { feeds, feedsWithCounts, totalUnreadCount, loadFeedHierarchy } = useFeedStore();
  const { isSyncing, lastSyncTime, performFullSync, syncError, syncProgress, syncMessage, rateLimit } = useSyncStore();
  
  // Load feeds when component mounts
  useEffect(() => {
    loadFeedHierarchy();
  }, [loadFeedHierarchy]);
  
  // Remove sync parameter from URL if present (cleanup from old behavior)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sync') === 'true') {
        // Remove sync param to prevent confusion
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('sync');
        window.history.replaceState({}, '', newUrl.pathname);
      }
    }
  }, []);

  return (
    <div className="w-80 border-r bg-muted/10 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Feeds</h2>
          <button
            onClick={performFullSync}
            disabled={isSyncing}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 relative overflow-hidden min-w-[64px]"
          >
            {isSyncing && syncProgress > 0 && (
              <div 
                className="absolute inset-0 bg-white/20"
                style={{ width: `${syncProgress}%` }}
              />
            )}
            <span className="relative z-10">
              {isSyncing ? (syncProgress > 0 ? `${syncProgress}%` : 'Syncing...') : 'Sync'}
            </span>
          </button>
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
            <p className="text-sm font-medium">{syncMessage || 'Syncing your feeds...'}</p>
            {syncProgress > 0 && (
              <div className="w-full max-w-xs mt-3">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">{syncProgress}%</p>
              </div>
            )}
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

            {/* Empty State */}
            {feeds.size === 0 && !isSyncing && (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">No feeds yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Click the Sync button to load your feeds from Inoreader
                </p>
              </div>
            )}

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
            <div className="p-3 text-xs text-muted-foreground space-y-1">
              {lastSyncTime && (
                <div>Last sync: <span suppressHydrationWarning>{new Date(lastSyncTime).toLocaleTimeString()}</span></div>
              )}
              <div>{feeds.size} feeds total</div>
              {rateLimit && (
                <div className={rateLimit.used >= rateLimit.limit * 0.8 ? 'text-amber-600' : ''}>
                  API usage: {rateLimit.used}/{rateLimit.limit} calls today
                  {rateLimit.used >= rateLimit.limit * 0.95 && (
                    <span className="text-destructive"> (Warning: Near limit!)</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}