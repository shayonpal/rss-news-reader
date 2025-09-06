/**
 * RR-270: Domain Store Tests - App-wide saved preferences
 * 
 * Tests the read-only domain store that holds saved preferences
 * for use throughout the application. Ensures API key security
 * and proper state management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePreferencesDomainStore } from '@/lib/stores/preferences-domain-store';
import type { PreferencesData } from '@/types/preferences';

// Mock fetch globally
global.fetch = vi.fn();

describe('PreferencesDomainStore - RR-270', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    usePreferencesDomainStore.setState({
      savedPreferences: null,
      isLoading: false,
      error: null,
      lastSync: null,
    });
  });

  describe('Initial State', () => {
    it('should have null preferences initially', () => {
      const { result } = renderHook(() => usePreferencesDomainStore());
      
      expect(result.current.savedPreferences).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastSync).toBeNull();
    });
  });

  describe('Load Preferences', () => {
    it('should load preferences from API with defaults merged', async () => {
      const mockResponse: PreferencesData = {
        ai: {
          hasApiKey: true, // Never actual key
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePreferencesDomainStore());

      await act(async () => {
        await result.current.loadPreferences();
      });

      expect(result.current.savedPreferences).toEqual(mockResponse);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastSync).toBeInstanceOf(Date);
    });

    it('should handle loading state correctly', async () => {
      (global.fetch as any).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => usePreferencesDomainStore());

      act(() => {
        result.current.loadPreferences();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => usePreferencesDomainStore());

      await act(async () => {
        await result.current.loadPreferences();
      });

      expect(result.current.savedPreferences).toBeNull();
      expect(result.current.error).toBe('Failed to load preferences');
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle 404 as new user with defaults', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => usePreferencesDomainStore());

      await act(async () => {
        await result.current.loadPreferences();
      });

      // Should have default preferences
      expect(result.current.savedPreferences).toEqual({
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      });
    });
  });

  describe('Save Preferences', () => {
    it('should save preferences with patch semantics', async () => {
      // Initial state
      const initialPrefs: PreferencesData = {
        ai: {
          hasApiKey: true,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      usePreferencesDomainStore.setState({
        savedPreferences: initialPrefs,
      });

      const patch = {
        sync: {
          maxArticles: 1000,
        },
      };

      const updatedPrefs = {
        ...initialPrefs,
        sync: {
          ...initialPrefs.sync,
          maxArticles: 1000,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedPrefs,
      });

      const { result } = renderHook(() => usePreferencesDomainStore());

      await act(async () => {
        await result.current.savePreferences(patch);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/preferences',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patch),
        })
      );

      expect(result.current.savedPreferences).toEqual(updatedPrefs);
    });

    it('should perform optimistic update and rollback on failure', async () => {
      const initialPrefs: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      usePreferencesDomainStore.setState({
        savedPreferences: initialPrefs,
      });

      const patch = {
        sync: {
          maxArticles: 1000,
        },
      };

      (global.fetch as any).mockRejectedValueOnce(new Error('Save failed'));

      const { result } = renderHook(() => usePreferencesDomainStore());

      await act(async () => {
        try {
          await result.current.savePreferences(patch);
        } catch (e) {
          // Expected to throw
        }
      });

      // Should rollback to original preferences
      expect(result.current.savedPreferences).toEqual(initialPrefs);
      expect(result.current.error).toBe('Failed to save preferences');
    });

    it('should handle concurrent saves correctly', async () => {
      const initialPrefs: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      usePreferencesDomainStore.setState({
        savedPreferences: initialPrefs,
      });

      let resolveFirst: any;
      let resolveSecond: any;

      (global.fetch as any)
        .mockImplementationOnce(
          () => new Promise(resolve => {
            resolveFirst = resolve;
          })
        )
        .mockImplementationOnce(
          () => new Promise(resolve => {
            resolveSecond = resolve;
          })
        );

      const { result } = renderHook(() => usePreferencesDomainStore());

      // Start two saves
      const save1Promise = result.current.savePreferences({
        sync: { maxArticles: 1000 },
      });
      const save2Promise = result.current.savePreferences({
        sync: { maxArticles: 2000 },
      });

      // Second save should be rejected immediately
      await expect(save2Promise).rejects.toThrow('Save already in progress');

      // Complete first save
      resolveFirst({
        ok: true,
        json: async () => ({
          ...initialPrefs,
          sync: { ...initialPrefs.sync, maxArticles: 1000 },
        }),
      });

      await save1Promise;

      expect(result.current.savedPreferences?.sync?.maxArticles).toBe(1000);
    });
  });

  describe('API Key Security', () => {
    it('should never expose actual API keys', async () => {
      const mockResponse = {
        ai: {
          hasApiKey: true, // Boolean only
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePreferencesDomainStore());

      await act(async () => {
        await result.current.loadPreferences();
      });

      // Should only have boolean, never actual key
      expect(result.current.savedPreferences?.ai?.hasApiKey).toBe(true);
      expect(result.current.savedPreferences?.ai).not.toHaveProperty('apiKey');
    });

    it('should handle API key updates via state machine', async () => {
      const initialPrefs: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      usePreferencesDomainStore.setState({
        savedPreferences: initialPrefs,
      });

      // Simulate save with API key change
      const patch = {
        ai: {
          apiKeyChange: 'replace',
          apiKey: 'sk-ant-xxx', // Will be encrypted server-side
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...initialPrefs,
          ai: {
            ...initialPrefs.ai,
            hasApiKey: true, // Server returns boolean
          },
        }),
      });

      const { result } = renderHook(() => usePreferencesDomainStore());

      await act(async () => {
        await result.current.savePreferences(patch);
      });

      // Should update hasApiKey but never store actual key
      expect(result.current.savedPreferences?.ai?.hasApiKey).toBe(true);
      expect(result.current.savedPreferences?.ai).not.toHaveProperty('apiKey');
    });
  });

  describe('Reset Store', () => {
    it('should reset store to initial state', () => {
      const mockPrefs: PreferencesData = {
        ai: {
          hasApiKey: true,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      usePreferencesDomainStore.setState({
        savedPreferences: mockPrefs,
        isLoading: false,
        error: 'Some error',
        lastSync: new Date(),
      });

      const { result } = renderHook(() => usePreferencesDomainStore());

      act(() => {
        result.current.resetStore();
      });

      expect(result.current.savedPreferences).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastSync).toBeNull();
    });
  });

  describe('Selectors', () => {
    it('should provide hasApiKey selector', () => {
      const mockPrefs: PreferencesData = {
        ai: {
          hasApiKey: true,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 500,
          retentionCount: 30,
        },
      };

      usePreferencesDomainStore.setState({
        savedPreferences: mockPrefs,
      });

      const { result } = renderHook(() => 
        usePreferencesDomainStore(state => state.savedPreferences?.ai?.hasApiKey)
      );

      expect(result.current).toBe(true);
    });

    it('should provide sync preferences selector', () => {
      const mockPrefs: PreferencesData = {
        ai: {
          hasApiKey: false,
          model: 'claude-3-haiku-20240307',
          summaryLengthMin: 100,
          summaryLengthMax: 300,
          summaryStyle: 'objective',
          contentFocus: 'general',
        },
        sync: {
          maxArticles: 1000,
          retentionCount: 60,
        },
      };

      usePreferencesDomainStore.setState({
        savedPreferences: mockPrefs,
      });

      const { result } = renderHook(() => 
        usePreferencesDomainStore(state => state.savedPreferences?.sync)
      );

      expect(result.current).toEqual({
        maxArticles: 1000,
        retentionCount: 60,
      });
    });
  });
});