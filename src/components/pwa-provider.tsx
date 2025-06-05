'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/sw-registration';

export function PWAProvider() {
  useEffect(() => {
    // Only register service worker in production
    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker();
    }
  }, []);

  return null;
}