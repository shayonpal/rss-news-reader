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
} from "lucide-react";
import { CollapsibleFilterSection } from "@/components/ui/collapsible-filter-section";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { decodeHtmlEntities } from "@/lib/utils/html-decoder";
import { refreshManager } from "@/lib/refresh-manager";

interface SimpleFeedSidebarProps {
  selectedFeedId: string | null;
  selectedTagId: string | null;
  onFeedSelect: (feedId: string | null) => void;
  onTagSelect: (tagId: string | null) => void;
  onClose?: () => void;
}

export function SimpleFeedSidebar({
  selectedFeedId,
  selectedTagId,
  onFeedSelect,
  onTagSelect,
}: SimpleFeedSidebarProps) {
  const router = useRouter();
  const { feeds, feedsWithCounts, totalUnreadCount, loadFeedHierarchy, isSkeletonLoading } =
    useFeedStore();
  const {
    isSyncing,
    lastSyncTime,
    performFullSync,
    syncError,
    syncProgress,
    syncMessage,
    rateLimit,
    loadLastSyncTime,
  } = useSyncStore();
  const { theme, setTheme, feedsSectionCollapsed, setFeedsSectionCollapsed, tagsSectionCollapsed, setTagsSectionCollapsed } = useUIStore();
  const { readStatusFilter } = useArticleStore();
  const { tags, loadTags, selectTag, selectedTagIds } = useTagStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollPosition = useRef<number>(0);
  
  // RR-171: Rate limiting countdown state
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // Load feeds and tags when component mounts
  useEffect(() => {
    console.log(
      "[SimpleFeedSidebar] Component mounted, loading feeds and sync status..."
    );
    const startTime = performance.now();
    
    // Load both feed hierarchy and last sync time
    Promise.all([
      loadFeedHierarchy(),
      loadLastSyncTime(),
      loadTags()
    ]).then(() => {
      console.log(
        `[SimpleFeedSidebar] Initial load completed in ${(performance.now() - startTime).toFixed(2)}ms`
      );
    });
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
              aria-label="View fetch statistics"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={async () => {
                // RR-171: Use RefreshManager for coordinated sync
                await refreshManager.afterManualSync();
              }}
              disabled={isSyncing || rateLimitCountdown > 0}
              className="relative rounded p-2 hover:bg-muted disabled:opacity-50"
              aria-label={
                rateLimitCountdown > 0
                  ? refreshManager.formatCountdown(rateLimitCountdown)
                  : isSyncing 
                  ? "Syncing..." 
                  : "Sync feeds"
              }
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {/* Show progress during sync or countdown during rate limit */}
              {isSyncing && syncProgress > 0 ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 transform text-[10px] font-medium">
                  {syncProgress}%
                </span>
              ) : rateLimitCountdown > 0 ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 transform text-[10px] font-medium whitespace-nowrap">
                  {refreshManager.formatCountdown(rateLimitCountdown)}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalUnreadCount} unread • {feeds.size} feeds
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
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
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  {syncProgress}%
                </p>
              </div>
            )}
          </div>
        ) : syncError && feeds.size === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <p className="mb-2 text-sm text-destructive">
              Failed to sync feeds
            </p>
            <p className="mb-4 text-xs text-muted-foreground">{syncError}</p>
            <button
              onClick={async () => {
                // RR-171: Use RefreshManager for coordinated sync
                await refreshManager.afterManualSync();
              }}
              disabled={rateLimitCountdown > 0}
              className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* All Articles */}
            <div
              className={`cursor-pointer px-3 py-2.5 hover:bg-muted/50 transition-colors ${
                !selectedFeedId && !selectedTagId
                  ? "bg-muted font-semibold border-l-2 border-primary" 
                  : "hover:border-l-2 hover:border-muted-foreground/30"
              }`}
              onClick={() => {
                onFeedSelect(null);
                onTagSelect(null);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  <span>All Articles</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  !selectedFeedId && !selectedTagId
                    ? "bg-primary text-primary-foreground" 
                    : "bg-primary/10 text-primary"
                }`}>
                  {totalUnreadCount}
                </span>
              </div>
            </div>

            {/* Tags Section */}
            {Array.from(tags.values()).filter(t => t.articleCount > 0).length > 0 && (
              <CollapsibleFilterSection
                title="Topics"
                count={Array.from(tags.values()).filter(t => t.articleCount > 0).length}
                defaultOpen={!tagsSectionCollapsed}
                onToggle={(isOpen) => setTagsSectionCollapsed(!isOpen)}
                icon={<LayoutDashboard className="h-3.5 w-3.5" />}
                className="border-t mt-2"
              >
                <div className="space-y-0.5 max-h-[30vh] overflow-y-auto scrollbar-hide pl-6 pr-1">
                  {/* Skeleton loading state for tags (RR-171) */}
                  {isSkeletonLoading ? (
                    <>
                      {[...Array(4)].map((_, i) => (
                        <div key={`skeleton-tag-${i}`} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + Math.random() * 30}%` }} />
                            <div className="h-4 w-6 bg-muted rounded animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    Array.from(tags.values())
                    .filter(tag => tag.articleCount > 0)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((tag) => {
                      const isSelected = selectedTagId === tag.id;
                      
                      return (
                        <div
                          key={tag.id}
                          className={`cursor-pointer py-2 px-3 transition-all hover:bg-muted/50 ${
                            isSelected 
                              ? "bg-muted font-semibold border-l-2 border-primary -ml-[2px] pl-[14px]" 
                              : "hover:border-l-2 hover:border-muted-foreground/30"
                          }`}
                          onClick={() => {
                            onTagSelect(isSelected ? null : tag.id);
                            onFeedSelect(null); // Clear feed selection when tag is selected
                          }}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate flex items-center gap-2">
                              {tag.color && (
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                              {decodeHtmlEntities(tag.name)}
                            </span>
                            <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary"
                            }`}>
                              {tag.articleCount > 999 ? "999+" : tag.articleCount}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CollapsibleFilterSection>
            )}

            {/* Empty State */}
            {feeds.size === 0 && !isSyncing && (
              <div className="p-4 text-center">
                <p className="mb-2 text-sm text-muted-foreground">
                  No feeds yet
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Click the Sync button to load your feeds from Inoreader
                </p>
              </div>
            )}

            {/* Feeds Section */}
            <CollapsibleFilterSection
              title="Feeds"
              count={readStatusFilter === 'unread' 
                ? Array.from(feedsWithCounts.values()).filter(f => f.unreadCount > 0).length
                : readStatusFilter === 'read'
                ? Array.from(feedsWithCounts.values()).filter(f => f.unreadCount === 0).length
                : feeds.size
              }
              defaultOpen={!feedsSectionCollapsed}
              onToggle={(isOpen) => setFeedsSectionCollapsed(!isOpen)}
              icon={<Rss className="h-3.5 w-3.5" />}
              className="border-t mt-2"
            >
              <div className="space-y-0.5 max-h-[60vh] overflow-y-auto scrollbar-hide pl-6 pr-1">
                {/* Skeleton loading state for RR-171 */}
                {isSkeletonLoading ? (
                  <>
                    {[...Array(6)].map((_, i) => (
                      <div key={`skeleton-feed-${i}`} className="py-2 px-3">
                        <div className="flex items-center justify-between">
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                          <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </>
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

                // Show all feeds for 'read' or 'all' filters
                return true;
              })
              .map((feed) => {
                const feedWithCount = feedsWithCounts.get(feed.id);
                const unreadCount = feedWithCount?.unreadCount || 0;
                const isSelected = selectedFeedId === feed.id;
                const hasUnread = unreadCount > 0;

                return (
                  <div
                    key={feed.id}
                    className={`cursor-pointer py-2 px-3 transition-all hover:bg-muted/50 ${
                      isSelected 
                        ? "bg-muted font-semibold border-l-2 border-primary -ml-[2px] pl-[14px]" 
                        : "hover:border-l-2 hover:border-muted-foreground/30"
                    } ${
                      !hasUnread && !isSelected
                        ? "opacity-35 hover:opacity-100"
                        : ""
                    }`}
                    onClick={() => {
                      onFeedSelect(feed.id);
                      onTagSelect(null); // Clear tag selection when feed is selected
                    }}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        {String(feed.title || "Untitled Feed")}
                      </span>
                      {unreadCount > 0 && (
                        <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {unreadCount > 999 ? "999+" : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
                )}
              </div>
            </CollapsibleFilterSection>

            {/* Status */}
            <div className="space-y-1 p-3 text-xs text-muted-foreground">
              {lastSyncTime && (
                <div>
                  Last sync:{" "}
                  <span suppressHydrationWarning>
                    {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
                  </span>
                </div>
              )}
              <div>{feeds.size} feeds total</div>
              {rateLimit && (
                <div
                  className={
                    rateLimit.used >= rateLimit.limit * 0.8
                      ? "text-amber-600"
                      : ""
                  }
                >
                  API usage: {rateLimit.used}/{rateLimit.limit} calls today
                  {rateLimit.used >= rateLimit.limit * 0.95 && (
                    <span className="text-destructive">
                      {" "}
                      (Warning: Near limit!)
                    </span>
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
