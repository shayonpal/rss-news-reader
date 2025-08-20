"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";
import { ArticleList } from "@/components/articles/article-list";
import { ArticleHeader } from "@/components/articles/article-header";
import { ReadStatusFilter } from "@/components/articles/read-status-filter";
import { ScrollHideFloatingElement } from "@/components/ui/scroll-hide-floating-element";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { useTagStore } from "@/lib/stores/tag-store";
import { ErrorBoundary } from "@/components/error-boundary";
import { useHydrationFix } from "@/hooks/use-hydration-fix";
import { useViewport } from "@/hooks/use-viewport";
import {
  Menu,
  X,
  ArrowUp,
  Loader2,
  AlertTriangle,
  CircleCheckBig,
} from "lucide-react";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { ArticleCountManager } from "@/lib/article-count-manager";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { setNavigatingToArticle, markAllAsRead, markAllAsReadForTag, readStatusFilter } =
    useArticleStore();
  const { getFeed } = useFeedStore();
  const { tags } = useTagStore();

  // Mark all read functionality
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const [counts, setCounts] = useState({ total: 0, unread: 0, read: 0 });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countManager = useRef(new ArticleCountManager());

  // Fix hydration issues with localStorage
  useHydrationFix();

  // Clear preserved article state on page unload (browser refresh, tab close, etc.)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only clear if user is refreshing or closing tab, not navigating within app
      articleListStateManager.clearState();
    };

    // Listen for page unload events (browser refresh, tab close, etc.)
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Header show/hide refs
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const filterControlsRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize states - we'll set them from URL/sessionStorage in useEffect
  // This avoids hydration mismatch while ensuring filters are ready
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filtersReady, setFiltersReady] = useState(false); // <-- ADD THIS

  // Parse URL parameters for filters as primary source
  useEffect(() => {
    // RR-27 Fix: Only update filter state when on the list page to prevent false filter changes
    if (!pathname.endsWith("/reader") && pathname !== "/") {
      console.log(
        `🔗 RR-27: Skipping filter update - not on list page (pathname: ${pathname})`
      );
      return;
    }

    const feedFromUrl = searchParams.get("feed");
    const tagFromUrl = searchParams.get("tag");

    // RR-216 Fix: Filter state preservation when navigating back from article detail
    // Problem: URL showed correct filter but article list showed all articles
    // Root cause: Race condition between handleTagSelect/handleFeedSelect calling each other
    // Solution:
    // 1. URL is the single source of truth for filter state
    // 2. Fixed router.replace() basePath handling (Next.js handles automatically)
    // 3. Prevented duplicate handler calls from sidebar (removed onFeedSelect(null) from tag clicks)
    // 4. Added proper filter coordination in handlers to avoid URL overwrites
    // 5. Added pathname check to prevent false filter changes during article navigation (RR-27)
    // Always set filter state based on URL, don't fallback to sessionStorage
    setSelectedFeedId(feedFromUrl);
    setSelectedTagId(tagFromUrl);

    // Save to sessionStorage for the article detail back button
    sessionStorage.setItem("articleListFilter", feedFromUrl || "null");
    sessionStorage.setItem("articleListTagFilter", tagFromUrl || "null");

    console.log(
      `📍 HomePage: Set filters from URL - feed: ${feedFromUrl}, tag: ${tagFromUrl}`
    );
    setFiltersReady(true); // <-- ADD THIS
  }, [searchParams, pathname]);

  const viewport = useViewport();
  // Initialize sidebar state to prevent flash - start with mobile assumption
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Fix iOS detection hydration issue - use state instead of direct check
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    setIsHydrated(true);
  }, []);

  // Auto-manage sidebar state based on viewport - only after hydration
  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration to prevent flash
    
    if (!viewport.shouldCollapseSidebar) {
      // On tablet/desktop, sidebar should always be open
      setIsSidebarOpen(true);
    } else {
      // On mobile, sidebar starts closed
      setIsSidebarOpen(false);
    }
  }, [viewport.shouldCollapseSidebar, isHydrated]);

  const handleArticleClick = (articleId: string) => {
    // RR-27 Fix: Set navigation intent to prevent preservation clearing
    console.log(
      `🔗 RR-27: Setting navigation intent before article navigation`
    );
    setNavigatingToArticle(true);

    // Next.js automatically prepends basePath to router operations
    router.push(`/article/${encodeURIComponent(articleId)}`);
  };

  const articleListRef = useRef<HTMLDivElement>(null);

  const handleFeedSelect = (feedId: string | null) => {
    setSelectedFeedId(feedId);
    // Save filter state for restoration
    sessionStorage.setItem("articleListFilter", feedId || "null");

    // When selecting a feed, clear tag selection but don't update URL yet
    if (feedId) {
      setSelectedTagId(null);
      sessionStorage.setItem("articleListTagFilter", "null");
    }

    // RR-197 Critical Fix: Use searchParams directly instead of stale React state
    // Update URL with filter (use replace to avoid history pollution)
    const params = new URLSearchParams(searchParams.toString());
    if (feedId) {
      params.set("feed", feedId);
      params.delete("tag"); // Clear tag when feed is selected
    } else {
      params.delete("feed");
    }
    // Keep tag if present and no feed selected - use searchParams directly to avoid stale state
    if (!feedId && searchParams.get("tag")) {
      params.set("tag", searchParams.get("tag")!);
    }
    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";
    console.log(
      `🔧 [RR-197] Expert Fix: Feed filter - Updating URL to: ${newUrl} (queryString: ${queryString})`
    );
    // Next.js automatically prepends basePath to router operations
    router.replace(newUrl as any);
    // Reset article list scroll position to top after filter change
    requestAnimationFrame(() => {
      if (articleListRef.current) {
        articleListRef.current.scrollTo({ top: 0, behavior: "auto" });
      }
    });

    // Close sidebar on mobile after selection
    if (viewport.shouldCollapseSidebar) {
      setIsSidebarOpen(false);
    }
  };

  const handleTagSelect = (tagId: string | null) => {
    setSelectedTagId(tagId);
    // Save tag filter state for restoration
    sessionStorage.setItem("articleListTagFilter", tagId || "null");

    // When selecting a tag, clear feed selection but don't update URL yet
    // The URL update will happen in the useEffect that watches for state changes
    if (tagId) {
      setSelectedFeedId(null);
      sessionStorage.setItem("articleListFilter", "null");
    }

    // Update URL with filter (use replace to avoid history pollution)
    const params = new URLSearchParams(searchParams.toString());
    if (tagId) {
      params.set("tag", tagId);
      params.delete("feed"); // Clear feed when tag is selected
    } else {
      params.delete("tag");
    }
    // Do not re-add feed when clearing tag to avoid URL race (RR-197/RR-216)
    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";
    console.log(
      `🔄 RR-216: Tag filter - Updating URL to: ${newUrl} (queryString: ${queryString})`
    );
    // Next.js automatically prepends basePath to router operations
    router.replace(newUrl as any);
    // Reset article list scroll position to top after filter change
    requestAnimationFrame(() => {
      if (articleListRef.current) {
        articleListRef.current.scrollTo({ top: 0, behavior: "auto" });
      }
    });

    // Close sidebar on mobile after selection
    if (viewport.shouldCollapseSidebar) {
      setIsSidebarOpen(false);
    }
  };

  // Unified clear filters handler for "All Articles"
  const handleClearFilters = () => {
    // Clear local state
    setSelectedFeedId(null);
    setSelectedTagId(null);
    // Update session storage
    sessionStorage.setItem("articleListFilter", "null");
    sessionStorage.setItem("articleListTagFilter", "null");

    // Build new URL with both params removed
    const params = new URLSearchParams(searchParams.toString());
    params.delete("feed");
    params.delete("tag");
    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";
    console.log(`🧹 Clearing filters - Updating URL to: ${newUrl}`);
    router.replace(newUrl as any);

    // Reset scroll to top for fresh scope
    requestAnimationFrame(() => {
      if (articleListRef.current) {
        articleListRef.current.scrollTo({ top: 0, behavior: "auto" });
      }
    });

    // Close sidebar on mobile
    if (viewport.shouldCollapseSidebar) {
      setIsSidebarOpen(false);
    }
  };

  // Mark all read functionality
  const getButtonState = () => {
    if (isMarkingAllRead) return "loading";
    if (waitingConfirmation) return "confirming";
    if (counts.unread === 0) return "disabled";
    return "normal";
  };

  const handleMarkAllClick = async () => {
    if ((!selectedFeedId && !selectedTagId) || isMarkingAllRead) return;

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const lockKey = `mark-all-read-${selectedFeedId || selectedTagId}-lock`;
    const existingLock = localStorage.getItem(lockKey);

    if (existingLock) {
      const lockTime = parseInt(existingLock);
      const isStale = Date.now() - lockTime > 10000;

      if (!isStale) {
        toast.error("Mark All Read is running in another tab • Please wait");
        return;
      }
    }

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
    localStorage.setItem(lockKey, Date.now().toString());

    try {
      if (selectedTagId) {
        await markAllAsReadForTag(selectedTagId);
      } else if (selectedFeedId) {
        await markAllAsRead(selectedFeedId);
      }

      const selectedFeed = selectedFeedId ? getFeed(selectedFeedId) : undefined;
      const selectedTag = selectedTagId ? tags.get(selectedTagId) : undefined;
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
      try {
        localStorage.removeItem(lockKey);
      } catch (e) {
        console.warn("Failed to clear mark-all-read lock:", e);
      }
    }
  };

  // Fetch counts when filters change
  useEffect(() => {
    const fetchCounts = async () => {
      setIsLoadingCounts(true);
      try {
        const newCounts = await countManager.current.getArticleCounts(
          selectedFeedId || undefined,
          null // selectedFolderId
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
  }, [selectedFeedId, selectedTagId]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  // Header show/hide on scroll - now using article list container
  useEffect(() => {
    let ticking = false;

    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollContainer = e.target as HTMLElement;
          const currentScrollY = scrollContainer.scrollTop;
          const scrollDelta = currentScrollY - lastScrollY.current;

          if (!headerRef.current) return;

          // Scrolling down - hide header after scrolling 50px down
          if (scrollDelta > 0 && currentScrollY > 50) {
            headerRef.current.style.transform = "translateY(-100%)";
          }
          // Scrolling up - show header immediately (even 1px scroll up)
          else if (scrollDelta < 0) {
            headerRef.current.style.transform = "translateY(0)";
          }
          // At very top - ensure header is visible
          else if (currentScrollY < 5) {
            headerRef.current.style.transform = "translateY(0)";
          }

          // Show/hide scroll to top button on iOS
          if (isIOS) {
            setShowScrollToTop(currentScrollY > 300);
          }

          lastScrollY.current = currentScrollY;
          // Scroll-aware contrast for Liquid Glass
          headerRef.current.classList.toggle("is-scrolled", currentScrollY > 8);
          
          // Enhanced legibility for filter controls when scrolling
          if (filterControlsRef.current) {
            filterControlsRef.current.classList.toggle("glass-enhanced-legibility", currentScrollY > 50);
          }
          
          ticking = false;
        });

        ticking = true;
      }
    };

    const scrollContainer = articleListRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, [isIOS]);

  // Compute sidebar classes for better readability
  const getSidebarClasses = () => {
    // RR-193: Full-width mobile sidebar overlay
    const baseClasses =
      "h-full transition-transform duration-200 ease-in-out w-full md:w-80";
    const positionClasses = viewport.shouldCollapseSidebar
      ? "fixed inset-y-0 left-0 z-[60] transform"
      : "relative";
    const translateClasses =
      viewport.shouldCollapseSidebar && !isSidebarOpen
        ? "-translate-x-full"
        : "translate-x-0";

    return `${positionClasses} ${translateClasses} ${baseClasses}`;
  };

  // Compute header classes
  const getHeaderClasses = () => {
    const baseClasses =
      "glass-nav fixed left-0 right-0 top-0 z-30 border-b transition-transform duration-300 ease-in-out";
    const offsetClasses = !viewport.shouldCollapseSidebar ? "md:left-80" : "";
    return `${baseClasses} ${offsetClasses}`;
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && viewport.shouldCollapseSidebar && (
        <div
          className="fixed inset-0 z-[55] bg-black/50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Feed Sidebar - Independent scroll container */}
      <div className={getSidebarClasses()}>
        <ErrorBoundary
          fallback={
            <div className="h-full border-r bg-muted/10 p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Feed sidebar error
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Data synced successfully
                </p>
              </div>
            </div>
          }
        >
          <SimpleFeedSidebar
            selectedFeedId={selectedFeedId}
            selectedTagId={selectedTagId}
            onFeedSelect={handleFeedSelect}
            onTagSelect={handleTagSelect}
            onClearFilters={handleClearFilters}
            onClose={() => setIsSidebarOpen(false)}
          />
        </ErrorBoundary>
      </div>

      {/* Main Content Area - Independent scroll container */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Floating Hamburger Button - Only on mobile when sidebar is closed */}
        {viewport.shouldCollapseSidebar && (
          <ScrollHideFloatingElement
            position="top-left"
            scrollContainer={articleListRef}
            hideThreshold={50}
            visible={!isSidebarOpen}
          >
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="glass-icon-btn glass-adaptive"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          </ScrollHideFloatingElement>
        )}

        {/* Floating Filter Controls - Show on desktop always, mobile only when sidebar closed */}
        <ScrollHideFloatingElement
          position="top-right"
          scrollContainer={articleListRef}
          hideThreshold={50}
          visible={!viewport.shouldCollapseSidebar || !isSidebarOpen}
        >
          <div ref={filterControlsRef} className="flex items-center gap-2">
            {/* Collapsible Filter Controls */}
            <div className={`${waitingConfirmation ? "collapsed" : ""}`}>
              <ReadStatusFilter />
            </div>

            {/* Mark All Read Button - positioned next to filters */}
            {(selectedFeedId || selectedTagId) && (
              <button
                onClick={handleMarkAllClick}
                disabled={isMarkingAllRead || counts.unread === 0}
                className={`liquid-glass-mark-all-read glass-adaptive state-${getButtonState()}`}
                title={
                  waitingConfirmation
                    ? "Click again to confirm"
                    : selectedTagId
                      ? `Mark all "${tags.get(selectedTagId)?.name || "tag"}" articles as read`
                      : "Mark all articles in this feed as read"
                }
                data-state={getButtonState()}
              >
                {isMarkingAllRead ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {!viewport.shouldShowCompactFilters && (
                      <span className="ml-2">Marking...</span>
                    )}
                  </>
                ) : waitingConfirmation ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="ml-2">Confirm?</span>
                  </>
                ) : (
                  <>
                    <CircleCheckBig className="h-3.5 w-3.5" />
                    {!viewport.shouldShowCompactFilters && (
                      <span className="ml-2">Mark All Read</span>
                    )}
                  </>
                )}
              </button>
            )}
          </div>
        </ScrollHideFloatingElement>

        {/* Article List Container with its own scroll */}
        <div
          ref={articleListRef}
          className="ios-scroll-container scrollbar-hide relative flex-1 overflow-y-auto"
        >
          {/* Scrolling Page Title */}
          <div
            className={`pb-4 transition-all duration-300 ease-out ${
              viewport.shouldCollapseSidebar 
                ? "pt-[80px] px-4 pwa-standalone:pt-[calc(80px+env(safe-area-inset-top))]" // Mobile: +8px extra spacing when hamburger shows
                : "pt-[24px] px-6 pwa-standalone:pt-[calc(24px+env(safe-area-inset-top))]"  // Desktop: title centered with button clusters (48px buttons → 24px title position)
            }`}
          >
            <h1 className="text-2xl font-bold text-foreground transition-all duration-300 ease-out">
              {selectedFeedId
                ? getFeed(selectedFeedId)?.title || "Feed"
                : selectedTagId
                  ? tags.get(selectedTagId)?.name || "Topic"
                  : "Articles"}
            </h1>
          </div>

          <ArticleList
            feedId={selectedFeedId || undefined}
            tagId={selectedTagId || undefined}
            onArticleClick={handleArticleClick}
            scrollContainerRef={articleListRef}
            filtersReady={filtersReady}
          />

          {/* Liquid Glass Scroll to Top button for iOS */}
          {isIOS && showScrollToTop && (
            <button
              onClick={() => {
                if (articleListRef.current) {
                  articleListRef.current.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }
              }}
              className="liquid-glass-btn glass-adaptive"
              aria-label="Scroll to top"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
