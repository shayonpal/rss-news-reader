/**
 * Smart Feed Stats Refresh Implementation for RR-175
 *
 * Reduces materialized view refresh frequency by only refreshing
 * when actual data changes occur, not on every query.
 */

// Secure client-side feed stats cache using API endpoints
// No direct database access - all operations go through secure server routes

// Feed statistics type to match API response
interface FeedStats {
  feedId: string;
  totalArticles: number;
  unreadArticles: number;
  lastUpdated: string;
  articlesThisWeek: number;
}

/**
 * SmartFeedStats class for efficient feed statistics management
 */
export class SmartFeedStats {
  /**
   * Get feed statistics via secure API with smart caching
   * @param feedId - The feed ID to get stats for
   * @returns Feed statistics object
   */
  static async getStats(feedId: string): Promise<FeedStats | null> {
    try {
      const response = await fetch(`/reader/api/feeds/${feedId}/stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch feed stats:", response.statusText);
        return null;
      }

      const data = await response.json();
      return {
        feedId: data.feedId,
        totalArticles: data.totalArticles,
        unreadArticles: data.unreadArticles,
        lastUpdated: data.lastUpdated,
        articlesThisWeek: data.articlesThisWeek,
      };
    } catch (error) {
      console.error("Error in getStats:", error);
      return null;
    }
  }

  /**
   * Clear cache for a specific feed
   * @param feedId - The feed ID to clear cache for
   */
  static async clearCache(feedId: string): Promise<boolean> {
    try {
      const response = await fetch(`/reader/api/feeds/${feedId}/stats`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Error clearing feed cache:", error);
      return false;
    }
  }

  /**
   * Refresh stats for multiple feeds efficiently
   * @param feedIds - Array of feed IDs to refresh
   * @returns Array of feed statistics
   */
  static async refreshMultipleFeeds(feedIds: string[]): Promise<FeedStats[]> {
    try {
      const promises = feedIds.map((feedId) => this.getStats(feedId));
      const results = await Promise.all(promises);

      // Filter out null results
      return results.filter((stats): stats is FeedStats => stats !== null);
    } catch (error) {
      console.error("Error refreshing multiple feeds:", error);
      return [];
    }
  }
}

// Export default instance
export default SmartFeedStats;
