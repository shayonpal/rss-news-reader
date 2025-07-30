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
      }),
    }
  )
);
