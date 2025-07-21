'use client';

import { useState } from 'react';
import { Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { useArticleStore } from '@/lib/stores/article-store';
import { cn } from '@/lib/utils';

interface SummaryButtonProps {
  articleId: string;
  hasSummary: boolean;
  variant?: 'icon' | 'full';
  className?: string;
  onSuccess?: () => void;
}

export function SummaryButton({
  articleId,
  hasSummary,
  variant = 'full',
  className,
  onSuccess
}: SummaryButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { generateSummary } = useArticleStore();

  const handleGenerateSummary = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to parent elements
    setIsLoading(true);
    setError(null);

    try {
      await generateSummary(articleId, hasSummary);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      console.error('Summary generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleGenerateSummary}
        disabled={isLoading}
        className={cn(
          "p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        title={hasSummary ? "Regenerate summary" : "Generate AI summary"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasSummary ? (
          <RotateCcw className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleGenerateSummary}
      disabled={isLoading}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 text-sm",
        "bg-blue-600 text-white rounded-md hover:bg-blue-700",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors",
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : hasSummary ? (
        <>
          <RotateCcw className="h-4 w-4" />
          Re-summarize
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Summarize
        </>
      )}
    </button>
  );
}