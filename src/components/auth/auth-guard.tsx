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
    // Check auth status on mount
    console.log('AuthGuard mounted, checking auth status...');
    checkAuthStatus();
    
    // Set up periodic check every 24 hours for long-running sessions
    const interval = setInterval(() => {
      console.log('Periodic auth status check...');
      checkAuthStatus();
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    return () => clearInterval(interval);
  }, [checkAuthStatus]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Checking authentication...
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 text-xs text-muted-foreground underline"
          >
            Stuck? Click here to reload
          </button>
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