/**
 * Unit tests for Settings Page activation
 * RR-272: User preferences API integration with Settings page
 *
 * Tests the activation of the Settings page from skeleton to fully functional
 * form with Zustand store integration and API connectivity.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextRouter } from "next/router";
import SettingsPage from "@/app/settings/page";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    pathname: "/reader/settings",
  }),
}));

// Mock Zustand stores
vi.mock("@/lib/stores/preferences-domain-store", () => ({
  usePreferencesDomainStore: vi.fn(() => ({
    savedPreferences: {
      ai: {
        provider: "anthropic",
        apiKey: null,
        model: "claude-3-sonnet-20240229",
        enabled: true,
        summaryStyle: "objective",
        summaryLength: { min: 100, max: 300 },
        contentFocus: "general",
      },
      sync: {
        enabled: true,
        frequency: "auto",
        maxArticlesPerSync: 500,
        retentionDays: 30,
        retentionCount: 1000,
      },
    },
    isLoading: false,
    error: null,
    lastSync: new Date("2024-01-01T12:00:00Z"),
    saveInProgress: false,
    loadPreferences: vi.fn(),
    savePreferences: vi.fn(),
    resetStore: vi.fn(),
  })),
}));

vi.mock("@/lib/stores/preferences-editor-store", () => ({
  usePreferencesEditorStore: vi.fn(() => ({
    draftPreferences: null,
    apiKeyInput: "",
    hasChanges: false,
    isSaving: false,
    updateField: vi.fn(),
    setApiKeyInput: vi.fn(),
    buildPatch: vi.fn(),
    clearDraft: vi.fn(),
    setSaving: vi.fn(),
    loadFromDomain: vi.fn(),
  })),
}));

// Mock usePreferencesForm hook
vi.mock("@/lib/hooks/usePreferencesForm", () => ({
  usePreferencesForm: vi.fn(() => ({
    // Form state
    values: {
      ai: {
        apiKey: "",
        model: "claude-3-sonnet-20240229",
        summaryStyle: "objective",
        summaryLength: { min: 100, max: 300 },
        contentFocus: "general",
      },
      sync: {
        maxArticlesPerSync: 500,
        retentionCount: 1000,
      },
    },
    errors: {},
    hasChanges: false,
    isSaving: false,

    // Form handlers
    handleTextChange: vi.fn(),
    handleNumberChange: vi.fn(),
    handleSelectChange: vi.fn(),
    handleApiKeyChange: vi.fn(),
    handleRangeChange: vi.fn(),
    handleSave: vi.fn(),
    handleCancel: vi.fn(),
    handleReset: vi.fn(),

    // Article statistics
    articleStats: {
      totalArticles: 1234,
      starredArticles: 56,
      loading: false,
    },
  })),
}));

// Mock DualRangeSlider component (not yet implemented)
vi.mock("@/components/ui/dual-range-slider", () => ({
  DualRangeSlider: ({ label, minValue, maxValue, onChange, disabled }: any) => (
    <div data-testid="dual-range-slider" data-disabled={disabled}>
      <label>{label}</label>
      <span>
        {minValue} – {maxValue} words
      </span>
      <input
        type="range"
        aria-label="Minimum summary length"
        value={minValue}
        onChange={(e) =>
          onChange({ min: Number(e.target.value), max: maxValue })
        }
        disabled={disabled}
      />
      <input
        type="range"
        aria-label="Maximum summary length"
        value={maxValue}
        onChange={(e) =>
          onChange({ min: minValue, max: Number(e.target.value) })
        }
        disabled={disabled}
      />
    </div>
  ),
}));

// Mock toast notifications
vi.mock("@/lib/utils/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock AI models fetch
global.fetch = vi.fn();

describe("SettingsPage Activation", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock AI models API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
          { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
          { id: "claude-3-haiku-20240229", name: "Claude 3 Haiku" },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Component Activation", () => {
    it("should transition from skeleton to active forms on mount", async () => {
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );
      const loadPreferences = vi.fn();
      (usePreferencesDomainStore as any).mockReturnValueOnce({
        savedPreferences: null,
        isLoading: true,
        loadPreferences,
      });

      const { rerender } = render(<SettingsPage />);

      // Should show skeleton state initially
      expect(screen.getByTestId("ai-section-skeleton")).toHaveClass(
        "animate-pulse"
      );
      expect(screen.getByTestId("sync-section-skeleton")).toHaveClass(
        "animate-pulse"
      );

      // Mock data loaded
      (usePreferencesDomainStore as any).mockReturnValueOnce({
        savedPreferences: {
          ai: {
            provider: "anthropic",
            apiKey: null,
            model: "claude-3-sonnet-20240229",
            enabled: true,
            summaryStyle: "objective",
            summaryLength: { min: 100, max: 300 },
            contentFocus: "general",
          },
          sync: {
            enabled: true,
            frequency: "auto",
            maxArticlesPerSync: 500,
            retentionDays: 30,
            retentionCount: 1000,
          },
        },
        isLoading: false,
        loadPreferences,
      });

      rerender(<SettingsPage />);

      await waitFor(() => {
        // Forms should be active (not disabled)
        const apiKeyInput = screen.getByPlaceholderText(
          /Your API key is encrypted/i
        );
        expect(apiKeyInput).not.toBeDisabled();
        expect(apiKeyInput).not.toHaveClass("animate-pulse");
      });
    });

    it("should load user preferences on mount", async () => {
      const { usePreferencesDomainStore } = await import(
        "@/lib/stores/preferences-domain-store"
      );
      const loadPreferences = vi.fn();

      (usePreferencesDomainStore as any).mockReturnValue({
        savedPreferences: null,
        isLoading: false,
        loadPreferences,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(loadPreferences).toHaveBeenCalledTimes(1);
      });
    });

    it("should fetch and populate AI models dropdown", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const modelSelect = screen.getByLabelText(/Summarization Model/i);
        expect(modelSelect).not.toBeDisabled();

        const options = within(modelSelect).getAllByRole("option");
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveTextContent("Claude 3 Opus");
        expect(options[1]).toHaveTextContent("Claude 3 Sonnet");
        expect(options[2]).toHaveTextContent("Claude 3 Haiku");
      });
    });
  });

  describe("AI Summarization Section", () => {
    it("should handle API key input with secure placeholder", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const handleApiKeyChange = vi.fn();

      (usePreferencesForm as any).mockReturnValue({
        values: { ai: { apiKey: "" } },
        handleApiKeyChange,
        hasChanges: false,
      });

      render(<SettingsPage />);

      const apiKeyInput = screen.getByPlaceholderText(
        /Your API key is encrypted/i
      );
      expect(apiKeyInput).toHaveAttribute("type", "password");

      await user.type(apiKeyInput, "sk-test-key");

      expect(handleApiKeyChange).toHaveBeenCalled();
    });

    it("should render DualRangeSlider for summary length", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const slider = screen.getByTestId("dual-range-slider");
        expect(slider).toBeInTheDocument();
        expect(slider).toHaveTextContent("100 – 300 words");
        expect(slider).not.toHaveAttribute("data-disabled", "true");
      });
    });

    it("should handle summary style radio buttons", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const handleSelectChange = vi.fn();

      (usePreferencesForm as any).mockReturnValue({
        values: { ai: { summaryStyle: "objective" } },
        handleSelectChange,
      });

      render(<SettingsPage />);

      const objectiveRadio = screen.getByLabelText(/Objective/i);
      const analyticalRadio = screen.getByLabelText(/Analytical/i);
      const retrospectiveRadio = screen.getByLabelText(/Retrospective/i);

      expect(objectiveRadio).toBeChecked();
      expect(analyticalRadio).not.toBeChecked();
      expect(retrospectiveRadio).not.toBeChecked();

      await user.click(analyticalRadio);

      expect(handleSelectChange).toHaveBeenCalledWith("ai.summaryStyle");
    });

    it("should render Content Focus dropdown with 4 options", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const contentFocusSelect = screen.getByLabelText(/Content Focus/i);
        expect(contentFocusSelect).not.toBeDisabled();

        const options = within(contentFocusSelect).getAllByRole("option");
        expect(options).toHaveLength(4);
        expect(options[0]).toHaveTextContent("General (balanced overview)");
        expect(options[1]).toHaveTextContent(
          "Technical (code & implementation)"
        );
        expect(options[2]).toHaveTextContent("Business (strategy & impact)");
        expect(options[3]).toHaveTextContent(
          "Educational (concepts & learning)"
        );
      });
    });
  });

  describe("Sync Configuration Section", () => {
    it("should handle max articles per sync input with validation", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const handleNumberChange = vi.fn();

      (usePreferencesForm as any).mockReturnValue({
        values: { sync: { maxArticlesPerSync: 500 } },
        handleNumberChange,
        errors: {},
      });

      render(<SettingsPage />);

      // Expand sync section
      const syncSection = screen.getByText(/Sync Configuration/i);
      await user.click(syncSection);

      const maxArticlesInput = screen.getByLabelText(/Max Articles Per Sync/i);
      expect(maxArticlesInput).toHaveAttribute("type", "number");
      expect(maxArticlesInput).toHaveAttribute("min", "10");
      expect(maxArticlesInput).toHaveAttribute("max", "5000");
      expect(maxArticlesInput).toHaveValue(500);

      await user.clear(maxArticlesInput);
      await user.type(maxArticlesInput, "1000");

      expect(handleNumberChange).toHaveBeenCalledWith(
        "sync.maxArticlesPerSync"
      );
    });

    it("should handle retention count input with validation", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const handleNumberChange = vi.fn();

      (usePreferencesForm as any).mockReturnValue({
        values: { sync: { retentionCount: 1000 } },
        handleNumberChange,
        errors: {},
      });

      render(<SettingsPage />);

      // Expand sync section
      const syncSection = screen.getByText(/Sync Configuration/i);
      await user.click(syncSection);

      const retentionInput = screen.getByLabelText(/Maximum Articles to Keep/i);
      expect(retentionInput).toHaveAttribute("min", "100");
      expect(retentionInput).toHaveAttribute("max", "5000");
      expect(retentionInput).toHaveValue(1000);

      // Test increment/decrement buttons
      const incrementBtn = screen.getByRole("button", { name: /increment/i });
      const decrementBtn = screen.getByRole("button", { name: /decrement/i });

      await user.click(incrementBtn);
      expect(handleNumberChange).toHaveBeenCalledWith("sync.retentionCount");
    });

    it("should display article statistics from database", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      (usePreferencesForm as any).mockReturnValue({
        articleStats: {
          totalArticles: 1234,
          starredArticles: 56,
          loading: false,
        },
      });

      render(<SettingsPage />);

      // Expand sync section
      const syncSection = screen.getByText(/Sync Configuration/i);
      await user.click(syncSection);

      await waitFor(() => {
        expect(screen.getByText(/Current articles:/i)).toBeInTheDocument();
        expect(screen.getByText("1,234")).toBeInTheDocument();
        expect(screen.getByText(/Starred articles:/i)).toBeInTheDocument();
        expect(screen.getByText("56")).toBeInTheDocument();
      });
    });

    it("should show loading state for article statistics", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      (usePreferencesForm as any).mockReturnValue({
        articleStats: {
          totalArticles: 0,
          starredArticles: 0,
          loading: true,
        },
      });

      render(<SettingsPage />);

      // Expand sync section
      const syncSection = screen.getByText(/Sync Configuration/i);
      await user.click(syncSection);

      expect(screen.getAllByText(/Loading.../i)).toHaveLength(2);
    });
  });

  describe("Form Actions", () => {
    it("should enable save button only when there are changes", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      const { rerender } = render(<SettingsPage />);

      // Initially no changes
      let saveButton = screen.getByRole("button", { name: /Save Settings/i });
      expect(saveButton).toBeDisabled();

      // Mock changes detected
      (usePreferencesForm as any).mockReturnValue({
        hasChanges: true,
        handleSave: vi.fn(),
        handleCancel: vi.fn(),
        handleReset: vi.fn(),
      });

      rerender(<SettingsPage />);

      saveButton = screen.getByRole("button", { name: /Save Settings/i });
      expect(saveButton).not.toBeDisabled();
    });

    it("should handle save action with optimistic UI update", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const { toast } = await import("@/lib/utils/toast");

      const handleSave = vi.fn().mockResolvedValue(undefined);

      (usePreferencesForm as any).mockReturnValue({
        hasChanges: true,
        isSaving: false,
        handleSave,
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      await user.click(saveButton);

      expect(handleSave).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Settings saved successfully"
        );
      });
    });

    it("should handle save errors gracefully", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const { toast } = await import("@/lib/utils/toast");

      const handleSave = vi.fn().mockRejectedValue(new Error("Network error"));

      (usePreferencesForm as any).mockReturnValue({
        hasChanges: true,
        handleSave,
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to save settings. Please try again."
        );
      });
    });

    it("should handle cancel action to discard changes", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const handleCancel = vi.fn();

      (usePreferencesForm as any).mockReturnValue({
        hasChanges: true,
        handleCancel,
      });

      render(<SettingsPage />);

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      expect(handleCancel).toHaveBeenCalledTimes(1);
    });

    it("should handle reset action to reload from server", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );
      const { toast } = await import("@/lib/utils/toast");

      const handleReset = vi.fn().mockResolvedValue(undefined);

      (usePreferencesForm as any).mockReturnValue({
        handleReset,
      });

      render(<SettingsPage />);

      const resetButton = screen.getByRole("button", {
        name: /Reset to Defaults/i,
      });
      await user.click(resetButton);

      expect(handleReset).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith("Settings reset to defaults");
      });
    });

    it("should show loading state during save", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      (usePreferencesForm as any).mockReturnValue({
        hasChanges: true,
        isSaving: true,
        handleSave: vi.fn(),
      });

      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /Saving.../i });
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveClass("animate-pulse");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", async () => {
      render(<SettingsPage />);

      // Check main landmarks
      expect(screen.getByRole("main")).toHaveAttribute(
        "data-testid",
        "settings-page"
      );

      // Check form sections
      const aiSection = screen.getByRole("region", {
        name: /AI Summarization/i,
      });
      const syncSection = screen.getByRole("region", {
        name: /Sync Configuration/i,
      });

      expect(aiSection).toBeInTheDocument();
      expect(syncSection).toBeInTheDocument();

      // Check form inputs have labels
      const apiKeyInput = screen.getByLabelText(/Anthropic API Key/i);
      expect(apiKeyInput).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      render(<SettingsPage />);

      const firstInput = screen.getByPlaceholderText(
        /Your API key is encrypted/i
      );

      // Tab to first input
      await user.tab();
      expect(firstInput).toHaveFocus();

      // Tab through form elements
      await user.tab();
      const modelSelect = screen.getByLabelText(/Summarization Model/i);
      expect(modelSelect).toHaveFocus();
    });

    it("should announce form validation errors", async () => {
      const { usePreferencesForm } = await import(
        "@/lib/hooks/usePreferencesForm"
      );

      (usePreferencesForm as any).mockReturnValue({
        errors: {
          "sync.maxArticlesPerSync": "Value must be between 10 and 5000",
        },
      });

      render(<SettingsPage />);

      // Expand sync section
      const syncSection = screen.getByText(/Sync Configuration/i);
      await user.click(syncSection);

      const errorMessage = screen.getByRole("alert");
      expect(errorMessage).toHaveTextContent(
        "Value must be between 10 and 5000"
      );

      const maxArticlesInput = screen.getByLabelText(/Max Articles Per Sync/i);
      expect(maxArticlesInput).toHaveAttribute("aria-invalid", "true");
      expect(maxArticlesInput).toHaveAttribute(
        "aria-describedby",
        expect.stringContaining("error")
      );
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should have touch-friendly button sizes", () => {
      render(<SettingsPage />);

      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      const rect = saveButton.getBoundingClientRect();

      // Minimum touch target size for iOS
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });

    it("should handle back navigation on mobile", async () => {
      const { useRouter } = await import("next/navigation");
      const router = useRouter();

      render(<SettingsPage />);

      const backButton = screen.getByTestId("settings-back-button");
      await user.click(backButton);

      expect(router.back).toHaveBeenCalledTimes(1);
    });
  });
});
