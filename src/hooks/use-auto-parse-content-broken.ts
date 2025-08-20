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
  const lastTriggeredRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const triggerParse = useCallback(
    async (isManual = false) => {
      // Don't start a new parse if one is already in progress (unless manual)
      if (!isManual && isParsing) return;
      if (!article.url) return;
      if (!mountedRef.current) return;

      // Track the current article ID to detect if it changes during fetch
      const currentArticleId = article.id;

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setIsParsing(true);
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
              forceRefresh: isManual,
            }),
            signal: controller.signal,
          }
        );

        // Check if article changed while fetching or component unmounted
        if (currentArticleId !== article.id || !mountedRef.current) {
          return; // Discard result for old article or unmounted component
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

        // Check again if article changed or component unmounted
        if (currentArticleId !== article.id || !mountedRef.current) {
          return; // Discard result for old article or unmounted component
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
        // Check if article changed before updating error state or component unmounted
        if (currentArticleId !== article.id || !mountedRef.current) {
          return; // Discard error for old article or unmounted component
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
        // Only update isParsing if this is still the current article and component is mounted
        if (currentArticleId === article.id && mountedRef.current) {
          setIsParsing(false);
        }
        abortControllerRef.current = null;
      }
    },
    [article.id, article.url, isParsing]
  );

  // Reset state when article changes
  useEffect(() => {
    setParsedContent(null);
    setParseError(null);
    setParseAttempted(false);
    setIsParsing(false);
    // DO NOT reset lastTriggeredRef here - it causes race condition
    // lastTriggeredRef.current = null;

    // Cancel any in-flight request from previous article
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [article.id]);

  // Check if auto-parsing should be triggered
  useEffect(() => {
    // Skip if auto-parsing is disabled
    if (!enabled) return;

    // Skip if already triggered for this article (but allow manual triggers)
    if (lastTriggeredRef.current === article.id) return;

    // Skip if already has full content
    if (article.hasFullContent && article.fullContent) return;

    // Skip if parsing failed permanently (check for boolean true)
    if (article.parseFailed === true) return;

    // Determine if auto-parsing is needed
    let needsParsing = false;

    // Always parse partial feeds
    if (feed?.isPartialContent === true) {
      needsParsing = true;
    }
    // Parse short content
    else if (article.content && article.content.length < 500) {
      needsParsing = true;
    }
    // Parse content with truncation indicators
    else if (article.content) {
      const truncationIndicators = [
        "Read more",
        "Continue reading",
        "[...]",
        "Click here to read",
        "View full article",
      ];
      needsParsing = truncationIndicators.some((indicator) =>
        article.content.toLowerCase().includes(indicator.toLowerCase())
      );
    }

    if (needsParsing) {
      // Mark as triggered immediately to prevent re-triggering
      lastTriggeredRef.current = article.id;

      // Use setTimeout to avoid triggering during render
      const timeoutId = setTimeout(() => {
        triggerParse(false);
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [
    enabled,
    article.id,
    article.hasFullContent,
    article.fullContent,
    article.parseFailed,
    article.content,
    feed?.isPartialContent,
    // Removed triggerParse to prevent infinite re-renders
  ]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
