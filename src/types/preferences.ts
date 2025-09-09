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
    apiKey: null; // Always null for security - never exposes real key
    model: string;
    summaryLengthMin: number;
    summaryLengthMax: number;
    summaryStyle: "objective" | "analytical" | "concise" | "detailed";
    contentFocus: "general" | "technical" | "business" | "educational" | null;
  };
  sync: {
    maxArticles: number; // 1-5000
    retentionCount: number; // minimum 1, no maximum
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
 * Database structure for user preferences table
 * Maps to the actual database column names
 */
export interface UserPreferencesDB {
  user_id: string;
  sync_max_articles?: number;
  sync_retention_count?: number;
  ai_enabled?: boolean;
  ai_provider?: string;
  ai_summary_min_length?: number;
  ai_summary_max_length?: number;
  theme?: string;
  sync_enabled?: boolean;
  retention_days?: number;
  feed_order?: string;
  show_unread_only?: boolean;
  mark_as_read_on_open?: boolean;
  enable_notifications?: boolean;
  notification_time?: string;
  encrypted_inoreader_api_key?: string;
  encrypted_claude_api_key?: string;
  created_at?: string;
  updated_at?: string;
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
    apiKey?: string | { encrypted: string; iv: string; authTag: string } | null; // Encrypted or null
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
    apiKey: null,
    model: "claude-3-haiku-20240307",
    summaryLengthMin: 100,
    summaryLengthMax: 300,
    summaryStyle: "objective",
    contentFocus: "general",
  },
  sync: {
    maxArticles: 100,
    retentionCount: 2000,
  },
};

/**
 * Validation constraints
 */
export const PREFERENCES_CONSTRAINTS = {
  sync: {
    maxArticles: { min: 1, max: 5000 },
    retentionCount: { min: 1 },
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
    // Note: Models are now dynamically loaded from the ai_models database table
    // This ensures consistency and allows for updates without code changes
  },
} as const;
