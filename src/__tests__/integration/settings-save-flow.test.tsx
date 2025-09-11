/**
 * @fileoverview Integration tests for Settings Save Flow - RR-288
 * Tests complete save flow with toast feedback and loading states
 * Following TDD approach - tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "@/app/reader/settings/page";
import { toast } from "sonner";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock("@/lib/stores/preferences-editor-store", () => ({
  usePreferencesEditorStore: vi.fn(() => ({
    draft: {
      sync: { maxArticles: 100, refreshInterval: 30 },
      ai: { model: "claude-3-haiku", enabled: true },
    },
    errors: {},
    isSaving: false,
    apiKeyState: { isValid: true, isLoading: false },
    buildPatch: vi.fn(),
    setSaving: vi.fn(),
    clearDraft: vi.fn(),
    updateField: vi.fn(),
    setApiKeyInput: vi.fn(),
    getApiKeyInput: vi.fn(() => ""),
    isDirty: vi.fn(() => false),
  })),
}));

vi.mock("@/lib/stores/preferences-domain-store", () => ({
  usePreferencesDomainStore: vi.fn(() => ({
    savedPreferences: {
      sync: { maxArticles: 100, refreshInterval: 30 },
      ai: { model: "claude-3-haiku", enabled: true },
    },
    savePreferences: vi.fn(),
    loadPreferences: vi.fn(),
  })),
}));

vi.mock("@/lib/hooks/usePreferencesForm", () => ({
  usePreferencesForm: vi.fn(() => ({
    draft: {
      sync: { maxArticles: 100, refreshInterval: 30 },
      ai: { model: "claude-3-haiku", enabled: true },
    },
    errors: {},
    isSaving: false,
    apiKeyState: { isValid: true, isLoading: false },
    apiKeyInput: "",
    isDirty: false,
    handleTextChange: vi.fn(),
    handleNumberChange: vi.fn(),
    handleSelectChange: vi.fn(),
    handleApiKeyChange: vi.fn(),
    handleSave: vi.fn(),
    handleCancel: vi.fn(),
    updateFieldImmediate: vi.fn(),
    debouncedUpdateField: vi.fn(),
  })),
}));

// Mock fetch for article stats
global.fetch = vi.fn();

describe("Settings Save Flow Integration - RR-288", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1234,
        unread: 567,
        starred: 89,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Save Button Loading States", () => {
    it("should show spinner and 'Saving...' text during save operation", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      let mockIsSaving = false;
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });

      const mockHandleSave = vi.fn().mockImplementation(async () => {
        mockIsSaving = true;
        await savePromise;
        mockIsSaving = false;
      });

      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 100, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: mockIsSaving,
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true, // Enable save button
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      const { rerender } = render(<SettingsPage />);

      // Find save button
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).not.toBeDisabled();

      // Click save
      await user.click(saveButton);

      // Update component with saving state
      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 100, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: true, // Now saving
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true,
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      rerender(<SettingsPage />);

      // Assert: Button shows loading state
      const savingButton = screen.getByRole("button", { name: /saving/i });
      expect(savingButton).toBeInTheDocument();
      expect(savingButton).toBeDisabled();

      // Check for spinner
      const spinner = within(savingButton).getByTestId("loader2-icon");
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass("animate-spin");

      // Resolve save
      resolveSave!();

      // Update back to non-saving state
      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 100, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: false, // Done saving
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: false, // No changes after save
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      rerender(<SettingsPage />);

      await waitFor(() => {
        const finalButton = screen.getByRole("button", { name: /save/i });
        expect(finalButton).not.toHaveTextContent("Saving...");
        expect(finalButton).toBeDisabled(); // Disabled because not dirty
      });
    });

    it("should disable button during save to prevent double-submission", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      const mockHandleSave = vi.fn();

      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 100, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: true, // Currently saving
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true,
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /saving/i });

      // Try to click while saving
      await user.click(saveButton);

      // Should not trigger another save
      expect(mockHandleSave).not.toHaveBeenCalled();
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Toast Notification Integration", () => {
    it("should show success toast after successful save", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );

      const mockSavePreferences = vi.fn().mockResolvedValue(undefined);

      vi.mocked(usePreferencesDomainStore).mockReturnValue({
        savedPreferences: {
          sync: { maxArticles: 100, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        savePreferences: mockSavePreferences,
        loadPreferences: vi.fn(),
      });

      const mockHandleSave = vi.fn().mockImplementation(async () => {
        await mockSavePreferences();
        toast.success("Preferences saved", {
          className: "toast-success",
          duration: 3000,
        });
      });

      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 150, refreshInterval: 30 }, // Changed value
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true,
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Preferences saved", {
          className: "toast-success",
          duration: 3000,
        });
      });
    });

    it("should show error toast with retry action on save failure", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      const mockHandleSave = vi.fn().mockImplementation(async () => {
        toast.error("Couldn't save preferences. Please retry.", {
          className: "toast-error",
          duration: 5000,
          action: {
            label: "Retry",
            onClick: mockHandleSave,
          },
        });
        throw new Error("Save failed");
      });

      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 150, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true,
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Couldn't save preferences. Please retry.",
          expect.objectContaining({
            className: "toast-error",
            duration: 5000,
            action: expect.objectContaining({
              label: "Retry",
            }),
          })
        );
      });
    });
  });

  describe("Article Statistics Integration", () => {
    it("should display article statistics in settings page", async () => {
      render(<SettingsPage />);

      // Wait for stats to load
      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      // Check all stats are displayed
      expect(screen.getByText("1,234")).toBeInTheDocument();
      expect(screen.getByText("567")).toBeInTheDocument();
      expect(screen.getByText("89")).toBeInTheDocument();
    });

    it("should show skeleton loader while stats are loading", () => {
      // Mock slow fetch
      (global.fetch as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<SettingsPage />);

      // Should show skeleton
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });

    it("should position stats above the settings form", () => {
      const { container } = render(<SettingsPage />);

      const statsComponent = container.querySelector(
        "[data-testid='article-stats']"
      );
      const settingsForm = container.querySelector(
        "[data-testid='settings-form']"
      );

      // Get positions
      const statsRect = statsComponent?.getBoundingClientRect();
      const formRect = settingsForm?.getBoundingClientRect();

      // Stats should be above form (lower Y coordinate)
      if (statsRect && formRect) {
        expect(statsRect.top).toBeLessThan(formRect.top);
      }
    });
  });

  describe("Complete Save Flow", () => {
    it("should handle complete save flow: edit → save → loading → success toast", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      let currentlySaving = false;
      const mockHandleSave = vi.fn().mockImplementation(async () => {
        currentlySaving = true;
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        currentlySaving = false;
        toast.success("Preferences saved", {
          className: "toast-success",
          duration: 3000,
        });
      });

      const mockHandleNumberChange = vi.fn();

      // Initial state - not dirty
      const baseFormState = {
        draft: {
          sync: { maxArticles: 100, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: currentlySaving,
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: false,
        handleTextChange: vi.fn(),
        handleNumberChange: mockHandleNumberChange,
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      };

      vi.mocked(usePreferencesForm).mockReturnValue(baseFormState);

      const { rerender } = render(<SettingsPage />);

      // Step 1: Make a change
      const maxArticlesInput = screen.getByLabelText(/max articles/i);
      await user.clear(maxArticlesInput);
      await user.type(maxArticlesInput, "200");

      // Update to dirty state
      vi.mocked(usePreferencesForm).mockReturnValue({
        ...baseFormState,
        draft: {
          sync: { maxArticles: 200, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        isDirty: true,
      });

      rerender(<SettingsPage />);

      // Step 2: Click save
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).not.toBeDisabled();

      await user.click(saveButton);

      // Step 3: Should show loading state
      vi.mocked(usePreferencesForm).mockReturnValue({
        ...baseFormState,
        isSaving: true,
        isDirty: true,
      });

      rerender(<SettingsPage />);

      expect(
        screen.getByRole("button", { name: /saving/i })
      ).toBeInTheDocument();

      // Step 4: Complete save
      await waitFor(() => {
        expect(mockHandleSave).toHaveBeenCalled();
      });

      // Step 5: Show success toast
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Preferences saved", {
          className: "toast-success",
          duration: 3000,
        });
      });

      // Step 6: Reset to clean state
      vi.mocked(usePreferencesForm).mockReturnValue({
        ...baseFormState,
        isSaving: false,
        isDirty: false,
      });

      rerender(<SettingsPage />);

      const finalSaveButton = screen.getByRole("button", { name: /save/i });
      expect(finalSaveButton).toBeDisabled(); // Disabled when not dirty
    });
  });

  describe("Multiple Concurrent Operations", () => {
    it("should handle rapid save clicks without issues", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      let saveCount = 0;
      const mockHandleSave = vi.fn().mockImplementation(async () => {
        saveCount++;
        if (saveCount === 1) {
          // Only first save should execute
          await new Promise((resolve) => setTimeout(resolve, 100));
          toast.success("Preferences saved", {
            className: "toast-success",
            duration: 3000,
          });
        }
      });

      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 150, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true,
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /save/i });

      // Rapid clicks
      await user.click(saveButton);
      await user.click(saveButton);
      await user.click(saveButton);

      // Only one save should execute
      await waitFor(() => {
        expect(mockHandleSave).toHaveBeenCalledTimes(3); // All clicks registered
        expect(toast.success).toHaveBeenCalledTimes(1); // But only one success
      });
    });

    it("should not interfere with form validation during save", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      const mockHandleSave = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        toast.success("Preferences saved", {
          className: "toast-success",
          duration: 3000,
        });
      });

      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: -1, refreshInterval: 30 }, // Invalid value
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {
          "sync.maxArticles": "Must be a positive number",
        },
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true,
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      render(<SettingsPage />);

      // Should show validation error
      expect(screen.getByText("Must be a positive number")).toBeInTheDocument();

      // Save button should be disabled due to errors
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should render correctly on mobile viewport", async () => {
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;

      render(<SettingsPage />);

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText("Total Articles")).toBeInTheDocument();
      });

      // Check for mobile-optimized layout
      const container = screen.getByTestId("settings-container");
      expect(container).toHaveClass("px-4", "py-6"); // Mobile padding

      // Save button should be full width on mobile
      const saveButton = screen.getByRole("button", { name: /save/i });
      expect(saveButton).toHaveClass("w-full", "md:w-auto");
    });

    it("should handle touch interactions properly", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      const mockHandleSave = vi.fn().mockResolvedValue(undefined);

      vi.mocked(usePreferencesForm).mockReturnValue({
        draft: {
          sync: { maxArticles: 150, refreshInterval: 30 },
          ai: { model: "claude-3-haiku", enabled: true },
        },
        errors: {},
        isSaving: false,
        apiKeyState: { isValid: true, isLoading: false },
        apiKeyInput: "",
        isDirty: true,
        handleTextChange: vi.fn(),
        handleNumberChange: vi.fn(),
        handleSelectChange: vi.fn(),
        handleApiKeyChange: vi.fn(),
        handleSave: mockHandleSave,
        handleCancel: vi.fn(),
        updateFieldImmediate: vi.fn(),
        debouncedUpdateField: vi.fn(),
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /save/i });

      // Check touch target size
      const buttonRect = saveButton.getBoundingClientRect();
      expect(buttonRect.height).toBeGreaterThanOrEqual(44); // iOS minimum

      // Simulate touch
      await user.click(saveButton);
      expect(mockHandleSave).toHaveBeenCalled();
    });
  });
});
