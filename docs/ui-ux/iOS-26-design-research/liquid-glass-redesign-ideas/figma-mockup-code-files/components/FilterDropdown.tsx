import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Check,
  Folder,
  Rss,
  Globe,
  Eye,
  EyeOff,
  Circle,
} from "lucide-react";
import { supabase, Feed, Folder as FolderType } from "../lib/supabase";

export interface FilterState {
  readStatus: "all" | "unread" | "read";
  sourceType: "all" | "folder" | "feed";
  sourceId: number | null;
  sourceTitle: string;
}

interface FilterDropdownProps {
  currentFilter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

export function FilterDropdown({
  currentFilter,
  onFilterChange,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set()
  );
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchFoldersAndFeeds = async () => {
      try {
        const [foldersResult, feedsResult] = await Promise.all([
          supabase
            .from("folders")
            .select("*")
            .order("name", { ascending: true }),
          supabase
            .from("feeds")
            .select("*")
            .order("title", { ascending: true }),
        ]);

        if (foldersResult.data) setFolders(foldersResult.data);
        if (feedsResult.data) setFeeds(feedsResult.data);

        // Fetch unread counts for folders and feeds
        const counts: Record<string, number> = {};

        // Mock unread counts for demo
        if (foldersResult.data) {
          foldersResult.data.forEach((folder) => {
            counts[`folder-${folder.inoreader_id}`] = Math.floor(
              Math.random() * 20
            );
          });
        }

        if (feedsResult.data) {
          feedsResult.data.forEach((feed) => {
            counts[`feed-${feed.id}`] = Math.floor(Math.random() * 15);
          });
        }

        setUnreadCounts(counts);
      } catch (error) {
        console.error("Error fetching filters data:", error);
      }
    };

    fetchFoldersAndFeeds();
  }, []);

  const handleReadStatusChange = (readStatus: "all" | "unread" | "read") => {
    onFilterChange({
      ...currentFilter,
      readStatus,
    });
    setIsOpen(false);
  };

  const handleSourceChange = (
    sourceType: "all" | "folder" | "feed",
    sourceId: number | null = null,
    sourceTitle: string = ""
  ) => {
    onFilterChange({
      ...currentFilter,
      sourceType,
      sourceId,
      sourceTitle,
    });
    setIsOpen(false);
  };

  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getFilterLabel = () => {
    if (currentFilter.sourceType !== "all") {
      return currentFilter.sourceTitle;
    }
    if (currentFilter.readStatus === "unread") return "Unread";
    if (currentFilter.readStatus === "read") return "Read";
    return "All Articles";
  };

  const isFilterActive =
    currentFilter.readStatus !== "unread" || currentFilter.sourceType !== "all";

  const readStatusOptions = [
    { key: "all", label: "All Articles", icon: Globe },
    { key: "unread", label: "Unread", icon: Circle },
    { key: "read", label: "Read", icon: Eye },
  ];

  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative min-h-[44px] min-w-[44px] transform rounded-2xl border border-white/40 bg-white/50 p-3 shadow-lg shadow-black/5 backdrop-blur-2xl transition-all duration-300 hover:scale-105 hover:bg-white/70 active:scale-95 dark:border-slate-600/40 dark:bg-slate-800/50 dark:shadow-black/20 dark:hover:bg-slate-700/70"
        aria-label="Filter articles"
      >
        {/* Glass shine effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative flex items-center gap-2">
          <Filter
            className={`h-5 w-5 transition-colors duration-200 ${
              isFilterActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          />
          <ChevronDown
            className={`h-4 w-4 text-slate-600 transition-transform duration-200 dark:text-slate-400 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 top-full z-50 mt-2 w-72">
            <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/80 shadow-2xl shadow-black/10 backdrop-blur-3xl dark:border-slate-600/40 dark:bg-slate-800/80 dark:shadow-black/30">
              {/* Glass background layers */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 dark:from-slate-700/20 dark:via-transparent dark:to-slate-800/10" />

              <div className="relative max-h-96 overflow-y-auto p-1">
                {/* Read Status Section */}
                <div className="border-b border-slate-200/30 p-3 dark:border-slate-600/30">
                  <h3 className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Filter By
                  </h3>

                  <div className="space-y-1">
                    {readStatusOptions.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          onClick={() =>
                            handleReadStatusChange(
                              item.key as "all" | "unread" | "read"
                            )
                          }
                          className="group flex w-full items-center justify-between rounded-xl p-2 transition-colors duration-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                              {item.label}
                            </span>
                          </div>
                          {currentFilter.readStatus === item.key &&
                            currentFilter.sourceType === "all" && (
                              <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Source Section */}
                <div className="p-3">
                  <h3 className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Source
                  </h3>

                  <div className="space-y-1">
                    {/* All Sources */}
                    <button
                      onClick={() => handleSourceChange("all")}
                      className="group flex w-full items-center justify-between rounded-xl p-2 transition-colors duration-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                          All Sources
                        </span>
                      </div>
                      {currentFilter.sourceType === "all" && (
                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>

                    {/* Folders */}
                    {folders.map((folder) => {
                      const folderFeeds = feeds.filter(
                        (feed) => feed.folder_id === folder.inoreader_id
                      );
                      const hasUnread =
                        unreadCounts[`folder-${folder.inoreader_id}`] > 0;
                      const isExpanded = expandedFolders.has(
                        folder.inoreader_id
                      );

                      return (
                        <div
                          key={`folder-${folder.inoreader_id}`}
                          className="space-y-1"
                        >
                          {/* Folder Item */}
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleFolder(folder.inoreader_id)}
                              className="rounded p-1 transition-colors duration-200 hover:bg-white/30 dark:hover:bg-slate-700/30"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                handleSourceChange(
                                  "folder",
                                  folder.inoreader_id,
                                  folder.name
                                )
                              }
                              className={`group flex flex-1 items-center justify-between rounded-xl p-2 transition-colors duration-200 hover:bg-white/50 dark:hover:bg-slate-700/50 ${
                                !hasUnread ? "opacity-50" : ""
                              }`}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <Folder className="h-4 w-4 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                                <span className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                                  {folder.name}
                                </span>
                                {hasUnread && (
                                  <span className="flex-shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                                    {
                                      unreadCounts[
                                        `folder-${folder.inoreader_id}`
                                      ]
                                    }
                                  </span>
                                )}
                              </div>
                              {currentFilter.sourceType === "folder" &&
                                currentFilter.sourceId ===
                                  folder.inoreader_id && (
                                  <Check className="ml-2 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                                )}
                            </button>
                          </div>

                          {/* Feeds within folder */}
                          {isExpanded && (
                            <div className="ml-6 space-y-1">
                              {folderFeeds.map((feed) => {
                                const feedHasUnread =
                                  unreadCounts[`feed-${feed.id}`] > 0;
                                return (
                                  <button
                                    key={`feed-${feed.id}`}
                                    onClick={() =>
                                      handleSourceChange(
                                        "feed",
                                        feed.id,
                                        feed.title
                                      )
                                    }
                                    className={`group flex w-full items-center justify-between rounded-xl p-2 transition-colors duration-200 hover:bg-white/50 dark:hover:bg-slate-700/50 ${
                                      !feedHasUnread ? "opacity-50" : ""
                                    }`}
                                  >
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                      <Rss className="h-3 w-3 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                                      <span className="truncate text-sm text-slate-700 group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-400">
                                        {feed.title}
                                      </span>
                                      {feedHasUnread && (
                                        <span className="flex-shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                                          {unreadCounts[`feed-${feed.id}`]}
                                        </span>
                                      )}
                                    </div>
                                    {currentFilter.sourceType === "feed" &&
                                      currentFilter.sourceId === feed.id && (
                                        <Check className="ml-2 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                                      )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Standalone Feeds (not in folders) */}
                    {feeds
                      .filter((feed) => !feed.folder_id)
                      .map((feed) => {
                        const feedHasUnread =
                          unreadCounts[`feed-${feed.id}`] > 0;
                        return (
                          <button
                            key={`standalone-feed-${feed.id}`}
                            onClick={() =>
                              handleSourceChange("feed", feed.id, feed.title)
                            }
                            className={`group flex w-full items-center justify-between rounded-xl p-2 transition-colors duration-200 hover:bg-white/50 dark:hover:bg-slate-700/50 ${
                              !feedHasUnread ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <Rss className="h-4 w-4 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                              <span className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                                {feed.title}
                              </span>
                              {feedHasUnread && (
                                <span className="flex-shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                                  {unreadCounts[`feed-${feed.id}`]}
                                </span>
                              )}
                            </div>
                            {currentFilter.sourceType === "feed" &&
                              currentFilter.sourceId === feed.id && (
                                <Check className="ml-2 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                              )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
