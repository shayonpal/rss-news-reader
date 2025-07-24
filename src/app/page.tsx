'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SimpleFeedSidebar } from '@/components/feeds/simple-feed-sidebar';
import { ArticleList } from '@/components/articles/article-list';
import { ArticleHeader } from '@/components/articles/article-header';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useArticleStore } from '@/lib/stores/article-store';
import { ErrorBoundary } from '@/components/error-boundary';
import { useHydrationFix } from '@/hooks/use-hydration-fix';
import { Menu, X } from 'lucide-react';

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
    if (typeof window !== 'undefined') {
      const savedFilter = sessionStorage.getItem('articleListFilter');
      return savedFilter === 'null' ? null : savedFilter;
    }
    return null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  return (
    <div className="flex min-h-screen bg-background relative w-full overflow-x-hidden">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Feed Sidebar */}
      <div className={`
        fixed md:sticky md:top-0 inset-y-0 md:inset-y-auto left-0 z-50
        transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 transition-transform duration-200 ease-in-out
        w-[280px] md:w-80 md:h-screen md:overflow-y-auto
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Enhanced Header with Database Counts */}
        <div 
          ref={headerRef}
          className="fixed top-0 left-0 right-0 md:left-80 z-30 bg-background border-b transition-transform duration-300 ease-in-out"
          style={{ transform: 'translateY(0)' }}
        >
          <ArticleHeader
            selectedFeedId={selectedFeedId}
            selectedFolderId={null}
            isMobile={true}
            onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
            menuIcon={isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          />
        </div>
        
        {/* Spacer for fixed header */}
        <div className="h-[73px] pwa-safe-area-top" />

        {/* Article List */}
        <ArticleList
          feedId={selectedFeedId || undefined}
          onArticleClick={handleArticleClick}
        />
      </div>
    </div>
  );
}