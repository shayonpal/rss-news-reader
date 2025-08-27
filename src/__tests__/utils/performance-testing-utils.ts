import { vi } from "vitest";

// RR-248: Performance Testing Utilities for Dynamic Styling Components
// Provides consistent performance measurement and validation across all test suites

/**
 * Frame performance metrics for animation testing
 */
export interface FrameMetrics {
  frameId: number;
  scriptingTime: number;
  paintTime: number;
  layoutTime: number;
  timestamp: number;
  dropped: boolean;
}

/**
 * Memory usage tracking for leak detection
 */
export interface MemoryMetrics {
  initialHeapSize: number;
  currentHeapSize: number;
  peakHeapSize: number;
  growthMB: number;
  gcCount: number;
}

/**
 * Touch interaction performance metrics
 */
export interface TouchMetrics {
  startTime: number;
  responseTime: number;
  element: string;
  success: boolean;
}

/**
 * CSS animation performance tracking
 */
export interface AnimationMetrics {
  property: string;
  duration: number;
  iterationCount: number;
  fps: number;
  frameDrops: number;
}

/**
 * Performance budget constants for RSS Reader mobile optimization
 */
export const PERFORMANCE_BUDGETS = {
  SCRIPTING_TIME_PER_FRAME: 3, // ms
  PAINT_TIME_PER_FRAME: 8, // ms
  TOTAL_FRAME_BUDGET: 16.67, // ms (60fps)
  TOUCH_RESPONSE_TIME: 50, // ms
  MEMORY_GROWTH_LIMIT: 5, // MB
  MIN_FPS: 58,
  MAX_FRAME_DROP_RATE: 0.02, // 2%
  CSS_ANIMATION_FPS: 60,
  LAYOUT_SHIFT_SCORE: 0.1,
} as const;

/**
 * Performance profiler for measuring scripting time and frame performance
 */
export class PerformanceProfiler {
  private frames: FrameMetrics[] = [];
  private isRunning = false;
  private rafId: number | null = null;
  private startTime = 0;

  /**
   * Start performance profiling
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.frames = [];
    this.startTime = performance.now();

    this.measureFrame();
  }

  /**
   * Stop profiling and return metrics
   */
  stop(): {
    averageScriptingTime: number;
    peakScriptingTime: number;
    frameDropRate: number;
    fps: number;
    totalFrames: number;
  } {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    const totalTime = performance.now() - this.startTime;
    const averageScriptingTime =
      this.frames.reduce((sum, frame) => sum + frame.scriptingTime, 0) /
      this.frames.length;
    const peakScriptingTime = Math.max(
      ...this.frames.map((f) => f.scriptingTime)
    );
    const droppedFrames = this.frames.filter((f) => f.dropped).length;
    const frameDropRate = droppedFrames / this.frames.length;
    const fps = this.frames.length / (totalTime / 1000);

    return {
      averageScriptingTime,
      peakScriptingTime,
      frameDropRate,
      fps,
      totalFrames: this.frames.length,
    };
  }

  /**
   * Get current frame metrics
   */
  getFrames(): FrameMetrics[] {
    return [...this.frames];
  }

  private measureFrame(): void {
    if (!this.isRunning) return;

    const frameStartTime = performance.now();

    this.rafId = requestAnimationFrame(() => {
      const frameEndTime = performance.now();
      const scriptingTime = frameEndTime - frameStartTime;
      const dropped = scriptingTime > PERFORMANCE_BUDGETS.TOTAL_FRAME_BUDGET;

      this.frames.push({
        frameId: this.frames.length,
        scriptingTime,
        paintTime: Math.min(scriptingTime, 8), // Estimated paint time
        layoutTime: 0, // Would need layout thrashing detection
        timestamp: frameStartTime,
        dropped,
      });

      this.measureFrame();
    });
  }
}

/**
 * Frame rate monitor for animation performance
 */
export class FrameRateMonitor {
  private frameTimestamps: number[] = [];
  private isMonitoring = false;

