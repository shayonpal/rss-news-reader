import * as React from "react";
import { cn } from "@/lib/utils";
import { GlassIconButton } from "./glass-button";

/**
 * RR-180: iOS 26 Liquid Glass Morphing Dropdown
 *
 * Implementation Requirements:
 * - Inline morphing container expansion (not separate popover)
 * - Layered animation: toolbar buttons fade out, dropdown content fades in
 * - 300ms spring easing: cubic-bezier(0.34, 1.56, 0.64, 1)
 * - Glass effects: blur(16px) saturate(180%)
 * - Dynamic width calculation based on content
 * - ESC key and outside click closing
 * - Spatial continuity within single glass container
 */

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  /** Show checkbox indicator for toggleable items */
  checked?: boolean;
  /** Add separator after this item */
  separator?: boolean;
}

export interface MorphingDropdownProps {
  /** Toolbar elements to show in collapsed state */
  toolbarElements: React.ReactNode[];
  /** Dropdown items to show in expanded state */
  items: DropdownItem[];
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Additional className for container */
  className?: string;
  /** Animation mode */
  animationMode?: "sequential" | "simultaneous";
  /** Easing function */
  easingMode?: "smooth" | "spring";
  /** Expanded width (auto-calculated if not provided) */
  expandedWidth?: number;
}

