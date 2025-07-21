'use client';

import { useState } from 'react';
import { Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { useArticleStore } from '@/lib/stores/article-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
      <Button
        variant="ghost"
        size="icon"
        onClick={handleGenerateSummary}
        disabled={isLoading}
        className={cn(
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          className
        )}
        title={hasSummary ? "Regenerate summary" : "Generate AI summary"}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : hasSummary ? (
          <RotateCcw className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleGenerateSummary}
      disabled={isLoading}
      variant="default"
      size="sm"
      className={cn(
        "bg-blue-600 hover:bg-blue-700",
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
    </Button>
  );
}