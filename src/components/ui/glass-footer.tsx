import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * RR-231: GlassFooter Component
 * Extracted from @layer components .glass-footer CSS class
 * Provides bottom glass toolbar with translucent background
 */

const glassFooterVariants = cva(
  [
    // Base glass footer styles extracted from CSS
    "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[140%]",
    "bg-[var(--glass-nav-bg)]",
    "border-t border-[var(--glass-nav-border)]",
    "transition-all duration-200",
  ],
  {
    variants: {
      variant: {
        default: "",
        scrolled:
          "bg-[var(--glass-nav-bg-scrolled)] shadow-[0_-3px_12px_rgba(0,0,0,0.08)]",
      },
      position: {
        fixed: "fixed",
        sticky: "sticky",
        relative: "relative",
      },
    },
    defaultVariants: {
      variant: "default",
      position: "fixed",
    },
  }
);

export interface GlassFooterProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof glassFooterVariants> {
  as?: "footer" | "div";
  isScrolled?: boolean;
}

const GlassFooter = React.forwardRef<HTMLElement, GlassFooterProps>(
  (
    {
      className,
      variant,
      position,
      as: Component = "footer",
      isScrolled = false,
      ...props
    },
    ref
  ) => {
    // Use scrolled variant when isScrolled is true
    const effectiveVariant = isScrolled ? "scrolled" : variant;

    return (
      <Component
        className={cn(
          glassFooterVariants({ variant: effectiveVariant, position }),
          className
        )}
        ref={ref as any}
        {...props}
      />
    );
  }
);

GlassFooter.displayName = "GlassFooter";

export { GlassFooter, glassFooterVariants };
