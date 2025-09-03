import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * RR-231: GlassCard Component
 * Container with glass effect and elevation tokens
 * Essential for showcasing surface/elevation tokens in violet theme (RR-233)
 */

const glassCardVariants = cva(
  [
    // Base card styles with glass effect
    "rounded-[22px] p-6",
    "backdrop-blur-[var(--glass-blur-base)] backdrop-saturate-[var(--glass-saturation-base)]",
    "bg-[var(--color-surface-glass-subtle)]",
    "border border-[var(--color-border-glass)]",
    "transition-all duration-300",
  ],
  {
    variants: {
      elevation: {
        none: "shadow-none",
        low: ["shadow-lg shadow-black/5 dark:shadow-white/5"],
        medium: [
          "shadow-xl shadow-black/8 dark:shadow-white/8",
          "bg-[var(--color-surface-glass)]",
        ],
        high: [
          "shadow-2xl shadow-black/12 dark:shadow-white/12",
          "bg-[var(--color-surface-glass)]",
          "border-[var(--color-border-glass-enhanced)]",
        ],
      },
      variant: {
        default: "",
        enhanced: [
          "bg-[var(--color-surface-glass)]",
          "border-[var(--color-border-glass-enhanced)]",
        ],
        subtle: [
          "bg-[var(--color-surface-glass-subtle)]",
          "border-[var(--color-border-glass)]",
        ],
        ghost: [
          "bg-transparent border-transparent",
          "backdrop-blur-none backdrop-saturate-none",
        ],
      },
      size: {
        sm: "p-4 rounded-[18px]",
        default: "p-6 rounded-[22px]",
        lg: "p-8 rounded-[28px]",
      },
    },
    defaultVariants: {
      elevation: "low",
      variant: "default",
      size: "default",
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  as?: "div" | "section" | "article";
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    { className, elevation, variant, size, as: Component = "div", ...props },
    ref
  ) => {
    return (
      <Component
        className={cn(
          glassCardVariants({ elevation, variant, size }),
          className
        )}
        ref={ref as any}
        {...props}
      />
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard, glassCardVariants };
