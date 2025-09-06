/**
 * RR-270: User Preferences Types
 *
 * Type definitions for user preferences management with
 * split architecture (domain vs editor) and API key security.
 */

/**
 * Main preferences data structure
 * This is what's stored in the database and used throughout the app
 */
export interface PreferencesData {
  ai: {
    hasApiKey: boolean; // Boolean only, never actual key
    model: string;
    summaryLengthMin: number;
    summaryLengthMax: number;
    summaryStyle: "objective" | "analytical" | "concise" | "detailed";
    contentFocus: "general" | "technical" | "business" | "educational" | null;
  };
  sync: {
    maxArticles: number; // 10-5000
    retentionCount: number; // 1-365
  };
}

/**
 * Full user preferences with metadata
 * Used in database and API responses
 */
export interface UserPreferences extends PreferencesData {
  id: string;
  userId: string;
  theme: "light" | "dark" | "system";
  syncEnabled: boolean;
  retentionDays: number;
  feedOrder: "alphabetical" | "unread" | "recent";
  showUnreadOnly: boolean;
  markAsReadOnOpen: boolean;
  enableNotifications: boolean;
  notificationTime: string | null;
  inoreaderApiKey: null; // Always null on client
  claudeApiKey: null; // Always null on client
  createdAt: string;
  updatedAt: string;
}

/**
 * API key state machine states
 * Used to track changes without exposing actual keys
 *
 * State transitions:
 * - 'unchanged': Default state - no pending API key changes
 *   → Can transition to 'replace' (user enters new key) or 'clear' (user removes key)
 *
 * - 'replace': User has entered a new API key (stored in WeakMap, never in state)
 *   → On save success: transitions back to 'unchanged'
 *   → On save failure: remains in 'replace' state for retry
 *   → User can change to 'clear' or back to 'unchanged'
 *
 * - 'clear': User wants to remove the existing API key
 *   → On save success: transitions back to 'unchanged'
 *   → On save failure: remains in 'clear' state for retry
 *   → User can change to 'replace' or back to 'unchanged'
 *
 * Security notes:
 * - The actual API key value is NEVER stored in this state
 * - API keys are stored separately in a WeakMap (memory-only)
 * - This state machine only tracks the TYPE of change, not the value
 */
export type ApiKeyState = "unchanged" | "replace" | "clear";

/**
 * Patch object for partial updates
 * Uses patch semantics: omitted = unchanged, null = clear
 */
export interface PreferencesPatch {
  ai?: {
    model?: string;
    summaryLengthMin?: number;
    summaryLengthMax?: number;
    summaryStyle?: PreferencesData["ai"]["summaryStyle"];
    contentFocus?: PreferencesData["ai"]["contentFocus"] | null;
    apiKeyChange?: ApiKeyState;
    apiKey?: string | null; // Only sent during 'replace' or 'clear'
  };
  sync?: {
    maxArticles?: number;
    retentionCount?: number;
  };
  theme?: UserPreferences["theme"];
  syncEnabled?: boolean;
  retentionDays?: number;
  feedOrder?: UserPreferences["feedOrder"];
  showUnreadOnly?: boolean;
  markAsReadOnOpen?: boolean;
  enableNotifications?: boolean;
  notificationTime?: string | null;
  inoreaderApiKey?: ApiKeyState | string;
  claudeApiKey?: ApiKeyState | string;
}

/**
 * Validation errors for preferences
 */
export interface PreferencesValidationErrors {
  ai?: {
    model?: string;
    summaryLengthMin?: string;
    summaryLengthMax?: string;
    summaryStyle?: string;
    contentFocus?: string;
    apiKey?: string;
  };
  sync?: {
    maxArticles?: string;
    retentionCount?: string;
  };
  apiKey?: string; // Top-level API key error
  [field: string]: string | undefined | { [key: string]: string | undefined };
}

/**
 * Default preferences values
 */
export const DEFAULT_PREFERENCES: PreferencesData = {
  ai: {
    hasApiKey: false,
    model: "claude-3-haiku-20240307",
    summaryLengthMin: 100,
    summaryLengthMax: 300,
    summaryStyle: "objective",
    contentFocus: "general",
  },
  sync: {
    maxArticles: 500,
    retentionCount: 30,
  },
};

/**
 * Validation constraints
 */
export const PREFERENCES_CONSTRAINTS = {
  sync: {
    maxArticles: { min: 10, max: 5000 },
    retentionCount: { min: 1, max: 365 },
  },
  ai: {
    summaryLengthMin: { min: 50, max: 500 },
    summaryLengthMax: { min: 50, max: 500 },
    summaryStyles: ["objective", "analytical", "concise", "detailed"] as const,
    contentFocusOptions: [
      "general",
      "technical",
      "business",
      "educational",
      null,
    ] as const,
    models: [
      "claude-3-haiku-20240307",
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
    ] as const,
  },
} as const;
