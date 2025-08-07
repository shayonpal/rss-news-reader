"use client";

import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { IOSButton } from "@/components/ui/ios-button";
import { cn } from "@/lib/utils";

interface ContentParsingIndicatorProps {
  isParsing: boolean;
  error?: string | null;
  onRetry?: () => void;
  showRetry?: boolean;
  className?: string;
}

export function ContentParsingIndicator({
  isParsing,
  error,
  onRetry,
  showRetry = false,
  className,
}: ContentParsingIndicatorProps) {
  if (!isParsing && !error) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-8 px-4",
        "bg-gradient-to-b from-gray-50/50 to-gray-100/50",
        "dark:from-gray-900/50 dark:to-gray-800/50",
        "rounded-lg border border-gray-200 dark:border-gray-700",
        className
      )}
    >
      {isParsing ? (
        <>
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <div className="absolute inset-0 blur-xl bg-blue-500/20 animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Loading full article
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Extracting content from the original source...
            </p>
          </div>
        </>
      ) : error ? (
        <>
          <div className="relative">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <div className="absolute inset-0 blur-xl bg-amber-500/10" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Could not load full content
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
              {error}
            </p>
            {showRetry && onRetry && (
              <IOSButton
                onPress={onRetry}
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Try Again
              </IOSButton>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// Inline loading skeleton for seamless content replacement
export function ContentLoadingSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 animate-pulse", className)}>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      <div className="space-y-3 mt-6">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
      <div className="space-y-3 mt-6">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      </div>
    </div>
  );
}

// Minimal inline indicator for non-intrusive loading
export function InlineParsingIndicator({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5",
        "bg-blue-50 dark:bg-blue-950/30",
        "text-blue-600 dark:text-blue-400",
        "rounded-full text-xs font-medium",
        "border border-blue-200 dark:border-blue-800",
        className
      )}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Loading full content...</span>
    </div>
  );
}