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
import { toast } from "sonner";
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
import { ScrollHideFloatingElement } from "@/components/ui/scroll-hide-floating-element";
import { useContentState } from "@/hooks/use-content-state";
import {
  ContentParsingIndicator,
  ContentLoadingSkeleton,
} from "./content-parsing-indicator";
import {
  GlassToolbarButton,
  GlassIconButton,
} from "@/components/ui/glass-button";
import {
  MorphingDropdown,
  type DropdownItem,
} from "@/components/ui/morphing-dropdown";

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
}) {
  // Build toolbar elements (keep original functionality, style inline to match POC)
  const toolbarElements = [
    <StarButton
      key="star"
      onToggleStar={onToggleStar}
      isStarred={isStarred}
      size="lg"
    />,
    <SummaryButton
      key="summary"
      articleId={articleId}
      hasSummary={hasSummary}
      variant="icon"
      size="lg"
      onSuccess={onSummarySuccess}
    />,
    <FetchContentButton
      key="fetch"
      articleId={articleId}
      hasFullContent={!!hasFullContent}
      variant="icon"
      size="lg"
      onSuccess={onFetchSuccess}
      onRevert={onFetchRevert}
    />,
  ];

  // Build dropdown items dynamically
  const dropdownItems: DropdownItem[] = [
    {
      id: "partial-feed",
      label: "Partial Feed",
      checked: feed?.isPartialContent || false,
      onClick: onTogglePartialFeed,
      disabled: isUpdatingFeed, // Note: Should never disable based on feed availability - always allow user to toggle
      separator: true,
    },
    {
      id: "share",
      label: "Share",
      icon: <Share2 className="h-5 w-5" />,
      onClick: onShare,
    },
    ...(articleUrl
      ? [
          {
            id: "open-original",
            label: "Open Original",
            icon: <ExternalLink className="h-5 w-5" />,
            onClick: () =>
              window.open(articleUrl, "_blank", "noopener,noreferrer"),
          },
        ]
      : []),
  ];

  return (
    <MorphingDropdown
      toolbarElements={toolbarElements}
      items={dropdownItems}
      animationMode="sequential"
      easingMode="spring"
    />
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
  const [currentArticle, setCurrentArticle] = useState(article);
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [forceOriginalContent, setForceOriginalContent] = useState(false);
  const { getArticle } = useArticleStore();
  const { updateFeedPartialContent } = useFeedStore();
  const [isUpdatingFeed, setIsUpdatingFeed] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Fix iOS detection hydration issue - use state instead of direct check
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  // Auto-parse content for partial feeds
  const {
    isParsing,
    parseError,
    parsedContent,
    shouldShowRetry,
    triggerParse,
    clearError,
    clearParsedContent,
  } = useAutoParseContent({
    article: currentArticle,
    feed,
    enabled: true, // Always enable auto-parsing
  });

  // Update current article when it changes or summary is updated
  useEffect(() => {
    setCurrentArticle(article);
    // Reset states when article changes
    setFetchedContent(null);
    setForceOriginalContent(false);
  }, [article]);

  // Force button state update when auto-parsing completes
  useEffect(() => {
    // Button should reflect state after auto-parse completes
    // The hasFullContentState will automatically update due to reactive dependency on parsedContent
  }, [parsedContent]);

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
    // Set the manually fetched content and disable force original
    setFetchedContent(content);
    setForceOriginalContent(false);
    // Also refresh from store to ensure consistency
    const updatedArticle = await getArticle(article.id);
    if (updatedArticle) {
      setCurrentArticle(updatedArticle);
    }
  };

  // Handle revert to RSS content
  const handleRevertContent = () => {
    // Clear ALL enhanced content to show original RSS content
    // Clear both manually fetched and auto-parsed content
    setFetchedContent(null);
    if (parsedContent) {
      clearParsedContent();
    }
    // Force showing original RSS content even if fullContent exists in DB
    setForceOriginalContent(true);
  };

  // Use unified content state management
  const { contentSource, displayContent, hasEnhancedContent } = useContentState(
    currentArticle,
    parsedContent,
    fetchedContent,
    forceOriginalContent
  );

  // Use the unified state for button
  const hasFullContentState = hasEnhancedContent;

  // Process links BEFORE sanitization to ensure attributes are preserved
  const processedContent = processArticleLinksSSR(displayContent);

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

  // iOS scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      if (isIOS) {
        setShowScrollToTop(window.scrollY > 300);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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

    const newState = !feed.isPartialContent;
    const feedName = feed.title || "Feed";
    const toastId = `partial-feed-${article.feedId}`;

    // Show loading toast with amber styling
    toast.loading(
      `${newState ? "Marking" : "Unmarking"} ${feedName} as partial feed...`,
      {
        id: toastId,
        style: {
          background: "#f59e0b", // amber-500
          color: "white",
        },
      }
    );

    setIsUpdatingFeed(true);
    try {
      // Toggle the partial content setting
      await updateFeedPartialContent(article.feedId, newState);

      // Show success toast with green styling
      toast.success(
        `${feedName} ${newState ? "marked" : "unmarked"} as partial feed`,
        {
          id: toastId,
          duration: 3000,
          style: {
            background: "#10b981", // green-500
            color: "white",
          },
        }
      );

      // The UI will update automatically when the feed store updates
    } catch (error) {
      console.error("Failed to update feed partial content setting:", error);

      // Show error toast with red styling
      toast.error(`Failed to update ${feedName}. Please try again.`, {
        id: toastId,
        duration: 0, // Manual dismiss for errors
        style: {
          background: "#ef4444", // red-500
          color: "white",
        },
      });
    } finally {
      setIsUpdatingFeed(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white dark:bg-gray-900">
      {/* Unified floating controls using standard component positioning */}
      <ScrollHideFloatingElement position="top-left" hideThreshold={50}>
        <GlassIconButton
          type="button"
          onClick={onBack}
          variant="liquid-glass"
          aria-label="Back to list"
        >
          <ArrowLeft className="h-5 w-5" />
        </GlassIconButton>
      </ScrollHideFloatingElement>

      <ScrollHideFloatingElement position="top-right" hideThreshold={50}>
        <ArticleActionsToolbar
          articleId={currentArticle.id}
          isStarred={currentArticle.tags?.includes("starred") || false}
          hasSummary={!!currentArticle.summary}
          hasFullContent={hasFullContentState}
          onToggleStar={onToggleStar}
          onSummarySuccess={handleSummarySuccess}
          onFetchSuccess={handleFetchContentSuccess}
          onFetchRevert={handleRevertContent}
          feed={feed}
          onTogglePartialFeed={handleToggleFeedPartialContent}
          isUpdatingFeed={isUpdatingFeed}
          onShare={handleShare}
          articleUrl={currentArticle.url}
        />
      </ScrollHideFloatingElement>

      {/* No spacer needed - floating elements don't take layout space */}

      {/* Article Content */}
      <article className="mx-auto max-w-4xl px-4 pb-6 pt-[80px] pwa-standalone:pt-[calc(80px+env(safe-area-inset-top))] sm:px-6 sm:pb-8 lg:px-8">
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
            <time
              dateTime={currentArticle.publishedAt.toISOString()}
              suppressHydrationWarning
            >
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
                    sessionStorage.setItem("articleListTagFilter", tag.id);
                    // Clear any feed filter to ensure tag filter takes precedence
                    sessionStorage.setItem("articleListFilter", "null");
                    router.push("/");
                  }}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}15` : undefined,
                    color: tag.color || undefined,
                    borderColor: tag.color ? `${tag.color}30` : undefined,
                    borderWidth: tag.color ? "1px" : undefined,
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
      </article>

      {/* Navigation Footer */}
      <footer
        ref={() => {
          // Attach a refless scrolled class toggle synced with window scroll
          // This will be updated in the scroll handler below
        }}
        className="glass-footer fixed bottom-0 left-0 right-0 z-10 border-t transition-transform duration-300 ease-in-out"
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
