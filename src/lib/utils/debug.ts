/**
 * Debug utilities for development-only logging
 * Respects NODE_ENV to avoid verbose logs in production
 */

/**
 * Check if running in debug/development mode
 */
export function isDebugMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Log debug messages only in development
 */
export function debugLog(...args: any[]): void {
  if (isDebugMode()) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Log timing information only in development
 */
export function debugTiming(label: string, startTime: number): void {
  if (isDebugMode()) {
    const duration = performance.now() - startTime;
    console.log(`[TIMING] ${label}: ${duration.toFixed(2)}ms`);
  }
}