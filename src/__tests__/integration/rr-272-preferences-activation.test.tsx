/**
 * Main integration tests for RR-272 preferences activation
 * RR-272: User preferences API integration with Settings page
 *
 * Comprehensive end-to-end tests for the complete preferences activation flow
 * including Settings page UI, Zustand stores, API integration, and persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextRouter } from "next/router";
import SettingsPage from "@/app/settings/page";
import { usePreferencesDomainStore } from "@/lib/stores/preferences-domain-store";
import { usePreferencesEditorStore } from "@/lib/stores/preferences-editor-store";
import { usePreferencesForm } from "@/lib/hooks/usePreferencesForm";
import { toast } from "sonner";
import crypto from "crypto";

// Test encryption key
const TEST_ENCRYPTION_KEY =
  "a1b2c3d4e5f6789012345678901234567890abcdefabcdef1234567890abcdef";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    pathname: "/reader/settings",
  }),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe("RR-272 Preferences Activation Integration", () => {
  const user = userEvent.setup();

  // Test data
  const mockPreferences = {
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
  };

  const mockModels = [
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus", context: 200000 },
    {
      id: "claude-3-sonnet-20240229",
      name: "Claude 3 Sonnet",
      context: 200000,
    },
    { id: "claude-3-haiku-20240229", name: "Claude 3 Haiku", context: 200000 },
  ];

  const mockArticleStats = {
    totalArticles: 1234,
    starredArticles: 56,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

    // Default mock responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/api/users/preferences")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ preferences: mockPreferences }),
        });
      }
      if (url.includes("/api/ai/models")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ models: mockModels }),
        });
      }
      if (url.includes("/api/articles/stats")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockArticleStats,
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Complete Activation Flow", () => {
    it("should activate Settings page from skeleton to fully functional form", async () => {
      // Start with loading state
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ preferences: mockPreferences }),
                }),
              100
            )
          )
      );

      const { container } = render(<SettingsPage />);

      // Check initial skeleton state
      const aiSection = container.querySelector(
        '[data-testid="ai-section-skeleton"]'
      );
      expect(aiSection).toHaveClass("animate-pulse");

      // Wait for data to load
      await waitFor(() => {
        const apiKeyInput = screen.getByPlaceholderText(
          /Your API key is encrypted/i
        );
        expect(apiKeyInput).not.toBeDisabled();
      });

      // Verify all sections are activated
      expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      expect(screen.getByLabelText(/Summarization Model/i)).not.toBeDisabled();
      expect(screen.getByTestId("dual-range-slider")).toBeInTheDocument();
      expect(screen.getByLabelText(/Content Focus/i)).not.toBeDisabled();

      // Expand sync section
      await user.click(screen.getByText(/Sync Configuration/i));

      expect(
        screen.getByLabelText(/Max Articles Per Sync/i)
      ).not.toBeDisabled();
      expect(
        screen.getByLabelText(/Maximum Articles to Keep/i)
      ).not.toBeDisabled();

      // Check article statistics loaded
      expect(screen.getByText("1,234")).toBeInTheDocument();
      expect(screen.getByText("56")).toBeInTheDocument();
    });

    it("should integrate with dual Zustand stores correctly", async () => {
      // Render hooks to access stores
      const { result: domainResult } = renderHook(() =>
        usePreferencesDomainStore()
      );
      const { result: editorResult } = renderHook(() =>
        usePreferencesEditorStore()
      );

      // Load preferences into domain store
      await act(async () => {
        await domainResult.current.loadPreferences();
      });

      expect(domainResult.current.savedPreferences).toEqual(mockPreferences);
      expect(domainResult.current.isLoading).toBe(false);

      // Editor store should start empty
      expect(editorResult.current.draftPreferences).toBeNull();
      expect(editorResult.current.hasChanges).toBe(false);

      // Make a change in editor
      act(() => {
        editorResult.current.updateField("ai.summaryStyle", "analytical");
      });

      expect(editorResult.current.draftPreferences?.ai.summaryStyle).toBe(
        "analytical"
      );
      expect(editorResult.current.hasChanges).toBe(true);

      // Build patch for save
      const patch = editorResult.current.buildPatch(
        domainResult.current.savedPreferences
      );
      expect(patch).toEqual({
        ai: { summaryStyle: "analytical" },
      });

      // Save changes
      await act(async () => {
        await domainResult.current.savePreferences(patch);
      });

      // Editor should be cleared after save
      act(() => {
        editorResult.current.clearDraft();
      });

      expect(editorResult.current.draftPreferences).toBeNull();
      expect(editorResult.current.hasChanges).toBe(false);
    });

    it("should handle complete user journey from load to save", async () => {
      render(<SettingsPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      });

      // 1. Update API key
      const apiKeyInput = screen.getByPlaceholderText(
        /Your API key is encrypted/i
      );
      await user.type(apiKeyInput, "sk-ant-api03-test-key-123");

      // 2. Change model
      const modelSelect = screen.getByLabelText(/Summarization Model/i);
      await user.selectOptions(modelSelect, "claude-3-opus-20240229");

      // 3. Adjust summary length
      const minSlider = screen.getByRole("slider", { name: /minimum/i });
      const maxSlider = screen.getByRole("slider", { name: /maximum/i });

      fireEvent.change(minSlider, { target: { value: "150" } });
      fireEvent.change(maxSlider, { target: { value: "400" } });

      // 4. Change summary style
      const analyticalRadio = screen.getByLabelText(/Analytical/i);
      await user.click(analyticalRadio);

      // 5. Change content focus
      const contentFocusSelect = screen.getByLabelText(/Content Focus/i);
      await user.selectOptions(contentFocusSelect, "technical");

      // 6. Expand sync section and update values
      await user.click(screen.getByText(/Sync Configuration/i));

      const maxArticlesInput = screen.getByLabelText(/Max Articles Per Sync/i);
      await user.clear(maxArticlesInput);
      await user.type(maxArticlesInput, "1000");

      // 7. Save button should be enabled
      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      expect(saveButton).not.toBeDisabled();

      // Mock successful save
      (global.fetch as any).mockImplementationOnce(
        (url: string, options: any) => {
          if (options.method === "PUT") {
            const body = JSON.parse(options.body);

            // Verify encrypted API key
            expect(body.ai.apiKey).toHaveProperty("encrypted");
            expect(body.ai.apiKey).toHaveProperty("iv");
            expect(body.ai.apiKey).toHaveProperty("authTag");

            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true }),
            });
          }
        }
      );

      // 8. Click save
      await user.click(saveButton);

      // 9. Verify success toast
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Settings saved successfully"
        );
      });

      // 10. Save button should be disabled again
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Form Validation and Error Handling", () => {
    it("should validate form inputs according to constraints", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(
          screen.getByLabelText(/Max Articles Per Sync/i)
        ).not.toBeDisabled();
      });

      // Expand sync section
      await user.click(screen.getByText(/Sync Configuration/i));

      const maxArticlesInput = screen.getByLabelText(/Max Articles Per Sync/i);

      // Try to enter invalid value (below minimum)
      await user.clear(maxArticlesInput);
      await user.type(maxArticlesInput, "5");
      await user.tab(); // Trigger validation

      // Should show error
      await waitFor(() => {
        const errorElement = screen.getByRole("alert");
        expect(errorElement).toHaveTextContent(
          "Value must be between 10 and 5000"
        );
      });

      // Try to enter invalid value (above maximum)
      await user.clear(maxArticlesInput);
      await user.type(maxArticlesInput, "10000");
      await user.tab();

      await waitFor(() => {
        const errorElement = screen.getByRole("alert");
        expect(errorElement).toHaveTextContent(
          "Value must be between 10 and 5000"
        );
      });

      // Enter valid value
      await user.clear(maxArticlesInput);
      await user.type(maxArticlesInput, "750");
      await user.tab();

      // Error should clear
      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
    });

    it("should handle API errors gracefully", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      });

      // Make a change
      const apiKeyInput = screen.getByPlaceholderText(
        /Your API key is encrypted/i
      );
      await user.type(apiKeyInput, "sk-ant-api03-error-test");

      // Mock API error
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: "Internal server error" }),
        })
      );

      // Try to save
      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      await user.click(saveButton);

      // Should show error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to save settings. Please try again."
        );
      });

      // Form should remain editable
      expect(apiKeyInput).not.toBeDisabled();
      expect(saveButton).not.toBeDisabled();
    });

    it("should handle network timeouts", async () => {
      vi.useFakeTimers();

      render(<SettingsPage />);

      // Mock slow network
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ preferences: mockPreferences }),
                }),
              10000
            );
          })
      );

      // Should show loading state
      expect(screen.getByTestId("ai-section-skeleton")).toHaveClass(
        "animate-pulse"
      );

      // Fast-forward past timeout
      vi.advanceTimersByTime(5000);

      // Should eventually show timeout error
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to load settings. Please refresh the page."
        );
      });

      vi.useRealTimers();
    });
  });

  describe("API Key Security Integration", () => {
    it("should encrypt API key before sending to server", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      });

      const apiKeyInput = screen.getByPlaceholderText(
        /Your API key is encrypted/i
      );
      const testKey = "sk-ant-api03-security-test-key";

      await user.type(apiKeyInput, testKey);

      let capturedBody: any = null;

      (global.fetch as any).mockImplementationOnce(
        (url: string, options: any) => {
          if (options.method === "PUT") {
            capturedBody = JSON.parse(options.body);
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true }),
            });
          }
        }
      );

      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(capturedBody).not.toBeNull();
      });

      // Verify API key is encrypted
      expect(capturedBody.ai.apiKey).toHaveProperty("encrypted");
      expect(capturedBody.ai.apiKey).toHaveProperty("iv");
      expect(capturedBody.ai.apiKey).toHaveProperty("authTag");

      // Verify plain key is not sent
      const bodyString = JSON.stringify(capturedBody);
      expect(bodyString).not.toContain(testKey);

      // Verify decryption works
      const { encrypted, iv, authTag } = capturedBody.ai.apiKey;
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(TEST_ENCRYPTION_KEY, "hex"),
        Buffer.from(iv, "hex")
      );
      decipher.setAuthTag(Buffer.from(authTag, "hex"));

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      expect(decrypted).toBe(testKey);
    });

    it("should never expose API key in component state", async () => {
      const { result } = renderHook(() => usePreferencesForm());

      // Set API key
      act(() => {
        result.current.handleApiKeyChange({
          target: { value: "sk-ant-api03-state-test" },
        } as any);
      });

      // Check that API key is not in the returned values
      expect(result.current.values.ai.apiKey).toBe("");

      // Check it's not in JSON serialization
      const stateJSON = JSON.stringify(result.current);
      expect(stateJSON).not.toContain("sk-ant-api03-state-test");
    });
  });

  describe("DualRangeSlider Integration", () => {
    it("should integrate DualRangeSlider with form state", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId("dual-range-slider")).toBeInTheDocument();
      });

      const slider = screen.getByTestId("dual-range-slider");
      expect(slider).toHaveTextContent("100 – 300 words");

      // Change min value
      const minSlider = within(slider).getByRole("slider", {
        name: /minimum/i,
      });
      fireEvent.change(minSlider, { target: { value: "150" } });

      await waitFor(() => {
        expect(slider).toHaveTextContent("150 – 300 words");
      });

      // Change max value
      const maxSlider = within(slider).getByRole("slider", {
        name: /maximum/i,
      });
      fireEvent.change(maxSlider, { target: { value: "450" } });

      await waitFor(() => {
        expect(slider).toHaveTextContent("150 – 450 words");
      });

      // Values should be constrained
      fireEvent.change(minSlider, { target: { value: "500" } });

      await waitFor(() => {
        // Min shouldn't exceed max
        expect(slider).toHaveTextContent("450 – 450 words");
      });
    });
  });

  describe("Content Focus Dropdown", () => {
    it("should render all 4 content focus options", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Content Focus/i)).not.toBeDisabled();
      });

      const contentFocusSelect = screen.getByLabelText(/Content Focus/i);
      const options = within(contentFocusSelect).getAllByRole("option");

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveValue("general");
      expect(options[0]).toHaveTextContent("General (balanced overview)");
      expect(options[1]).toHaveValue("technical");
      expect(options[1]).toHaveTextContent("Technical (code & implementation)");
      expect(options[2]).toHaveValue("business");
      expect(options[2]).toHaveTextContent("Business (strategy & impact)");
      expect(options[3]).toHaveValue("educational");
      expect(options[3]).toHaveTextContent("Educational (concepts & learning)");
    });

    it("should update store when content focus changes", async () => {
      const { result: editorResult } = renderHook(() =>
        usePreferencesEditorStore()
      );

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Content Focus/i)).not.toBeDisabled();
      });

      const contentFocusSelect = screen.getByLabelText(/Content Focus/i);

      await user.selectOptions(contentFocusSelect, "technical");

      await waitFor(() => {
        expect(editorResult.current.draftPreferences?.ai.contentFocus).toBe(
          "technical"
        );
      });
    });
  });

  describe("Save/Reset/Cancel Actions", () => {
    it("should handle save action with optimistic updates", async () => {
      const { result: domainResult } = renderHook(() =>
        usePreferencesDomainStore()
      );
      const { result: editorResult } = renderHook(() =>
        usePreferencesEditorStore()
      );

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      });

      // Make changes
      const modelSelect = screen.getByLabelText(/Summarization Model/i);
      await user.selectOptions(modelSelect, "claude-3-haiku-20240229");

      // Mock successful save
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        })
      );

      // Save
      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      await user.click(saveButton);

      // Should show saving state
      expect(saveButton).toHaveTextContent(/Saving.../i);
      expect(saveButton).toBeDisabled();

      await waitFor(() => {
        // Should update domain store
        expect(domainResult.current.saveInProgress).toBe(false);

        // Should clear editor store
        expect(editorResult.current.draftPreferences).toBeNull();
        expect(editorResult.current.hasChanges).toBe(false);

        // Should show success toast
        expect(toast.success).toHaveBeenCalledWith(
          "Settings saved successfully"
        );
      });
    });

    it("should handle reset action to reload from server", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      });

      // Make changes
      const modelSelect = screen.getByLabelText(/Summarization Model/i);
      await user.selectOptions(modelSelect, "claude-3-haiku-20240229");

      // Mock fresh data from server
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            preferences: {
              ...mockPreferences,
              ai: {
                ...mockPreferences.ai,
                model: "claude-3-opus-20240229", // Different from current
              },
            },
          }),
        })
      );

      // Reset
      const resetButton = screen.getByRole("button", {
        name: /Reset to Defaults/i,
      });
      await user.click(resetButton);

      await waitFor(() => {
        // Should reload from server
        expect(modelSelect).toHaveValue("claude-3-opus-20240229");

        // Should show info toast
        expect(toast.info).toHaveBeenCalledWith("Settings reset to defaults");
      });
    });

    it("should handle cancel action to discard changes", async () => {
      const { result: editorResult } = renderHook(() =>
        usePreferencesEditorStore()
      );

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      });

      // Make changes
      const apiKeyInput = screen.getByPlaceholderText(
        /Your API key is encrypted/i
      );
      await user.type(apiKeyInput, "sk-ant-api03-cancel-test");

      expect(editorResult.current.hasChanges).toBe(true);

      // Cancel
      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        // Should clear editor store
        expect(editorResult.current.draftPreferences).toBeNull();
        expect(editorResult.current.hasChanges).toBe(false);

        // Input should be cleared
        expect(apiKeyInput).toHaveValue("");
      });
    });
  });

  describe("Article Statistics Display", () => {
    it("should load and display article statistics", async () => {
      render(<SettingsPage />);

      // Expand sync section
      await user.click(screen.getByText(/Sync Configuration/i));

      await waitFor(() => {
        expect(screen.getByText(/Current articles:/i)).toBeInTheDocument();
        expect(screen.getByText("1,234")).toBeInTheDocument();
        expect(screen.getByText(/Starred articles:/i)).toBeInTheDocument();
        expect(screen.getByText("56")).toBeInTheDocument();
      });
    });

    it("should refresh statistics after save", async () => {
      render(<SettingsPage />);

      // Expand sync section
      await user.click(screen.getByText(/Sync Configuration/i));

      // Initial stats
      expect(screen.getByText("1,234")).toBeInTheDocument();

      // Make a change
      const maxArticlesInput = screen.getByLabelText(/Max Articles Per Sync/i);
      await user.clear(maxArticlesInput);
      await user.type(maxArticlesInput, "2000");

      // Mock updated stats after save
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes("/api/articles/stats")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              totalArticles: 2500,
              starredArticles: 89,
            }),
          });
        }
        if (url.includes("/api/users/preferences")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          });
        }
      });

      // Save
      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      await user.click(saveButton);

      // Stats should update
      await waitFor(() => {
        expect(screen.getByText("2,500")).toBeInTheDocument();
        expect(screen.getByText("89")).toBeInTheDocument();
      });
    });
  });

  describe("Toast Notifications", () => {
    it("should show appropriate toast messages for all actions", async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Anthropic API Key/i)).not.toBeDisabled();
      });

      // Success case
      const apiKeyInput = screen.getByPlaceholderText(
        /Your API key is encrypted/i
      );
      await user.type(apiKeyInput, "sk-ant-api03-toast-test");

      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        })
      );

      const saveButton = screen.getByRole("button", { name: /Save Settings/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Settings saved successfully"
        );
      });

      // Error case
      await user.type(apiKeyInput, "-error");

      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: "Invalid API key format" }),
        })
      );

      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to save settings. Please try again."
        );
      });

      // Warning case (unsaved changes)
      await user.type(apiKeyInput, "-warning");

      // Try to navigate away
      const backButton = screen.getByTestId("settings-back-button");
      await user.click(backButton);

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith(
          "You have unsaved changes. Are you sure you want to leave?"
        );
      });
    });
  });

  describe("Mobile PWA Considerations", () => {
    it("should have PWA-optimized touch targets", () => {
      render(<SettingsPage />);

      // All interactive elements should be at least 44x44px
      const buttons = screen.getAllByRole("button");
      const inputs = screen.getAllByRole("textbox");
      const selects = screen.getAllByRole("combobox");

      [...buttons, ...inputs, ...selects].forEach((element) => {
        const rect = element.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it("should handle safe area insets for iOS", () => {
      const { container } = render(<SettingsPage />);

      const mainContent = container.querySelector(
        ".pwa-standalone\\:pt-\\[calc\\(80px\\+env\\(safe-area-inset-top\\)\\)\\]"
      );
      expect(mainContent).toBeInTheDocument();
    });
  });
});
