/**
 * RR-197: localStorage State - Export alias for test compatibility
 */

// Re-export all utilities for test compatibility
export {
  LocalStorageStateManager,
  localStorageStateManager,
} from "./localstorage-state-manager";
export { LocalStorageQueue, localStorageQueue } from "./localstorage-queue";
export { PerformanceMonitor, performanceMonitor } from "./performance-monitor";
export {
  ArticleCounterManager,
  articleCounterManager,
} from "./article-counter-manager";

// Type exports
export type { QueueEntry, QueueConfig } from "./localstorage-queue";
export type {
  PerformanceMetrics,
  PerformanceThresholds,
} from "./performance-monitor";
export type { CounterState, FeedCountUpdate } from "./article-counter-manager";
export type {
  StateManagerConfig,
  OperationResult,
} from "./localstorage-state-manager";
