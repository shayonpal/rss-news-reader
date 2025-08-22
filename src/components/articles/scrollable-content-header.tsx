/**
 * RR-215 Enhancement: Scrollable Content Header
 * Contains page title, filters, and controls that slide up/down with scroll
 */

"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { ReadStatusFilter } from "./read-status-filter";
import { useIOSHeaderScroll } from "@/hooks/use-ios-header-scroll";
import { getDynamicPageTitle } from "@/lib/article-count-manager";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useTagStore } from "@/lib/stores/tag-store";
import DOMPurify from "dompurify";
import { ArticleCountManager } from "@/lib/article-count-manager";
import { useState } from "react";
import { toast } from "sonner";

interface ArticleCounts {
  total: number;
  unread: number;
  read: number;
}

interface ScrollableContentHeaderProps {
  selectedFeedId?: string | null;
  selectedFolderId?: string | null;
  selectedTagId?: string | null;
}

/**
 * Scrollable content area containing page headers, filters, and controls
 * Slides up when scrolling down, slides down when scrolling up
 */
export const ScrollableContentHeader = React.memo(
  function ScrollableContentHeader({
    selectedFeedId,
    selectedFolderId,
    selectedTagId,
  }: ScrollableContentHeaderProps) {
    console.log(
      "%c[ScrollableContentHeader] I AM MOUNTING",
      "color: green; font-size: 16px;"
    );
    console.log("Props:", { selectedFeedId, selectedFolderId, selectedTagId });
    const { contentVisible } = useIOSHeaderScroll();
    const { readStatusFilter, markAllAsRead, markAllAsReadForTag } =
      useArticleStore();

    // Minimize store subscriptions to prevent re-renders
    const getFeed = useFeedStore((state) => state.getFeed);
    const getFolder = useFeedStore((state) => state.getFolder);
    const tags = useTagStore((state) => state.tags);

    const contentRef = useRef<HTMLDivElement>(null);
    const [counts, setCounts] = useState<ArticleCounts>({
      total: 0,
      unread: 0,
      read: 0,
    });
    const [isLoadingCounts, setIsLoadingCounts] = useState(true);
    const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
    const [waitingConfirmation, setWaitingConfirmation] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const countManager = useRef(new ArticleCountManager());

    // Get selected feed/folder/tag objects (memoized to prevent re-renders)
    const selectedFeed = useMemo(
      () => (selectedFeedId ? getFeed(selectedFeedId) : undefined),
      [selectedFeedId, getFeed]
    );
    const selectedFolder = useMemo(
      () => (selectedFolderId ? getFolder(selectedFolderId) : undefined),
      [selectedFolderId, getFolder]
    );
    const selectedTag = useMemo(
      () => (selectedTagId ? tags.get(selectedTagId) : undefined),
      [selectedTagId, tags]
    );

    useEffect(() => {
      setHydrated(true);
    }, []);

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
          setCounts({ total: 0, unread: 0, read: 0 });
        } finally {
          setIsLoadingCounts(false);
        }
      };

      fetchCounts();
    }, [readStatusFilter, selectedFeedId, selectedFolderId]);

    // Content visibility based on scroll behavior
    useEffect(() => {
      if (!contentRef.current) return;

      const element = contentRef.current;

      if (contentVisible) {
        element.style.transform = "translateY(0)";
        element.style.opacity = "1";
      } else {
        element.style.transform = "translateY(-100%)";
        element.style.opacity = "0";
      }
    }, [contentVisible]);

    const pageTitle = hydrated
      ? getDynamicPageTitle(
          readStatusFilter,
          selectedFeed,
          selectedFolder,
          selectedTag
            ? {
                ...selectedTag,
                name: DOMPurify.sanitize(selectedTag.name, {
                  ALLOWED_TAGS: [],
                }),
              }
            : undefined
        )
      : "Articles";

    const getCountDisplay = () => {
      if (!hydrated || isLoadingCounts) {
        return "Loading counts...";
      }
      return countManager.current.getCountDisplay(counts, readStatusFilter);
    };

    const getButtonState = () => {
      if (isMarkingAllRead) return "loading";
      if (waitingConfirmation) return "confirming";
      if (counts.unread === 0) return "disabled";
      return "normal";
    };

    const handleMarkAllClick = async () => {
      if ((!selectedFeedId && !selectedTagId) || isMarkingAllRead) return;

      // First click - show confirmation state
      if (!waitingConfirmation) {
        setWaitingConfirmation(true);

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

      try {
        if (selectedTagId) {
          await markAllAsReadForTag(selectedTagId);
        } else if (selectedFeedId) {
          await markAllAsRead(selectedFeedId);
        }

        // Refresh counts
        const newCounts = await countManager.current.getArticleCounts(
          selectedFeedId || undefined,
          selectedFolderId || undefined
        );
        setCounts(newCounts);

        const contextName =
          selectedTag?.name || selectedFeed?.title || "articles";
        const sanitizedName = selectedTag?.name
          ? DOMPurify.sanitize(selectedTag.name, { ALLOWED_TAGS: [] })
          : contextName;

        toast.success(
          selectedTagId
            ? `Marked all "${sanitizedName}" articles as read`
            : `Marked all articles as read in ${sanitizedName}`
        );
      } catch (error) {
        console.error("Failed to mark all as read:", error);
        toast.error("Failed to mark all articles as read");
      } finally {
        setIsMarkingAllRead(false);
      }
    };

    // Clean up timeout on unmount
    useEffect(() => {
      return () => {
        if (confirmTimeoutRef.current) {
          clearTimeout(confirmTimeoutRef.current);
        }
      };
    }, []);

    return (
      <div
        ref={contentRef}
        data-owner="ScrollableContentHeader"
        data-testid="scrollable-content-header-debug"
        className="fixed left-0 right-0 z-50 border-b bg-background/95 backdrop-blur-sm transition-all duration-300 ease-out"
        style={{
          top: "64px", // Below the navigation header
          willChange: "transform, opacity",
          transform: "translateZ(0)", // GPU acceleration
          minHeight: "120px", // Ensure it covers any static content
        }}
      >
        <div className="px-4 py-4 md:px-6">
          {/* Page Title and Count */}
          <div className="mb-4">
            <h1 className="mb-1 text-2xl font-bold text-foreground">
              {pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{getCountDisplay()}</p>
          </div>

          {/* Filter Controls and Actions */}
          <div className="flex items-center justify-between gap-4">
            {/* Read Status Filter */}
            <ReadStatusFilter />

            {/* Mark All Read Button */}
            {(selectedFeedId || selectedTagId) && (
              <button
                onClick={handleMarkAllClick}
                disabled={counts.unread === 0 && !waitingConfirmation}
                className={`liquid-glass-btn h-10 rounded-full px-4 transition-all duration-200 ease-out ${getButtonState() === "disabled" ? "cursor-not-allowed opacity-50" : ""} ${getButtonState() === "confirming" ? "ring-2 ring-primary/50" : ""} `}
              >
                <span className="text-sm font-medium">
                  {getButtonState() === "loading" && (
                    <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  {getButtonState() === "confirming"
                    ? "Click again to confirm"
                    : "Mark All Read"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);
