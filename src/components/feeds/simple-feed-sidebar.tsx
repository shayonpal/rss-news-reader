'use client';

import { useFeedStore } from '@/lib/stores/feed-store';
import { useSyncStore } from '@/lib/stores/sync-store';

interface SimpleFeedSidebarProps {
  selectedFeedId: string | null;
  onFeedSelect: (feedId: string | null) => void;
}

export function SimpleFeedSidebar({ selectedFeedId, onFeedSelect }: SimpleFeedSidebarProps) {
  const { feeds, feedsWithCounts, totalUnreadCount } = useFeedStore();
  const { isSyncing, lastSyncTime, performFullSync } = useSyncStore();

  return (
    <div className="w-80 border-r bg-muted/10 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Feeds</h2>
          <button
            onClick={performFullSync}
            disabled={isSyncing}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {totalUnreadCount} unread articles
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto">
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
            <div>Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</div>
          )}
          <div>{feeds.size} feeds total</div>
        </div>
      </div>
    </div>
  );
}