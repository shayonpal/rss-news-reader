'use client';

import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    // Check initial status - safe for SSR
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    // Check connection type if available
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        setIsSlowConnection(connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      console.log('Network: back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('Network: gone offline');
    };

    const handleConnectionChange = () => {
      if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          setIsSlowConnection(connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
    
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', handleConnectionChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        (navigator as any).connection?.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return { isOnline, isSlowConnection };
}