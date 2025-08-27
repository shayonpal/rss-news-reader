import React from "react";
import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  value: number;
  variant?: "sync" | "skeleton" | "indeterminate";
  className?: string;
  ariaLabel?: string; // Optional custom aria-label for better accessibility
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  variant = "sync",
  className,
  ariaLabel,
}) => {
  // Clamp value between 0 and 100, handle NaN
  const clampedValue = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));
  const scaleFactor = clampedValue / 100;

  // For indeterminate, ignore value
  const isIndeterminate = variant === "indeterminate";

  const baseClasses = cn(
    "progress-bar",
    "h-2",
    "w-full",
    "relative",
    "overflow-hidden",
    "rounded-full",
    "bg-[var(--progress-bg,theme(colors.muted))]",
    "will-change-transform",
    "transform-gpu",
    "backface-visibility-hidden",
    "theme-violet-compatible",
    variant === "sync" && "progress-sync",
    variant === "skeleton" && "progress-skeleton",
    variant === "indeterminate" && "progress-indeterminate",
    className
  );

  const indicatorClasses = cn(
    "absolute",
    "top-0",
    "left-0",
    "h-full",
    "origin-left",
    "rounded-full",
    "bg-[var(--progress-text,theme(colors.primary))]",
    "will-change-transform",
    "transform-gpu",
    "backface-visibility-hidden",
    variant === "sync" && "transition-transform duration-300 ease-out",
    variant === "skeleton" &&
      "bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-shimmer",
    variant === "indeterminate" &&
      "animate-indeterminate duration-1500 ease-in-out infinite w-1/3"
  );

  // Performance: Use transform: scaleX and translateZ for GPU acceleration
  const indicatorStyle: React.CSSProperties = {
    transform: isIndeterminate
      ? "translateZ(0)" // GPU layer promotion only for indeterminate
      : `scaleX(${scaleFactor}) translateZ(0)`, // Scale + GPU promotion for determinate
    transformOrigin: "left center",
    ...(variant === "skeleton" && {
      background:
        "linear-gradient(90deg, var(--progress-bg) 0%, var(--progress-text) 50%, var(--progress-bg) 100%)",
      animation: "shimmer 1.5s ease-in-out infinite",
    }),
  };

  // ARIA attributes with improved accessibility
  const getAriaValueText = () => {
    if (isIndeterminate) {
      return ariaLabel || "Loading, please wait...";
    }
    if (variant === "skeleton") {
      return ariaLabel || "Loading content...";
    }
    if (variant === "sync") {
      return ariaLabel || `Sync progress: ${clampedValue}% complete`;
    }
    return `${clampedValue}% complete`;
  };

  const ariaProps = isIndeterminate
    ? {
        "aria-valuetext": getAriaValueText(),
        // Don't include aria-valuenow for indeterminate
      }
    : {
        "aria-valuenow": clampedValue,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuetext": getAriaValueText(),
      };

  // Low memory detection for reduced animation complexity
  const isLowMemory =
    typeof navigator !== "undefined" &&
    "deviceMemory" in navigator &&
    (navigator as any).deviceMemory <= 0.5;

  const finalClasses = cn(
    baseClasses,
    isLowMemory && "low-memory-mode",
    variant === "sync" && clampedValue === 100 && "sync-complete"
  );

  return (
    <div
      role="progressbar"
      className={finalClasses}
      {...ariaProps}
      aria-label={ariaLabel}
    >
      <div className={indicatorClasses} style={indicatorStyle} />
    </div>
  );
};

export default ProgressBar;
