'use client';

import { useEffect, useState } from 'react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useSyncStore } from '@/lib/stores/sync-store';
import { FeedTreeItem } from './feed-tree-item';
import { cn } from '@/lib/utils';
import { Loader2, WifiOff, AlertCircle } from 'lucide-react';

interface FeedListProps {
  selectedFeedId: string | null;
  onFeedSelect: (feedId: string | null) => void;
  className?: string;
}

export function FeedList({ selectedFeedId, onFeedSelect, className }: FeedListProps) {
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
  
  const { isSyncing, lastSyncTime, syncError } = useSyncStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFeedHierarchy();
  }, [loadFeedHierarchy]);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
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
          title={folder.title}
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
          title={feed.title}
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
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
            {!navigator.onLine && (
              <>
                <WifiOff className="h-3 w-3" />
                <span>Offline</span>
              </>
            )}
            {!isSyncing && !syncError && navigator.onLine && lastSyncTime && (
              <span>
                Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
              </span>
            )}
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