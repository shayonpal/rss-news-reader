/**
 * RR-270: Patch Builder Utility
 *
 * Builds minimal patch objects for preference updates
 * using patch semantics (omitted = unchanged, null = clear).
 */

import type {
  PreferencesData,
  PreferencesPatch,
  ApiKeyState,
} from "@/types/preferences";
import { encryptApiKey } from "./encryption";

/**
 * System fields that should never be included in patches
 */
const SYSTEM_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "hasApiKey", // This is server-managed
]);

/**
 * Builds a minimal patch object containing only changed fields
 *
 * This function performs a deep comparison between draft and saved preferences,
 * creating a minimal patch object containing only the fields that have changed.
 * It handles special cases like new users (no saved preferences) and API key
 * state changes which require special handling for security.
 *
 * @param draft - Current draft state from editor
 * @param saved - Saved preferences from domain store (null/undefined for new users)
 * @param apiKeyState - API key state machine state ('unchanged' | 'replace' | 'clear')
 * @param apiKeyValue - New API key value if replacing
 * @returns Minimal patch object for API update
 *
 * @example
 * // For a new user with no saved preferences
 * const patch = buildPreferencesPatch(draft, null, 'unchanged');
 *
 * @example
 * // For updating existing preferences with API key change
 * const patch = buildPreferencesPatch(draft, saved, 'replace', newApiKey);
 */
export function buildPreferencesPatch(
  draft: PreferencesData | null,
  saved: PreferencesData | undefined | null,
  apiKeyState: ApiKeyState = "unchanged",
  apiKeyValue?: string
): PreferencesPatch {
  // Handle undefined saved state (new user)
  if (!saved) {
    const patch: PreferencesPatch = {};

    // Include all non-system fields from draft
    if (draft?.ai) {
      patch.ai = {
        model: draft.ai.model,
        summaryLengthMin: Number(draft.ai.summaryLengthMin),
        summaryLengthMax: Number(draft.ai.summaryLengthMax),
        summaryStyle: draft.ai.summaryStyle,
        contentFocus: draft.ai.contentFocus,
      };
    }

    if (draft?.sync) {
      patch.sync = {
        maxArticles: Number(draft.sync.maxArticles),
        retentionCount: Number(draft.sync.retentionCount),
      };
    }

    // Add API key if needed (with encryption)
    if (apiKeyState === "replace" && apiKeyValue) {
      if (!patch.ai) patch.ai = {};
      patch.ai.apiKeyChange = "replace";

      // Encrypt the API key before including in patch
      const encrypted = encryptApiKey(apiKeyValue);
      patch.ai.apiKey = encrypted;
    }

    return patch;
  }

  const patch: PreferencesPatch = {};

  // Compare AI section
  if (draft?.ai) {
    const aiPatch: PreferencesPatch["ai"] = {};
    let hasAiChanges = false;

    // Check each field for changes
    if (draft.ai.model !== saved.ai?.model) {
      aiPatch.model = draft.ai.model;
      hasAiChanges = true;
    }
    if (draft.ai.summaryLengthMin !== saved.ai?.summaryLengthMin) {
      console.log(
        "DEBUG: summaryLengthMin type/value:",
        typeof draft.ai.summaryLengthMin,
        draft.ai.summaryLengthMin
      );
      const convertedMin = Number(draft.ai.summaryLengthMin);
      console.log(
        "DEBUG: converted summaryLengthMin type/value:",
        typeof convertedMin,
        convertedMin
      );
      aiPatch.summaryLengthMin = convertedMin;
      hasAiChanges = true;
    }
    if (draft.ai.summaryLengthMax !== saved.ai?.summaryLengthMax) {
      console.log(
        "DEBUG: summaryLengthMax type/value:",
        typeof draft.ai.summaryLengthMax,
        draft.ai.summaryLengthMax
      );
      const convertedMax = Number(draft.ai.summaryLengthMax);
      console.log(
        "DEBUG: converted summaryLengthMax type/value:",
        typeof convertedMax,
        convertedMax
      );
      aiPatch.summaryLengthMax = convertedMax;
      hasAiChanges = true;
    }
    if (draft.ai.summaryStyle !== saved.ai?.summaryStyle) {
      aiPatch.summaryStyle = draft.ai.summaryStyle;
      hasAiChanges = true;
    }
    if (draft.ai.contentFocus !== saved.ai?.contentFocus) {
      aiPatch.contentFocus = draft.ai.contentFocus;
      hasAiChanges = true;
    }

    // Handle API key state changes (with encryption)
    if (apiKeyState === "replace" && apiKeyValue) {
      aiPatch.apiKeyChange = "replace";

      // Encrypt the API key before including in patch
      const encrypted = encryptApiKey(apiKeyValue);
      aiPatch.apiKey = encrypted;
      hasAiChanges = true;
    } else if (apiKeyState === "clear") {
      aiPatch.apiKeyChange = "clear";
      aiPatch.apiKey = null;
      hasAiChanges = true;
    }

    if (hasAiChanges) {
      patch.ai = aiPatch;
    }
  }

  // Compare Sync section
  if (draft?.sync) {
    const syncPatch: PreferencesPatch["sync"] = {};
    let hasSyncChanges = false;

    if (draft.sync.maxArticles !== saved.sync?.maxArticles) {
      syncPatch.maxArticles = Number(draft.sync.maxArticles);
      hasSyncChanges = true;
    }
    if (draft.sync.retentionCount !== saved.sync?.retentionCount) {
      syncPatch.retentionCount = Number(draft.sync.retentionCount);
      hasSyncChanges = true;
    }

    if (hasSyncChanges) {
      patch.sync = syncPatch;
    }
  }

  return patch;
}

/**
 * Compares two values for deep equality
 * @param value1 - First value to compare
 * @param value2 - Second value to compare
 * @returns True if values are different
 */
function isDifferent<T>(value1: T, value2: T): boolean {
  // Handle null/undefined cases
  if (value1 === value2) return false;
  if (value1 == null || value2 == null) return true;

  // Handle objects/arrays
  if (typeof value1 === "object" && typeof value2 === "object") {
    return JSON.stringify(value1) !== JSON.stringify(value2);
  }

  return value1 !== value2;
}
