/**
 * Contract Schemas for RR-171: Sidebar Sync Metrics
 *
 * Defines runtime validation contracts for sync metrics displayed in the sidebar.
 * These schemas ensure proper data flow from sync operations to UI display.
 */

import { z } from "zod";

/**
 * Schema for sync metrics displayed in sidebar
 */
export const SyncMetricsSchema = z
  .object({
    newArticles: z.number().nonnegative(),
    deletedArticles: z.number().nonnegative(),
    newTags: z.number().nonnegative(),
    failedFeeds: z.number().nonnegative(),
  })
  .strict();

export type SyncMetrics = z.infer<typeof SyncMetricsSchema>;

/**
 * Schema for sync API response
 */
export const SyncApiResponseSchema = z
  .object({
    syncId: z.string(),
    status: z.enum(["completed", "partial", "failed"]),
    metrics: SyncMetricsSchema,
    timestamp: z.string().datetime().optional(),
    duration: z.number().positive().optional(),
  })
  .strict();

export type SyncApiResponse = z.infer<typeof SyncApiResponseSchema>;

/**
 * Schema for sidebar data structure
 */
export const SidebarDataSchema = z
  .object({
    isLoading: z.boolean(),
    isSyncing: z.boolean(),
    syncProgress: z.number().min(0).max(100).optional(),
    lastSyncMetrics: SyncMetricsSchema.optional(),
    lastSyncAt: z.string().datetime().optional(),
    nextSyncAt: z.string().datetime().optional(),
    error: z.string().optional(),
  })
  .strict();

export type SidebarData = z.infer<typeof SidebarDataSchema>;

/**
 * Schema for refresh manager state
 */
export const RefreshManagerStateSchema = z
  .object({
    isRefreshing: z.boolean(),
    refreshQueue: z.array(z.string()),
    activeRefreshes: z.number().nonnegative(),
    maxConcurrent: z.number().positive(),
    refreshInterval: z.number().positive(),
    lastRefreshAt: z.string().datetime().optional(),
  })
  .strict();

export type RefreshManagerState = z.infer<typeof RefreshManagerStateSchema>;

/**
 * Schema for rate limiting configuration
 */
export const RateLimitConfigSchema = z
  .object({
    maxRequests: z.number().positive(),
    timeWindow: z.number().positive(), // milliseconds
    retryAfter: z.number().positive().optional(), // milliseconds
    burstLimit: z.number().positive().optional(),
  })
  .strict();

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/**
 * Schema for background sync configuration
 */
export const BackgroundSyncConfigSchema = z
  .object({
    enabled: z.boolean(),
    intervalMs: z.number().positive(),
    maxRetries: z.number().nonnegative(),
    retryDelayMs: z.number().positive(),
    syncOnStartup: z.boolean(),
    syncOnFocus: z.boolean(),
  })
  .strict();

export type BackgroundSyncConfig = z.infer<typeof BackgroundSyncConfigSchema>;

/**
 * Schema for toast notification
 */
export const ToastNotificationSchema = z
  .object({
    id: z.string(),
    type: z.enum(["success", "error", "warning", "info"]),
    title: z.string(),
    message: z.string().optional(),
    duration: z.number().positive().optional(),
    action: z
      .object({
        label: z.string(),
        handler: z.string(), // function name or action type
      })
      .optional(),
  })
  .strict();

export type ToastNotification = z.infer<typeof ToastNotificationSchema>;

/**
 * Schema for skeleton loading states
 */
export const SkeletonStateSchema = z
  .object({
    showSkeleton: z.boolean(),
    skeletonCount: z.number().positive(),
    animationType: z.enum(["pulse", "wave", "shimmer"]),
    minDisplayTime: z.number().positive(), // milliseconds
  })
  .strict();

export type SkeletonState = z.infer<typeof SkeletonStateSchema>;

/**
 * Schema for concurrency control
 */
