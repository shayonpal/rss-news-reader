import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * RR-231: GlassInput Component
 * Form input with glass styling using semantic tokens
 * Essential component for violet theme rollout (RR-233)
 */

const glassInputVariants = cva(
  [
    // Base input styles
    "flex h-12 w-full rounded-[22px] px-4 py-2",
    "text-sm text-[color:hsl(var(--foreground))]",
    "placeholder:text-[color:hsl(var(--muted-foreground))]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "transition-all duration-200",
    // Glass effect base
    "backdrop-blur-[var(--glass-blur-base)] backdrop-saturate-[var(--glass-saturation-base)]",
    "bg-[var(--color-surface-glass-subtle)]",
    "border border-[var(--color-border-glass)]",
  ],
  {
    variants: {
      variant: {
        default: "",
        ghost: [
          "border-transparent bg-transparent",
          "focus-visible:bg-[var(--color-surface-glass-subtle)]",
          "focus-visible:border-[var(--color-border-glass)]",
        ],
        enhanced: [
          "bg-[var(--color-surface-glass)]",
          "border-[var(--color-border-glass-enhanced)]",
          "shadow-lg shadow-black/5 dark:shadow-white/5",
        ],
      },
      size: {
        sm: "h-10 px-3 text-xs rounded-[18px]",
        default: "h-12 px-4 text-sm rounded-[22px]",
        lg: "h-14 px-6 text-base rounded-[28px]",
      },
      state: {
        default: "",
        error: [
          "border-red-500/50 bg-red-500/10",
          "focus-visible:ring-red-500 dark:focus-visible:ring-red-400",
        ],
        success: [
          "border-green-500/50 bg-green-500/10",
          "focus-visible:ring-green-500 dark:focus-visible:ring-green-400",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      state: "default",
    },
  }
);

export interface GlassInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof glassInputVariants> {}

const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, variant, size, state, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(glassInputVariants({ variant, size, state }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

GlassInput.displayName = "GlassInput";

export { GlassInput, glassInputVariants };
