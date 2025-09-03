/**
 * Responsive breakpoint constants
 * Follows RR-206 specifications for proper responsive behavior
 */

export const BREAKPOINTS = {
  // Mobile breakpoint - below this sidebar is collapsed
  MOBILE: 768,
  // Desktop breakpoint - at and above this filter buttons show full text
  DESKTOP: 1024,
} as const;

export const MEDIA_QUERIES = {
  // Mobile: < 768px
  IS_MOBILE: `(max-width: ${BREAKPOINTS.MOBILE - 1}px)`,
  // Tablet: 768px - 1023px
  IS_TABLET: `(min-width: ${BREAKPOINTS.MOBILE}px) and (max-width: ${BREAKPOINTS.DESKTOP - 1}px)`,
  // Desktop: >= 1024px
  IS_DESKTOP: `(min-width: ${BREAKPOINTS.DESKTOP}px)`,
  // Not mobile: >= 768px (sidebar visible)
  NOT_MOBILE: `(min-width: ${BREAKPOINTS.MOBILE}px)`,
  // Compact filters: < 1024px (show icons only)
  COMPACT_FILTERS: `(max-width: ${BREAKPOINTS.DESKTOP - 1}px)`,
} as const;
