import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/db/supabase";
import type { Database } from "@/lib/db/types";

export interface QueuedAction {
  id: string;
  type: "mark_read" | "mark_unread" | "star" | "unstar";
  articleId: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncState {
  // Sync status
  lastSyncTime: number | null;
  isSyncing: boolean;
  syncError: string | null;
  syncProgress: number;
  syncMessage: string | null;
  rateLimit: { used: number; limit: number; remaining: number } | null;

  // Offline queue
  actionQueue: QueuedAction[];

  // Actions
  setLastSyncTime: (time: number) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  setSyncProgress: (progress: number) => void;
  setSyncMessage: (message: string | null) => void;
  setRateLimit: (
    rateLimit: { used: number; limit: number; remaining: number } | null
  ) => void;

  // Queue management
  addToQueue: (
    action: Omit<QueuedAction, "id" | "timestamp" | "retryCount">
  ) => void;
  removeFromQueue: (actionId: string) => void;
  incrementRetryCount: (actionId: string) => void;
  clearQueue: () => void;

  // Sync operations
  processQueue: () => Promise<void>;
  performFullSync: () => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      // Initial state
      lastSyncTime: null,
      isSyncing: false,
      syncError: null,
      syncProgress: 0,
      syncMessage: null,
      rateLimit: null,
      actionQueue: [],

      // Basic setters
      setLastSyncTime: (time) => set({ lastSyncTime: time }),
      setSyncing: (syncing) => set({ isSyncing: syncing }),
      setSyncError: (error) => set({ syncError: error }),
      setSyncProgress: (progress) => set({ syncProgress: progress }),
      setSyncMessage: (message) => set({ syncMessage: message }),
      setRateLimit: (rateLimit) => set({ rateLimit }),

      // Queue management
      addToQueue: (actionData) => {
        const action: QueuedAction = {
          ...actionData,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          retryCount: 0,
        };

        set((state) => ({
          actionQueue: [...state.actionQueue, action],
        }));
      },

      removeFromQueue: (actionId) => {
        set((state) => ({
          actionQueue: state.actionQueue.filter(
            (action) => action.id !== actionId
          ),
        }));
      },

      incrementRetryCount: (actionId) => {
        set((state) => ({
          actionQueue: state.actionQueue.map((action) =>
            action.id === actionId
              ? { ...action, retryCount: action.retryCount + 1 }
              : action
          ),
        }));
      },

      clearQueue: () => set({ actionQueue: [] }),

      // Sync operations
      processQueue: async () => {
        const { actionQueue, removeFromQueue, incrementRetryCount } = get();

        if (actionQueue.length === 0 || !navigator.onLine) return;

        console.log(`Processing ${actionQueue.length} queued actions`);

        // With Supabase-only architecture, offline actions are handled locally
        // Server will sync read states back to Inoreader when implemented
        for (const action of actionQueue) {
          try {
            // All actions were already applied to Supabase in article store
            // Just remove from queue
            removeFromQueue(action.id);

            console.log(
              `Successfully processed action: ${action.type} for article ${action.articleId}`
            );
          } catch (error) {
            console.error(`Failed to process action ${action.id}:`, error);

            if (action.retryCount < action.maxRetries) {
              incrementRetryCount(action.id);
            } else {
              console.warn(
                `Max retries reached for action ${action.id}, removing from queue`
              );
              removeFromQueue(action.id);
            }
          }
        }
      },

      performFullSync: async () => {
        const {
          setSyncing,
          setSyncError,
          setLastSyncTime,
          setSyncProgress,
          setSyncMessage,
          setRateLimit,
          processQueue,
        } = get();

        setSyncing(true);
        setSyncError(null);
        setSyncProgress(0);
        setSyncMessage("Starting sync...");

        try {
          // Process any queued offline actions first
          await processQueue();

          console.log("Starting server sync...");
          const startTime = Date.now();

          // Call server sync API
          const response = await fetch("/reader/api/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const error = await response.json();

            // Handle rate limit error specifically
            if (
              response.status === 429 &&
              error.error === "rate_limit_exceeded"
            ) {
              const rateInfo = error.limit
                ? ` (${error.used}/${error.limit} calls used today)`
                : "";
              throw new Error(
                `API rate limit exceeded${rateInfo}. Try again tomorrow.`
              );
            }

            throw new Error(error.message || "Failed to start sync");
          }

          const { syncId, rateLimit } = await response.json();
          console.log("Sync started with ID:", syncId);

          // Store rate limit info if available
          if (rateLimit) {
            setRateLimit(rateLimit);
            console.log(
              `API usage: ${rateLimit.used}/${rateLimit.limit} calls today`
            );
            if (rateLimit.used >= rateLimit.limit * 0.8) {
              console.warn(
                `Warning: Approaching API rate limit (${rateLimit.remaining} calls remaining)`
              );
            }
          }

          // Poll for sync status
          let syncComplete = false;
          let pollCount = 0;
          const maxPolls = 60; // 2 minutes max (2s intervals)

          while (!syncComplete && pollCount < maxPolls) {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

            const statusResponse = await fetch(
              `/reader/api/sync/status/${syncId}`
            );
            if (statusResponse.ok) {
              const status = await statusResponse.json();
              console.log(
                `Sync progress: ${status.progress}% - ${status.message || "Processing..."}`
              );

              // Update progress and message in store
              setSyncProgress(status.progress || 0);
              setSyncMessage(status.message || "Processing...");

              if (status.status === "completed") {
                syncComplete = true;
                console.log("Sync completed successfully");
              } else if (status.status === "failed") {
                throw new Error(status.error || "Sync failed");
              }
            }

            pollCount++;
          }

          if (!syncComplete) {
            throw new Error("Sync timeout - took too long to complete");
          }

          // Refresh data from Supabase
          const feedStore = await import("./feed-store").then((m) =>
            m.useFeedStore.getState()
          );
          const articleStore = await import("./article-store").then((m) =>
            m.useArticleStore.getState()
          );

          await Promise.all([
            feedStore.loadFeedHierarchy(),
            articleStore.refreshArticles(),
          ]);

          const endTime = Date.now();
          const duration = (endTime - startTime) / 1000;

          setLastSyncTime(Date.now());
          setSyncProgress(100);
          setSyncMessage("Sync completed!");
          console.log(`Server sync completed in ${duration.toFixed(1)}s`);

          // Reset progress after a short delay
          setTimeout(() => {
            setSyncProgress(0);
            setSyncMessage(null);
          }, 2000);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown sync error";
          setSyncError(errorMessage);
          setSyncProgress(0);
          setSyncMessage(null);
          console.error("Sync failed:", error);
        } finally {
          setSyncing(false);
        }
      },
    }),
    {
      name: "sync-store",
      partialize: (state) => ({
        lastSyncTime: state.lastSyncTime,
        actionQueue: state.actionQueue,
        rateLimit: state.rateLimit,
        // Don't persist temporary sync states (isSyncing, syncProgress, syncMessage, syncError)
      }),
    }
  )
);

// Helper function to get or create single user (no auth required)
async function getOrCreateSupabaseUser(): Promise<string | null> {
  try {
    // For single-user system, use a fixed user ID
    const SINGLE_USER_ID = "shayon";

    // Check if user exists in Supabase
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", SINGLE_USER_ID)
      .single();

    if (existingUser) {
      return existingUser.id;
    }

    // Create new user in Supabase
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        email: "shayon@local",
        inoreader_id: SINGLE_USER_ID,
        preferences: {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create Supabase user:", error);
      return null;
    }

    return newUser?.id || null;
  } catch (error) {
    console.error("Error in getOrCreateSupabaseUser:", error);
    return null;
  }
}

// Process individual action - now handled by server
async function processAction(action: QueuedAction): Promise<void> {
  // In the Supabase-only architecture, all actions are already applied
  // to Supabase when they are queued. The server will handle syncing
  // back to Inoreader when the read state sync is implemented
  console.log(
    `Action ${action.type} for article ${action.articleId} already applied to Supabase`
  );
}

// Monitor online status and process queue when back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("Back online, processing queued actions...");
    useSyncStore.getState().processQueue();
  });
}
