/**
 * Bounded cache for decrypted API keys with TTL
 * Prevents repeated database queries and decryption operations
 */

export interface CachedApiKey {
  obfuscatedKey: Buffer; // Store as obfuscated Buffer instead of plaintext
  source: "user" | "environment";
  expires: number;
  lastAccessed: number;
}

export interface DecryptionMetrics {
  queryTime: number;
  decryptTime: number;
  totalTime: number;
  error?: string;
}

export class ApiKeyCache {
  private cache = new Map<string, CachedApiKey>();
  private readonly maxSize = 100; // Maximum cache entries
  private readonly ttl = 5 * 60 * 1000; // 5 minutes
  private static instance: ApiKeyCache;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly obfuscationKey = Buffer.from(
    "x9k2m5p8n3q6w1e4r7t0y2u5i8o1a4s7",
    "utf8"
  );

  /**
   * Get singleton instance
   */
  static getInstance(): ApiKeyCache {
    if (!ApiKeyCache.instance) {
      ApiKeyCache.instance = new ApiKeyCache();
      // Schedule periodic cleanup
      ApiKeyCache.instance.cleanupInterval = setInterval(
        () => ApiKeyCache.instance.cleanup(),
        60 * 1000
      ); // Every minute
    }
    return ApiKeyCache.instance;
  }

  /**
   * Simple XOR obfuscation to prevent plaintext in memory
   * Not cryptographically secure but prevents casual memory inspection
   */
  private obfuscate(text: string): Buffer {
    const textBuffer = Buffer.from(text, "utf8");
    const result = Buffer.alloc(textBuffer.length);
    for (let i = 0; i < textBuffer.length; i++) {
      result[i] =
        textBuffer[i] ^ this.obfuscationKey[i % this.obfuscationKey.length];
    }
    return result;
  }

  /**
   * Deobfuscate the buffer back to string
   */
  private deobfuscate(buffer: Buffer): string {
    const result = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      result[i] =
        buffer[i] ^ this.obfuscationKey[i % this.obfuscationKey.length];
    }
    return result.toString("utf8");
  }

  /**
   * Get a cached API key for a user
   * @param userId The user ID
   * @returns The cached API key and source, or null if not cached or expired
   */
  get(userId: string): { key: string; source: "user" | "environment" } | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;

    // Check if expired
    if (entry.expires < Date.now()) {
      this.cache.delete(userId);
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    // Deobfuscate the key before returning
    return { key: this.deobfuscate(entry.obfuscatedKey), source: entry.source };
  }

  /**
   * Cache an API key for a user
   * @param userId The user ID
   * @param key The decrypted API key
   * @param source Whether this is a user key or environment key
   */
  set(userId: string, key: string, source: "user" | "environment"): void {
    // If cache is at max size, remove least recently accessed entry
    if (this.cache.size >= this.maxSize && !this.cache.has(userId)) {
      let lruKey: string | null = null;
      let lruTime = Date.now();

      for (const [k, v] of this.cache.entries()) {
        if (v.lastAccessed < lruTime) {
          lruKey = k;
          lruTime = v.lastAccessed;
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(userId, {
      obfuscatedKey: this.obfuscate(key), // Store obfuscated version
      source,
      expires: Date.now() + this.ttl,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Invalidate a cached key for a user
   * @param userId The user ID
   */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Clear all cached keys
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMinutes: this.ttl / 60000,
    };
  }

  /**
   * Destroy the cache and clean up resources
   * Should be called on application shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    ApiKeyCache.instance = null as any;
  }
}
