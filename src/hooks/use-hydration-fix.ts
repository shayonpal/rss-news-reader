'use client';

import { useEffect } from 'react';
import { useArticleStore } from '@/lib/stores/article-store';

export function useHydrationFix() {
  const setReadStatusFilter = useArticleStore((state) => state.setReadStatusFilter);

  useEffect(() => {
    // Only run on client after hydration
    const saved = localStorage.getItem('readStatusFilter');
    if (saved === 'all' || saved === 'unread' || saved === 'read') {
      setReadStatusFilter(saved);
    }
  }, [setReadStatusFilter]);
}