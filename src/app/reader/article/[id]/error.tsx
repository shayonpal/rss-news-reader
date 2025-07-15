'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Article page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Unable to load article</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {error.message || 'Something went wrong while loading the article.'}
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => window.location.href = '/reader'} variant="outline">
            Back to Reader
          </Button>
          <Button onClick={reset}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}