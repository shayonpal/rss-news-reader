"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";
import { ArticleList } from "@/components/articles/article-list";
import { ArticleHeader } from "@/components/articles/article-header";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { ErrorBoundary } from "@/components/error-boundary";
import { useHydrationFix } from "@/hooks/use-hydration-fix";
import { useViewport } from "@/hooks/use-viewport";
import { Menu, X, ArrowUp } from "lucide-react";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { setNavigatingToArticle } = useArticleStore();

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Fix iOS detection hydration issue - use state instead of direct check
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  // Auto-manage sidebar state based on viewport
  useEffect(() => {
    if (!viewport.shouldCollapseSidebar) {
      // On tablet/desktop, sidebar should always be open
      setIsSidebarOpen(true);
    } else {
      // On mobile, sidebar starts closed
      setIsSidebarOpen(false);
    }
  }, [viewport.shouldCollapseSidebar]);

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
    const baseClasses =
      "h-full w-[280px] transition-transform duration-200 ease-in-out md:w-80";
    const positionClasses = viewport.shouldCollapseSidebar
      ? "fixed inset-y-0 left-0 z-50 transform"
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
          className="fixed inset-0 z-40 bg-black/50"
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
        {/* Enhanced Header with Database Counts */}
        <div
          ref={headerRef}
          className={getHeaderClasses()}
          style={{ transform: "translateY(0)" }}
        >
          <ArticleHeader
            selectedFeedId={selectedFeedId}
            selectedFolderId={null}
            selectedTagId={selectedTagId}
            isMobile={viewport.shouldShowHamburger}
            onMenuClick={
              viewport.shouldShowHamburger
                ? () => setIsSidebarOpen(!isSidebarOpen)
                : undefined
            }
            menuIcon={
              viewport.shouldShowHamburger ? (
                isSidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )
              ) : undefined
            }
          />
        </div>

        {/* Article List Container with its own scroll */}
        <div
          ref={articleListRef}
          className="ios-scroll-container scrollbar-hide relative flex-1 overflow-y-auto pt-[70px] pwa-standalone:pt-[calc(50px+env(safe-area-inset-top))]"
        >
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
              className="liquid-glass-btn"
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
