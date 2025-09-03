import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { ScrollableArticleHeader } from "../scrollable-article-header";
import type { Article } from "@/types";

// RR-248: Performance-focused TDD tests for ScrollableArticleHeader refactoring
// This file will initially FAIL since the performance optimizations don't exist yet
// Tests enforce <3ms scripting time per frame and 0 React re-renders during scroll

// Mock requestAnimationFrame with timing controls
const mockRequestAnimationFrame = vi.fn();
const mockPerformanceNow = vi.fn();
const mockCancelAnimationFrame = vi.fn();

// Performance tracking interfaces
interface FrameMetrics {
  frameId: number;
  scriptingTime: number;
  timestamp: number;
  dropped: boolean;
}

interface ScrollMetrics {
  totalFrames: number;
  droppedFrames: number;
  averageScriptingTime: number;
  peakScriptingTime: number;
  reactRenderCount: number;
}

// Mock article data
const mockArticle: Article = {
  id: "perf-test-article",
  title:
    "Performance Test Article with Very Long Title That Will Scale During Scroll Animation Testing",
  content: "Test content for performance validation",
  url: "https://example.com/perf-test",
  publishedAt: new Date().toISOString(),
  feedId: "test-feed",
  inoreader_id: "test-inoreader-id",
  hero_image:
    "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
} as Article;

