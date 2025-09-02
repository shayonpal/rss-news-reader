/**
 * RR-27: Test Consolidation - Test Data Fixtures
 *
 * Factory functions for creating test data and managing test state
 */

import { ArticleFixture, FilterState, ViewportConfig } from "./types";

export class TestDataFactory {
  /**
   * Create deterministic article fixtures for testing
   */
  static createArticleFixtures(
    count: number,
    options: Partial<ArticleFixture> = {}
  ): ArticleFixture[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `article_${String(i + 1).padStart(3, "0")}`,
      title:
        options.title ||
        `Test Article ${i + 1} - RSS Reader State Preservation`,
      summary:
        options.summary ||
        `This is a test summary for article ${i + 1}. Contains sample content for testing state preservation scenarios.`,
      feedId: options.feedId || `feed_${String((i % 3) + 1).padStart(3, "0")}`,
      isRead: options.isRead ?? i % 2 === 0,
      isStarred: options.isStarred ?? i % 5 === 0,
      publishedAt:
        options.publishedAt || new Date(Date.now() - i * 3600000).toISOString(),
    }));
  }

  /**
   * Create feed fixtures for testing different feed scenarios
   */
  static createFeedFixtures() {
    return [
      {
        id: "feed_001",
        title: "Tech News RSS",
        url: "https://example.com/tech/rss",
        category: "technology",
        articleCount: 25,
      },
      {
        id: "feed_002",
        title: "World News Feed",
        url: "https://example.com/world/rss",
        category: "world",
        articleCount: 30,
      },
      {
        id: "feed_003",
        title: "Canada India News",
        url: "https://example.com/canada-india/rss",
        category: "india-canada",
        articleCount: 15,
      },
    ];
  }

  /**
   * Generate all possible filter state permutations for comprehensive testing
   */
  static createFilterPermutations(): FilterState[] {
    const feeds = ["all", "feed_001", "feed_002", "feed_003"];
    const readFilters: ("all" | "unread" | "read")[] = [
      "all",
      "unread",
      "read",
    ];
    const sortOrders: ("newest" | "oldest")[] = ["newest", "oldest"];
    const categories = ["all", "technology", "world", "india-canada"];

    const permutations: FilterState[] = [];

    for (const feedId of feeds) {
      for (const readFilter of readFilters) {
        for (const sortOrder of sortOrders) {
          for (const category of categories) {
            permutations.push({
              feedId: feedId === "all" ? undefined : feedId,
              category: category === "all" ? undefined : category,
              readFilter,
              sortOrder,
              searchQuery: undefined,
            });
          }
        }
      }
    }

    return permutations;
  }

  /**
   * Create mobile viewport configurations
   */
  static createViewportConfigs(): Record<string, ViewportConfig> {
    return {
      "iphone-se": {
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        isMobile: true,
      },
      "iphone-12": {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        isMobile: true,
      },
      "iphone-12-pro-max": {
        width: 428,
        height: 926,
        deviceScaleFactor: 3,
        isMobile: true,
      },
      ipad: {
        width: 768,
        height: 1024,
        deviceScaleFactor: 2,
        isMobile: false,
      },
      "ipad-pro": {
        width: 1024,
        height: 1366,
        deviceScaleFactor: 2,
        isMobile: false,
      },
      desktop: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        isMobile: false,
      },
    };
  }

  /**
   * Create session storage test data
   */
  static createSessionStorageStates() {
    return {
      fresh: {},
      withState: {
        articleListState: JSON.stringify({
          articleIds: ["article_001", "article_002", "article_003"],
          readStates: {
            article_001: true,
            article_002: false,
            article_003: true,
          },
          autoReadArticles: ["article_001"],
          manualReadArticles: ["article_003"],
          scrollPosition: 500,
          timestamp: Date.now(),
          filterMode: "unread",
        }),
      },
      expired: {
        articleListState: JSON.stringify({
          articleIds: ["article_001"],
          readStates: { article_001: true },
          autoReadArticles: ["article_001"],
          manualReadArticles: [],
          scrollPosition: 0,
          timestamp: Date.now() - 35 * 60 * 1000, // 35 minutes ago (expired)
          filterMode: "all",
        }),
      },
      corrupted: {
        articleListState: "invalid{json}data",
      },
      quotaFilled: (() => {
        const state: Record<string, string> = {};
        // Fill with dummy data to approach quota limit
        for (let i = 0; i < 100; i++) {
          state[`filler_${i}`] = "x".repeat(10000); // 10KB per entry
        }
        return state;
      })(),
    };
  }

  /**
   * Create test scenarios for different article states
   */
  static createArticleStateScenarios() {
    return {
      unreadOnly: this.createArticleFixtures(10, { isRead: false }),
      readOnly: this.createArticleFixtures(10, { isRead: true }),
      mixed: [
        ...this.createArticleFixtures(5, { isRead: false }),
        ...this.createArticleFixtures(5, { isRead: true }),
      ],
      starredOnly: this.createArticleFixtures(10, { isStarred: true }),
      largeDataset: this.createArticleFixtures(500),
      multipleFeeds: [
        ...this.createArticleFixtures(10, { feedId: "feed_001" }),
        ...this.createArticleFixtures(8, { feedId: "feed_002" }),
        ...this.createArticleFixtures(6, { feedId: "feed_003" }),
      ],
    };
  }

  /**
   * Generate performance test data with controlled characteristics
   */
  static createPerformanceTestData(articleCount: number) {
    return {
      articles: this.createArticleFixtures(articleCount),
      expectedMetrics: {
        maxLoadTime: Math.max(3000, articleCount * 2), // 2ms per article baseline
        maxScrollTime: 3000,
        maxStateTime: Math.max(500, articleCount * 0.5), // 0.5ms per article
        maxMemoryUsage: Math.max(50, articleCount * 0.1) * 1024 * 1024, // MB to bytes
      },
    };
  }

  /**
   * Create edge case test data
   */
  static createEdgeCaseData() {
    return {
      emptyArticleList: [],
      singleArticle: this.createArticleFixtures(1),
      duplicateIds: [
        ...this.createArticleFixtures(3, { id: "duplicate_001" }),
        ...this.createArticleFixtures(2, { id: "duplicate_002" }),
      ],
      longTitles: this.createArticleFixtures(5, {
        title:
          "Very Long Article Title That Might Cause Issues With UI Layout And State Management Systems When Processing And Storing Article Information",
      }),
      specialCharacters: this.createArticleFixtures(3, {
        title: 'Article with "quotes", <tags>, & special chars: åéîøü',
        summary: "Content with\nnewlines\tand\ttabs and émojis 🚀",
      }),
      extremeDates: [
        ...this.createArticleFixtures(2, {
          publishedAt: new Date("1970-01-01").toISOString(),
        }),
        ...this.createArticleFixtures(2, {
          publishedAt: new Date("2099-12-31").toISOString(),
        }),
      ],
    };
  }

  /**
   * Helper to create deterministic test IDs for consistent testing
   */
  static generateTestId(
    prefix: string,
    index: number,
    suffix?: string
  ): string {
    const paddedIndex = String(index).padStart(3, "0");
    return suffix
      ? `${prefix}_${paddedIndex}_${suffix}`
      : `${prefix}_${paddedIndex}`;
  }

  /**
   * Create scroll position test cases
   */
  static createScrollTestCases() {
    return [
      { position: 0, description: "top of page" },
      { position: 500, description: "middle of first screen" },
      { position: 1000, description: "second screen" },
      { position: 2000, description: "deep scroll position" },
      { position: 5000, description: "very deep scroll" },
    ];
  }

  /**
   * Create timing test data for performance validation
   */
  static createTimingTestData() {
    return {
      delays: {
        short: 100, // Quick user interaction
        medium: 500, // Moderate pause
        long: 2000, // Auto-read trigger time
        veryLong: 5000, // Network timeout simulation
      },
      timeouts: {
        element: 10000, // Wait for element to appear
        navigation: 15000, // Page navigation timeout
        network: 30000, // Network request timeout
      },
    };
  }
}
