/**
 * Performance Monitor for RR-197
 * Tracks UI responsiveness, memory usage, and frame rate during rapid operations
 */

export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  memoryDelta: number;
  responseTime: number;
  operationCount: number;
  timestamp: number;
}

export interface PerformanceThresholds {
  minFrameRate: number;
  maxMemoryIncrease: number;
  maxResponseTime: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private frameCount = 0;
  private lastFrameTime = 0;
  private currentFrameRate = 60;
  private baselineMemory = 0;
  private operationStartTime = 0;
  private operationCount = 0;
  private isMonitoring = false;
  private rafId: number | null = null;

  private readonly thresholds: PerformanceThresholds = {
    minFrameRate: 60,
    maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
    maxResponseTime: 1, // 1ms
  };

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.baselineMemory = this.getMemoryUsage();
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.operationCount = 0;

    this.monitorFrameRate();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Monitor frame rate using requestAnimationFrame
   */
  private monitorFrameRate(): void {
    const now = performance.now();
    this.frameCount++;

    if (now - this.lastFrameTime >= 1000) {
      this.currentFrameRate = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    if (this.isMonitoring) {
      this.rafId = requestAnimationFrame(() => this.monitorFrameRate());
    }
  }

  /**
   * Get current memory usage (approximation)
   */
  private getMemoryUsage(): number {
    if ("memory" in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0; // Fallback for browsers without memory API
  }

  /**
   * Record start of operation
   */
  startOperation(): void {
    this.operationStartTime = performance.now();
  }

  /**
   * Record end of operation and increment counter
   */
  endOperation(): number {
    const responseTime = performance.now() - this.operationStartTime;
    this.operationCount++;
    return responseTime;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const currentMemory = this.getMemoryUsage();
    const memoryDelta = currentMemory - this.baselineMemory;

    return {
      frameRate: this.currentFrameRate,
      memoryUsage: currentMemory,
      memoryDelta,
      responseTime: this.operationStartTime
        ? performance.now() - this.operationStartTime
        : 0,
      operationCount: this.operationCount,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if performance meets thresholds
   */
  meetsPerformanceThresholds(): boolean {
    const metrics = this.getMetrics();

    return (
      metrics.frameRate >= this.thresholds.minFrameRate &&
      metrics.memoryDelta <= this.thresholds.maxMemoryIncrease &&
      metrics.responseTime <= this.thresholds.maxResponseTime
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    isAcceptable: boolean;
    metrics: PerformanceMetrics;
    thresholds: PerformanceThresholds;
    violations: string[];
  } {
    const metrics = this.getMetrics();
    const violations: string[] = [];

    if (metrics.frameRate < this.thresholds.minFrameRate) {
      violations.push(
        `Frame rate below threshold: ${metrics.frameRate} < ${this.thresholds.minFrameRate}`
      );
    }

    if (metrics.memoryDelta > this.thresholds.maxMemoryIncrease) {
      violations.push(
        `Memory increase above threshold: ${metrics.memoryDelta} > ${this.thresholds.maxMemoryIncrease}`
      );
    }

    if (metrics.responseTime > this.thresholds.maxResponseTime) {
      violations.push(
        `Response time above threshold: ${metrics.responseTime} > ${this.thresholds.maxResponseTime}`
      );
    }

    return {
      isAcceptable: violations.length === 0,
      metrics,
      thresholds: this.thresholds,
      violations,
    };
  }

  /**
   * Reset monitoring counters
   */
  reset(): void {
    this.frameCount = 0;
    this.operationCount = 0;
    this.baselineMemory = this.getMemoryUsage();
    this.lastFrameTime = performance.now();
  }

  /**
   * Measure response time of a function
   */
  async measureResponseTime<T>(
    operation: () => T | Promise<T>
  ): Promise<{ result: T; responseTime: number }> {
    const startTime = performance.now();
    const result = await operation();
    const responseTime = performance.now() - startTime;

    this.operationCount++;

    return { result, responseTime };
  }

  /**
   * Check if browser supports performance monitoring
   */
  static isSupported(): boolean {
    return (
      typeof performance !== "undefined" &&
      typeof requestAnimationFrame !== "undefined" &&
      typeof performance.now === "function"
    );
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
