/**
 * Hook for managing preferences form with debounced updates
 * 
 * This hook provides debounced field updates to prevent excessive
 * re-renders during rapid typing in form inputs.
 */

import { useCallback, useMemo } from 'react';
import { usePreferencesEditorStore } from '@/lib/stores/preferences-editor-store';
import { usePreferencesDomainStore } from '@/lib/stores/preferences-domain-store';
import { debounce } from '@/lib/utils/debounce';

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
    () => debounce((path: string, value: string | number | boolean | null) => {
      editorStore.updateField(path, value);
    }, 300),
    []
  );

  // Handle immediate updates for critical fields (like dropdowns)
  const updateFieldImmediate = useCallback((path: string, value: string | number | boolean | null) => {
    editorStore.updateField(path, value);
  }, []);

  // Handle text input changes with debouncing
  const handleTextChange = useCallback((path: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    debouncedUpdateField(path, value);
  }, [debouncedUpdateField]);

  // Handle number input changes with debouncing
  const handleNumberChange = useCallback((path: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber;
    if (!isNaN(value)) {
      debouncedUpdateField(path, value);
    }
  }, [debouncedUpdateField]);

  // Handle select/dropdown changes (immediate)
  const handleSelectChange = useCallback((path: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFieldImmediate(path, e.target.value);
  }, [updateFieldImmediate]);

  // Handle API key input with debouncing
  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    editorStore.setApiKeyInput(value);
  }, []);

  // Save preferences
  const handleSave = useCallback(async () => {
    const patch = editorStore.buildPatch(domainStore.savedPreferences);
    if (!patch || Object.keys(patch).length === 0) {
      return;
    }

    editorStore.setSaving(true);
    try {
      await domainStore.savePreferences(patch);
      editorStore.clearDraft();
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      editorStore.setSaving(false);
    }
  }, []);

  // Cancel and reset
  const handleCancel = useCallback(() => {
    debouncedUpdateField.cancel();
    editorStore.clearDraft();
  }, [debouncedUpdateField]);

  return {
    // State
    draft: editorStore.draft,
    errors: editorStore.errors,
    isSaving: editorStore.isSaving,
    apiKeyState: editorStore.apiKeyState,
    apiKeyInput: editorStore.getApiKeyInput(),
    isDirty: editorStore.isDirty(domainStore.savedPreferences || {} as any),
    
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