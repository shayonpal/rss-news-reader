/**
 * RR-255: Performance Tests for Glass Button Animations
 *
 * Validates:
 * - 60fps animation performance on mobile
 * - Debouncing for rapid interactions
 * - Memory efficiency
 * - Layout thrashing prevention
 * - GPU acceleration usage
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { SummaryButton } from "@/components/articles/summary-button";
import { GlassToolbarButton } from "@/components/ui/glass-button";

// Performance measurement utilities
const measureFrameRate = async (
  callback: () => void,
  duration: number = 1000
): Promise<number> => {
  const frames: number[] = [];
  let animationId: number;
  let startTime: number;

  const countFrame = (timestamp: number) => {
    if (!startTime) startTime = timestamp;
    frames.push(timestamp);

    if (timestamp - startTime < duration) {
      animationId = requestAnimationFrame(countFrame);
    }
  };

  callback();
  animationId = requestAnimationFrame(countFrame);

  await new Promise((resolve) => setTimeout(resolve, duration + 100));
  cancelAnimationFrame(animationId!);

  // Calculate FPS
  const timeElapsed = frames[frames.length - 1] - frames[0];
  return (frames.length / timeElapsed) * 1000;
};

const measureLayoutThrashing = (element: HTMLElement): number => {
  let layoutReads = 0;
  let layoutWrites = 0;

  // Proxy getComputedStyle to detect reads
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = new Proxy(originalGetComputedStyle, {
    apply: (target, thisArg, args) => {
      layoutReads++;
      return target.apply(thisArg, args);
    },
  });

  // Monitor style writes
  const originalStyle = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "style"
  );

  Object.defineProperty(element, "style", {
    get: originalStyle?.get,
    set: (value) => {
      layoutWrites++;
      return originalStyle?.set?.call(element, value);
    },
  });

  return layoutReads + layoutWrites;
};

// Mock dependencies
vi.mock("@/hooks/use-article-store", () => ({
  useArticleStore: () => ({
    generateSummary: vi.fn().mockResolvedValue({
      success: true,
      summary: "Test summary",
    }),
  }),
}));

describe("RR-255: Glass Button Animation Performance", () => {
  beforeEach(() => {
    // Setup performance observer
    if (!window.PerformanceObserver) {
      window.PerformanceObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn(() => []),
      }));
    }

    // Mock requestAnimationFrame for consistent timing
    let frameId = 0;
    window.requestAnimationFrame = vi.fn((callback) => {
      frameId++;
      setTimeout(() => callback(performance.now()), 16.67); // ~60fps
      return frameId;
    });

    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Animation Frame Rate", () => {
    it("should maintain 60fps during glass morphing animations", async () => {
      const { container } = render(
        <GlassToolbarButton className="animate-morph">
          Summary
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");

      // Trigger animation
      button.classList.add("morphing");

      // Measure frame rate during animation
      const fps = await measureFrameRate(() => {
        // Simulate glass morphing animation
        let progress = 0;
        const animate = () => {
          progress += 0.016; // ~60fps step
          button.style.transform = `scale(${1 + Math.sin(progress) * 0.1})`;
          button.style.opacity = `${0.8 + Math.sin(progress) * 0.2}`;

          if (progress < Math.PI * 2) {
            requestAnimationFrame(animate);
          }
        };
        animate();
      }, 1000);

      // Should maintain at least 55fps (allowing some variance)
      expect(fps).toBeGreaterThanOrEqual(55);
    });

    it("should use GPU acceleration for transforms", () => {
      const { container } = render(
        <GlassToolbarButton className="glass-morph">Summary</GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      const styles = window.getComputedStyle(button);

      // Check for GPU-accelerated properties
      expect(styles.willChange).toMatch(/transform|opacity/);

      // Check for 3D transforms (triggers GPU)
      const transform = styles.transform || styles.webkitTransform;
      expect(transform).toMatch(/translate3d|translateZ/);
    });

    it("should not cause layout thrashing during animations", () => {
      const { container } = render(
        <div>
          <GlassToolbarButton>Button 1</GlassToolbarButton>
          <GlassToolbarButton>Button 2</GlassToolbarButton>
          <GlassToolbarButton>Button 3</GlassToolbarButton>
        </div>
      );

      const buttons = screen.getAllByRole("button");

      // Track layout operations
      let totalLayoutOps = 0;

      buttons.forEach((button, index) => {
        // Simulate hover animation
        const ops = measureLayoutThrashing(button);

        // Trigger style changes
        button.style.transform = `scale(1.05)`;
        button.style.opacity = "0.9";

        totalLayoutOps += ops;
      });

      // Should batch layout operations efficiently
      // Expecting minimal layout thrashing (< 10 ops for 3 buttons)
      expect(totalLayoutOps).toBeLessThan(10);
    });

    it("should optimize animation on scroll", async () => {
      const { container } = render(
        <div style={{ height: "2000px" }}>
          {Array.from({ length: 20 }, (_, i) => (
            <GlassToolbarButton key={i}>Button {i}</GlassToolbarButton>
          ))}
        </div>
      );

      const buttons = screen.getAllByRole("button");

      // Simulate scroll event
      let scrollFrames = 0;
      const scrollHandler = () => {
        scrollFrames++;
        buttons.forEach((button) => {
          // Check if button is using transform instead of position changes
          const transform = button.style.transform;
          expect(transform).not.toContain("translate");
        });
      };

      window.addEventListener("scroll", scrollHandler);

      // Trigger scroll
      window.scrollY = 500;
      window.dispatchEvent(new Event("scroll"));

      // Clean up
      window.removeEventListener("scroll", scrollHandler);

      // Should use RAF for scroll animations
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });
  });

  describe("Interaction Performance", () => {
    it("should debounce rapid clicks effectively", async () => {
      const mockGenerateSummary = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(useArticleStore).mockReturnValue({
        generateSummary: mockGenerateSummary,
      });

      const user = userEvent.setup({ delay: null });
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");

      // Measure performance during rapid clicks
      const startTime = performance.now();

      // Perform rapid clicks
      for (let i = 0; i < 10; i++) {
        await user.click(button);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle rapidly without blocking UI
      expect(totalTime).toBeLessThan(100); // < 100ms for 10 clicks

      // Should only call API once (debounced)
      expect(mockGenerateSummary).toHaveBeenCalledTimes(1);
    });

    it("should prevent double-tap zoom on mobile", () => {
      const { container } = render(
        <GlassToolbarButton>Summary</GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      const styles = window.getComputedStyle(button);

      // Should have touch-action CSS to prevent zoom
      expect(styles.touchAction).toMatch(/manipulation|none/);

      // Should have user-select none to prevent text selection
      expect(styles.userSelect).toBe("none");
      expect(styles.webkitUserSelect).toBe("none");
    });

    it("should handle touch events efficiently", async () => {
      const { container } = render(
        <GlassToolbarButton>Summary</GlassToolbarButton>
      );

      const button = screen.getByRole("button");

      // Track touch event handling time
      let touchStartTime: number;
      let touchEndTime: number;

      button.addEventListener("touchstart", () => {
        touchStartTime = performance.now();
      });

      button.addEventListener("touchend", () => {
        touchEndTime = performance.now();
      });

      // Simulate touch
      const touchStart = new TouchEvent("touchstart", {
        touches: [{ clientX: 50, clientY: 50 } as Touch],
      });
      const touchEnd = new TouchEvent("touchend", {
        changedTouches: [{ clientX: 50, clientY: 50 } as Touch],
      });

      button.dispatchEvent(touchStart);
      button.dispatchEvent(touchEnd);

      // Touch handling should be fast
      const touchDuration = touchEndTime! - touchStartTime!;
      expect(touchDuration).toBeLessThan(16.67); // < 1 frame
    });
  });

  describe("Memory Efficiency", () => {
    it("should clean up event listeners on unmount", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = render(
        <GlassToolbarButton>Summary</GlassToolbarButton>
      );

      const addedListeners = addEventListenerSpy.mock.calls.length;

      // Unmount component
      unmount();

      const removedListeners = removeEventListenerSpy.mock.calls.length;

      // Should remove all added listeners
      expect(removedListeners).toBeGreaterThanOrEqual(addedListeners);
    });

    it("should not leak memory with repeated renders", () => {
      // Track memory usage (simplified)
      const memorySnapshots: number[] = [];

      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <GlassToolbarButton>Button {i}</GlassToolbarButton>
        );

        // Simulate memory snapshot
        if (performance.memory) {
          memorySnapshots.push(performance.memory.usedJSHeapSize);
        }

        unmount();
      }

      if (memorySnapshots.length > 1) {
        // Memory should not continuously increase
        const firstSnapshot = memorySnapshots[0];
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
        const memoryGrowth = lastSnapshot - firstSnapshot;

        // Allow max 10% memory growth
        expect(memoryGrowth).toBeLessThan(firstSnapshot * 0.1);
      }
    });

    it("should lazy-load summary content", async () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      // Initially, no summary content should be loaded
      expect(container.querySelector("[data-summary]")).toBeNull();

      // After interaction, summary should load
      const button = screen.getByRole("button");
      const user = userEvent.setup({ delay: null });
      await user.click(button);

      await waitFor(() => {
        // Summary content should now be present
        expect(
          container.querySelector("[data-summary-loading]")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Rendering Performance", () => {
    it("should batch DOM updates efficiently", async () => {
      const { container } = render(
        <div>
          {Array.from({ length: 10 }, (_, i) => (
            <GlassToolbarButton key={i}>Button {i}</GlassToolbarButton>
          ))}
        </div>
      );

      // Track DOM mutations
      let mutationCount = 0;
      const observer = new MutationObserver(() => {
        mutationCount++;
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      // Trigger state changes
      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        button.classList.add("active");
      });

      // Allow mutations to process
      await new Promise((resolve) => setTimeout(resolve, 0));

      observer.disconnect();

      // Should batch mutations efficiently
      // Expecting < 20 mutations for 10 buttons (2 per button max)
      expect(mutationCount).toBeLessThan(20);
    });

    it("should use CSS containment for performance", () => {
      const { container } = render(
        <GlassToolbarButton>Summary</GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      const styles = window.getComputedStyle(button);

      // Should use CSS containment for performance
      expect(styles.contain).toMatch(/layout|paint|style/);
    });

    it("should minimize reflows during hover states", async () => {
      const { container } = render(
        <GlassToolbarButton>Summary</GlassToolbarButton>
      );

      const button = screen.getByRole("button");

      // Track reflows
      let reflows = 0;
      const properties = [
        "offsetWidth",
        "offsetHeight",
        "clientWidth",
        "clientHeight",
      ];

      properties.forEach((prop) => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(
          HTMLElement.prototype,
          prop
        );

        Object.defineProperty(button, prop, {
          get: () => {
            reflows++;
            return originalDescriptor?.get?.call(button);
          },
        });
      });

      // Simulate hover
      button.dispatchEvent(new MouseEvent("mouseenter"));
      button.classList.add("hover");

      // Check styles (may trigger reflow)
      const styles = window.getComputedStyle(button);
      const opacity = styles.opacity;
      const transform = styles.transform;

      // Should minimize reflows (< 3 for hover state)
      expect(reflows).toBeLessThan(3);
    });
  });
});
