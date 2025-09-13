/**
 * @fileoverview Performance tests for RR-284 case transformation overhead
 * Validates transformation performance meets mobile requirements
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  snakeToCamel,
  transformApiResponse,
} from "@/lib/utils/case-transformer";

// Mock performance.now() for consistent testing
const mockPerformance = {
  marks: new Map<string, number>(),
  now: () => Date.now(),
};

describe("RR-284 Transformation Performance", () => {
  beforeAll(() => {
    // Ensure consistent timing environment
    if (typeof global !== "undefined") {
      (global as any).performance = mockPerformance;
    }
  });

  describe("Transformation Overhead Benchmarks", () => {
    it("should transform 100 articles in under 2ms", () => {
      const articles = Array.from({ length: 100 }, (_, i) => ({
        id: `article-${i}`,
        feed_id: `feed-uuid-${i}`,
        published_at: "2025-01-13T10:00:00Z",
        is_partial_content: i % 2 === 0,
        content_length: 100 + i,
        nested_data: {
          user_id: `user-${i}`,
          read_count: i * 10,
          preferences: {
            auto_fetch: true,
            read_later: false,
          },
        },
      }));

      const input = {
        articles,
        total_count: 100,
        current_page: 0,
        has_more: false,
      };

      const start = performance.now();
      const result = snakeToCamel(input);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2);
      expect(result.articles).toHaveLength(100);
      expect(result.articles[0]).toHaveProperty("feedId");
      expect(result.articles[0]).toHaveProperty("publishedAt");
      expect(result.articles[0].nestedData).toHaveProperty("userId");
      expect(result).toHaveProperty("totalCount", 100);
      expect(result).toHaveProperty("currentPage", 0);
      expect(result).toHaveProperty("hasMore", false);
    });

    it("should handle API response transformation within performance budget", () => {
      const apiResponse = {
        success: true,
        data: {
          articles: Array.from({ length: 50 }, (_, i) => ({
            id: `article-${i}`,
            feed_id: `feed-${i}`,
            published_at: "2025-01-13T10:00:00Z",
            is_partial_content: i % 3 === 0,
            content_length: 150 + i * 10,
            feed_data: {
              feed_url: `https://example.com/feed-${i}`,
              is_partial: i % 3 === 0,
              update_frequency: 3600,
            },
          })),
          total_count: 1000,
          current_page: 2,
          page_size: 50,
          has_more: true,
        },
        meta: {
          request_time: "2025-01-13T10:00:00Z",
          api_version: "v1",
          rate_limit: {
            remaining_calls: 950,
            reset_time: "2025-01-13T11:00:00Z",
          },
        },
      };

      const start = performance.now();
      const result = transformApiResponse(apiResponse);
      const duration = performance.now() - start;

      // Should complete transformation in under 2ms
      expect(duration).toBeLessThan(2);

      // Verify structure is correct
      expect(result.data.articles).toHaveLength(50);
      expect(result.data).toHaveProperty("totalCount", 1000);
      expect(result.data).toHaveProperty("currentPage", 2);
      expect(result.data).toHaveProperty("pageSize", 50);
      expect(result.data).toHaveProperty("hasMore", true);

      expect(result.meta).toHaveProperty("requestTime");
      expect(result.meta).toHaveProperty("apiVersion");
      expect(result.meta.rateLimit).toHaveProperty("remainingCalls", 950);
      expect(result.meta.rateLimit).toHaveProperty("resetTime");
    });

    it("should maintain performance with deeply nested objects", () => {
      const deeplyNestedObject = {
        level_1: {
          level_2: {
            level_3: {
              level_4: {
                level_5: {
                  deep_field: "value",
                  deep_array: [
                    { nested_item_1: "value1" },
                    { nested_item_2: "value2" },
                  ],
                },
              },
            },
          },
        },
        article_data: Array.from({ length: 20 }, (_, i) => ({
          article_id: `article-${i}`,
          metadata: {
            author_info: {
              author_name: `Author ${i}`,
              author_bio: "Bio text",
              social_links: {
                twitter_handle: `@author${i}`,
                linkedin_url: `https://linkedin.com/author-${i}`,
              },
            },
          },
        })),
      };

      const start = performance.now();
      const result = snakeToCamel(deeplyNestedObject);
      const duration = performance.now() - start;

      // Should handle deep nesting efficiently
      expect(duration).toBeLessThan(5);

      // Verify deep transformation worked
      expect(result.level1.level2.level3.level4.level5).toHaveProperty(
        "deepField"
      );
      expect(
        result.level1.level2.level3.level4.level5.deepArray[0]
      ).toHaveProperty("nestedItem1");
      expect(result.articleData[0].metadata.authorInfo).toHaveProperty(
        "authorName"
      );
      expect(
        result.articleData[0].metadata.authorInfo.socialLinks
      ).toHaveProperty("twitterHandle");
    });
  });

  describe("Memory Efficiency", () => {
    it("should not cause memory leaks with repeated transformations", () => {
      const testObject = {
        articles: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          feed_id: `feed-${i}`,
          published_at: "2025-01-13T10:00:00Z",
          large_content: "x".repeat(1000), // 1KB of content per article
          metadata: {
            author_name: `Author ${i}`,
            tag_list: Array.from({ length: 10 }, (_, j) => `tag-${i}-${j}`),
          },
        })),
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many transformations
      for (let i = 0; i < 100; i++) {
        const transformed = snakeToCamel(testObject);
        // Access properties to ensure they're not optimized away
        expect(transformed.articles[0]).toHaveProperty("feedId");
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it("should handle large arrays without exponential memory growth", () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        [`field_${i}`]: `value_${i}`,
        nested_object: {
          [`nested_field_${i}`]: `nested_value_${i}`,
        },
      }));

      const input = { large_data_set: largeArray };

      const initialMemory = process.memoryUsage().heapUsed;
      const start = performance.now();

      const result = snakeToCamel(input);

      const duration = performance.now() - start;
      const finalMemory = process.memoryUsage().heapUsed;

      // Should complete reasonably quickly even with large data
      expect(duration).toBeLessThan(10);

      // Memory usage should be proportional, not exponential
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      // Verify transformation worked
      expect(result.largeDataSet).toHaveLength(1000);
      expect(result.largeDataSet[0]).toHaveProperty(`field0`, "value_0");
      expect(result.largeDataSet[0].nestedObject).toHaveProperty(
        "nestedField0"
      );
    });
  });

  describe("Mobile Performance Benchmarks", () => {
    it("should meet mobile performance requirements for typical article loads", () => {
      // Simulate typical mobile RSS article load (20 articles)
      const mobileArticleLoad = {
        articles: Array.from({ length: 20 }, (_, i) => ({
          id: `mobile-article-${i}`,
          feed_id: `feed-${i}`,
          published_at: "2025-01-13T10:00:00Z",
          title: `Article Title ${i}`,
          excerpt: "Article excerpt content...",
          is_partial_content: i % 4 === 0,
          content_length: 200 + i * 10,
          image_url: `https://example.com/image-${i}.jpg`,
          author_name: `Author ${i}`,
          tag_list: [`tag1-${i}`, `tag2-${i}`],
          engagement_data: {
            view_count: i * 100,
            like_count: i * 5,
            comment_count: i * 2,
          },
        })),
        pagination: {
          current_page: 0,
          page_size: 20,
          total_count: 500,
          has_more: true,
        },
      };

      // Measure transformation time
      const start = performance.now();
      const result = snakeToCamel(mobileArticleLoad);
      const duration = performance.now() - start;

      // Mobile target: < 1ms for typical loads
      expect(duration).toBeLessThan(1);

      // Verify mobile-optimized structure
      expect(result.articles).toHaveLength(20);
      expect(result.articles[0]).toHaveProperty("feedId");
      expect(result.articles[0]).toHaveProperty("publishedAt");
      expect(result.articles[0]).toHaveProperty("isPartialContent");
      expect(result.articles[0]).toHaveProperty("contentLength");
      expect(result.articles[0]).toHaveProperty("imageUrl");
      expect(result.articles[0]).toHaveProperty("authorName");
      expect(result.articles[0]).toHaveProperty("tagList");
      expect(result.articles[0].engagementData).toHaveProperty("viewCount");
      expect(result.articles[0].engagementData).toHaveProperty("likeCount");
      expect(result.articles[0].engagementData).toHaveProperty("commentCount");

      expect(result.pagination).toHaveProperty("currentPage");
      expect(result.pagination).toHaveProperty("pageSize");
      expect(result.pagination).toHaveProperty("totalCount");
      expect(result.pagination).toHaveProperty("hasMore");
    });

    it("should maintain 60fps during real-time article updates", () => {
      // Simulate real-time article updates (like in auto-fetch scenarios)
      const frameTime = 16.67; // 60fps = 16.67ms per frame

      const articleUpdate = {
        id: "live-article-123",
        feed_id: "live-feed-uuid",
        published_at: "2025-01-13T10:00:00Z",
        content: "x".repeat(5000), // 5KB content
        is_partial_content: false,
        update_timestamp: Date.now(),
        real_time_data: {
          view_count: 1250,
          engagement_rate: 0.05,
          trending_score: 85.5,
        },
      };

      // Measure multiple rapid updates
      const updateTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const transformed = snakeToCamel(articleUpdate);
        const duration = performance.now() - start;
        updateTimes.push(duration);

        // Verify transformation worked
        expect(transformed).toHaveProperty("feedId");
        expect(transformed).toHaveProperty("publishedAt");
        expect(transformed).toHaveProperty("isPartialContent");
        expect(transformed).toHaveProperty("updateTimestamp");
        expect(transformed.realTimeData).toHaveProperty("viewCount");
        expect(transformed.realTimeData).toHaveProperty("engagementRate");
        expect(transformed.realTimeData).toHaveProperty("trendingScore");
      }

      // All updates should complete well within frame budget
      const maxUpdateTime = Math.max(...updateTimes);
      const avgUpdateTime =
        updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;

      expect(maxUpdateTime).toBeLessThan(frameTime / 4); // Use max 25% of frame time
      expect(avgUpdateTime).toBeLessThan(frameTime / 8); // Average should be even better
    });
  });

  describe("Scalability Tests", () => {
    it("should handle enterprise-scale article lists efficiently", () => {
      // Test with large enterprise-style response (500 articles)
      const enterpriseResponse = {
        articles: Array.from({ length: 500 }, (_, i) => ({
          id: `enterprise-article-${i}`,
          feed_id: `enterprise-feed-${Math.floor(i / 10)}`,
          published_at: new Date(2025, 0, 1 + i).toISOString(),
          title: `Enterprise Article ${i}`,
          content_preview: `Preview content for article ${i}...`,
          is_partial_content: i % 5 === 0,
          content_length: 300 + i * 15,
          category_tags: [`category-${i % 20}`, `subcategory-${i % 10}`],
          author_details: {
            author_id: `author-${i % 50}`,
            author_name: `Enterprise Author ${i % 50}`,
            author_bio: "Professional author bio...",
            publication_count: (i % 50) * 10,
          },
          analytics: {
            view_count: i * 25,
            engagement_score: (i % 100) / 100,
            trending_rank: i % 100,
          },
        })),
        metadata: {
          total_count: 50000,
          current_page: Math.floor(Math.random() * 100),
          page_size: 500,
          has_more: true,
          query_performance: {
            db_query_time: 45,
            cache_hit_rate: 0.85,
            total_response_time: 120,
          },
        },
      };

      const start = performance.now();
      const result = snakeToCamel(enterpriseResponse);
      const duration = performance.now() - start;

      // Should handle enterprise scale within acceptable limits
      expect(duration).toBeLessThan(20); // 20ms for 500 articles

      // Verify structure integrity
      expect(result.articles).toHaveLength(500);
      expect(result.articles[0]).toHaveProperty("feedId");
      expect(result.articles[0]).toHaveProperty("publishedAt");
      expect(result.articles[0]).toHaveProperty("isPartialContent");
      expect(result.articles[0]).toHaveProperty("contentLength");
      expect(result.articles[0]).toHaveProperty("categoryTags");
      expect(result.articles[0].authorDetails).toHaveProperty("authorId");
      expect(result.articles[0].authorDetails).toHaveProperty("authorName");
      expect(result.articles[0].authorDetails).toHaveProperty(
        "publicationCount"
      );
      expect(result.articles[0].analytics).toHaveProperty("viewCount");
      expect(result.articles[0].analytics).toHaveProperty("engagementScore");
      expect(result.articles[0].analytics).toHaveProperty("trendingRank");

      expect(result.metadata).toHaveProperty("totalCount");
      expect(result.metadata).toHaveProperty("currentPage");
      expect(result.metadata).toHaveProperty("pageSize");
      expect(result.metadata).toHaveProperty("hasMore");
      expect(result.metadata.queryPerformance).toHaveProperty("dbQueryTime");
      expect(result.metadata.queryPerformance).toHaveProperty("cacheHitRate");
      expect(result.metadata.queryPerformance).toHaveProperty(
        "totalResponseTime"
      );
    });
  });
});
