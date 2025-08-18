"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useSyncStore } from "@/lib/stores/sync-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { useTagStore } from "@/lib/stores/tag-store";
import {
  Loader2,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  BarChart3,
  Newspaper,
  Rss,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";
import { CollapsibleFilterSection } from "@/components/ui/collapsible-filter-section";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { refreshManager } from "@/lib/refresh-manager";
import { cn } from "@/lib/utils";

interface SimpleFeedSidebarProps {
  selectedFeedId: string | null;
  selectedTagId: string | null;
  onFeedSelect: (feedId: string | null, feedTitle?: string) => void;
  onTagSelect: (tagId: string | null) => void;
  onClearFilters?: () => void;
  onClose?: () => void;
}

export function SimpleFeedSidebar({
  selectedFeedId,
  selectedTagId,
  onFeedSelect,
  onTagSelect,
  onClearFilters,
}: SimpleFeedSidebarProps) {
  const router = useRouter();
  const {
    feeds,
    feedsWithCounts,
    totalUnreadCount,
    loadFeedHierarchy,
    isSkeletonLoading,
  } = useFeedStore();
  const {
    isSyncing,
    lastSyncTime,
    performFullSync,
    syncError,
    syncProgress,
    syncMessage,
    rateLimit,
    apiUsage,
    loadLastSyncTime,
    updateApiUsage,
  } = useSyncStore();
  const {
    theme,
    setTheme,
    feedsSectionCollapsed,
    setFeedsSectionCollapsed,
    tagsSectionCollapsed,
    setTagsSectionCollapsed,
  } = useUIStore();
  const { readStatusFilter } = useArticleStore();
  const { tags, loadTags, selectTag, selectedTagIds } = useTagStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollPosition = useRef<number>(0);

  // RR-171: Rate limiting countdown state
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // RR-193: Synchronize tag store selection with prop for counter updates
  useEffect(() => {
    if (selectedTagId) {
      selectTag(selectedTagId);
    } else {
      selectTag(null);
    }
  }, [selectedTagId, selectTag]);

  // Load feeds and tags when component mounts
  useEffect(() => {
    console.log(
      "[SimpleFeedSidebar] Component mounted, loading feeds and sync status..."
    );
    const startTime = performance.now();

    // Load both feed hierarchy and last sync time
    Promise.all([loadFeedHierarchy(), loadLastSyncTime(), loadTags()]).then(
      () => {
        console.log(
          `[SimpleFeedSidebar] Initial load completed in ${(performance.now() - startTime).toFixed(2)}ms`
        );
      }
    );
  }, [loadFeedHierarchy, loadLastSyncTime, loadTags]);

  // RR-171: Update rate limit countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const remaining = refreshManager.getRemainingCooldown();
      setRateLimitCountdown(remaining);
    };

    // Initial check
    updateCountdown();

    // Update every second if in cooldown
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  // Remove sync parameter from URL if present (cleanup from old behavior)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("sync") === "true") {
        // Remove sync param to prevent confusion
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("sync");
        window.history.replaceState({}, "", newUrl.pathname);
      }
    }
  }, []);

  // Fetch API usage on mount and after sync
  useEffect(() => {
    const fetchApiUsage = async (bustCache = false) => {
      try {
        // Add cache-busting parameter after sync to get fresh data
        const url = bustCache
          ? `/reader/api/sync/api-usage?t=${Date.now()}`
          : "/reader/api/sync/api-usage";
        const response = await fetch(url, {
          headers: bustCache ? { "Cache-Control": "no-cache" } : {},
        });
        if (response.ok) {
          const data = await response.json();
          updateApiUsage({
            zone1: data.zone1,
            zone2: data.zone2,
            resetAfterSeconds: data.resetAfterSeconds,
            lastUpdated: data.timestamp,
          });
        }
      } catch (error) {
        console.error("Failed to fetch API usage:", error);
      }
    };

    // Fetch with cache-busting if we just finished syncing
    const justFinishedSyncing = !isSyncing && !!apiUsage?.zone1;
    fetchApiUsage(justFinishedSyncing);

    // Refresh every 5 minutes
    const interval = setInterval(() => fetchApiUsage(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [updateApiUsage, isSyncing, apiUsage?.zone1]); // Also refresh when sync completes

  // Save and restore scroll position when filter changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Save current scroll position before filter change takes effect
    lastScrollPosition.current = container.scrollTop;

    // Restore scroll position after render
    requestAnimationFrame(() => {
      container.scrollTop = lastScrollPosition.current;
    });
  }, [readStatusFilter]);

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const cycleTheme = () => {
    const themes = ["light", "dark", "system"] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <div className="flex h-full flex-col border-r bg-background pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/reader/icons/favicon-32x32.png"
              alt="RSS Reader"
              width={24}
              height={24}
              className="dark:brightness-110"
              priority
            />
            <h1 className="text-lg font-semibold">
              <span className="hidden sm:inline">Shayon's </span>
              News
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={cycleTheme}
              className="rounded p-2 transition-colors hover:bg-muted"
              aria-label={`Current theme: ${theme}`}
            >
              {getThemeIcon()}
            </button>
            <button
              onClick={() => router.push("/fetch-stats")}
              className="rounded p-2 transition-colors hover:bg-muted"
              aria-label="View sync statistics"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                onClick={performFullSync}
                disabled={isSyncing || rateLimitCountdown > 0}
                className="rounded p-2 transition-colors hover:bg-muted disabled:opacity-50"
                aria-label={
                  isSyncing
                    ? "Sync in progress"
                    : rateLimitCountdown > 0
                      ? `Rate limited, try again in ${rateLimitCountdown} seconds`
                      : "Sync feeds"
                }
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
              {/* Show progress during sync or countdown during rate limit */}
              {isSyncing && syncProgress > 0 ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 transform text-[10px] font-medium">
                  {Math.round(syncProgress)}%
                </span>
              ) : rateLimitCountdown > 0 ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 transform whitespace-nowrap text-[10px] font-medium">
                  {refreshManager.formatCountdown(rateLimitCountdown)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {totalUnreadCount} unread • {feeds.size} feeds
        </div>
      </div>

      {/* Feed List - RR-193: Updated to CSS Grid layout */}
      <div 
        className="relative flex-1 overflow-y-auto" 
        ref={scrollContainerRef}
        data-testid="sidebar-main-container"
      >
        {/* Loading State for Initial Sync */}
        {isSyncing && feeds.size === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {syncMessage || "Syncing your feeds..."}
            </p>
            {syncProgress > 0 && (
              <div className="mt-3 w-full max-w-xs">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
                <div className="mt-1 text-center text-xs text-muted-foreground">
                  {Math.round(syncProgress)}%
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* All Articles */}
            <div
              className={`cursor-pointer px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                !selectedFeedId && !selectedTagId
                  ? "border-l-2 border-primary bg-muted font-semibold"
                  : "hover:border-l-2 hover:border-muted-foreground/30"
              }`}
              onClick={() => {
                if (onClearFilters) {
                  onClearFilters();
                } else {
                  // Fallback: maintain previous behavior if handler not provided
                  onFeedSelect(null);
                  onTagSelect(null);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  <span>All Articles</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    !selectedFeedId && !selectedTagId
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {totalUnreadCount}
                </span>
              </div>
            </div>

            {/* RR-193: Feeds Section (moved above Topics as per specification) */}
            <CollapsibleFilterSection
              title="Feeds"
              count={
                readStatusFilter === "unread"
                  ? Array.from(feedsWithCounts.values()).filter(
                      (f) => f.unreadCount > 0
                    ).length
                  : readStatusFilter === "read"
                    ? Array.from(feedsWithCounts.values()).filter(
                        (f) => f.unreadCount === 0
                      ).length
                    : feeds.size
              }
              defaultOpen={!feedsSectionCollapsed}
              onToggle={(isOpen) => setFeedsSectionCollapsed(!isOpen)}
              icon={<Rss className="h-3.5 w-3.5" />}
              className="mt-2 border-t"
              testId="feeds-collapsible"
            >
              <div 
                className="space-y-0.5 pl-6 pr-1"
                data-testid="feeds-scrollable-section"
              >
                {/* Skeleton loading state for RR-171 */}
                {isSkeletonLoading ? (
                  <>
                    {[...Array(6)].map((_, i) => (
                      <div key={`skeleton-feed-${i}`} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div
                            className="h-4 animate-pulse rounded bg-muted"
                            style={{ width: `${60 + Math.random() * 40}%` }}
                          />
                          <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : feeds.size === 0 ? (
                  <div className="px-6 py-4 text-sm text-muted-foreground">
                    No feeds available
                  </div>
                ) : (
                  /* Individual Feeds */
                  Array.from(feeds.values())
                    .sort((a, b) =>
                      String(a.title || "").localeCompare(
                        String(b.title || ""),
                        undefined,
                        { numeric: true, sensitivity: "base" }
                      )
                    )
                    .filter((feed) => {
                      // Always show the currently selected feed
                      if (selectedFeedId === feed.id) return true;

                      // Filter based on read status filter
                      if (readStatusFilter === "unread") {
                        const feedWithCount = feedsWithCounts.get(feed.id);
                        const unreadCount = feedWithCount?.unreadCount || 0;
                        return unreadCount > 0;
                      }

                      if (readStatusFilter === "read") {
                        const feedWithCount = feedsWithCounts.get(feed.id);
                        const unreadCount = feedWithCount?.unreadCount || 0;
                        return unreadCount === 0;
                      }

                      return true; // "all" filter
                    })
                    .map((feed) => {
                      const feedWithCount = feedsWithCounts.get(feed.id);
                      const unreadCount = feedWithCount?.unreadCount || 0;
                      const isSelected = selectedFeedId === feed.id;

                      return (
                        <button
                          key={feed.id}
                          onClick={() => onFeedSelect(feed.id, feed.title)}
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="line-clamp-2 text-sm font-medium">
                              {feed.title || "Untitled"}
                            </span>
                            {unreadCount > 0 && (
                              <span 
                                className={`ml-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </CollapsibleFilterSection>

            {/* RR-193: Topics Section (moved below Feeds as per specification) */}
            <CollapsibleFilterSection
              title="Topics"
              count={
                Array.from(tags.values()).filter((tag) => {
                  // RR-163: Filter tags based on read status
                  if (selectedTagId === tag.id) return true;

                  if (readStatusFilter === "unread") {
                    const hasUnread = (tag.unreadCount ?? 0) > 0;
                    const hasArticles = (tag.totalCount ?? tag.articleCount) > 0;

                    if (hasUnread) return true;

                    if (totalUnreadCount > 0 && hasArticles) {
                      const noTagsHaveUnread = Array.from(tags.values()).every(
                        (t) => (t.unreadCount ?? 0) === 0
                      );
                      return noTagsHaveUnread;
                    }

                    return false;
                  }

                  if (readStatusFilter === "read") {
                    const totalCount = tag.totalCount ?? tag.articleCount ?? 0;
                    const unreadCount = tag.unreadCount ?? 0;
                    return totalCount > 0 && unreadCount === 0;
                  }
                  return (tag.totalCount ?? tag.articleCount) > 0;
                }).length
              }
              defaultOpen={!tagsSectionCollapsed}
              onToggle={(isOpen) => setTagsSectionCollapsed(!isOpen)}
              icon={<LayoutDashboard className="h-3.5 w-3.5" />}
              className="mt-2 border-t"
              testId="topics-collapsible"
            >
              <div 
                className="space-y-0.5 pl-6 pr-1"
                data-testid="topics-scrollable-section"
              >
                {/* Skeleton loading state for tags (RR-171) */}
                {isSkeletonLoading ? (
                  <>
                    {[...Array(4)].map((_, i) => (
                      <div key={`skeleton-tag-${i}`} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div
                            className="h-4 animate-pulse rounded bg-muted"
                            style={{ width: `${50 + Math.random() * 30}%` }}
                          />
                          <div className="h-4 w-6 animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : Array.from(tags.values()).length === 0 ? (
                  <div className="px-6 py-4 text-sm text-muted-foreground">
                    No topics available
                  </div>
                ) : (
                  Array.from(tags.values())
                    .filter((tag) => {
                      // RR-163: Filter tags based on read status
                      // Always show the currently selected tag
                      if (selectedTagId === tag.id) return true;

                      // Filter based on read status filter
                      if (readStatusFilter === "unread") {
                        const hasUnread = (tag.unreadCount ?? 0) > 0;
                        const hasArticles =
                          (tag.totalCount ?? tag.articleCount) > 0;

                        // If tag has unread, show it
                        if (hasUnread) return true;

                        // If system has unread articles but no tags show unread counts,
                        // show all tags with articles (fallback for sync issues)
                        if (totalUnreadCount > 0 && hasArticles) {
                          const noTagsHaveUnread = Array.from(
                            tags.values()
                          ).every((t) => (t.unreadCount ?? 0) === 0);
                          return noTagsHaveUnread;
                        }

                        return false;
                      }

                      if (readStatusFilter === "read") {
                        const totalCount =
                          tag.totalCount ?? tag.articleCount ?? 0;
                        const unreadCount = tag.unreadCount ?? 0;
                        return totalCount > 0 && unreadCount === 0;
                      }
                      return (tag.totalCount ?? tag.articleCount) > 0;
                    })
                    .sort((a, b) => {
                      const aCount = a.unreadCount ?? 0;
                      const bCount = b.unreadCount ?? 0;
                      if (aCount !== bCount) return bCount - aCount;
                      return String(a.name || "").localeCompare(
                        String(b.name || ""),
                        undefined,
                        { numeric: true, sensitivity: "base" }
                      );
                    })
                    .map((tag) => {
                      const displayCount =
                        readStatusFilter === "unread"
                          ? tag.unreadCount ?? 0
                          : tag.totalCount ?? tag.articleCount ?? 0;
                      const isSelected = selectedTagId === tag.id;

                      return (
                        <button
                          key={tag.id}
                          onClick={() => onTagSelect(tag.id)}
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="line-clamp-2 text-sm font-medium">
                              {tag.name}
                            </span>
                            <span 
                              className={`ml-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {displayCount > 99 ? "99+" : displayCount}
                            </span>
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </CollapsibleFilterSection>
          </>
        )}

        {/* Sync Error Display */}
        {syncError && (
          <div className="border-t bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="flex-1 text-sm">
                <div className="font-medium text-destructive">Sync Failed</div>
                <div className="mt-1 text-muted-foreground">{syncError}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom sidebar info */}
      <div className="glass-sidebar-info sticky bottom-0 left-0 right-0 z-10">
        <div className="space-y-2 p-4 pb-[calc(8px+env(safe-area-inset-bottom))] pl-5 text-xs md:p-3 md:pb-3">
          {lastSyncTime && (
            <div className="leading-relaxed text-muted-foreground">
              Last sync:{" "}
              <span suppressHydrationWarning>
                {formatDistanceToNow(new Date(lastSyncTime), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
          {/* API usage */}
          {apiUsage ? (
            <div className="mt-1 md:mt-1">
              <span className="font-medium">API Usage:</span>
              <div className="mt-1 flex items-center gap-3">
                <span
                  className={
                    apiUsage.zone1.percentage >= 95
                      ? "text-red-500"
                      : apiUsage.zone1.percentage >= 80
                        ? "text-yellow-500"
                        : "text-green-500"
                  }
                >
                  {apiUsage.zone1.percentage.toFixed(1)}% (zone 1)
                </span>
                <span className="text-gray-400">|</span>
                <span
                  className={
                    apiUsage.zone2.percentage >= 95
                      ? "text-red-500"
                      : apiUsage.zone2.percentage >= 80
                        ? "text-yellow-500"
                        : "text-green-500"
                  }
                >
                  {apiUsage.zone2.percentage.toFixed(1)}% (zone 2)
                </span>
              </div>
            </div>
          ) : rateLimit ? (
            <div className="mt-1 text-muted-foreground">
              API usage: {rateLimit.used}/{rateLimit.limit} calls today
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}