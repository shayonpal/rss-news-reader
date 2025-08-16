/**
 * Performance Monitor for RR-197
 * Tracks UI responsiveness, memory usage, and frame rate during rapid operations
 *
 * Compatibility: Includes legacy-style measurement helpers used by tests:
 * - startMeasure(name), endMeasure(name)
 * - getFPS()
 * - isMaintenanceFPS(target)
 * - getAverageResponseTime()
 */

export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  memoryDelta: number;
  responseTime: number;
  operationCount: number;
  timestamp: number;
  lastResponseTime?: number;
  avgResponseTime?: number;
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
  private lastResponseTime = 0;
  private avgResponseTime = 0;
  private isMonitoring = false;
  private rafId: number | null = null;

  // Legacy-style measurement map for tests (name -> startTime)
  private measureMap: Map<string, number> = new Map();

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
    this.lastResponseTime = 0;
    this.avgResponseTime = 0;

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
      const elapsed = now - this.lastFrameTime;
      this.currentFrameRate =
        Math.round(((this.frameCount * 1000) / elapsed) * 100) / 100;
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
   * Compatibility: start a named measurement (used by tests)
   */
  startMeasure(name: string): void {
    this.measureMap.set(name, performance.now());
  }

  /**
   * Compatibility: end a named measurement and return duration
   */
  endMeasure(name: string): number {
    const start = this.measureMap.get(name) ?? performance.now();
    const dt = performance.now() - start;
    this.measureMap.delete(name);
    // also update response-time aggregates
    this.lastResponseTime = dt;
    this.avgResponseTime =
      this.avgResponseTime === 0 ? dt : 0.2 * dt + 0.8 * this.avgResponseTime;
    this.operationCount++;
    return dt;
  }

  /**
   * Record end of operation and increment counter
   */
  endOperation(): number {
    const responseTime = performance.now() - this.operationStartTime;
    this.operationCount++;
    this.lastResponseTime = responseTime;
    this.avgResponseTime =
      this.avgResponseTime === 0
        ? responseTime
        : 0.2 * responseTime + 0.8 * this.avgResponseTime;
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
      lastResponseTime: this.lastResponseTime,
      avgResponseTime: Math.round(this.avgResponseTime * 100) / 100,
    };
  }

  /**
   * Compatibility: get current FPS (used by tests)
   */
  getFPS(): number {
    return this.currentFrameRate;
  }

  /**
   * Compatibility: check if FPS meets a target (used by tests)
   */
  isMaintenanceFPS(target: number): boolean {
    // Use accessor so tests can vi.spyOn(getFPS) and override behavior deterministically
    return this.getFPS() >= target;
  }

  /**
   * Compatibility: average response time accessor (used by tests)
   */
  getAverageResponseTime(): number {
    return Math.round(this.avgResponseTime * 100) / 100;
  }

  /**
   * Check if performance meets thresholds
   */
  meetsPerformanceThresholds(): boolean {
    const metrics = this.getMetrics();

    return (
      metrics.frameRate >= this.thresholds.minFrameRate &&
      metrics.memoryDelta <= this.thresholds.maxMemoryIncrease &&
      (metrics.lastResponseTime ?? metrics.responseTime) <=
        this.thresholds.maxResponseTime
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
    this.lastResponseTime = 0;
    this.avgResponseTime = 0;
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
