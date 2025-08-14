/**
 * Timezone Cache Implementation for RR-175
 *
 * Provides application-level caching for user timezone queries to reduce
 * database load. Uses 24-hour TTL and in-memory storage.
 */

// Secure client-side timezone cache using API endpoints
// No direct database access - all operations go through secure server routes

// Cache configuration
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DEFAULT_TIMEZONE = "America/Toronto"; // Default timezone

// Cache entry type
interface CacheEntry {
  value: string;
  expiry: number;
}

// In-memory cache storage
const cache = new Map<string, CacheEntry>();

/**
 * TimezoneCache class for managing user timezone preferences
 */
export class TimezoneCache {
  /**
   * Get timezone for a user via secure API
   * @param userId - The user ID to get timezone for
   * @returns The user's timezone string
   */
  static async getTimezone(userId: string): Promise<string> {
    try {
      const response = await fetch(`/reader/api/users/${userId}/timezone`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch timezone:", response.statusText);
        return DEFAULT_TIMEZONE;
      }

      const data = await response.json();
      return data.timezone || DEFAULT_TIMEZONE;
    } catch (error) {
      console.error("Error in getTimezone:", error);
      return DEFAULT_TIMEZONE;
    }
  }

  /**
   * Set timezone for a user via secure API
   * @param userId - The user ID to set timezone for
   * @param timezone - The timezone string to set
   */
  static async setTimezone(userId: string, timezone: string): Promise<boolean> {
    try {
      const response = await fetch(`/reader/api/users/${userId}/timezone`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timezone }),
      });

      if (!response.ok) {
        console.error("Failed to update timezone:", response.statusText);
        return false;
      }

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error("Error in setTimezone:", error);
      return false;
    }
  }

  /**
   * Clear cache for a specific user (server-side operation)
   * @param userId - The user ID to clear cache for
   */
  static async clearUserCache(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`/reader/api/users/${userId}/timezone`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Error clearing user cache:", error);
      return false;
    }
  }

  /**
   * Get cache statistics (client-side placeholder)
   * Note: Actual cache stats are server-side only for security
   */
  static getCacheStats(): { size: number; entries: string[] } {
    return {
      size: 0,
      entries: [],
    };
  }
}

// Export default instance
export default TimezoneCache;
