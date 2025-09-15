/**
 * Hook for managing preferences form with debounced updates
 *
 * This hook provides debounced field updates to prevent excessive
 * re-renders during rapid typing in form inputs.
 */

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { usePreferencesEditorStore } from "@/lib/stores/preferences-editor-store";
import { usePreferencesDomainStore } from "@/lib/stores/preferences-domain-store";
import { debounce } from "@/lib/utils/debounce";
import type { PreferencesData } from "@/types/preferences";

/**
 * Custom hook for preferences form management with debouncing
 *
 * @returns Form handlers and state with debounced updates
 */
export function usePreferencesForm() {
  const editorStore = usePreferencesEditorStore();
  const domainStore = usePreferencesDomainStore();

  // Create debounced update function
  const debouncedUpdateField = useMemo(
    () =>
      debounce((path: string, value: string | number | boolean | null) => {
        editorStore.updateField(path, value);
      }, 300),
    [editorStore]
  );

  // Handle immediate updates for critical fields (like dropdowns)
  const updateFieldImmediate = useCallback(
    (path: string, value: string | number | boolean | null) => {
      editorStore.updateField(path, value);
    },
    [editorStore]
  );

  // Handle text input changes with debouncing
  const handleTextChange = useCallback(
    (path: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      debouncedUpdateField(path, value);
    },
    [debouncedUpdateField]
  );

  // Handle number input changes (immediate for better UX)
  const handleNumberChange = useCallback(
    (path: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.valueAsNumber;
      if (!isNaN(value)) {
        updateFieldImmediate(path, value);
      }
    },
    [updateFieldImmediate]
  );

  // Handle select/dropdown changes (immediate)
  const handleSelectChange = useCallback(
    (path: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateFieldImmediate(path, e.target.value);
    },
    [updateFieldImmediate]
  );

  // Handle API key input with debouncing
  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      editorStore.setApiKeyInput(value);
    },
    [editorStore]
  );

  // Save preferences with toast notifications
  const handleSave = useCallback(async () => {
    // Debug: Log the draft and saved preferences
    console.log("Draft preferences:", editorStore.draft);
    console.log("Saved preferences:", domainStore.savedPreferences);

    const patch = editorStore.buildPatch(domainStore.savedPreferences);
    console.log("Generated patch:", patch);

    if (!patch || Object.keys(patch).length === 0) {
      console.log("No changes detected, skipping save");
      return;
    }

    // Prevent concurrent saves
    if (editorStore.isSaving) {
      return;
    }

    editorStore.setSaving(true);
    try {
      await domainStore.savePreferences(patch);
      editorStore.clearDraft();

      // Show success toast
      toast.success("Preferences saved", {
        className: "toast-success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to save preferences:", error);

      // Determine error type and show appropriate toast
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("network") ||
          error.message.includes("fetch") ||
          error.message.includes("Failed to fetch"));

      if (isNetworkError) {
        toast.error("Network error. Check your connection and retry.", {
          className: "toast-error",
          duration: 5000,
          action: {
            label: "Retry",
            onClick: () => handleSave(),
          },
        });
      } else {
        toast.error("Couldn't save preferences. Please retry.", {
          className: "toast-error",
          duration: 5000,
          action: {
            label: "Retry",
            onClick: () => handleSave(),
          },
        });
      }
    } finally {
      editorStore.setSaving(false);
    }
  }, [domainStore, editorStore]);

  // Cancel and reset
  const handleCancel = useCallback(() => {
    debouncedUpdateField.cancel();
    editorStore.clearDraft();
  }, [debouncedUpdateField, editorStore]);

  // Default preferences for fallback when savedPreferences is null
  const defaultPreferences: PreferencesData = {
    ai: {
      hasApiKey: false,
      apiKey: null,
      model: "claude-3-haiku-20240307",
      summaryLengthMin: 100,
      summaryLengthMax: 300,
      summaryStyle: "objective",
      contentFocus: "key-facts-arguments",
    },
    sync: {
      maxArticles: 500,
      retentionCount: 30,
    },
  };

  return {
    // State
    draft: editorStore.draft,
    errors: editorStore.errors,
    isSaving: editorStore.isSaving,
    apiKeyState: editorStore.apiKeyState,
    apiKeyInput: editorStore.getApiKeyInput(),
    isDirty: editorStore.isDirty(
      domainStore.savedPreferences || defaultPreferences
    ),

    // Handlers
    handleTextChange,
    handleNumberChange,
    handleSelectChange,
    handleApiKeyChange,
    handleSave,
    handleCancel,

    // Direct methods
    updateFieldImmediate,
    debouncedUpdateField,
  };
}

/**
 * Example usage in a component:
 *
 * @example
 * ```tsx
 * function PreferencesForm() {
 *   const {
 *     draft,
 *     errors,
 *     isDirty,
 *     handleTextChange,
 *     handleNumberChange,
 *     handleSelectChange,
 *     handleSave,
 *     handleCancel,
 *   } = usePreferencesForm();
 *
 *   return (
 *     <form>
 *       <input
 *         type="number"
 *         value={draft?.sync.maxArticles || ''}
 *         onChange={handleNumberChange('sync.maxArticles')}
 *       />
 *       <select
 *         value={draft?.ai.model || ''}
 *         onChange={handleSelectChange('ai.model')}
 *       >
 *         <option value="claude-3-haiku">Haiku</option>
 *         <option value="claude-3-sonnet">Sonnet</option>
 *       </select>
 *       <button onClick={handleSave} disabled={!isDirty}>
 *         Save
 *       </button>
 *       <button onClick={handleCancel}>
 *         Cancel
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