const SPRING_TIMING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function MorphingDropdown({
  toolbarElements,
  items,
  open: controlledOpen,
  onOpenChange,
  className,
  animationMode = "sequential",
  easingMode = "spring",
  expandedWidth,
}: MorphingDropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const [calculatedExpandedWidth, setCalculatedExpandedWidth] =
    React.useState<number>(160);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  // Track dark mode in state to avoid hydration mismatch
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    // Check dark mode after hydration
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen);
      } else {
        setUncontrolledOpen(newOpen);
      }
    },
    [isControlled, onOpenChange]
  );

  // Measure container dimensions for smooth animation
  React.useEffect(() => {
    if (!containerRef.current) return;

    // Measure collapsed width
    if (!isOpen && toolbarRef.current) {
      const width = toolbarRef.current.offsetWidth;
      setContainerWidth(width);
    }

    // Calculate expanded width if not provided - keep it simple and fixed for now
    if (!expandedWidth) {
      setCalculatedExpandedWidth(200);
    }
  }, [items, isOpen, expandedWidth]);

  // Handle ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = items[focusedIndex];
        if (item && !item.disabled) {
          item.onClick();
          setOpen(false);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, items, focusedIndex, setOpen]);

  // Handle outside clicks
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    // Delay to avoid closing immediately on open
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setOpen]);

  // Focus management
  React.useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
      return;
    }

    // Focus first item when opening
    const firstEnabledIndex = items.findIndex((item) => !item.disabled);
    if (firstEnabledIndex !== -1) {
      setFocusedIndex(firstEnabledIndex);
    }
  }, [isOpen, items]);

  const getEasingFunction = () => {
    return easingMode === "spring"
      ? SPRING_TIMING
      : "cubic-bezier(0.4, 0, 0.2, 1)";
  };

  const getAnimationDuration = () => {
    return animationMode === "sequential" ? "400ms" : "300ms";
  };

  const finalExpandedWidth = expandedWidth || calculatedExpandedWidth;

  // Add more button to toolbar elements
  const extendedToolbarElements = React.useMemo(() => {
    const moreButton = (
      <GlassIconButton
        key="more-button"
        variant="ghost"
        aria-label="More options"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className="flex-shrink-0"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </GlassIconButton>
    );

    return [...toolbarElements, moreButton];
  }, [toolbarElements, isOpen, setOpen]);

  const reducedMotion = React.useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "pointer-events-auto relative z-20 overflow-hidden",
        className
      )}
      style={{
        // Enhanced glass effect matching POC exactly
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        background: isDark
          ? "rgba(10, 10, 10, 0.18)"
          : "rgba(255, 255, 255, 0.18)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.04)",
        boxShadow: isDark
          ? "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)"
          : "0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
        borderRadius: "22px",
        width: isOpen ? "200px" : "auto",
        minHeight: "48px",
        padding: isOpen ? "8px" : "2px",
        transformOrigin: "top center",
        transition: reducedMotion
          ? "none"
          : `width ${getAnimationDuration()} ${getEasingFunction()}, padding ${getAnimationDuration()} ${getEasingFunction()}`,
        transform: "translateZ(0)",
        willChange: "width, padding",
      }}
      data-morphing-dropdown
      data-state={isOpen ? "open" : "closed"}
    >
      <div style={{ position: "relative", minHeight: "44px" }}>
        {/* Toolbar elements layer */}
        <div
          ref={toolbarRef}
          style={{
            position: isOpen ? "absolute" : "static",
            top: 0,
            left: 0,
            right: 0,
            opacity: isOpen ? 0 : 1,
            transform: isOpen
              ? animationMode === "sequential"
                ? "translateX(-20px)"
                : "scale(0.95)"
              : "translateX(0) scale(1)",
            transition:
              animationMode === "sequential"
                ? `opacity 150ms ${getEasingFunction()}, transform 150ms ${getEasingFunction()}`
                : `opacity ${getAnimationDuration()} ${getEasingFunction()}, transform ${getAnimationDuration()} ${getEasingFunction()}`,
            pointerEvents: isOpen ? "none" : "auto",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            willChange: "opacity, transform",
          }}
        >
          {extendedToolbarElements}
        </div>

        {/* Dropdown content layer */}
        <div
          ref={dropdownRef}
          role="menu"
          aria-orientation="vertical"
          style={{
            position: isOpen ? "static" : "absolute",
            top: 0,
            left: 0,
            right: 0,
            opacity: isOpen ? 1 : 0,
            transform: isOpen
              ? "translateY(0) scale(1)"
              : "translateY(-10px) scale(0.95)",
            transformOrigin: "top center",
            transition:
              animationMode === "sequential"
                ? `opacity 200ms ${getEasingFunction()} ${isOpen ? "150ms" : "0ms"}, transform 200ms ${getEasingFunction()} ${isOpen ? "150ms" : "0ms"}`
                : `opacity ${getAnimationDuration()} ${getEasingFunction()}, transform ${getAnimationDuration()} ${getEasingFunction()}`,
            pointerEvents: isOpen ? "auto" : "none",
            display: "flex",
            flexDirection: "column",
            padding: "0",
            willChange: "opacity, transform",
          }}
        >
          <div className="space-y-1">
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                <button
                  role="menuitem"
                  tabIndex={-1}
                  disabled={item.disabled}
                  data-focused={focusedIndex === index}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick();
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[14px] px-3 py-3",
                    "duration-160 text-left text-sm transition-all",
                    "min-h-[44px]", // iOS touch target
                    "text-gray-900 dark:text-gray-100",
                    item.disabled && "cursor-not-allowed opacity-50",
                    !item.disabled && "active:scale-[0.98]",
                    item.className
                  )}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                    background:
                      focusedIndex === index
                        ? isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.04)"
                        : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.background = isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.disabled && focusedIndex !== index) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {item.checked !== undefined && (
                    <span className="mr-1 text-base" aria-hidden="true">
                      {item.checked ? "☑" : "☐"}
                    </span>
                  )}
                  {item.icon && (
                    <span className="h-5 w-5 flex-shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1">{item.label}</span>
                </button>
                {item.separator && (
                  <div
                    className="my-1 h-px bg-gray-200/50 dark:bg-gray-700/50"
                    role="separator"
                    aria-orientation="horizontal"
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Convenience component for article action dropdowns
 * Pre-configured with glass styling and common actions
 */
export function ArticleActionsDropdown({
  onAISummary,
  onShare,
  onOpenOriginal,
  onTogglePartialFeed,
  isPartialFeed = false,
  className,
  toolbarElements = [],
  ...props
}: {
  onAISummary: () => void;
  onShare: () => void;
  onOpenOriginal: () => void;
  onTogglePartialFeed?: () => void;
  isPartialFeed?: boolean;
  className?: string;
  toolbarElements?: React.ReactNode[];
} & Omit<MorphingDropdownProps, "toolbarElements" | "items">) {
  const items: DropdownItem[] = [
    ...(onTogglePartialFeed
      ? [
          {
            id: "partial-feed",
            label: "Partial Feed",
            checked: isPartialFeed,
            onClick: onTogglePartialFeed,
            separator: true,
          },
        ]
      : []),
    {
      id: "share",
      label: "Share",
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-2.684-4.684m2.684 4.684a3 3 0 00-2.684-4.684M3 12a3 3 0 102.684-4.684M3 12a3 3 0 002.684 4.684"
          />
        </svg>
      ),
      onClick: onShare,
    },
    {
      id: "open-original",
      label: "Open Original",
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      ),
      onClick: onOpenOriginal,
    },
  ];

  return (
    <MorphingDropdown
      toolbarElements={toolbarElements}
      items={items}
      className={className}
      {...props}
    />
  );
}
