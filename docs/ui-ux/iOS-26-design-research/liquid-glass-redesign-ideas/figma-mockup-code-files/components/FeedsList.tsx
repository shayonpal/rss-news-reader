import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Rss,
  RefreshCw,
  AlertCircle,
  Folder,
  FolderOpen,
} from "lucide-react";
import { supabase, Feed, Folder as FolderType } from "../lib/supabase";

interface FeedsListProps {
  onFeedSelect?: (feedId: number, feedTitle: string) => void;
  onFolderSelect?: (folderId: number, folderTitle: string) => void;
}

export function FeedsList({ onFeedSelect, onFolderSelect }: FeedsListProps) {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set([1, 2])
  ); // Expand first two folders by default

  const fetchFoldersAndFeeds = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch folders
      const foldersResult = await supabase
        .from("folders")
        .select("*")
        .order("name", { ascending: true });

      if (foldersResult.error) {
        throw foldersResult.error;
      }

      // Fetch feeds
      const feedsResult = await supabase
        .from("feeds")
        .select("*")
        .order("title", { ascending: true });

      if (feedsResult.error) {
        throw feedsResult.error;
      }

      setFolders(foldersResult.data || []);
      setFeeds(feedsResult.data || []);
    } catch (err) {
      console.error("Error fetching folders and feeds:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch feeds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFoldersAndFeeds();
  }, []);

  const toggleFolderExpansion = (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent folder selection when clicking expand/collapse
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleFolderClick = (folderId: number, folderName: string) => {
    if (onFolderSelect) {
      onFolderSelect(folderId, folderName);
    }
  };

  const handleFeedClick = (
    feedId: number,
    feedTitle: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent folder selection when clicking on feed
    if (onFeedSelect) {
      onFeedSelect(feedId, feedTitle);
    }
  };

  const getFeedsForFolder = (folderId: number) => {
    return feeds.filter((feed) => feed.folder_id === folderId);
  };

  const getTotalUnreadForFolder = (folderId: number) => {
    return getFeedsForFolder(folderId).reduce(
      (total, feed) => total + (feed.unread_count || 0),
      0
    );
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-3 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="rounded-2xl border border-white/30 bg-white/60 p-8 shadow-lg backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-slate-700 dark:text-slate-300">
                Loading feeds...
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-3 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="rounded-2xl border border-red-200/30 bg-red-50/60 p-8 shadow-lg backdrop-blur-xl dark:border-red-700/30 dark:bg-red-900/20">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="h-6 w-6" />
              <div>
                <p className="font-medium">Error loading feeds</p>
                <p className="text-sm opacity-75">{error}</p>
                <button
                  onClick={fetchFoldersAndFeeds}
                  className="mt-3 rounded-lg bg-red-100 px-4 py-2 transition-colors duration-200 hover:bg-red-200 dark:bg-red-800/30 dark:hover:bg-red-700/30"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (folders.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-3 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="rounded-2xl border border-white/30 bg-white/60 p-8 text-center shadow-lg backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/60">
            <Rss className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <p className="mb-2 text-slate-700 dark:text-slate-300">
              No RSS feeds found
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect your Supabase database to see your RSS feeds
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-3 py-6">
      <div className="space-y-2">
        {folders.map((folder) => {
          const folderFeeds = getFeedsForFolder(folder.inoreader_id);
          const isExpanded = expandedFolders.has(folder.inoreader_id);
          const totalUnread = getTotalUnreadForFolder(folder.inoreader_id);

          return (
            <div key={folder.inoreader_id} className="space-y-1">
              {/* Folder Header */}
              <div
                onClick={() =>
                  handleFolderClick(folder.inoreader_id, folder.name)
                }
                className="group w-full cursor-pointer"
              >
                <div className="relative overflow-hidden rounded-2xl border border-white/30 bg-white/40 shadow-md shadow-black/5 backdrop-blur-2xl transition-all duration-300 hover:scale-[1.002] hover:bg-white/55 active:scale-[0.998] dark:border-slate-600/30 dark:bg-slate-800/40 dark:shadow-black/15 dark:hover:bg-slate-800/55">
                  {/* Glass background layers */}
                  <div className="from-white/12 to-white/6 dark:from-slate-700/12 dark:to-slate-800/6 absolute inset-0 bg-gradient-to-br via-transparent dark:via-transparent" />

                  <div className="relative p-3">
                    <div className="flex items-center gap-3">
                      {/* Expand/Collapse Icon */}
                      <button
                        onClick={(e) =>
                          toggleFolderExpansion(folder.inoreader_id, e)
                        }
                        className="flex-shrink-0 rounded-lg p-1 transition-colors duration-200 hover:bg-white/30 dark:hover:bg-slate-700/30"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-600 transition-transform duration-200 dark:text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-600 transition-transform duration-200 dark:text-slate-400" />
                        )}
                      </button>

                      {/* Folder Icon */}
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <FolderOpen className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        ) : (
                          <Folder className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        )}
                      </div>

                      {/* Folder Name */}
                      <span className="flex-1 text-left text-base font-semibold text-slate-900 transition-colors duration-200 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                        {folder.name}
                      </span>

                      {/* Total Unread Count */}
                      {totalUnread > 0 && (
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                            {totalUnread}
                          </span>
                        </div>
                      )}

                      {/* Feed Count */}
                      <div className="flex-shrink-0">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {folderFeeds.length} feed
                          {folderFeeds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feeds List */}
              {isExpanded && folderFeeds.length > 0 && (
                <div className="ml-6 space-y-1">
                  {folderFeeds.map((feed) => (
                    <button
                      key={feed.id}
                      onClick={(e) => handleFeedClick(feed.id, feed.title, e)}
                      className="group w-full"
                    >
                      <div className="relative overflow-hidden rounded-xl border border-white/25 bg-white/30 shadow-sm shadow-black/5 backdrop-blur-2xl transition-all duration-300 hover:scale-[1.002] hover:bg-white/45 active:scale-[0.998] dark:border-slate-600/25 dark:bg-slate-800/30 dark:shadow-black/10 dark:hover:bg-slate-800/45">
                        {/* Glass background layers */}
                        <div className="from-white/8 to-white/4 dark:from-slate-700/8 dark:to-slate-800/4 absolute inset-0 bg-gradient-to-br via-transparent dark:via-transparent" />

                        <div className="relative p-3">
                          <div className="flex items-center gap-3">
                            {/* RSS Icon */}
                            <div className="flex-shrink-0">
                              <Rss className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            </div>

                            {/* Feed Title */}
                            <span className="flex-1 truncate text-left text-sm font-medium text-slate-800 transition-colors duration-200 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                              {feed.title}
                            </span>

                            {/* Unread Count */}
                            {feed.unread_count && feed.unread_count > 0 && (
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                                  {feed.unread_count}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty Folder Message */}
              {isExpanded && folderFeeds.length === 0 && (
                <div className="ml-6">
                  <div className="relative rounded-xl border border-white/20 bg-white/20 p-4 text-center backdrop-blur-xl dark:border-slate-600/20 dark:bg-slate-800/20">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No feeds in this folder
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
