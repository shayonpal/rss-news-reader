/**
 * RR-268: Settings Page with Skeleton Layout
 *
 * Displays a skeleton settings page with two main sections:
 * 1. AI Summarization (Bot icon)
 * 2. Sync Configuration (CloudCheck icon)
 *
 * Features glass-input styling and CollapsibleFilterSection components
 */

"use client";

import { ArrowLeft, Bot, CloudCheck } from "lucide-react";
import { CollapsibleFilterSection } from "@/components/ui/collapsible-filter-section";
import { ScrollHideFloatingElement } from "@/components/ui/scroll-hide-floating-element";
import { GlassIconButton } from "@/components/ui/glass-button";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <main
      className="settings-page min-h-screen w-full overflow-x-hidden bg-background"
      data-testid="settings-page"
    >
      {/* Floating back button - matches article detail pattern */}
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

      {/* Main content container with top padding for floating button */}
      <div className="mx-auto max-w-4xl px-4 pb-6 pt-[80px] pwa-standalone:pt-[calc(80px+env(safe-area-inset-top))] sm:px-6 sm:pb-8 lg:px-8">
        {/* Page Title */}
        <div className="mb-6 sm:mb-8" data-testid="settings-header">
          <h1 className="mb-3 text-2xl font-bold leading-tight text-foreground sm:mb-4 sm:text-3xl md:text-4xl">
            Settings
          </h1>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* AI Summarization Section */}
          <CollapsibleFilterSection
            title="AI Summarization"
            icon={<Bot className="h-4 w-4" data-testid="bot-icon" />}
            defaultOpen={true}
          >
            <div className="space-y-4" data-testid="ai-section-skeleton">
              {/* API Configuration */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  placeholder="Your API key is encrypted and never exposed"
                  className="glass-input mt-1 w-full rounded-md px-3 py-2"
                  disabled
                  aria-disabled="true"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Your API key is encrypted and never exposed
                </p>
              </div>

              {/* Model Selection */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Summarization Model
                </label>
                <select
                  className="glass-input mt-1 w-full rounded-md px-3 py-2"
                  disabled
                  aria-disabled="true"
                >
                  <option>Loading models...</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Loaded from ai_models database table
                </p>
              </div>

              {/* Summary Length */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Summary Length
                </label>
                <div className="mt-3">
                  <div className="mb-4 text-center text-lg font-medium text-foreground">
                    100 – 300 words
                  </div>
                  <div className="relative">
                    {/* Dual range slider track */}
                    <div className="relative h-2 rounded-full bg-muted">
                      {/* Active range highlight */}
                      <div
                        className="absolute h-2 rounded-full bg-primary"
                        style={{ left: "20%", right: "40%" }}
                      />
                      {/* Min handle */}
                      <div
                        className="absolute -mt-2 h-6 w-6 cursor-pointer rounded-full border-2 border-background bg-primary shadow-lg"
                        style={{ left: "20%", transform: "translateX(-50%)" }}
                      />
                      {/* Max handle */}
                      <div
                        className="absolute -mt-2 h-6 w-6 cursor-pointer rounded-full border-2 border-background bg-primary shadow-lg"
                        style={{ right: "40%", transform: "translateX(50%)" }}
                      />
                    </div>
                    {/* Range labels */}
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>50</span>
                      <span>500</span>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Drag handles to set minimum and maximum summary length
                  </p>
                </div>
              </div>

              {/* Summary Style */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Summary Style
                </label>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="style"
                      value="objective"
                      className="glass-input"
                      disabled
                    />
                    <span className="text-sm">Objective</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="style"
                      value="analytical"
                      className="glass-input"
                      disabled
                    />
                    <span className="text-sm">Analytical</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="style"
                      value="retrospective"
                      className="glass-input"
                      disabled
                    />
                    <span className="text-sm">Retrospective</span>
                  </label>
                </div>
              </div>

              {/* Content Focus */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Content Focus
                </label>
                <select
                  className="glass-input mt-1 w-full rounded-md px-3 py-2"
                  disabled
                  aria-disabled="true"
                >
                  <option>General (balanced overview)</option>
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
            <div className="space-y-4" data-testid="sync-section-skeleton">
              {/* Max Articles Per Sync */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Max Articles Per Sync
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    defaultValue="500"
                    className="glass-input w-full rounded-md px-3 py-2"
                    disabled
                    aria-disabled="true"
                  />
                  <div className="flex flex-col">
                    <button className="glass-input px-2 py-1 text-xs" disabled>
                      +
                    </button>
                    <button className="glass-input px-2 py-1 text-xs" disabled>
                      -
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Higher values use more API calls but sync faster
                </p>
              </div>

              {/* Article Retention */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Maximum Articles to Keep
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    defaultValue="1000"
                    className="glass-input w-full rounded-md px-3 py-2"
                    disabled
                    aria-disabled="true"
                  />
                  <div className="flex flex-col">
                    <button className="glass-input px-2 py-1 text-xs" disabled>
                      +
                    </button>
                    <button className="glass-input px-2 py-1 text-xs" disabled>
                      -
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Starred articles are always retained regardless of this limit
                </p>
              </div>

              {/* Article Statistics */}
              <div className="animate-pulse">
                <label className="text-sm font-medium text-muted-foreground">
                  Article Statistics
                </label>
                <div className="mt-2 rounded-md border border-border/50 bg-muted/50 p-3">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Current articles:</span>
                      <span>Loading...</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Starred articles:</span>
                      <span>Loading...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleFilterSection>
        </div>
      </div>
    </main>
  );
}
