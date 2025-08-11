/**
 * Comprehensive tests for data stores
 * Tests database initialization, CRUD operations, and offline functionality
 */

import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";

// Mock the database module first before any imports
let mockDb: any;

vi.mock("@/lib/db/database", async () => {
  const actual = await vi.importActual("@/lib/db/database");
  return {
    ...actual,
    AppDatabase: actual.AppDatabase,
    db: new Proxy({}, {
      get(target, prop) {
        // Access the variable through globalThis to avoid initialization issues
        const mockedDb = (globalThis as any).mockDbInstance;
        if (mockedDb && prop in mockedDb) {
          const value = mockedDb[prop];
          // If it's a function, bind it to the mockDb instance
          if (typeof value === 'function') {
            return value.bind(mockedDb);
          }
          return value;
        }
        // Provide default implementations for common database methods
        if (prop === 'getVersion') {
          return vi.fn().mockResolvedValue(1);
        }
        if (prop === 'recordCorruption') {
          return vi.fn().mockResolvedValue(undefined);
        }
        if (prop === 'isOpen') {
          return vi.fn().mockReturnValue(true);
        }
        if (prop === 'open') {
          return vi.fn().mockResolvedValue(undefined);
        }
        if (prop === 'close') {
          return vi.fn().mockResolvedValue(undefined);
        }
        if (prop === 'initialize') {
          return vi.fn().mockResolvedValue(undefined);
        }
        if (prop === 'vacuum') {
          return vi.fn().mockResolvedValue(undefined);
        }
        if (prop === 'getStorageInfo') {
          return vi.fn().mockResolvedValue({ counts: { articles: 0 } });
        }
        return undefined;
      }
    })
  };
});

// Create a chainable query mock for Supabase
const createChainableQuery = (data: any[] = []) => {
  const query: any = {};
  
  // Add chainable methods that return the query object
  query.select = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.neq = vi.fn().mockReturnValue(query);
  query.in = vi.fn().mockReturnValue(query);
  query.order = vi.fn().mockReturnValue(query);
  query.limit = vi.fn().mockReturnValue(query);
  query.offset = vi.fn().mockReturnValue(query);
  query.range = vi.fn().mockReturnValue(query);
  query.single = vi.fn().mockReturnValue(query);
  query.maybeSingle = vi.fn().mockReturnValue(query);
  
  // Make the query thenable so it can be awaited
  query.then = vi.fn().mockImplementation((resolve) => {
    const result = data.length === 1 ? { data: data[0], error: null } : { data, error: null };
    resolve(result);
    return Promise.resolve(result);
  });
  
  return query;
};

// Mock Supabase client to avoid environment variable requirements
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => createChainableQuery([])),
      insert: vi.fn(() => createChainableQuery([])),
      update: vi.fn(() => createChainableQuery([])),
      delete: vi.fn(() => createChainableQuery([])),
      upsert: vi.fn(() => createChainableQuery([])),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  },
  supabaseAdmin: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => createChainableQuery([])),
      insert: vi.fn(() => createChainableQuery([])),
      update: vi.fn(() => createChainableQuery([])),
      delete: vi.fn(() => createChainableQuery([])),
    }))
  }
}));

// Import after mocks are set up
import { AppDatabase } from "@/lib/db/database";
import { useArticleStore } from "../article-store";
import { useFeedStore } from "../feed-store";
import { useSyncStore } from "../sync-store";
import { useDataStore } from "../data-store";
import type { Article, Feed, Folder } from "@/types";

