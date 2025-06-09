import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

// Global promise to prevent duplicate auth checks
let authCheckPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Setters
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Login action - redirects to OAuth
      login: async () => {
        try {
          set({ isLoading: true, error: null });
          
          // Redirect to OAuth authorization endpoint
          window.location.href = '/api/auth/inoreader/authorize';
        } catch (error) {
          console.error('Login error:', error);
          set({ 
            error: 'Failed to initiate login', 
            isLoading: false 
          });
        }
      },

      // Logout action
      logout: async () => {
        try {
          set({ isLoading: true, error: null });
          
          // Call logout API to clear cookies
          const response = await fetch('/api/auth/inoreader/logout', {
            method: 'POST',
          });
          
          if (!response.ok) {
            throw new Error('Logout failed');
          }
          
          // Clear local state
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            error: null 
          });
        } catch (error) {
          console.error('Logout error:', error);
          set({ 
            error: 'Failed to logout', 
            isLoading: false 
          });
        }
      },

      // Check authentication status with deduplication
      checkAuthStatus: async () => {
        // If there's already an auth check in progress, return that promise
        if (authCheckPromise) {
          return authCheckPromise;
        }
        
        const currentState = get();
        if (currentState.isLoading) {
          // Already checking, don't start another check
          return;
        }
        
        // Create new auth check promise
        authCheckPromise = (async () => {
          try {
            set({ isLoading: true, error: null });
            
            const response = await fetch('/api/auth/inoreader/status');
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.error || 'Failed to check auth status');
            }
            
            if (data.authenticated) {
              // If authenticated but needs refresh, trigger refresh
              if (data.needsRefresh) {
                const refreshSuccessful = await get().refreshToken();
                if (!refreshSuccessful) {
                  set({ 
                    user: null, 
                    isAuthenticated: false, 
                    isLoading: false 
                  });
                  return;
                }
              }
              
              // Only fetch user info if we don't have it already
              const currentUser = get().user;
              if (!currentUser) {
                await fetchUserInfo();
              } else {
                // We already have user info, just update auth state
                set({ isAuthenticated: true, isLoading: false });
              }
            } else {
              set({ 
                user: null, 
                isAuthenticated: false, 
                isLoading: false 
              });
            }
          } catch (error) {
            console.error('Auth status check error:', error);
            set({ 
              user: null, 
              isAuthenticated: false, 
              error: error instanceof Error ? error.message : 'Auth check failed',
              isLoading: false 
            });
          } finally {
            // Clear the promise so future calls can create a new one
            authCheckPromise = null;
          }
        })();
        
        return authCheckPromise;
      },

      // Refresh token
      refreshToken: async () => {
        try {
          const response = await fetch('/api/auth/inoreader/refresh', {
            method: 'POST',
          });
          
          if (!response.ok) {
            throw new Error('Token refresh failed');
          }
          
          return true;
        } catch (error) {
          console.error('Token refresh error:', error);
          set({ 
            user: null, 
            isAuthenticated: false,
            error: 'Session expired, please login again'
          });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist user data, not loading states or errors
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Helper function to fetch user info from Inoreader
async function fetchUserInfo() {
  try {
    const response = await fetch('/api/inoreader/user-info', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    
    const userInfo = await response.json();
    const user: User = {
      userId: userInfo.userId,
      userName: userInfo.userName,
      userEmail: userInfo.userEmail,
    };
    
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setLoading(false);
  } catch (error) {
    console.error('Failed to fetch user info:', error);
    useAuthStore.getState().setError('Failed to fetch user information');
    useAuthStore.getState().setLoading(false);
  }
}

// Auto-refresh token hook
export function useTokenRefresh() {
  const { isAuthenticated, refreshToken } = useAuthStore();
  
  // Set up automatic token refresh every 55 minutes
  if (typeof window !== 'undefined' && isAuthenticated) {
    const refreshInterval = setInterval(async () => {
      await refreshToken();
    }, 55 * 60 * 1000); // 55 minutes
    
    return () => clearInterval(refreshInterval);
  }
}