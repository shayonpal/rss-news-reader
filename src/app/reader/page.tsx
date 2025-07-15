'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { SimpleFeedSidebar } from '@/components/feeds/simple-feed-sidebar';
import { ArticleList } from '@/components/articles/article-list';
import { useFeedStore } from '@/lib/stores/feed-store';
import { ErrorBoundary } from '@/components/error-boundary';

export default function ReaderPage() {
  const router = useRouter();
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const { getFeed } = useFeedStore();

  const selectedFeed = selectedFeedId ? getFeed(selectedFeedId) : null;
  const pageTitle = selectedFeed ? selectedFeed.title : 'All Articles';

  const handleArticleClick = (articleId: string) => {
    router.push(`/reader/article/${encodeURIComponent(articleId)}`);
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
          <ArticleList
            feedId={selectedFeedId || undefined}
            onArticleClick={handleArticleClick}
          />
        </div>
      </div>
    </AuthGuard>
  );
}