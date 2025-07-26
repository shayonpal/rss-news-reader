'use client';

import { Star } from 'lucide-react';
import { ArticleActionButton, type ArticleActionButtonSize } from '@/components/ui/article-action-button';

/**
 * Specialized button for star/unstar functionality
 * 
 * This is an example of how to create specialized action buttons
 * following our button architecture. Use this as a template when
 * creating new action buttons.
 * 
 * @see docs/tech/button-architecture.md for complete guide
 */
interface StarButtonProps {
  onToggleStar: () => void;
  isStarred: boolean;
  size?: ArticleActionButtonSize;
  disabled?: boolean;
}

export function StarButton({ 
  onToggleStar, 
  isStarred, 
  size = 'sm',
  disabled = false 
}: StarButtonProps) {
  return (
    <ArticleActionButton
      icon={Star}
      onPress={onToggleStar}
      size={size}
      active={isStarred}
      activeClassName="fill-yellow-500 text-yellow-500"
      label={isStarred ? 'Unstar' : 'Star'}
      disabled={disabled}
    />
  );
}