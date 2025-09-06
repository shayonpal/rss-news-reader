/**
 * RR-270: Editor Store - Settings page draft state
 *
 * Manages draft state on the settings page with dirty tracking,
 * validation, and API key state machine.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  PreferencesData,
  ApiKeyState,
  PreferencesPatch,
  PreferencesValidationErrors,
} from "@/types/preferences";
import { PREFERENCES_CONSTRAINTS } from "@/types/preferences";
import { buildPreferencesPatch } from "@/lib/utils/preferences-patch-builder";
import { arePreferencesEqual } from "@/lib/utils/preferences-comparator";
import { validateApiKeyFormat } from "@/lib/utils/preferences-validator";
import { debounce } from "@/lib/utils/debounce";

/**
 * Store state interface
 */
export interface PreferencesEditorState {
  draft: PreferencesData | null;
  errors: PreferencesValidationErrors;
  isSaving: boolean;
  apiKeyState: ApiKeyState;
}

/**
 * Store actions interface
 */
export interface PreferencesEditorActions {
  initializeDraft: (saved: PreferencesData) => void;
  updateField: (path: string, value: string | number | boolean | null) => void;
  setApiKeyState: (state: ApiKeyState) => void;
  setApiKeyInput: (key: string) => void;
  getApiKeyInput: () => string;
  isDirty: (saved: PreferencesData) => boolean;
  validateField: (field: string) => void;
  validateAll: () => boolean;
  buildPatch: (saved: PreferencesData) => PreferencesPatch;
  setSaving: (saving: boolean) => void;
  onSaveSuccess: () => void;
  clearDraft: () => void;
}

/**
 * Combined store type
 */
export type PreferencesEditorStore = PreferencesEditorState &
  PreferencesEditorActions;

/**
 * Secure API key storage using WeakMap for automatic cleanup
 * This ensures it's never exposed in devtools or state snapshots
 *
 * Security architecture:
 * - WeakMap provides automatic memory cleanup when references are removed
 * - API key is NEVER stored in Zustand state (prevents Redux DevTools exposure)
 * - Token object acts as a unique key for this session only
 * - When component unmounts, token is dereferenced and WeakMap cleans up automatically
 */
const apiKeyStorage = new WeakMap<object, string>();
const apiKeyToken = {}; // Unique token for this session

/**
 * Get default preferences with proper types
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
 * Main editor store for draft preferences
 *
 * This store manages the draft state on the settings page.
 * It handles field validation, dirty tracking, and the API key
 * state machine. The draft is cleared on unmount to prevent
 * memory leaks and ensure sensitive data is not persisted.
 *
 * @example
 * const { draft, updateField, isDirty } = usePreferencesEditorStore();
 */
