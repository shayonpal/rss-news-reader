import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArticleCard } from './ArticleCard';
import { ShimmerList } from './ShimmerCard';
import { useToast } from './Toast';
import { supabase } from '../lib/supabase';
import { FilterState } from './FilterDropdown';

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
  isNew?: boolean;
}

interface ArticleListProps {
  currentFilter: FilterState;
}

export const ArticleList = forwardRef<
  { fetchArticles: () => Promise<void> },
  ArticleListProps
>(({ currentFilter }, ref) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summarizingIds, setSummarizingIds] = useState<Set<number>>(new Set());
  const { showToast } = useToast();

  // Mock data generator
  const generateMockArticles = (count: number = 40, markAsNew: boolean = false): Article[] => {
    const categories = ['Technology', 'Science', 'Design', 'Space', 'Health', 'Business', 'Politics', 'Entertainment'];
    const sources = ['TechCrunch', 'Wired', 'The Verge', 'Ars Technica', 'MIT Technology Review', 'Fast Company', 'Engadget', 'Mashable'];
    
    const titles = [
      'Revolutionary AI Breakthrough Changes Everything We Know',
      'The Future of Web Development in 2024',
      'Scientists Discover New Form of Matter',
      'Design Trends That Will Shape the Next Decade',
      'Space Exploration Reaches New Milestone',
      'Health Tech Innovation Saves Lives',
      'The Rise of Sustainable Technology',
      'Quantum Computing Makes Major Leap Forward',
      'Virtual Reality Transforms Education',
      'Blockchain Technology Revolutionizes Finance',
      'Machine Learning Predicts Climate Change',
      'Robotics Advances in Healthcare',
      'Cybersecurity Threats and Solutions',
      'The Evolution of Mobile Technology',
      'Green Energy Solutions for the Future'
    ];

    return Array.from({ length: count }, (_, index) => ({
      id: Date.now() + index,
      title: titles[Math.floor(Math.random() * titles.length)] + ` ${Math.random().toString(36).substr(2, 4)}`,
      excerpt: `This is a comprehensive article excerpt that provides detailed insights into the latest developments in ${categories[Math.floor(Math.random() * categories.length)].toLowerCase()}. The content explores various aspects and implications for the future of technology and society.`,
      source: sources[Math.floor(Math.random() * sources.length)],
      publishedAt: Math.random() > 0.5 ? '2h ago' : '5h ago',
      category: categories[Math.floor(Math.random() * categories.length)],
      is_read: Math.random() > 0.7,
      ai_summary: Math.random() > 0.8 ? 'AI-generated summary of the key points and insights from this article.' : undefined,
      is_summarized: Math.random() > 0.8,
      is_bookmarked: Math.random() > 0.9,
      isNew: markAsNew
    }));
  };

  const fetchArticles = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, isRefresh ? 1500 : 1000));

      if (isRefresh) {
        // Generate new articles for refresh
        const newArticlesCount = Math.floor(Math.random() * 8) + 2; // 2-9 new articles
        const newArticles = generateMockArticles(newArticlesCount, true);
        
        setArticles(prevArticles => [
          ...newArticles,
          ...prevArticles.map(article => ({ ...article, isNew: false }))
        ]);

        // Show toast notification
        showToast(`${newArticlesCount} new articles fetched`, 'success');
      } else {
        // Initial load
        const mockArticles = generateMockArticles(40, false);
        setArticles(mockArticles);
      }
    } catch (err) {
      setError('Failed to fetch articles. Please try again.');
      showToast('Failed to fetch articles', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter articles based on current filter
  const filteredArticles = articles.filter(article => {
    // Filter by read status
    if (currentFilter.readStatus === 'unread' && article.is_read) return false;
    if (currentFilter.readStatus === 'read' && !article.is_read) return false;
    
    // Filter by source (simplified for demo)
    if (currentFilter.sourceType === 'folder' || currentFilter.sourceType === 'feed') {
      // In a real app, you'd filter by the actual source
      // For demo, we'll show a subset based on source title
      return Math.random() > 0.3; // Show ~70% of articles for filtered sources
    }
    
    return true;
  });

  useEffect(() => {
    fetchArticles();
  }, [currentFilter]);

  useImperativeHandle(ref, () => ({
    fetchArticles: () => fetchArticles(true)
  }));

  const handleMarkAsRead = (articleId: number) => {
    setArticles(prev =>
      prev.map(article =>
        article.id === articleId ? { ...article, is_read: true } : article
      )
    );
  };

  const handleSummarize = async (articleId: number) => {
    setSummarizingIds(prev => new Set([...prev, articleId]));
    
    try {
      // Simulate AI summarization delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setArticles(prev =>
        prev.map(article =>
          article.id === articleId 
            ? { 
                ...article, 
                ai_summary: 'This AI-generated summary highlights the key insights and main points from the article, providing a concise overview of the most important information.',
                is_summarized: true 
              } 
            : article
        )
      );
    } catch (error) {
      showToast('Failed to summarize article', 'error');
    } finally {
      setSummarizingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

  const handleToggleBookmark = (articleId: number) => {
    setArticles(prev =>
      prev.map(article =>
        article.id === articleId 
          ? { ...article, is_bookmarked: !article.is_bookmarked } 
          : article
      )
    );
  };

  if (loading) {
    return <ShimmerList />;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => fetchArticles()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      {refreshing && <ShimmerList />}
      
      {!refreshing && (
        <div className="space-y-3">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">No articles found matching your filters.</p>
            </div>
          ) : (
            filteredArticles.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                index={index}
                onMarkAsRead={handleMarkAsRead}
                onSummarize={handleSummarize}
                onToggleBookmark={handleToggleBookmark}
                isSummarizing={summarizingIds.has(article.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});

ArticleList.displayName = 'ArticleList';