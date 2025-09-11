/**
 * @fileoverview Unit tests for usePreferencesForm hook - RR-288
 * Tests toast notifications and loading states for settings form
 * Following TDD approach - tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePreferencesForm } from "@/lib/hooks/usePreferencesForm";
import { toast } from "sonner";
import type { UserPreferences } from "@/types/preferences";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/lib/stores/preferences-editor-store", () => ({
  usePreferencesEditorStore: vi.fn(() => ({
    draft: { sync: { maxArticles: 100 } },
    errors: {},
    isSaving: false,
    apiKeyState: { isValid: true, isLoading: false },
    buildPatch: vi.fn().mockReturnValue({ sync: { maxArticles: 100 } }),
    setSaving: vi.fn(),
    clearDraft: vi.fn(),
    updateField: vi.fn(),
    setApiKeyInput: vi.fn(),
    getApiKeyInput: vi.fn(() => ""),
    isDirty: vi.fn(() => false),
    initializeDraft: vi.fn(),
  })),
}));

vi.mock("@/lib/stores/preferences-domain-store", () => ({
  usePreferencesDomainStore: vi.fn(() => ({
    savedPreferences: {} as any,
    savePreferences: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    error: null,
    loadPreferences: vi.fn(),
  })),
}));

describe("usePreferencesForm Hook - RR-288 Toast Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Toast Notification Integration", () => {
    it("should show success toast with correct message and className on successful save", async () => {
      // Import mocked stores
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };
      const setSavingCallback: (saving: boolean) => void = () => {};

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          editorStore.isSaving = saving;
          setSavingCallback(saving);
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Save preferences
      await act(async () => {
        await result.current.handleSave();
      });

      // Assert: Success toast shown with correct props
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Preferences saved", {
          className: "toast-success",
          duration: 3000,
        });
      });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it("should show error toast with retry action on save failure", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };
      const saveError = new Error("Network error");

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          editorStore.isSaving = saving;
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockRejectedValue(saveError),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Save preferences (will fail)
      await act(async () => {
        await result.current.handleSave();
      });

      // Assert: Error toast shown with retry action
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Couldn't save preferences. Please retry.",
          {
            className: "toast-error",
            duration: 5000,
            action: {
              label: "Retry",
              onClick: expect.any(Function),
            },
          }
        );
      });

      expect(toast.success).not.toHaveBeenCalled();

      // Test retry action
      const errorCall = vi.mocked(toast.error).mock.calls[0];
      const retryAction = errorCall[1]?.action as { onClick: () => void };

      // Reset mocks and make save succeed this time
      vi.clearAllMocks();
      domainStore.savePreferences.mockResolvedValue(undefined);

      // Click retry
      await act(async () => {
        retryAction.onClick();
      });

      // Should now show success toast
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Preferences saved", {
          className: "toast-success",
          duration: 3000,
        });
      });
    });

    it("should not show any toast when save is called with no changes", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const editorStore = {
        draft: null,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(null), // No changes
        setSaving: vi.fn(),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => false),
      };

      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn(),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Save with no changes
      await act(async () => {
        await result.current.handleSave();
      });

      // Assert: No toasts shown
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(domainStore.savePreferences).not.toHaveBeenCalled();
    });
  });

  describe("Loading State Management", () => {
    it("should set isSaving to true during save operation", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };
      const savingStates: boolean[] = [];

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          savingStates.push(saving);
          editorStore.isSaving = saving;
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      let savePromiseResolve: () => void;
      const savePromise = new Promise<void>((resolve) => {
        savePromiseResolve = resolve;
      });

      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockImplementation(() => savePromise),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Start save
      const savePromiseResult = act(async () => {
        await result.current.handleSave();
      });

      // Assert: isSaving should be true immediately
      expect(savingStates).toContain(true);
      expect(result.current.isSaving).toBe(true);

      // Resolve save operation
      savePromiseResolve!();
      await savePromiseResult;

      // Assert: isSaving should be false after completion
      await waitFor(() => {
        expect(savingStates).toEqual([true, false]);
        expect(result.current.isSaving).toBe(false);
      });
    });

    it("should reset isSaving to false even when save fails", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };
      const savingStates: boolean[] = [];

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          savingStates.push(saving);
          editorStore.isSaving = saving;
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockRejectedValue(new Error("Save failed")),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Save (will fail)
      await act(async () => {
        await result.current.handleSave();
      });

      // Assert: isSaving should be set to true then false
      expect(savingStates).toEqual([true, false]);
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("Concurrent Operations", () => {
    it("should prevent concurrent save operations", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };
      let currentlySaving = false;

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          currentlySaving = saving;
          editorStore.isSaving = saving;
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      const saveCallCount = { count: 0 };
      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockImplementation(async () => {
          saveCallCount.count++;
          // Simulate slow save
          await new Promise((resolve) => setTimeout(resolve, 100));
        }),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Trigger multiple saves rapidly
      const savePromises = await act(async () => {
        const promises = [
          result.current.handleSave(),
          result.current.handleSave(),
          result.current.handleSave(),
        ];
        return Promise.all(promises);
      });

      // Assert: Only one save should be processed
      await waitFor(() => {
        expect(saveCallCount.count).toBe(1);
      });
    });
  });

  describe("Mobile Performance", () => {
    it("should handle rapid button clicks without performance degradation", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };
      const performanceMarks: number[] = [];

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          performanceMarks.push(performance.now());
          editorStore.isSaving = saving;
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Simulate rapid clicking (mobile double-tap scenario)
      const startTime = performance.now();

      await act(async () => {
        // Rapid clicks within 50ms
        for (let i = 0; i < 5; i++) {
          result.current.handleSave();
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert: Should complete quickly despite rapid clicks
      expect(totalTime).toBeLessThan(3000); // Mobile performance requirement
      expect(domainStore.savePreferences).toHaveBeenCalledTimes(1); // Debounced to single call
    });
  });

  describe("Network Failure Scenarios", () => {
    it("should handle network timeout gracefully", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          editorStore.isSaving = saving;
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      // Simulate network timeout
      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockImplementation(
          () =>
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Network timeout")), 5000);
            })
        ),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: Save with timeout
      vi.useFakeTimers();
      const savePromise = act(async () => {
        await result.current.handleSave();
      });

      // Fast-forward time
      vi.advanceTimersByTime(5000);
      await savePromise;
      vi.useRealTimers();

      // Assert: Error toast shown for timeout
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't save preferences. Please retry.",
        expect.objectContaining({
          className: "toast-error",
          action: expect.objectContaining({
            label: "Retry",
          }),
        })
      );
    });

    it("should handle intermittent network failures with retry", async () => {
      const { usePreferencesEditorStore } = await import(
        "@/lib/stores/preferences-editor-store"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockPatch = { sync: { maxArticles: 100 } };
      let attemptCount = 0;

      const editorStore = {
        draft: mockPatch,
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        buildPatch: vi.fn().mockReturnValue(mockPatch),
        setSaving: vi.fn((saving: boolean) => {
          editorStore.isSaving = saving;
        }),
        clearDraft: vi.fn(),
        updateField: vi.fn(),
        setApiKeyInput: vi.fn(),
        getApiKeyInput: vi.fn(() => ""),
        isDirty: vi.fn(() => true),
      };

      // Fail first 2 attempts, succeed on 3rd
      const domainStore = {
        savedPreferences: {} as UserPreferences,
        savePreferences: vi.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve();
        }),
      };

      vi.mocked(usePreferencesEditorStore).mockReturnValue(editorStore);
      vi.mocked(usePreferencesDomainStore).mockReturnValue(domainStore);

      const { result } = renderHook(() => usePreferencesForm());

      // Act: First save attempt (will fail)
      await act(async () => {
        await result.current.handleSave();
      });

      expect(toast.error).toHaveBeenCalledTimes(1);

      // Get retry action from error toast
      const errorCall = vi.mocked(toast.error).mock.calls[0];
      const retryAction = errorCall[1]?.action as { onClick: () => void };

      // Second attempt via retry (will fail)
      vi.clearAllMocks();
      await act(async () => {
        retryAction.onClick();
      });

      expect(toast.error).toHaveBeenCalledTimes(1);

      // Third attempt via retry (will succeed)
      const secondErrorCall = vi.mocked(toast.error).mock.calls[0];
      const secondRetryAction = secondErrorCall[1]?.action as {
        onClick: () => void;
      };

      vi.clearAllMocks();
      await act(async () => {
        secondRetryAction.onClick();
      });

      // Assert: Success after retries
      expect(toast.success).toHaveBeenCalledWith("Preferences saved", {
        className: "toast-success",
        duration: 3000,
      });
      expect(attemptCount).toBe(3);
    });
  });
});
