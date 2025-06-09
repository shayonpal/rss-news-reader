'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { LoginButton } from './login-button';
import { UserProfile } from './user-profile';
import { useEffect, useCallback } from 'react';

export function AuthStatus() {
  const { isAuthenticated, checkAuthStatus, clearError } = useAuthStore();

  useEffect(() => {
    // Only check auth if we don't have user data yet
    const { user } = useAuthStore.getState();
    if (!user) {
      checkAuthStatus();
    }
    
    // Clear any errors after 5 seconds
    const errorTimer = setTimeout(() => {
      clearError();
    }, 5000);

    return () => clearTimeout(errorTimer);
  }, []); // Only run once on mount

  if (isAuthenticated) {
    return <UserProfile />;
  }

  return <LoginButton variant="default" size="sm" />;
}