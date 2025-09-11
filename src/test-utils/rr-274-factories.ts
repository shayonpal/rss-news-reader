/**
 * Test data factories for RR-274 sync configuration tests
 */

export interface TestArticle {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  isStarred: boolean;
  publishedAt: string;
  feedId: string;
  userId?: string;
}

/**
 * Create a single test article with optional overrides
 */
export const createTestArticle = (
  overrides: Partial<TestArticle> = {}
): TestArticle => ({
  id: `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  title: "Test Article",
  content: "Test content for article",
  isRead: false,
  isStarred: false,
  publishedAt: new Date().toISOString(),
  feedId: "feed_001",
  ...overrides,
});

/**
 * Create a batch of test articles
 */
export const createArticleBatch = (
  count: number,
  overrides: Partial<TestArticle> = {}
): TestArticle[] => {
  return Array.from({ length: count }, (_, i) =>
    createTestArticle({
      id: `article_${i}`,
      publishedAt: new Date(Date.now() - i * 86400000).toISOString(), // Each article 1 day older
      ...overrides,
    })
  );
};

/**
 * Create a mixed set of articles with different states
 */
export const createMixedArticles = () => ({
  starred: createArticleBatch(100, { isStarred: true, isRead: true }),
  unread: createArticleBatch(200, { isRead: false, isStarred: false }),
  read: createArticleBatch(300, { isRead: true, isStarred: false }),
  old: createArticleBatch(400, {
    isRead: true,
    isStarred: false,
    publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(), // 30 days old
  }),
});

/**
 * Create test user preferences
 */
export const createTestPreferences = (overrides: any = {}) => ({
  sync: {
    maxArticles: 100,
    retentionCount: 2000,
    ...overrides.sync,
  },
  ai: {
    enabled: false,
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    maxTokens: 150,
    ...overrides.ai,
  },
  ui: {
    theme: "dark",
    ...overrides.ui,
  },
});

/**
 * Create test feed data
 */
export const createTestFeed = (overrides: any = {}) => ({
  id: `feed_${Date.now()}_${Math.random()}`,
  title: "Test Feed",
  url: "https://example.com/feed.rss",
  iconUrl: "https://example.com/icon.png",
  categories: [],
  ...overrides,
});

/**
 * Create test statistics data
 */
export const createTestStats = (overrides: any = {}) => ({
  total: 1234,
  unread: 456,
  starred: 78,
  feeds: 12,
  lastSync: new Date().toISOString(),
  ...overrides,
});

/**
 * Create Inoreader API response mock
 */
export const createInoreaderResponse = (articles: number = 50) => ({
  items: Array.from({ length: articles }, (_, i) => ({
    id: `tag:google.com,2005:reader/item/${i}`,
    title: `Article ${i}`,
    summary: { content: `Content for article ${i}` },
    alternate: [{ href: `https://example.com/article-${i}` }],
    origin: {
      streamId: "feed/https://example.com/feed.rss",
      title: "Example Feed",
    },
    published: Date.now() / 1000 - i * 3600, // Unix timestamp
    categories: [{ id: "user/-/state/com.google/reading-list" }],
  })),
  continuation: articles >= 50 ? `continuation_token_${Date.now()}` : undefined,
});

/**
 * Create test sync result
 */
export const createTestSyncResult = (overrides: any = {}) => ({
  articlesAdded: 0,
  articlesUpdated: 0,
  articlesDeleted: 0,
  feedsProcessed: 0,
  error: null,
  retentionError: null,
  duration: 0,
  ...overrides,
});

/**
 * Create test database error
 */
export const createDatabaseError = (
  code: string = "PGRST116",
  message: string = "Not found"
) => ({
  code,
  message,
  details: null,
  hint: null,
});

/**
 * Generate articles at specific time intervals
 */
export const createTimeBasedArticles = (
  intervals: { count: number; daysAgo: number }[]
) => {
  const articles: TestArticle[] = [];
  let idCounter = 0;

  intervals.forEach(({ count, daysAgo }) => {
    const baseTime = Date.now() - daysAgo * 86400000;
    for (let i = 0; i < count; i++) {
      articles.push(
        createTestArticle({
          id: `article_${idCounter++}`,
          publishedAt: new Date(baseTime - i * 3600000).toISOString(), // Each article 1 hour apart
        })
      );
    }
  });

  return articles;
};

/**
 * Create articles with specific read/starred combinations
 */
export const createArticleMatrix = () => ({
  readStarred: createArticleBatch(50, { isRead: true, isStarred: true }),
  readUnstarred: createArticleBatch(100, { isRead: true, isStarred: false }),
  unreadStarred: createArticleBatch(25, { isRead: false, isStarred: true }),
  unreadUnstarred: createArticleBatch(200, { isRead: false, isStarred: false }),
});

/**
 * Create large dataset for performance testing
 */
export const createLargeDataset = (totalArticles: number = 5000) => {
  const starred = Math.floor(totalArticles * 0.05); // 5% starred
  const unread = Math.floor(totalArticles * 0.3); // 30% unread
  const read = totalArticles - starred - unread;

  return {
    articles: [
      ...createArticleBatch(starred, { isStarred: true, isRead: true }),
      ...createArticleBatch(unread, { isStarred: false, isRead: false }),
      ...createArticleBatch(read, { isStarred: false, isRead: true }),
    ],
    stats: {
      total: totalArticles,
      starred,
      unread,
      read,
    },
  };
};
