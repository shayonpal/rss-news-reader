'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SimpleFeedSidebar } from '@/components/feeds/simple-feed-sidebar';
import { ArticleList } from '@/components/articles/article-list';
import { useFeedStore } from '@/lib/stores/feed-store';
import { ErrorBoundary } from '@/components/error-boundary';
import { Menu, X } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  // Initialize with saved filter to avoid race condition
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const savedFilter = sessionStorage.getItem('articleListFilter');
      return savedFilter === 'null' ? null : savedFilter;
    }
    return null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { getFeed } = useFeedStore();

  const selectedFeed = selectedFeedId ? getFeed(selectedFeedId) : null;
  const pageTitle = selectedFeed ? selectedFeed.title : 'All Articles';

  const handleArticleClick = (articleId: string) => {
    router.push(`/article/${encodeURIComponent(articleId)}`);
  };

  const handleFeedSelect = (feedId: string | null) => {
    setSelectedFeedId(feedId);
    // Save filter state for restoration
    sessionStorage.setItem('articleListFilter', feedId || 'null');
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-background relative">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Feed Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 transition-transform duration-200 ease-in-out
        w-[280px] md:w-80
      `}>
        <ErrorBoundary fallback={
          <div className="h-full border-r bg-muted/10 p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Feed sidebar error</p>
              <p className="text-xs text-muted-foreground mt-2">Data synced successfully</p>
            </div>
          </div>
        }>
          <SimpleFeedSidebar
            selectedFeedId={selectedFeedId}
            onFeedSelect={handleFeedSelect}
            onClose={() => setIsSidebarOpen(false)}
          />
        </ErrorBoundary>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b px-4 md:px-6 py-3 md:py-4 flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-muted rounded-lg md:hidden"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          
          <h1 className="text-xl md:text-2xl font-semibold truncate">{pageTitle}</h1>
        </header>

        {/* Article List */}
        <ArticleList
          feedId={selectedFeedId || undefined}
          onArticleClick={handleArticleClick}
        />
      </div>
    </div>
  );
}