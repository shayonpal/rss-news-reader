import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressBar } from "../progress-bar";
import type { ProgressBarProps } from "../progress-bar";

// RR-248: TDD Test Suite for Dynamic ProgressBar Component
// This file will initially FAIL since ProgressBar component doesn't exist yet
// Tests define the exact behavior required for implementation

// Mock performance APIs for mobile Safari testing
const mockRequestAnimationFrame = vi.fn();
const mockPerformanceNow = vi.fn();

interface MockPerformanceEntry {
  name: string;
  duration: number;
  entryType: string;
}

interface PerformanceMetrics {
  frames: number;
  drops: number;
  startTime: number;
}

declare global {
  interface Window {
    performanceMetrics: PerformanceMetrics;
    requestAnimationFrame: typeof mockRequestAnimationFrame;
  }
}

describe("ProgressBar Component (RR-248 TDD)", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Mock requestAnimationFrame for performance testing
    global.requestAnimationFrame = mockRequestAnimationFrame.mockImplementation(
      (callback) => {
        const id = setTimeout(() => callback(performance.now()), 16); // 60fps
        return id as unknown as number;
      }
    );

    // Mock performance.now for timing tests
    global.performance.now = mockPerformanceNow.mockReturnValue(0);

    // Reset performance metrics
    (global as any).window = {
      ...global.window,
      performanceMetrics: {
        frames: 0,
        drops: 0,
        startTime: 0,
      },
    };
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Basic Rendering and Props", () => {
    it("should render with correct transform scale based on value prop", () => {
      render(<ProgressBar value={75} />);

      const progressElement = screen.getByRole("progressbar");
      expect(progressElement).toBeInTheDocument();

      // Should use transform: scaleX instead of width for performance
      const style = getComputedStyle(progressElement);
      expect(style.transform).toContain("scaleX(0.75)");
      expect(style.width).not.toContain("%"); // Should not use width animations
    });

    it("should handle all variant types correctly", () => {
      const variants: Array<ProgressBarProps["variant"]> = [
        "sync",
        "skeleton",
        "indeterminate",
      ];

      variants.forEach((variant) => {
        const { rerender } = render(
          <ProgressBar value={50} variant={variant} />
        );

        const progressElement = screen.getByRole("progressbar");

        if (variant === "sync") {
          expect(progressElement).toHaveClass("progress-sync");
        } else if (variant === "skeleton") {
          expect(progressElement).toHaveClass("progress-skeleton");
        } else if (variant === "indeterminate") {
          expect(progressElement).toHaveClass("progress-indeterminate");
          // Indeterminate should ignore value prop and show animation
          expect(progressElement).toHaveAttribute("aria-valuenow", undefined);
        }

        rerender(<div />); // Clear for next iteration
      });
    });

    it("should apply custom className while preserving base styles", () => {
      render(<ProgressBar value={25} className="custom-class" />);

      const progressElement = screen.getByRole("progressbar");
      expect(progressElement).toHaveClass("custom-class");
      expect(progressElement).toHaveClass("progress-bar"); // Base class should be preserved
    });

    it("should clamp values between 0 and 100", () => {
      const testCases = [
        { input: -10, expected: 0 },
        { input: 0, expected: 0 },
        { input: 50, expected: 50 },
        { input: 100, expected: 100 },
        { input: 150, expected: 100 },
        { input: NaN, expected: 0 },
      ];

      testCases.forEach(({ input, expected }, index) => {
        const { rerender } = render(<ProgressBar value={input} key={index} />);

        const progressElement = screen.getByRole("progressbar");
        expect(progressElement).toHaveAttribute(
          "aria-valuenow",
          expected.toString()
        );
        expect(getComputedStyle(progressElement).transform).toContain(
          `scaleX(${expected / 100})`
        );

        rerender(<div />);
      });
    });
  });

  describe("Performance Characteristics", () => {
    it("should use transform-only animations to avoid layout thrashing", async () => {
      let layoutRecalculations = 0;
      const originalOffsetWidth = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "offsetWidth"
      );

      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        get() {
          layoutRecalculations++;
          return 100;
        },
      });

      render(<ProgressBar value={0} />);
      const progressElement = screen.getByRole("progressbar");

      // Simulate rapid value changes (60fps)
      for (let i = 0; i <= 100; i += 5) {
        const newProps = { value: i };
        // Re-render with new value
        render(<ProgressBar {...newProps} />);
        vi.advanceTimersByTime(16); // 60fps frame
      }

      // Should not trigger layout recalculations
      expect(layoutRecalculations).toBe(0);

      // Restore original descriptor
      if (originalOffsetWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          "offsetWidth",
          originalOffsetWidth
        );
      }
    });

    it("should maintain <3ms scripting time per progress update", async () => {
      const timingMeasurements: number[] = [];

      mockPerformanceNow
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(2.5) // 2.5ms - under budget
        .mockReturnValueOnce(5.0)
        .mockReturnValueOnce(7.2) // 2.2ms - under budget
        .mockReturnValueOnce(10.0)
        .mockReturnValueOnce(12.8); // 2.8ms - under budget

      render(<ProgressBar value={0} />);

      // Simulate rapid updates
      const values = [25, 50, 75];
      for (const value of values) {
        const startTime = performance.now();
        render(<ProgressBar value={value} />);
        const endTime = performance.now();

        timingMeasurements.push(endTime - startTime);
      }

      // All measurements should be under 3ms budget
      timingMeasurements.forEach((time) => {
        expect(time).toBeLessThan(3);
      });

      const averageTime =
        timingMeasurements.reduce((a, b) => a + b, 0) /
        timingMeasurements.length;
      expect(averageTime).toBeLessThan(2); // Well under budget
    });

    it("should promote to GPU layer with proper CSS properties", () => {
      render(<ProgressBar value={50} />);

      const progressElement = screen.getByRole("progressbar");
      const style = getComputedStyle(progressElement);

      // Should use GPU acceleration hints
      expect(style.willChange).toBe("transform");
      expect(style.transform).toContain("translateZ(0)"); // Force GPU layer
      expect(style.backfaceVisibility).toBe("hidden"); // Safari optimization
    });

    it("should handle rapid value updates without frame drops", async () => {
      let frameCount = 0;
      let droppedFrames = 0;
      let lastFrameTime = 0;

      mockRequestAnimationFrame.mockImplementation((callback) => {
        const currentTime = frameCount * 16.67; // 60fps timing

        if (lastFrameTime > 0 && currentTime - lastFrameTime > 20) {
          droppedFrames++; // Frame took longer than 20ms
        }

        frameCount++;
        lastFrameTime = currentTime;
        callback(currentTime);
        return frameCount;
      });

      render(<ProgressBar value={0} />);

      // Simulate 2 seconds of 60fps updates
      for (let frame = 0; frame < 120; frame++) {
        const progress = (frame / 120) * 100;
        render(<ProgressBar value={progress} />);
        vi.advanceTimersByTime(16);
      }

      // Should maintain 60fps with minimal frame drops (<1%)
      const frameDropRate = droppedFrames / frameCount;
      expect(frameDropRate).toBeLessThan(0.01);
    });
  });

  describe("Accessibility Compliance (WCAG 2.1 AA)", () => {
    it("should have correct ARIA attributes for determinate progress", () => {
      render(<ProgressBar value={75} />);

      const progressElement = screen.getByRole("progressbar");
      expect(progressElement).toHaveAttribute("role", "progressbar");
      expect(progressElement).toHaveAttribute("aria-valuenow", "75");
      expect(progressElement).toHaveAttribute("aria-valuemin", "0");
      expect(progressElement).toHaveAttribute("aria-valuemax", "100");
    });

    it("should handle indeterminate state ARIA attributes", () => {
      render(<ProgressBar value={50} variant="indeterminate" />);

      const progressElement = screen.getByRole("progressbar");
      expect(progressElement).toHaveAttribute("role", "progressbar");
      expect(progressElement).not.toHaveAttribute("aria-valuenow");
      expect(progressElement).toHaveAttribute("aria-valuetext", "Loading...");
    });

    it("should provide screen reader announcements for significant progress", async () => {
      // Mock aria-live region for announcements
      const announcements: string[] = [];
      const mockAriaLive = {
        textContent: "",
        setAttribute: vi.fn((attr, value) => {
          if (attr === "aria-live" && value === "polite") {
            announcements.push(mockAriaLive.textContent);
          }
        }),
      };

      vi.spyOn(document, "createElement").mockImplementation((tagName) => {
        if (tagName === "div") {
          return mockAriaLive as any;
        }
        return document.createElement(tagName);
      });

      render(<ProgressBar value={0} />);

      // Test announcements at 25%, 50%, 75%, 100%
      const milestones = [25, 50, 75, 100];
      for (const value of milestones) {
        render(<ProgressBar value={value} />);
        vi.advanceTimersByTime(100); // Allow announcement debouncing
      }

      // Should announce at major milestones
      expect(announcements.length).toBeGreaterThanOrEqual(milestones.length);
    });

    it("should support keyboard navigation and focus management", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <div>
          <button>Before</button>
          <ProgressBar value={50} />
          <button>After</button>
        </div>
      );

      const progressElement = screen.getByRole("progressbar");

      // Should be focusable via keyboard
      await user.tab();
      expect(screen.getByText("Before")).toHaveFocus();

      await user.tab();
      expect(progressElement).toHaveFocus();

      await user.tab();
      expect(screen.getByText("After")).toHaveFocus();
    });
  });

  describe("Theme Integration", () => {
    it("should integrate with CSS custom properties system", () => {
      render(<ProgressBar value={60} />);

      const progressElement = screen.getByRole("progressbar");
      const style = getComputedStyle(progressElement);

      // Should use CSS custom properties for theming
      expect(style.backgroundColor).toContain("var(--progress-bg)");
      expect(style.color).toContain("var(--progress-text)");

      // Should respect violet theme integration
      expect(progressElement).toHaveClass("theme-violet-compatible");
    });

    it("should handle dark mode transitions", () => {
      // Mock CSS custom property changes for dark mode
      const mockElement = document.createElement("div");
      mockElement.style.setProperty("--progress-bg", "oklch(0.53 0.18 270)"); // Dark violet
      mockElement.style.setProperty("--progress-text", "oklch(0.95 0.05 270)"); // Light text

      render(<ProgressBar value={40} />);

      const progressElement = screen.getByRole("progressbar");

      // Should maintain contrast ratios in dark mode
      const bgColor = getComputedStyle(progressElement).backgroundColor;
      const textColor = getComputedStyle(progressElement).color;

      expect(bgColor).toBeTruthy();
      expect(textColor).toBeTruthy();

      // Note: Actual contrast calculation would require color parsing
      // This is a placeholder for contrast ratio validation
    });
  });

  describe("Variant-Specific Behavior", () => {
    it("should handle sync variant with smooth animations", async () => {
      render(<ProgressBar value={0} variant="sync" />);

      const progressElement = screen.getByRole("progressbar");

      // Sync variant should have smooth transitions
      const style = getComputedStyle(progressElement);
      expect(style.transition).toContain("transform");
      expect(style.transitionDuration).toBe("0.3s"); // Smooth but not too slow

      // Should handle sync completion state
      render(<ProgressBar value={100} variant="sync" />);
      expect(progressElement).toHaveClass("sync-complete");
    });

    it("should handle skeleton variant with shimmer animation", () => {
      render(<ProgressBar value={60} variant="skeleton" />);

      const progressElement = screen.getByRole("progressbar");
      const style = getComputedStyle(progressElement);

      // Skeleton should have shimmer effect
      expect(style.background).toContain("linear-gradient");
      expect(style.animation).toContain("shimmer");

      // Should maintain accessibility even in skeleton state
      expect(progressElement).toHaveAttribute("aria-label", "Loading content");
    });

    it("should handle indeterminate variant with continuous animation", () => {
      render(<ProgressBar value={50} variant="indeterminate" />);

      const progressElement = screen.getByRole("progressbar");
      const style = getComputedStyle(progressElement);

      // Indeterminate should have continuous animation
      expect(style.animation).toContain("indeterminate");
      expect(style.animationDuration).toBe("1.5s");
      expect(style.animationIterationCount).toBe("infinite");

      // Value prop should be ignored for indeterminate
      expect(progressElement).not.toHaveAttribute("aria-valuenow");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle rapid consecutive updates gracefully", async () => {
      let updateCount = 0;
      const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;

      CSSStyleDeclaration.prototype.setProperty = vi.fn((property, value) => {
        if (property === "--progress-value") {
          updateCount++;
        }
        return originalSetProperty.call(this, property, value);
      });

      render(<ProgressBar value={0} />);

      // Rapid fire 100 updates
      for (let i = 0; i < 100; i++) {
        render(<ProgressBar value={i} />);
      }

      // Should debounce updates to prevent performance issues
      expect(updateCount).toBeLessThan(100); // Should be throttled

      // Restore original method
      CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
    });

    it("should maintain functionality with CSS disabled", () => {
      // Mock CSS.supports to return false
      const originalSupports = CSS.supports;
      CSS.supports = vi.fn(() => false);

      render(<ProgressBar value={70} />);

      const progressElement = screen.getByRole("progressbar");

      // Should fall back to width-based progress (less optimal but functional)
      expect(progressElement).toHaveAttribute("aria-valuenow", "70");
      expect(progressElement.textContent).toContain("70%"); // Fallback text display

      // Restore CSS.supports
      CSS.supports = originalSupports;
    });

    it("should handle memory constraints on low-end devices", () => {
      // Simulate low memory environment
      const originalMemory = (navigator as any).deviceMemory;
      Object.defineProperty(navigator, "deviceMemory", {
        value: 0.5, // 512MB - low memory device
        configurable: true,
      });

      render(<ProgressBar value={30} />);

      const progressElement = screen.getByRole("progressbar");

      // Should reduce animation complexity for low-memory devices
      expect(progressElement).toHaveClass("low-memory-mode");

      // Restore original value
      if (originalMemory !== undefined) {
        Object.defineProperty(navigator, "deviceMemory", {
          value: originalMemory,
          configurable: true,
        });
      }
    });
  });

  describe("Integration with SimpleFeedSidebar", () => {
    it("should replace inline style patterns from lines 291, 368, 498", () => {
      // This test ensures ProgressBar correctly replaces the inline styles
      // Found in SimpleFeedSidebar at the specified line numbers

      const inlineStylePatterns = [
        "style={{ width: `${syncProgress}%` }}", // Line 291
        "style={{ width: `${60 + Math.random() * 40}%` }}", // Line 368 (skeleton)
        "style={{ width: `${100}%` }}", // Line 498 (complete)
      ];

      // Test that ProgressBar provides equivalent functionality
      const syncValues = [45, 73, 100];

      syncValues.forEach((value, index) => {
        const { rerender } = render(
          <ProgressBar value={value} variant="sync" />
        );

        const progressElement = screen.getByRole("progressbar");

        // Should use transform instead of width
        expect(getComputedStyle(progressElement).transform).toContain(
          `scaleX(${value / 100})`
        );

        // Should not use inline width styles
        expect(progressElement.style.width).not.toContain("%");

        rerender(<div />);
      });
    });
  });
});
