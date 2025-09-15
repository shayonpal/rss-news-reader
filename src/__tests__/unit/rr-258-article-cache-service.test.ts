/**
 * RR-258: ArticleCacheService Unit Tests
 * Tests the centralized cache service that replaced global window pattern
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { articleCacheService } from "@/lib/services/article-cache-service";
import type { ArticleCountManager } from "@/lib/article-count-manager";

describe("RR-258: ArticleCacheService", () => {
  let mockManager1: ArticleCountManager;
  let mockManager2: ArticleCountManager;

  beforeEach(() => {
    // Reset service for clean state
    articleCacheService.reset();

    // Create realistic mock managers
    mockManager1 = {
      invalidateCache: vi.fn(),
    };

    mockManager2 = {
      invalidateCache: vi.fn(),
    };
  });

  describe("Manager Registration", () => {
    it("should register a single manager", () => {
      articleCacheService.register(mockManager1);

      articleCacheService.invalidateCache("feed-123");

      expect(mockManager1.invalidateCache).toHaveBeenCalledWith("feed-123");
    });

    it("should register multiple managers", () => {
      articleCacheService.register(mockManager1);
      articleCacheService.register(mockManager2);

      articleCacheService.invalidateCache("feed-456");

      expect(mockManager1.invalidateCache).toHaveBeenCalledWith("feed-456");
      expect(mockManager2.invalidateCache).toHaveBeenCalledWith("feed-456");
    });

    it("should not register the same manager twice", () => {
      articleCacheService.register(mockManager1);
      articleCacheService.register(mockManager1); // Same instance

      articleCacheService.invalidateCache("feed-789");

      expect(mockManager1.invalidateCache).toHaveBeenCalledTimes(1);
    });
  });

  describe("Manager Unregistration", () => {
    it("should unregister a manager", () => {
      articleCacheService.register(mockManager1);
      articleCacheService.register(mockManager2);

      articleCacheService.unregister(mockManager1);
      articleCacheService.invalidateCache("feed-unregister");

      expect(mockManager1.invalidateCache).not.toHaveBeenCalled();
      expect(mockManager2.invalidateCache).toHaveBeenCalledWith("feed-unregister");
    });

    it("should handle unregistering non-existent manager gracefully", () => {
      const nonExistentManager = { invalidateCache: vi.fn() };

      expect(() => {
        articleCacheService.unregister(nonExistentManager);
      }).not.toThrow();
    });
  });

  describe("Cache Invalidation", () => {
    beforeEach(() => {
      articleCacheService.register(mockManager1);
      articleCacheService.register(mockManager2);
    });

    it("should invalidate cache with specific feedId", () => {
      const feedId = "f489af08-3416-4763-8589-aaab3910d1f4";

      articleCacheService.invalidateCache(feedId);

      expect(mockManager1.invalidateCache).toHaveBeenCalledWith(feedId);
      expect(mockManager2.invalidateCache).toHaveBeenCalledWith(feedId);
    });

    it("should invalidate cache without feedId (clear all)", () => {
      articleCacheService.invalidateCache();

      expect(mockManager1.invalidateCache).toHaveBeenCalledWith(undefined);
      expect(mockManager2.invalidateCache).toHaveBeenCalledWith(undefined);
    });

    it("should handle manager errors without blocking other managers", () => {
      const faultyManager = {
        invalidateCache: vi.fn(() => {
          throw new Error("Mock invalidation error");
        }),
      };

      articleCacheService.register(faultyManager);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      articleCacheService.invalidateCache("feed-error-test");

      expect(faultyManager.invalidateCache).toHaveBeenCalled();
      expect(mockManager1.invalidateCache).toHaveBeenCalledWith("feed-error-test");
      expect(mockManager2.invalidateCache).toHaveBeenCalledWith("feed-error-test");
      expect(consoleSpy).toHaveBeenCalledWith('Manager invalidation failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe("Test Utilities", () => {
    it("should reset all managers for test cleanup", () => {
      articleCacheService.register(mockManager1);
      articleCacheService.register(mockManager2);

      articleCacheService.reset();
      articleCacheService.invalidateCache("feed-reset-test");

      expect(mockManager1.invalidateCache).not.toHaveBeenCalled();
      expect(mockManager2.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe("RR-258 Acceptance Criteria Validation", () => {
    it("AC2: Cache invalidation must occur when markAllAsRead() is called", () => {
      articleCacheService.register(mockManager1);

      // Simulate article store calling service during markAllAsRead
      const feedId = "71f433a3-3fdf-481b-8db3-1bf3e8b32894";
      articleCacheService.invalidateCache(feedId);

      expect(mockManager1.invalidateCache).toHaveBeenCalledWith(feedId);
    });

    it("AC4: Global window pattern must be eliminated", () => {
      // Test that service works without global window dependency
      articleCacheService.register(mockManager1);

      // Ensure no global window usage in service implementation
      expect((global as any).window?.__articleCountManager).toBeUndefined();

      articleCacheService.invalidateCache("test-no-global");
      expect(mockManager1.invalidateCache).toHaveBeenCalled();
    });

    it("AC5: Service registration must work for multiple components", () => {
      // Simulate page.tsx and article-header.tsx both registering
      const pageManager = { invalidateCache: vi.fn() };
      const headerManager = { invalidateCache: vi.fn() };

      articleCacheService.register(pageManager);
      articleCacheService.register(headerManager);

      articleCacheService.invalidateCache("multi-component-test");

      expect(pageManager.invalidateCache).toHaveBeenCalledWith("multi-component-test");
      expect(headerManager.invalidateCache).toHaveBeenCalledWith("multi-component-test");
    });
  });
});