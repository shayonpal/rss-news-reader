import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// DEPRECATED: This auth store is no longer used in the server-client architecture
// Authentication is now handled server-side only
// Keeping minimal implementation to prevent errors from legacy components

interface User {
  userId: string;
  userName: string;
  userEmail: string;
}

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state - always unauthenticated in new architecture
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Setters
      setUser: () => {}, // No-op
      setLoading: () => {}, // No-op
      setError: () => {}, // No-op
      clearError: () => set({ error: null }),

      // Login action - no longer used
      login: async () => {
        console.warn('Auth store login called but authentication is now server-side only');
      },

      // Logout action - no longer used
      logout: async () => {
        console.warn('Auth store logout called but authentication is now server-side only');
      },

      // Check authentication status - always returns unauthenticated
      checkAuthStatus: async () => {
        // No-op - authentication is handled server-side
        // This prevents the 404 errors from trying to hit removed endpoints
      },

      // Refresh token - always returns true to prevent errors
      refreshToken: async () => {
        // No-op - authentication is handled server-side
        return true;
      },
    }),
    {
      name: 'auth-storage',
      partialize: () => ({
        // Don't persist anything
      }),
    }
  )
);

// Auto-refresh token hook - no longer needed
export function useTokenRefresh() {
  // No-op - authentication is handled server-side
}