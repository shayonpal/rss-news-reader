import { useEffect, useState, useRef } from "react";
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
  triggerParse: () => Promise<void>;
  clearError: () => void;
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

  // Check if this article needs parsing
  const needsParsing = () => {
    // Already has full content
    if (article.hasFullContent && article.fullContent) {
      return false;
    }

    // Check if this is from a partial feed
    if (feed?.isPartialFeed) {
      return true;
    }

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
      return truncationIndicators.some(indicator => 
        article.content.toLowerCase().includes(indicator.toLowerCase())
      );
    }

    return false;
  };

  const triggerParse = async () => {
    if (isParsing || !article.url) return;

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
            forceRefresh: false,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const data = await response.json();
        
        // Check if it's a rate limit error
        if (response.status === 429) {
          throw new Error("Too many requests. Please wait a moment and try again.");
        }
        
        // Check if parsing has failed permanently
        if (data.parseFailed) {
          throw new Error("Content extraction failed. The original article may no longer be available.");
        }
        
        throw new Error(data.message || "Failed to fetch content");
      }

      const data = await response.json();
      
      if (data.success && data.content) {
        setParsedContent(data.content);
        setParseError(null);
      } else if (data.fallbackContent) {
        // Use fallback content but show that parsing failed
        setParsedContent(data.fallbackContent);
        setParseError(data.error || "Using partial content");
      }
    } catch (err) {
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
      setIsParsing(false);
      abortControllerRef.current = null;
    }
  };

  // Auto-trigger parsing when component mounts if needed
  useEffect(() => {
    if (enabled && needsParsing() && !parseAttempted && !article.parseFailed) {
      triggerParse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, enabled]); // Only re-run if article ID or enabled changes

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
  };
}