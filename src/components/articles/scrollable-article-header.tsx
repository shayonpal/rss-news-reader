/**
 * RR-215: iOS Scrollable Article Header Wrapper
 * Wraps ArticleHeader with iOS-style scrollable behavior and liquid glass effects
 */

"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
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
    contentVisible 
  } = useIOSHeaderScroll();

  // Content functionality from ScrollableContentHeader
  const { readStatusFilter, markAllAsRead, markAllAsReadForTag } = useArticleStore();
  const getFeed = useFeedStore(state => state.getFeed);
  const getFolder = useFeedStore(state => state.getFolder);
  const tags = useTagStore(state => state.tags);
  
  const [counts, setCounts] = useState<ArticleCounts>({ total: 0, unread: 0, read: 0 });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countManager = useRef(new ArticleCountManager());

  // Get selected feed/folder/tag objects (memoized to prevent re-renders)
  const selectedFeed = useMemo(() => 
    selectedFeedId ? getFeed(selectedFeedId) : undefined, 
    [selectedFeedId, getFeed]
  );
  const selectedFolder = useMemo(() => 
    selectedFolderId ? getFolder(selectedFolderId) : undefined, 
    [selectedFolderId, getFolder]
  );
  const selectedTag = useMemo(() => 
    selectedTagId ? tags.get(selectedTagId) : undefined, 
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

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
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

  // Dynamic styles based on scroll position
  const containerStyles: React.CSSProperties = {
    // iOS Liquid Glass effect
    backdropFilter: supportsBackdropFilter
      ? `blur(${blurIntensity}px) saturate(180%)`
      : undefined,
    WebkitBackdropFilter: supportsBackdropFilter
      ? `blur(${blurIntensity}px) saturate(180%)`
      : undefined,

    // Background with progressive enhancement
    background: supportsBackdropFilter
      ? `rgba(255, 255, 255, ${Math.min(0.22, 0.18 + scrollY / 1000)})`
      : "rgba(255, 255, 255, 0.95)",

    // Height animation
    height: `${headerHeight}px`,

    // Transition timing with iOS spring physics
    transition: "all 0.3s cubic-bezier(0.32, 0.72, 0, 1)",

    // Glass border
    borderBottom: `1px solid rgba(0, 0, 0, ${Math.min(0.08, 0.04 + scrollY / 2000)})`,

    // Performance optimizations
    willChange: "transform, backdrop-filter, background, height",
    transform: "translateZ(0)", // Force GPU acceleration
  };

  const titleStyles: React.CSSProperties = {
    transform: `scale(${titleScale})`,
    opacity: Math.max(0.7, 1 - scrollY / 200),
    fontSize:
      scrollY <= 44
        ? "34px"
        : scrollY <= 150
          ? `${34 - (scrollY - 44) * 0.17}px`
          : "17px",
    transition: "all 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
    willChange: "transform",
    transformOrigin: "left center",
  };

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

      const contextName = selectedTag?.name || selectedFeed?.title || "articles";
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
      data-testid="scrollable-header-container"
      data-scroll-state={scrollState}
      data-owner="UnifiedScrollableHeader"
      role="banner"
      className="fixed left-0 right-0 top-0 z-40 overflow-hidden"
      style={{
        ...containerStyles,
        height: "auto", // Let content determine height
        minHeight: headerHeight,
      }}
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

          {/* Dynamic Navigation Title */}
          <h1
            data-testid="header-title"
            role="heading"
            aria-level={1}
            className={`truncate font-bold text-foreground ${
              onMenuClick ? "mx-4 flex-1" : "mx-auto text-center"
            }`}
            style={titleStyles}
          >
            RSS News Reader
          </h1>

          {/* Spacer for layout balance - only when hamburger is shown */}
          {onMenuClick && <div className="h-12 w-12" />}
        </div>

        {/* Content Section - Slides up/down with scroll */}
        <div 
          className="px-4 pb-4 transition-all duration-300 ease-out"
          style={{
            transform: contentVisible ? "translateY(0)" : "translateY(-100%)",
            opacity: contentVisible ? 1 : 0,
          }}
        >
          {/* Page Title and Count */}
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {pageTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {getCountDisplay()}
            </p>
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
                className={`
                  liquid-glass-btn h-10 px-4 rounded-full
                  transition-all duration-200 ease-out
                  ${getButtonState() === "disabled" ? "opacity-50 cursor-not-allowed" : ""}
                  ${getButtonState() === "confirming" ? "ring-2 ring-primary/50" : ""}
                `}
              >
                <span className="text-sm font-medium">
                  {getButtonState() === "loading" && (
                    <Loader2 className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  )}
                  {getButtonState() === "confirming" ? "Click again to confirm" : "Mark All Read"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dark mode support */}
      <style jsx>{`
        .dark [data-testid="scrollable-header-container"] {
          background: ${supportsBackdropFilter
            ? `rgba(10, 10, 10, ${Math.min(0.22, 0.18 + scrollY / 1000)})`
            : "rgba(0, 0, 0, 0.9)"};
          border-bottom-color: rgba(
            255,
            255,
            255,
            ${Math.min(0.08, 0.04 + scrollY / 2000)}
          );
        }
      `}</style>
    </header>
  );
}
