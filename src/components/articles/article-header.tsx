/**
 * Article Header Component with Database-Driven Counts
 * Based on PRD Section: Read Status Filtering with Database Counts
 *
 * Displays dynamic page titles and accurate article counts from database
 * with 5-minute caching for performance optimization.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useViewport } from "@/hooks/use-viewport";
import { ReadStatusFilter } from "./read-status-filter";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import {
  ArticleCountManager,
  getDynamicPageTitle,
} from "@/lib/article-count-manager";
import { Button } from "@/components/ui/button";
import { CircleCheckBig, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Feed, Folder } from "@/types";
import { useTagStore } from "@/lib/stores/tag-store";
import DOMPurify from "isomorphic-dompurify";

interface ArticleCounts {
  total: number;
  unread: number;
  read: number;
}

interface ArticleHeaderProps {
  selectedFeedId?: string | null;
  selectedFolderId?: string | null;
  selectedTagId?: string | null;
  isMobile?: boolean;
  onMenuClick?: () => void;
  menuIcon?: React.ReactNode;
}

export function ArticleHeader({
  selectedFeedId,
  selectedFolderId,
  selectedTagId,
  isMobile = false,
  onMenuClick,
  menuIcon,
}: ArticleHeaderProps) {
  const {
    readStatusFilter,
    markAllAsRead,
    markAllAsReadForTag,
    refreshArticles,
  } = useArticleStore();
  const { getFeed, getFolder } = useFeedStore();
  const { tags } = useTagStore();
  const viewport = useViewport();
  const [counts, setCounts] = useState<ArticleCounts>({
    total: 0,
    unread: 0,
    read: 0,
  });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);

  // RR-179: Liquid Glass button state machine
  const getButtonState = () => {
    if (isMarkingAllRead) return "loading";
    if (waitingConfirmation) return "confirming";
    if (counts.unread === 0) return "disabled";
    return "normal";
  };
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countManager = useRef(new ArticleCountManager());

  // Get selected feed/folder/tag objects
  const selectedFeed = selectedFeedId ? getFeed(selectedFeedId) : undefined;
  const selectedFolder = selectedFolderId
    ? getFolder(selectedFolderId)
    : undefined;
  const selectedTag = selectedTagId ? tags.get(selectedTagId) : undefined;

  // Fetch counts when filters change
  useEffect(() => {
    const fetchCounts = async () => {
      setIsLoadingCounts(true);
      try {
        const newCounts = await countManager.current.getArticleCounts(
          selectedFeedId || undefined,
          selectedFolderId || undefined
        );
        setCounts(newCounts);
      } catch (error) {
        console.error("Failed to fetch article counts:", error);
        // Fallback to zero counts on error
        setCounts({ total: 0, unread: 0, read: 0 });
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchCounts();
  }, [readStatusFilter, selectedFeedId, selectedFolderId]);

  // Function to invalidate cache on article actions
  const handleArticleAction = () => {
    countManager.current.invalidateCache(selectedFeedId || undefined);
  };

  // Expose cache invalidation to parent components
  useEffect(() => {
    // Store reference for external cache invalidation
    (window as any).__articleCountManager = countManager.current;

    return () => {
      delete (window as any).__articleCountManager;
    };
  }, []);

  // Get dynamic title based on PRD specifications
  // Use state to avoid hydration mismatch
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const pageTitle = hydrated
    ? getDynamicPageTitle(
        readStatusFilter,
        selectedFeed,
        selectedFolder,
        selectedTag
          ? {
              ...selectedTag,
              name: DOMPurify.sanitize(selectedTag.name, { ALLOWED_TAGS: [] }),
            }
          : undefined
      )
    : "Articles"; // Safe fallback during SSR

  // Get count display based on filter
  const getCountDisplay = () => {
    if (!hydrated || isLoadingCounts) {
      return "Loading counts...";
    }

    return countManager.current.getCountDisplay(counts, readStatusFilter);
  };

  // Clear confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  // RR-179: Handle mark all as read button click (both feed and tag contexts)
  const handleMarkAllClick = async () => {
    if ((!selectedFeedId && !selectedTagId) || isMarkingAllRead) return;

    // Slice 6b: Check network status for better error handling
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    // Slice 6d: Simple cross-tab coordination check
    const lockKey = `mark-all-read-${selectedFeedId || selectedTagId}-lock`;
    const existingLock = localStorage.getItem(lockKey);

    if (existingLock) {
      const lockTime = parseInt(existingLock);
      const isStale = Date.now() - lockTime > 10000; // 10 second timeout

      if (!isStale) {
        toast.error("Mark All Read is running in another tab • Please wait");
        return;
      }
    }

    // First click - show confirmation state
    if (!waitingConfirmation) {
      setWaitingConfirmation(true);

      // Auto-cancel confirmation after 3 seconds
      confirmTimeoutRef.current = setTimeout(() => {
        setWaitingConfirmation(false);
      }, 3000);

      return;
    }

    // Second click - execute action
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }

    setWaitingConfirmation(false);
    setIsMarkingAllRead(true);

    // Slice 6d: Set cross-tab lock
    localStorage.setItem(lockKey, Date.now().toString());

    // Slice 6e: Store original counters for rollback
    let originalTagCount: number | undefined;
    if (selectedTagId) {
      const { tags } = useTagStore.getState();
      originalTagCount = tags.get(selectedTagId)?.unreadCount;
    }

    try {
      // RR-179: Execute appropriate function based on context
      if (selectedTagId) {
        await markAllAsReadForTag(selectedTagId);
      } else if (selectedFeedId) {
        await markAllAsRead(selectedFeedId);
      }

      // Invalidate cache to refresh counts
      if (selectedFeedId) {
        countManager.current.invalidateCache(selectedFeedId);
      }
      // For tags, invalidation happens in markAllAsReadForTag for all affected feeds

      // RR-179 Fix: Don't call refreshArticles() since localStorage optimization handles UI updates
      // The ArticleList component will automatically update through the store state changes
      // Only re-fetch counts for the header display
      const newCounts = await countManager.current.getArticleCounts(
        selectedFeedId || undefined,
        selectedFolderId || undefined
      );
      setCounts(newCounts);

      // RR-179: Context-appropriate success message
      const contextName =
        selectedTag?.name || selectedFeed?.title || "articles";
      const sanitizedName = selectedTag?.name
        ? DOMPurify.sanitize(selectedTag.name, { ALLOWED_TAGS: [] })
        : contextName;

      // Show toast immediately before any other operations
      toast.success(
        selectedTagId
          ? `Marked all "${sanitizedName}" articles as read`
          : `Marked all articles as read in ${sanitizedName}`
      );

      console.log("✅ Toast shown, continuing with refresh operations...");
    } catch (error) {
      console.error("Failed to mark all as read:", error);

      // RR-179 Slice 6: Enhanced error handling with specific messages
      let errorMessage = "Failed to mark all articles as read";

      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        errorMessage =
          "Storage limit reached • Operation completed with reduced functionality";
      } else if (error instanceof Error) {
        if (
          error.message.includes("Network") ||
          error.message.includes("fetch")
        ) {
          errorMessage = isOnline
            ? "Network error • Changes saved locally and will sync when online"
            : "You're offline • Changes saved locally and will sync when online";
        } else if (error.message.includes("articles")) {
          errorMessage = "No articles found to mark as read";
        } else if (error.message.includes("tag")) {
          errorMessage = "Tag not found or has no articles";
        }
      }

      // Slice 6e: Rollback optimistic tag counter update on failure
      if (selectedTagId && originalTagCount !== undefined) {
        try {
          const { useTagStore } = await import("@/lib/stores/tag-store");
          const tagState = useTagStore.getState();
          const currentTag = tagState.tags.get(selectedTagId);
          const currentCount = currentTag?.unreadCount || 0;

          if (currentCount !== originalTagCount) {
            const rollbackDelta = originalTagCount - currentCount;
            tagState.updateTagUnreadCount(selectedTagId, rollbackDelta);
            console.log(
              `[RR-179] Rollback: Restored tag ${selectedTagId} counter to ${originalTagCount}`
            );
          }
        } catch (rollbackError) {
          console.warn("Failed to rollback tag counter:", rollbackError);
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsMarkingAllRead(false);
      // Slice 6d: Clear cross-tab lock
      try {
        localStorage.removeItem(lockKey);
      } catch (e) {
        console.warn("Failed to clear mark-all-read lock:", e);
      }
    }
  };

  return (
    <header
      className="article-header pwa-safe-area-top flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6 md:py-4"
      onClick={(e) => {
        // RR-179: Tap outside to cancel confirmation (iOS 26 pattern)
        if (
          waitingConfirmation &&
          !e.currentTarget
            .querySelector(".liquid-glass-mark-all-read")
            ?.contains(e.target as Node)
        ) {
          setWaitingConfirmation(false);
          if (confirmTimeoutRef.current) {
            clearTimeout(confirmTimeoutRef.current);
          }
        }
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Mobile Menu Button */}
        {isMobile && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="flex-shrink-0 rounded-lg p-2 hover:bg-muted"
            aria-label="Toggle sidebar"
          >
            {menuIcon}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="break-words text-lg font-semibold sm:text-xl md:text-2xl">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {/* RR-179: Collapsible Read Status Filter (iOS 26 pattern) */}
        <div
          className={`segmented-control-wrapper ${
            waitingConfirmation ? "collapsed" : ""
          }`}
        >
          <ReadStatusFilter />
        </div>

        {/* RR-179: Liquid Glass Mark All Read Button - positioned after filter (POC layout) */}
        {(selectedFeedId || selectedTagId) && (
          <button
            onClick={handleMarkAllClick}
            disabled={isMarkingAllRead || counts.unread === 0}
            className={`liquid-glass-mark-all-read state-${getButtonState()}`}
            title={
              waitingConfirmation
                ? "Click again to confirm"
                : selectedTagId
                  ? `Mark all "${selectedTag?.name || "tag"}" articles as read`
                  : "Mark all articles in this feed as read"
            }
            data-state={getButtonState()}
          >
            {isMarkingAllRead ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {!viewport.shouldShowCompactFilters && <span>Marking...</span>}
              </>
            ) : waitingConfirmation ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Confirm?</span>
              </>
            ) : (
              <>
                <CircleCheckBig className="h-3.5 w-3.5" />
                {!viewport.shouldShowCompactFilters && (
                  <span>Mark All Read</span>
                )}
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}

/**
 * Hook for invalidating article counts cache
 * Use this after marking articles as read/unread
 */
export function useArticleCountInvalidation() {
  return {
    invalidateCache: (feedId?: string) => {
      const manager = (window as any)
        .__articleCountManager as ArticleCountManager;
      if (manager) {
        manager.invalidateCache(feedId);
      }
    },
  };
}