  /**
   * Start monitoring frame rate
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameTimestamps = [];
    this.recordFrame();
  }

  /**
   * Stop monitoring and calculate FPS
   */
  stop(): {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    frameDrops: number;
  } {
    this.isMonitoring = false;

    if (this.frameTimestamps.length < 2) {
      return { averageFPS: 0, minFPS: 0, maxFPS: 0, frameDrops: 0 };
    }

    const frameDurations = [];
    for (let i = 1; i < this.frameTimestamps.length; i++) {
      frameDurations.push(
        this.frameTimestamps[i] - this.frameTimestamps[i - 1]
      );
    }

    const averageFrameTime =
      frameDurations.reduce((a, b) => a + b, 0) / frameDurations.length;
    const minFrameTime = Math.min(...frameDurations);
    const maxFrameTime = Math.max(...frameDurations);
    const frameDrops = frameDurations.filter(
      (duration) => duration > 20
    ).length;

    return {
      averageFPS: 1000 / averageFrameTime,
      minFPS: 1000 / maxFrameTime,
      maxFPS: 1000 / minFrameTime,
      frameDrops,
    };
  }

  private recordFrame(): void {
    if (!this.isMonitoring) return;

    this.frameTimestamps.push(performance.now());
    requestAnimationFrame(() => this.recordFrame());
  }
}

/**
 * CSS Variable testing utilities
 */
export class CSSVariableTester {
  private originalSetProperty: typeof CSSStyleDeclaration.prototype.setProperty;
  private propertyUpdates: Array<{
    property: string;
    value: string;
    timestamp: number;
  }> = [];

  constructor() {
    this.originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
  }

  /**
   * Start monitoring CSS variable changes
   */
  startMonitoring(): void {
    this.propertyUpdates = [];

    CSSStyleDeclaration.prototype.setProperty = vi.fn(
      (property: string, value: string) => {
        if (property.startsWith("--")) {
          this.propertyUpdates.push({
            property,
            value,
            timestamp: performance.now(),
          });
        }
        return this.originalSetProperty.call(this, property, value);
      }
    );
  }

  /**
   * Stop monitoring and return updates
   */
  stopMonitoring(): Array<{
    property: string;
    value: string;
    timestamp: number;
  }> {
    CSSStyleDeclaration.prototype.setProperty = this.originalSetProperty;
    return [...this.propertyUpdates];
  }

  /**
   * Mock CSS custom property support
   */
  static mockCSSSupport(supported: boolean): void {
    const originalSupports = CSS.supports;
    CSS.supports = vi.fn((property: string) => {
      if (property.includes("--")) return supported;
      return originalSupports(property);
    });
  }

  /**
   * Restore original CSS.supports
   */
  static restoreCSSSupport(): void {
    vi.restoreAllMocks();
  }
}

/**
 * Scroll performance testing utilities
 */
export class ScrollPerformanceTester {
  private scrollEvents: Array<{ scrollY: number; timestamp: number }> = [];
  private rafCallbacks: number = 0;

  /**
   * Create smooth scroll simulation
   */
  static createSmoothScroll(
    startY: number,
    endY: number,
    duration: number = 1000
  ): Array<{ scrollY: number; delay: number }> {
    const steps = Math.ceil(duration / 16); // 60fps
    const points = [];

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      // Ease-out cubic function for natural scroll feeling
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const scrollY = startY + (endY - startY) * easedProgress;

      points.push({
        scrollY: Math.round(scrollY),
        delay: i * 16,
      });
    }

