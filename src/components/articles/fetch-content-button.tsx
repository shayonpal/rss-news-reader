'use client';

import { useState } from 'react';
import { IOSButton } from '@/components/ui/ios-button';
import { Download, Loader2, AlertCircle, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArticleActionButton, type ArticleActionButtonSize } from '@/components/ui/article-action-button';

interface FetchContentButtonProps {
  articleId: string;
  hasFullContent?: boolean;
  variant?: 'icon' | 'button';
  size?: ArticleActionButtonSize;
  className?: string;
  onSuccess?: (content: string) => void;
  onRevert?: () => void;
}

export function FetchContentButton({
  articleId,
  hasFullContent = false,
  variant = 'icon',
  size = 'sm',
  className,
  onSuccess,
  onRevert,
}: FetchContentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchContent = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/reader/api/articles/${articleId}/fetch-content`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Fetch content error:', { 
          status: response.status, 
          data,
          articleId 
        });
        throw new Error(data.message || data.details || 'Failed to fetch content');
      }

      if (data.success && data.content) {
        onSuccess?.(data.content);
      }
    } catch (err) {
      console.error('Failed to fetch content:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = () => {
    if (hasFullContent && onRevert) {
      onRevert();
    } else {
      handleFetchContent();
    }
  };

  if (variant === 'icon') {
    return (
      <ArticleActionButton
        icon={hasFullContent ? Undo2 : Download}
        onPress={handleAction}
        size={size}
        active={false}
        label={hasFullContent ? "Revert to RSS content" : "Fetch full content"}
        disabled={isLoading}
        loading={isLoading}
        loadingIcon={Loader2}
        className={className}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <IOSButton
        onPress={handleAction}
        disabled={isLoading}
        variant="outline"
        size="lg"
        className={cn(
          "gap-2 px-6 py-3 text-base font-medium min-w-[200px]",
          className
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {hasFullContent ? "Reverting..." : "Fetching full content..."}
          </>
        ) : hasFullContent ? (
          <>
            <Undo2 className="h-4 w-4" />
            Revert to RSS Content
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Fetch Full Content
          </>
        )}
      </IOSButton>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}