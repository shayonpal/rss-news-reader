/**
 * Real database setup for RR-274 integration tests
 * Uses actual Supabase connection with test data seeding
 */

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TestUser {
  id: string;
  email: string;
  inoreader_id: string;
}

export interface TestFeed {
  id: string;
  user_id: string;
  inoreader_id: string;
  title: string;
  url: string;
}

export interface TestArticle {
  id: string;
  feed_id: string;
  inoreader_id: string;
  title: string;
  content: string;
  is_read: boolean;
  is_starred: boolean;
  published_at: string;
}

/**
 * Database test helper class for real integration testing
 */
export class DatabaseTestHelper {
  private supabase: SupabaseClient;
  private testUserIds: string[] = [];
  private testFeedIds: string[] = [];
  private testArticleIds: string[] = [];

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a test user
   */
  async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const testUser: TestUser = {
      id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email: `test-${Date.now()}@example.com`,
      inoreader_id: `test-inoreader-${Date.now()}`,
      ...overrides,
    };

    const { data, error } = await this.supabase
      .from("users")
      .insert(testUser)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    this.testUserIds.push(testUser.id);
    return data;
  }

  /**
   * Create test feeds for a user
   */
  async createTestFeeds(
    userId: string,
    count: number = 2
  ): Promise<TestFeed[]> {
    const feeds: TestFeed[] = Array.from({ length: count }, (_, i) => ({
      id: `test-feed-${Date.now()}-${i}`,
      user_id: userId,
      inoreader_id: `feed/${Date.now()}/feed-${i}`,
      title: `Test Feed ${i + 1}`,
      url: `https://example.com/feed-${i}.rss`,
    }));

    const { data, error } = await this.supabase
      .from("feeds")
      .insert(feeds)
      .select();

    if (error) {
      throw new Error(`Failed to create test feeds: ${error.message}`);
    }

    this.testFeedIds.push(...feeds.map((f) => f.id));
    return data;
  }

  /**
   * Create test articles for feeds
   */
  async createTestArticles(
    feedIds: string[],
    articlesPerFeed: number,
    options: {
      readPercentage?: number;
      starredPercentage?: number;
      daySpread?: number;
    } = {}
  ): Promise<TestArticle[]> {
    const {
      readPercentage = 0.3,
      starredPercentage = 0.05,
      daySpread = 30,
    } = options;

    const articles: TestArticle[] = [];
    let articleCounter = 0;

    for (const feedId of feedIds) {
      for (let i = 0; i < articlesPerFeed; i++) {
        const daysAgo = Math.floor(Math.random() * daySpread);
        const publishedDate = new Date(
          Date.now() - daysAgo * 24 * 60 * 60 * 1000
        );

        const article: TestArticle = {
          id: `test-article-${Date.now()}-${articleCounter++}`,
          feed_id: feedId,
          inoreader_id: `tag:google.com,2005:reader/item/${articleCounter}`,
          title: `Test Article ${articleCounter}`,
          content: `Test content for article ${articleCounter}`,
          is_read: Math.random() < readPercentage,
          is_starred: Math.random() < starredPercentage,
          published_at: publishedDate.toISOString(),
        };

        articles.push(article);
      }
    }

    const { data, error } = await this.supabase
      .from("articles")
      .insert(articles)
      .select();

    if (error) {
      throw new Error(`Failed to create test articles: ${error.message}`);
    }

    this.testArticleIds.push(...articles.map((a) => a.id));
    return data;
  }

  /**
   * Create articles with specific read/starred states
   */
  async createSpecificArticles(
    feedId: string,
    specs: Array<{
      count: number;
      is_read: boolean;
      is_starred: boolean;
      daysAgo?: number;
    }>
  ): Promise<TestArticle[]> {
    const articles: TestArticle[] = [];
    let articleCounter = 0;

    for (const spec of specs) {
      for (let i = 0; i < spec.count; i++) {
        const publishedDate = new Date(
          Date.now() -
            (spec.daysAgo || 1) * 24 * 60 * 60 * 1000 -
            i * 60 * 60 * 1000
        );

        const article: TestArticle = {
          id: `test-specific-${Date.now()}-${articleCounter++}`,
          feed_id: feedId,
          inoreader_id: `tag:google.com,2005:reader/item/specific-${articleCounter}`,
          title: `Specific Test Article ${articleCounter}`,
          content: `Specific content ${articleCounter}`,
          is_read: spec.is_read,
          is_starred: spec.is_starred,
          published_at: publishedDate.toISOString(),
        };

        articles.push(article);
      }
    }

    const { data, error } = await this.supabase
      .from("articles")
      .insert(articles)
      .select();

    if (error) {
      throw new Error(`Failed to create specific articles: ${error.message}`);
    }

    this.testArticleIds.push(...articles.map((a) => a.id));
    return data;
  }

  /**
   * Get real statistics for a user (what the API should return)
   */
  async getExpectedStats(
    userId: string
  ): Promise<{ total: number; unread: number; starred: number }> {
    // Get user's feed IDs
    const { data: userFeeds } = await this.supabase
      .from("feeds")
      .select("id")
      .eq("user_id", userId);

    const feedIds = userFeeds?.map((f) => f.id) || [];

    if (feedIds.length === 0) {
      return { total: 0, unread: 0, starred: 0 };
    }

    // Get counts
    const [totalResult, unreadResult, starredResult] = await Promise.all([
      this.supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .in("feed_id", feedIds),
      this.supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .in("feed_id", feedIds)
        .eq("is_read", false),
      this.supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .in("feed_id", feedIds)
        .eq("is_starred", true),
    ]);

    return {
      total: totalResult.count || 0,
      unread: unreadResult.count || 0,
      starred: starredResult.count || 0,
    };
  }

  /**
   * Clean up all test data created by this helper
   */
  async cleanup(): Promise<void> {
    try {
      // Delete in reverse order due to foreign key constraints
      if (this.testArticleIds.length > 0) {
        await this.supabase
          .from("articles")
          .delete()
          .in("id", this.testArticleIds);
      }

      if (this.testFeedIds.length > 0) {
        await this.supabase.from("feeds").delete().in("id", this.testFeedIds);
      }

      if (this.testUserIds.length > 0) {
        await this.supabase.from("users").delete().in("id", this.testUserIds);
      }

      // Clear tracking arrays
      this.testArticleIds = [];
      this.testFeedIds = [];
      this.testUserIds = [];
    } catch (error) {
      console.warn("Test cleanup failed:", error);
      // Don't throw - cleanup failures shouldn't fail tests
    }
  }

  /**
   * Create a complete test scenario with user, feeds, and articles
   */
  async setupCompleteScenario(
    specs: {
      feedCount?: number;
      articlesPerFeed?: number;
      readPercentage?: number;
      starredPercentage?: number;
    } = {}
  ): Promise<{
    user: TestUser;
    feeds: TestFeed[];
    articles: TestArticle[];
    expectedStats: { total: number; unread: number; starred: number };
  }> {
    const {
      feedCount = 3,
      articlesPerFeed = 100,
      readPercentage = 0.4,
      starredPercentage = 0.06,
    } = specs;

    const user = await this.createTestUser();
    const feeds = await this.createTestFeeds(user.id, feedCount);
    const articles = await this.createTestArticles(
      feeds.map((f) => f.id),
      articlesPerFeed,
      { readPercentage, starredPercentage }
    );
    const expectedStats = await this.getExpectedStats(user.id);

    return { user, feeds, articles, expectedStats };
  }
}

/**
 * Global test helper instance - use this in tests
 */
export const dbHelper = new DatabaseTestHelper();
