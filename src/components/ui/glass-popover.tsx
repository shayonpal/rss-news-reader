/**
 * RR-229: GlassPopover Component
 *
 * Consolidates .glass-popover CSS classes and POC implementations into a
 * reusable React component that wraps Radix Popover primitives.
 *
 * Features:
 * - Radix Popover primitive integration with glass styling wrapper
 * - Backdrop filter: blur(16px) saturate(180%)
 * - Focus trap and keyboard navigation
 * - ESC key closes, outside click closes
 * - Screen reader compatibility
 * - Theme-ready architecture for violet rollout
 * - Performance optimized (<3KB bundle, 60fps)
 */

import React from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// CVA variants for glass popover styling
const glassPopoverContentVariants = cva(
  [
    // Base glass popover styles (consolidates .glass-popover CSS)
    "glass-popover",
    "backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturation)]",
    "bg-[var(--glass-nav-bg)] border border-[var(--glass-nav-border)]",
    "rounded-[22px] overflow-hidden",
    "shadow-[0_24px_60px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.12)]",
    // Animation and performance
    "will-change-[transform,opacity] transform-gpu",
    "animate-in fade-in-0 zoom-in-95",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
    "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  ].join(" "),
  {
    variants: {
      theme: {
        default: "",
        "violet-ready": "data-theme-violet-ready",
      },
      size: {
        default: "min-w-[8rem]",
        sm: "min-w-[6rem]",
        lg: "min-w-[12rem]",
      },
    },
    defaultVariants: {
      theme: "default",
      size: "default",
    },
  }
);

export interface GlassPopoverProps {
  /** Trigger element that opens the popover */
  trigger: React.ReactNode;
  /** Content to display inside the popover */
  children: React.ReactNode;
  /** Whether the popover is open (controlled) */
  open?: boolean;
  /** Called when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
  /** Side to align the popover relative to trigger */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment relative to the trigger */
  align?: "start" | "center" | "end";
  /** Offset from the trigger */
  sideOffset?: number;
  /** Alignment offset */
  alignOffset?: number;
  /** Accessible label for the popover content */
  ariaLabel?: string;
  /** Additional class name for the content */
  className?: string;
  /** Theme variant */
  theme?: VariantProps<typeof glassPopoverContentVariants>["theme"];
  /** Size variant */
  size?: VariantProps<typeof glassPopoverContentVariants>["size"];
  /** Enable reduced transparency mode */
  reducedTransparency?: boolean;
  /** Disable portal rendering */
  disablePortal?: boolean;
  /** Whether to show arrow */
  showArrow?: boolean;
  /** Arrow size */
  arrowSize?: number;
}

/**
 * Glass Popover Component
 * Consolidates .glass-popover CSS classes with Radix Popover primitives
 */
export const GlassPopover = React.forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  GlassPopoverProps
>(
  (
    {
      trigger,
      children,
      open,
      onOpenChange,
      defaultOpen,
      side = "bottom",
      align = "center",
      sideOffset = 8,
      alignOffset = 0,
      ariaLabel,
      className,
      theme = "default",
      size = "default",
      reducedTransparency = false,
      disablePortal = false,
      showArrow = false,
      arrowSize = 8,
      ...props
    },
    ref
  ) => {
    const [popoverOpen, setPopoverOpen] = React.useState(false);

    // Use controlled or uncontrolled state
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : popoverOpen;

    const handleOpenChange = React.useCallback(
      (newOpen: boolean) => {
        if (!isControlled) {
          setPopoverOpen(newOpen);
        }
        onOpenChange?.(newOpen);
      },
      [isControlled, onOpenChange]
    );

    // Keyboard handlers for accessibility
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          handleOpenChange(false);
        }
      },
      [isOpen, handleOpenChange]
    );

    const Content = disablePortal
      ? RadixPopover.Content
      : ({ children: portalChildren, ...portalProps }: any) => (
          <RadixPopover.Portal>
            <RadixPopover.Content {...portalProps}>
              {portalChildren}
            </RadixPopover.Content>
          </RadixPopover.Portal>
        );

    return (
      <RadixPopover.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        defaultOpen={defaultOpen}
      >
        <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>

        <Content
          ref={ref}
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          data-theme={theme === "violet-ready" ? "violet-ready" : undefined}
          aria-label={ariaLabel}
          className={cn(
            glassPopoverContentVariants({ theme, size }),
            reducedTransparency && "reduce-transparency",
            className
          )}
          onKeyDown={handleKeyDown}
          style={{
            // Performance optimizations
            willChange: "transform, opacity",
            transform: "translateZ(0)",
            // iOS touch optimizations
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
          {...props}
        >
          {children}

          {showArrow && (
            <RadixPopover.Arrow
              className="fill-[var(--glass-nav-bg)]"
              width={arrowSize}
              height={arrowSize / 2}
            />
          )}
        </Content>
      </RadixPopover.Root>
    );
  }
);

GlassPopover.displayName = "GlassPopover";

export { glassPopoverContentVariants };
