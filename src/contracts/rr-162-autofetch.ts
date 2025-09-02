/**
 * Contract Schemas for RR-162: Auto-Fetch Removal
 *
 * Defines runtime validation contracts for the removal of auto-fetch functionality.
 * These schemas ensure sync operations complete without auto-fetch hanging at 92%.
 */

import { z } from "zod";

/**
 * Schema for user preferences after auto-fetch removal
 */
export const UserPreferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]),
    syncFrequency: z.number().positive(),
    maxArticles: z.number().positive(),
    enableNotifications: z.boolean(),
  })
  .strict();

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Schema for sync response without auto-fetch
 */
export const SyncResponseSchema = z
  .object({
    status: z.enum(["initiated", "in-progress", "completed", "failed"]),
    syncId: z.string(),
    progress: z.number().min(0).max(100),
    message: z.string().optional(),
    metrics: z
      .object({
        articlesProcessed: z.number().nonnegative(),
        articlesAdded: z.number().nonnegative(),
        articlesUpdated: z.number().nonnegative(),
        articlesDeleted: z.number().nonnegative(),
        tagsProcessed: z.number().nonnegative(),
        feedsProcessed: z.number().nonnegative(),
      })
      .optional(),
    error: z.string().optional(),
  })
  .strict();

export type SyncResponse = z.infer<typeof SyncResponseSchema>;

/**
 * Schema for sync status tracking
 */
export const SyncStatusResponseSchema = z
  .object({
    isActive: z.boolean(),
    currentSyncId: z.string().optional(),
    lastSyncAt: z.string().datetime().optional(),
    lastSyncStatus: z.enum(["completed", "failed", "partial"]).optional(),
    progress: z.number().min(0).max(100).optional(),
  })
  .strict();

export type SyncStatusResponse = z.infer<typeof SyncStatusResponseSchema>;

/**
 * Schema for health endpoint parsing response (no auto-fetch)
 */
export const HealthParsingResponseSchema = z
  .object({
    status: z.enum(["healthy", "degraded", "unhealthy"]),
    lastParseAt: z.string().datetime().optional(),
    parseCount: z.number().nonnegative(),
    avgParseTime: z.number().nonnegative(),
    failureRate: z.number().min(0).max(1),
    recentErrors: z.array(
      z.object({
        timestamp: z.string().datetime(),
        error: z.string(),
        articleId: z.string().optional(),
      })
    ),
  })
  .strict();

export type HealthParsingResponse = z.infer<typeof HealthParsingResponseSchema>;

/**
 * Schema for fetch content response (manual fetch only)
 */
export const FetchContentResponseSchema = z
  .object({
    success: z.boolean(),
    content: z.string().optional(),
    error: z.string().optional(),
    fetchedAt: z.string().datetime(),
    source: z.enum(["manual", "api"]),
    articleId: z.string(),
  })
  .strict();

export type FetchContentResponse = z.infer<typeof FetchContentResponseSchema>;

/**
 * Schema for fetch log entries (no auto-fetch entries)
 */
export const FetchLogEntrySchema = z
  .object({
    id: z.string(),
    articleId: z.string(),
    timestamp: z.string().datetime(),
    source: z.enum(["manual", "api"]),
    success: z.boolean(),
    error: z.string().optional(),
  })
  .strict();

export type FetchLogEntry = z.infer<typeof FetchLogEntrySchema>;

/**
 * Contract validation functions
 */
