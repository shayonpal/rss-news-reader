import { create } from 'zustand';
import { supabase } from '@/lib/db/supabase';
import type { Feed, Folder, FeedWithUnreadCount } from '@/types';
import type { Database } from '@/lib/db/types';

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
    const startTime = performance.now();
    console.log('[FeedStore] Starting loadFeedHierarchy...');
    
    set({ loadingFeeds: true, feedsError: null });
    
    try {
      // Get the single user
      const userStartTime = performance.now();
      const SINGLE_USER_ID = 'shayon';
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('inoreader_id', SINGLE_USER_ID)
        .single();
      console.log(`[FeedStore] User query took ${(performance.now() - userStartTime).toFixed(2)}ms`);

      if (!user) {
        throw new Error('User not found');
      }

      // Load all feeds and folders
      const feedsStartTime = performance.now();
      const [feedsResult, foldersResult] = await Promise.all([
        supabase
          .from('feeds')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .order('name')
      ]);
      console.log(`[FeedStore] Feeds/folders query took ${(performance.now() - feedsStartTime).toFixed(2)}ms`);
      console.log(`[FeedStore] Loaded ${feedsResult.data?.length || 0} feeds and ${foldersResult.data?.length || 0} folders`);
      
      if (feedsResult.error) throw feedsResult.error;
      if (foldersResult.error) throw foldersResult.error;

      // Create maps for quick access
      const feedsMap = new Map<string, Feed>();
      const foldersMap = new Map<string, Folder>();
      
      // Transform database feeds to Feed type
      feedsResult.data?.forEach(feed => {
        feedsMap.set(feed.id, {
          id: feed.id,
          title: feed.title || '',
          customTitle: feed.title,
          url: feed.url || '',
          htmlUrl: feed.url || '',
          iconUrl: undefined,
          folderId: feed.folder_id,
          unreadCount: feed.unread_count || 0,
          isActive: true,
          createdAt: new Date(feed.created_at || Date.now()),
          updatedAt: new Date(feed.updated_at || Date.now()),
          inoreaderId: feed.inoreader_id || undefined
        });
      });

      // Transform database folders to Folder type
      foldersResult.data?.forEach(folder => {
        foldersMap.set(folder.id, {
          id: folder.id,
          title: folder.name || '',
          parentId: folder.parent_id,
          sortOrder: 0,
          unreadCount: 0,
          isExpanded: true,
          createdAt: new Date(folder.created_at || Date.now()),
          updatedAt: new Date(folder.updated_at || Date.now())
        });
      });
      
      const transformStartTime = performance.now();
      console.log(`[FeedStore] Data transformation took ${(performance.now() - transformStartTime).toFixed(2)}ms`);
      
      set({
        feeds: feedsMap,
        folders: foldersMap,
        loadingFeeds: false
      });
      
      // Load unread counts
      const unreadStartTime = performance.now();
      await get().updateUnreadCounts();
      console.log(`[FeedStore] Unread counts update took ${(performance.now() - unreadStartTime).toFixed(2)}ms`);
      console.log(`[FeedStore] Total loadFeedHierarchy took ${(performance.now() - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to load feeds:', error);
      console.log(`[FeedStore] Failed after ${(performance.now() - startTime).toFixed(2)}ms`);
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
      const { error } = await supabase
        .from('feeds')
        .update({ 
          title,
          updated_at: new Date().toISOString()
        })
        .eq('id', feedId);

      if (error) throw error;
      
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
      const { feeds } = get();
      const feed = feeds.get(feedId);
      if (!feed) return;
      
      const newStatus = !feed.isActive;
      
      // Note: Supabase schema doesn't have isActive field, so we'll skip DB update
      // Just update in store for UI purposes
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
      const { error } = await supabase
        .from('feeds')
        .update({ 
          folder_id: folderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', feedId);

      if (error) throw error;
      
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
      // Get the single user
      const SINGLE_USER_ID = 'shayon';
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('inoreader_id', SINGLE_USER_ID)
        .single();

      if (!user) {
        throw new Error('User not found');
      }

      const { data: newFolder, error } = await supabase
        .from('folders')
        .insert({
          user_id: user.id,
          name,
          parent_id: parentId || null,
          inoreader_id: `folder_${Date.now()}` // Generate unique ID
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update in store
      const { folders: foldersMap } = get();
      const updatedFolders = new Map(foldersMap);
      updatedFolders.set(newFolder.id, {
        id: newFolder.id,
        title: newFolder.name || '',
        parentId: newFolder.parent_id,
        sortOrder: 0,
        unreadCount: 0,
        isExpanded: true,
        createdAt: new Date(newFolder.created_at || Date.now()),
        updatedAt: new Date(newFolder.updated_at || Date.now())
      });
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
      const { error } = await supabase
        .from('folders')
        .update({ 
          name: title,
          updated_at: new Date().toISOString()
        })
        .eq('id', folderId);

      if (error) throw error;
      
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
      await supabase
        .from('feeds')
        .update({ 
          folder_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('folder_id', folderId);
      
      // Move all subfolders to root
      await supabase
        .from('folders')
        .update({ 
          parent_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('parent_id', folderId);
      
      // Delete the folder
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
      
      // Reload hierarchy
      await get().loadFeedHierarchy();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      set({ feedsError: `Failed to delete folder: ${error}` });
    }
  },

  // Update unread counts
  updateUnreadCounts: async () => {
    const startTime = performance.now();
    console.log('[FeedStore] Starting updateUnreadCounts...');
    
    try {
      const { feeds, folders } = get();
      const feedsWithCounts = new Map<string, FeedWithUnreadCount>();
      const folderCounts = new Map<string, number>();
      let totalUnread = 0;
      
      console.log(`[FeedStore] Calculating unread counts for ${feeds.size} feeds...`);
      
      // Calculate unread counts for each feed
      const countStartTime = performance.now();
      for (const [feedId, feed] of Array.from(feeds.entries())) {
        const queryStartTime = performance.now();
        const { count, error } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .eq('feed_id', feedId)
          .eq('is_read', false);
        
        if (performance.now() - queryStartTime > 100) {
          console.log(`[FeedStore] Slow unread count query for feed ${feedId}: ${(performance.now() - queryStartTime).toFixed(2)}ms`);
        }
        
        const unreadCount = count || 0;
        
        feedsWithCounts.set(feedId, { ...feed, unreadCount });
        totalUnread += unreadCount;
        
        // Add to folder count
        if (feed.folderId) {
          const currentCount = folderCounts.get(feed.folderId) || 0;
          folderCounts.set(feed.folderId, currentCount + unreadCount);
        }
      }
      console.log(`[FeedStore] Unread count queries took ${(performance.now() - countStartTime).toFixed(2)}ms`);
      console.log(`[FeedStore] Total unread articles: ${totalUnread}`);
      
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
      
      console.log(`[FeedStore] updateUnreadCounts completed in ${(performance.now() - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to update unread counts:', error);
      console.log(`[FeedStore] updateUnreadCounts failed after ${(performance.now() - startTime).toFixed(2)}ms`);
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