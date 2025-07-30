import React, { useState, useEffect } from "react";
import { Star, Sparkles, RefreshCw } from "lucide-react";

interface Article {
  id: number;
  title: string;
  excerpt: string;
  source: string;
  publishedAt: string;
  category: string;
  url?: string;
  is_read?: boolean;
  ai_summary?: string;
  is_summarized?: boolean;
  is_bookmarked?: boolean;
  isNew?: boolean; // Flag for new articles
}

interface ArticleCardProps {
  article: Article;
  onMarkAsRead?: (articleId: number) => void;
  onSummarize?: (articleId: number) => void;
  onToggleBookmark?: (articleId: number) => void;
  isSummarizing?: boolean;
  index?: number; // For staggered animations
}

export function ArticleCard({
  article,
  onMarkAsRead,
  onSummarize,
  onToggleBookmark,
  isSummarizing = false,
  index = 0,
}: ArticleCardProps) {
  const [isVisible, setIsVisible] = useState(!article.isNew);
  const [showNewBadge, setShowNewBadge] = useState(article.isNew);

  useEffect(() => {
    if (article.isNew) {
      // Staggered entrance animation
      const delay = index * 100;
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);

      // Hide "new" badge after animation
      const badgeTimer = setTimeout(() => {
        setShowNewBadge(false);
      }, 2000 + delay);

      return () => {
        clearTimeout(timer);
        clearTimeout(badgeTimer);
      };
    }
  }, [article.isNew, index]);

  const getCategoryColor = (category: string) => {
    const colors = {
      Technology:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Science:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Design:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Space:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Fashion:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Health:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Environment:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Business:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Food: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      News: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Politics:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Sports:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
      Entertainment:
        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15",
    };
    return (
      colors[category as keyof typeof colors] ||
      "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15"
    );
  };

  const handleCardClick = () => {
    if (!article.is_read && onMarkAsRead) {
      onMarkAsRead(article.id);
    }
  };

  const handleSummarizeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSummarize && !article.is_summarized && !isSummarizing) {
      onSummarize(article.id);
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleBookmark) {
      onToggleBookmark(article.id);
    }
  };

  const isRead = article.is_read;
  // Show AI summary if available, otherwise show original excerpt
  const displayContent = article.ai_summary || article.excerpt;

  return (
    <article
      className={`group cursor-pointer transition-all duration-500 ease-out ${
        isVisible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-8 scale-95 opacity-0"
      }`}
      onClick={handleCardClick}
    >
      <div
        className={`relative transform overflow-hidden rounded-2xl border backdrop-blur-2xl transition-all duration-500 hover:scale-[1.005] active:scale-[0.995] ${
          isRead
            ? "border-white/20 bg-white/25 opacity-70 shadow-md shadow-black/5 hover:bg-white/35 dark:border-slate-600/20 dark:bg-slate-800/25 dark:shadow-black/15 dark:hover:bg-slate-800/35"
            : "border-white/35 bg-white/50 shadow-lg shadow-black/10 hover:bg-white/65 dark:border-slate-600/35 dark:bg-slate-800/50 dark:shadow-black/25 dark:hover:bg-slate-800/65"
        }`}
      >
        {/* Glass background layers */}
        <div
          className={`absolute inset-0 ${
            isRead
              ? "from-white/8 to-white/4 dark:from-slate-700/8 dark:to-slate-800/4 bg-gradient-to-br via-transparent dark:via-transparent"
              : "to-white/8 dark:to-slate-800/8 bg-gradient-to-br from-white/15 via-transparent dark:from-slate-700/15 dark:via-transparent"
          }`}
        />

        {/* New article badge */}
        {showNewBadge && article.isNew && (
          <div className="absolute right-2 top-2 z-10">
            <div className="animate-bounce rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-2 py-1 text-xs font-medium text-white shadow-lg">
              New
            </div>
          </div>
        )}

        {/* Entrance animation glow for new articles */}
        {article.isNew && isVisible && (
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 opacity-50" />
        )}

        <div className="relative p-3">
          {/* Header: Category and Action Icons */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className={`rounded-lg border px-2 py-1 text-xs font-medium backdrop-blur-xl ${getCategoryColor(article.category)}`}
            >
              {article.category}
            </span>

            {/* Action Icons Container */}
            <div className="flex items-center gap-2">
              {/* Sparkles AI Summarize Button */}
              <button
                onClick={handleSummarizeClick}
                disabled={article.is_summarized || isSummarizing}
                className={`rounded-lg p-1.5 transition-all duration-200 ${
                  article.is_summarized
                    ? "cursor-default text-purple-600 dark:text-purple-400"
                    : isSummarizing
                      ? "cursor-wait text-blue-600 dark:text-blue-400"
                      : "text-slate-500 hover:scale-110 hover:text-purple-600 active:scale-95 dark:text-slate-400 dark:hover:text-purple-400"
                }`}
                title={
                  article.is_summarized
                    ? "Already summarized"
                    : "Summarize with AI"
                }
              >
                {isSummarizing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles
                    className="h-4 w-4"
                    fill={article.is_summarized ? "currentColor" : "none"}
                  />
                )}
              </button>

              {/* Star Bookmark Button */}
              <button
                onClick={handleBookmarkClick}
                className={`rounded-lg p-1.5 transition-all duration-200 ${
                  article.is_bookmarked
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-slate-500 hover:text-yellow-600 dark:text-slate-400 dark:hover:text-yellow-400"
                } hover:scale-110 active:scale-95`}
                title={
                  article.is_bookmarked ? "Remove bookmark" : "Add bookmark"
                }
              >
                <Star
                  className="h-4 w-4"
                  fill={article.is_bookmarked ? "currentColor" : "none"}
                />
              </button>
            </div>
          </div>

          {/* Title */}
          <h2
            className={`mb-2 line-clamp-2 text-base font-semibold leading-tight transition-colors duration-300 ${
              isRead
                ? "text-slate-600 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300"
                : "text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400"
            }`}
          >
            {article.title}
          </h2>

          {/* Content: AI Summary or Original Excerpt */}
          <div className="mb-3">
            <p
              className={`line-clamp-4 text-sm leading-relaxed ${
                isRead
                  ? "text-slate-500 dark:text-slate-500"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {displayContent}
            </p>
          </div>

          {/* Footer: Source and Timestamp */}
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-medium ${
                isRead
                  ? "text-slate-500 dark:text-slate-500"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {article.source}
            </span>

            {/* Timestamp in bottom right */}
            <span
              className={`text-xs font-medium ${
                isRead
                  ? "text-slate-500 dark:text-slate-500"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {article.publishedAt}
            </span>
          </div>
        </div>

        {/* Enhanced hover overlay for unread articles */}
        {!isRead && (
          <div className="from-blue-500/3 via-purple-500/3 to-blue-500/3 pointer-events-none absolute inset-0 bg-gradient-to-r opacity-0 transition-all duration-500 group-hover:opacity-100" />
        )}
      </div>
    </article>
  );
}
