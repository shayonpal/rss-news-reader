'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';

interface LoginButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function LoginButton({ 
  className, 
  variant = 'default', 
  size = 'default' 
}: LoginButtonProps) {
  const { login, isLoading, error } = useAuthStore();

  const handleLogin = async () => {
    await login();
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleLogin}
        disabled={isLoading}
        variant={variant}
        size={size}
        className={className}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <LogIn className="mr-2 h-4 w-4" />
            Connect Inoreader
          </>
        )}
      </Button>
      
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}