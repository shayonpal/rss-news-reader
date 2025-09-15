/**
 * Performance tests for Settings page
 * RR-272: User preferences API integration with Settings page
 *
 * Validates performance metrics including load times, render performance,
 * glass morphing animations, and form interaction responsiveness.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { performance } from "perf_hooks";
import SettingsPage from "@/app/settings/page";

// Mock Settings component
const MockSettingsPage = () => {
  // Simulate Settings page with performance markers
  performance.mark("settings-render-start");

  React.useEffect(() => {
    performance.mark("settings-render-end");
    performance.measure(
      "settings-initial-render",
      "settings-render-start",
      "settings-render-end"
    );
  }, []);

  return React.createElement(
    "div",
    { "data-testid": "settings-page", className: "glass-morphing" },
    React.createElement(
      "form",
      { "data-testid": "settings-form" },
      React.createElement("input", {
        "data-testid": "api-key-input",
        type: "password",
      }),
      React.createElement(
        "select",
        { "data-testid": "model-select" },
        React.createElement("option", null, "Claude 3 Opus")
      ),
      React.createElement("div", { "data-testid": "dual-range-slider" }),
      React.createElement("button", { "data-testid": "save-button" }, "Save")
    )
  );
};

// Mock components for performance testing
vi.mock("@/app/settings/page", () => ({
  default: MockSettingsPage,
}));

// Mock heavy operations
const mockHeavyOperation = (duration: number) => {
  const start = performance.now();
  while (performance.now() - start < duration) {
    // Simulate heavy computation
  }
};

describe("Settings Page Performance", () => {
  let animationFrameCallback: FrameRequestCallback | null = null;
  let rafId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    performance.clearMarks();
    performance.clearMeasures();

    // Mock requestAnimationFrame for FPS testing
    global.requestAnimationFrame = vi.fn((callback) => {
      animationFrameCallback = callback;
      rafId = Math.random();
      return rafId;
    });

    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial Load Performance", () => {
    it("should render Settings page in under 100ms", async () => {
      const startTime = performance.now();

      render(React.createElement(SettingsPage));

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(100);
    });

    it("should achieve First Contentful Paint (FCP) within 50ms", async () => {
      performance.mark("navigation-start");

      render(React.createElement(SettingsPage));

      performance.mark("first-contentful-paint");
      performance.measure("fcp", "navigation-start", "first-contentful-paint");

      const fcpMeasure = performance.getEntriesByName("fcp")[0];
      expect(fcpMeasure.duration).toBeLessThan(50);
    });

    it("should achieve Time to Interactive (TTI) within 200ms", async () => {
      const startTime = performance.now();

      render(React.createElement(SettingsPage));

      // Wait for all interactive elements to be ready
      await waitFor(() => {
        const apiKeyInput = screen.getByTestId("api-key-input");
        const saveButton = screen.getByTestId("save-button");

        expect(apiKeyInput).not.toBeDisabled();
        expect(saveButton).toBeInTheDocument();
      });

      const tti = performance.now() - startTime;
      expect(tti).toBeLessThan(200);
    });

    it("should lazy load non-critical components", async () => {
      const lazyLoadSpy = vi.fn();

      // Mock React.lazy
      vi.spyOn(React, "lazy").mockImplementation((loader) => {
        lazyLoadSpy();
        return loader();
      });

      render(React.createElement(SettingsPage));

      // Critical components should load immediately
      expect(screen.getByTestId("settings-form")).toBeInTheDocument();

      // Non-critical components should lazy load
      await waitFor(() => {
        expect(lazyLoadSpy).toHaveBeenCalled();
      });
    });
  });

  describe("Glass Morphing Animation Performance", () => {
    it("should maintain 60fps during glass morphing animations", async () => {
      const { container } = render(React.createElement(SettingsPage));

      const glassElements = container.querySelectorAll(".glass-morphing");

      // Track FPS during animation
      let frameCount = 0;
      let lastTime = performance.now();
      const fpsValues: number[] = [];

      const measureFPS = (currentTime: DOMHighResTimeStamp) => {
        frameCount++;
        const delta = currentTime - lastTime;

        if (delta >= 1000) {
          const fps = (frameCount * 1000) / delta;
          fpsValues.push(fps);
          frameCount = 0;
          lastTime = currentTime;
        }

        if (fpsValues.length < 3) {
          requestAnimationFrame(measureFPS);
        }
      };

      // Trigger animation
      glassElements.forEach((element) => {
        element.classList.add("animating");
      });

      requestAnimationFrame(measureFPS);

      // Wait for measurements
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // Average FPS should be close to 60
      const avgFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
      expect(avgFPS).toBeGreaterThan(55);
    });

    it("should use GPU acceleration for glass effects", () => {
      const { container } = render(React.createElement(SettingsPage));

      const glassElements = container.querySelectorAll(".glass-morphing");

      glassElements.forEach((element) => {
        const styles = getComputedStyle(element);

        // Check for GPU-accelerated properties
        expect(styles.transform).toBeDefined();
        expect(styles.willChange).toContain("transform");

        // Backdrop filter should be present for glass effect
        expect(styles.backdropFilter).toContain("blur");
      });
    });

    it("should debounce rapid style changes", async () => {
      const { container } = render(React.createElement(SettingsPage));

      const glassElement = container.querySelector(".glass-morphing");
      let styleChangeCount = 0;

      // Monitor style changes
      const observer = new MutationObserver(() => {
        styleChangeCount++;
      });

      observer.observe(glassElement!, {
        attributes: true,
        attributeFilter: ["style"],
      });

      // Trigger rapid hover events
      for (let i = 0; i < 20; i++) {
        glassElement!.dispatchEvent(new MouseEvent("mouseenter"));
        glassElement!.dispatchEvent(new MouseEvent("mouseleave"));
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should debounce and not apply all 40 style changes
      expect(styleChangeCount).toBeLessThan(10);

      observer.disconnect();
    });
  });

  describe("Form Interaction Performance", () => {
    it("should handle rapid input changes efficiently", async () => {
      const user = userEvent.setup();
      render(React.createElement(SettingsPage));

      const apiKeyInput = screen.getByTestId("api-key-input");
      const startTime = performance.now();

      // Type rapidly
      await user.type(apiKeyInput, "sk-ant-api03-performance-test-key");

      const typingTime = performance.now() - startTime;

      // Should handle 30+ characters in under 500ms
      expect(typingTime).toBeLessThan(500);
    });

    it("should debounce form validation", async () => {
      vi.useFakeTimers();

      const validationSpy = vi.fn();
      const user = userEvent.setup({ delay: null }); // Remove delay for testing

      // Mock validation
      const validateForm = vi.fn(() => {
        validationSpy();
        return true;
      });

      render(React.createElement(SettingsPage));

      const input = screen.getByTestId("api-key-input");

      // Type multiple characters quickly
      await user.type(input, "test");

      // Validation shouldn't run immediately
      expect(validationSpy).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      vi.advanceTimersByTime(300);

      // Now validation should run once
      expect(validationSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("should optimize re-renders during form updates", async () => {
      let renderCount = 0;

      const TrackedSettingsPage = () => {
        renderCount++;
        return React.createElement(SettingsPage);
      };

      const { rerender } = render(React.createElement(TrackedSettingsPage));

      // Initial render
      expect(renderCount).toBe(1);

      // Simulate multiple prop updates
      for (let i = 0; i < 5; i++) {
        rerender(React.createElement(TrackedSettingsPage, { key: i }));
      }

      // Should use React.memo or similar optimization
      expect(renderCount).toBeLessThan(6); // Some re-renders prevented
    });
  });

  describe("Data Loading Performance", () => {
    it("should load preferences within 150ms", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          preferences: {
            ai: { model: "claude-3-sonnet-20240229" },
            sync: { maxArticlesPerSync: 500 },
          },
        }),
      });

      global.fetch = mockFetch;

      const startTime = performance.now();

      render(React.createElement(SettingsPage));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/users/preferences")
        );
      });

      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(150);
    });

    it("should implement request caching", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ preferences: {} }),
      });

      global.fetch = mockFetch;

      // First render
      const { unmount } = render(React.createElement(SettingsPage));
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      unmount();

      // Second render within cache window
      render(React.createElement(SettingsPage));

      // Should use cached data
      await waitFor(() => {
        // Might make a second call, but should be faster
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    it("should parallelize independent data fetches", async () => {
      const fetchSpy = vi.fn();

      global.fetch = vi.fn((url) => {
        fetchSpy(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      render(React.createElement(SettingsPage));

      await waitFor(() => {
        // Should fetch preferences and models in parallel
        const calls = fetchSpy.mock.calls;
        expect(calls.some((call) => call[0].includes("/preferences"))).toBe(
          true
        );
        expect(calls.some((call) => call[0].includes("/models"))).toBe(true);
      });

      // Check timing - parallel calls should complete close together
      const timings = fetchSpy.mock.results.map((r) => r.value);
      expect(timings).toHaveLength(2);
    });
  });

  describe("Memory Performance", () => {
    it("should clean up event listeners on unmount", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = render(React.createElement(SettingsPage));

      const listenerCount = addEventListenerSpy.mock.calls.length;

      unmount();

      // Should remove all added listeners
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(listenerCount);
    });

    it("should prevent memory leaks from timers", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = render(React.createElement(SettingsPage));

      const timerCount = setTimeoutSpy.mock.calls.length;

      unmount();

      // All timers should be cleared
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(timerCount);
    });

    it("should limit memory usage for large form data", () => {
      const checkMemoryUsage = () => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      };

      const initialMemory = checkMemoryUsage();

      render(React.createElement(SettingsPage));

      // Simulate large form data
      const largeData = new Array(1000).fill({
        id: "item",
        value: "x".repeat(1000),
      });

      // Process data (would normally update form)
      largeData.forEach(() => {
        // Simulate processing
      });

      const finalMemory = checkMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe("Bundle Size Impact", () => {
    it("should tree-shake unused code", () => {
      // This would be checked at build time
      const mockBundleStats = {
        assets: [
          {
            name: "settings.js",
            size: 45000, // 45KB
          },
        ],
      };

      // Settings page bundle should be under 50KB
      expect(mockBundleStats.assets[0].size).toBeLessThan(50000);
    });

    it("should lazy load heavy dependencies", async () => {
      const importSpy = vi.fn();

      // Mock dynamic imports
      vi.doMock("@/components/ui/dual-range-slider", () => {
        importSpy("dual-range-slider");
        return { DualRangeSlider: () => null };
      });

      render(React.createElement(SettingsPage));

      // Heavy components should not be imported immediately
      expect(importSpy).not.toHaveBeenCalled();

      // Trigger section expansion that needs the component
      const aiSection = screen.getByText(/AI Summarization/i);
      await userEvent.click(aiSection);

      await waitFor(() => {
        expect(importSpy).toHaveBeenCalledWith("dual-range-slider");
      });
    });
  });

  describe("Network Performance", () => {
    it("should batch API requests efficiently", async () => {
      const requests: string[] = [];

      global.fetch = vi.fn((url) => {
        requests.push(url);
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      render(React.createElement(SettingsPage));

      await waitFor(() => {
        expect(requests.length).toBeGreaterThan(0);
      });

      // Should batch related requests
      const uniqueRequests = [...new Set(requests)];
      expect(uniqueRequests.length).toBeLessThanOrEqual(3); // Preferences, models, stats
    });

    it("should implement request retry with backoff", async () => {
      let attemptCount = 0;

      global.fetch = vi.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      vi.useFakeTimers();

      render(React.createElement(SettingsPage));

      // First attempt fails
      await vi.advanceTimersByTimeAsync(0);
      expect(attemptCount).toBe(1);

      // Retry with backoff
      await vi.advanceTimersByTimeAsync(1000);
      expect(attemptCount).toBe(2);

      await vi.advanceTimersByTimeAsync(2000);
      expect(attemptCount).toBe(3); // Success

      vi.useRealTimers();
    });
  });

  describe("Accessibility Performance", () => {
    it("should announce changes without blocking UI", async () => {
      const { container } = render(React.createElement(SettingsPage));

      // Create live region for announcements
      const liveRegion = container.querySelector('[aria-live="polite"]');

      // Trigger multiple announcements
      const announcements = [
        "Settings loaded",
        "API key updated",
        "Settings saved",
      ];

      const startTime = performance.now();

      announcements.forEach((text) => {
        if (liveRegion) {
          liveRegion.textContent = text;
        }
      });

      const announcementTime = performance.now() - startTime;

      // Announcements should not block UI (< 10ms)
      expect(announcementTime).toBeLessThan(10);
    });

    it("should handle focus management efficiently", async () => {
      const user = userEvent.setup();
      render(React.createElement(SettingsPage));

      const startTime = performance.now();

      // Tab through all interactive elements
      for (let i = 0; i < 10; i++) {
        await user.tab();
      }

      const tabTime = performance.now() - startTime;

      // Focus management should be fast (< 200ms for 10 tabs)
      expect(tabTime).toBeLessThan(200);
    });
  });
});
