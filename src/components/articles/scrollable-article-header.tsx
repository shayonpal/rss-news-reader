/**
 * RR-215: iOS Scrollable Article Header Wrapper
 * Wraps ArticleHeader with iOS-style scrollable behavior and liquid glass effects
 */

"use client";

import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { MorphingNavButton } from "@/components/ui/morphing-nav-button";
import { useIOSHeaderScroll } from "@/hooks/use-ios-header-scroll";
import { ReadStatusFilter } from "./read-status-filter";
import { getDynamicPageTitle } from "@/lib/article-count-manager";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useTagStore } from "@/lib/stores/tag-store";
import DOMPurify from "dompurify";
import { ArticleCountManager } from "@/lib/article-count-manager";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CircleCheckBig } from "lucide-react";

// Import ArticleHeader props interface
interface ArticleHeaderProps {
  selectedFeedId?: string | null;
  selectedFolderId?: string | null;
  selectedTagId?: string | null;
  isMobile?: boolean;
  onMenuClick?: () => void;
  menuIcon?: React.ReactNode;
}

interface ScrollableArticleHeaderProps extends ArticleHeaderProps {
  // Content section props - these are now handled internally via stores
}

interface ArticleCounts {
  total: number;
  unread: number;
  read: number;
}

/**
 * iOS-style scrollable header wrapper that enhances ArticleHeader
 * with liquid glass effects and morphing navigation
 */
export function ScrollableArticleHeader({
  selectedFeedId,
  selectedFolderId,
  selectedTagId,
  onMenuClick,
  ...props
}: ScrollableArticleHeaderProps) {
  const {
    scrollState,
    scrollY,
    titleScale,
    headerHeight,
    blurIntensity,
    contentVisible,
  } = useIOSHeaderScroll();

  // Content functionality from ScrollableContentHeader
  const { readStatusFilter, markAllAsRead, markAllAsReadForTag } =
    useArticleStore();
  const getFeed = useFeedStore((state) => state.getFeed);
  const getFolder = useFeedStore((state) => state.getFolder);
  const tags = useTagStore((state) => state.tags);

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

  // RR-248: Performance optimization refs
  const headerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);

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

  // RR-248: Performance-optimized scroll handler with requestAnimationFrame
  useEffect(() => {
    const updateHeaderStyles = () => {
      if (!headerRef.current || !titleRef.current) return;

      const currentScrollY = scrollY;
      if (Math.abs(currentScrollY - lastScrollYRef.current) < 1) {
        // Skip update if scroll change is minimal
        return;
      }

      lastScrollYRef.current = currentScrollY;

      // Use CSS custom properties for GPU-accelerated animations
      const header = headerRef.current;
      const title = titleRef.current;

      // Batch CSS variable updates
      header.style.setProperty("--scroll-y", currentScrollY.toString());
      header.style.setProperty("--blur-intensity", blurIntensity.toString());
      header.style.setProperty("--header-height", `${headerHeight}px`);
      header.style.setProperty(
        "--background-opacity",
        Math.min(0.22, 0.18 + currentScrollY / 1000).toString()
      );
      header.style.setProperty(
        "--border-opacity",
        Math.min(0.08, 0.04 + currentScrollY / 2000).toString()
      );

      title.style.setProperty("--title-scale", titleScale.toString());
      title.style.setProperty(
        "--title-opacity",
        Math.max(0.7, 1 - currentScrollY / 200).toString()
      );

      const fontSize =
        currentScrollY <= 44
          ? 34
          : currentScrollY <= 150
            ? 34 - (currentScrollY - 44) * 0.17
            : 17;
      title.style.setProperty("--title-font-size", `${fontSize}px`);
    };

    // Use requestAnimationFrame for smooth updates
    const scheduleUpdate = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(updateHeaderStyles);
    };

    scheduleUpdate();

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [scrollY, titleScale, headerHeight, blurIntensity]);

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

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Check for backdrop-filter support
  const supportsBackdropFilter =
    typeof window !== "undefined" && typeof CSS !== "undefined"
      ? CSS.supports?.("backdrop-filter", "blur(1px)") ||
        CSS.supports?.("-webkit-backdrop-filter", "blur(1px)") ||
        false
      : true;

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    }
  };

  // Content functionality
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

  return (
    <header
      ref={headerRef}
      data-testid="scrollable-header-container"
      data-scroll-state={scrollState}
      data-owner="UnifiedScrollableHeader"
      role="banner"
      className="scrollable-article-header fixed left-0 right-0 top-0 z-40 overflow-hidden"
      style={
        {
          // Static styles for non-animated properties
          minHeight: `${headerHeight}px`,
          // CSS custom properties will handle dynamic values via RAF updates
          "--supports-backdrop-filter": supportsBackdropFilter ? "1" : "0",
        } as React.CSSProperties
      }
    >
      <div className="relative">
        {/* Navigation Section */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Morphing Navigation Button - Only show on mobile/collapsed sidebar */}
          {onMenuClick && (
            <MorphingNavButton
              scrollState={scrollState}
              onClick={handleMenuClick}
              ariaLabel={
                scrollState === "collapsed" ? "Go back" : "Toggle sidebar"
              }
            />
          )}

          {/* Page Title with Scroll Effects */}
          <div
            ref={titleRef}
            className="scrollable-title flex-1 px-2 text-center"
            data-testid="scrollable-title"
          >
            <h1 className="scrollable-title-text truncate font-bold text-foreground">
              {pageTitle}
            </h1>
          </div>

          {/* Mark All Read Button */}
          {selectedFeedId || selectedTagId ? (
            <button
              onClick={handleMarkAllClick}
              disabled={getButtonState() === "disabled"}
              className={`liquid-glass-mark-all-read state-${getButtonState()} relative h-12 w-12 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50`}
              aria-label="Mark all articles as read"
            >
              {getButtonState() === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : getButtonState() === "confirming" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CircleCheckBig className="h-5 w-5" />
              )}
            </button>
          ) : (
            <div className="w-14" /> /* Spacer for alignment */
          )}
        </div>

        {/* Content Visible Section */}
        {contentVisible && (
          <div className="border-t border-border/50 px-4 pb-3 pt-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span data-testid="article-count">{getCountDisplay()}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
