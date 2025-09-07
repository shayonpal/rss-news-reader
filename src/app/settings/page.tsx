/**
 * RR-272: Settings Page with Active Zustand Store Integration
 *
 * Displays a fully functional settings page with two main sections:
 * 1. AI Summarization (Bot icon)
 * 2. Sync Configuration (CloudCheck icon)
 *
 * Features glass-input styling and Zustand store integration
 */

"use client";

import { useEffect } from "react";
import { ArrowLeft, Bot, CloudCheck, Save, RotateCcw } from "lucide-react";
import { CollapsibleFilterSection } from "@/components/ui/collapsible-filter-section";
import { ScrollHideFloatingElement } from "@/components/ui/scroll-hide-floating-element";
import { GlassIconButton } from "@/components/ui/glass-button";
import { DualRangeSlider } from "@/components/ui/dual-range-slider";
import { useRouter } from "next/navigation";
import { usePreferencesDomainStore } from "@/lib/stores/preferences-domain-store";
import { usePreferencesEditorStore } from "@/lib/stores/preferences-editor-store";
import { usePreferencesForm } from "@/lib/hooks/usePreferencesForm";

export default function SettingsPage() {
  const router = useRouter();

  // Domain store for loading state and preferences
  const { savedPreferences, isLoading, error, loadPreferences } =
    usePreferencesDomainStore();

  // Editor store for initialization and cleanup
  const editorStore = usePreferencesEditorStore();
  const { initializeDraft, clearDraft } = editorStore;

  // Form hook for all form interactions
  const {
    draft,
    errors,
    isSaving,
    apiKeyState,
    apiKeyInput,
    isDirty,
    handleTextChange,
    handleNumberChange,
    handleSelectChange,
    handleApiKeyChange,
    handleSave,
    handleCancel,
    updateFieldImmediate,
  } = usePreferencesForm();

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Initialize draft when preferences are loaded
  useEffect(() => {
    if (savedPreferences && !draft) {
      initializeDraft(savedPreferences);
    }
  }, [savedPreferences, draft, initializeDraft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDraft();
    };
  }, [clearDraft]);

  const handleBack = () => {
    router.back();
  };

  const handleReset = () => {
    if (savedPreferences) {
      initializeDraft(savedPreferences);
    }
  };

  const hasChanges = isDirty;

  // Loading state
  if (isLoading || !draft) {
    return (
      <main className="settings-page min-h-screen w-full overflow-x-hidden bg-background">
        <div className="mx-auto max-w-4xl px-4 pb-6 pt-[80px] sm:px-6 sm:pb-8 lg:px-8">
          <div className="animate-pulse">
            <div className="mb-6 h-8 w-32 rounded-md bg-muted" />
            <div className="space-y-4">
              <div className="h-64 rounded-md bg-muted" />
              <div className="h-64 rounded-md bg-muted" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="settings-page min-h-screen w-full overflow-x-hidden bg-background"
      data-testid="settings-page"
    >
      {/* Floating back button */}
      <ScrollHideFloatingElement position="top-left" hideThreshold={50}>
        <GlassIconButton
          type="button"
          onClick={handleBack}
          variant="liquid-glass"
          aria-label="Go back"
          data-testid="settings-back-button"
        >
          <ArrowLeft className="h-5 w-5" data-testid="arrow-left-icon" />
        </GlassIconButton>
      </ScrollHideFloatingElement>

      {/* Main content container */}
      <div className="mx-auto max-w-4xl px-4 pb-6 pt-[80px] pwa-standalone:pt-[calc(80px+env(safe-area-inset-top))] sm:px-6 sm:pb-8 lg:px-8">
        {/* Page Title */}
        <div className="mb-6 sm:mb-8" data-testid="settings-header">
          <h1 className="mb-3 text-2xl font-bold leading-tight text-foreground sm:mb-4 sm:text-3xl md:text-4xl">
            Settings
          </h1>
          {error && (
            <div className="mb-4 text-sm text-red-500" role="alert">
              {error}
            </div>
          )}
        </div>

        {/* Settings Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-6"
        >
          {/* AI Summarization Section */}
          <CollapsibleFilterSection
            title="AI Summarization"
            icon={<Bot className="h-4 w-4" data-testid="bot-icon" />}
            defaultOpen={true}
          >
            <div className="space-y-4" data-testid="ai-section">
              {/* API Configuration */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  placeholder={
                    savedPreferences?.ai?.hasApiKey
                      ? "API key is set (enter new key to update)"
                      : "Enter your Anthropic API key"
                  }
                  className="glass-input mt-1 w-full rounded-md px-3 py-2"
                  value={apiKeyState === "replace" ? apiKeyInput : ""}
                  onChange={handleApiKeyChange}
                  aria-label="API key input"
                />
                {errors.apiKey && (
                  <p className="mt-1 text-xs text-red-500">{errors.apiKey}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Your API key is encrypted and never exposed
                </p>
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Summarization Model
                </label>
                <select
                  className="glass-input mt-1 w-full rounded-md px-3 py-2"
                  value={draft.ai.model}
                  onChange={handleSelectChange("ai.model")}
                >
                  <option value="claude-3-haiku-20240307">
                    Claude 3 Haiku
                  </option>
                  <option value="claude-3-sonnet-20240229">
                    Claude 3 Sonnet
                  </option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose the AI model for summarization
                </p>
              </div>

              {/* Summary Length */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Summary Length
                </label>
                <div className="mt-3">
                  <DualRangeSlider
                    min={50}
                    max={500}
                    step={10}
                    minValue={draft.ai.summaryLengthMin}
                    maxValue={draft.ai.summaryLengthMax}
                    onMinChange={(value) =>
                      updateFieldImmediate("ai.summaryLengthMin", value)
                    }
                    onMaxChange={(value) =>
                      updateFieldImmediate("ai.summaryLengthMax", value)
                    }
                    formatValue={(value) => `${value} words`}
                    minLabel="Minimum"
                    maxLabel="Maximum"
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Drag handles to set minimum and maximum summary length
                  </p>
                </div>
              </div>

              {/* Summary Style */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Summary Style
                </label>
                <div className="mt-2 space-y-2">
                  {["objective", "analytical", "concise", "detailed"].map(
                    (style) => (
                      <label key={style} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="style"
                          value={style}
                          checked={draft.ai.summaryStyle === style}
                          onChange={() =>
                            updateFieldImmediate("ai.summaryStyle", style)
                          }
                          className="glass-input"
                        />
                        <span className="text-sm capitalize">{style}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Content Focus */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Content Focus
                </label>
                <select
                  className="glass-input mt-1 w-full rounded-md px-3 py-2"
                  value={draft.ai.contentFocus || "general"}
                  onChange={handleSelectChange("ai.contentFocus")}
                >
                  <option value="general">General (balanced overview)</option>
                  <option value="technical">
                    Technical (code & implementation)
                  </option>
                  <option value="business">Business (strategy & impact)</option>
                  <option value="educational">
                    Educational (learning focused)
                  </option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adjusts the summary perspective and terminology
                </p>
              </div>
            </div>
          </CollapsibleFilterSection>

          {/* Sync Configuration Section */}
          <CollapsibleFilterSection
            title="Sync Configuration"
            icon={
              <CloudCheck className="h-4 w-4" data-testid="cloud-check-icon" />
            }
            defaultOpen={false}
          >
            <div className="space-y-4" data-testid="sync-section">
              {/* Max Articles Per Sync */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Max Articles Per Sync
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={draft.sync.maxArticles}
                    onChange={handleNumberChange("sync.maxArticles")}
                    className="glass-input w-full rounded-md px-3 py-2"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Higher values use more API calls but sync faster
                </p>
              </div>

              {/* Article Retention */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Retention Period (days)
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={draft.sync.retentionCount}
                    onChange={handleNumberChange("sync.retentionCount")}
                    className="glass-input w-full rounded-md px-3 py-2"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Articles older than this will be automatically cleaned up
                </p>
              </div>
            </div>
          </CollapsibleFilterSection>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            {hasChanges && (
              <button
                type="button"
                onClick={handleCancel}
                className="glass-input flex items-center gap-2 rounded-md px-4 py-2 transition-colors hover:bg-muted/80"
                disabled={isSaving}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            )}
            <button
              type="submit"
              className={`glass-input flex items-center gap-2 rounded-md px-4 py-2 transition-colors ${
                hasChanges
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed opacity-50"
              }`}
              disabled={!hasChanges || isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