    return points;
  }

  /**
   * Simulate momentum scroll with deceleration
   */
  static createMomentumScroll(
    startY: number,
    velocity: number,
    deceleration: number = 0.95
  ): Array<{ scrollY: number; delay: number }> {
    const points = [];
    let currentY = startY;
    let currentVelocity = velocity;
    let time = 0;

    while (Math.abs(currentVelocity) > 0.5) {
      currentY += currentVelocity;
      currentVelocity *= deceleration;
      time += 16;

      points.push({
        scrollY: Math.round(currentY),
        delay: time,
      });
    }

    return points;
  }

  /**
   * Monitor scroll performance
   */
  startMonitoring(): void {
    this.scrollEvents = [];
    this.rafCallbacks = 0;

    // Mock RAF to count callback usage
    const originalRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = vi.fn((callback) => {
      this.rafCallbacks++;
      return originalRAF(callback);
    });

    // Monitor scroll events
    window.addEventListener("scroll", this.handleScroll.bind(this));
  }

  /**
   * Stop monitoring and return metrics
   */
  stopMonitoring(): {
    scrollEvents: number;
    rafCallbacks: number;
    throttlingEfficiency: number;
  } {
    window.removeEventListener("scroll", this.handleScroll.bind(this));
    vi.restoreAllMocks();

    const throttlingEfficiency =
      this.scrollEvents.length > 0
        ? this.rafCallbacks / this.scrollEvents.length
        : 0;

    return {
      scrollEvents: this.scrollEvents.length,
      rafCallbacks: this.rafCallbacks,
      throttlingEfficiency,
    };
  }

  private handleScroll(): void {
    this.scrollEvents.push({
      scrollY: window.scrollY,
      timestamp: performance.now(),
    });
  }
}

/**
 * Memory leak detection utilities
 */
export class MemoryLeakDetector {
  private initialMemory: number = 0;
  private peakMemory: number = 0;
  private measurements: Array<{ timestamp: number; heapSize: number }> = [];

  /**
   * Start monitoring memory usage
   */
  start(): void {
    this.initialMemory = this.getCurrentMemoryUsage();
    this.peakMemory = this.initialMemory;
    this.measurements = [];

    this.recordMemoryUsage();
  }

  /**
   * Stop monitoring and return metrics
   */
  stop(): MemoryMetrics {
    const currentMemory = this.getCurrentMemoryUsage();

    return {
      initialHeapSize: this.initialMemory,
      currentHeapSize: currentMemory,
      peakHeapSize: this.peakMemory,
      growthMB: (currentMemory - this.initialMemory) / (1024 * 1024),
      gcCount: 0, // Would need GC monitoring for accurate count
    };
  }

  /**
   * Force garbage collection (if available)
   */
  static forceGC(): void {
    if ((global as any).gc) {
      (global as any).gc();
    }
  }

  private getCurrentMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }

  private recordMemoryUsage(): void {
    const currentMemory = this.getCurrentMemoryUsage();
    this.peakMemory = Math.max(this.peakMemory, currentMemory);

    this.measurements.push({
      timestamp: performance.now(),
      heapSize: currentMemory,
    });

    // Continue monitoring every 100ms
    setTimeout(() => this.recordMemoryUsage(), 100);
  }
}

/**
 * Animation performance testing utilities
 */
export class AnimationTester {
  /**
   * Mock requestAnimationFrame with controlled timing
   */
  static mockRAFWithTiming(frameTime: number = 16.67): {
    getFrameCount: () => number;
    advanceFrames: (count: number) => void;
    restore: () => void;
  } {
    let frameCount = 0;
    const callbacks: FrameRequestCallback[] = [];
    const originalRAF = global.requestAnimationFrame;

    global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return ++frameCount;
    });

    return {
      getFrameCount: () => frameCount,
      advanceFrames: (count: number) => {
        for (let i = 0; i < count; i++) {
          const currentCallbacks = [...callbacks];
          callbacks.length = 0;
          currentCallbacks.forEach((callback) => {
            callback(frameCount * frameTime);
          });
          frameCount++;
        }
      },
      restore: () => {
        global.requestAnimationFrame = originalRAF;
      },
    };
  }

  /**
   * Measure animation smoothness
   */
  static measureAnimationSmoothness(
    element: HTMLElement,
    property: string,
    duration: number
  ): Promise<AnimationMetrics> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const initialValue = getComputedStyle(element)[property as any];
      let frameCount = 0;
      let frameDrops = 0;
      let lastFrameTime = startTime;

      const measureFrame = () => {
        const now = performance.now();
        const frameDelta = now - lastFrameTime;

        frameCount++;
        if (frameDelta > 20) {
          frameDrops++;
        }

        lastFrameTime = now;

        if (now - startTime < duration) {
          requestAnimationFrame(measureFrame);
        } else {
          const totalTime = now - startTime;
          const fps = frameCount / (totalTime / 1000);

          resolve({
            property,
            duration: totalTime,
            iterationCount: frameCount,
            fps,
            frameDrops,
          });
        }
      };

      requestAnimationFrame(measureFrame);
    });
  }
}

