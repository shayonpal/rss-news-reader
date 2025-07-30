"use client";

import { useState } from "react";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { useArticleStore } from "@/lib/stores/article-store";
import { cn } from "@/lib/utils";
import { IOSButton } from "@/components/ui/ios-button";
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

  if (variant === "icon") {
    return (
      <ArticleActionButton
        icon={hasSummary ? RotateCcw : Sparkles}
        onPress={handleGenerateSummary}
        size={size}
        active={false}
        label={hasSummary ? "Regenerate summary" : "Generate AI summary"}
        disabled={isLoading}
        loading={isLoading}
        loadingIcon={Loader2}
        className={className}
      />
    );
  }

  return (
    <IOSButton
      onPress={handleGenerateSummary}
      disabled={isLoading}
      variant="default"
      size="sm"
      className={cn(
        "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : hasSummary ? (
        <>
          <RotateCcw className="h-4 w-4" />
          Re-summarize
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Summarize
        </>
      )}
    </IOSButton>
  );
}
