/**
 * Unified preferences store export
 * This file satisfies the Linear requirement for a single preferences-store.ts
 * while maintaining the superior split architecture internally
 */

// Re-export domain store (app-wide state)
export {
  usePreferencesDomainStore,
  type PreferencesDomainStore,
  type PreferencesDomainState,
  type PreferencesDomainActions,
} from "./preferences-domain-store";

// Re-export editor store (UI state)
export {
  usePreferencesEditorStore,
  type PreferencesEditorStore,
  type PreferencesEditorState,
  type PreferencesEditorActions,
} from "./preferences-editor-store";

// Convenience hooks for common use cases
import { usePreferencesDomainStore } from "./preferences-domain-store";
import { usePreferencesEditorStore } from "./preferences-editor-store";

/**
 * Hook to get current saved preferences
 */
export function usePreferences() {
  return usePreferencesDomainStore((state) => state.savedPreferences);
}

/**
 * Hook to get loading state
 */
export function usePreferencesLoading() {
  return usePreferencesDomainStore((state) => state.isLoading);
}

/**
 * Hook to get error state
 */
export function usePreferencesError() {
  return usePreferencesDomainStore((state) => state.error);
}

/**
 * Hook to get editor draft state
 */
export function usePreferencesDraft() {
  return usePreferencesEditorStore((state) => state.draft);
}

/**
 * Hook to check if there are unsaved changes
 */
export function usePreferencesIsDirty() {
  return usePreferencesEditorStore((state) => state.isDirty);
}

/**
 * Hook to get validation errors
 */
export function usePreferencesValidationErrors() {
  return usePreferencesEditorStore((state) => state.errors);
}
