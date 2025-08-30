/**
 * Utility functions for filter URL construction and state management
 * Used for consistent filter state preservation across components
 */

export interface FilterState {
  feedId?: string | null;
  tagId?: string | null;
}

// Debounce utility for router updates
let routerUpdateTimeout: NodeJS.Timeout | null = null;

/**
 * Debounced router replace to prevent excessive calls
 */
export function debouncedRouterReplace(
  router: { replace: (url: any, options?: any) => void },
  url: string,
  options: any = { scroll: false },
  delay: number = 300
): void {
  if (routerUpdateTimeout) {
    clearTimeout(routerUpdateTimeout);
  }

  routerUpdateTimeout = setTimeout(() => {
    router.replace(url as any, options);
  }, delay);
}

/**
 * Session storage keys for filter state persistence
 */
export const FILTER_STORAGE_KEYS = {
  FEED: "articleListFilter",
  TAG: "articleListTagFilter",
} as const;

/**
 * Validates URL parameters to prevent XSS and ensure they're valid IDs
 */
export function validateFilterParam(param: string | null): string | null {
  if (!param) return null;

  try {
    // First decode URL-encoded characters to handle %20, %2B, etc.
    const decoded = decodeURIComponent(param);

    // Use strict allowlist approach for maximum security
    // Only allow: alphanumeric, hyphens, underscores, dots, colons
    // This prevents injection while supporting legitimate feed/tag IDs
    const sanitized = decoded.replace(/[^a-zA-Z0-9\-_.:]/g, "");

    // Trim and check length
    const trimmed = sanitized.trim();
    return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
  } catch (error) {
    // If decoding fails, fall back to strict validation
    console.warn("Failed to decode URL parameter:", param, error);
    const sanitized = param.replace(/[^a-zA-Z0-9\-_.:]/g, "");
    return sanitized.length > 0 && sanitized.length <= 100 ? sanitized : null;
  }
}

/**
 * Constructs a URL with filter parameters
 */
export function buildFilterUrl(filterState: FilterState): string {
  const params = new URLSearchParams();

  if (filterState.feedId && filterState.feedId !== "null") {
    params.set("feed", filterState.feedId);
  }

  if (filterState.tagId && filterState.tagId !== "null") {
    params.set("tag", filterState.tagId);
  }

  const queryString = params.toString();
  return queryString ? `/?${queryString}` : "/";
}

/**
 * Saves filter state to sessionStorage
 */
export function saveFilterState(filterState: FilterState): void {
  try {
    sessionStorage.setItem(
      FILTER_STORAGE_KEYS.FEED,
      filterState.feedId || "null"
    );
    sessionStorage.setItem(
      FILTER_STORAGE_KEYS.TAG,
      filterState.tagId || "null"
    );
  } catch (error) {
    console.warn("Failed to save filter state to sessionStorage:", error);
  }
}

/**
 * Loads filter state from sessionStorage
 */
export function loadFilterState(): FilterState {
  try {
    const savedFeedFilter = sessionStorage.getItem(FILTER_STORAGE_KEYS.FEED);
    const savedTagFilter = sessionStorage.getItem(FILTER_STORAGE_KEYS.TAG);

    return {
      feedId:
        savedFeedFilter === "null"
          ? null
          : validateFilterParam(savedFeedFilter),
      tagId:
        savedTagFilter === "null" ? null : validateFilterParam(savedTagFilter),
    };
  } catch (error) {
    console.warn("Failed to load filter state from sessionStorage:", error);
    return { feedId: null, tagId: null };
  }
}

/**
 * Reads filter state from URL search parameters
 */
export function readFilterStateFromUrl(
  searchParams: URLSearchParams
): FilterState {
  return {
    feedId: validateFilterParam(searchParams.get("feed")),
    tagId: validateFilterParam(searchParams.get("tag")),
  };
}

/**
 * Reads filter state from current browser URL
 */
export function readFilterStateFromCurrentUrl(): FilterState {
  try {
    const currentUrl = new URL(window.location.href);
    return readFilterStateFromUrl(currentUrl.searchParams);
  } catch (error) {
    console.warn("Failed to read filter state from current URL:", error);
    return { feedId: null, tagId: null };
  }
}
