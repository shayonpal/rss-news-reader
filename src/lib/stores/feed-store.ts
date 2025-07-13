import { create } from 'zustand';
import { db } from '@/lib/db/database';
import type { Feed, Folder, FeedWithUnreadCount } from '@/types';

interface FeedStoreState {
  // Feed data
  feeds: Map<string, Feed>;
  folders: Map<string, Folder>;
  feedsWithCounts: Map<string, FeedWithUnreadCount>;
  
  // Loading states
  loadingFeeds: boolean;
  feedsError: string | null;
  
  // Unread counts
  totalUnreadCount: number;
  folderUnreadCounts: Map<string, number>;
  
  // Actions
  loadFeedHierarchy: () => Promise<void>;
  getFeed: (id: string) => Feed | undefined;
  getFolder: (id: string) => Folder | undefined;
  
  // Feed operations
  updateFeedTitle: (feedId: string, title: string) => Promise<void>;
  toggleFeedActive: (feedId: string) => Promise<void>;
  moveFeedToFolder: (feedId: string, folderId: string | null) => Promise<void>;
  
  // Folder operations
  createFolder: (name: string, parentId?: string | null) => Promise<string | null>;
  updateFolderTitle: (folderId: string, title: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  
  // Unread count management
  updateUnreadCounts: () => Promise<void>;
  incrementUnreadCount: (feedId: string, delta: number) => void;
  
  // Hierarchy helpers
  getFeedsInFolder: (folderId: string | null) => Feed[];
  getSubfolders: (parentId: string | null) => Folder[];
  getFeedPath: (feedId: string) => string[];
  
  // Utility
  clearError: () => void;
  refreshFeeds: () => Promise<void>;
}

export const useFeedStore = create<FeedStoreState>((set, get) => ({
  // Initial state
  feeds: new Map(),
  folders: new Map(),
  feedsWithCounts: new Map(),
  loadingFeeds: false,
  feedsError: null,
  totalUnreadCount: 0,
  folderUnreadCounts: new Map(),

  // Load feed hierarchy
  loadFeedHierarchy: async () => {
    set({ loadingFeeds: true, feedsError: null });
    
    try {
      // Load all feeds and folders
      const [feedsArray, foldersArray] = await Promise.all([
        db.feeds.toArray(),
        db.folders.orderBy('sortOrder').toArray()
      ]);
      
      // Create maps for quick access
      const feedsMap = new Map<string, Feed>();
      const foldersMap = new Map<string, Folder>();
      
      feedsArray.forEach(feed => feedsMap.set(feed.id, feed));
      foldersArray.forEach(folder => foldersMap.set(folder.id, folder));
      
      set({
        feeds: feedsMap,
        folders: foldersMap,
        loadingFeeds: false
      });
      
      // Load unread counts
      await get().updateUnreadCounts();
    } catch (error) {
      console.error('Failed to load feeds:', error);
      set({
        loadingFeeds: false,
        feedsError: `Failed to load feeds: ${error}`
      });
    }
  },

  // Get single feed
  getFeed: (id: string) => {
    return get().feeds.get(id);
  },

  // Get single folder
  getFolder: (id: string) => {
    return get().folders.get(id);
  },

  // Update feed title
  updateFeedTitle: async (feedId: string, title: string) => {
    try {
      await db.feeds.update(feedId, {
        title,
        customTitle: title,
        updatedAt: new Date()
      });
      
      // Update in store
      const { feeds } = get();
      const feed = feeds.get(feedId);
      if (feed) {
        const updatedFeeds = new Map(feeds);
        updatedFeeds.set(feedId, { ...feed, title, customTitle: title });
        set({ feeds: updatedFeeds });
      }
    } catch (error) {
      console.error('Failed to update feed title:', error);
      set({ feedsError: `Failed to update feed title: ${error}` });
    }
  },

  // Toggle feed active status
  toggleFeedActive: async (feedId: string) => {
    try {
      const feed = await db.feeds.get(feedId);
      if (!feed) return;
      
      const newStatus = !feed.isActive;
      await db.feeds.update(feedId, {
        isActive: newStatus,
        updatedAt: new Date()
      });
      
      // Update in store
      const { feeds } = get();
      const updatedFeeds = new Map(feeds);
      updatedFeeds.set(feedId, { ...feed, isActive: newStatus });
      set({ feeds: updatedFeeds });
    } catch (error) {
      console.error('Failed to toggle feed status:', error);
    }
  },

  // Move feed to folder
  moveFeedToFolder: async (feedId: string, folderId: string | null) => {
    try {
      await db.feeds.update(feedId, {
        folderId,
        updatedAt: new Date()
      });
      
      // Update in store
      const { feeds } = get();
      const feed = feeds.get(feedId);
      if (feed) {
        const updatedFeeds = new Map(feeds);
        updatedFeeds.set(feedId, { ...feed, folderId });
        set({ feeds: updatedFeeds });
      }
      
      // Update unread counts
      await get().updateUnreadCounts();
    } catch (error) {
      console.error('Failed to move feed:', error);
    }
  },

  // Create folder
  createFolder: async (name: string, parentId?: string | null) => {
    try {
      // Get highest sort order
      const folders = await db.folders.toArray();
      const maxSortOrder = Math.max(...folders.map(f => f.sortOrder), 0);
      
      const newFolder: Folder = {
        id: `folder_${Date.now()}`,
        title: name,
        parentId: parentId || null,
        sortOrder: maxSortOrder + 1,
        unreadCount: 0,
        isExpanded: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.folders.add(newFolder);
      
      // Update in store
      const { folders: foldersMap } = get();
      const updatedFolders = new Map(foldersMap);
      updatedFolders.set(newFolder.id, newFolder);
      set({ folders: updatedFolders });
      
      return newFolder.id;
    } catch (error) {
      console.error('Failed to create folder:', error);
      set({ feedsError: `Failed to create folder: ${error}` });
      return null;
    }
  },

  // Update folder title
  updateFolderTitle: async (folderId: string, title: string) => {
    try {
      await db.folders.update(folderId, {
        title,
        updatedAt: new Date()
      });
      
      // Update in store
      const { folders } = get();
      const folder = folders.get(folderId);
      if (folder) {
        const updatedFolders = new Map(folders);
        updatedFolders.set(folderId, { ...folder, title });
        set({ folders: updatedFolders });
      }
    } catch (error) {
      console.error('Failed to update folder title:', error);
    }
  },

  // Delete folder
  deleteFolder: async (folderId: string) => {
    try {
      // Move all feeds in this folder to root
      await db.feeds.where('folderId').equals(folderId).modify({
        folderId: null,
        updatedAt: new Date()
      });
      
      // Move all subfolders to root
      await db.folders.where('parentId').equals(folderId).modify({
        parentId: null,
        updatedAt: new Date()
      });
      
      // Delete the folder
      await db.folders.delete(folderId);
      
      // Reload hierarchy
      await get().loadFeedHierarchy();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      set({ feedsError: `Failed to delete folder: ${error}` });
    }
  },

  // Update unread counts
  updateUnreadCounts: async () => {
    try {
      const { feeds, folders } = get();
      const feedsWithCounts = new Map<string, FeedWithUnreadCount>();
      const folderCounts = new Map<string, number>();
      let totalUnread = 0;
      
      // Calculate unread counts for each feed
      for (const [feedId, feed] of Array.from(feeds.entries())) {
        const unreadCount = await db.articles
          .where('feedId')
          .equals(feedId)
          .and(article => !article.isRead)
          .count();
        
        feedsWithCounts.set(feedId, { ...feed, unreadCount });
        totalUnread += unreadCount;
        
        // Add to folder count
        if (feed.folderId) {
          const currentCount = folderCounts.get(feed.folderId) || 0;
          folderCounts.set(feed.folderId, currentCount + unreadCount);
        }
      }
      
      // Propagate folder counts up the hierarchy
      const propagateCount = (folderId: string, count: number) => {
        const folder = folders.get(folderId);
        if (folder?.parentId) {
          const parentCount = folderCounts.get(folder.parentId) || 0;
          folderCounts.set(folder.parentId, parentCount + count);
          propagateCount(folder.parentId, count);
        }
      };
      
      for (const [folderId, count] of Array.from(folderCounts.entries())) {
        const folder = folders.get(folderId);
        if (folder?.parentId) {
          propagateCount(folder.parentId, count);
        }
      }
      
      set({
        feedsWithCounts,
        folderUnreadCounts: folderCounts,
        totalUnreadCount: totalUnread
      });
    } catch (error) {
      console.error('Failed to update unread counts:', error);
    }
  },

  // Increment unread count (for real-time updates)
  incrementUnreadCount: (feedId: string, delta: number) => {
    const { feedsWithCounts, folderUnreadCounts, folders, totalUnreadCount } = get();
    
    // Update feed count
    const feedWithCount = feedsWithCounts.get(feedId);
    if (feedWithCount) {
      const updatedFeedsWithCounts = new Map(feedsWithCounts);
      updatedFeedsWithCounts.set(feedId, {
        ...feedWithCount,
        unreadCount: Math.max(0, feedWithCount.unreadCount + delta)
      });
      
      // Update folder counts
      const updatedFolderCounts = new Map(folderUnreadCounts);
      let currentFolderId = feedWithCount.folderId;
      
      while (currentFolderId) {
        const currentCount = updatedFolderCounts.get(currentFolderId) || 0;
        updatedFolderCounts.set(currentFolderId, Math.max(0, currentCount + delta));
        
        const folder = folders.get(currentFolderId);
        currentFolderId = folder?.parentId || null;
      }
      
      set({
        feedsWithCounts: updatedFeedsWithCounts,
        folderUnreadCounts: updatedFolderCounts,
        totalUnreadCount: Math.max(0, totalUnreadCount + delta)
      });
    }
  },

  // Get feeds in folder
  getFeedsInFolder: (folderId: string | null) => {
    const { feeds } = get();
    return Array.from(feeds.values()).filter(feed => feed.folderId === folderId);
  },

  // Get subfolders
  getSubfolders: (parentId: string | null) => {
    const { folders } = get();
    return Array.from(folders.values())
      .filter(folder => folder.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  // Get feed path (breadcrumb)
  getFeedPath: (feedId: string) => {
    const { feeds, folders } = get();
    const path: string[] = [];
    
    const feed = feeds.get(feedId);
    if (!feed) return path;
    
    let currentFolderId = feed.folderId;
    while (currentFolderId) {
      const folder = folders.get(currentFolderId);
      if (!folder) break;
      
      path.unshift(folder.title);
      currentFolderId = folder.parentId;
    }
    
    return path;
  },

  // Utility
  clearError: () => set({ feedsError: null }),
  
  refreshFeeds: async () => {
    await get().loadFeedHierarchy();
  }
}));