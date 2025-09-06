/**
 * Common API key handling utilities
 * Provides secure handling of API keys throughout the application
 */

import { PreferencesData, PreferencesPatch, ApiKeyState } from '@/types/preferences';
import { validateApiKeyFormat } from './preferences-validator';

/**
 * Applies API key changes to preferences data
 * Used when applying patches to preferences
 * 
 * @param preferences - Current preferences data
 * @param apiKeyChange - Type of API key change
 * @param apiKey - New API key value (if replacing)
 * @returns Updated preferences with API key changes applied
 */
export function applyApiKeyChange(
  preferences: PreferencesData,
  apiKeyChange?: 'replace' | 'clear' | undefined,
  apiKey?: string | null
): PreferencesData {
  if (!apiKeyChange) return preferences;

  const updated = { ...preferences };

  if (apiKeyChange === 'clear') {
    updated.ai = {
      ...updated.ai,
      hasApiKey: false,
    };
  } else if (apiKeyChange === 'replace' && apiKey) {
    updated.ai = {
      ...updated.ai,
      hasApiKey: true,
    };
  }

  return updated;
}

/**
 * Sanitizes API key response data
 * Ensures API keys are never exposed in responses
 * 
 * @param data - Raw response data
 * @returns Sanitized data with API key removed
 */
export function sanitizeApiKeyResponse(data: any): PreferencesData {
  return {
    ai: {
      hasApiKey: Boolean(data.ai?.hasApiKey),
      model: data.ai?.model || 'claude-3-haiku-20240307',
      summaryLengthMin: data.ai?.summaryLengthMin || 100,
      summaryLengthMax: data.ai?.summaryLengthMax || 300,
      summaryStyle: data.ai?.summaryStyle || 'objective',
      contentFocus: data.ai?.contentFocus || 'general',
    },
    sync: {
      maxArticles: data.sync?.maxArticles || 500,
      retentionCount: data.sync?.retentionCount || 30,
    },
  };
}

/**
 * Processes API key for inclusion in patch
 * Validates and prepares the key for API submission
 * 
 * @param apiKeyState - Current API key state
 * @param apiKeyValue - Raw API key value
 * @returns Processed patch data or null if invalid
 */
export function processApiKeyForPatch(
  apiKeyState: ApiKeyState,
  apiKeyValue?: string
): { apiKeyChange?: 'replace' | 'clear'; apiKey?: string | null } | null {
  if (apiKeyState === 'unchanged') {
    return null;
  }

  if (apiKeyState === 'clear') {
    return {
      apiKeyChange: 'clear',
      apiKey: null,
    };
  }

  if (apiKeyState === 'replace' && apiKeyValue) {
    // Validate format
    const validationError = validateApiKeyFormat(apiKeyValue);
    if (validationError) {
      console.error('Invalid API key format:', validationError);
      return null;
    }

    return {
      apiKeyChange: 'replace',
      apiKey: apiKeyValue.trim(),
    };
  }

  return null;
}

/**
 * Checks if API key state indicates changes
 * 
 * @param apiKeyState - Current API key state
 * @returns True if there are pending API key changes
 */
export function hasApiKeyChanges(apiKeyState: ApiKeyState): boolean {
  return apiKeyState !== 'unchanged';
}

/**
 * Gets display text for API key state
 * 
 * @param hasApiKey - Whether an API key is currently set
 * @param apiKeyState - Current API key state
 * @returns Human-readable state description
 */
export function getApiKeyStateDisplay(
  hasApiKey: boolean,
  apiKeyState: ApiKeyState
): string {
  if (apiKeyState === 'clear') {
    return 'API key will be removed';
  }
  
  if (apiKeyState === 'replace') {
    return hasApiKey ? 'API key will be updated' : 'API key will be set';
  }
  
  return hasApiKey ? 'API key is set' : 'No API key set';
}

/**
 * Masks an API key for display
 * Shows only first and last few characters
 * 
 * @param apiKey - The API key to mask
 * @returns Masked API key string
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 10) {
    return '***';
  }

  const firstChars = apiKey.substring(0, 6);
  const lastChars = apiKey.substring(apiKey.length - 4);
  
  return `${firstChars}...${lastChars}`;
}