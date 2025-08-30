import { create } from "zustand";
import { supabase } from "@/lib/db/supabase";
import type { Feed, Folder, FeedWithUnreadCount } from "@/types";
import type { Database } from "@/lib/db/types";
// Debug utilities archived to tests-archive/debug/ as part of RR-242

interface FeedStoreState {
  // Feed data
  feeds: Map<string, Feed>;
  folders: Map<string, Folder>;
  feedsWithCounts: Map<string, FeedWithUnreadCount>;

  // Loading states
  loadingFeeds: boolean;
  feedsError: string | null;
  isSkeletonLoading: boolean; // Added for RR-171

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
  updateFeedPartialContent: (
    feedId: string,
    isPartialContent: boolean
  ) => Promise<void>;

  // Folder operations
  createFolder: (
    name: string,
    parentId?: string | null
  ) => Promise<string | null>;
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

  // RR-171 additions
  applySidebarCounts: (feedCounts: Array<[string, number]>) => void;
  setSkeletonLoading: (loading: boolean) => void;
}

export const useFeedStore = create<FeedStoreState>((set, get) => ({
  // Initial state
  feeds: new Map(),
  folders: new Map(),
  feedsWithCounts: new Map(),
  loadingFeeds: false,
  feedsError: null,
  isSkeletonLoading: false, // Added for RR-171
  totalUnreadCount: 0,
  folderUnreadCounts: new Map(),

  // Load feed hierarchy
  loadFeedHierarchy: async () => {
    const startTime = performance.now();
    // Debug logging removed as part of RR-242 debug archival

    set({ loadingFeeds: true, feedsError: null });

    try {
      // Get the single user
      const userStartTime = performance.now();
      const SINGLE_USER_ID = "shayon";
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("inoreader_id", SINGLE_USER_ID)
        .single();
      // Debug timing removed as part of RR-242

      if (!user) {
        throw new Error("User not found");
      }

      // Load all feeds and folders
      const feedsStartTime = performance.now();
      const [feedsResult, foldersResult] = await Promise.all([
        supabase.from("feeds").select("*").eq("user_id", user.id),
        supabase
          .from("folders")
          .select("*")
          .eq("user_id", user.id)
          .order("name"),
      ]);
      // Debug timing and logging removed as part of RR-242

      if (feedsResult.error) throw feedsResult.error;
      if (foldersResult.error) throw foldersResult.error;

      // Create maps for quick access
      const feedsMap = new Map<string, Feed>();
      const foldersMap = new Map<string, Folder>();

      // Transform database feeds to Feed type
      feedsResult.data?.forEach((feed) => {
        feedsMap.set(feed.id, {
          id: feed.id,
          title: feed.title || "",
          customTitle: feed.title,
          url: feed.url || "",
          htmlUrl: feed.url || "",
          iconUrl: undefined,
          folderId: feed.folder_id,
          unreadCount: feed.unread_count || 0,
          isActive: true,
          isPartialContent: feed.is_partial_content || false,
          createdAt: new Date(feed.created_at || Date.now()),
          updatedAt: new Date(feed.updated_at || Date.now()),
          inoreaderId: feed.inoreader_id || undefined,
        });
      });

      // Transform database folders to Folder type
      foldersResult.data?.forEach((folder) => {
        foldersMap.set(folder.id, {
          id: folder.id,
          title: folder.name || "",
          parentId: folder.parent_id,
          sortOrder: 0,
          unreadCount: 0,
          isExpanded: true,
          createdAt: new Date(folder.created_at || Date.now()),
          updatedAt: new Date(folder.updated_at || Date.now()),
        });
      });

      // Data transformation timing removed - was instantaneous

      set({
        feeds: feedsMap,
        folders: foldersMap,
        loadingFeeds: false,
      });

      // Load unread counts
      await get().updateUnreadCounts();
      // Debug timing removed as part of RR-242
    } catch (error) {
      console.error("Failed to load feeds:", error);
      // Debug timing removed as part of RR-242
      set({
        loadingFeeds: false,
        feedsError: `Failed to load feeds: ${error}`,
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
        .from("feeds")
        .update({
          title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", feedId);

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
      console.error("Failed to update feed title:", error);
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
      console.error("Failed to toggle feed status:", error);
    }
  },

  // Move feed to folder
  moveFeedToFolder: async (feedId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from("feeds")
        .update({
          folder_id: folderId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", feedId);

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
      console.error("Failed to move feed:", error);
    }
  },

  // Update feed partial content setting
  updateFeedPartialContent: async (
    feedId: string,
    isPartialContent: boolean
  ) => {
    try {
      const { error } = await supabase
        .from("feeds")
        .update({
          is_partial_content: isPartialContent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", feedId);

      if (error) throw error;

      // Update in store
      const { feeds } = get();
      const feed = feeds.get(feedId);
      if (feed) {
        const updatedFeeds = new Map(feeds);
        updatedFeeds.set(feedId, { ...feed, isPartialContent });
        set({ feeds: updatedFeeds });
      }

      // Also update feedsWithCounts map
      const { feedsWithCounts } = get();
      const feedWithCount = feedsWithCounts.get(feedId);
      if (feedWithCount) {
        const updatedFeedsWithCounts = new Map(feedsWithCounts);
        updatedFeedsWithCounts.set(feedId, {
          ...feedWithCount,
          isPartialContent,
        });
        set({ feedsWithCounts: updatedFeedsWithCounts });
      }
    } catch (error) {
      console.error("Failed to update feed partial content setting:", error);
      set({ feedsError: `Failed to update feed setting: ${error}` });
      // Re-throw the error so the component can handle it
      throw error;
    }
  },

  // Create folder
  createFolder: async (name: string, parentId?: string | null) => {
    try {
      // Get the single user
      const SINGLE_USER_ID = "shayon";
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("inoreader_id", SINGLE_USER_ID)
        .single();

      if (!user) {
        throw new Error("User not found");
      }

      const { data: newFolder, error } = await supabase
        .from("folders")
        .insert({
          user_id: user.id,
          name,
          parent_id: parentId || null,
          inoreader_id: `folder_${Date.now()}`, // Generate unique ID
        })
        .select()
        .single();

      if (error) throw error;

      // Update in store
      const { folders: foldersMap } = get();
      const updatedFolders = new Map(foldersMap);
      updatedFolders.set(newFolder.id, {
        id: newFolder.id,
        title: newFolder.name || "",
        parentId: newFolder.parent_id,
        sortOrder: 0,
        unreadCount: 0,
        isExpanded: true,
        createdAt: new Date(newFolder.created_at || Date.now()),
        updatedAt: new Date(newFolder.updated_at || Date.now()),
      });
      set({ folders: updatedFolders });

      return newFolder.id;
    } catch (error) {
      console.error("Failed to create folder:", error);
      set({ feedsError: `Failed to create folder: ${error}` });
      return null;
    }
  },

  // Update folder title
  updateFolderTitle: async (folderId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("folders")
        .update({
          name: title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", folderId);

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
      console.error("Failed to update folder title:", error);
    }
  },

  // Delete folder
  deleteFolder: async (folderId: string) => {
    try {
      // Move all feeds in this folder to root
      await supabase
        .from("feeds")
        .update({
          folder_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("folder_id", folderId);

      // Move all subfolders to root
      await supabase
        .from("folders")
        .update({
          parent_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("parent_id", folderId);

      // Delete the folder
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;

      // Reload hierarchy
      await get().loadFeedHierarchy();
    } catch (error) {
      console.error("Failed to delete folder:", error);
      set({ feedsError: `Failed to delete folder: ${error}` });
    }
  },

  // Update unread counts
  updateUnreadCounts: async () => {
    const startTime = performance.now();
    // Debug logging removed as part of RR-242

    try {
      const { feeds, folders } = get();
      const feedsWithCounts = new Map<string, FeedWithUnreadCount>();
      const folderCounts = new Map<string, number>();
      let totalUnread = 0;

      // Debug logging removed as part of RR-242

      // Get all unread counts in a single query
      const countStartTime = performance.now();

      // First, get the user ID
      const SINGLE_USER_ID = "shayon";
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("inoreader_id", SINGLE_USER_ID)
        .single();

      if (!user) {
        console.error("[FeedStore] User not found for unread counts");
        return;
      }

      // Get unread counts for all feeds in one efficient query
      let unreadCounts: any[] | null = null;
      let error: any = null;

      try {
        // Try to use the optimized database function first
        const result = await supabase.rpc("get_unread_counts_by_feed", {
          p_user_id: user.id,
        });
        unreadCounts = result.data;
        error = result.error;
      } catch (e) {
        // Fallback if function doesn't exist
        // Debug logging removed as part of RR-242
        const result = await supabase
          .from("articles")
          .select("feed_id")
          .eq("user_id", user.id)
          .eq("is_read", false);
        unreadCounts = result.data;
        error = result.error;
      }

      // Create a map of feed_id to unread count
      const unreadCountMap = new Map<string, number>();

      if (!error && unreadCounts) {
        if ("unread_count" in (unreadCounts[0] || {})) {
          // Using the database function
          unreadCounts.forEach((row: any) => {
            unreadCountMap.set(row.feed_id, row.unread_count);
          });
        } else {
          // Using the fallback method
          unreadCounts.forEach((article: any) => {
            if (article.feed_id) {
              const currentCount = unreadCountMap.get(article.feed_id) || 0;
              unreadCountMap.set(article.feed_id, currentCount + 1);
            }
          });
        }
      }

      // debugTiming("[FeedStore] Unread count query", countStartTime);

      // Apply counts to feeds
      for (const [feedId, feed] of Array.from(feeds.entries())) {
        const unreadCount = unreadCountMap.get(feedId) || 0;

        feedsWithCounts.set(feedId, { ...feed, unreadCount });
        totalUnread += unreadCount;

        // Add to folder count
        if (feed.folderId) {
          const currentCount = folderCounts.get(feed.folderId) || 0;
          folderCounts.set(feed.folderId, currentCount + unreadCount);
        }
      }

      // Debug logging removed as part of RR-242

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
        totalUnreadCount: totalUnread,
      });

      // debugTiming("[FeedStore] updateUnreadCounts completed", startTime);
    } catch (error) {
      console.error("Failed to update unread counts:", error);
      // debugTiming("[FeedStore] updateUnreadCounts failed", startTime);
    }
  },

  // Increment unread count (for real-time updates)
  incrementUnreadCount: (feedId: string, delta: number) => {
    const { feedsWithCounts, folderUnreadCounts, folders, totalUnreadCount } =
      get();

    // Update feed count
    const feedWithCount = feedsWithCounts.get(feedId);
    if (feedWithCount) {
      const updatedFeedsWithCounts = new Map(feedsWithCounts);
      updatedFeedsWithCounts.set(feedId, {
        ...feedWithCount,
        unreadCount: Math.max(0, feedWithCount.unreadCount + delta),
      });

      // Update folder counts
      const updatedFolderCounts = new Map(folderUnreadCounts);
      let currentFolderId = feedWithCount.folderId;

      while (currentFolderId) {
        const currentCount = updatedFolderCounts.get(currentFolderId) || 0;
        updatedFolderCounts.set(
          currentFolderId,
          Math.max(0, currentCount + delta)
        );

        const folder = folders.get(currentFolderId);
        currentFolderId = folder?.parentId || null;
      }

      set({
        feedsWithCounts: updatedFeedsWithCounts,
        folderUnreadCounts: updatedFolderCounts,
        totalUnreadCount: Math.max(0, totalUnreadCount + delta),
      });
    }
  },

  // Get feeds in folder
  getFeedsInFolder: (folderId: string | null) => {
    const { feeds } = get();
    return Array.from(feeds.values())
      .filter((feed) => feed.folderId === folderId)
      .sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
  },

  // Get subfolders
  getSubfolders: (parentId: string | null) => {
    const { folders } = get();
    return Array.from(folders.values())
      .filter((folder) => folder.parentId === parentId)
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
  },

  // Apply sidebar counts from API response (RR-171)
  applySidebarCounts: (feedCounts: Array<[string, number]>) => {
    const { feeds, feedsWithCounts } = get();
    const updatedFeeds = new Map(feeds);
    const updatedFeedsWithCounts = new Map(feedsWithCounts);
    let newTotalUnread = 0;

    feedCounts.forEach(([feedId, count]) => {
      const feed = updatedFeeds.get(feedId);
      if (feed) {
        // Update feeds map
        updatedFeeds.set(feedId, { ...feed, unreadCount: count });

        // Update feedsWithCounts map for immediate UI update
        const feedWithCount = updatedFeedsWithCounts.get(feedId);
        if (feedWithCount) {
          updatedFeedsWithCounts.set(feedId, {
            ...feedWithCount,
            unreadCount: count,
          });
        } else {
          // Create entry if it doesn't exist
          updatedFeedsWithCounts.set(feedId, {
            ...feed,
            unreadCount: count,
          } as any);
        }

        newTotalUnread += count;
      }
    });

    set({
      feeds: updatedFeeds,
      feedsWithCounts: updatedFeedsWithCounts,
      totalUnreadCount: newTotalUnread,
    });
  },

  // Set skeleton loading state (RR-171)
  setSkeletonLoading: (loading: boolean) => {
    set({ isSkeletonLoading: loading });
  },
}));
