'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useArticleStore } from '@/lib/stores/article-store';
import { useFeedStore } from '@/lib/stores/feed-store';
import { ArticleDetail } from '@/components/articles/article-detail';
import type { Article } from '@/types';
import { formatDistanceToNow } from 'date-fns';

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id ? decodeURIComponent(params.id as string) : '';
  
  const { articles, getArticle, markAsRead, toggleStar } = useArticleStore();
  const { feeds } = useFeedStore();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticle = async () => {
      try {
        const fetchedArticle = await getArticle(articleId);
        
        if (fetchedArticle) {
          setArticle(fetchedArticle);
          // Mark as read when opened
          if (!fetchedArticle.isRead) {
            await markAsRead(articleId);
          }
        } else {
          // Article not found
          notFound();
        }
      } catch (error) {
        console.error('Error loading article:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [articleId, getArticle, markAsRead, router]);

  const handleToggleStar = async () => {
    if (article) {
      await toggleStar(article.id);
      // Refresh the article to get the updated state from the store
      const updatedArticle = await getArticle(article.id);
      if (updatedArticle) {
        setArticle(updatedArticle);
      }
    }
  };

  const handleNavigate = async (direction: 'prev' | 'next') => {
    // Get all articles in current view
    const allArticles = Array.from(articles.values());
    const currentIndex = allArticles.findIndex(a => a.id === articleId);
    
    if (currentIndex === -1) return;
    
    let targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    // Wrap around navigation
    if (targetIndex < 0) {
      targetIndex = allArticles.length - 1;
    } else if (targetIndex >= allArticles.length) {
      targetIndex = 0;
    }
    
    const targetArticle = allArticles[targetIndex];
    if (targetArticle) {
      router.push(`/article/${encodeURIComponent(targetArticle.id)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  if (!article) {
    return null;
  }

  const feed = feeds.get(article.feedId || '');

  return (
    <ArticleDetail
      article={article}
      feed={feed}
      feedTitle={feed?.title || 'Unknown Feed'}
      onToggleStar={handleToggleStar}
      onNavigate={handleNavigate}
      onBack={() => {
        // Always navigate to listing page to ensure consistent behavior
        router.push('/');
      }}
    />
  );
}