export const ConcurrencyControlSchema = z
  .object({
    maxConcurrent: z.number().positive(),
    queueSize: z.number().nonnegative(),
    activeOperations: z.array(
      z.object({
        id: z.string(),
        type: z.enum(["sync", "fetch", "refresh"]),
        startedAt: z.string().datetime(),
        progress: z.number().min(0).max(100).optional(),
      })
    ),
    queuedOperations: z.array(
      z.object({
        id: z.string(),
        type: z.enum(["sync", "fetch", "refresh"]),
        queuedAt: z.string().datetime(),
        priority: z.number().optional(),
      })
    ),
  })
  .strict();

export type ConcurrencyControl = z.infer<typeof ConcurrencyControlSchema>;

/**
 * Contract validation functions
 */
export const SidebarSyncValidation = {
  /**
   * Validates sync metrics are properly formatted
   */
  validateSyncMetrics: (metrics: unknown): SyncMetrics => {
    const validated = SyncMetricsSchema.parse(metrics);

    // All metrics should be non-negative integers
    const values = Object.values(validated);
    for (const value of values) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("All metrics must be non-negative integers");
      }
    }

    return validated;
  },

  /**
   * Validates sync API response status logic
   */
  validateSyncStatus: (response: unknown): SyncApiResponse => {
    const validated = SyncApiResponseSchema.parse(response);

    // Status logic validation
    if (validated.status === "completed" && validated.metrics.failedFeeds > 0) {
      throw new Error('Status cannot be "completed" when feeds have failed');
    }

    if (
      validated.status === "failed" &&
      (validated.metrics.newArticles > 0 || validated.metrics.newTags > 0)
    ) {
      throw new Error(
        'Status cannot be "failed" when data was successfully synced'
      );
    }

    if (validated.status === "partial" && validated.metrics.failedFeeds === 0) {
      throw new Error('Status should not be "partial" when no feeds failed');
    }

    return validated;
  },

  /**
   * Validates rate limiting is properly enforced
   */
  validateRateLimit: (
    config: unknown,
    requestCount: number,
    timeElapsed: number
  ): void => {
    const validated = RateLimitConfigSchema.parse(config);

    if (timeElapsed < validated.timeWindow) {
      if (requestCount > validated.maxRequests) {
        throw new Error(
          `Rate limit exceeded: ${requestCount} requests in ${timeElapsed}ms`
        );
      }

      if (validated.burstLimit && requestCount > validated.burstLimit) {
        throw new Error(`Burst limit exceeded: ${requestCount} requests`);
      }
    }
  },

  /**
   * Validates concurrency limits are respected
   */
  validateConcurrency: (control: unknown): ConcurrencyControl => {
    const validated = ConcurrencyControlSchema.parse(control);

    if (validated.activeOperations.length > validated.maxConcurrent) {
      throw new Error(
        `Concurrency limit exceeded: ${validated.activeOperations.length} > ${validated.maxConcurrent}`
      );
    }

    return validated;
  },

  /**
   * Validates toast notification formatting
   */
  validateToastFormat: (toast: unknown): ToastNotification => {
    const validated = ToastNotificationSchema.parse(toast);

    // Success toasts should have positive tone
    if (
      validated.type === "success" &&
      validated.title.toLowerCase().includes("error")
    ) {
      throw new Error("Success toast should not contain error messaging");
    }

    // Error toasts should have a message
    if (validated.type === "error" && !validated.message) {
      throw new Error("Error toasts must include a message");
    }

    return validated;
  },
};

/**
 * Expected sync metric ranges for validation
 */
export const METRIC_RANGES = {
  newArticles: { min: 0, max: 10000 },
  deletedArticles: { min: 0, max: 10000 },
  newTags: { min: 0, max: 1000 },
  failedFeeds: { min: 0, max: 100 },
} as const;

/**
 * Timing constants for UI behavior
 */
export const UI_TIMING = {
  skeletonMinDisplay: 500, // ms
  toastDefaultDuration: 5000, // ms
  refreshDebounce: 1000, // ms
  syncProgressInterval: 100, // ms
  staleDataThreshold: 5 * 60 * 1000, // 5 minutes
} as const;
