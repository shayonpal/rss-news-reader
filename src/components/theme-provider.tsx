"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";

export function ThemeProvider() {
  const theme = useUIStore((state) => state.theme);

  // Apply theme immediately on mount and when it changes
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;

      // Remove existing theme classes
      root.classList.remove("light", "dark");

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    };

    // Apply immediately
    applyTheme();

    // Also apply after a short delay to handle any hydration issues
    const timer = setTimeout(applyTheme, 10);

    return () => clearTimeout(timer);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(mediaQuery.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Debug effect to verify the component is rendering
  useEffect(() => {
    console.log("[ThemeProvider] Mounted with theme:", theme);
    return () => console.log("[ThemeProvider] Unmounted");
  }, [theme]);

  return null;
}