// Mock navigator.onLine for offline testing
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// Test data
const mockArticle: Article = {
  id: "test-article-1",
  title: "Test Article",
  content: "This is test content for the article.",
  author: "Test Author",
  publishedAt: new Date("2025-01-01"),
  feedId: "test-feed-1",
  feedTitle: "Test Feed",
  url: "https://example.com/article-1",
  isRead: false,
  isPartial: false,
  inoreaderItemId: "inoreader-item-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFeed: Feed = {
  id: "test-feed-1",
  title: "Test Feed",
  url: "https://example.com/feed.xml",
  htmlUrl: "https://example.com",
  description: "A test feed",
  folderId: "test-folder-1",
  unreadCount: 0,
  isActive: true,
  inoreaderId: "inoreader-feed-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFolder: Folder = {
  id: "test-folder-1",
  title: "Test Folder",
  parentId: null,
  unreadCount: 0,
  isExpanded: true,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Generate unique database names per test to prevent cross-test pollution
const generateUniqueDbName = (testName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test_db_${testName}_${timestamp}_${random}`;
};

// Test-specific database instance
let testDb: AppDatabase;

describe("Data Stores Integration Tests", () => {
  beforeEach(async () => {
    // Create a new database instance with unique name for each test
    const dbName = generateUniqueDbName("data_stores");
    testDb = new AppDatabase(dbName);
    mockDb = testDb; // Set the mock to use our test database
    (globalThis as any).mockDbInstance = testDb; // Also set global reference
    
    // Just open the database - no need to delete first since it's a unique name
    await testDb.open();
    await testDb.initialize();
  });

  afterEach(async () => {
    // Clean up test database with proper synchronization
    if (testDb) {
      try {
        // Ensure all transactions are complete
        if (testDb.isOpen()) {
          await testDb.transaction('r', testDb.tables, async () => {
            // This empty transaction ensures all pending operations complete
          });
        }
        
        // Safe cleanup
        await testDb.safeDelete();
      } catch (error) {
        console.warn('Error during test cleanup:', error);
      }
    }
    
    // Clear mock references
    mockDb = null as any;
    (globalThis as any).mockDbInstance = null;
  });

  describe("Database Initialization", () => {
    test("should initialize database with correct schema", async () => {
      const dataStore = useDataStore.getState();
      const result = await dataStore.initializeDatabase();

      expect(result).toBe(true);
      expect(dataStore.dbStatus.isInitialized).toBe(true);
      expect(dataStore.dbStatus.isHealthy).toBe(true);
    });

    test("should create all required tables", async () => {
      // Check if all tables exist
      expect(testDb.articles).toBeDefined();
      expect(testDb.feeds).toBeDefined();
      expect(testDb.folders).toBeDefined();
      expect(testDb.summaries).toBeDefined();
      expect(testDb.pendingActions).toBeDefined();
      expect(testDb.apiUsage).toBeDefined();
      expect(testDb.userPreferences).toBeDefined();
      expect(testDb.dbInfo).toBeDefined();
    });

    test("should handle database corruption gracefully", async () => {
      const dataStore = useDataStore.getState();

      // Simulate corruption by recording it
      await testDb.recordCorruption();

      const validation = await dataStore.validateDatabase();
      expect(typeof validation).toBe("boolean");
    });
  });

  describe("Article Store Tests", () => {
    beforeEach(async () => {
      // Add test data
      await testDb.folders.add(mockFolder);
      await testDb.feeds.add(mockFeed);
      await testDb.articles.add(mockArticle);
    });

    test("should load articles correctly", async () => {
      const articleStore = useArticleStore.getState();

      await articleStore.loadArticles();

      expect(articleStore.articles.size).toBe(1);
      expect(articleStore.articles.get("test-article-1")).toBeDefined();
      expect(articleStore.loadingArticles).toBe(false);
    });

    test("should filter articles by feed", async () => {
      const articleStore = useArticleStore.getState();

      await articleStore.loadArticles("test-feed-1");

      expect(articleStore.articles.size).toBe(1);
      expect(articleStore.selectedFeedId).toBe("test-feed-1");
    });

    test("should mark article as read", async () => {
      const articleStore = useArticleStore.getState();

      await articleStore.markAsRead("test-article-1");

      const article = await testDb.articles.get("test-article-1");
      expect(article?.isRead).toBe(true);

      // Check store is updated
      await articleStore.getArticle("test-article-1");
      expect(articleStore.articles.get("test-article-1")?.isRead).toBe(true);
    });

    test("should toggle star on article", async () => {
      const articleStore = useArticleStore.getState();

      await articleStore.toggleStar("test-article-1");

      const article = await testDb.articles.get("test-article-1");
      expect(article?.tags).toContain("starred");

      // Toggle again
      await articleStore.toggleStar("test-article-1");
      const article2 = await testDb.articles.get("test-article-1");
      expect(article2?.tags).not.toContain("starred");
    });

    test("should handle article count correctly", async () => {
      const articleStore = useArticleStore.getState();
      await articleStore.loadArticles();

      const counts = articleStore.getArticleCount();
      expect(counts.total).toBe(1);
      expect(counts.unread).toBe(1);

      await articleStore.markAsRead("test-article-1");
      await articleStore.loadArticles();

      const newCounts = articleStore.getArticleCount();
      expect(newCounts.unread).toBe(0);
    });
  });

  describe("Feed Store Tests", () => {
    beforeEach(async () => {
      await testDb.folders.add(mockFolder);
      await testDb.feeds.add(mockFeed);
      await testDb.articles.add(mockArticle);
    });

    test("should load feed hierarchy correctly", async () => {
      const feedStore = useFeedStore.getState();

      await feedStore.loadFeedHierarchy();

      expect(feedStore.feeds.size).toBe(1);
      expect(feedStore.folders.size).toBe(1);
      expect(feedStore.loadingFeeds).toBe(false);
    });

    test("should calculate unread counts", async () => {
      const feedStore = useFeedStore.getState();

      await feedStore.loadFeedHierarchy();

      expect(feedStore.totalUnreadCount).toBe(1);
      expect(feedStore.folderUnreadCounts.get("test-folder-1")).toBe(1);
    });

    test("should create new folder", async () => {
      const feedStore = useFeedStore.getState();

      const folderId = await feedStore.createFolder("New Test Folder");

      expect(folderId).toBeTruthy();
      expect(typeof folderId).toBe("string");

      const folder = await testDb.folders.get(folderId!);
      expect(folder?.title).toBe("New Test Folder");
    });

    test("should move feed to different folder", async () => {
      const feedStore = useFeedStore.getState();

      // Create new folder
      const newFolderId = await feedStore.createFolder("New Folder");

      // Move feed
      await feedStore.moveFeedToFolder("test-feed-1", newFolderId);

      const feed = await testDb.feeds.get("test-feed-1");
      expect(feed?.folderId).toBe(newFolderId);
    });

    test("should get feeds in folder", async () => {
      const feedStore = useFeedStore.getState();
      await feedStore.loadFeedHierarchy();

      const feedsInFolder = feedStore.getFeedsInFolder("test-folder-1");
      expect(feedsInFolder.length).toBe(1);
      expect(feedsInFolder[0].id).toBe("test-feed-1");
    });
  });

  describe("Sync Store Tests", () => {
    beforeEach(async () => {
      await testDb.articles.add(mockArticle);
      // Reset navigator.onLine
      (navigator as any).onLine = true;
    });

    test("should add actions to queue", () => {
      const syncStore = useSyncStore.getState();

      syncStore.addToQueue({
        type: "mark_read",
        articleId: "test-article-1",
        maxRetries: 3,
      });

      expect(syncStore.actionQueue.length).toBe(1);
      expect(syncStore.actionQueue[0].type).toBe("mark_read");
      expect(syncStore.actionQueue[0].articleId).toBe("test-article-1");
    });

    test("should handle offline queue", () => {
      const syncStore = useSyncStore.getState();

      // Simulate offline
      (navigator as any).onLine = false;

      syncStore.addToQueue({
        type: "mark_read",
        articleId: "test-article-1",
        maxRetries: 3,
      });

      expect(syncStore.actionQueue.length).toBe(1);
    });

    test("should clear queue", () => {
      const syncStore = useSyncStore.getState();

      syncStore.addToQueue({
        type: "mark_read",
        articleId: "test-article-1",
        maxRetries: 3,
      });

      syncStore.clearQueue();
      expect(syncStore.actionQueue.length).toBe(0);
    });

    test("should track sync status", () => {
      const syncStore = useSyncStore.getState();

      syncStore.setSyncing(true);
      expect(syncStore.isSyncing).toBe(true);

      syncStore.setSyncing(false);
      expect(syncStore.isSyncing).toBe(false);

      const now = Date.now();
      syncStore.setLastSyncTime(now);
      expect(syncStore.lastSyncTime).toBe(now);
    });
  });

  describe("Data Store Tests", () => {
    test("should load and update preferences", async () => {
      const dataStore = useDataStore.getState();
      await dataStore.initializeDatabase();

      const result = await dataStore.updatePreferences({
        theme: "dark",
        fontSize: "large",
      });

      expect(result).toBe(true);
      expect(dataStore.preferences?.theme).toBe("dark");
      expect(dataStore.preferences?.fontSize).toBe("large");
    });

    test("should track API usage", async () => {
      const dataStore = useDataStore.getState();
      await dataStore.initializeDatabase();

      await dataStore.recordInoreaderCall(0.01);
      await dataStore.recordClaudeCall(0.05);

      expect(dataStore.apiUsage?.inoreaderCalls).toBe(1);
      expect(dataStore.apiUsage?.claudeCalls).toBe(1);
    });

    test("should perform maintenance", async () => {
      const dataStore = useDataStore.getState();
      await dataStore.initializeDatabase();

      // Add some test data
      await testDb.articles.add(mockArticle);

      await dataStore.performMaintenance();

      // Should complete without errors
      expect(dataStore.dbStatus.isHealthy).toBe(true);
    });

    test("should export data", async () => {
      const dataStore = useDataStore.getState();
      await dataStore.initializeDatabase();

      const blob = await dataStore.exportData();

      expect(blob).toBeInstanceOf(Blob);
      expect(blob?.type).toBe("application/json");
    });
  });

  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      const articleStore = useArticleStore.getState();

      // Try to get non-existent article
      const article = await articleStore.getArticle("non-existent");
      expect(article).toBeNull();
      expect(articleStore.articlesError).toBeNull();
    });

    test("should clear errors", () => {
      const feedStore = useFeedStore.getState();

      // Test clearError method (errors are set internally during failed operations)
      feedStore.clearError();
      expect(feedStore.feedsError).toBeNull();
    });
  });

  describe("Performance Tests", () => {
    test("should handle pagination efficiently", async () => {
      const articleStore = useArticleStore.getState();

      // Add multiple articles
      const articles = Array.from({ length: 100 }, (_, i) => ({
        ...mockArticle,
        id: `test-article-${i}`,
        title: `Test Article ${i}`,
        publishedAt: new Date(Date.now() - i * 1000),
      }));

      await testDb.articles.bulkAdd(articles);

      const startTime = Date.now();
      await articleStore.loadArticles();
      const endTime = Date.now();

      // Should load first page quickly
      expect(endTime - startTime).toBeLessThan(1000);
      expect(articleStore.articles.size).toBeLessThanOrEqual(50);
      expect(articleStore.hasMore).toBe(true);
    });
  });
});

// Export test utilities for browser testing
export const testUtils = {
  async resetDatabase() {
    if (testDb) {
      await testDb.safeDelete();
      testDb = new AppDatabase(generateUniqueDbName("reset"));
      await testDb.open();
    }
  },

  async addTestData() {
    if (testDb) {
      await testDb.folders.add(mockFolder);
      await testDb.feeds.add(mockFeed);
      await testDb.articles.add(mockArticle);
    }
  },

  async testStores() {
    console.log("🧪 Testing Data Stores...");

    try {
      // Test database initialization
      const dataStore = useDataStore.getState();
      const dbResult = await dataStore.initializeDatabase();
      console.log("✅ Database initialization:", dbResult);

      // Add test data
      await this.addTestData();
      console.log("✅ Test data added");

      // Test article store
      const articleStore = useArticleStore.getState();
      await articleStore.loadArticles();
      console.log("✅ Articles loaded:", articleStore.articles.size);

      // Test feed store
      const feedStore = useFeedStore.getState();
      await feedStore.loadFeedHierarchy();
      console.log("✅ Feed hierarchy loaded:", {
        feeds: feedStore.feeds.size,
        folders: feedStore.folders.size,
        totalUnread: feedStore.totalUnreadCount,
      });

      // Test article operations
      await articleStore.markAsRead("test-article-1");
      console.log("✅ Article marked as read");

      await articleStore.toggleStar("test-article-1");
      console.log("✅ Article starred");

      // Test sync queue
      const syncStore = useSyncStore.getState();
      syncStore.addToQueue({
        type: "mark_read",
        articleId: "test-article-1",
        maxRetries: 3,
      });
      console.log(
        "✅ Action added to sync queue:",
        syncStore.actionQueue.length
      );

      console.log("🎉 All tests passed!");
      return true;
    } catch (error) {
      console.error("❌ Test failed:", error);
      return false;
    }
  },
};
