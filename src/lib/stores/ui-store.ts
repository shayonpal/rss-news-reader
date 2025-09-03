import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface UIState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Navigation
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Collapsible Sections (session-only, not persisted)
  feedsSectionCollapsed: boolean;
  setFeedsSectionCollapsed: (collapsed: boolean) => void;
  toggleFeedsSection: () => void;
  tagsSectionCollapsed: boolean;
  setTagsSectionCollapsed: (collapsed: boolean) => void;
  toggleTagsSection: () => void;

  // RR-193: Mutex accordion state (session-only, not persisted)
  mutexSection: "feeds" | "tags" | null;
  setMutexSection: (section: "feeds" | "tags" | null) => void;
  resetMutexState: () => void;

  // Article View
  isArticleOpen: boolean;
  selectedArticleId: string | null;
  setSelectedArticle: (id: string | null) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Toast/notification state
  notification: {
    message: string;
    type: "success" | "error" | "info";
    visible: boolean;
  } | null;
  showNotification: (
    message: string,
    type: "success" | "error" | "info"
  ) => void;
  hideNotification: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: "system",
      setTheme: (theme) => set({ theme }),

      // Navigation
      isSidebarOpen: false,
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      // Collapsible Sections (session-only, not persisted)
      // RR-193: Updated default state - Feeds closed, Topics open
      feedsSectionCollapsed: true, // Changed from false - Feeds closed by default
      setFeedsSectionCollapsed: (collapsed) =>
        set((state) => {
          const newCollapsed = Boolean(collapsed);
          return {
            feedsSectionCollapsed: newCollapsed,
            // RR-193: Mutex logic for direct setter - if opening feeds, close topics
            tagsSectionCollapsed: newCollapsed
              ? state.tagsSectionCollapsed
              : true,
            mutexSection: newCollapsed
              ? state.tagsSectionCollapsed
                ? null
                : "tags"
              : "feeds",
          };
        }),
      tagsSectionCollapsed: false, // Topics open by default (unchanged)
      setTagsSectionCollapsed: (collapsed) =>
        set((state) => {
          const newCollapsed = Boolean(collapsed);
          return {
            tagsSectionCollapsed: newCollapsed,
            // RR-193: Mutex logic for direct setter - if opening topics, close feeds
            feedsSectionCollapsed: newCollapsed
              ? state.feedsSectionCollapsed
              : true,
            mutexSection: newCollapsed
              ? state.feedsSectionCollapsed
                ? null
                : "feeds"
              : "tags",
          };
        }),

      // RR-193: Mutex accordion (session-only, not persisted)
      mutexSection: "tags", // Default: Topics open
      setMutexSection: (section) => set({ mutexSection: section }),
      resetMutexState: () =>
        set({
          mutexSection: "tags", // Default state
          feedsSectionCollapsed: true, // Feeds closed by default
          tagsSectionCollapsed: false, // Topics open by default
        }),

      // RR-193: Update existing toggle methods to implement mutex behavior
      toggleFeedsSection: () =>
        set((state) => {
          const newCollapsed = !state.feedsSectionCollapsed;
          return {
            feedsSectionCollapsed: newCollapsed,
            // Mutex logic: if opening feeds, close topics
            tagsSectionCollapsed: newCollapsed
              ? state.tagsSectionCollapsed
              : true,
            mutexSection: newCollapsed ? null : "feeds",
          };
        }),

      toggleTagsSection: () =>
        set((state) => {
          const newCollapsed = !state.tagsSectionCollapsed;
          return {
            tagsSectionCollapsed: newCollapsed,
            // Mutex logic: if opening topics, close feeds
            feedsSectionCollapsed: newCollapsed
              ? state.feedsSectionCollapsed
              : true,
            mutexSection: newCollapsed ? null : "tags",
          };
        }),

      // Article View
      isArticleOpen: false,
      selectedArticleId: null,
      setSelectedArticle: (id) =>
        set({
          selectedArticleId: id,
          isArticleOpen: id !== null,
        }),

      // Loading states
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),

      // Notifications
      notification: null,
      showNotification: (message, type) =>
        set({
          notification: { message, type, visible: true },
        }),
      hideNotification: () => set({ notification: null }),
    }),
    {
      name: "ui-store",
      partialize: (state) => ({
        theme: state.theme,
        // Don't persist temporary UI state like sidebar open/loading
        // RR-193: Don't persist accordion state - mutex behavior should reset on every load
      }),
    }
  )
);