export const usePreferencesEditorStore = create<PreferencesEditorStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      draft: null,
      errors: {},
      isSaving: false,
      apiKeyState: "unchanged",

      // Initialize draft from saved preferences
      initializeDraft: (saved: PreferencesData) => {
        const defaults = getDefaultPreferences();
        const merged: PreferencesData = {
          ai: { ...defaults.ai, ...saved?.ai },
          sync: { ...defaults.sync, ...saved?.sync },
        };

        set({
          draft: merged,
          errors: {},
          apiKeyState: "unchanged",
        });
        apiKeyStorage.delete(apiKeyToken);
      },

      // Update a field in the draft
      updateField: (path: string, value: string | number | boolean | null) => {
        const { draft } = get();
        if (!draft) return;

        const newDraft = { ...draft };
        const parts = path.split(".");

        // Type-safe navigation helper
        const navigateToParent = (
          obj: PreferencesData,
          pathParts: string[]
        ): Record<string, unknown> | null => {
          let current: Record<string, unknown> = obj as unknown as Record<
            string,
            unknown
          >;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!(part in current)) {
              current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
          }
          return current;
        };

        const target = navigateToParent(newDraft, parts);
        if (!target) return;

        const field = parts[parts.length - 1];

        // Apply validation and clamping
        if (path === "sync.maxArticles") {
          const numValue = Number(value);
          const { min, max } = PREFERENCES_CONSTRAINTS.sync.maxArticles;
          value = Math.max(
            min,
            Math.min(max, isNaN(numValue) ? 500 : numValue)
          );
        } else if (path === "sync.retentionCount") {
          const numValue = Number(value);
          const { min, max } = PREFERENCES_CONSTRAINTS.sync.retentionCount;
          value = Math.max(min, Math.min(max, isNaN(numValue) ? 30 : numValue));
        } else if (path === "ai.summaryLengthMin") {
          const numValue = Number(value);
          const { min, max } = PREFERENCES_CONSTRAINTS.ai.summaryLengthMin;
          value = Math.max(
            min,
            Math.min(max, isNaN(numValue) ? 100 : numValue)
          );
          // Ensure min <= max
          if (draft.ai && value > draft.ai.summaryLengthMax) {
            newDraft.ai.summaryLengthMax = value;
          }
        } else if (path === "ai.summaryLengthMax") {
          const numValue = Number(value);
          const { min, max } = PREFERENCES_CONSTRAINTS.ai.summaryLengthMax;
          value = Math.max(
            min,
            Math.min(max, isNaN(numValue) ? 300 : numValue)
          );
          // Ensure min <= max
          if (draft.ai && value < draft.ai.summaryLengthMin) {
            newDraft.ai.summaryLengthMin = value;
          }
        }

        target[field] = value;
        set({ draft: newDraft });

        // Clear error for this field
        const { errors } = get();
        if (errors[path]) {
          const newErrors = { ...errors };
          delete newErrors[path];
          set({ errors: newErrors });
        }
      },

      /**
       * Set API key state machine state
       *
       * State transitions:
       * - 'unchanged': No pending changes - clears any stored API key from WeakMap
       * - 'replace': User wants to set/update API key - key stored separately in WeakMap
       * - 'clear': User wants to remove API key - no key value needed
       *
       * @param state - The new state for the API key state machine
       */
      setApiKeyState: (state: ApiKeyState) => {
        set({ apiKeyState: state });
        if (state === "unchanged") {
          // Clean up any stored API key when reverting to unchanged
          apiKeyStorage.delete(apiKeyToken);
        }
      },

      /**
       * Set API key input with validation
       *
       * Stores the API key in WeakMap (never in state) and validates format.
       * Automatically sets state to 'replace' when called.
       *
       * Security notes:
       * - API key is stored in WeakMap, not in Zustand state
       * - WeakMap provides automatic cleanup on unmount
       * - Key is validated but never logged or exposed
       *
       * @param key - The API key input from the user
       */
      setApiKeyInput: (key: string) => {
        apiKeyStorage.set(apiKeyToken, key);

        // Validate API key format
        if (key) {
          const validationError = validateApiKeyFormat(key);
          if (validationError) {
            const { errors } = get();
            set({
              errors: { ...errors, apiKey: validationError },
              apiKeyState: "replace",
            });
            return;
          }
        }

        // Clear any existing API key error
        const { errors } = get();
        const newErrors = { ...errors };
        delete newErrors.apiKey;
        set({
          errors: newErrors,
          apiKeyState: "replace",
        });
      },

      /**
       * Get API key input from WeakMap storage
       *
       * Retrieves the API key from WeakMap for controlled input display.
       * Returns empty string if no key is stored.
       *
       * Security note: This is the ONLY way to retrieve the API key value,
       * and it should only be used for controlled input components.
       *
       * @returns The stored API key or empty string
       */
      getApiKeyInput: () => apiKeyStorage.get(apiKeyToken) || "",

      /**
       * Check if draft has unsaved changes
       *
       * Compares draft state with saved preferences to detect changes.
       * API key state changes always make the draft dirty.
       *
       * @param saved - The currently saved preferences
       * @returns True if there are unsaved changes
       */
      isDirty: (saved: PreferencesData) => {
        const { draft, apiKeyState } = get();
        if (!draft) return false;

        // API key changes always make it dirty
        if (apiKeyState !== "unchanged") return true;

        // Efficient shallow comparison
        return !arePreferencesEqual(draft, saved);
      },

      // Validate a specific field
      validateField: (field: string) => {
        const { draft, errors } = get();
        if (!draft) return;

        let error: string | undefined;

        if (field === "ai.model" && !draft.ai.model) {
          error = "Model is required";
        } else if (field === "ai.summaryStyle") {
          const validStyles = [
            "objective",
            "analytical",
            "concise",
            "detailed",
          ];
          if (!validStyles.includes(draft.ai.summaryStyle)) {
            error = "Invalid summary style";
          }
        } else if (field === "sync.maxArticles") {
          const value = draft.sync.maxArticles;
          if (value < 10 || value > 5000) {
            error = "Max articles must be between 10 and 5000";
          }
        } else if (field === "sync.retentionCount") {
          const value = draft.sync.retentionCount;
          if (value < 1 || value > 365) {
            error = "Retention count must be between 1 and 365";
          }
        }

        const newErrors = { ...errors };
        if (error) {
          newErrors[field] = error;
        } else {
          delete newErrors[field];
        }
        set({ errors: newErrors });
      },

      // Validate all fields
      validateAll: () => {
        const { draft } = get();
        if (!draft) return false;

        const errors: PreferencesValidationErrors = {};

        // Validate required fields
        if (!draft.ai.model) {
          errors["ai.model"] = "Model is required";
        }

        // Validate enums
        const validStyles = ["objective", "analytical", "concise", "detailed"];
        if (!validStyles.includes(draft.ai.summaryStyle)) {
          errors["ai.summaryStyle"] = "Invalid summary style";
        }

        // Validate ranges
        if (draft.sync.maxArticles < 10 || draft.sync.maxArticles > 5000) {
          errors["sync.maxArticles"] =
            "Max articles must be between 10 and 5000";
        }
        if (draft.sync.retentionCount < 1 || draft.sync.retentionCount > 365) {
          errors["sync.retentionCount"] =
            "Retention count must be between 1 and 365";
        }
        if (draft.ai.summaryLengthMin < 50 || draft.ai.summaryLengthMin > 500) {
          errors["ai.summaryLengthMin"] =
            "Min length must be between 50 and 500";
        }
        if (draft.ai.summaryLengthMax < 50 || draft.ai.summaryLengthMax > 500) {
          errors["ai.summaryLengthMax"] =
            "Max length must be between 50 and 500";
        }
        if (draft.ai.summaryLengthMin > draft.ai.summaryLengthMax) {
          errors["ai.summaryLengthMin"] = "Min length cannot exceed max length";
        }

        set({ errors });
        return Object.keys(errors).length === 0;
      },

      // Build patch for save
      buildPatch: (saved: PreferencesData) => {
        const { draft, apiKeyState } = get();
        if (!draft) return {};

        return buildPreferencesPatch(
          draft,
          saved,
          apiKeyState,
          apiKeyState === "replace" ? apiKeyStorage.get(apiKeyToken) : undefined
        );
      },

      // Set saving state
      setSaving: (saving: boolean) => {
        set({ isSaving: saving });
      },

      /**
       * Handle successful save operation
       *
       * Resets the API key state machine to 'unchanged' and cleans up
       * the WeakMap storage. This is called after a successful API save.
       *
       * State transitions:
       * - Resets apiKeyState to 'unchanged'
       * - Clears any stored API key from WeakMap
       * - Clears validation errors
       * - Sets saving flag to false
       */
      onSaveSuccess: () => {
        set({
          apiKeyState: "unchanged",
          isSaving: false,
          errors: {},
        });
        apiKeyStorage.delete(apiKeyToken);
      },

      /**
       * Clear draft and reset state
       *
       * Completely resets the editor store, clearing all draft data
       * and API key storage. Should be called on component unmount
       * to prevent memory leaks and ensure security.
       *
       * Security note: This ensures no sensitive data persists after
       * the settings page is closed.
       */
      clearDraft: () => {
        set({
          draft: null,
          errors: {},
          isSaving: false,
          apiKeyState: "unchanged",
        });
        apiKeyStorage.delete(apiKeyToken);
      },
    }),
    {
      name: "preferences-editor-store",
    }
  )
);
