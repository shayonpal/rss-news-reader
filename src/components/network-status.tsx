"use client";

import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";

export function NetworkStatus() {
  const { isOnline, isSlowConnection } = useNetworkStatus();

  if (isOnline && !isSlowConnection) {
    return null; // Don't show anything when everything is normal
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium shadow-lg",
        !isOnline
          ? "bg-destructive text-destructive-foreground"
          : "bg-yellow-500 text-yellow-900"
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline - Cached content only</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4" />
          <span>Slow connection detected</span>
        </>
      )}
    </div>
  );
}
