/**
 * Preferences validation utilities
 * Provides comprehensive validation for user preferences with type safety
 */

import {
  PreferencesData,
  PreferencesPatch,
  PreferencesValidationErrors,
  PREFERENCES_CONSTRAINTS,
} from "@/types/preferences";

/**
 * Validates complete preferences data
 * @param data - The preferences data to validate
 * @returns Validation errors object (empty if valid)
 */
export function validatePreferences(
  data: PreferencesData
): PreferencesValidationErrors {
  const errors: PreferencesValidationErrors = {};

  // Validate AI section
  if (data.ai) {
    const aiErrors = validateAiPreferences(data.ai);
    if (Object.keys(aiErrors).length > 0) {
      errors.ai = aiErrors;
    }
  }

  // Validate Sync section
  if (data.sync) {
    const syncErrors = validateSyncPreferences(data.sync);
    if (Object.keys(syncErrors).length > 0) {
      errors.sync = syncErrors;
    }
  }

  return errors;
}

/**
 * Validates AI preferences
 */
function validateAiPreferences(
  ai: PreferencesData["ai"]
): PreferencesValidationErrors["ai"] {
  const errors: PreferencesValidationErrors["ai"] = {};

  // Validate model
  if (!PREFERENCES_CONSTRAINTS.ai.models.includes(ai.model as any)) {
    errors.model = `Invalid model. Must be one of: ${PREFERENCES_CONSTRAINTS.ai.models.join(", ")}`;
  }

  // Validate summary length
  if (ai.summaryLengthMin < PREFERENCES_CONSTRAINTS.ai.summaryLengthMin.min) {
    errors.summaryLengthMin = `Minimum length must be at least ${PREFERENCES_CONSTRAINTS.ai.summaryLengthMin.min}`;
  }
  if (ai.summaryLengthMax > PREFERENCES_CONSTRAINTS.ai.summaryLengthMax.max) {
    errors.summaryLengthMax = `Maximum length cannot exceed ${PREFERENCES_CONSTRAINTS.ai.summaryLengthMax.max}`;
  }
  if (ai.summaryLengthMin > ai.summaryLengthMax) {
    errors.summaryLengthMin = "Minimum length cannot exceed maximum length";
    errors.summaryLengthMax =
      "Maximum length must be greater than minimum length";
  }

  // Validate summary style
  if (!PREFERENCES_CONSTRAINTS.ai.summaryStyles.includes(ai.summaryStyle)) {
    errors.summaryStyle = `Invalid style. Must be one of: ${PREFERENCES_CONSTRAINTS.ai.summaryStyles.join(", ")}`;
  }

  // Validate content focus
  if (
    !PREFERENCES_CONSTRAINTS.ai.contentFocusOptions.includes(ai.contentFocus)
  ) {
    errors.contentFocus = `Invalid focus. Must be one of: ${PREFERENCES_CONSTRAINTS.ai.contentFocusOptions.filter((x) => x !== null).join(", ")}`;
  }

  return errors;
}

/**
 * Validates sync preferences
 */
function validateSyncPreferences(
  sync: PreferencesData["sync"]
): PreferencesValidationErrors["sync"] {
  const errors: PreferencesValidationErrors["sync"] = {};

  // Validate max articles
  if (sync.maxArticles < PREFERENCES_CONSTRAINTS.sync.maxArticles.min) {
    errors.maxArticles = `Must be at least ${PREFERENCES_CONSTRAINTS.sync.maxArticles.min}`;
  }
  if (sync.maxArticles > PREFERENCES_CONSTRAINTS.sync.maxArticles.max) {
    errors.maxArticles = `Cannot exceed ${PREFERENCES_CONSTRAINTS.sync.maxArticles.max}`;
  }

  // Validate retention count
  if (sync.retentionCount < PREFERENCES_CONSTRAINTS.sync.retentionCount.min) {
    errors.retentionCount = `Must be at least ${PREFERENCES_CONSTRAINTS.sync.retentionCount.min}`;
  }
  if (sync.retentionCount > PREFERENCES_CONSTRAINTS.sync.retentionCount.max) {
    errors.retentionCount = `Cannot exceed ${PREFERENCES_CONSTRAINTS.sync.retentionCount.max}`;
  }

  return errors;
}