export const AutoFetchValidation = {
  /**
   * Type guard to check if a value is an object
   */
  isObject: (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  },

  /**
   * Safely check if an object has a property
   */
  hasProperty: (obj: unknown, prop: string): boolean => {
    if (!AutoFetchValidation.isObject(obj)) return false;
    return prop in obj;
  },

  /**
   * Check for prohibited fields with type safety
   */
  checkProhibitedFields: (obj: unknown, context: string): void => {
    if (!AutoFetchValidation.isObject(obj)) return;

    PROHIBITED_FIELDS.forEach((field) => {
      if (AutoFetchValidation.hasProperty(obj, field)) {
        throw new Error(
          `Prohibited field '${field}' must not exist in ${context}`
        );
      }
    });
  },

  /**
   * Validates that preferences don't contain auto-fetch settings
   */
  validatePreferences: (prefs: unknown): UserPreferences => {
    // Check for prohibited fields BEFORE Zod validation
    AutoFetchValidation.checkProhibitedFields(prefs, "preferences");

    // Then validate with Zod schema
    const validated = UserPreferencesSchema.parse(prefs);

    return validated;
  },

  /**
   * Validates sync response doesn't hang at 92%
   */
  validateSyncProgress: (response: unknown): SyncResponse => {
    // Check for prohibited fields BEFORE Zod validation
    AutoFetchValidation.checkProhibitedFields(response, "sync response");

    // Then validate with Zod schema
    const validated = SyncResponseSchema.parse(response);

    // Ensure progress never stalls at 92% (auto-fetch point)
    if (validated.progress === 92 && validated.status === "in-progress") {
      throw new Error(
        "Sync must not hang at 92% (auto-fetch removal verification)"
      );
    }
    return validated;
  },

  /**
   * Validates fetch log doesn't contain auto-fetch entries
   */
  validateFetchLog: (entries: unknown[]): FetchLogEntry[] => {
    const validated = entries.map((e) => {
      // Check for prohibited fields BEFORE Zod validation
      AutoFetchValidation.checkProhibitedFields(e, "fetch log entry");

      // Then validate with Zod schema
      const entry = FetchLogEntrySchema.parse(e);

      return entry;
    });

    // Ensure no auto-fetch source
    const autoFetchEntry = validated.find((e) => {
      // Type-safe check for source property
      if (AutoFetchValidation.isObject(e) && "source" in e) {
        const source = e.source;
        return source === "auto" || source === "auto-fetch";
      }
      return false;
    });

    if (autoFetchEntry) {
      throw new Error("Fetch log must not contain auto-fetch entries");
    }
    return validated;
  },

  /**
   * Validates that sync completes to 100%
   */
  validateSyncCompletion: (response: unknown): void => {
    // Check for prohibited fields BEFORE Zod validation
    AutoFetchValidation.checkProhibitedFields(response, "sync completion");

    // Then validate with Zod schema
    const validated = SyncResponseSchema.parse(response);

    if (validated.status === "completed" && validated.progress !== 100) {
      throw new Error("Completed sync must reach 100% progress");
    }
  },

  /**
   * Validates that an object doesn't contain any prohibited auto-fetch fields
   * Includes depth protection and circular reference detection
   */
  validateNoProhibitedFields: (
    obj: unknown,
    maxDepth: number = 10,
    visited: WeakSet<object> = new WeakSet()
  ): void => {
    // Type guard and null check
    if (!AutoFetchValidation.isObject(obj)) return;

    // Depth limit protection
    if (maxDepth <= 0) {
      console.warn(
        "Max depth reached in validateNoProhibitedFields, stopping recursion"
      );
      return;
    }

    // Circular reference protection
    if (visited.has(obj)) {
      return; // Already visited this object
    }
    visited.add(obj);

    // Check for prohibited fields
    PROHIBITED_FIELDS.forEach((field) => {
      if (field in obj) {
        throw new Error(
          `Prohibited auto-fetch field '${field}' detected. Auto-fetch has been removed.`
        );
      }
    });

    // Recursively check nested objects with type safety
    Object.values(obj).forEach((value) => {
      if (AutoFetchValidation.isObject(value)) {
        AutoFetchValidation.validateNoProhibitedFields(
          value,
          maxDepth - 1,
          visited
        );
      }
    });
  },
};

/**
 * Expected progress sequence without auto-fetch
 * Progress should go: 0 → 10 → 20 → ... → 90 → 100 (never 92)
 */
export const EXPECTED_PROGRESS_SEQUENCE = [
  0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
] as const;

/**
 * Prohibited fields that must not exist after removal
 */
export const PROHIBITED_FIELDS = [
  "autoFetchFullContent",
  "AUTO_FETCH_RATE_LIMIT",
  "AUTO_FETCH_TIME_WINDOW",
  "performAutoFetch",
  "autoFetchEnabled",
] as const;
