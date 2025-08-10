"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Article, Feed } from "@/types";
import { IOSButton } from "@/components/ui/ios-button";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Share2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  BarChart3,
  ArrowUp,
  Tag,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { decodeHtmlEntities } from "@/lib/utils/html-decoder";
import DOMPurify from "isomorphic-dompurify";
import { SummaryButton } from "./summary-button";
import { StarButton } from "./star-button";
import { processArticleLinksSSR } from "@/lib/utils/link-processor";
import { SummaryDisplay } from "./summary-display";
import { FetchContentButton } from "./fetch-content-button";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useAutoParseContent } from "@/hooks/use-auto-parse-content";
import { ContentParsingIndicator, ContentLoadingSkeleton } from "./content-parsing-indicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Reusable toolbar (can be moved to its own file if you prefer)
function ArticleActionsToolbar({
  articleId,
  isStarred,
  hasSummary,
  hasFullContent,
  onToggleStar,
  onSummarySuccess,
  onFetchSuccess,
  onFetchRevert,
  feed,
  onTogglePartialFeed,
  isUpdatingFeed,
  onShare,
  articleUrl,
  onOpenFetchStats,
}: {
  articleId: string;
  isStarred: boolean;
  hasSummary: boolean;
  hasFullContent?: boolean;
  onToggleStar: () => void;
  onSummarySuccess: () => void;
  onFetchSuccess: (content: string) => void;
  onFetchRevert: () => void;
  feed?: Feed;
  onTogglePartialFeed: () => void;
  isUpdatingFeed: boolean;
  onShare: () => void;
  articleUrl?: string;
  onOpenFetchStats: () => void;
}) {
  return (
    <div className="glass-toolbar pointer-events-auto">
      <div className="toolbar-group">
        <StarButton onToggleStar={onToggleStar} isStarred={isStarred} size="md" />
        <SummaryButton
          articleId={articleId}
          hasSummary={hasSummary}
          variant="icon"
          size="md"
          onSuccess={onSummarySuccess}
        />
        <FetchContentButton
          articleId={articleId}
          hasFullContent={!!hasFullContent}
          variant="icon"
          size="md"
          onSuccess={onFetchSuccess}
          onRevert={onFetchRevert}
        />
      </div>
      <DropdownMenu onOpenChange={(open) => {
        const root = document.querySelector('.glass-toolbar');
        if (root) root.classList.toggle('menu-open', open);
      }}>
        <DropdownMenuTrigger asChild>
          <button className="glass-toolbar-btn" aria-label="More options">
            <Ellipsis className="h-5 w-5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 glass-popover p-2">
          {feed && (
            <DropdownMenuItem onSelect={onTogglePartialFeed} className="relative">
              <span
                className={cn(
                  "mr-2 text-base transition-opacity duration-200",
                  isUpdatingFeed && "opacity-50"
                )}
              >
                {feed.isPartialContent ? "☑" : "☐"}
              </span>
              <span
                className={cn(
                  "transition-opacity duration-200",
                  isUpdatingFeed && "opacity-50"
                )}
              >
                Partial Feed
              </span>
            </DropdownMenuItem>
          )}
          <div className="menu-separator my-1" />
          <DropdownMenuItem onSelect={onShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </DropdownMenuItem>
          {articleUrl && (
            <DropdownMenuItem
              onSelect={() => window.open(articleUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Original
            </DropdownMenuItem>
          )}
          <div className="menu-separator my-1" />
          <DropdownMenuItem onSelect={onOpenFetchStats}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Fetch Stats
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ArticleDetailProps {
  article: Article;
  articleTags?: any[];
  feed?: Feed;
  feedTitle: string;
  onToggleStar: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  onBack: () => void;
}

export function ArticleDetail({
  article,
  articleTags = [],
  feed,
  feedTitle,
  onToggleStar,
  onNavigate,
  onBack,
}: ArticleDetailProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [currentArticle, setCurrentArticle] = useState(article);
  const { getArticle } = useArticleStore();
  const { updateFeedPartialContent } = useFeedStore();
  const [isUpdatingFeed, setIsUpdatingFeed] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const isIOS =
    typeof window !== "undefined" &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Auto-parse content for partial feeds
  const {
    isParsing,
    parseError,
    parsedContent,
    shouldShowRetry,
    triggerParse,
    clearError,
  } = useAutoParseContent({
    article: currentArticle,
    feed,
    enabled: true, // Always enable auto-parsing
  });

  // Update current article when it changes or summary is updated
  useEffect(() => {
    setCurrentArticle(article);
  }, [article]);

  // Handle summary success
  const handleSummarySuccess = async () => {
    // Refresh the article to get the updated summary
    const updatedArticle = await getArticle(article.id);
    if (updatedArticle) {
      setCurrentArticle(updatedArticle);
    }
  };

  // Handle fetch content success
  const handleFetchContentSuccess = async (content: string) => {
    // Update the current article with the full content
    setCurrentArticle({
      ...currentArticle,
      fullContent: content,
      hasFullContent: true,
    });
    // Also refresh from store to ensure consistency
    const updatedArticle = await getArticle(article.id);
    if (updatedArticle) {
      setCurrentArticle(updatedArticle);
    }
  };

  // Handle revert to RSS content
  const handleRevertContent = () => {
    // Clear full content to show RSS content
    setCurrentArticle({
      ...currentArticle,
      fullContent: undefined,
      hasFullContent: false,
    });
  };

  // Clean and sanitize HTML content - prioritize parsed content, then full content, then RSS content
  const contentToDisplay = parsedContent || currentArticle.fullContent || currentArticle.content;

  // Process links BEFORE sanitization to ensure attributes are preserved
  const processedContent = processArticleLinksSSR(contentToDisplay);

  const cleanContent = DOMPurify.sanitize(processedContent, {
    ALLOWED_TAGS: [
      "p",
      "a",
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "em",
      "strong",
      "br",
      "figure",
      "figcaption",
      "iframe",
      "video",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "width",
      "height",
      "target",
      "rel",
      "class",
      "id",
      "allowfullscreen",
      "frameborder",
    ],
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ["a"], // Ensure anchor tags are allowed
    ADD_ATTR: ["target", "rel"], // Ensure these attributes are allowed
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        onNavigate("prev");
      } else if (e.key === "ArrowRight") {
        onNavigate("next");
      } else if (e.key === "Escape") {
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate, onBack]);

  // Header/toolbar show/hide on scroll
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
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

          // Footer slide + scroll-aware contrast
          const footer = document.getElementById("article-footer");
          if (footer) {
            if (scrollDelta > 0 && currentScrollY > 50) {
              footer.style.transform = "translateY(100%)";
            } else if (scrollDelta < 0) {
              footer.style.transform = "translateY(0)";
            } else if (currentScrollY < 5) {
              footer.style.transform = "translateY(0)";
            }
            footer.classList.toggle("is-scrolled", currentScrollY > 8);
          }
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isIOS]);

  // Hide viewport scrollbar while on detail view (apply to html and body)
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      const body = document.body;
      root.classList.add("scrollbar-hide");
      body.classList.add("scrollbar-hide");
      return () => {
        root.classList.remove("scrollbar-hide");
        body.classList.remove("scrollbar-hide");
      };
    }
  }, []);

  // Touch handlers for swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onNavigate("next");
    } else if (isRightSwipe) {
      onNavigate("prev");
    }
  };

  const handleShare = async () => {
    if (navigator.share && currentArticle.url) {
      try {
        await navigator.share({
          title: currentArticle.title,
          text: currentArticle.summary || "",
          url: currentArticle.url,
        });
      } catch (error) {
        // User cancelled or share failed
      }
    } else if (currentArticle.url) {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(currentArticle.url);
        // Could add a toast notification here
      } catch (error) {
        // Failed to copy link
      }
    }
  };

  const handleToggleFeedPartialContent = async () => {
    if (!feed || !article.feedId) return;

    setIsUpdatingFeed(true);
    try {
      // Toggle the partial content setting
      await updateFeedPartialContent(article.feedId, !feed.isPartialContent);
      // The UI will update automatically when the feed store updates
    } catch (error) {
      // Could show a toast notification here for error feedback
    } finally {
      setIsUpdatingFeed(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-white dark:bg-gray-900"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      {/* Floating controls container (no top pane) */}
      <div
        ref={headerRef}
        className="fixed left-0 right-0 z-10 transition-transform duration-300 ease-in-out article-header-controls"
        style={{ transform: "translateY(0)", top: "24px" }}
      >
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 flex items-start justify-between">
          {/* Back button aligned with content */}
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to list"
              className="glass-icon-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Actions toolbar constrained to article width */}
          <ArticleActionsToolbar
            articleId={currentArticle.id}
            isStarred={currentArticle.tags?.includes("starred") || false}
            hasSummary={!!currentArticle.summary}
            hasFullContent={currentArticle.hasFullContent}
            onToggleStar={onToggleStar}
            onSummarySuccess={handleSummarySuccess}
            onFetchSuccess={handleFetchContentSuccess}
            onFetchRevert={handleRevertContent}
            feed={feed}
            onTogglePartialFeed={handleToggleFeedPartialContent}
            isUpdatingFeed={isUpdatingFeed}
            onShare={handleShare}
            articleUrl={currentArticle.url}
          onOpenFetchStats={() => router.push("/fetch-stats")}
          />
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[60px] pwa-standalone:h-[calc(60px+env(safe-area-inset-top))]" />

      {/* Article Content */}
      <article className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Metadata */}
        <div className="mb-6 sm:mb-8">
          <h1 className="mb-3 text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 sm:mb-4 sm:text-3xl md:text-4xl">
            {currentArticle.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{feedTitle}</span>
            <span>•</span>
            {currentArticle.author && (
              <>
                <span>{currentArticle.author}</span>
                <span>•</span>
              </>
            )}
            <time dateTime={currentArticle.publishedAt.toISOString()}>
              {formatDistanceToNow(currentArticle.publishedAt, {
                addSuffix: true,
              })}
            </time>
          </div>
          
          {/* Tags */}
          {articleTags && articleTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              {articleTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    // Set tag filter in session storage and navigate to home
                    sessionStorage.setItem('articleListTagFilter', tag.id);
                    // Clear any feed filter to ensure tag filter takes precedence
                    sessionStorage.setItem('articleListFilter', 'null');
                    router.push('/');
                  }}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}15` : undefined,
                    color: tag.color || undefined,
                    borderColor: tag.color ? `${tag.color}30` : undefined,
                    borderWidth: tag.color ? '1px' : undefined,
                  }}
                >
                  {decodeHtmlEntities(tag.name)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Summary */}
        {currentArticle.summary && (
          <SummaryDisplay
            summary={currentArticle.summary}
            collapsible={true}
            defaultExpanded={true}
          />
        )}

        {/* Parsing Indicator */}
        {(isParsing || parseError) && !parsedContent && (
          <ContentParsingIndicator
            isParsing={isParsing}
            error={parseError}
            onRetry={triggerParse}
            showRetry={shouldShowRetry}
            className="mb-6"
          />
        )}

        {/* Article Body */}
        {isParsing && !parsedContent ? (
          <ContentLoadingSkeleton className="mt-6" />
        ) : (
          <div
            ref={contentRef}
            className="prose prose-base max-w-none dark:prose-invert sm:prose-lg prose-headings:font-bold prose-a:text-blue-600 prose-a:underline prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-pre:overflow-x-auto prose-pre:bg-gray-100 prose-img:h-auto prose-img:max-w-full prose-img:rounded-lg prose-img:shadow-md dark:prose-a:text-blue-400 dark:prose-blockquote:border-gray-700 dark:prose-code:bg-gray-800 dark:prose-pre:bg-gray-800 [&>*]:break-words"
            style={{ touchAction: "manipulation" }}
            dangerouslySetInnerHTML={{ __html: cleanContent }}
          />
        )}

        {/* Fetch/Revert Full Content button at bottom - only show if not auto-parsing */}
        {!isParsing && (
          <div className="mb-8 mt-8 flex justify-center">
            <FetchContentButton
              articleId={currentArticle.id}
              hasFullContent={currentArticle.hasFullContent || !!parsedContent}
              variant="button"
              onSuccess={handleFetchContentSuccess}
              onRevert={handleRevertContent}
            />
          </div>
        )}
      </article>

      {/* Navigation Footer */}
      <footer
        ref={(el) => {
          // Attach a refless scrolled class toggle synced with window scroll
          // This will be updated in the scroll handler below
        }}
        className="fixed bottom-0 left-0 right-0 z-10 border-t glass-footer transition-transform duration-300 ease-in-out"
        style={{ transform: "translateY(0)" }}
        id="article-footer"
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <IOSButton
            variant="ghost"
            size="sm"
            onPress={() => onNavigate("prev")}
            aria-label="Previous article"
            className="flex items-center gap-2 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </IOSButton>

          <IOSButton
            variant="ghost"
            size="sm"
            onPress={() => onNavigate("next")}
            aria-label="Next article"
            className="flex items-center gap-2 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </IOSButton>
        </div>
      </footer>

      {/* Spacer for fixed footer */}
      <div className="h-[60px] pwa-standalone:h-[calc(60px+env(safe-area-inset-bottom))]" />

      {/* Liquid Glass Scroll to Top button for iOS */}
      {isIOS && showScrollToTop && (
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="liquid-glass-btn"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
