/**
 * @fileoverview Unit tests for case transformation utility (RR-284)
 * Tests snake_case to camelCase transformation for API response normalization
 */

import { describe, it, expect, beforeEach } from "vitest";
import { snakeToCamel, transformApiResponse } from "../case-transformer";

describe("CaseTransformer", () => {
  describe("snakeToCamel", () => {
    it("should transform basic snake_case to camelCase", () => {
      const input = {
        feed_id: "uuid-123",
        published_at: "2025-01-13T10:00:00Z",
        is_partial_content: true,
      };
      const result = snakeToCamel(input);

      expect(result).toEqual({
        feedId: "uuid-123",
        publishedAt: "2025-01-13T10:00:00Z",
        isPartialContent: true,
      });
    });

    it("should handle nested objects", () => {
      const input = {
        article_data: {
          feed_id: "feed-uuid",
          user_preferences: {
            auto_fetch: true,
            read_later: false,
          },
        },
      };
      const result = snakeToCamel(input);

      expect(result).toEqual({
        articleData: {
          feedId: "feed-uuid",
          userPreferences: {
            autoFetch: true,
            readLater: false,
          },
        },
      });
    });

    it("should handle arrays of objects", () => {
      const input = {
        articles: [
          { feed_id: "feed1", published_at: "2025-01-13T10:00:00Z" },
          { feed_id: "feed2", published_at: "2025-01-13T11:00:00Z" },
        ],
      };
      const result = snakeToCamel(input);

      expect(result.articles).toHaveLength(2);
      expect(result.articles[0]).toEqual({
        feedId: "feed1",
        publishedAt: "2025-01-13T10:00:00Z",
      });
    });

    it("should handle null and undefined gracefully", () => {
      expect(snakeToCamel(null)).toBeNull();
      expect(snakeToCamel(undefined)).toBeUndefined();

      const input = {
        feed_id: null,
        published_at: undefined,
        valid_field: "value",
      };
      const result = snakeToCamel(input);

      expect(result).toEqual({
        feedId: null,
        publishedAt: undefined,
        validField: "value",
      });
    });

    it("should prevent prototype pollution", () => {
      const maliciousInput = {
        __proto__: { evil: true },
        constructor: { prototype: { polluted: true } },
        feed_id: "safe-value",
      };

      const result = snakeToCamel(maliciousInput);

      // Verify no pollution occurred
      expect(({} as any).evil).toBeUndefined();
      expect(({} as any).polluted).toBeUndefined();
      expect(result.feedId).toBe("safe-value");
    });

    it("should handle mixed case fields (backwards compatibility)", () => {
      const input = {
        feedId: "already-camel", // Already camelCase
        feed_url: "needs-transform", // Needs transformation
        isRead: true, // Already camelCase
      };
      const result = snakeToCamel(input);

      expect(result).toEqual({
        feedId: "already-camel",
        feedUrl: "needs-transform",
        isRead: true,
      });
    });

    it("should handle circular references without infinite recursion", () => {
      const circular: any = { feed_id: "test" };
      circular.self = circular;

      expect(() => snakeToCamel(circular)).not.toThrow();
      const result = snakeToCamel(circular);
      expect(result.feedId).toBe("test");
    });

    it("should preserve Date objects and other non-plain objects", () => {
      const now = new Date();
      const input = {
        published_at: now,
        feed_id: "test",
      };
      const result = snakeToCamel(input);

      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.publishedAt).toBe(now);
      expect(result.feedId).toBe("test");
    });

    it("should handle deeply nested structures", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                deeply_nested_field: "success",
              },
            },
          },
        },
      };
      const result = snakeToCamel(input);

      expect(result.level1.level2.level3.level4.deeplyNestedField).toBe(
        "success"
      );
    });
  });

  describe("transformApiResponse", () => {
    it("should transform article response for auto-fetch compatibility", () => {
      const apiResponse = {
        success: true,
        data: {
          articles: [
            {
              id: "article-123",
              feed_id: "feed-uuid-456",
              published_at: "2025-01-13T10:00:00Z",
              is_partial_content: true,
              content_length: 150,
              feed_data: {
                feed_url: "https://feeds.bbci.co.uk/news/rss.xml",
                is_partial: true,
              },
            },
          ],
          total_count: 1,
          has_more: false,
        },
      };

      const result = transformApiResponse(apiResponse);

      expect(result.data.articles[0]).toEqual({
        id: "article-123",
        feedId: "feed-uuid-456",
        publishedAt: "2025-01-13T10:00:00Z",
        isPartialContent: true,
        contentLength: 150,
        feedData: {
          feedUrl: "https://feeds.bbci.co.uk/news/rss.xml",
          isPartial: true,
        },
      });
      expect(result.data.totalCount).toBe(1);
      expect(result.data.hasMore).toBe(false);
    });

    it("should handle empty arrays and null data", () => {
      const apiResponse = {
        success: true,
        data: {
          articles: [],
          total_count: 0,
          error_message: null,
        },
      };

      const result = transformApiResponse(apiResponse);

      expect(result.data.articles).toEqual([]);
      expect(result.data.totalCount).toBe(0);
      expect(result.data.errorMessage).toBeNull();
    });
  });

  describe("Performance", () => {
    it("should transform 100 articles in under 2ms", () => {
      const articles = Array.from({ length: 100 }, (_, i) => ({
        id: `article-${i}`,
        feed_id: `feed-${i}`,
        published_at: "2025-01-13T10:00:00Z",
        is_partial_content: i % 2 === 0,
        nested_data: {
          user_id: `user-${i}`,
          read_count: i * 10,
        },
      }));

      const input = { articles, total_count: 100 };

      const start = performance.now();
      const result = snakeToCamel(input);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2);
      expect(result.articles).toHaveLength(100);
      expect(result.articles[0].feedId).toBeDefined();
      expect(result.totalCount).toBe(100);
    });

    it("should not cause memory leaks with large objects", () => {
      const largeObject = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          [`field_${i}`]: `value_${i}`,
        })).reduce((acc, obj) => ({ ...acc, ...obj }), {}),
      };

      // Memory usage should remain reasonable
      const initialMemory = process.memoryUsage().heapUsed;
      for (let i = 0; i < 10; i++) {
        snakeToCamel(largeObject);
      }
      const finalMemory = process.memoryUsage().heapUsed;

      // Memory increase should be minimal
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });
});
