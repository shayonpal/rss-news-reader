import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * RR-180: iOS 26 Liquid Glass Button Components
 *
 * Implementation Requirements:
 * - 48px minimum touch targets (iOS HIG)
 * - Glass effects: blur(16px) saturate(180%)
 * - Spring animation: 300ms cubic-bezier(0.34, 1.56, 0.64, 1)
 * - Active state: scale(0.96)
 * - No tap highlight color
 * - Touch action manipulation
 */

const glassButtonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-[22px] font-medium transition-all duration-300",
    "backdrop-blur-[16px] backdrop-saturate-[180%]",
    "border border-white/10 dark:border-white/5",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.96]",
    "min-h-[48px] min-w-[48px]", // iOS HIG touch target
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-white/35 dark:bg-white/35",
          "text-gray-900 dark:text-white",
          "hover:bg-white/45 dark:hover:bg-white/45",
          "shadow-lg shadow-black/5 dark:shadow-white/5",
          "border border-white/18 dark:border-white/18",
        ].join(" "),
        primary: [
          "bg-blue-500/20 dark:bg-blue-400/20",
          "text-blue-700 dark:text-blue-300",
          "hover:bg-blue-500/25 dark:hover:bg-blue-400/25",
          "shadow-lg shadow-blue-500/10 dark:shadow-blue-400/10",
        ].join(" "),
        secondary: [
          "bg-gray-500/10 dark:bg-gray-400/10",
          "text-gray-700 dark:text-gray-300",
          "hover:bg-gray-500/15 dark:hover:bg-gray-400/15",
          "shadow-lg shadow-gray-500/5 dark:shadow-gray-400/5",
        ].join(" "),
        ghost: [
          "bg-transparent",
          "text-gray-700 dark:text-white",
          "hover:bg-white/35 dark:hover:bg-white/35",
          "border-transparent hover:border-white/18 dark:hover:border-white/18",
        ].join(" "),
        danger: [
          "bg-red-500/20 dark:bg-red-400/20",
          "text-red-700 dark:text-red-300",
          "hover:bg-red-500/25 dark:hover:bg-red-400/25",
          "shadow-lg shadow-red-500/10 dark:shadow-red-400/10",
        ].join(" "),
        // RR-229: New adaptive variants for context-aware styling
        adaptive: [
          "bg-[var(--glass-adaptive-bg)] dark:bg-[var(--glass-adaptive-bg)]",
          "border-[var(--glass-adaptive-border)] dark:border-[var(--glass-adaptive-border)]",
          "backdrop-blur-[24px] backdrop-saturate-[120%]",
          "text-gray-900 dark:text-white",
          "hover:bg-[var(--glass-enhanced-bg)] dark:hover:bg-[var(--glass-enhanced-bg)]",
          "shadow-lg shadow-black/8 dark:shadow-white/8",
        ].join(" "),
        enhanced: [
          "bg-[var(--glass-enhanced-bg)] dark:bg-[var(--glass-enhanced-bg)]",
          "border-[var(--glass-enhanced-border)] dark:border-[var(--glass-enhanced-border)]",
          "backdrop-blur-[20px] backdrop-saturate-[160%]",
          "text-gray-900 dark:text-white",
          "hover:opacity-90",
          "shadow-xl shadow-black/12 dark:shadow-white/12",
        ].join(" "),
        // RR-230: Exact CSS class replication
        "css-toolbar-btn": [
          "appearance-none -webkit-appearance-none -moz-appearance-none",
          "inline-flex items-center justify-center",
          "h-[44px] min-w-[44px] px-3",
          "rounded-full",
          "text-[color:hsl(var(--foreground))]",
          "bg-transparent border-none",
          "transition-[transform,background-color] duration-[160ms] ease-[var(--ease-out)]",
          "hover:bg-[var(--glass-chip-indicator)]",
          "active:scale-[0.98]",
        ].join(" "),
        "css-icon-btn": [
          "appearance-none -webkit-appearance-none -moz-appearance-none",
          "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturation)]",
          "bg-[var(--glass-nav-bg)]",
          "border border-[var(--glass-nav-border)]",
          "w-[48px] h-[48px]",
          "inline-flex items-center justify-center",
          "rounded-full",
          "text-[color:hsl(var(--foreground))]",
          "transition-[transform,background-color] duration-[160ms] ease-[var(--ease-out)]",
          "hover:bg-[var(--glass-nav-bg-scrolled)]",
          "active:scale-[0.96]",
        ].join(" "),
      },
      size: {
        default: "px-4 py-2 text-sm gap-2",
        sm: "px-3 py-1.5 text-xs gap-1.5",
        lg: "px-6 py-3 text-base gap-3",
        icon: "w-[48px] h-[48px] p-0", // Exact 48px for icon-only
        toolbar: "px-3 py-2 text-sm gap-2 min-w-fit", // Optimized for horizontal layout
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Animation timing for glass morphing
const SPRING_TIMING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
  /** Whether to use spring animation on interactions */
  springAnimation?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      springAnimation = true,
      style,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        type={props.type || "button"}
        {...props}
        style={{
          // iOS touch optimizations
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          // Spring animation timing
          transitionTimingFunction: springAnimation ? SPRING_TIMING : undefined,
          // GPU acceleration
          transform: "translateZ(0)",
          willChange: "transform",
          ...style,
        }}
      />
    );
  }
);
GlassButton.displayName = "GlassButton";

