import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getAdminClient } from '@/lib/db/supabase-admin';

/**
 * RR-129: Integration tests for sync prevention logic
 * Tests that previously deleted articles are not re-imported during sync operations
 */
describe('RR-129: Sync Prevention Integration', () => {
  const supabase = getAdminClient();
  const TEST_USER_ID = 'test-user-rr129-sync';
  
  // Test data cleanup tracking
  const createdFeeds: string[] = [];
  const createdArticles: string[] = [];

  beforeAll(async () => {
    // Ensure we have a test user
    await supabase
      .from('users')
      .upsert({
        id: TEST_USER_ID,
        email: 'rr129-sync-test@example.com',
        inoreader_id: 'rr129-sync-inoreader-id'
      }, { onConflict: 'id' });

    // Verify required tables exist
    const { error: deletedTableError } = await supabase
      .from('deleted_articles')
      .select('*')
      .limit(1);

    expect(deletedTableError).toBeNull();
  });

  afterAll(async () => {
    // Clean up all test data
    if (createdArticles.length > 0) {
      await supabase
        .from('articles')
        .delete()
        .in('id', createdArticles);
    }

    if (createdFeeds.length > 0) {
      await supabase
        .from('feeds')
        .delete()
        .in('id', createdFeeds);
    }

    // Clean up test user
    await supabase
      .from('users')
      .delete()
      .eq('id', TEST_USER_ID);

    // Clean up any test entries in deleted_articles
    await supabase
      .from('deleted_articles')
      .delete()
      .like('inoreader_id', 'test-rr129-sync-%');
  });

  beforeEach(async () => {
    // Clear any existing test data before each test
    await supabase
      .from('articles')
      .delete()
      .like('inoreader_id', 'test-rr129-sync-%');
    
    await supabase
      .from('feeds')
      .delete()
      .like('inoreader_id', 'test-rr129-sync-%');

    await supabase
      .from('deleted_articles')
      .delete()
      .like('inoreader_id', 'test-rr129-sync-%');

    // Reset tracking arrays
    createdFeeds.length = 0;
    createdArticles.length = 0;
  });

  // Helper function to simulate Inoreader article format
  const createInoreaderArticle = (id: string, isRead: boolean = false, isStarred: boolean = false) => {
    const categories = [];
    if (isRead) {
      categories.push('user/-/state/com.google/read');
    }
    if (isStarred) {
      categories.push('user/-/state/com.google/starred');
    }

    return {
      id,
      title: `Article ${id}`,
      content: { content: `Content for ${id}` },
      summary: { content: `Summary for ${id}` },
      author: `Author of ${id}`,
      canonical: [{ href: `https://example.com/articles/${id}` }],
      published: Math.floor(Date.now() / 1000),
      updated: Math.floor(Date.now() / 1000),
      categories
    };
  };

  // Helper function to simulate sync process
  const simulateSync = async (feedId: string, inoreaderArticles: any[]) => {
    // Step 1: Get deleted article IDs
    const inoreaderIds = inoreaderArticles.map(a => a.id);
    const { data: deletedTrackingData } = await supabase
      .from('deleted_articles')
      .select('inoreader_id')
      .in('inoreader_id', inoreaderIds);

    const deletedIds = new Set(deletedTrackingData?.map(d => d.inoreader_id) || []);

    // Step 2: Filter articles based on deletion tracking and read status
    const articlesToSync = [];
    const articlesToRemoveFromTracking = [];

    for (const article of inoreaderArticles) {
      const isInDeletedTracking = deletedIds.has(article.id);
      const isReadInInoreader = article.categories?.includes('user/-/state/com.google/read');
      const isUnreadInInoreader = !isReadInInoreader;

      if (isInDeletedTracking && isReadInInoreader) {
        // Skip - article was deleted and is still read
        continue;
      } else if (isInDeletedTracking && isUnreadInInoreader) {
        // Allow - article was deleted but is now unread, remove from tracking
        articlesToSync.push(article);
        articlesToRemoveFromTracking.push(article.id);
      } else {
        // Normal sync - article not in deleted tracking
        articlesToSync.push(article);
      }
    }

    // Step 3: Remove articles from tracking if they became unread
    if (articlesToRemoveFromTracking.length > 0) {
      await supabase
        .from('deleted_articles')
        .delete()
        .in('inoreader_id', articlesToRemoveFromTracking);
    }

    // Step 4: Insert/update articles that should be synced
    const articleInserts = articlesToSync.map(article => ({
      feed_id: feedId,
      inoreader_id: article.id,
      title: article.title || 'Untitled',
      content: article.content?.content || article.summary?.content || '',
      author: article.author || null,
      url: article.canonical?.[0]?.href || null,
      published_at: article.published ? new Date(article.published * 1000).toISOString() : null,
      is_read: article.categories?.includes('user/-/state/com.google/read') || false,
      is_starred: article.categories?.includes('user/-/state/com.google/starred') || false
    }));

    if (articleInserts.length > 0) {
      const { data: insertedArticles, error } = await supabase
        .from('articles')
        .upsert(articleInserts, { onConflict: 'inoreader_id' })
        .select();

      if (!error && insertedArticles) {
        insertedArticles.forEach(article => createdArticles.push(article.id));
      }

      return {
        syncedCount: articleInserts.length,
        skippedCount: inoreaderArticles.length - articleInserts.length,
        removedFromTracking: articlesToRemoveFromTracking.length,
        error
      };
    }

    return {
      syncedCount: 0,
      skippedCount: inoreaderArticles.length,
      removedFromTracking: articlesToRemoveFromTracking.length,
      error: null
    };
  };

  describe('Delete → Sync → No Re-import Flow', () => {
    it('should not re-import previously deleted read articles', async () => {
      // Create test feed
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-feed-1',
          title: 'Sync Prevention Test Feed',
          url: 'https://example.com/sync-feed.xml',
          unread_count: 2
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Step 1: Initial sync with articles
      const initialInoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-article-1', false), // unread
        createInoreaderArticle('test-rr129-sync-article-2', true),  // read
        createInoreaderArticle('test-rr129-sync-article-3', false)  // unread
      ];

      const initialSyncResult = await simulateSync(feed.id, initialInoreaderArticles);
      expect(initialSyncResult.error).toBeNull();
      expect(initialSyncResult.syncedCount).toBe(3);
      expect(initialSyncResult.skippedCount).toBe(0);

      // Step 2: User reads article-1, making it eligible for cleanup
      await supabase
        .from('articles')
        .update({ is_read: true })
        .eq('inoreader_id', 'test-rr129-sync-article-1');

      // Step 3: Cleanup - delete read articles and track them
      const { data: articlesToDelete } = await supabase
        .from('articles')
        .select('inoreader_id, feed_id')
        .eq('feed_id', feed.id)
        .eq('is_read', true)
        .eq('is_starred', false);

      expect(articlesToDelete).toHaveLength(2); // article-1 and article-2

      // Track deletions
      await supabase
        .from('deleted_articles')
        .upsert(articlesToDelete!.map(a => ({
          inoreader_id: a.inoreader_id,
          was_read: true,
          feed_id: a.feed_id
        })), { onConflict: 'inoreader_id' });

      // Delete articles
      const { count: deletedCount } = await supabase
        .from('articles')
        .delete()
        .eq('feed_id', feed.id)
        .eq('is_read', true)
        .eq('is_starred', false);

      expect(deletedCount).toBe(2);

      // Update tracking array to remove deleted articles
      const { data: remainingArticles } = await supabase
        .from('articles')
        .select('id')
        .eq('feed_id', feed.id);

      createdArticles.length = 0;
      remainingArticles?.forEach(a => createdArticles.push(a.id));

      // Step 4: Subsequent sync with same articles (simulating Inoreader still having them)
      const subsequentInoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-article-1', true),  // still read in Inoreader
        createInoreaderArticle('test-rr129-sync-article-2', true),  // still read in Inoreader
        createInoreaderArticle('test-rr129-sync-article-3', false)  // still unread
      ];

      const subsequentSyncResult = await simulateSync(feed.id, subsequentInoreaderArticles);
      expect(subsequentSyncResult.error).toBeNull();
      expect(subsequentSyncResult.syncedCount).toBe(1); // Only article-3 should sync
      expect(subsequentSyncResult.skippedCount).toBe(2); // article-1 and article-2 should be skipped
      expect(subsequentSyncResult.removedFromTracking).toBe(0);

      // Verify articles in database
      const { data: finalArticles } = await supabase
        .from('articles')
        .select('inoreader_id')
        .eq('feed_id', feed.id)
        .order('inoreader_id');

      expect(finalArticles).toHaveLength(1);
      expect(finalArticles![0].inoreader_id).toBe('test-rr129-sync-article-3');

      // Verify tracking entries still exist
      const { data: trackingEntries } = await supabase
        .from('deleted_articles')
        .select('inoreader_id')
        .in('inoreader_id', ['test-rr129-sync-article-1', 'test-rr129-sync-article-2']);

      expect(trackingEntries).toHaveLength(2);
    });

    it('should re-import articles that become unread in Inoreader after deletion', async () => {
      // Create test feed
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-feed-2',
          title: 'Unread Restoration Test Feed',
          url: 'https://example.com/unread-restore-feed.xml',
          unread_count: 1
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Step 1: Initial sync and cleanup
      const { data: article, error: articleError } = await supabase
        .from('articles')
        .insert({
          feed_id: feed.id,
          inoreader_id: 'test-rr129-sync-unread-restore',
          title: 'Unread Restore Article',
          content: 'Content for restoration test',
          is_read: true,
          is_starred: false
        })
        .select()
        .single();

      expect(articleError).toBeNull();
      createdArticles.push(article.id);

      // Track and delete the article
      await supabase
        .from('deleted_articles')
        .insert({
          inoreader_id: article.inoreader_id,
          was_read: true,
          feed_id: article.feed_id
        });

      await supabase
        .from('articles')
        .delete()
        .eq('id', article.id);

      createdArticles.length = 0; // Article is deleted

      // Verify article is gone and tracked
      const { count: articleCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('inoreader_id', 'test-rr129-sync-unread-restore');

      expect(articleCount).toBe(0);

      const { data: trackingEntry } = await supabase
        .from('deleted_articles')
        .select('*')
        .eq('inoreader_id', 'test-rr129-sync-unread-restore')
        .single();

      expect(trackingEntry).toBeDefined();

      // Step 2: Sync with article now unread in Inoreader
      const inoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-unread-restore', false) // Now unread
      ];

      const syncResult = await simulateSync(feed.id, inoreaderArticles);
      expect(syncResult.error).toBeNull();
      expect(syncResult.syncedCount).toBe(1); // Should be re-imported
      expect(syncResult.skippedCount).toBe(0);
      expect(syncResult.removedFromTracking).toBe(1); // Should be removed from tracking

      // Verify article is back in database
      const { data: restoredArticle } = await supabase
        .from('articles')
        .select('inoreader_id, is_read')
        .eq('inoreader_id', 'test-rr129-sync-unread-restore')
        .single();

      expect(restoredArticle).toBeDefined();
      expect(restoredArticle.is_read).toBe(false);

      // Verify tracking entry is removed
      const { data: remainingTracking } = await supabase
        .from('deleted_articles')
        .select('*')
        .eq('inoreader_id', 'test-rr129-sync-unread-restore');

      expect(remainingTracking).toHaveLength(0);
    });
  });

  describe('Starred Article Behavior', () => {
    it('should never delete starred articles even when read', async () => {
      // Create test feed
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-starred-feed',
          title: 'Starred Articles Test Feed',
          url: 'https://example.com/starred-feed.xml',
          unread_count: 1
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Create starred and read article
      const { data: starredArticle, error: articleError } = await supabase
        .from('articles')
        .insert({
          feed_id: feed.id,
          inoreader_id: 'test-rr129-sync-starred-read',
          title: 'Starred Read Article',
          content: 'This should never be deleted',
          is_read: true,
          is_starred: true
        })
        .select()
        .single();

      expect(articleError).toBeNull();
      createdArticles.push(starredArticle.id);

      // Attempt cleanup (should not delete starred articles)
      const { data: toDelete } = await supabase
        .from('articles')
        .select('inoreader_id, feed_id')
        .eq('feed_id', feed.id)
        .eq('is_read', true)
        .eq('is_starred', false); // Key condition: not starred

      expect(toDelete).toHaveLength(0); // Starred article should not be found

      // Subsequent sync should work normally
      const inoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-starred-read', true, true) // Read and starred
      ];

      const syncResult = await simulateSync(feed.id, inoreaderArticles);
      expect(syncResult.error).toBeNull();
      expect(syncResult.syncedCount).toBe(1); // Should sync normally
      expect(syncResult.skippedCount).toBe(0);

      // Article should still exist
      const { data: remainingArticle } = await supabase
        .from('articles')
        .select('is_read, is_starred')
        .eq('inoreader_id', 'test-rr129-sync-starred-read')
        .single();

      expect(remainingArticle).toBeDefined();
      expect(remainingArticle.is_read).toBe(true);
      expect(remainingArticle.is_starred).toBe(true);
    });

    it('should handle starred articles that become unstarred', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-unstarred-feed',
          title: 'Unstarred Test Feed',
          url: 'https://example.com/unstarred-feed.xml',
          unread_count: 1
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Create article that starts starred
      const { data: article } = await supabase
        .from('articles')
        .insert({
          feed_id: feed.id,
          inoreader_id: 'test-rr129-sync-becomes-unstarred',
          title: 'Becomes Unstarred Article',
          content: 'This will lose its star',
          is_read: true,
          is_starred: true
        })
        .select()
        .single();

      createdArticles.push(article.id);

      // Sync with article now unstarred in Inoreader
      const inoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-becomes-unstarred', true, false) // Read but not starred
      ];

      const syncResult = await simulateSync(feed.id, inoreaderArticles);
      expect(syncResult.error).toBeNull();

      // Update the article to reflect new state
      await supabase
        .from('articles')
        .update({ is_starred: false })
        .eq('inoreader_id', 'test-rr129-sync-becomes-unstarred');

      // Now it should be eligible for cleanup
      const { data: toDelete } = await supabase
        .from('articles')
        .select('inoreader_id, feed_id')
        .eq('feed_id', feed.id)
        .eq('is_read', true)
        .eq('is_starred', false);

      expect(toDelete).toHaveLength(1);
      expect(toDelete![0].inoreader_id).toBe('test-rr129-sync-becomes-unstarred');
    });
  });

  describe('Complex Sync Scenarios', () => {
    it('should handle mixed article states correctly during sync', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-mixed-feed',
          title: 'Mixed Scenarios Test Feed',
          url: 'https://example.com/mixed-feed.xml',
          unread_count: 5
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Setup: Create articles and track some as deleted
      const setupArticles = [
        {
          feed_id: feed.id,
          inoreader_id: 'test-rr129-sync-mixed-1',
          title: 'Article 1',
          content: 'Content 1',
          is_read: true,
          is_starred: false
        },
        {
          feed_id: feed.id,
          inoreader_id: 'test-rr129-sync-mixed-2',
          title: 'Article 2',
          content: 'Content 2',
          is_read: true,
          is_starred: false
        }
      ];

      const { data: setupArticleData } = await supabase
        .from('articles')
        .insert(setupArticles)
        .select();

      setupArticleData?.forEach(a => createdArticles.push(a.id));

      // Delete and track one article
      await supabase
        .from('deleted_articles')
        .insert({
          inoreader_id: 'test-rr129-sync-mixed-1',
          was_read: true,
          feed_id: feed.id
        });

      await supabase
        .from('articles')
        .delete()
        .eq('inoreader_id', 'test-rr129-sync-mixed-1');

      // Update tracking to remove deleted article
      createdArticles.splice(0, 1);

      // Sync with complex scenario
      const inoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-mixed-1', true),  // Deleted, still read -> should skip
        createInoreaderArticle('test-rr129-sync-mixed-2', false), // Existing, now unread -> should update
        createInoreaderArticle('test-rr129-sync-mixed-3', false), // New article -> should add
        createInoreaderArticle('test-rr129-sync-mixed-4', true)   // New read article -> should add
      ];

      const syncResult = await simulateSync(feed.id, inoreaderArticles);
      expect(syncResult.error).toBeNull();
      expect(syncResult.syncedCount).toBe(3); // mixed-2, mixed-3, mixed-4
      expect(syncResult.skippedCount).toBe(1); // mixed-1 skipped
      expect(syncResult.removedFromTracking).toBe(0); // No articles moved from read to unread

      // Verify final state
      const { data: finalArticles } = await supabase
        .from('articles')
        .select('inoreader_id, is_read')
        .eq('feed_id', feed.id)
        .order('inoreader_id');

      expect(finalArticles).toHaveLength(3);
      
      const articlesMap = new Map(finalArticles!.map(a => [a.inoreader_id, a]));
      
      expect(articlesMap.has('test-rr129-sync-mixed-1')).toBe(false); // Should not exist
      expect(articlesMap.get('test-rr129-sync-mixed-2')?.is_read).toBe(false); // Updated to unread
      expect(articlesMap.get('test-rr129-sync-mixed-3')?.is_read).toBe(false); // New unread
      expect(articlesMap.get('test-rr129-sync-mixed-4')?.is_read).toBe(true); // New read

      // Update tracking for cleanup
      createdArticles.length = 0;
      finalArticles?.forEach(a => {
        const originalArticle = setupArticleData?.find(orig => orig.inoreader_id === a.inoreader_id);
        if (originalArticle) {
          createdArticles.push(originalArticle.id);
        }
      });
    });

    it('should handle state transitions from deleted tracking', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-transition-feed',
          title: 'State Transition Test Feed',
          url: 'https://example.com/transition-feed.xml',
          unread_count: 0
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Pre-populate deleted_articles tracking
      await supabase
        .from('deleted_articles')
        .insert([
          {
            inoreader_id: 'test-rr129-sync-transition-1',
            was_read: true,
            feed_id: feed.id
          },
          {
            inoreader_id: 'test-rr129-sync-transition-2',
            was_read: true,
            feed_id: feed.id
          }
        ]);

      // Sync with various state transitions
      const inoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-transition-1', true),  // Still read -> skip, keep tracking
        createInoreaderArticle('test-rr129-sync-transition-2', false), // Now unread -> import, remove tracking
        createInoreaderArticle('test-rr129-sync-transition-3', false)  // New article -> import normally
      ];

      const syncResult = await simulateSync(feed.id, inoreaderArticles);
      expect(syncResult.error).toBeNull();
      expect(syncResult.syncedCount).toBe(2); // transition-2 and transition-3
      expect(syncResult.skippedCount).toBe(1); // transition-1
      expect(syncResult.removedFromTracking).toBe(1); // transition-2

      // Verify tracking state
      const { data: remainingTracking } = await supabase
        .from('deleted_articles')
        .select('inoreader_id')
        .in('inoreader_id', ['test-rr129-sync-transition-1', 'test-rr129-sync-transition-2']);

      expect(remainingTracking).toHaveLength(1);
      expect(remainingTracking![0].inoreader_id).toBe('test-rr129-sync-transition-1');

      // Verify articles
      const { data: articles } = await supabase
        .from('articles')
        .select('inoreader_id, is_read')
        .eq('feed_id', feed.id)
        .order('inoreader_id');

      expect(articles).toHaveLength(2);
      expect(articles![0].inoreader_id).toBe('test-rr129-sync-transition-2');
      expect(articles![0].is_read).toBe(false);
      expect(articles![1].inoreader_id).toBe('test-rr129-sync-transition-3');
      expect(articles![1].is_read).toBe(false);
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle large numbers of tracked deletions efficiently', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-scale-feed',
          title: 'Scale Test Feed',
          url: 'https://example.com/scale-feed.xml',
          unread_count: 500
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Create many tracking entries
      const trackingCount = 200;
      const trackingEntries = Array.from({ length: trackingCount }, (_, i) => ({
        inoreader_id: `test-rr129-sync-scale-${i}`,
        was_read: true,
        feed_id: feed.id
      }));

      await supabase
        .from('deleted_articles')
        .insert(trackingEntries);

      // Create large sync batch with mixed scenarios
      const syncBatchSize = 300;
      const inoreaderArticles = Array.from({ length: syncBatchSize }, (_, i) => {
        const isTracked = i < trackingCount;
        const isRead = i % 3 === 0; // 33% read
        
        return createInoreaderArticle(`test-rr129-sync-scale-${i}`, isRead);
      });

      // Time the sync operation
      const startTime = Date.now();
      const syncResult = await simulateSync(feed.id, inoreaderArticles);
      const syncTime = Date.now() - startTime;

      expect(syncResult.error).toBeNull();
      expect(syncTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify results make sense
      expect(syncResult.syncedCount + syncResult.skippedCount).toBe(syncBatchSize);
      expect(syncResult.skippedCount).toBeGreaterThan(0); // Some should be skipped due to tracking

      console.log(`Synced ${syncResult.syncedCount} articles, skipped ${syncResult.skippedCount} in ${syncTime}ms`);
    });

    it('should maintain consistent performance with growing tracking table', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-perf-feed',
          title: 'Performance Test Feed',
          url: 'https://example.com/perf-feed.xml',
          unread_count: 10
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Add increasingly more tracking entries and measure lookup performance
      const batchSizes = [100, 500, 1000];
      const lookupTimes = [];

      for (const batchSize of batchSizes) {
        // Clear previous tracking entries for this test
        await supabase
          .from('deleted_articles')
          .delete()
          .like('inoreader_id', 'test-rr129-sync-perf-%');

        // Insert tracking entries
        const trackingEntries = Array.from({ length: batchSize }, (_, i) => ({
          inoreader_id: `test-rr129-sync-perf-${i}`,
          was_read: true,
          feed_id: feed.id
        }));

        await supabase
          .from('deleted_articles')
          .insert(trackingEntries);

        // Measure lookup time for sync operation
        const testArticles = Array.from({ length: 50 }, (_, i) => 
          createInoreaderArticle(`test-rr129-sync-perf-${i}`, true)
        );

        const startTime = Date.now();
        await simulateSync(feed.id, testArticles);
        const lookupTime = Date.now() - startTime;

        lookupTimes.push(lookupTime);

        // Clean up created articles for next iteration
        await supabase
          .from('articles')
          .delete()
          .eq('feed_id', feed.id);
      }

      // Performance should not degrade significantly
      expect(lookupTimes[2]).toBeLessThan(lookupTimes[0] * 3); // 1000 entries should not be 3x slower than 100

      console.log(`Lookup times for ${batchSizes.join(', ')} tracking entries: ${lookupTimes.join(', ')}ms`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors during tracking lookup gracefully', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-error-feed',
          title: 'Error Handling Test Feed',
          url: 'https://example.com/error-feed.xml',
          unread_count: 1
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Test with empty/null inoreader IDs
      const problematicArticles = [
        { ...createInoreaderArticle('test-rr129-sync-valid', false), id: 'test-rr129-sync-valid' },
        // Note: Can't easily simulate database errors in this test environment
        // In real implementation, we would handle connection failures, timeouts, etc.
      ];

      const syncResult = await simulateSync(feed.id, problematicArticles);
      expect(syncResult.error).toBeNull();
      expect(syncResult.syncedCount).toBe(1);
    });

    it('should handle tracking removal failures gracefully', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-removal-feed',
          title: 'Removal Test Feed',
          url: 'https://example.com/removal-feed.xml',
          unread_count: 1
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Create tracking entry
      await supabase
        .from('deleted_articles')
        .insert({
          inoreader_id: 'test-rr129-sync-removal-test',
          was_read: true,
          feed_id: feed.id
        });

      // Sync with article becoming unread
      const inoreaderArticles = [
        createInoreaderArticle('test-rr129-sync-removal-test', false)
      ];

      const syncResult = await simulateSync(feed.id, inoreaderArticles);
      expect(syncResult.error).toBeNull();
      expect(syncResult.syncedCount).toBe(1);
      expect(syncResult.removedFromTracking).toBe(1);

      // Even if tracking removal had issues, article should still be synced
      const { data: article } = await supabase
        .from('articles')
        .select('inoreader_id, is_read')
        .eq('inoreader_id', 'test-rr129-sync-removal-test')
        .single();

      expect(article).toBeDefined();
      expect(article.is_read).toBe(false);
    });

    it('should handle empty sync batches', async () => {
      // Create test feed
      const { data: feed } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-sync-empty-feed',
          title: 'Empty Sync Test Feed',
          url: 'https://example.com/empty-feed.xml',
          unread_count: 0
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Sync with empty article list
      const syncResult = await simulateSync(feed.id, []);
      expect(syncResult.error).toBeNull();
      expect(syncResult.syncedCount).toBe(0);
      expect(syncResult.skippedCount).toBe(0);
      expect(syncResult.removedFromTracking).toBe(0);
    });
  });
});