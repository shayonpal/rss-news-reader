import React from "react";
import { GlassPopover, type GlassPopoverProps } from "./glass-popover";
import { cn } from "@/lib/utils";

/**
 * RR-231: GlassTooltip Component
 * Thin wrapper around GlassPopover for tooltip use cases
 * Provides hover/focus triggers and proper positioning
 */

export interface GlassTooltipProps
  extends Omit<GlassPopoverProps, "trigger" | "children"> {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
  skipDelayDuration?: number;
}

const GlassTooltip = React.forwardRef<
  React.ElementRef<typeof GlassPopover>,
  GlassTooltipProps
>(
  (
    {
      content,
      children,
      placement = "top",
      delayDuration = 700,
      skipDelayDuration = 300,
      side,
      className,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [hoverTimeout, setHoverTimeout] =
      React.useState<NodeJS.Timeout | null>(null);
    const [skipTimeout, setSkipTimeout] = React.useState<NodeJS.Timeout | null>(
      null
    );

    const handleMouseEnter = () => {
      // Clear any existing skip timeout
      if (skipTimeout) {
        clearTimeout(skipTimeout);
        setSkipTimeout(null);
      }

      // Set hover timeout for delay
      const timeout = setTimeout(() => {
        setOpen(true);
      }, delayDuration);
      setHoverTimeout(timeout);
    };

    const handleMouseLeave = () => {
      // Clear hover timeout if still pending
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        setHoverTimeout(null);
      }

      // Close tooltip and set skip timeout
      setOpen(false);
      const timeout = setTimeout(() => {
        // Skip delay expired - future hovers will use full delayDuration
        setSkipTimeout(null);
      }, skipDelayDuration);
      setSkipTimeout(timeout);
    };

    const handleFocus = () => {
      setOpen(true);
    };

    const handleBlur = () => {
      setOpen(false);
    };

    // Clean up timeouts on unmount
    React.useEffect(() => {
      return () => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        if (skipTimeout) clearTimeout(skipTimeout);
      };
    }, [hoverTimeout, skipTimeout]);

    return (
      <GlassPopover
        ref={ref}
        open={open}
        onOpenChange={setOpen}
        side={side || placement}
        trigger={
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="inline-flex"
          >
            {children}
          </div>
        }
        className={cn(
          // Tooltip-specific styling
          "z-50 max-w-xs px-3 py-2 text-xs",
          "animate-in fade-in-0 zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        <div className="text-center">{content}</div>
      </GlassPopover>
    );
  }
);

GlassTooltip.displayName = "GlassTooltip";

export { GlassTooltip };
