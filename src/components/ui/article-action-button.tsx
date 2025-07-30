"use client";

import React from "react";
import { IOSButton } from "./ios-button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type ArticleActionButtonSize = "sm" | "md" | "lg";

interface ArticleActionButtonProps {
  icon: LucideIcon;
  onPress: () => void;
  size?: ArticleActionButtonSize;
  active?: boolean;
  activeClassName?: string;
  label: string;
  title?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingIcon?: LucideIcon;
  className?: string;
}

const sizeClasses: Record<ArticleActionButtonSize, string> = {
  sm: "h-4 w-4", // 16x16 - for article list
  md: "h-5 w-5", // 20x20 - for article detail header
  lg: "h-6 w-6", // 24x24 - for larger contexts if needed
};

/**
 * Standardized action button for article interactions (star, summarize, etc.)
 * Ensures consistent styling across the entire app while allowing size variations
 *
 * @see docs/tech/button-architecture.md for complete button architecture guide
 *
 * This is the standard component for ALL article action buttons.
 * DO NOT create custom button implementations - extend this instead.
 *
 * Usage:
 * 1. For simple actions: Use this component directly
 * 2. For complex actions: Create a specialized wrapper (like StarButton)
 *
 * Sizes:
 * - 'sm' (16x16): Article list view
 * - 'md' (20x20): Article detail header
 * - 'lg' (24x24): Future use if needed
 *
 * @example
 * // Direct usage
 * <ArticleActionButton
 *   icon={Download}
 *   onPress={handleDownload}
 *   size="sm"
 *   label="Download article"
 * />
 *
 * @example
 * // See StarButton for specialized wrapper example
 */
export function ArticleActionButton({
  icon: Icon,
  onPress,
  size = "sm",
  active = false,
  activeClassName,
  label,
  title,
  disabled = false,
  loading = false,
  loadingIcon: LoadingIcon,
  className,
}: ArticleActionButtonProps) {
  const iconSize = sizeClasses[size];
  const DisplayIcon = loading && LoadingIcon ? LoadingIcon : Icon;

  return (
    <IOSButton
      variant="ghost"
      size="icon"
      onPress={onPress}
      disabled={disabled || loading}
      className={cn("rounded p-1 hover:bg-muted", className)}
      aria-label={label}
      title={title || label}
    >
      <DisplayIcon
        className={cn(
          iconSize,
          loading && "animate-spin",
          active && activeClassName
            ? activeClassName
            : active
              ? "text-primary"
              : "text-muted-foreground"
        )}
      />
    </IOSButton>
  );
}
