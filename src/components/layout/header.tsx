"use client";

import { Menu, RefreshCw } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { useSyncStore } from "@/lib/stores/sync-store";
import { Button } from "@/components/ui/button";
import { HealthStatusWidget } from "@/components/health/health-status-widget";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
  const { toggleSidebar } = useUIStore();
  const { isSyncing, performFullSync, actionQueue } = useSyncStore();

  const handleSync = async () => {
    await performFullSync();
  };

  // Add scroll-aware contrast for the persistent layout header (desktop view)
  if (typeof window !== "undefined") {
    // Use a microtask to avoid layout thrash during hydration
    queueMicrotask(() => {
      const el = document.getElementById("app-layout-header");
      if (!el) return;
      const onScroll = () => {
        const scrolled = window.scrollY > 8;
        el.classList.toggle("is-scrolled", scrolled);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    });
  }

  return (
    <header
      className="glass-nav sticky top-0 z-50 w-full border-b"
      id="app-layout-header"
    >
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="mr-2 h-9 w-9"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-semibold">All Articles</h1>
            <span className="text-sm text-muted-foreground">(152)</span>
          </div>

          <div className="flex items-center space-x-2">
            {actionQueue.length > 0 && (
              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                {actionQueue.length}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-9 w-9"
              aria-label="Sync articles"
            >
              <RefreshCw
                className={`h-5 w-5 ${isSyncing ? "animate-spin" : ""}`}
              />
            </Button>
            <ThemeToggle />
            <HealthStatusWidget />
            <div className="text-sm font-medium text-muted-foreground">
              RSS Reader
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
