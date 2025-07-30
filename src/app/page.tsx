"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SimpleFeedSidebar } from "@/components/feeds/simple-feed-sidebar";
import { ArticleList } from "@/components/articles/article-list";
import { ArticleHeader } from "@/components/articles/article-header";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useArticleStore } from "@/lib/stores/article-store";
import { ErrorBoundary } from "@/components/error-boundary";
import { useHydrationFix } from "@/hooks/use-hydration-fix";
import { Menu, X, ArrowUp } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  // Fix hydration issues with localStorage
  useHydrationFix();

  // Header show/hide refs
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize with saved filter to avoid race condition
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const savedFilter = sessionStorage.getItem("articleListFilter");
      return savedFilter === "null" ? null : savedFilter;
    }
    return null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const isIOS =
    typeof window !== "undefined" &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handleArticleClick = (articleId: string) => {
    router.push(`/article/${encodeURIComponent(articleId)}`);
  };

  const handleFeedSelect = (feedId: string | null) => {
    setSelectedFeedId(feedId);
    // Save filter state for restoration
    sessionStorage.setItem("articleListFilter", feedId || "null");
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Header show/hide on scroll - now using article list container
  const articleListRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Feed Sidebar - Independent scroll container */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform md:relative ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} h-full w-[280px] transition-transform duration-200 ease-in-out md:w-80 md:translate-x-0`}
      >
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
            onFeedSelect={handleFeedSelect}
            onClose={() => setIsSidebarOpen(false)}
          />
        </ErrorBoundary>
      </div>

      {/* Main Content Area - Independent scroll container */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Enhanced Header with Database Counts */}
        <div
          ref={headerRef}
          className="fixed left-0 right-0 top-0 z-30 border-b bg-background transition-transform duration-300 ease-in-out md:left-80"
          style={{ transform: "translateY(0)" }}
        >
          <ArticleHeader
            selectedFeedId={selectedFeedId}
            selectedFolderId={null}
            isMobile={true}
            onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
            menuIcon={
              isSidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )
            }
          />
        </div>

        {/* Article List Container with its own scroll */}
        <div
          ref={articleListRef}
          className="ios-scroll-container relative flex-1 overflow-y-auto pt-[73px]"
        >
          <ArticleList
            feedId={selectedFeedId || undefined}
            onArticleClick={handleArticleClick}
            scrollContainerRef={articleListRef}
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
