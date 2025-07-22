'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useArticleStore } from '@/lib/stores/article-store';
import { Button } from '@/components/ui/button';

export default function TestArticleControls() {
  const router = useRouter();
  const { articles, loadArticles } = useArticleStore();
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        await loadArticles();
        setLoading(false);
      } catch (error) {
        console.error('Failed to load articles:', error);
        setLoading(false);
      }
    };
    fetchArticles();
  }, [loadArticles]);

  const runTests = () => {
    const results: string[] = [];
    
    // Test 1: Check if articles loaded
    const articleCount = articles.size;
    results.push(`✓ Loaded ${articleCount} articles`);
    
    // Test 2: Get first article
    const firstArticle = Array.from(articles.values())[0];
    if (firstArticle) {
      results.push(`✓ First article: "${firstArticle.title.substring(0, 50)}..."`);
      results.push(`✓ Article ID: ${firstArticle.id}`);
      results.push(`✓ Has URL: ${!!firstArticle.url}`);
      results.push(`✓ Is starred: ${firstArticle.tags?.includes('starred') || false}`);
    } else {
      results.push('✗ No articles found');
    }
    
    setTestResults(results);
  };

  const navigateToFirstArticle = () => {
    const firstArticle = Array.from(articles.values())[0];
    if (firstArticle) {
      router.push(`/article/${encodeURIComponent(firstArticle.id)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Article Controls Test Page</h1>
      
      <div className="space-y-4 mb-8">
        <Button onClick={runTests}>Run Tests</Button>
        <Button onClick={navigateToFirstArticle} variant="secondary">
          Navigate to First Article
        </Button>
        <Button onClick={() => router.push('/')} variant="outline">
          Back to Home
        </Button>
      </div>
      
      {testResults.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Test Results:</h2>
          <ul className="space-y-1">
            {testResults.map((result, index) => (
              <li key={index} className="font-mono text-sm">
                {result}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-semibold mb-2">Article View Controls to Test:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Back to list button (top left arrow)</li>
          <li>Star/unstar toggle button</li>
          <li>Share button (copies link or uses native share)</li>
          <li>Open original article button (external link icon)</li>
          <li>Previous/Next navigation buttons (bottom)</li>
          <li>Keyboard navigation (←/→ arrows, Escape key)</li>
          <li>Touch swipe navigation (mobile)</li>
        </ol>
      </div>
    </div>
  );
}