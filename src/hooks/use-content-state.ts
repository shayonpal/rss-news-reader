import type { Article } from "@/types";

export type ContentSource = "manual" | "auto" | "stored" | "rss";

interface UseContentStateResult {
  contentSource: ContentSource;
  displayContent: string;
  hasEnhancedContent: boolean;
}

/**
 * Custom hook to manage unified content state across all sources
 * Provides a single source of truth for content display and button states
 */
export function useContentState(
  article: Article,
  parsedContent: string | null,
  fetchedContent: string | null,
  forceOriginalContent: boolean = false
): UseContentStateResult {
  // Determine the source of content being displayed
  const contentSource: ContentSource = forceOriginalContent
    ? "rss" // User explicitly wants original RSS content
    : fetchedContent
      ? "manual" // User manually fetched content
      : parsedContent
        ? "auto" // Auto-parsed from partial feed
        : article.fullContent
          ? "stored" // Previously fetched and stored in DB
          : "rss"; // Original RSS content

  // Get the actual content to display based on priority
  const displayContent = forceOriginalContent
    ? article.content || "" // Force original RSS content
    : fetchedContent ||
      parsedContent ||
      article.fullContent ||
      article.content ||
      "";

  // Check if we have any enhanced content (not just RSS)
  const hasEnhancedContent = forceOriginalContent
    ? false // When forcing original, we don't have enhanced content
    : !!(fetchedContent || parsedContent || article.fullContent);

  return {
    contentSource,
    displayContent,
    hasEnhancedContent,
  };
}