/**
 * Device simulation utilities for testing
 */
export class DeviceSimulator {
  /**
   * Simulate low-memory device
   */
  static simulateLowMemory(memoryMB: number = 512): () => void {
    const originalMemory = (navigator as any).deviceMemory;

    Object.defineProperty(navigator, "deviceMemory", {
      value: memoryMB / 1024, // Convert to GB
      configurable: true,
    });

    return () => {
      if (originalMemory !== undefined) {
        Object.defineProperty(navigator, "deviceMemory", {
          value: originalMemory,
          configurable: true,
        });
      }
    };
  }

  /**
   * Simulate slow CPU (reduced RAF frequency)
   */
  static simulateSlowCPU(frameTime: number = 33.33): () => void {
    const originalRAF = global.requestAnimationFrame;

    global.requestAnimationFrame = vi.fn((callback) => {
      return setTimeout(() => callback(performance.now()), frameTime);
    });

    return () => {
      global.requestAnimationFrame = originalRAF;
    };
  }

  /**
   * Simulate network conditions
   */
  static simulateNetworkConditions(
    downloadSpeed: number,
    uploadSpeed: number,
    latency: number
  ): {
    mockFetch: typeof fetch;
    restore: () => void;
  } {
    const originalFetch = global.fetch;

    const mockFetch: typeof fetch = async (input, init) => {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, latency));

      const response = await originalFetch(input, init);

      // Simulate slower download speeds
      if (response.body) {
        const reader = response.body.getReader();
        const stream = new ReadableStream({
          start(controller) {
            function pump(): any {
              return reader.read().then(({ done, value }) => {
                if (done) {
                  controller.close();
                  return;
                }

                // Throttle based on download speed
                const throttleDelay = value
                  ? (value.length / downloadSpeed) * 1000
                  : 0;
                setTimeout(() => {
                  controller.enqueue(value);
                  pump();
                }, throttleDelay);
              });
            }
            return pump();
          },
        });

        return new Response(stream, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      return response;
    };

    global.fetch = mockFetch;

    return {
      mockFetch,
      restore: () => {
        global.fetch = originalFetch;
      },
    };
  }
}

/**
 * Touch interaction testing utilities
 */
export class TouchInteractionTester {
  private touchMetrics: TouchMetrics[] = [];

  /**
   * Start monitoring touch interactions
   */
  startMonitoring(): void {
    this.touchMetrics = [];

    document.addEventListener("touchstart", this.handleTouchStart.bind(this), {
      passive: true,
    });
    document.addEventListener("touchend", this.handleTouchEnd.bind(this), {
      passive: true,
    });
  }

  /**
   * Stop monitoring and return metrics
   */
  stopMonitoring(): TouchMetrics[] {
    document.removeEventListener(
      "touchstart",
      this.handleTouchStart.bind(this)
    );
    document.removeEventListener("touchend", this.handleTouchEnd.bind(this));

    return [...this.touchMetrics];
  }

