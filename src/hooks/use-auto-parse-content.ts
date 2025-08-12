import { useEffect, useState, useRef, useCallback } from "react";
import type { Article, Feed } from "@/types";

interface UseAutoParseContentOptions {
  article: Article;
  feed?: Feed;
  enabled?: boolean;
}

interface UseAutoParseContentResult {
  isParsing: boolean;
  parseError: string | null;
  parsedContent: string | null;
  shouldShowRetry: boolean;
  triggerParse: (isManual?: boolean) => Promise<void>;
  clearError: () => void;
  clearParsedContent: () => void;
}

export function useAutoParseContent({
  article,
  feed,
  enabled = true,
}: UseAutoParseContentOptions): UseAutoParseContentResult {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedContent, setParsedContent] = useState<string | null>(null);
  const [parseAttempted, setParseAttempted] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isParsingRef = useRef(false); // Track parsing state without causing re-renders

  // Check if this article needs parsing
  const needsParsing = useCallback(() => {
    // Already has full content
    if (article.hasFullContent && article.fullContent) {
      return false;
    }

    // Check if this is from a partial feed - ALWAYS parse these
    if (feed?.isPartialContent === true) {
      return true;
    }

    // For non-partial feeds, only parse if content is short or truncated
    // Check if content is suspiciously short (less than 500 chars)
    if (article.content && article.content.length < 500) {
      return true;
    }

    // Check for truncation indicators
    const truncationIndicators = [
      "Read more",
      "Continue reading",
      "[...]",
      "Click here to read",
      "View full article",
    ];

    if (article.content) {
      return truncationIndicators.some((indicator) =>
        article.content.toLowerCase().includes(indicator.toLowerCase())
      );
    }

    return false;
  }, [
    article.hasFullContent,
    article.fullContent,
    article.content,
    feed?.isPartialContent,
  ]);

  const triggerParse = useCallback(
    async (isManual = false) => {
      // Don't start a new parse if one is already in progress (unless manual)
      if (!isManual && isParsingRef.current) return;
      if (!article.url) return;

      // Track the current article ID to detect if it changes during fetch
      const currentArticleId = article.id;

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setIsParsing(true);
      isParsingRef.current = true; // Update ref
      setParseError(null);
      setParseAttempted(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(
          `/reader/api/articles/${article.id}/fetch-content`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              forceRefresh: isManual, // Pass manual flag to API
            }),
            signal: controller.signal,
          }
        );

        // Check if article changed while fetching
        if (currentArticleId !== article.id) {
          return; // Discard result for old article
        }

        if (!response.ok) {
          const data = await response.json();

          // Check if it's a rate limit error
          if (response.status === 429) {
            throw new Error(
              "Too many requests. Please wait a moment and try again."
            );
          }

          // Check if parsing has failed permanently
          if (data.parseFailed) {
            throw new Error(
              "Content extraction failed. The original article may no longer be available."
            );
          }

          throw new Error(data.message || "Failed to fetch content");
        }

        const data = await response.json();

        // Check again if article changed
        if (currentArticleId !== article.id) {
          return; // Discard result for old article
        }

        if (data.success && data.content) {
          setParsedContent(data.content);
          setParseError(null);
        } else if (data.fallbackContent) {
          // Use fallback content but show that parsing failed
          setParsedContent(data.fallbackContent);
          setParseError(data.error || "Using partial content");
        }
      } catch (err) {
        // Check if article changed before updating error state
        if (currentArticleId !== article.id) {
          return; // Discard error for old article
        }

        if (err instanceof Error) {
          if (err.name === "AbortError") {
            // Request was cancelled, don't show error
            return;
          }
          setParseError(err.message);
        } else {
          setParseError("An unexpected error occurred");
        }
      } finally {
        // Only update isParsing if this is still the current article
        if (currentArticleId === article.id) {
          setIsParsing(false);
          isParsingRef.current = false; // Update ref
        }
        abortControllerRef.current = null;
      }
    },
    [article.id, article.url]
  ); // Removed isParsing to prevent circular dependency

  // Auto-trigger parsing when component mounts if needed
  useEffect(() => {
    // Reset ALL state when article changes (critical fix)
    setParsedContent(null);
    setParseError(null);
    setParseAttempted(false);
    setIsParsing(false); // Critical: Reset parsing state to prevent stuck loading states
    isParsingRef.current = false; // Reset ref too

    // Cancel any in-flight request from previous article
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Check if we need to parse and trigger if so
    if (enabled && needsParsing() && !article.parseFailed) {
      triggerParse();
    }

    // Cleanup function to abort request when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, enabled, article.parseFailed, needsParsing, triggerParse]); // Include stable functions

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const clearError = () => {
    setParseError(null);
  };

  const clearParsedContent = () => {
    setParsedContent(null);
  };

  const shouldShowRetry = Boolean(
    parseError &&
      !parseError.includes("permanently") &&
      article.parseAttempts !== undefined &&
      article.parseAttempts < 3
  );

  return {
    isParsing,
    parseError,
    parsedContent,
    shouldShowRetry,
    triggerParse,
    clearError,
    clearParsedContent,
  };
}
