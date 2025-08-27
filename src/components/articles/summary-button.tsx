"use client";

import { useState } from "react";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const { generateSummary } = useArticleStore();

  const handleGenerateSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await generateSummary(articleId, hasSummary);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate summary"
      );
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
