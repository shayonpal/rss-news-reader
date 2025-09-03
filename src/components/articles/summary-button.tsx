"use client";

import { useState } from "react";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useArticleStore } from "@/lib/stores/article-store";
import {
  ArticleActionButton,
  type ArticleActionButtonSize,
} from "@/components/ui/article-action-button";

interface SummaryButtonProps {
  articleId: string;
  hasSummary: boolean;
  variant?: "icon" | "full";
  size?: ArticleActionButtonSize;
  className?: string;
  onSuccess?: () => void;
}

export function SummaryButton({
  articleId,
  hasSummary,
  variant = "full",
  size = "sm",
  className,
  onSuccess,
}: SummaryButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { generateSummary } = useArticleStore();

  const handleGenerateSummary = async () => {
    setIsLoading(true);

    try {
      await generateSummary(articleId, hasSummary);
      onSuccess?.();
    } catch (err) {
      // Don't show error toast for user cancellations (AbortError)
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Summary generation cancelled by user");
        setIsLoading(false);
        return;
      }

      // Determine error message based on error type
      let errorMessage = "Summary failed. Please try again.";
      const isResummarize = hasSummary;

      // Check for offline state first
      if (!navigator.onLine) {
        errorMessage = "You're offline. Please reconnect and try again.";
      } else if (err instanceof Error) {
        // Handle specific error types with context-aware messaging
        const error = err as any; // Type assertion for extended error properties

        if (error.status === 429 || error.code === "RATE_LIMIT") {
          errorMessage =
            "Too many requests. Please wait a moment and try again.";
        } else if (error.status === 401 || error.code === "TOKEN_EXPIRED") {
          errorMessage = "Session expired. Please refresh the page.";
        } else if (error.status === 413 || error.code === "PAYLOAD_TOO_LARGE") {
          errorMessage = "Article too long to summarize.";
        } else if (error.status === 422 || error.code === "CONTENT_INVALID") {
          errorMessage =
            "Article content couldn't be processed. Please try a different article.";
        } else if (error.status >= 500) {
          errorMessage = isResummarize
            ? "Re-summarize failed. Please try again."
            : "Summary failed. Please try again.";
        } else {
          // Use the error message if it's meaningful, otherwise default
          errorMessage = isResummarize
            ? `Re-summarize failed: ${err.message}`
            : `Summary failed: ${err.message}`;
        }
      }

      // Show error toast with retry action
      toast.error(errorMessage, {
        id: `summary-${articleId}`,
        duration: 4000,
        action: {
          label: "Retry",
          onClick: () => {
            handleGenerateSummary();
          },
        },
      });

      console.error("Summary generation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Always use ArticleActionButton for all variants
  return (
    <ArticleActionButton
      icon={hasSummary ? RotateCcw : Sparkles}
      onPress={handleGenerateSummary}
      size={size}
      active={false}
      label={hasSummary ? "Re-summarize" : "Summarize"}
      disabled={isLoading}
      loading={isLoading}
      loadingIcon={Loader2}
      className={className}
      showLabel={variant === "full"}
    />
  );
}
