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

type JobState = "idle" | "running" | "done" | "failed";

/**
 * Auto-parse content hook for RSS articles
 *
 * Automatically parses article content when:
 * - Feed has partial content
 * - Article content is short (< 500 chars)
 * - Content contains truncation indicators
 *
 * Features:
 * - Race condition protection via state machine
 * - Request cancellation on component unmount
 * - Manual parsing support
 * - Proper error handling
 * - Stable callback identity
 */
export function useAutoParseContent({
  article,
  feed,
  enabled = true,
}: UseAutoParseContentOptions): UseAutoParseContentResult {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedContent, setParsedContent] = useState<string | null>(null);
  const [parseAttempted, setParseAttempted] = useState(false);
  
  // Refs for stable callback pattern
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  
  // RR-245 fix: Article ref to access current article in stable callback
  const articleRef = useRef(article);
  useEffect(() => {
    articleRef.current = article;
  }, [article]);
  
  // RR-245 fix: State machine for tracking parse jobs per article
  const jobsRef = useRef(
    new Map<string, JobState>()
  );
  // Lightweight cooldown to avoid burst re-triggers when parents recreate article objects every render
  const lastTriggerKeyRef = useRef<string | null>(null);
  const lastTriggerAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  
  // RR-245 fix: Sync isParsing state with ref for stable callback access
  const isParsingRef = useRef(false);
  useEffect(() => {
    isParsingRef.current = isParsing;
  }, [isParsing]);

  // RR-245 fix: Stable callback with empty dependencies
  const triggerParse = useCallback(
    async (isManual = false) => {
      const currentArticle = articleRef.current;
      if (!currentArticle?.url || !mountedRef.current) return;
      
      const job = jobsRef.current.get(currentArticle.url);
      
      // Skip if already processing (unless manual)
      if (!isManual && (job === "running" || inFlightRef.current)) {
        return;
      }

      const currentArticleId = currentArticle.id;
      const currentArticleUrl = currentArticle.url;
      jobsRef.current.set(currentArticleUrl, "running");
      inFlightRef.current = true;

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
          `/reader/api/articles/${currentArticleId}/fetch-content`,
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

        // Check if component is still mounted and article hasn't changed
        if (!mountedRef.current || articleRef.current.url !== currentArticleUrl) {
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

        // Double-check mount and article ID
        if (!mountedRef.current || articleRef.current.url !== currentArticleUrl) {
          return;
        }

        if (data.success && data.content) {
          setParsedContent(data.content);
          setParseError(null);
          jobsRef.current.set(currentArticleUrl, "done");
        } else if (data.fallbackContent) {
          setParsedContent(data.fallbackContent);
          setParseError(data.error || "Using partial content");
          jobsRef.current.set(currentArticleUrl, "done");
        }
      } catch (err) {
        // Check mount and article ID before setting error state
        if (
          !mountedRef.current || 
          articleRef.current.id !== currentArticleId ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }

        if (err instanceof Error) {
          setParseError(err.message);
        } else {
          setParseError("An unexpected error occurred");
        }
        jobsRef.current.set(currentArticleUrl, "failed");
      } finally {
        if (mountedRef.current && articleRef.current.url === currentArticleUrl) {
          setIsParsing(false);
        }
        abortControllerRef.current = null;
        inFlightRef.current = false;
      }
    },
    [] // Empty dependencies for stable identity
  );

  // Reset state when article URL changes (treat as true article change)
  useEffect(() => {
    setParsedContent(null);
    setParseError(null);
    setParseAttempted(false);
    // Do not force isParsing=false here to avoid clobbering a just-started manual trigger

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset cooldown on explicit article change so a new article can auto-parse
    lastTriggerKeyRef.current = null;
    lastTriggerAtRef.current = 0;
  }, [article.url]);

  // When the article identity changes even with the same URL, allow re-triggering
  useEffect(() => {
    if (article.url) {
      jobsRef.current.delete(article.url);
      // also clear cooldown so the next effect can fire immediately
      lastTriggerKeyRef.current = null;
      lastTriggerAtRef.current = 0;
    }
    // do not clear parsedContent here; next fetch will overwrite if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, article.url]); // article.url added to properly track URL changes

  // Auto-parse logic
  useEffect(() => {
    if (!enabled || !mountedRef.current) return;
    
    const job = jobsRef.current.get(article.url);

    // Skip if already processed or in progress
    if (
      job === "running" ||
      job === "done" ||
      job === "failed" ||
      (article.hasFullContent && article.fullContent) ||
      article.parseFailed === true
    ) {
      return;
    }

    let needsParsing = false;

    // Determine if parsing is needed
    if (feed?.isPartialContent === true) {
      needsParsing = true;
    } else if (article.content && article.content.length < 500) {
      needsParsing = true;
    } else if (article.content) {
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
      const key = article.url || article.id;
      const now = Date.now();
      if (lastTriggerKeyRef.current === key && now - lastTriggerAtRef.current < 100) {
        return; // Cooldown: avoid tight re-triggers across rapid re-renders
      }
      lastTriggerKeyRef.current = key;
      lastTriggerAtRef.current = now;
      triggerParse(false);
    }
  }, [
    enabled,
    article.id,
    article.url, // Added for consistency
    article.content,
    article.hasFullContent,
    article.fullContent,
    article.parseFailed,
    feed?.isPartialContent,
    triggerParse, // Added since it's now stable with empty deps
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

  const clearError = () => setParseError(null);
  const clearParsedContent = () => setParsedContent(null);

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
