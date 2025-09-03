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
  const triggeredArticlesRef = useRef<Set<string>>(new Set());

  const triggerParse = useCallback(
    async (isManual = false) => {
      if (!isManual && isParsing) return;
      if (!article.url) return;

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

        // Check if article changed while fetching
        if (currentArticleId !== article.id) {
          return;
        }

        if (!response.ok) {
          const data = await response.json();

          if (response.status === 429) {
            throw new Error(
              "Too many requests. Please wait a moment and try again."
            );
          }

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
          return;
        }

        if (data.success && data.content) {
          setParsedContent(data.content);
          setParseError(null);
        } else if (data.fallbackContent) {
          setParsedContent(data.fallbackContent);
          setParseError(data.error || "Using partial content");
        }
      } catch (err) {
        // Check if article changed before updating error state
        if (currentArticleId !== article.id) {
          return;
        }

        if (err instanceof Error) {
          if (err.name === "AbortError") {
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

    // Cancel any in-flight request from previous article
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [article.id]);

  // Auto-parse logic - simplified with explicit tracking
  useEffect(() => {
    if (!enabled) return;
    if (triggeredArticlesRef.current.has(article.id)) return;
    if (article.hasFullContent && article.fullContent) return;
    if (article.parseFailed === true) return;

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
      // Mark as triggered immediately
      triggeredArticlesRef.current.add(article.id);

      // Trigger parsing
      triggerParse(false);
    }
  }, [
    enabled,
    article.id,
    article.hasFullContent,
    article.fullContent,
    article.parseFailed,
    article.content,
    feed?.isPartialContent,
    triggerParse,
  ]);

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
