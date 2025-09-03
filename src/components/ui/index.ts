/**
 * RR-231: Component Library Barrel Exports
 * Central export point for all UI components
 *
 * Usage: import { GlassButton, GlassPopover } from '@/components/ui'
 * Legacy deep imports still supported during transition
 */

// Glass Component System
export {
  GlassButton,
  GlassIconButton,
  GlassToolbarButton,
} from "./glass-button";
export type { GlassButtonProps } from "./glass-button";

export { GlassPopover } from "./glass-popover";
export type { GlassPopoverProps } from "./glass-popover";

export { GlassSegmentedControl } from "./glass-segmented-control";
export type { GlassSegmentedControlProps } from "./glass-segmented-control";

// Glass Layout Components - RR-231 Extracted
export { GlassNav } from "./glass-nav";
export type { GlassNavProps } from "./glass-nav";

export { GlassFooter } from "./glass-footer";
export type { GlassFooterProps } from "./glass-footer";

// RR-231 Essential Missing Components
export { GlassInput } from "./glass-input";
export type { GlassInputProps } from "./glass-input";

export { GlassCard } from "./glass-card";
export type { GlassCardProps } from "./glass-card";

export { GlassTooltip } from "./glass-tooltip";
export type { GlassTooltipProps } from "./glass-tooltip";

// Standard UI Components
export { Button } from "./button";
export { IOSButton } from "./ios-button";
export { Progress } from "./progress";
export { Avatar } from "./avatar";
export { Badge } from "./badge";
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
export { ThemeToggle } from "./theme-toggle";

// Complex UI Components
export { MorphingDropdown } from "./morphing-dropdown";
export { MorphingNavButton } from "./morphing-nav-button";
export { ArticleActionButton } from "./article-action-button";
export { ScrollHideFloatingElement } from "./scroll-hide-floating-element";
export { CollapsibleFilterSection } from "./collapsible-filter-section";
