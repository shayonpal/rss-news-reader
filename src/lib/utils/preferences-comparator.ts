/**
 * Efficient shallow comparison utilities for preferences
 */

import { PreferencesData } from '@/types/preferences';

/**
 * Efficiently compares two preferences objects for equality
 * Uses shallow comparison where possible to avoid expensive JSON.stringify
 * 
 * @param a - First preferences object
 * @param b - Second preferences object
 * @returns True if objects are equal
 */
export function arePreferencesEqual(
  a: PreferencesData | null | undefined,
  b: PreferencesData | null | undefined
): boolean {
  // Handle null/undefined cases
  if (a === b) return true;
  if (!a || !b) return false;

  // Compare AI section
  if (!areAiPreferencesEqual(a.ai, b.ai)) return false;

  // Compare Sync section
  if (!areSyncPreferencesEqual(a.sync, b.sync)) return false;

  return true;
}

/**
 * Compares AI preferences sections
 */
function areAiPreferencesEqual(
  a: PreferencesData['ai'] | undefined,
  b: PreferencesData['ai'] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.hasApiKey === b.hasApiKey &&
    a.model === b.model &&
    a.summaryLengthMin === b.summaryLengthMin &&
    a.summaryLengthMax === b.summaryLengthMax &&
    a.summaryStyle === b.summaryStyle &&
    a.contentFocus === b.contentFocus
  );
}

/**
 * Compares Sync preferences sections
 */
function areSyncPreferencesEqual(
  a: PreferencesData['sync'] | undefined,
  b: PreferencesData['sync'] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.maxArticles === b.maxArticles &&
    a.retentionCount === b.retentionCount
  );
}

/**
 * Memoized comparison result cache
 * Uses WeakMap to avoid memory leaks
 */
const comparisonCache = new WeakMap<PreferencesData, WeakMap<PreferencesData, boolean>>();

/**
 * Memoized version of arePreferencesEqual
 * Caches comparison results to avoid redundant checks
 */
export function arePreferencesEqualMemoized(
  a: PreferencesData | null | undefined,
  b: PreferencesData | null | undefined
): boolean {
  // Handle null/undefined cases
  if (!a || !b) return arePreferencesEqual(a, b);

  // Check cache
  let cacheForA = comparisonCache.get(a);
  if (cacheForA) {
    const cachedResult = cacheForA.get(b);
    if (cachedResult !== undefined) {
      return cachedResult;
    }
  } else {
    cacheForA = new WeakMap();
    comparisonCache.set(a, cacheForA);
  }

  // Compute and cache result
  const result = arePreferencesEqual(a, b);
  cacheForA.set(b, result);
  
  return result;
}