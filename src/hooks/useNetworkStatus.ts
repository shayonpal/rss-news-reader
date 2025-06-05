'use client';

import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine);

    // Check connection type if available
    if ('connection' in navigator) {
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
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          setIsSlowConnection(connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('connection' in navigator) {
        (navigator as any).connection?.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return { isOnline, isSlowConnection };
}