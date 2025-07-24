'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Article, Feed } from '@/types';
import { IOSButton } from '@/components/ui/ios-button';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, Share2, ExternalLink, ChevronLeft, ChevronRight, MoreVertical, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import DOMPurify from 'isomorphic-dompurify';
import { SummaryButton } from './summary-button';
import { SummaryDisplay } from './summary-display';
import { FetchContentButton } from './fetch-content-button';
import { useArticleStore } from '@/lib/stores/article-store';
import { useFeedStore } from '@/lib/stores/feed-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ArticleDetailProps {
  article: Article;
  feed?: Feed;
  feedTitle: string;
  onToggleStar: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onBack: () => void;
}

export function ArticleDetail({
  article,
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

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

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
      hasFullContent: true
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
      hasFullContent: false
    });
  };

  // Clean and sanitize HTML content - prioritize full content over RSS content
  const contentToDisplay = currentArticle.fullContent || currentArticle.content;
  const cleanContent = DOMPurify.sanitize(contentToDisplay, {
    ALLOWED_TAGS: ['p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                   'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 
                   'strong', 'br', 'figure', 'figcaption', 'iframe', 'video'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 
                   'target', 'rel', 'class', 'id', 'allowfullscreen', 
                   'frameborder'],
    ALLOW_DATA_ATTR: false,
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        onNavigate('next');
      } else if (e.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onBack]);

  // Header show/hide on scroll
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
            headerRef.current.style.transform = 'translateY(-100%)';
          }
          // Scrolling up - show header immediately (even 1px scroll up)
          else if (scrollDelta < 0) {
            headerRef.current.style.transform = 'translateY(0)';
          }
          // At very top - ensure header is visible
          else if (currentScrollY < 5) {
            headerRef.current.style.transform = 'translateY(0)';
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
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
      onNavigate('next');
    } else if (isRightSwipe) {
      onNavigate('prev');
    }
  };

  const handleShare = async () => {
    if (navigator.share && currentArticle.url) {
      try {
        await navigator.share({
          title: currentArticle.title,
          text: currentArticle.summary || '',
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
      className="min-h-screen bg-white dark:bg-gray-900 w-full overflow-x-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header 
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-in-out pwa-safe-area-top"
        style={{ transform: 'translateY(0)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <IOSButton
            variant="ghost"
            size="icon"
            onPress={onBack}
            aria-label="Back to list"
            className="hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </IOSButton>
          
          <div className="flex items-center gap-2">
            <IOSButton
              variant="ghost"
              size="icon"
              onPress={onToggleStar}
              aria-label="Toggle star"
              className={cn(
                "hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700",
                currentArticle.tags?.includes('starred') && "text-yellow-500"
              )}
            >
              <Star className={cn("h-5 w-5", currentArticle.tags?.includes('starred') && "fill-current")} />
            </IOSButton>
            
            <SummaryButton
              articleId={currentArticle.id}
              hasSummary={!!currentArticle.summary}
              variant="icon"
              onSuccess={handleSummarySuccess}
            />
            
            <FetchContentButton
              articleId={currentArticle.id}
              hasFullContent={currentArticle.hasFullContent}
              variant="icon"
              onSuccess={handleFetchContentSuccess}
              onRevert={handleRevertContent}
            />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IOSButton
                  variant="ghost"
                  size="icon"
                  aria-label="More options"
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
                >
                  <MoreVertical className="h-5 w-5" />
                </IOSButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {feed && (
                  <DropdownMenuItem 
                    onSelect={handleToggleFeedPartialContent}
                    disabled={isUpdatingFeed}
                    className="relative"
                  >
                    <span className={cn(
                      "mr-2 text-base transition-opacity duration-200",
                      isUpdatingFeed && "opacity-50"
                    )}>
                      {feed.isPartialContent ? '☑' : '☐'}
                    </span>
                    <span className={cn(
                      "transition-opacity duration-200",
                      isUpdatingFeed && "opacity-50"
                    )}>
                      Partial Feed
                    </span>
                    {isUpdatingFeed && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300"></div>
                      </div>
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
                {currentArticle.url && (
                  <DropdownMenuItem onSelect={() => window.open(currentArticle.url, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Original
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/fetch-stats')}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Fetch Stats
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[60px] pwa-safe-area-top" />

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Metadata */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 leading-tight">
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
              {formatDistanceToNow(currentArticle.publishedAt, { addSuffix: true })}
            </time>
          </div>
        </div>

        {/* AI Summary */}
        {currentArticle.summary && (
          <SummaryDisplay
            summary={currentArticle.summary}
            collapsible={true}
            defaultExpanded={true}
          />
        )}

        {/* Article Body */}
        <div 
          ref={contentRef}
          className="prose prose-base sm:prose-lg dark:prose-invert max-w-none
                     prose-headings:font-bold
                     prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline
                     prose-img:rounded-lg prose-img:shadow-md prose-img:max-w-full prose-img:h-auto
                     prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700
                     prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:rounded prose-code:px-1
                     prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:overflow-x-auto
                     [&>*]:break-words"
          dangerouslySetInnerHTML={{ __html: cleanContent }}
        />
        
        {/* Fetch/Revert Full Content button at bottom */}
        <div className="mt-8 mb-8 flex justify-center">
          <FetchContentButton
            articleId={currentArticle.id}
            hasFullContent={currentArticle.hasFullContent}
            variant="button"
            onSuccess={handleFetchContentSuccess}
            onRevert={handleRevertContent}
          />
        </div>
      </article>

      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <IOSButton
            variant="ghost"
            size="sm"
            onPress={() => onNavigate('prev')}
            aria-label="Previous article"
            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </IOSButton>
          
          <IOSButton
            variant="ghost"
            size="sm"
            onPress={() => onNavigate('next')}
            aria-label="Next article"
            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </IOSButton>
        </div>
      </footer>
      
      {/* Spacer for fixed footer */}
      <div className="h-[60px]" />
    </div>
  );
}