import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ArticleList } from './components/ArticleList';
import { FeedsList } from './components/FeedsList';
import { Stats } from './components/Stats';
import { Settings } from './components/Settings';
import { BottomNavigation } from './components/BottomNavigation';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { ToastProvider } from './components/Toast';
import { FilterState } from './components/FilterDropdown';
import { useScrollDirection } from './hooks/useScrollDirection';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  isDark: boolean;
  themeMode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('articles');
  
  // Article filter state - default to unread from all sources
  const [articleFilter, setArticleFilter] = useState<FilterState>({
    readStatus: 'unread',
    sourceType: 'all',
    sourceId: null,
    sourceTitle: ''
  });
  
  const articleListRef = useRef<{ fetchArticles: () => Promise<void> }>();
  
  // Scroll detection for auto-hiding navigation
  const { scrollDirection, isAtTop, scrollY } = useScrollDirection();
  const shouldShowNavigation = isAtTop || scrollDirection === 'up';
  const shouldShowScrollToTop = scrollY > 400;

  // Helper function to apply theme
  const applyTheme = (mode: ThemeMode, systemDark?: boolean) => {
    let shouldBeDark = false;
    
    if (mode === 'system') {
      shouldBeDark = systemDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      shouldBeDark = mode === 'dark';
    }
    
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme-preference') as ThemeMode) || 'system';
    setThemeMode(savedTheme);
    applyTheme(savedTheme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (savedTheme === 'system') {
        applyTheme('system', e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    // Cycle through: light → dark → system
    let nextMode: ThemeMode;
    if (themeMode === 'light') {
      nextMode = 'dark';
    } else if (themeMode === 'dark') {
      nextMode = 'system';
    } else {
      nextMode = 'light';
    }
    
    setThemeMode(nextMode);
    applyTheme(nextMode);
    localStorage.setItem('theme-preference', nextMode);
  };

  const handleSync = async () => {
    if (articleListRef.current && !isSyncing) {
      setIsSyncing(true);
      try {
        await articleListRef.current.fetchArticles();
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFolderSelect = (folderId: number, folderTitle: string) => {
    // Navigate to articles tab with folder filter, preserving read status
    setArticleFilter(prev => ({
      ...prev,
      sourceType: 'folder',
      sourceId: folderId,
      sourceTitle: folderTitle
    }));
    setActiveTab('articles');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFeedSelect = (feedId: number, feedTitle: string) => {
    // Navigate to articles tab with feed filter, preserving read status
    setArticleFilter(prev => ({
      ...prev,
      sourceType: 'feed',
      sourceId: feedId,
      sourceTitle: feedTitle
    }));
    setActiveTab('articles');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (newFilter: FilterState) => {
    setArticleFilter(newFilter);
  };

  const getHeaderTitle = () => {
    if (activeTab === 'feeds') {
      return 'RSS Feeds';
    }
    
    if (activeTab === 'articles') {
      // Dynamic title based on current filter
      if (articleFilter.sourceType !== 'all') {
        return articleFilter.sourceTitle;
      }
      if (articleFilter.readStatus === 'unread') return 'Unread';
      if (articleFilter.readStatus === 'read') return 'Read';
      return 'All Articles';
    }

    if (activeTab === 'stats') {
      return 'Stats';
    }

    if (activeTab === 'settings') {
      return 'Settings';
    }

    return 'Articles';
  };

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, toggleTheme }}>
      <ToastProvider>
        <div className={`min-h-screen transition-all duration-700 ${
          isDark 
            ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
            : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
        }`}>
          {/* Enhanced liquid glass background with motion */}
          <div className="fixed inset-0 pointer-events-none">
            {/* Primary glass layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent dark:from-slate-800/20 dark:via-slate-900/10 dark:to-transparent" />
            
            {/* Animated glass patterns */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 animate-pulse" />
            <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/20 to-transparent dark:from-slate-700/10 dark:to-transparent" />
            
            {/* Dynamic light reflections based on scroll */}
            <div 
              className="absolute inset-0 bg-gradient-to-br from-blue-400/10 via-transparent to-purple-400/10 transition-transform duration-1000 ease-out"
              style={{
                transform: `translateY(${scrollY * 0.1}px) rotate(${scrollY * 0.02}deg)`,
                opacity: Math.min(scrollY / 1000, 0.3)
              }}
            />
          </div>
          
          <div className="relative z-10">
            {/* Header with dynamic title and conditional filter */}
            <Header 
              onSync={handleSync} 
              isSyncing={isSyncing} 
              isVisible={shouldShowNavigation}
              title={getHeaderTitle()}
              showFilter={activeTab === 'articles'}
              currentFilter={activeTab === 'articles' ? articleFilter : undefined}
              onFilterChange={handleFilterChange}
            />
            
            {/* Main content */}
            <div className="pt-20 pb-32">
              {activeTab === 'articles' && (
                <ArticleList 
                  ref={articleListRef} 
                  currentFilter={articleFilter}
                />
              )}
              {activeTab === 'feeds' && (
                <FeedsList 
                  onFeedSelect={handleFeedSelect}
                  onFolderSelect={handleFolderSelect}
                />
              )}
              {activeTab === 'stats' && (
                <Stats />
              )}
              {activeTab === 'settings' && (
                <Settings />
              )}
            </div>
            
            {/* Auto-hiding Bottom Navigation */}
            <BottomNavigation 
              activeTab={activeTab} 
              onTabChange={handleTabChange}
              isVisible={shouldShowNavigation}
            />
            
            {/* Scroll to Top Button */}
            <ScrollToTopButton show={shouldShowScrollToTop} />
          </div>
        </div>
      </ToastProvider>
    </ThemeContext.Provider>
  );
}