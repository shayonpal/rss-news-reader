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
    if (
      onSummarize &&
      !article.is_summarized &&
      !isSummarizing
    ) {
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
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-8 scale-95'
      }`}
      onClick={handleCardClick}
    >
      <div
        className={`relative backdrop-blur-2xl transition-all duration-500 rounded-2xl border overflow-hidden transform hover:scale-[1.005] active:scale-[0.995] ${
          isRead
            ? "bg-white/25 dark:bg-slate-800/25 hover:bg-white/35 dark:hover:bg-slate-800/35 border-white/20 dark:border-slate-600/20 shadow-md shadow-black/5 dark:shadow-black/15 opacity-70"
            : "bg-white/50 dark:bg-slate-800/50 hover:bg-white/65 dark:hover:bg-slate-800/65 border-white/35 dark:border-slate-600/35 shadow-lg shadow-black/10 dark:shadow-black/25"
        }`}
      >
        {/* Glass background layers */}
        <div
          className={`absolute inset-0 ${
            isRead
              ? "bg-gradient-to-br from-white/8 via-transparent to-white/4 dark:from-slate-700/8 dark:via-transparent dark:to-slate-800/4"
              : "bg-gradient-to-br from-white/15 via-transparent to-white/8 dark:from-slate-700/15 dark:via-transparent dark:to-slate-800/8"
          }`}
        />

        {/* New article badge */}
        {showNewBadge && article.isNew && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2 py-1 rounded-full shadow-lg animate-bounce font-medium">
              New
            </div>
          </div>
        )}

        {/* Entrance animation glow for new articles */}
        {article.isNew && isVisible && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 animate-pulse opacity-50 pointer-events-none" />
        )}

        <div className="relative p-3">
          {/* Header: Category and Action Icons */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`px-2 py-1 rounded-lg text-xs backdrop-blur-xl border font-medium ${getCategoryColor(article.category)}`}
            >
              {article.category}
            </span>

            {/* Action Icons Container */}
            <div className="flex items-center gap-2">
              {/* Sparkles AI Summarize Button */}
              <button
                onClick={handleSummarizeClick}
                disabled={
                  article.is_summarized || isSummarizing
                }
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  article.is_summarized
                    ? "text-purple-600 dark:text-purple-400 cursor-default"
                    : isSummarizing
                      ? "text-blue-600 dark:text-blue-400 cursor-wait"
                      : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:scale-110 active:scale-95"
                }`}
                title={
                  article.is_summarized
                    ? "Already summarized"
                    : "Summarize with AI"
                }
              >
                {isSummarizing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles
                    className="w-4 h-4"
                    fill={
                      article.is_summarized
                        ? "currentColor"
                        : "none"
                    }
                  />
                )}
              </button>

              {/* Star Bookmark Button */}
              <button
                onClick={handleBookmarkClick}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  article.is_bookmarked
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-400"
                } hover:scale-110 active:scale-95`}
                title={
                  article.is_bookmarked
                    ? "Remove bookmark"
                    : "Add bookmark"
                }
              >
                <Star
                  className="w-4 h-4"
                  fill={
                    article.is_bookmarked
                      ? "currentColor"
                      : "none"
                  }
                />
              </button>
            </div>
          </div>

          {/* Title */}
          <h2
            className={`text-base font-semibold mb-2 transition-colors duration-300 line-clamp-2 leading-tight ${
              isRead
                ? "text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                : "text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400"
            }`}
          >
            {article.title}
          </h2>

          {/* Content: AI Summary or Original Excerpt */}
          <div className="mb-3">
            <p
              className={`text-sm leading-relaxed line-clamp-4 ${
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
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/3 via-purple-500/3 to-blue-500/3 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none" />
        )}
      </div>
    </article>
  );
}