"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/sw-registration";
import { initializeHealthScheduler } from "@/lib/health/health-scheduler";

export function PWAProvider() {
  useEffect(() => {
    // Only register service worker in production
    if (process.env.NODE_ENV === "production") {
      registerServiceWorker();
    }

    // DISABLED: Health check scheduler disabled in server-client architecture
    // Health checks were trying to access removed auth endpoints
    // initializeHealthScheduler();
  }, []);

  return null;
}
