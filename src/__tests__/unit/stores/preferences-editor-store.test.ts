/**
 * RR-270: Editor Store Tests - Settings page draft state
 *
 * Tests the editor store that manages draft state on the settings page.
 * Includes dirty tracking, validation, and API key state machine.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePreferencesEditorStore } from "@/lib/stores/preferences-editor-store";
import type { PreferencesData } from "@/types/preferences";

describe("PreferencesEditorStore - RR-270", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    usePreferencesEditorStore.setState({
      draft: null,
      errors: {},
      isSaving: false,
      apiKeyState: "unchanged",
    });
  });

  afterEach(() => {
    // Ensure memory cleanup
    usePreferencesEditorStore.getState().clearDraft();
  });

  describe("Initial State", () => {
    it("should have null draft initially", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      expect(result.current.draft).toBeNull();
      expect(result.current.errors).toEqual({});
      expect(result.current.isSaving).toBe(false);
      expect(result.current.apiKeyState).toBe("unchanged");
    });
  });

  describe("Draft Initialization", () => {
    it("should initialize draft from saved preferences", () => {
      const savedPrefs: PreferencesData = {
        ai: {
          hasApiKey: true,
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
      });

      expect(result.current.draft).toEqual(savedPrefs);
      expect(result.current.apiKeyState).toBe("unchanged");
    });

    it("should use defaults for missing fields", () => {
      const partialPrefs: Partial<PreferencesData> = {
        ai: {
          hasApiKey: false,
          model: "claude-3-haiku-20240307",
        },
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(partialPrefs as PreferencesData);
      });

      // Should merge with defaults
      expect(result.current.draft?.ai?.summaryLengthMin).toBe(100);
      expect(result.current.draft?.ai?.summaryLengthMax).toBe(300);
      expect(result.current.draft?.sync?.maxArticles).toBe(500);
    });
  });

  describe("Dirty State Tracking", () => {
    it("should not be dirty when draft matches saved", () => {
      const savedPrefs: PreferencesData = {
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
      });

      expect(result.current.isDirty(savedPrefs)).toBe(false);
    });

    it("should be dirty when draft differs from saved", () => {
      const savedPrefs: PreferencesData = {
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        result.current.updateField("sync.maxArticles", 1000);
      });

      expect(result.current.isDirty(savedPrefs)).toBe(true);
    });

    it("should be dirty when API key state changes", () => {
      const savedPrefs: PreferencesData = {
        ai: {
          hasApiKey: true,
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        result.current.setApiKeyState("clear");
      });

      expect(result.current.isDirty(savedPrefs)).toBe(true);
      expect(result.current.apiKeyState).toBe("clear");
    });
  });

  describe("Field Updates", () => {
    it("should update nested fields using dot notation", () => {
      const savedPrefs: PreferencesData = {
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        result.current.updateField("ai.model", "claude-3-sonnet-20240229");
        result.current.updateField("sync.maxArticles", 1000);
      });

      expect(result.current.draft?.ai?.model).toBe("claude-3-sonnet-20240229");
      expect(result.current.draft?.sync?.maxArticles).toBe(1000);
    });

    it("should validate and clamp numeric fields", () => {
      const savedPrefs: PreferencesData = {
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        // Try to set beyond valid range
        result.current.updateField("sync.maxArticles", 10000);
        result.current.updateField("sync.retentionCount", 0);
      });

      // Should clamp to valid range
      expect(result.current.draft?.sync?.maxArticles).toBe(5000); // Max
      expect(result.current.draft?.sync?.retentionCount).toBe(1); // Min
    });

    it("should enforce summary length min/max relationship", () => {
      const savedPrefs: PreferencesData = {
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        // Try to set min > max
        result.current.updateField("ai.summaryLengthMin", 400);
      });

      // Should adjust max to be >= min
      expect(result.current.draft?.ai?.summaryLengthMin).toBe(400);
      expect(result.current.draft?.ai?.summaryLengthMax).toBeGreaterThanOrEqual(
        400
      );
    });
  });

  describe("API Key State Machine", () => {
    it("should transition through API key states", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      expect(result.current.apiKeyState).toBe("unchanged");

      act(() => {
        result.current.setApiKeyState("replace");
      });
      expect(result.current.apiKeyState).toBe("replace");

      act(() => {
        result.current.setApiKeyState("clear");
      });
      expect(result.current.apiKeyState).toBe("clear");

      act(() => {
        result.current.setApiKeyState("unchanged");
      });
      expect(result.current.apiKeyState).toBe("unchanged");
    });

    it("should handle API key input", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.setApiKeyInput("sk-ant-api03-xxx");
      });

      expect(result.current.apiKeyState).toBe("replace");
      expect(result.current.getApiKeyInput()).toBe("sk-ant-api03-xxx");
    });

    it("should clear API key input on state reset", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.setApiKeyInput("sk-ant-api03-xxx");
        result.current.setApiKeyState("unchanged");
      });

      expect(result.current.getApiKeyInput()).toBe("");
    });
  });

  describe("Validation", () => {
    it("should validate required fields", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft({
          ai: {
            hasApiKey: false,
            model: "", // Invalid - required
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
        result.current.validateAll();
      });

      expect(result.current.errors["ai.model"]).toBe("Model is required");
    });

    it("should validate enum fields", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft({
          ai: {
            hasApiKey: false,
            model: "claude-3-haiku-20240307",
            summaryLengthMin: 100,
            summaryLengthMax: 300,
            summaryStyle: "invalid" as any, // Invalid enum
            contentFocus: "general",
          },
          sync: {
            maxArticles: 500,
            retentionCount: 30,
          },
        });
        result.current.validateAll();
      });

      expect(result.current.errors["ai.summaryStyle"]).toBe(
        "Invalid summary style"
      );
    });

    it("should clear errors on valid input", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft({
          ai: {
            hasApiKey: false,
            model: "", // Invalid - will cause error
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
        result.current.validateField("ai.model");
      });

      expect(result.current.errors["ai.model"]).toBeDefined();

      act(() => {
        // Set valid value
        result.current.updateField("ai.model", "claude-3-haiku-20240307");
        result.current.validateField("ai.model");
      });

      expect(result.current.errors["ai.model"]).toBeUndefined();
    });
  });

  describe("Patch Building", () => {
    it("should build minimal patch for changes", () => {
      const savedPrefs: PreferencesData = {
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        result.current.updateField("sync.maxArticles", 1000);
      });

      const patch = result.current.buildPatch(savedPrefs);

      expect(patch).toEqual({
        sync: {
          maxArticles: 1000,
        },
      });
    });

    it("should include API key changes in patch", () => {
      const savedPrefs: PreferencesData = {
        ai: {
          hasApiKey: true,
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        result.current.setApiKeyInput("sk-ant-new-key");
      });

      const patch = result.current.buildPatch(savedPrefs);

      expect(patch).toEqual({
        ai: {
          apiKeyChange: "replace",
          apiKey: "sk-ant-new-key",
        },
      });
    });

    it("should handle API key clear in patch", () => {
      const savedPrefs: PreferencesData = {
        ai: {
          hasApiKey: true,
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
        result.current.setApiKeyState("clear");
      });

      const patch = result.current.buildPatch(savedPrefs);

      expect(patch).toEqual({
        ai: {
          apiKeyChange: "clear",
          apiKey: null,
        },
      });
    });

    it("should return empty patch when nothing changed", () => {
      const savedPrefs: PreferencesData = {
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
      };

      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft(savedPrefs);
      });

      const patch = result.current.buildPatch(savedPrefs);

      expect(patch).toEqual({});
    });
  });

  describe("Memory Cleanup", () => {
    it("should clear draft and sensitive data on unmount", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.initializeDraft({
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
        result.current.setApiKeyInput("sk-ant-sensitive");
        result.current.clearDraft();
      });

      expect(result.current.draft).toBeNull();
      expect(result.current.apiKeyState).toBe("unchanged");
      expect(result.current.getApiKeyInput()).toBe("");
      expect(result.current.errors).toEqual({});
    });
  });

  describe("Save Flow", () => {
    it("should handle save in progress state", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      expect(result.current.isSaving).toBe(false);

      act(() => {
        result.current.setSaving(true);
      });

      expect(result.current.isSaving).toBe(true);

      act(() => {
        result.current.setSaving(false);
      });

      expect(result.current.isSaving).toBe(false);
    });

    it("should reset API key state after successful save", () => {
      const { result } = renderHook(() => usePreferencesEditorStore());

      act(() => {
        result.current.setApiKeyInput("sk-ant-new-key");
        result.current.onSaveSuccess();
      });

      expect(result.current.apiKeyState).toBe("unchanged");
      expect(result.current.getApiKeyInput()).toBe("");
    });
  });
});
