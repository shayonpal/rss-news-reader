import { useEffect, useState, useRef, useCallback } from "react";
import type { Article, Feed } from "@/types";
import {
  ensureParseTask,
  getTaskResult,
  isTaskRunning,
  getTaskError,
  subscribe,
} from "@/lib/utils/parse-task-manager";

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

  // Component mounting state
  const mountedRef = useRef(true);
  const [, forceUpdate] = useState({});

  // Task key for global task manager
  const taskKey = `article:full:${article.id}`;

  // Define the expected result type for the parse task
  interface ParseResult {
    success: boolean;
    content?: string;
    fallbackContent?: string;
    error?: string;
  }

  // Check task state from global manager with proper typing
  const existingResult = getTaskResult<ParseResult>(taskKey);
  const isRunning = isTaskRunning(taskKey);
  const taskError = getTaskError(taskKey);

  // Update local state based on global task state
  useEffect(() => {
    if (existingResult) {
      if (existingResult.success && existingResult.content) {
        setParsedContent(existingResult.content);
        setParseError(null);
        setParseAttempted(true);
      } else if (existingResult.fallbackContent) {
        setParsedContent(existingResult.fallbackContent);
        setParseError(existingResult.error || "Using partial content");
        setParseAttempted(true);
      }
    }

    if (taskError) {
      setParseError(taskError);
      setParseAttempted(true);
    }

    setIsParsing(isRunning);
  }, [existingResult, isRunning, taskError, taskKey]);

  // Subscribe to task completion events
  useEffect(() => {
    let cancelled = false;

    const unsubscribe = subscribe(taskKey, () => {
      if (!cancelled) {
        forceUpdate({}); // Force re-render to pick up new state
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [taskKey]);

  // Stable fetch function using global task manager
  const triggerParse = useCallback(
    async (isManual = false) => {
      if (!article.id) {
        return;
      }

      // Create fetch function for task manager
      const fetchFunction = async (
        signal?: AbortSignal
      ): Promise<ParseResult> => {
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
            signal,
            // Add keepalive to help survive navigation
            keepalive: true,
          }
        );

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
        return data;
      };

      // Use global task manager - this survives component lifecycle
      try {
        const task = ensureParseTask<ParseResult>(taskKey, fetchFunction);
        const result = await task.promise;

        // Only update component state if still mounted
        if (mountedRef.current) {
          if (result.success && result.content) {
            setParsedContent(result.content);
            setParseError(null);
          } else if (result.fallbackContent) {
            setParsedContent(result.fallbackContent);
            setParseError(result.error || "Using partial content");
          }
          setParseAttempted(true);
        }
      } catch (err) {
        // Only update component state if still mounted and not aborted
        if (
          mountedRef.current &&
          !(err instanceof Error && err.name === "AbortError")
        ) {
          if (err instanceof Error) {
            setParseError(err.message);
          } else {
            setParseError("An unexpected error occurred");
          }
          setParseAttempted(true);
        }
      }
    },
    [article.id, taskKey] // Include actual dependencies
  );

  // Reset local state when article changes (task manager handles global state)
  useEffect(() => {
    setParsedContent(null);
    setParseError(null);
    setParseAttempted(false);
  }, [article.id]);

  // Simplified auto-parse logic using task manager
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Skip if already has full content or failed
    if (
      (article.hasFullContent && article.fullContent) ||
      article.parseFailed === true
    ) {
      return;
    }

    // Skip if task already running or completed
    if (isTaskRunning(taskKey) || getTaskResult<ParseResult>(taskKey)) {
      return;
    }

    let needsParsing = false;
    let reason = "";

    // Determine if parsing is needed
    if (feed?.isPartialContent === true) {
      needsParsing = true;
      reason = "feed.isPartialContent === true";
    } else if (article.content && article.content.length < 500) {
      needsParsing = true;
      reason = `content length < 500 (${article.content.length})`;
    } else if (article.content) {
      const truncationIndicators = [
        "Read more",
        "Continue reading",
        "[...]",
        "Click here to read",
        "View full article",
      ];
      const foundIndicator = truncationIndicators.find((indicator) =>
        article.content.toLowerCase().includes(indicator.toLowerCase())
      );
      if (foundIndicator) {
        needsParsing = true;
        reason = `truncation indicator found: "${foundIndicator}"`;
      }
    }

    if (needsParsing) {
      triggerParse(false);
    }
  }, [
    enabled,
    article.id,
    article.content,
    article.hasFullContent,
    article.fullContent,
    article.parseFailed,
    feed?.isPartialContent,
    taskKey,
    triggerParse,
  ]);

  // Clear error function
  const clearError = useCallback(() => {
    setParseError(null);
  }, []);

  // Clear parsed content function
  const clearParsedContent = useCallback(() => {
    setParsedContent(null);
    setParseAttempted(false);
  }, []);

  // Determine if retry should be shown
  const shouldShowRetry = !isParsing && !!parseError && !parsedContent;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