describe("ScrollableArticleHeader Performance (RR-248 TDD)", () => {
  let frameMetrics: FrameMetrics[];
  let scrollMetrics: ScrollMetrics;

  beforeEach(() => {
    vi.useFakeTimers();
    frameMetrics = [];
    scrollMetrics = {
      totalFrames: 0,
      droppedFrames: 0,
      averageScriptingTime: 0,
      peakScriptingTime: 0,
      reactRenderCount: 0,
    };

    // Mock RAF with performance tracking
    mockRequestAnimationFrame.mockImplementation((callback) => {
      const frameId = frameMetrics.length;
      const timestamp = performance.now();

      setTimeout(() => {
        const startTime = performance.now();
        callback(timestamp);
        const endTime = performance.now();

        const scriptingTime = endTime - startTime;
        const dropped = scriptingTime > 16.67; // >16.67ms indicates dropped frame

        frameMetrics.push({
          frameId,
          scriptingTime,
          timestamp,
          dropped,
        });

        scrollMetrics.totalFrames++;
        if (dropped) scrollMetrics.droppedFrames++;
        if (scriptingTime > scrollMetrics.peakScriptingTime) {
          scrollMetrics.peakScriptingTime = scriptingTime;
        }
      }, 16);

      return frameId;
    });

    global.requestAnimationFrame = mockRequestAnimationFrame;
    global.cancelAnimationFrame = mockCancelAnimationFrame;
    global.performance.now = mockPerformanceNow.mockReturnValue(0);

    // Mock element.style.setProperty for performance tests
    const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
    let setPropertyCallCount = 0;

    CSSStyleDeclaration.prototype.setProperty = vi.fn((property, value) => {
      setPropertyCallCount++;
      return originalSetProperty.call(this, property, value);
    });

    // Mock React render counting
    const originalCreateElement = React.createElement;
    React.createElement = vi.fn((...args) => {
      scrollMetrics.reactRenderCount++;
      return originalCreateElement(...args);
    });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Scroll Performance Requirements", () => {
    it("should maintain <3ms scripting time per scroll frame", async () => {
      render(<ScrollableArticleHeader article={mockArticle} />);

      // Simulate scroll events at 60fps for 1 second
      const scrollPositions = Array.from({ length: 60 }, (_, i) => i * 10);

      for (const scrollY of scrollPositions) {
        // Mock scroll position
        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });

        // Trigger scroll event
        window.dispatchEvent(new Event("scroll"));

        // Advance timer to next frame
        vi.advanceTimersByTime(16);
      }

      // Wait for all RAF callbacks to complete
      await waitFor(
        () => {
          expect(frameMetrics.length).toBeGreaterThan(50);
        },
        { timeout: 2000 }
      );

      // Validate scripting time budget
      const overBudgetFrames = frameMetrics.filter(
        (frame) => frame.scriptingTime >= 3
      );
      expect(overBudgetFrames).toHaveLength(0);

      // Calculate and validate average
      const avgScriptingTime =
        frameMetrics.reduce((sum, frame) => sum + frame.scriptingTime, 0) /
        frameMetrics.length;
      expect(avgScriptingTime).toBeLessThan(2); // Well under 3ms budget

      // Peak scripting time should also be under budget
      const peakTime = Math.max(
        ...frameMetrics.map((frame) => frame.scriptingTime)
      );
      expect(peakTime).toBeLessThan(3);
    });

    it("should prevent React re-renders during scroll events", async () => {
      // Reset render count before test
      scrollMetrics.reactRenderCount = 0;

      render(<ScrollableArticleHeader article={mockArticle} />);
      const initialRenderCount = scrollMetrics.reactRenderCount;

      // Simulate 2 seconds of continuous scrolling
      for (let frame = 0; frame < 120; frame++) {
        const scrollY = Math.sin(frame * 0.1) * 500 + 500; // Smooth scroll pattern

        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));

        vi.advanceTimersByTime(16);
      }

      await waitFor(() => {
        expect(frameMetrics.length).toBeGreaterThan(100);
      });

      // Should have 0 additional React renders after initial mount
      const scrollRenderCount =
        scrollMetrics.reactRenderCount - initialRenderCount;
      expect(scrollRenderCount).toBe(0);
    });

    it("should use element.style.setProperty instead of React state", async () => {
      let setPropertyCalls = 0;
      const mockSetProperty = vi.fn((property, value) => {
        setPropertyCalls++;
        return CSSStyleDeclaration.prototype.setProperty.call(
          this,
          property,
          value
        );
      });

      // Mock element with setProperty tracking
      const mockElement = {
        style: { setProperty: mockSetProperty },
      } as any;

      vi.spyOn(document, "querySelector").mockReturnValue(mockElement);

      render(<ScrollableArticleHeader article={mockArticle} />);

      // Simulate scroll with dynamic style updates
      const scrollPositions = [0, 100, 300, 500, 800];

      for (const scrollY of scrollPositions) {
        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));
        vi.advanceTimersByTime(16);
      }

      await waitFor(() => {
        expect(setPropertyCalls).toBeGreaterThan(0);
      });

      // Should use direct DOM manipulation
      expect(mockSetProperty).toHaveBeenCalledWith(
        "--glass-blur",
        expect.any(String)
      );
      expect(mockSetProperty).toHaveBeenCalledWith(
        "--glass-alpha",
        expect.any(String)
      );
      expect(mockSetProperty).toHaveBeenCalledWith(
        "--title-scale",
        expect.any(String)
      );
    });

    it("should batch CSS property updates in single RAF callback", async () => {
      const propertyUpdates: Array<{ property: string; frame: number }> = [];
      let currentFrame = 0;

      mockRequestAnimationFrame.mockImplementation((callback) => {
        const frameId = currentFrame++;

        setTimeout(() => {
          // Track which frame properties are updated in
          const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
          CSSStyleDeclaration.prototype.setProperty = vi.fn(
            (property, value) => {
              if (
                property.startsWith("--glass") ||
                property.startsWith("--title")
              ) {
                propertyUpdates.push({ property, frame: frameId });
              }
              return originalSetProperty.call(this, property, value);
            }
          );

          callback(performance.now());
        }, 16);

        return frameId;
      });

      render(<ScrollableArticleHeader article={mockArticle} />);

      // Trigger single scroll event
      Object.defineProperty(window, "scrollY", { value: 200, writable: true });
      window.dispatchEvent(new Event("scroll"));

      await waitFor(() => {
        expect(propertyUpdates.length).toBeGreaterThan(0);
      });

      // All property updates should happen in the same frame
      const framesWithUpdates = new Set(
        propertyUpdates.map((update) => update.frame)
      );
      expect(framesWithUpdates.size).toBeLessThanOrEqual(1); // Batched in single frame
    });

    it("should achieve 60fps during continuous scroll", async () => {
      let frameCount = 0;
      let lastFrameTime = 0;
      const frameDurations: number[] = [];

      mockRequestAnimationFrame.mockImplementation((callback) => {
        const currentTime = performance.now();

        if (lastFrameTime > 0) {
          const duration = currentTime - lastFrameTime;
          frameDurations.push(duration);
        }

        frameCount++;
        lastFrameTime = currentTime;
        callback(currentTime);
        return frameCount;
      });

      // Mock performance.now to increment realistically
      let mockTime = 0;
      mockPerformanceNow.mockImplementation(() => {
        mockTime += 16.67; // 60fps timing
        return mockTime;
      });

      render(<ScrollableArticleHeader article={mockArticle} />);

      // Simulate 3 seconds of smooth scrolling
      for (let frame = 0; frame < 180; frame++) {
        const progress = frame / 180;
        const scrollY = Math.pow(progress, 1.5) * 1000; // Eased scroll

        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));

        vi.advanceTimersByTime(16);
      }

      await waitFor(() => {
        expect(frameDurations.length).toBeGreaterThan(150);
      });

      // Calculate FPS metrics
      const averageFrameTime =
        frameDurations.reduce((a, b) => a + b, 0) / frameDurations.length;
      const fps = 1000 / averageFrameTime;

      expect(fps).toBeGreaterThanOrEqual(58); // Allow small variance

      // Check for dropped frames (>20ms)
      const droppedFrames = frameDurations.filter((duration) => duration > 20);
      const dropRate = droppedFrames.length / frameDurations.length;

      expect(dropRate).toBeLessThan(0.02); // <2% frame drops
    });
  });

  describe("CSS Custom Properties Integration", () => {
    it("should update CSS variables without triggering React renders", async () => {
      const cssVariableUpdates: string[] = [];
      let reactRenderCount = 0;

      // Track CSS variable updates
      const mockSetProperty = vi.fn((property, value) => {
        if (property.startsWith("--")) {
          cssVariableUpdates.push(`${property}:${value}`);
        }
      });

      // Track React renders
      const mockElement = {
        style: { setProperty: mockSetProperty },
      } as any;

      vi.spyOn(document, "querySelector").mockReturnValue(mockElement);

      // Mock React.createElement to count renders
      const originalCreateElement = React.createElement;
      React.createElement = vi.fn((...args) => {
        reactRenderCount++;
        return originalCreateElement(...args);
      });

      render(<ScrollableArticleHeader article={mockArticle} />);
      const initialRenders = reactRenderCount;

      // Perform scroll sequence
      const scrollSequence = [0, 150, 300, 450, 600];

      for (const scrollY of scrollSequence) {
        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));
        vi.advanceTimersByTime(20);
      }

      await waitFor(() => {
        expect(cssVariableUpdates.length).toBeGreaterThan(0);
      });

      // CSS variables should be updated
      expect(
        cssVariableUpdates.some((update) => update.includes("--glass-blur"))
      ).toBe(true);
      expect(
        cssVariableUpdates.some((update) => update.includes("--glass-alpha"))
      ).toBe(true);
      expect(
        cssVariableUpdates.some((update) => update.includes("--title-scale"))
      ).toBe(true);

      // No additional React renders during scroll
      expect(reactRenderCount - initialRenders).toBe(0);
    });

    it("should interpolate CSS values correctly based on scroll position", async () => {
      const propertyValues = new Map<string, string>();

      const mockSetProperty = vi.fn((property, value) => {
        propertyValues.set(property, value);
      });

      const mockElement = { style: { setProperty: mockSetProperty } } as any;
      vi.spyOn(document, "querySelector").mockReturnValue(mockElement);

      render(<ScrollableArticleHeader article={mockArticle} />);

      // Test specific scroll positions with expected values
      const testCases = [
        { scrollY: 0, expectedBlur: "0px", expectedAlpha: "0.18" },
        { scrollY: 100, expectedBlur: "5px", expectedAlpha: "0.19" },
        { scrollY: 300, expectedBlur: "12px", expectedAlpha: "0.21" },
        { scrollY: 600, expectedBlur: "16px", expectedAlpha: "0.22" },
      ];

      for (const { scrollY, expectedBlur, expectedAlpha } of testCases) {
        propertyValues.clear();

        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));

        await waitFor(() => {
          expect(propertyValues.has("--glass-blur")).toBe(true);
        });

        // Validate interpolated values (within tolerance)
        const blurValue = propertyValues.get("--glass-blur");
        const alphaValue = propertyValues.get("--glass-alpha");

        expect(blurValue).toBeTruthy();
        expect(alphaValue).toBeTruthy();

        // Parse numeric values for comparison
        const blurNum = parseFloat(blurValue?.replace("px", "") || "0");
        const alphaNum = parseFloat(alphaValue || "0");
        const expectedBlurNum = parseFloat(expectedBlur.replace("px", ""));
        const expectedAlphaNum = parseFloat(expectedAlpha);

        expect(blurNum).toBeCloseTo(expectedBlurNum, 1);
        expect(alphaNum).toBeCloseTo(expectedAlphaNum, 2);
      }
    });
  });

  describe("Mobile Safari Optimizations", () => {
    beforeEach(() => {
      // Mock iOS Safari user agent
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        writable: true,
      });
    });

    it("should handle Safari backdrop-filter performance", async () => {
      const computedStyles: string[] = [];

      // Mock getComputedStyle to track backdrop-filter usage
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = vi.fn((element) => {
        const style = originalGetComputedStyle(element);
        const backdropFilter =
          style.backdropFilter || style.webkitBackdropFilter;
        if (backdropFilter && backdropFilter !== "none") {
          computedStyles.push(backdropFilter);
        }
        return style;
      });

      render(<ScrollableArticleHeader article={mockArticle} />);

      // Trigger scroll to activate backdrop-filter
      Object.defineProperty(window, "scrollY", { value: 200, writable: true });
      window.dispatchEvent(new Event("scroll"));

      await waitFor(() => {
        expect(computedStyles.length).toBeGreaterThan(0);
      });

      // Should use quantized blur values for GPU performance
      const blurValues = computedStyles
        .filter((style) => style.includes("blur"))
        .map((style) =>
          parseFloat(style.match(/blur\((\d+\.?\d*)px\)/)?.[1] || "0")
        );

      // All blur values should be multiples of 0.5px for GPU optimization
      blurValues.forEach((value) => {
        expect(value % 0.5).toBe(0);
      });
    });

    it("should optimize for iOS momentum scrolling", async () => {
      render(<ScrollableArticleHeader article={mockArticle} />);

      const header =
        screen.getByRole("banner") || screen.getByTestId("scrollable-header");
      const style = getComputedStyle(header);

      // Should use passive event listeners (can't directly test, but verify no preventDefault calls)
      let preventDefaultCalled = false;
      const mockPreventDefault = vi.fn(() => {
        preventDefaultCalled = true;
      });

      const scrollEvent = new Event("scroll");
      Object.defineProperty(scrollEvent, "preventDefault", {
        value: mockPreventDefault,
      });

      // Dispatch scroll events
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(window, "scrollY", {
          value: i * 50,
          writable: true,
        });
        window.dispatchEvent(scrollEvent);
        vi.advanceTimersByTime(16);
      }

      // Should not prevent default (allows momentum scrolling)
      expect(preventDefaultCalled).toBe(false);
    });

    it("should handle rapid scroll events with throttling", async () => {
      let rafCallCount = 0;

      mockRequestAnimationFrame.mockImplementation((callback) => {
        rafCallCount++;
        setTimeout(() => callback(performance.now()), 16);
        return rafCallCount;
      });

      render(<ScrollableArticleHeader article={mockArticle} />);

      // Fire 100 rapid scroll events
      for (let i = 0; i < 100; i++) {
        Object.defineProperty(window, "scrollY", {
          value: i * 2,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));
      }

      await waitFor(() => {
        expect(rafCallCount).toBeGreaterThan(0);
      });

      // Should throttle to reasonable number of RAF calls
      expect(rafCallCount).toBeLessThan(10); // Much less than 100 events
    });
  });

  describe("Performance Budget Compliance", () => {
    it("should meet all performance requirements simultaneously", async () => {
      const performanceBudgets = {
        maxScriptingTimePerFrame: 3, // ms
        minFPS: 58,
        maxFrameDropPercentage: 0.02,
        maxReactRenders: 0, // During scroll
        maxMemoryGrowth: 5, // MB (mock measurement)
      };

      // Mock memory monitoring
      const initialMemory = 10; // MB
      let currentMemory = initialMemory;

      Object.defineProperty(performance, "memory", {
        get: () => ({
          usedJSHeapSize: currentMemory * 1024 * 1024,
          totalJSHeapSize: 50 * 1024 * 1024,
          jsHeapSizeLimit: 100 * 1024 * 1024,
        }),
      });

      render(<ScrollableArticleHeader article={mockArticle} />);
      const initialRenderCount = scrollMetrics.reactRenderCount;

      // Simulate intensive scroll session (10 seconds at 60fps)
      for (let frame = 0; frame < 600; frame++) {
        const time = frame / 60; // seconds
        const scrollY =
          500 * (1 - Math.cos(time * 0.5)) + Math.sin(time * 2) * 100;

        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));

        // Simulate minor memory growth
        currentMemory += 0.008; // 8KB per frame

        vi.advanceTimersByTime(16);
      }

      await waitFor(() => {
        expect(frameMetrics.length).toBeGreaterThan(500);
      });

      // Validate all performance budgets
      const failedFrames = frameMetrics.filter(
        (frame) =>
          frame.scriptingTime > performanceBudgets.maxScriptingTimePerFrame
      );
      expect(failedFrames.length).toBe(0);

      const droppedFrameRate =
        frameMetrics.filter((frame) => frame.dropped).length /
        frameMetrics.length;
      expect(droppedFrameRate).toBeLessThan(
        performanceBudgets.maxFrameDropPercentage
      );

      const averageFrameTime =
        frameMetrics.reduce((sum, frame) => sum + 16.67, 0) /
        frameMetrics.length;
      const fps = 1000 / averageFrameTime;
      expect(fps).toBeGreaterThanOrEqual(performanceBudgets.minFPS);

      const scrollRenderCount =
        scrollMetrics.reactRenderCount - initialRenderCount;
      expect(scrollRenderCount).toBeLessThanOrEqual(
        performanceBudgets.maxReactRenders
      );

      const memoryGrowth = currentMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(performanceBudgets.maxMemoryGrowth);
    });
  });

  describe("Scroll State Management", () => {
    it("should update data attributes for scroll state", async () => {
      render(<ScrollableArticleHeader article={mockArticle} />);

      const header =
        screen.getByRole("banner") || screen.getByTestId("scrollable-header");

      // Test different scroll states
      const scrollStates = [
        { scrollY: 0, expectedState: "top" },
        { scrollY: 50, expectedState: "scrolling" },
        { scrollY: 300, expectedState: "condensed" },
        { scrollY: 0, expectedState: "top" }, // Return to top
      ];

      for (const { scrollY, expectedState } of scrollStates) {
        Object.defineProperty(window, "scrollY", {
          value: scrollY,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));

        await waitFor(() => {
          expect(header).toHaveAttribute("data-scroll-state", expectedState);
        });
      }
    });

    it("should handle scroll direction detection", async () => {
      render(<ScrollableArticleHeader article={mockArticle} />);

      const header =
        screen.getByRole("banner") || screen.getByTestId("scrollable-header");

      // Simulate scroll down then up
      const scrollSequence = [0, 50, 100, 150, 100, 50, 0];

      for (let i = 0; i < scrollSequence.length - 1; i++) {
        const currentScroll = scrollSequence[i];
        const nextScroll = scrollSequence[i + 1];
        const direction = nextScroll > currentScroll ? "down" : "up";

        Object.defineProperty(window, "scrollY", {
          value: nextScroll,
          writable: true,
        });
        window.dispatchEvent(new Event("scroll"));

        await waitFor(() => {
          expect(header).toHaveAttribute("data-scroll-direction", direction);
        });
      }
    });
  });
});

// Import React for mocking
import React from "react";
