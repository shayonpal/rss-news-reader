'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { LoginButton } from './login-button';
import { UserProfile } from './user-profile';
import { useEffect } from 'react';

export function AuthStatus() {
  const { isAuthenticated, checkAuthStatus, clearError } = useAuthStore();

  useEffect(() => {
    // Check auth status on component mount
    checkAuthStatus();
    
    // Clear any errors after 5 seconds
    const errorTimer = setTimeout(() => {
      clearError();
    }, 5000);

    return () => clearTimeout(errorTimer);
  }, []); // Remove dependencies to prevent infinite loop

  if (isAuthenticated) {
    return <UserProfile />;
  }

  return <LoginButton variant="default" size="sm" />;
}