export interface GlassIconButtonProps extends Omit<GlassButtonProps, "size"> {
  "aria-label": string; // Required for accessibility
}

/**
 * Icon-only glass button with enforced 48x48px dimensions
 * Requires aria-label for accessibility
 */
const GlassIconButton = React.forwardRef<
  HTMLButtonElement,
  GlassIconButtonProps
>(
  (
    {
      className,
      variant = "css-icon-btn",
      asChild = false,
      springAnimation = true,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <GlassButton
        ref={ref}
        size="icon"
        variant={variant}
        className={cn("flex-shrink-0", className)}
        springAnimation={springAnimation}
        style={style}
        asChild={asChild}
        {...props}
      />
    );
  }
);
GlassIconButton.displayName = "GlassIconButton";

export interface GlassToolbarButtonProps extends GlassButtonProps {
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  /** Whether to hide label on mobile */
  hideOnMobile?: boolean;
}

/**
 * Toolbar-optimized glass button with icon and label support
 * Designed for horizontal layouts with consistent spacing
 */
const GlassToolbarButton = React.forwardRef<
  HTMLButtonElement,
  GlassToolbarButtonProps
>(
  (
    {
      className,
      variant = "css-toolbar-btn",
      size = "toolbar",
      icon,
      iconPosition = "left",
      hideOnMobile = false,
      children,
      springAnimation = true,
      style,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const content = (
      <>
        {icon && iconPosition === "left" && (
          <span className="h-6 w-6 flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        {children && (
          <span className={cn(hideOnMobile && "hidden md:inline")}>
            {children}
          </span>
        )}
        {icon && iconPosition === "right" && (
          <span className="h-6 w-6 flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </>
    );

    if (asChild) {
      return (
        <GlassButton
          ref={ref}
          size={size}
          variant={variant}
          className={className}
          springAnimation={springAnimation}
          style={style}
          asChild
          {...props}
        >
          <Slot>{content}</Slot>
        </GlassButton>
      );
    }

    return (
      <GlassButton
        ref={ref}
        size={size}
        variant={variant}
        className={className}
        springAnimation={springAnimation}
        style={style}
        {...props}
      >
        {content}
      </GlassButton>
    );
  }
);
GlassToolbarButton.displayName = "GlassToolbarButton";

export {
  GlassButton,
  GlassIconButton,
  GlassToolbarButton,
  glassButtonVariants,
};
