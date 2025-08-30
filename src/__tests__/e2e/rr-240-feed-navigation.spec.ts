/**
 * @file E2E tests for RR-240 feed-filtered navigation with preserved articles
 * @issue RR-240 Fix feed-filtered views regression in article state preservation
 *
 * Test Requirements:
 * - Feed-filtered views preserve read articles on back navigation
 * - Cross-feed contamination is prevented
 * - All filter types behave consistently
 * - Performance remains under 50ms query time
 */

import { test, expect, Page } from "@playwright/test";
import {
  createE2EHelpers,
  TestUser,
  TestFeed,
  TestArticle,
} from "../helpers/e2e-helpers";

// Test data setup
const TEST_FEEDS = {
  techFeed: {
    id: "feed-tech-001",
    title: "Tech News Daily",
    url: "https://tech.example.com/rss",
    isPartialContent: false,
  },
  businessFeed: {
    id: "feed-business-001",
    title: "Business Weekly",
    url: "https://business.example.com/rss",
    isPartialContent: false,
  },
  sportsFeed: {
    id: "feed-sports-001",
    title: "Sports Update",
    url: "https://sports.example.com/rss",
    isPartialContent: false,
  },
};

const TEST_ARTICLES = {
  techArticles: [
    {
      id: "tech-1",
      title: "AI Breakthrough",
      feedId: "feed-tech-001",
      isRead: false,
    },
    {
      id: "tech-2",
      title: "Quantum Computing",
      feedId: "feed-tech-001",
      isRead: false,
    },
    {
      id: "tech-3",
      title: "Robotics Update",
      feedId: "feed-tech-001",
      isRead: false,
    },
  ],
  businessArticles: [
    {
      id: "biz-1",
      title: "Market Analysis",
      feedId: "feed-business-001",
      isRead: false,
    },
    {
      id: "biz-2",
      title: "Startup Funding",
      feedId: "feed-business-001",
      isRead: false,
    },
    {
      id: "biz-3",
      title: "IPO News",
      feedId: "feed-business-001",
      isRead: false,
    },
  ],
  sportsArticles: [
    {
      id: "sport-1",
      title: "Championship Final",
      feedId: "feed-sports-001",
      isRead: false,
    },
    {
      id: "sport-2",
      title: "Transfer News",
      feedId: "feed-sports-001",
      isRead: false,
    },
    {
      id: "sport-3",
      title: "Match Preview",
      feedId: "feed-sports-001",
      isRead: false,
    },
  ],
};

