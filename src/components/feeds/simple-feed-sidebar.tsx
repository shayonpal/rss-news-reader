"use client";

import { useEffect, useRef } from "react";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useSyncStore } from "@/lib/stores/sync-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useArticleStore } from "@/lib/stores/article-store";
import {
  Loader2,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  BarChart3,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

interface SimpleFeedSidebarProps {
  selectedFeedId: string | null;
  onFeedSelect: (feedId: string | null) => void;
  onClose?: () => void;
}

export function SimpleFeedSidebar({
  selectedFeedId,
  onFeedSelect,
}: SimpleFeedSidebarProps) {
  const router = useRouter();
  const { feeds, feedsWithCounts, totalUnreadCount, loadFeedHierarchy } =
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
  const { theme, setTheme } = useUIStore();
  const { readStatusFilter } = useArticleStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollPosition = useRef<number>(0);

  // Load feeds when component mounts
  useEffect(() => {
    console.log(
      "[SimpleFeedSidebar] Component mounted, loading feeds and sync status..."
    );
    const startTime = performance.now();
    
    // Load both feed hierarchy and last sync time
    Promise.all([
      loadFeedHierarchy(),
      loadLastSyncTime()
    ]).then(() => {
      console.log(
        `[SimpleFeedSidebar] Initial load completed in ${(performance.now() - startTime).toFixed(2)}ms`
      );
    });
  }, [loadFeedHierarchy]);

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
          <h2 className="text-lg font-semibold">Feeds</h2>
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
              onClick={performFullSync}
              disabled={isSyncing}
              className="relative rounded p-2 hover:bg-muted disabled:opacity-50"
              aria-label={isSyncing ? "Syncing..." : "Sync feeds"}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isSyncing && syncProgress > 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 transform text-[10px] font-medium">
                  {syncProgress}%
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalUnreadCount} unread articles
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
              onClick={performFullSync}
              className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* All Articles */}
            <div
              className={`cursor-pointer p-3 hover:bg-muted/50 ${!selectedFeedId ? "bg-muted font-medium" : ""}`}
              onClick={() => onFeedSelect(null)}
            >
              <div className="flex items-center justify-between">
                <span>All Articles</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {totalUnreadCount}
                </span>
              </div>
            </div>

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

            {/* Individual Feeds */}
            {Array.from(feeds.values())
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
                    className={`cursor-pointer p-3 transition-all hover:bg-muted/50 ${
                      isSelected ? "bg-muted font-medium" : ""
                    } ${
                      !hasUnread && !isSelected
                        ? "opacity-35 hover:opacity-100"
                        : ""
                    }`}
                    onClick={() => onFeedSelect(feed.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        {String(feed.title || "Untitled Feed")}
                      </span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {unreadCount > 999 ? "999+" : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

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
