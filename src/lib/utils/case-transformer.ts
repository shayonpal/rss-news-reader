/**
 * @fileoverview Case transformation utility for API response normalization (RR-284)
 * Transforms snake_case API responses to camelCase for frontend compatibility
 */

/**
 * Checks if an object is a plain object (not array, date, etc.)
 * Uses Object.prototype.toString for more reliable detection
 */
function isPlainObject(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    Object.prototype.toString.call(obj) === "[object Object]"
  );
}

/**
 * Converts snake_case string to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transforms snake_case keys to camelCase recursively
 * Handles nested objects, arrays, and prevents prototype pollution
 *
 * @param obj - The object to transform
 * @param visited - Set to track circular references
 * @returns Transformed object with camelCase keys
 */
export function snakeToCamel<T>(obj: T, visited?: WeakSet<object>): T {
  // Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  // Initialize visited set only at top level
  if (!visited) {
    visited = new WeakSet();
  }

  // Handle circular references
  if (visited.has(obj as object)) {
    return obj;
  }
  visited.add(obj as object);

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamel(item, visited)) as T;
  }

  // Handle Date objects and other non-plain objects
  if (!isPlainObject(obj)) {
    return obj;
  }

  // Transform plain objects
  const result: Record<string, unknown> = {};

  for (const key in obj) {
    // Only process own properties - use secure hasOwnProperty check
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip prototype pollution attempts
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }

      const camelKey = toCamelCase(key);
      const value = (obj as Record<string, unknown>)[key];
      result[camelKey] = snakeToCamel(value, visited);
    }
  }

  return result as T;
}

/**
 * Transforms API response object from snake_case to camelCase
 * Optimized for API response structure with data/success pattern
 *
 * @param response - API response object
 * @returns Transformed response with camelCase keys
 */
export function transformApiResponse<T>(response: T): T {
  return snakeToCamel(response);
}
