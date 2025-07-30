"use client";

import { useEffect } from "react";

export function PWADetector() {
  useEffect(() => {
    // Check if running in PWA standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      document.documentElement.classList.add("pwa-standalone");
    } else {
      document.documentElement.classList.remove("pwa-standalone");
    }
  }, []);

  return null;
}
