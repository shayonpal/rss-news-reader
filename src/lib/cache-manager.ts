// Cache management utilities for service worker and application caches

export interface CacheInfo {
  name: string;
  size: number;
  entries: number;
  lastUpdated: Date;
}

export class CacheManager {
  private static CACHE_NAMES = {
    API: "api-cache",
    INOREADER: "inoreader-api",
    IMAGES: "images",
    PAGES: "pages",
    FONTS: "google-fonts",
  };

  /**
   * Get information about all caches
   */
  static async getCacheInfo(): Promise<CacheInfo[]> {
    if (typeof window === "undefined" || !("caches" in window)) {
      return [];
    }

    try {
      const cacheNames = await caches.keys();
      const cacheInfos: CacheInfo[] = [];

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();

        let totalSize = 0;
        for (const request of keys) {
          try {
            const response = await cache.match(request);
            if (response) {
              const text = await response.clone().text();
              totalSize += new Blob([text]).size;
            }
          } catch (error) {
            console.warn(
              `Error calculating size for cache entry: ${request.url}`,
              error
            );
          }
        }

        cacheInfos.push({
          name,
          size: totalSize,
          entries: keys.length,
          lastUpdated: new Date(), // This would ideally come from cache metadata
        });
      }

      return cacheInfos;
    } catch (error) {
      console.error("Error getting cache info:", error);
      return [];
    }
  }

  /**
   * Clear all application caches
   */
  static async clearAllCaches(): Promise<void> {
    if (typeof window === "undefined" || !("caches" in window)) {
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
      console.log("All caches cleared");
    } catch (error) {
      console.error("Error clearing caches:", error);
      throw error;
    }
  }

  /**
   * Clear specific cache by name
   */
  static async clearCache(cacheName: string): Promise<void> {
    if (typeof window === "undefined" || !("caches" in window)) {
      return;
    }

    try {
      await caches.delete(cacheName);
      console.log(`Cache ${cacheName} cleared`);
    } catch (error) {
      console.error(`Error clearing cache ${cacheName}:`, error);
      throw error;
    }
  }

  /**
   * Get total cache size across all caches
   */
  static async getTotalCacheSize(): Promise<number> {
    const cacheInfos = await this.getCacheInfo();
    return cacheInfos.reduce((total, cache) => total + cache.size, 0);
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Check if content is cached
   */
  static async isCached(url: string): Promise<boolean> {
    if (typeof window === "undefined" || !("caches" in window)) {
      return false;
    }

    try {
      const response = await caches.match(url);
      return !!response;
    } catch (error) {
      console.error("Error checking cache for URL:", url, error);
      return false;
    }
  }

  /**
   * Preload critical resources
   */
  static async preloadCriticalResources(): Promise<void> {
    if (typeof window === "undefined" || !("caches" in window)) {
      return;
    }

    const criticalUrls = ["/", "/offline", "/manifest.json"];

    try {
      const cache = await caches.open("critical-resources");
      await Promise.all(
        criticalUrls.map((url) =>
          fetch(url)
            .then((response) =>
              response.ok ? cache.put(url, response) : Promise.resolve()
            )
            .catch((error) => console.warn(`Failed to preload ${url}:`, error))
        )
      );
      console.log("Critical resources preloaded");
    } catch (error) {
      console.error("Error preloading critical resources:", error);
    }
  }
}