  /**
   * Simulate touch gesture
   */
  static async simulateTouch(
    element: HTMLElement,
    gesture: "tap" | "swipe" | "pinch",
    options?: {
      duration?: number;
      distance?: number;
      direction?: "up" | "down" | "left" | "right";
    }
  ): Promise<void> {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    switch (gesture) {
      case "tap":
        element.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [
              new Touch({
                identifier: 0,
                target: element,
                clientX: centerX,
                clientY: centerY,
              }),
            ],
            bubbles: true,
          })
        );

        await new Promise((resolve) =>
          setTimeout(resolve, options?.duration || 100)
        );

        element.dispatchEvent(
          new TouchEvent("touchend", {
            touches: [],
            bubbles: true,
          })
        );
        break;

      case "swipe":
        // Implementation for swipe gestures
        break;

      case "pinch":
        // Implementation for pinch gestures
        break;
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    const startTime = performance.now();

    // Store touch start time
    (event.target as any)._touchStartTime = startTime;
  }

  private handleTouchEnd(event: TouchEvent): void {
    const endTime = performance.now();
    const startTime = (event.target as any)._touchStartTime;

    if (startTime) {
      this.touchMetrics.push({
        startTime,
        responseTime: endTime - startTime,
        element: (event.target as Element).tagName,
        success: true,
      });
    }
  }
}

/**
 * Utility functions for performance testing
 */
export const PerformanceTestUtils = {
  /**
   * Wait for next animation frame
   */
  waitForNextFrame(): Promise<number> {
    return new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  },

  /**
   * Wait for multiple frames
   */
  async waitForFrames(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.waitForNextFrame();
    }
  },

  /**
   * Measure function execution time
   */
  measureExecutionTime<T>(fn: () => T): { result: T; executionTime: number } {
    const start = performance.now();
    const result = fn();
    const executionTime = performance.now() - start;

    return { result, executionTime };
  },

  /**
   * Create performance budget validator
   */
  createBudgetValidator(budgets: typeof PERFORMANCE_BUDGETS) {
    return {
      validateScriptingTime: (time: number) =>
        time < budgets.SCRIPTING_TIME_PER_FRAME,
      validateFPS: (fps: number) => fps >= budgets.MIN_FPS,
      validateMemoryGrowth: (growthMB: number) =>
        growthMB < budgets.MEMORY_GROWTH_LIMIT,
      validateTouchResponse: (responseTime: number) =>
        responseTime < budgets.TOUCH_RESPONSE_TIME,
      validateFrameDropRate: (rate: number) =>
        rate < budgets.MAX_FRAME_DROP_RATE,
    };
  },

  /**
   * Generate performance report
   */
  generateReport(metrics: {
    frameMetrics?: FrameMetrics[];
    memoryMetrics?: MemoryMetrics;
    touchMetrics?: TouchMetrics[];
  }): string {
    let report = "# Performance Test Report\n\n";

    if (metrics.frameMetrics) {
      const avgScripting =
        metrics.frameMetrics.reduce((sum, f) => sum + f.scriptingTime, 0) /
        metrics.frameMetrics.length;
      const droppedFrames = metrics.frameMetrics.filter(
        (f) => f.dropped
      ).length;
      const dropRate = droppedFrames / metrics.frameMetrics.length;

      report += `## Frame Performance\n`;
      report += `- Average scripting time: ${avgScripting.toFixed(2)}ms\n`;
      report += `- Dropped frames: ${droppedFrames}/${metrics.frameMetrics.length} (${(dropRate * 100).toFixed(2)}%)\n\n`;
    }

    if (metrics.memoryMetrics) {
      report += `## Memory Usage\n`;
      report += `- Memory growth: ${metrics.memoryMetrics.growthMB.toFixed(2)}MB\n`;
      report += `- Peak usage: ${(metrics.memoryMetrics.peakHeapSize / (1024 * 1024)).toFixed(2)}MB\n\n`;
    }

    if (metrics.touchMetrics) {
      const avgResponseTime =
        metrics.touchMetrics.reduce((sum, t) => sum + t.responseTime, 0) /
        metrics.touchMetrics.length;

      report += `## Touch Interactions\n`;
      report += `- Average response time: ${avgResponseTime.toFixed(2)}ms\n`;
      report += `- Total interactions: ${metrics.touchMetrics.length}\n\n`;
    }

    return report;
  },
};
