import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * RR-231: GlassNav Component
 * Extracted from @layer components .glass-nav CSS class
 * Provides translucent navigation background with glass effect
 */

const glassNavVariants = cva(
  [
    // Base glass nav styles extracted from CSS
    "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturation)]",
    "bg-[var(--glass-nav-bg)]",
    "border-b border-[var(--glass-nav-border)]",
    "transition-all duration-200",
    "will-change-transform",
  ],
  {
    variants: {
      variant: {
        default: "",
        scrolled:
          "bg-[var(--glass-nav-bg-scrolled)] shadow-[0_3px_12px_rgba(0,0,0,0.08)]",
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

export interface GlassNavProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof glassNavVariants> {
  as?: "nav" | "header" | "div";
  isScrolled?: boolean;
}

const GlassNav = React.forwardRef<HTMLElement, GlassNavProps>(
  (
    {
      className,
      variant,
      position,
      as: Component = "nav",
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
          glassNavVariants({ variant: effectiveVariant, position }),
          className
        )}
        ref={ref as any}
        {...props}
      />
    );
  }
);

GlassNav.displayName = "GlassNav";

export { GlassNav, glassNavVariants };