/**
 * Validates a preferences patch
 * @param patch - The patch to validate
 * @returns Validation errors object (empty if valid)
 */
export function validatePreferencesPatch(
  patch: PreferencesPatch
): PreferencesValidationErrors {
  const errors: PreferencesValidationErrors = {};

  // Validate AI patch
  if (patch.ai) {
    const aiErrors: PreferencesValidationErrors["ai"] = {};

    if (
      patch.ai.model !== undefined &&
      !PREFERENCES_CONSTRAINTS.ai.models.includes(patch.ai.model as any)
    ) {
      aiErrors.model = `Invalid model. Must be one of: ${PREFERENCES_CONSTRAINTS.ai.models.join(", ")}`;
    }

    if (patch.ai.summaryLengthMin !== undefined) {
      if (
        patch.ai.summaryLengthMin <
        PREFERENCES_CONSTRAINTS.ai.summaryLengthMin.min
      ) {
        aiErrors.summaryLengthMin = `Minimum length must be at least ${PREFERENCES_CONSTRAINTS.ai.summaryLengthMin.min}`;
      }
    }

    if (patch.ai.summaryLengthMax !== undefined) {
      if (
        patch.ai.summaryLengthMax >
        PREFERENCES_CONSTRAINTS.ai.summaryLengthMax.max
      ) {
        aiErrors.summaryLengthMax = `Maximum length cannot exceed ${PREFERENCES_CONSTRAINTS.ai.summaryLengthMax.max}`;
      }
    }

    if (
      patch.ai.summaryStyle !== undefined &&
      !PREFERENCES_CONSTRAINTS.ai.summaryStyles.includes(patch.ai.summaryStyle)
    ) {
      aiErrors.summaryStyle = `Invalid style. Must be one of: ${PREFERENCES_CONSTRAINTS.ai.summaryStyles.join(", ")}`;
    }

    if (
      patch.ai.contentFocus !== undefined &&
      !PREFERENCES_CONSTRAINTS.ai.contentFocusOptions.includes(
        patch.ai.contentFocus
      )
    ) {
      aiErrors.contentFocus = `Invalid focus. Must be one of: ${PREFERENCES_CONSTRAINTS.ai.contentFocusOptions.filter((x) => x !== null).join(", ")}`;
    }

    // Validate API key format if provided
    if (patch.ai.apiKeyChange === "replace" && patch.ai.apiKey) {
      const apiKeyError = validateApiKeyFormat(patch.ai.apiKey);
      if (apiKeyError) {
        aiErrors.apiKey = apiKeyError;
      }
    }

    if (Object.keys(aiErrors).length > 0) {
      errors.ai = aiErrors;
    }
  }

  // Validate Sync patch
  if (patch.sync) {
    const syncErrors: PreferencesValidationErrors["sync"] = {};

    if (patch.sync.maxArticles !== undefined) {
      if (
        patch.sync.maxArticles < PREFERENCES_CONSTRAINTS.sync.maxArticles.min
      ) {
        syncErrors.maxArticles = `Must be at least ${PREFERENCES_CONSTRAINTS.sync.maxArticles.min}`;
      }
      if (
        patch.sync.maxArticles > PREFERENCES_CONSTRAINTS.sync.maxArticles.max
      ) {
        syncErrors.maxArticles = `Cannot exceed ${PREFERENCES_CONSTRAINTS.sync.maxArticles.max}`;
      }
    }

    if (patch.sync.retentionCount !== undefined) {
      if (
        patch.sync.retentionCount <
        PREFERENCES_CONSTRAINTS.sync.retentionCount.min
      ) {
        syncErrors.retentionCount = `Must be at least ${PREFERENCES_CONSTRAINTS.sync.retentionCount.min}`;
      }
      if (
        patch.sync.retentionCount >
        PREFERENCES_CONSTRAINTS.sync.retentionCount.max
      ) {
        syncErrors.retentionCount = `Cannot exceed ${PREFERENCES_CONSTRAINTS.sync.retentionCount.max}`;
      }
    }

    if (Object.keys(syncErrors).length > 0) {
      errors.sync = syncErrors;
    }
  }

  return errors;
}

