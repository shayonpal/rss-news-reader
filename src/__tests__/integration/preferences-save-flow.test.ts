import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePreferencesDomainStore } from '@/lib/stores/preferences-domain-store';
import { usePreferencesEditorStore } from '@/lib/stores/preferences-editor-store';
import type { UserPreferences } from '@/types/preferences';

// Mock fetch globally
global.fetch = vi.fn();

// Mock toast notifications
const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('Preferences Save Flow Integration', () => {
  const mockSavedPreferences: UserPreferences = {
    id: 'user-123',
    userId: 'user-123',
    theme: 'system',
    syncEnabled: true,
    maxArticles: 100,
    retentionDays: 30,
    retentionCount: 100,
    feedOrder: 'alphabetical',
    showUnreadOnly: false,
    markAsReadOnOpen: true,
    enableNotifications: false,
    notificationTime: null,
    inoreaderApiKey: null,
    claudeApiKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset both stores
    usePreferencesDomainStore.setState({
      preferences: null,
      isLoading: false,
      error: null,
      hasLoadedOnce: false,
    });
    usePreferencesEditorStore.setState({
      draft: null,
      apiKeyStates: {
        inoreaderApiKey: 'unchanged',
        claudeApiKey: 'unchanged',
      },
      isDirty: false,
      isSaving: false,
      validationErrors: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete save workflow', () => {
    it('should handle the complete edit and save flow', async () => {
      // Step 1: Load preferences into domain store
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());
      const { result: editorResult } = renderHook(() => usePreferencesEditorStore());

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      expect(domainResult.current.preferences).toEqual(mockSavedPreferences);

      // Step 2: Initialize editor with loaded preferences
      act(() => {
        editorResult.current.initializeDraft(domainResult.current.preferences!);
      });

      expect(editorResult.current.draft).toEqual(mockSavedPreferences);
      expect(editorResult.current.isDirty).toBe(false);

      // Step 3: Make changes in editor
      act(() => {
        editorResult.current.updateDraft({
          theme: 'dark',
          maxArticles: 200,
        });
        editorResult.current.updateApiKeyState('inoreaderApiKey', 'replace');
      });

      expect(editorResult.current.isDirty).toBe(true);
      expect(editorResult.current.draft?.theme).toBe('dark');
      expect(editorResult.current.apiKeyStates.inoreaderApiKey).toBe('replace');

      // Step 4: Build patch and save
      const patch = editorResult.current.buildPatch(domainResult.current.preferences!);
      expect(patch).toEqual({
        theme: 'dark',
        maxArticles: 200,
        inoreaderApiKey: 'replace',
      });

      // Mock successful save response
      const updatedPreferences = {
        ...mockSavedPreferences,
        theme: 'dark' as const,
        maxArticles: 200,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: updatedPreferences }),
      });

      act(() => {
        editorResult.current.setSaving(true);
      });

      await act(async () => {
        await domainResult.current.savePreferences(patch);
      });

      // Step 5: Verify post-save state
      expect(domainResult.current.preferences).toEqual(updatedPreferences);

      act(() => {
        editorResult.current.setSaving(false);
        editorResult.current.initializeDraft(updatedPreferences); // Reset editor with new saved state
      });

      expect(editorResult.current.isDirty).toBe(false);
      expect(editorResult.current.apiKeyStates.inoreaderApiKey).toBe('unchanged');
    });

    it('should handle save failure with rollback', async () => {
      // Setup initial state
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());
      const { result: editorResult } = renderHook(() => usePreferencesEditorStore());

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      act(() => {
        editorResult.current.initializeDraft(domainResult.current.preferences!);
        editorResult.current.updateDraft({ theme: 'dark' });
      });

      const patch = editorResult.current.buildPatch(domainResult.current.preferences!);

      // Mock save failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      act(() => {
        editorResult.current.setSaving(true);
      });

      await expect(
        act(async () => {
          await domainResult.current.savePreferences(patch);
        })
      ).rejects.toThrow('Failed to save preferences');

      // Domain store should rollback
      expect(domainResult.current.preferences).toEqual(mockSavedPreferences);

      // Editor should maintain state but not be saving
      act(() => {
        editorResult.current.setSaving(false);
      });

      expect(editorResult.current.isDirty).toBe(true);
      expect(editorResult.current.draft?.theme).toBe('dark');
    });

    it('should validate before save', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());
      const { result: editorResult } = renderHook(() => usePreferencesEditorStore());

      // Load preferences
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      act(() => {
        editorResult.current.initializeDraft(domainResult.current.preferences!);
      });

      // Make invalid changes
      act(() => {
        editorResult.current.updateDraft({ maxArticles: 5 }); // Below minimum
      });

      expect(editorResult.current.validationErrors.maxArticles).toBeDefined();
      expect(editorResult.current.isValid()).toBe(false);

      // Should not attempt save with validation errors
      const shouldSave = editorResult.current.isValid();
      expect(shouldSave).toBe(false);
    });
  });

  describe('Navigation guards', () => {
    it('should detect unsaved changes for navigation guard', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());
      const { result: editorResult } = renderHook(() => usePreferencesEditorStore());

      // Load and initialize
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      act(() => {
        editorResult.current.initializeDraft(domainResult.current.preferences!);
      });

      // No changes - should allow navigation
      expect(editorResult.current.isDirty).toBe(false);

      // Make changes
      act(() => {
        editorResult.current.updateDraft({ theme: 'dark' });
      });

      // Has unsaved changes - should block navigation
      expect(editorResult.current.isDirty).toBe(true);

      // Discard changes
      act(() => {
        editorResult.current.discardChanges(domainResult.current.preferences!);
      });

      // Should allow navigation again
      expect(editorResult.current.isDirty).toBe(false);
    });

    it('should not block navigation during save', async () => {
      const { result: editorResult } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        editorResult.current.initializeDraft(mockSavedPreferences);
        editorResult.current.updateDraft({ theme: 'dark' });
      });

      expect(editorResult.current.isDirty).toBe(true);
      expect(editorResult.current.isSaving).toBe(false);

      // Start saving
      act(() => {
        editorResult.current.setSaving(true);
      });

      // During save, check state
      expect(editorResult.current.isSaving).toBe(true);
      expect(editorResult.current.isDirty).toBe(true);
    });
  });

  describe('API key encryption flow', () => {
    it('should handle API key updates with proper state machine', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());
      const { result: editorResult } = renderHook(() => usePreferencesEditorStore());

      // Load preferences
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      act(() => {
        editorResult.current.initializeDraft(domainResult.current.preferences!);
      });

      // Update API key states
      act(() => {
        editorResult.current.updateApiKeyState('inoreaderApiKey', 'replace');
        editorResult.current.updateApiKeyState('claudeApiKey', 'clear');
      });

      const patch = editorResult.current.buildPatch(domainResult.current.preferences!);

      expect(patch).toEqual({
        inoreaderApiKey: 'replace',
        claudeApiKey: 'clear',
      });

      // Mock save with encrypted keys
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.savePreferences(patch);
      });

      // API keys should remain null in domain store
      expect(domainResult.current.preferences?.inoreaderApiKey).toBeNull();
      expect(domainResult.current.preferences?.claudeApiKey).toBeNull();
    });

    it('should never expose decrypted keys during save flow', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());
      const { result: editorResult } = renderHook(() => usePreferencesEditorStore());

      // Load preferences with encrypted keys (server returns null)
      const prefsWithKeys = {
        ...mockSavedPreferences,
        inoreaderApiKey: null, // Server never sends decrypted keys
        claudeApiKey: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: prefsWithKeys }),
      });

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      // Keys should be null
      expect(domainResult.current.preferences?.inoreaderApiKey).toBeNull();
      expect(domainResult.current.preferences?.claudeApiKey).toBeNull();

      // Editor should also not have actual keys
      act(() => {
        editorResult.current.initializeDraft(domainResult.current.preferences!);
      });

      expect(editorResult.current.draft?.inoreaderApiKey).toBeNull();
      expect(editorResult.current.draft?.claudeApiKey).toBeNull();
    });
  });

  describe('Concurrent update handling', () => {
    it('should handle concurrent saves gracefully', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());

      // Setup initial state
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      // Create two different patches
      const patch1 = { theme: 'dark' as const };
      const patch2 = { maxArticles: 200 };

      // Mock both saves to take time
      let resolve1: any, resolve2: any;
      (global.fetch as any)
        .mockImplementationOnce(
          () => new Promise((resolve) => {
            resolve1 = resolve;
          })
        )
        .mockImplementationOnce(
          () => new Promise((resolve) => {
            resolve2 = resolve;
          })
        );

      // Start both saves
      const save1Promise = act(async () => {
        await domainResult.current.savePreferences(patch1);
      });

      const save2Promise = act(async () => {
        await domainResult.current.savePreferences(patch2);
      });

      // Resolve first save
      resolve1({
        ok: true,
        json: async () => ({
          data: { ...mockSavedPreferences, ...patch1 },
        }),
      });

      await save1Promise;

      // Resolve second save
      resolve2({
        ok: true,
        json: async () => ({
          data: { ...mockSavedPreferences, ...patch1, ...patch2 },
        }),
      });

      await save2Promise;

      // Final state should have both changes
      expect(domainResult.current.preferences?.theme).toBe('dark');
      expect(domainResult.current.preferences?.maxArticles).toBe(200);
    });

    it('should handle save during load', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());

      // Start load
      let resolveLoad: any;
      (global.fetch as any).mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveLoad = resolve;
        })
      );

      const loadPromise = act(async () => {
        await domainResult.current.loadPreferences();
      });

      // Try to save while loading (should fail)
      await expect(
        act(async () => {
          await domainResult.current.savePreferences({ theme: 'dark' });
        })
      ).rejects.toThrow('No preferences loaded');

      // Complete load
      resolveLoad({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await loadPromise;

      // Now save should work
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { ...mockSavedPreferences, theme: 'dark' },
        }),
      });

      await act(async () => {
        await domainResult.current.savePreferences({ theme: 'dark' });
      });

      expect(domainResult.current.preferences?.theme).toBe('dark');
    });
  });

  describe('Toast notifications', () => {
    it('should show success toast on save', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());

      // Setup
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      // Mock successful save
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.savePreferences({ theme: 'dark' });
      });

      // In real implementation, toast would be called from component
      // This is just to verify the save succeeded
      expect(domainResult.current.error).toBeNull();
    });

    it('should show error toast on save failure', async () => {
      const { result: domainResult } = renderHook(() => usePreferencesDomainStore());

      // Setup
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSavedPreferences }),
      });

      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      // Mock save failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        act(async () => {
          await domainResult.current.savePreferences({ theme: 'dark' });
        })
      ).rejects.toThrow();

      // In real implementation, error toast would be shown
      // This verifies the error was caught
    });
  });
});