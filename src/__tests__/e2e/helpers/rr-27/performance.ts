/**
 * RR-27: Test Consolidation - Performance Validation
 *
 * Performance benchmarking and validation utilities for consolidated tests
 */

import { Page } from "@playwright/test";
import { TestMetrics, MobileMetrics, TEST_CONSTANTS } from "./types";

export class PerformanceValidator {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Measure execution time of a test function
   */
  async measureTestExecution(
    testName: string,
    testFn: () => Promise<void>
  ): Promise<TestMetrics> {
    const start = performance.now();
    const memoryBefore = process.memoryUsage();

    let success = true;
    try {
      await testFn();
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - start;
      const memoryAfter = process.memoryUsage();

      // Store metrics for trend analysis
      const existing = this.metrics.get(testName) || [];
      existing.push(duration);
      this.metrics.set(testName, existing);

      console.log(
        `⏱️ ${testName}: ${duration.toFixed(2)}ms (${success ? "PASS" : "FAIL"})`
      );
    }

    const duration = performance.now() - start;
    const memoryAfter = process.memoryUsage();

    return {
      testName,
      duration,
      memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed,
      passed: duration < TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.PER_FILE,
    };
  }

  /**
   * Validate mobile performance metrics
   */
  async validateMobilePerformance(page: Page): Promise<MobileMetrics> {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType("paint");
      const fcp = paint.find((p) => p.name === "first-contentful-paint");

      return {
        fcp: fcp?.startTime || 0,
        tti: navigation.domInteractive - navigation.navigationStart,
        cls: 0, // Would need specific CLS measurement
        fid: 0, // Would need specific FID measurement
      };
    });

    const passed = metrics.fcp < 1500; // 1.5s FCP target for mobile

    console.log(
      `📱 Mobile Metrics - FCP: ${metrics.fcp.toFixed(2)}ms, TTI: ${metrics.tti.toFixed(2)}ms`
    );

    return {
      ...metrics,
      passed,
    };
  }

  /**
   * Measure state operation performance
   */
  async measureStateOperation<T>(
    page: Page,
    operationName: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number; passed: boolean }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;

    const passed =
      duration < TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.STATE_OPERATION;

    console.log(
      `⚡ ${operationName}: ${duration.toFixed(2)}ms (${passed ? "PASS" : "FAIL"})`
    );

    return { result, duration, passed };
  }

  /**
   * Benchmark scroll performance
   */
  async benchmarkScrollPerformance(
    page: Page,
    scrollCount: number = 10
  ): Promise<{ avgDuration: number; passed: boolean }> {
    const durations: number[] = [];

    for (let i = 0; i < scrollCount; i++) {
      const start = performance.now();
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(50); // Minimal wait for scroll to register
      const duration = performance.now() - start;
      durations.push(duration);
    }

    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const passed = avgDuration < 100; // 100ms average per scroll

    console.log(
      `📜 Scroll Performance: ${avgDuration.toFixed(2)}ms avg over ${scrollCount} scrolls`
    );

    return { avgDuration, passed };
  }

  /**
   * Memory usage analysis
   */
  async analyzeMemoryUsage(
    page: Page
  ): Promise<{ heapUsed: number; heapTotal: number; external: number }> {
    const memoryInfo = await page.evaluate(() => {
      if ("memory" in performance) {
        const mem = (performance as any).memory;
        return {
          heapUsed: mem.usedJSHeapSize,
          heapTotal: mem.totalJSHeapSize,
          heapLimit: mem.jsHeapSizeLimit,
        };
      }
      return { heapUsed: 0, heapTotal: 0, heapLimit: 0 };
    });

    const nodeMemory = process.memoryUsage();

    console.log(
      `💾 Memory - JS Heap: ${(memoryInfo.heapUsed / 1024 / 1024).toFixed(2)}MB, Node RSS: ${(nodeMemory.rss / 1024 / 1024).toFixed(2)}MB`
    );

    return {
      heapUsed: memoryInfo.heapUsed,
      heapTotal: memoryInfo.heapTotal,
      external: nodeMemory.external,
    };
  }

  /**
   * Network performance measurement
   */
  async measureNetworkPerformance(page: Page): Promise<{
    requestCount: number;
    totalSize: number;
    avgResponseTime: number;
  }> {
    const networkMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];

      let totalSize = 0;
      let totalResponseTime = 0;
      const requestCount = resources.length;

      resources.forEach((resource) => {
        totalSize += resource.transferSize || 0;
        totalResponseTime += resource.responseEnd - resource.responseStart;
      });

      return {
        requestCount,
        totalSize,
        avgResponseTime:
          requestCount > 0 ? totalResponseTime / requestCount : 0,
      };
    });

    console.log(
      `🌐 Network - ${networkMetrics.requestCount} requests, ${(networkMetrics.totalSize / 1024).toFixed(2)}KB, ${networkMetrics.avgResponseTime.toFixed(2)}ms avg`
    );

    return networkMetrics;
  }

  /**
   * Generate performance report for all measured tests
   */
  generatePerformanceReport(): {
    testResults: Array<{
      testName: string;
      avgDuration: number;
      runs: number;
      passed: boolean;
    }>;
    summary: {
      totalTests: number;
      passedTests: number;
      avgDurationAll: number;
      slowestTest: string;
    };
  } {
    const testResults = Array.from(this.metrics.entries()).map(
      ([testName, durations]) => {
        const avgDuration =
          durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const passed =
          avgDuration < TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.PER_FILE;

        return {
          testName,
          avgDuration,
          runs: durations.length,
          passed,
        };
      }
    );

    const passedTests = testResults.filter((r) => r.passed).length;
    const totalTests = testResults.length;
    const avgDurationAll =
      testResults.reduce((sum, r) => sum + r.avgDuration, 0) / totalTests;
    const slowestTest = testResults.reduce((slowest, current) =>
      current.avgDuration > slowest.avgDuration ? current : slowest
    ).testName;

    const summary = {
      totalTests,
      passedTests,
      avgDurationAll,
      slowestTest,
    };

    console.log(
      `📊 Performance Summary: ${passedTests}/${totalTests} tests passed, avg ${avgDurationAll.toFixed(2)}ms, slowest: ${slowestTest}`
    );

    return { testResults, summary };
  }

  /**
   * Performance regression detection
   */
  detectPerformanceRegression(
    testName: string,
    currentDuration: number,
    baselineDuration?: number
  ): { isRegression: boolean; percentage: number } {
    if (!baselineDuration) {
      return { isRegression: false, percentage: 0 };
    }

    const percentage =
      ((currentDuration - baselineDuration) / baselineDuration) * 100;
    const isRegression = percentage > 20; // 20% slower considered regression

    if (isRegression) {
      console.log(
        `⚠️ Performance Regression: ${testName} is ${percentage.toFixed(2)}% slower than baseline`
      );
    }

    return { isRegression, percentage };
  }

  /**
   * Validate test suite execution time
   */
  validateTestSuiteTime(totalDuration: number): {
    passed: boolean;
    timePerFile: number;
  } {
    const expectedFiles = 4; // Our 4 consolidated files
    const timePerFile = totalDuration / expectedFiles;
    const passed =
      totalDuration < TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.TOTAL_TEST_SUITE;

    console.log(
      `🎯 Test Suite Performance: ${totalDuration.toFixed(2)}ms total (${timePerFile.toFixed(2)}ms per file) - ${passed ? "PASS" : "FAIL"}`
    );

    return { passed, timePerFile };
  }

  /**
   * Create performance benchmark for future comparison
   */
  createBenchmark(): {
    timestamp: number;
    testMetrics: Record<string, { avgDuration: number; runs: number }>;
    systemInfo: {
      nodeVersion: string;
      platform: string;
      memory: number;
    };
  } {
    const testMetrics: Record<string, { avgDuration: number; runs: number }> =
      {};

    this.metrics.forEach((durations, testName) => {
      testMetrics[testName] = {
        avgDuration:
          durations.reduce((sum, d) => sum + d, 0) / durations.length,
        runs: durations.length,
      };
    });

    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage().rss,
    };

    return {
      timestamp: Date.now(),
      testMetrics,
      systemInfo,
    };
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  /**
   * Create large dataset for performance testing
   */
  static createLargeDataset(
    size: number
  ): Array<{ id: string; title: string; content: string }> {
    return Array.from({ length: size }, (_, i) => ({
      id: `perf_test_${i}`,
      title: `Performance Test Article ${i}`,
      content: `This is performance test content for article ${i}. `.repeat(10),
    }));
  }

  /**
   * Simulate heavy computational load
   */
  static async simulateHeavyLoad(
    page: Page,
    duration: number = 1000
  ): Promise<void> {
    await page.evaluate((ms) => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        // Simulate CPU-intensive task
        Math.random() * Math.random();
      }
    }, duration);
  }

  /**
   * Create memory pressure for testing
   */
  static async createMemoryPressure(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Create large objects to pressure memory
      (window as any).memoryPressureData = Array.from(
        { length: 100000 },
        (_, i) => ({
          id: i,
          data: new Array(1000).fill(`memory-pressure-data-${i}`),
        })
      );
    });
  }

  /**
   * Clean up memory pressure
   */
  static async cleanupMemoryPressure(page: Page): Promise<void> {
    await page.evaluate(() => {
      delete (window as any).memoryPressureData;
      if (typeof window.gc === "function") {
        window.gc(); // Force garbage collection if available
      }
    });
  }
}

/**
 * Export performance constants for test configuration
 */
export const PERFORMANCE_CONFIG = {
  THRESHOLDS: TEST_CONSTANTS.PERFORMANCE_THRESHOLDS,
  MEASUREMENT_SAMPLES: 3, // Number of times to run each performance test
  MOBILE_VIEWPORT_SIZES: [
    { name: "iPhone SE", width: 375, height: 667 },
    { name: "iPhone 12", width: 390, height: 844 },
    { name: "iPad", width: 768, height: 1024 },
  ],
  NETWORK_CONDITIONS: {
    "fast-3g": {
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    },
    "slow-3g": {
      downloadThroughput: (500 * 1024) / 8,
      uploadThroughput: (500 * 1024) / 8,
      latency: 400,
    },
  },
} as const;