test.describe("RR-240: Feed-Filtered Navigation with Preserved Articles", () => {
  let helpers: ReturnType<typeof createE2EHelpers>;

  test.beforeEach(async ({ page, context }) => {
    helpers = createE2EHelpers(page, context);

    // Setup test environment
    await helpers.setupTestUser();
    await helpers.setupTestFeeds(Object.values(TEST_FEEDS));
    await helpers.setupTestArticles([
      ...TEST_ARTICLES.techArticles,
      ...TEST_ARTICLES.businessArticles,
      ...TEST_ARTICLES.sportsArticles,
    ]);

    // Navigate to app
    await page.goto("/reader");
    await helpers.waitForAppReady();
  });

  test.afterEach(async () => {
    await helpers.cleanup();
  });

  test.describe("Feed-Specific Article Preservation", () => {
    test("preserves read articles in feed-filtered view on back navigation", async ({
      page,
    }) => {
      // Navigate to Tech News feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await helpers.waitForArticlesToLoad();

      // Verify initial state - all tech articles unread
      const techArticlesBefore = await page.$$(
        '[data-testid^="article-card-tech-"]'
      );
      expect(techArticlesBefore).toHaveLength(3);

      // Read first tech article
      await page.click('[data-testid="article-card-tech-1"]');
      await helpers.waitForArticleDetail();

      // Verify article is marked as read
      await expect(
        page.locator('[data-testid="article-read-indicator"]')
      ).toBeVisible();

      // Navigate back to feed list
      await page.click('[data-testid="back-button"]');
      await helpers.waitForArticlesToLoad();

      // Verify read article is preserved in feed view
      const readArticle = await page.locator(
        '[data-testid="article-card-tech-1"][data-read="true"]'
      );
      await expect(readArticle).toBeVisible();

      // Verify other articles remain unread
      const unreadArticles = await page.$$(
        '[data-testid^="article-card-tech-"][data-read="false"]'
      );
      expect(unreadArticles).toHaveLength(2);
    });

    test("prevents cross-feed contamination of preserved articles", async ({
      page,
    }) => {
      // Mark article as read in Tech feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await helpers.waitForArticlesToLoad();

      await page.click('[data-testid="article-card-tech-1"]');
      await helpers.waitForArticleDetail();
      await page.click('[data-testid="back-button"]');

      // Switch to Business feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(
        `[data-testid="feed-option-${TEST_FEEDS.businessFeed.id}"]`
      );
      await helpers.waitForArticlesToLoad();

      // Verify no tech articles appear in business feed
      const techArticlesInBusinessFeed = await page.$$(
        '[data-testid^="article-card-tech-"]'
      );
      expect(techArticlesInBusinessFeed).toHaveLength(0);

      // Verify only business articles are shown
      const businessArticles = await page.$$(
        '[data-testid^="article-card-biz-"]'
      );
      expect(businessArticles).toHaveLength(3);

      // All should be unread (no preserved tech article)
      const readArticles = await page.$$(
        '[data-testid^="article-card-"][data-read="true"]'
      );
      expect(readArticles).toHaveLength(0);
    });

    test('includes all preserved articles in "All Articles" view', async ({
      page,
    }) => {
      // Mark articles as read in different feeds
      // Tech feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await helpers.markArticleAsRead("tech-1");

      // Business feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(
        `[data-testid="feed-option-${TEST_FEEDS.businessFeed.id}"]`
      );
      await helpers.markArticleAsRead("biz-1");

      // Sports feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(
        `[data-testid="feed-option-${TEST_FEEDS.sportsFeed.id}"]`
      );
      await helpers.markArticleAsRead("sport-1");

      // Navigate to All Articles
      await page.click('[data-testid="feed-filter-button"]');
      await page.click('[data-testid="feed-option-all"]');
      await helpers.waitForArticlesToLoad();

      // Verify all preserved articles are visible
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-biz-1"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-sport-1"][data-read="true"]')
      ).toBeVisible();

      // Verify total count
      const allArticles = await page.$$('[data-testid^="article-card-"]');
      expect(allArticles).toHaveLength(9); // All 9 articles visible
    });
  });

  test.describe("Navigation Flow Consistency", () => {
    test("maintains preserved articles through multiple navigation cycles", async ({
      page,
    }) => {
      // Setup: Mark articles in tech feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);

      // First navigation cycle
      await helpers.markArticleAsRead("tech-1");
      await page.click('[data-testid="article-card-tech-2"]');
      await helpers.waitForArticleDetail();
      await page.click('[data-testid="back-button"]');

      // Verify both preserved
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-tech-2"][data-read="true"]')
      ).toBeVisible();

      // Second navigation cycle
      await page.click('[data-testid="article-card-tech-3"]');
      await helpers.waitForArticleDetail();
      await page.click('[data-testid="back-button"]');

      // All three should be preserved
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-tech-2"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-tech-3"][data-read="true"]')
      ).toBeVisible();
    });

    test("handles rapid feed switching without losing preserved articles", async ({
      page,
    }) => {
      // Mark articles in multiple feeds
      const feedSequence = [
        { feed: TEST_FEEDS.techFeed, article: "tech-1" },
        { feed: TEST_FEEDS.businessFeed, article: "biz-1" },
        { feed: TEST_FEEDS.sportsFeed, article: "sport-1" },
      ];

      for (const { feed, article } of feedSequence) {
        await page.click('[data-testid="feed-filter-button"]');
        await page.click(`[data-testid="feed-option-${feed.id}"]`);
        await helpers.markArticleAsRead(article);
      }

      // Rapidly switch between feeds
      for (let i = 0; i < 3; i++) {
        for (const { feed, article } of feedSequence) {
          await page.click('[data-testid="feed-filter-button"]');
          await page.click(`[data-testid="feed-option-${feed.id}"]`);
          await helpers.waitForArticlesToLoad();

          // Verify preserved article is still visible
          await expect(
            page.locator(
              `[data-testid="article-card-${article}"][data-read="true"]`
            )
          ).toBeVisible();
        }
      }
    });

    test("preserves articles correctly with browser back/forward navigation", async ({
      page,
    }) => {
      // Navigate to tech feed and mark article as read
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await helpers.markArticleAsRead("tech-1");

      // Navigate to article detail
      await page.click('[data-testid="article-card-tech-2"]');
      await helpers.waitForArticleDetail();

      // Use browser back button
      await page.goBack();
      await helpers.waitForArticlesToLoad();

      // Verify preserved articles
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-tech-2"][data-read="true"]')
      ).toBeVisible();

      // Use browser forward button
      await page.goForward();
      await helpers.waitForArticleDetail();

      // Go back again
      await page.goBack();
      await helpers.waitForArticlesToLoad();

      // Articles should still be preserved
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-tech-2"][data-read="true"]')
      ).toBeVisible();
    });
  });

  test.describe("Filter Combinations", () => {
    test("applies read status filter with feed-specific preserved articles", async ({
      page,
    }) => {
      // Mark articles as read in tech feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await helpers.markArticleAsRead("tech-1");
      await helpers.markArticleAsRead("tech-2");

      // Apply "Unread" filter
      await page.click('[data-testid="read-status-filter"]');
      await page.click('[data-testid="filter-option-unread"]');
      await helpers.waitForArticlesToLoad();

      // Should show unread tech-3 and preserved tech-1, tech-2
      const visibleArticles = await page.$$(
        '[data-testid^="article-card-tech-"]'
      );
      expect(visibleArticles).toHaveLength(3);

      // Apply "Read" filter
      await page.click('[data-testid="read-status-filter"]');
      await page.click('[data-testid="filter-option-read"]');
      await helpers.waitForArticlesToLoad();

      // Should show only preserved read articles
      const readArticles = await page.$$(
        '[data-testid^="article-card-tech-"][data-read="true"]'
      );
      expect(readArticles).toHaveLength(2);
    });

    test("combines topic filter with feed filter and preserved articles", async ({
      page,
    }) => {
      // Setup: Add topic tags to articles
      await helpers.addTopicToArticle("tech-1", "AI");
      await helpers.addTopicToArticle("tech-2", "Hardware");
      await helpers.addTopicToArticle("biz-1", "AI"); // Cross-feed same topic

      // Mark tech-1 as read in tech feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await helpers.markArticleAsRead("tech-1");

      // Apply AI topic filter
      await page.click('[data-testid="topic-filter-button"]');
      await page.click('[data-testid="topic-option-AI"]');
      await helpers.waitForArticlesToLoad();

      // Should show only tech-1 (preserved, with AI topic, in tech feed)
      const visibleArticles = await page.$$('[data-testid^="article-card-"]');
      expect(visibleArticles).toHaveLength(1);
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();

      // biz-1 should NOT appear (different feed)
      const bizArticle = await page.$$('[data-testid="article-card-biz-1"]');
      expect(bizArticle).toHaveLength(0);
    });
  });

  test.describe("Performance Requirements", () => {
    test("maintains query performance under 50ms with preserved articles", async ({
      page,
    }) => {
      // Mark multiple articles as read
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);

      // Mark all tech articles as read
      for (const article of TEST_ARTICLES.techArticles) {
        await helpers.markArticleAsRead(article.id);
      }

      // Measure query performance
      const startTime = Date.now();

      // Trigger reload with preserved articles
      await page.click('[data-testid="refresh-button"]');
      await helpers.waitForArticlesToLoad();

      const loadTime = Date.now() - startTime;

      // Verify performance requirement
      expect(loadTime).toBeLessThan(50);

      // Verify all preserved articles loaded
      const preservedArticles = await page.$$(
        '[data-testid^="article-card-tech-"][data-read="true"]'
      );
      expect(preservedArticles).toHaveLength(3);
    });

    test("handles maximum preserved articles limit efficiently", async ({
      page,
    }) => {
      // Create scenario with many preserved articles (up to limit of 50)
      const manyArticles = Array.from({ length: 50 }, (_, i) => ({
        id: `bulk-${i}`,
        title: `Bulk Article ${i}`,
        feedId: TEST_FEEDS.techFeed.id,
        isRead: false,
      }));

      await helpers.setupTestArticles(manyArticles);

      // Navigate to tech feed
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);

      // Mark 50 articles as read (hitting the limit)
      for (let i = 0; i < 50; i++) {
        await helpers.markArticleAsReadQuick(`bulk-${i}`); // Quick mark without navigation
      }

      // Navigate to article detail and back
      await page.click('[data-testid="article-card-tech-1"]');
      await helpers.waitForArticleDetail();
      await page.click('[data-testid="back-button"]');
      await helpers.waitForArticlesToLoad();

      // Verify oldest preserved article was dropped (FIFO)
      const oldestArticle = await page.$$(
        '[data-testid="article-card-bulk-0"][data-read="true"]'
      );
      expect(oldestArticle).toHaveLength(0);

      // Verify newest preserved articles are kept
      await expect(
        page.locator('[data-testid="article-card-bulk-49"][data-read="true"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();
    });
  });

  test.describe("Edge Cases and Error Handling", () => {
    test("handles corrupt sessionStorage data gracefully", async ({
      page,
      context,
    }) => {
      // Corrupt sessionStorage
      await context.addInitScript(() => {
        window.sessionStorage.setItem("preservedArticles", '{"invalid json}');
      });

      // Navigate to feed
      await page.goto("/reader");
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await helpers.waitForArticlesToLoad();

      // Should load without errors
      const articles = await page.$$('[data-testid^="article-card-"]');
      expect(articles.length).toBeGreaterThan(0);

      // Should be able to mark articles as read despite corruption
      await helpers.markArticleAsRead("tech-1");
      await expect(
        page.locator('[data-testid="article-card-tech-1"][data-read="true"]')
      ).toBeVisible();
    });

    test("handles sessionStorage quota exceeded", async ({ page, context }) => {
      // Fill sessionStorage near quota
      await context.addInitScript(() => {
        const largeData = "x".repeat(4 * 1024 * 1024); // 4MB of data
        try {
          window.sessionStorage.setItem("bloat", largeData);
        } catch (e) {
          // Quota might already be exceeded in test environment
        }
      });

      // Try to preserve articles
      await page.goto("/reader");
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);

      // Mark article as read
      await helpers.markArticleAsRead("tech-1");

      // Navigate away and back
      await page.click('[data-testid="article-card-tech-2"]');
      await helpers.waitForArticleDetail();
      await page.click('[data-testid="back-button"]');

      // App should handle gracefully (article might not be preserved but shouldn't crash)
      await helpers.waitForArticlesToLoad();
      const articles = await page.$$('[data-testid^="article-card-"]');
      expect(articles.length).toBeGreaterThan(0);
    });

    test("handles missing feedId in article data", async ({ page }) => {
      // Create article without feedId
      const orphanArticle = {
        id: "orphan-1",
        title: "Orphan Article",
        feedId: null, // Missing feedId
        isRead: false,
      };

      await helpers.setupTestArticles([orphanArticle]);

      // Navigate to All Articles
      await page.goto("/reader");
      await helpers.waitForArticlesToLoad();

      // Mark orphan article as read
      await helpers.markArticleAsRead("orphan-1");

      // Navigate away and back
      await page.click('[data-testid="feed-filter-button"]');
      await page.click(`[data-testid="feed-option-${TEST_FEEDS.techFeed.id}"]`);
      await page.click('[data-testid="feed-filter-button"]');
      await page.click('[data-testid="feed-option-all"]');

      // Orphan article should still be preserved in All Articles view
      await expect(
        page.locator('[data-testid="article-card-orphan-1"][data-read="true"]')
      ).toBeVisible();
    });
  });
});

// Helper function extensions for E2E testing
declare module "../helpers/e2e-helpers" {
  interface E2EHelpers {
    markArticleAsRead(articleId: string): Promise<void>;
    markArticleAsReadQuick(articleId: string): Promise<void>;
    addTopicToArticle(articleId: string, topic: string): Promise<void>;
    waitForArticlesToLoad(): Promise<void>;
    waitForArticleDetail(): Promise<void>;
    waitForAppReady(): Promise<void>;
  }
}
