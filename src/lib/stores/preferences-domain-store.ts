/**
 * RR-270: Domain Store - App-wide saved preferences
 *
 * Read-only store that holds saved preferences for use throughout
 * the application. Never exposes API keys in plain text.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  PreferencesData,
  UserPreferences,
  PreferencesPatch,
} from "@/types/preferences";
import {
  sanitizeApiKeyResponse,
  applyApiKeyChange,
} from "@/lib/utils/api-key-handler";

/**
 * Store state interface
 */
export interface PreferencesDomainState {
  savedPreferences: PreferencesData | null;
  isLoading: boolean;
  error: string | null;
  lastSync: Date | null;
  saveInProgress: boolean;
}

/**
 * Store actions interface
 */
export interface PreferencesDomainActions {
  loadPreferences: () => Promise<void>;
  savePreferences: (patch: PreferencesPatch) => Promise<void>;
  resetStore: () => void;
}

/**
 * Combined store type
 */
export type PreferencesDomainStore = PreferencesDomainState &
  PreferencesDomainActions;

/**
 * Default preferences to use as fallback
 */
const getDefaultPreferences = (): PreferencesData => ({
  ai: {
    hasApiKey: false,
    model: "claude-3-haiku-20240307",
    summaryLengthMin: 100,
    summaryLengthMax: 300,
    summaryStyle: "objective",
    contentFocus: "general",
  },
  sync: {
    maxArticles: 500,
    retentionCount: 30,
  },
});

/**
 * Main domain store for saved preferences
 *
 * This store manages the app-wide saved preferences state.
 * It handles loading from the API, optimistic updates, and
 * secure API key management (never exposing actual keys).
 */
export const usePreferencesDomainStore = create<PreferencesDomainStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      savedPreferences: null,
      isLoading: false,
      error: null,
      lastSync: null,
      saveInProgress: false,

      // Load preferences from API
      loadPreferences: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch("/api/users/preferences");

          if (response.status === 404) {
            // New user - use defaults
            const defaults = getDefaultPreferences();
            set({
              savedPreferences: defaults,
              isLoading: false,
              error: null,
              lastSync: new Date(),
            });
            return;
          }

          if (!response.ok) {
            throw new Error("Failed to load preferences");
          }

          const data = await response.json();

          // Sanitize response - never expose API keys
          const sanitized = sanitizeApiKeyResponse(data);

          set({
            savedPreferences: sanitized,
            isLoading: false,
            error: null,
            lastSync: new Date(),
          });
        } catch (error) {
          console.error("Failed to load preferences:", error);
          set({
            savedPreferences: null,
            isLoading: false,
            error: "Failed to load preferences",
          });
        }
      },

      // Save preferences with patch semantics
      savePreferences: async (patch: PreferencesPatch) => {
        const currentState = get();

        if (currentState.saveInProgress) {
          throw new Error("Save already in progress");
        }

        const previousPreferences = currentState.savedPreferences;

        // Optimistic update
        if (previousPreferences && patch) {
          const optimisticUpdate = applyPatch(previousPreferences, patch);
          set({ savedPreferences: optimisticUpdate });
        }

        set({ saveInProgress: true, error: null });

        try {
          const response = await fetch("/api/users/preferences", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(patch),
          });

          if (!response.ok) {
            throw new Error("Failed to save preferences");
          }

          const updated = await response.json();

          // Sanitize response - never expose API keys
          const sanitized = sanitizeApiKeyResponse(updated);

          set({
            savedPreferences: sanitized,
            error: null,
            lastSync: new Date(),
          });
        } catch (error) {
          console.error("Failed to save preferences:", error);

          // Rollback optimistic update
          if (previousPreferences) {
            set({
              savedPreferences: previousPreferences,
              error: "Failed to save preferences",
            });
          }

          throw error;
        } finally {
          set({ saveInProgress: false });
        }
      },

      // Reset store to initial state
      resetStore: () => {
        set({
          savedPreferences: null,
          isLoading: false,
          error: null,
          lastSync: null,
          saveInProgress: false,
        });
      },
    }),
    {
      name: "preferences-domain-store",
    }
  )
);

/**
 * Helper to apply patch to preferences
 */
function applyPatch(
  current: PreferencesData,
  patch: PreferencesPatch
): PreferencesData {
  const updated = { ...current };

  // Apply AI patches
  if (patch.ai) {
    updated.ai = { ...current.ai };

    if (patch.ai.model !== undefined) {
      updated.ai.model = patch.ai.model;
    }
    if (patch.ai.summaryLengthMin !== undefined) {
      updated.ai.summaryLengthMin = patch.ai.summaryLengthMin;
    }
    if (patch.ai.summaryLengthMax !== undefined) {
      updated.ai.summaryLengthMax = patch.ai.summaryLengthMax;
    }
    if (patch.ai.summaryStyle !== undefined) {
      updated.ai.summaryStyle = patch.ai.summaryStyle;
    }
    if (patch.ai.contentFocus !== undefined) {
      updated.ai.contentFocus = patch.ai.contentFocus;
    }

    // Handle API key state changes using common handler
    const withApiKeyChanges = applyApiKeyChange(
      { ...updated },
      patch.ai.apiKeyChange as "replace" | "clear" | undefined,
      patch.ai.apiKey
    );
    updated.ai = withApiKeyChanges.ai;
  }

  // Apply sync patches
  if (patch.sync) {
    updated.sync = { ...current.sync };

    if (patch.sync.maxArticles !== undefined) {
      updated.sync.maxArticles = patch.sync.maxArticles;
    }
    if (patch.sync.retentionCount !== undefined) {
      updated.sync.retentionCount = patch.sync.retentionCount;
    }
  }

  return updated;
}
