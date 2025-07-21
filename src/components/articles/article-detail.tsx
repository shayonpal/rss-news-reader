'use client';

import { useEffect, useRef, useState } from 'react';
import type { Article } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, Share2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import DOMPurify from 'isomorphic-dompurify';
import { SummaryButton } from './summary-button';
import { SummaryDisplay } from './summary-display';
import { useArticleStore } from '@/lib/stores/article-store';

interface ArticleDetailProps {
  article: Article;
  feedTitle: string;
  onToggleStar: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onBack: () => void;
}

export function ArticleDetail({
  article,
  feedTitle,
  onToggleStar,
  onNavigate,
  onBack,
}: ArticleDetailProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [currentArticle, setCurrentArticle] = useState(article);
  const { getArticle } = useArticleStore();

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

  // Clean and sanitize HTML content
  const cleanContent = DOMPurify.sanitize(currentArticle.content, {
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
        console.log('Share failed:', error);
      }
    } else if (article.url) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(article.url);
    }
  };

  return (
    <div 
      className="min-h-screen bg-white dark:bg-gray-900"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleStar}
              className={cn(
                "hover:bg-gray-100 dark:hover:bg-gray-800",
                currentArticle.tags?.includes('starred') && "text-yellow-500"
              )}
            >
              <Star className={cn("h-5 w-5", currentArticle.tags?.includes('starred') && "fill-current")} />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            
            {currentArticle.url && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(currentArticle.url, '_blank')}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ExternalLink className="h-5 w-5" />
              </Button>
            )}
            
            <SummaryButton
              articleId={currentArticle.id}
              hasSummary={!!currentArticle.summary}
              variant="icon"
              onSuccess={handleSummarySuccess}
            />
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Metadata */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
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
          className="prose prose-lg dark:prose-invert max-w-none
                     prose-headings:font-bold
                     prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline
                     prose-img:rounded-lg prose-img:shadow-md
                     prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700
                     prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:rounded prose-code:px-1
                     prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800"
          dangerouslySetInnerHTML={{ __html: cleanContent }}
        />
      </article>

      {/* Navigation Footer */}
      <footer className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('prev')}
            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('next')}
            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}