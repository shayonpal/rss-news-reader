'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { LoginButton } from './login-button';
import { useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectPath?: string;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading, checkAuthStatus } = useAuthStore();

  useEffect(() => {
    // Only check auth if we haven't checked yet (no user data and not loading)
    const { user } = useAuthStore.getState();
    if (!user && !isLoading) {
      checkAuthStatus();
    }
  }, []); // Only run once on mount

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // Show fallback or default login prompt if not authenticated
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-6 max-w-md mx-auto text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Welcome to Shayon's News</h2>
            <p className="text-muted-foreground">
              Connect your Inoreader account to start reading your RSS feeds
            </p>
          </div>
          <LoginButton variant="default" size="lg" />
        </div>
      </div>
    );
  }

  // Render protected content if authenticated
  return <>{children}</>;
}

// Higher-order component version for pages
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <AuthGuard fallback={fallback}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}