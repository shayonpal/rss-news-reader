import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StateCreator } from 'zustand';

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

/**
 * Creates an isolated UI store instance for testing
 * Each test gets its own store with unique storage key to prevent state leakage
 */
export const createIsolatedUIStore = () => {
  // Generate unique storage key for this test instance
  const storageKey = `ui-store-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const storeCreator: StateCreator<UIState> = (set) => ({
    // Theme
    theme: "system",
    setTheme: (theme) => set({ theme }),

    // Navigation
    isSidebarOpen: false,
    setSidebarOpen: (open) => set({ isSidebarOpen: open }),
    toggleSidebar: () =>
      set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    // Collapsible Sections (session-only, not persisted)
    feedsSectionCollapsed: false,
    setFeedsSectionCollapsed: (collapsed) => set({ feedsSectionCollapsed: Boolean(collapsed) }),
    toggleFeedsSection: () =>
      set((state) => ({ feedsSectionCollapsed: !state.feedsSectionCollapsed })),
    tagsSectionCollapsed: false,
    setTagsSectionCollapsed: (collapsed) => set({ tagsSectionCollapsed: Boolean(collapsed) }),
    toggleTagsSection: () =>
      set((state) => ({ tagsSectionCollapsed: !state.tagsSectionCollapsed })),

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
  });

  // Create store with persist middleware using unique storage key
  const store = create<UIState>()(
    persist(
      storeCreator,
      {
        name: storageKey,
        partialize: (state) => ({
          theme: state.theme,
          // Don't persist temporary UI state like sidebar open/loading
          // feedsSectionCollapsed is intentionally not persisted
        }),
      }
    )
  );

  // Cleanup function to destroy store and clear storage
  const cleanup = () => {
    // Clear the specific storage key
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      // Ignore errors during cleanup
    }
    
    // Reset store to initial state
    store.setState({
      theme: "system",
      isSidebarOpen: false,
      feedsSectionCollapsed: false,
      tagsSectionCollapsed: false,
      isArticleOpen: false,
      selectedArticleId: null,
      isLoading: false,
      notification: null,
    });

    // Clear all subscriptions by calling destroy if it exists
    if (typeof store.destroy === 'function') {
      store.destroy();
    }
  };

  return {
    store,
    cleanup,
    storageKey,
  };
};

/**
 * Helper to create a test hook that uses an isolated store
 * Returns both the hook and cleanup function
 */
export const createTestStoreHook = () => {
  const { store, cleanup, storageKey } = createIsolatedUIStore();
  
  // Create a hook function that returns the store state
  const useTestStore = () => store.getState();
  
  // Attach store methods to the hook for compatibility
  useTestStore.getState = store.getState;
  useTestStore.setState = store.setState;
  useTestStore.subscribe = store.subscribe;
  useTestStore.destroy = store.destroy || (() => {});
  
  return {
    useTestStore,
    cleanup,
    storageKey,
  };
};