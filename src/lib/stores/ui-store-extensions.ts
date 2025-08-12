/**
 * UI Store Extensions for RR-146
 *
 * This file contains type definitions for the UI store extensions
 * required by the collapsible filter sections feature.
 * These will be integrated into the main UI store during implementation.
 */

export interface FilterSectionState {
  isCollapsed: boolean;
}

export interface FilterSections {
  feeds: FilterSectionState;
  folders: FilterSectionState;
  tags: FilterSectionState;
  [key: string]: FilterSectionState; // Allow dynamic sections
}

export interface UIStoreFilterExtensions {
  // State
  filterSections: FilterSections;

  // Actions
  toggleFilterSection: (section: string) => void;
  setFilterSectionCollapsed: (section: string, collapsed: boolean) => void;
  expandAllFilterSections: () => void;
  collapseAllFilterSections: () => void;
  resetFilterSections: () => void;
  setFilterSectionMetadata?: (section: string, metadata: any) => void;
}

// Default state for filter sections
export const defaultFilterSections: FilterSections = {
  feeds: { isCollapsed: false }, // Feeds expanded by default
  folders: { isCollapsed: true }, // Folders collapsed by default
  tags: { isCollapsed: true }, // Tags collapsed by default
};