/**
 * Validates API key format
 * @param apiKey - The API key to validate
 * @returns Error message if invalid, null if valid
 */
export function validateApiKeyFormat(apiKey: string): string | null {
  // Trim whitespace
  const trimmed = apiKey.trim();

  // Check if empty
  if (!trimmed) {
    return "API key cannot be empty";
  }

  // Check minimum length (most API keys are at least 20 characters)
  if (trimmed.length < 20) {
    return "API key appears to be too short";
  }

  // Check for common Anthropic API key format (sk-ant-api03-...)
  if (trimmed.startsWith("sk-ant-")) {
    // Valid Anthropic format
    return null;
  }

  // Check for test/development keys
  if (trimmed.startsWith("test-") || trimmed.startsWith("dev-")) {
    // Allow test keys in development
    return null;
  }

  // Generic validation - alphanumeric with hyphens and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return "API key contains invalid characters";
  }

  return null;
}

/**
 * Checks if preferences data has validation errors
 * @param errors - The validation errors object
 * @returns True if there are errors
 */
export function hasValidationErrors(
  errors: PreferencesValidationErrors
): boolean {
  if (errors.ai && Object.keys(errors.ai).length > 0) return true;
  if (errors.sync && Object.keys(errors.sync).length > 0) return true;
  return false;
}

/**
 * Clamps a value between min and max
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sanitizes preferences data by clamping values to valid ranges
 * @param data - The preferences data to sanitize
 * @returns Sanitized preferences data
 */
export function sanitizePreferences(data: PreferencesData): PreferencesData {
  const sanitized = { ...data };

  if (sanitized.ai) {
    // Clamp summary lengths
    sanitized.ai.summaryLengthMin = clampValue(
      sanitized.ai.summaryLengthMin,
      PREFERENCES_CONSTRAINTS.ai.summaryLengthMin.min,
      PREFERENCES_CONSTRAINTS.ai.summaryLengthMin.max
    );
    sanitized.ai.summaryLengthMax = clampValue(
      sanitized.ai.summaryLengthMax,
      PREFERENCES_CONSTRAINTS.ai.summaryLengthMax.min,
      PREFERENCES_CONSTRAINTS.ai.summaryLengthMax.max
    );

    // Ensure min <= max
    if (sanitized.ai.summaryLengthMin > sanitized.ai.summaryLengthMax) {
      const avg = Math.floor(
        (sanitized.ai.summaryLengthMin + sanitized.ai.summaryLengthMax) / 2
      );
      sanitized.ai.summaryLengthMin = avg;
      sanitized.ai.summaryLengthMax = avg;
    }

    // Validate enum values
    if (
      !PREFERENCES_CONSTRAINTS.ai.models.includes(sanitized.ai.model as any)
    ) {
      sanitized.ai.model = PREFERENCES_CONSTRAINTS.ai.models[0];
    }
    if (
      !PREFERENCES_CONSTRAINTS.ai.summaryStyles.includes(
        sanitized.ai.summaryStyle
      )
    ) {
      sanitized.ai.summaryStyle = PREFERENCES_CONSTRAINTS.ai.summaryStyles[0];
    }
    if (
      !PREFERENCES_CONSTRAINTS.ai.contentFocusOptions.includes(
        sanitized.ai.contentFocus
      )
    ) {
      sanitized.ai.contentFocus =
        PREFERENCES_CONSTRAINTS.ai.contentFocusOptions[0] || "general";
    }
  }

  if (sanitized.sync) {
    // Clamp sync values
    sanitized.sync.maxArticles = clampValue(
      sanitized.sync.maxArticles,
      PREFERENCES_CONSTRAINTS.sync.maxArticles.min,
      PREFERENCES_CONSTRAINTS.sync.maxArticles.max
    );
    sanitized.sync.retentionCount = clampValue(
      sanitized.sync.retentionCount,
      PREFERENCES_CONSTRAINTS.sync.retentionCount.min,
      PREFERENCES_CONSTRAINTS.sync.retentionCount.max
    );
  }

  return sanitized;
}
