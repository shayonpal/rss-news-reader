/**
 * LocalStorage Fallback Handler for RR-197
 * Handles graceful degradation when localStorage is unavailable
 */

export interface FallbackConfig {
  enableLogging: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface FallbackOperation {
  operation: string;
  timestamp: number;
  success: boolean;
  error?: string;
  fallbackUsed: boolean;
}

export class FallbackHandler {
  private config: FallbackConfig;
  private operationLog: FallbackOperation[] = [];
  private lastAvailabilityCheck = 0;
  private readonly AVAILABILITY_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      enableLogging: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Execute operation with fallback handling
   */
  async executeWithFallback<T>(
    operation: () => T,
    fallback: () => T,
    operationName: string
  ): Promise<{ result: T; fallbackUsed: boolean }> {
    let fallbackUsed = false;

    try {
      const result = operation();

      this.logOperation({
        operation: operationName,
        timestamp: Date.now(),
        success: true,
        fallbackUsed: false,
      });

      return { result, fallbackUsed };
    } catch (error) {
      fallbackUsed = true;

      const result = fallback();

      this.logOperation({
        operation: operationName,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        fallbackUsed: true,
      });

      return { result, fallbackUsed };
    }
  }

  /**
   * Check if localStorage is available with caching
   */
  checkLocalStorageAvailability(): boolean {
    const now = Date.now();

    // Use cached result if recent
    if (now - this.lastAvailabilityCheck < this.AVAILABILITY_CHECK_INTERVAL) {
      return this.getLastAvailabilityStatus();
    }

    try {
      const testKey = "__fallback_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);

      this.lastAvailabilityCheck = now;
      this.logOperation({
        operation: "availability_check",
        timestamp: now,
        success: true,
        fallbackUsed: false,
      });

      return true;
    } catch (error) {
      this.lastAvailabilityCheck = now;
      this.logOperation({
        operation: "availability_check",
        timestamp: now,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        fallbackUsed: false,
      });

      return false;
    }
  }

  /**
   * Get last known availability status
   */
  private getLastAvailabilityStatus(): boolean {
    const recentChecks = this.operationLog
      .filter((op) => op.operation === "availability_check")
      .slice(-1);

    return recentChecks.length > 0 ? recentChecks[0].success : false;
  }

  /**
   * Log operation for monitoring
   */
  private logOperation(operation: FallbackOperation): void {
    if (!this.config.enableLogging) return;

    this.operationLog.push(operation);

    // Keep only last 100 operations
    if (this.operationLog.length > 100) {
      this.operationLog = this.operationLog.slice(-100);
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      const logLevel = operation.success ? "log" : "warn";
      console[logLevel](`[FallbackHandler] ${operation.operation}:`, {
        success: operation.success,
        fallbackUsed: operation.fallbackUsed,
        error: operation.error,
      });
    }
  }

  /**
   * Get operation statistics
   */
  getOperationStats(): {
    total: number;
    successful: number;
    failed: number;
    fallbackUsed: number;
    recentFailures: number;
  } {
    const recent = this.operationLog.filter(
      (op) => Date.now() - op.timestamp < 300000 // Last 5 minutes
    );

    return {
      total: this.operationLog.length,
      successful: this.operationLog.filter((op) => op.success).length,
      failed: this.operationLog.filter((op) => !op.success).length,
      fallbackUsed: this.operationLog.filter((op) => op.fallbackUsed).length,
      recentFailures: recent.filter((op) => !op.success).length,
    };
  }

  /**
   * Clear operation log
   */
  clearLog(): void {
    this.operationLog = [];
  }

  /**
   * Get recent operations for debugging
   */
  getRecentOperations(limit = 10): FallbackOperation[] {
    return this.operationLog.slice(-limit);
  }

  /**
   * Check if fallback mode should be enabled based on recent failures
   */
  shouldUseFallbackMode(): boolean {
    const stats = this.getOperationStats();

    // Use fallback if recent failure rate is high
    return stats.recentFailures > 3 || !this.checkLocalStorageAvailability();
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<{ result: T | null; success: boolean; attemptsUsed: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await operation();

        this.logOperation({
          operation: `${operationName}_retry_${attempt}`,
          timestamp: Date.now(),
          success: true,
          fallbackUsed: false,
        });

        return { result, success: true, attemptsUsed: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        if (attempt < this.config.retryAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay * attempt)
          );
        }

        this.logOperation({
          operation: `${operationName}_retry_${attempt}`,
          timestamp: Date.now(),
          success: false,
          error: lastError.message,
          fallbackUsed: false,
        });
      }
    }

    return {
      result: null,
      success: false,
      attemptsUsed: this.config.retryAttempts,
    };
  }

  /**
   * Reset fallback handler state
   */
  reset(): void {
    this.operationLog = [];
    this.lastAvailabilityCheck = 0;
  }

  /**
   * Check if localStorage is available (alias for compatibility)
   */
  static isLocalStorageAvailable(): boolean {
    return new FallbackHandler().checkLocalStorageAvailability();
  }

  /**
   * Enable fallback mode
   */
  enableFallbackMode(): void {
    this.logOperation({
      operation: "fallback_mode_enabled",
      timestamp: Date.now(),
      success: true,
      fallbackUsed: true,
    });
  }

  /**
   * Handle localStorage error
   */
  handleLocalStorageError(error: Error, operation: string): void {
    this.logOperation({
      operation,
      timestamp: Date.now(),
      success: false,
      error: error.message,
      fallbackUsed: true,
    });
  }
}

// Export singleton instance
export const fallbackHandler = new FallbackHandler();
