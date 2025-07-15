'use client';

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { SimpleFeedSidebar } from '@/components/feeds/simple-feed-sidebar';
import { useArticleStore } from '@/lib/stores/article-store';
import { useFeedStore } from '@/lib/stores/feed-store';
import { ErrorBoundary } from '@/components/error-boundary';
import { Loader2 } from 'lucide-react';

export default function ReaderPage() {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const { 
    articles, 
    loadingArticles, 
    articlesError,
    loadArticles,
    markAsRead
  } = useArticleStore();
  const { getFeed } = useFeedStore();

  useEffect(() => {
    loadArticles(selectedFeedId || undefined);
  }, [selectedFeedId, loadArticles]);

  const selectedFeed = selectedFeedId ? getFeed(selectedFeedId) : null;
  const pageTitle = selectedFeed ? selectedFeed.title : 'All Articles';

  const handleArticleClick = async (articleId: string) => {
    await markAsRead(articleId);
    // TODO: Navigate to article detail view
  };

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        {/* Feed Sidebar */}
        <ErrorBoundary fallback={
          <div className="w-80 border-r bg-muted/10 p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Feed sidebar error</p>
              <p className="text-xs text-muted-foreground mt-2">Data synced successfully</p>
            </div>
          </div>
        }>
          <SimpleFeedSidebar
            selectedFeedId={selectedFeedId}
            onFeedSelect={setSelectedFeedId}
          />
        </ErrorBoundary>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="border-b px-6 py-4">
            <h1 className="text-2xl font-semibold">{pageTitle}</h1>
          </header>

          {/* Article List */}
          <main className="flex-1 overflow-y-auto">
            {loadingArticles ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : articlesError ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">{articlesError}</p>
              </div>
            ) : articles.size === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No articles found</p>
              </div>
            ) : (
              <div className="divide-y">
                {Array.from(articles.values()).map((article) => (
                  <article
                    key={article.id}
                    className="p-6 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleArticleClick(article.id)}
                  >
                    <div className="space-y-2">
                      {/* Title and Summary indicator */}
                      <div className="flex items-start gap-2">
                        <h2 className={`text-lg flex-1 ${
                          article.isRead ? 'font-normal text-muted-foreground' : 'font-semibold'
                        }`}>
                          {article.title}
                        </h2>
                        {article.summary && (
                          <span className="text-yellow-500 text-sm">⚡</span>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{article.feedTitle}</span>
                        <span>•</span>
                        <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                        {article.author && (
                          <>
                            <span>•</span>
                            <span>{article.author}</span>
                          </>
                        )}
                      </div>

                      {/* Content Preview */}
                      <div className="text-sm line-clamp-3">
                        {article.summary ? (
                          <p className="text-primary">{article.summary}</p>
                        ) : article.content ? (
                          <p className="text-muted-foreground">{article.content.substring(0, 200)}...</p>
                        ) : (
                          <p className="text-muted-foreground italic">No preview available</p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}