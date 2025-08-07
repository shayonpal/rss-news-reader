import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getAdminClient } from '@/lib/db/supabase-admin';

/**
 * RR-129: Integration tests for feed deletion scenarios
 * Tests the complete feed deletion flow including CASCADE article deletion
 */
describe('RR-129: Feed Deletion Integration', () => {
  const supabase = getAdminClient();
  const TEST_USER_ID = 'test-user-rr129-feeds';
  
  // Test data cleanup tracking
  const createdFeeds: string[] = [];
  const createdArticles: string[] = [];

  beforeAll(async () => {
    // Ensure we have a test user
    await supabase
      .from('users')
      .upsert({
        id: TEST_USER_ID,
        email: 'rr129-test@example.com',
        inoreader_id: 'rr129-inoreader-id'
      }, { onConflict: 'id' });

    // Ensure deleted_articles table exists (should be created by migration)
    const { error: tableError } = await supabase
      .from('deleted_articles')
      .select('*')
      .limit(1);

    expect(tableError).toBeNull();
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
      .like('inoreader_id', 'test-rr129-%');
  });

  beforeEach(async () => {
    // Clear any existing test data before each test
    await supabase
      .from('articles')
      .delete()
      .like('inoreader_id', 'test-rr129-%');
    
    await supabase
      .from('feeds')
      .delete()
      .like('inoreader_id', 'test-rr129-%');

    await supabase
      .from('deleted_articles')
      .delete()
      .like('inoreader_id', 'test-rr129-%');

    // Reset tracking arrays
    createdFeeds.length = 0;
    createdArticles.length = 0;
  });

  describe('Feed Deletion with CASCADE Article Removal', () => {
    it('should delete articles when their parent feed is deleted', async () => {
      // Create test feed
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-feed-cascade',
          title: 'Test Feed for CASCADE',
          url: 'https://example.com/feed.xml',
          unread_count: 3
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      expect(feed).toBeDefined();
      createdFeeds.push(feed.id);

      // Create test articles for this feed
      const articlesData = [
        {
          feed_id: feed.id,
          inoreader_id: 'test-rr129-article-1',
          title: 'Article 1',
          content: 'Content 1',
          is_read: false,
          is_starred: false
        },
        {
          feed_id: feed.id,
          inoreader_id: 'test-rr129-article-2',
          title: 'Article 2',
          content: 'Content 2',
          is_read: true,
          is_starred: false
        },
        {
          feed_id: feed.id,
          inoreader_id: 'test-rr129-article-3',
          title: 'Article 3',
          content: 'Content 3',
          is_read: true,
          is_starred: true // This one is starred
        }
      ];

      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .insert(articlesData)
        .select();

      expect(articlesError).toBeNull();
      expect(articles).toHaveLength(3);
      articles?.forEach(article => createdArticles.push(article.id));

      // Verify articles exist
      const { count: beforeCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('feed_id', feed.id);

      expect(beforeCount).toBe(3);

      // Delete the feed
      const { error: deleteError } = await supabase
        .from('feeds')
        .delete()
        .eq('id', feed.id);

      expect(deleteError).toBeNull();

      // Verify articles are CASCADE deleted
      const { count: afterCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('feed_id', feed.id);

      expect(afterCount).toBe(0);

      // Remove from tracking since they're already deleted
      createdArticles.length = 0;
      createdFeeds.length = 0;
    });

    it('should delete multiple feeds and their articles simultaneously', async () => {
      // Create multiple test feeds
      const feedsData = Array.from({ length: 3 }, (_, i) => ({
        user_id: TEST_USER_ID,
        inoreader_id: `test-rr129-multi-feed-${i}`,
        title: `Multi Test Feed ${i}`,
        url: `https://example.com/feed${i}.xml`,
        unread_count: i + 1
      }));

      const { data: feeds, error: feedsError } = await supabase
        .from('feeds')
        .insert(feedsData)
        .select();

      expect(feedsError).toBeNull();
      expect(feeds).toHaveLength(3);
      feeds?.forEach(feed => createdFeeds.push(feed.id));

      // Create articles for each feed
      const allArticlesData = [];
      for (let feedIndex = 0; feedIndex < feeds!.length; feedIndex++) {
        const feed = feeds![feedIndex];
        for (let articleIndex = 0; articleIndex < 2; articleIndex++) {
          allArticlesData.push({
            feed_id: feed.id,
            inoreader_id: `test-rr129-multi-article-${feedIndex}-${articleIndex}`,
            title: `Article ${feedIndex}-${articleIndex}`,
            content: `Content ${feedIndex}-${articleIndex}`,
            is_read: articleIndex % 2 === 0,
            is_starred: false
          });
        }
      }

      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .insert(allArticlesData)
        .select();

      expect(articlesError).toBeNull();
      expect(articles).toHaveLength(6); // 3 feeds × 2 articles each
      articles?.forEach(article => createdArticles.push(article.id));

      // Verify all articles exist
      const { count: beforeCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .in('feed_id', feeds!.map(f => f.id));

      expect(beforeCount).toBe(6);

      // Delete all feeds at once
      const { error: deleteError, count: deletedCount } = await supabase
        .from('feeds')
        .delete()
        .in('id', feeds!.map(f => f.id));

      expect(deleteError).toBeNull();
      expect(deletedCount).toBe(3);

      // Verify all articles are CASCADE deleted
      const { count: afterCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .in('feed_id', feeds!.map(f => f.id));

      expect(afterCount).toBe(0);

      // Clear tracking arrays since items are deleted
      createdArticles.length = 0;
      createdFeeds.length = 0;
    });
  });

  describe('Feed Deletion Safety Mechanisms', () => {
    it('should implement safety check for mass deletion (>50%)', async () => {
      // Create multiple feeds (more than would trigger safety check)
      const feedsData = Array.from({ length: 10 }, (_, i) => ({
        user_id: TEST_USER_ID,
        inoreader_id: `test-rr129-safety-feed-${i}`,
        title: `Safety Test Feed ${i}`,
        url: `https://example.com/safety${i}.xml`,
        unread_count: 1
      }));

      const { data: feeds, error: feedsError } = await supabase
        .from('feeds')
        .insert(feedsData)
        .select();

      expect(feedsError).toBeNull();
      expect(feeds).toHaveLength(10);
      feeds?.forEach(feed => createdFeeds.push(feed.id));

      // Simulate safety check logic (would be in cleanup service)
      const inoreaderFeedIds = ['test-rr129-safety-feed-0', 'test-rr129-safety-feed-1']; // Only 2 remain in Inoreader
      
      const { data: localFeeds } = await supabase
        .from('feeds')
        .select('id, inoreader_id')
        .eq('user_id', TEST_USER_ID)
        .like('inoreader_id', 'test-rr129-safety-%');

      const feedsToDelete = localFeeds?.filter(
        feed => !inoreaderFeedIds.includes(feed.inoreader_id)
      ) || [];

      // Safety check: would delete 8/10 = 80% of feeds
      const deletionPercentage = feedsToDelete.length / localFeeds!.length;
      expect(deletionPercentage).toBeGreaterThan(0.5);

      // In real implementation, this would throw an error
      // Here we just verify the calculation works correctly
      expect(feedsToDelete.length).toBe(8);
      expect(localFeeds!.length).toBe(10);
    });

    it('should allow deletion when under safety threshold (≤50%)', async () => {
      // Create 6 feeds
      const feedsData = Array.from({ length: 6 }, (_, i) => ({
        user_id: TEST_USER_ID,
        inoreader_id: `test-rr129-safe-feed-${i}`,
        title: `Safe Test Feed ${i}`,
        url: `https://example.com/safe${i}.xml`,
        unread_count: 1
      }));

      const { data: feeds, error: feedsError } = await supabase
        .from('feeds')
        .insert(feedsData)
        .select();

      expect(feedsError).toBeNull();
      expect(feeds).toHaveLength(6);
      feeds?.forEach(feed => createdFeeds.push(feed.id));

      // Simulate 3 feeds remaining in Inoreader (delete 3/6 = 50%)
      const inoreaderFeedIds = [
        'test-rr129-safe-feed-0', 
        'test-rr129-safe-feed-1', 
        'test-rr129-safe-feed-2'
      ];
      
      const { data: localFeeds } = await supabase
        .from('feeds')
        .select('id, inoreader_id')
        .eq('user_id', TEST_USER_ID)
        .like('inoreader_id', 'test-rr129-safe-%');

      const feedsToDelete = localFeeds?.filter(
        feed => !inoreaderFeedIds.includes(feed.inoreader_id)
      ) || [];

      // Should be safe to delete (50% exactly)
      const deletionPercentage = feedsToDelete.length / localFeeds!.length;
      expect(deletionPercentage).toBe(0.5);

      // Perform the deletion
      const { error: deleteError, count: deletedCount } = await supabase
        .from('feeds')
        .delete()
        .in('inoreader_id', feedsToDelete.map(f => f.inoreader_id));

      expect(deleteError).toBeNull();
      expect(deletedCount).toBe(3);

      // Verify remaining feeds
      const { count: remainingCount } = await supabase
        .from('feeds')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', TEST_USER_ID)
        .like('inoreader_id', 'test-rr129-safe-%');

      expect(remainingCount).toBe(3);

      // Update tracking to only include remaining feeds
      const { data: remainingFeeds } = await supabase
        .from('feeds')
        .select('id')
        .eq('user_id', TEST_USER_ID)
        .like('inoreader_id', 'test-rr129-safe-%');

      createdFeeds.length = 0;
      remainingFeeds?.forEach(feed => createdFeeds.push(feed.id));
    });
  });

  describe('Foreign Key Constraint Validation', () => {
    it('should have proper foreign key constraints between feeds and articles', async () => {
      // Create test feed
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-fk-feed',
          title: 'Foreign Key Test Feed',
          url: 'https://example.com/fk-test.xml',
          unread_count: 1
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Try to create article with non-existent feed_id
      const { error: invalidFeedError } = await supabase
        .from('articles')
        .insert({
          feed_id: 'non-existent-feed-id',
          inoreader_id: 'test-rr129-invalid-feed-article',
          title: 'Invalid Feed Article',
          content: 'This should fail',
          is_read: false,
          is_starred: false
        });

      // Should fail due to foreign key constraint
      expect(invalidFeedError).toBeDefined();
      expect(invalidFeedError!.code).toBe('23503'); // PostgreSQL foreign key violation

      // But valid feed_id should work
      const { data: validArticle, error: validError } = await supabase
        .from('articles')
        .insert({
          feed_id: feed.id,
          inoreader_id: 'test-rr129-valid-feed-article',
          title: 'Valid Feed Article',
          content: 'This should work',
          is_read: false,
          is_starred: false
        })
        .select()
        .single();

      expect(validError).toBeNull();
      expect(validArticle).toBeDefined();
      createdArticles.push(validArticle.id);
    });

    it('should properly CASCADE delete articles when feed is deleted', async () => {
      // Create feed with articles
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-cascade-feed',
          title: 'CASCADE Test Feed',
          url: 'https://example.com/cascade-test.xml',
          unread_count: 2
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Create articles
      const articlesData = [
        {
          feed_id: feed.id,
          inoreader_id: 'test-rr129-cascade-article-1',
          title: 'CASCADE Article 1',
          content: 'Content 1',
          is_read: false,
          is_starred: false
        },
        {
          feed_id: feed.id,
          inoreader_id: 'test-rr129-cascade-article-2',
          title: 'CASCADE Article 2',
          content: 'Content 2',
          is_read: true,
          is_starred: true
        }
      ];

      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .insert(articlesData)
        .select();

      expect(articlesError).toBeNull();
      expect(articles).toHaveLength(2);

      // Get article IDs for verification
      const articleIds = articles!.map(a => a.id);

      // Delete feed
      const { error: deleteError } = await supabase
        .from('feeds')
        .delete()
        .eq('id', feed.id);

      expect(deleteError).toBeNull();

      // Verify articles are automatically deleted
      const { data: remainingArticles } = await supabase
        .from('articles')
        .select('id')
        .in('id', articleIds);

      expect(remainingArticles).toHaveLength(0);

      // Clear tracking since items are deleted
      createdFeeds.length = 0;
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle deletion of feeds with large numbers of articles', async () => {
      // Create feed
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-large-feed',
          title: 'Large Feed Test',
          url: 'https://example.com/large-feed.xml',
          unread_count: 100
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Create many articles (but not too many to avoid test timeout)
      const batchSize = 50;
      const articlesData = Array.from({ length: batchSize }, (_, i) => ({
        feed_id: feed.id,
        inoreader_id: `test-rr129-large-article-${i}`,
        title: `Large Feed Article ${i}`,
        content: `Content for article ${i}`,
        is_read: i % 3 === 0, // Mix of read/unread
        is_starred: i % 10 === 0 // Some starred
      }));

      const { error: articlesError } = await supabase
        .from('articles')
        .insert(articlesData);

      expect(articlesError).toBeNull();

      // Verify articles were created
      const { count: beforeCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('feed_id', feed.id);

      expect(beforeCount).toBe(batchSize);

      // Time the deletion
      const startTime = Date.now();
      
      const { error: deleteError } = await supabase
        .from('feeds')
        .delete()
        .eq('id', feed.id);

      const deleteTime = Date.now() - startTime;

      expect(deleteError).toBeNull();
      expect(deleteTime).toBeLessThan(5000); // Should delete within 5 seconds

      // Verify all articles are gone
      const { count: afterCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('feed_id', feed.id);

      expect(afterCount).toBe(0);

      // Clear tracking
      createdFeeds.length = 0;
    });

    it('should maintain database integrity during concurrent operations', async () => {
      // Create multiple feeds for concurrent testing
      const feedsData = Array.from({ length: 3 }, (_, i) => ({
        user_id: TEST_USER_ID,
        inoreader_id: `test-rr129-concurrent-feed-${i}`,
        title: `Concurrent Test Feed ${i}`,
        url: `https://example.com/concurrent${i}.xml`,
        unread_count: 5
      }));

      const { data: feeds, error: feedsError } = await supabase
        .from('feeds')
        .insert(feedsData)
        .select();

      expect(feedsError).toBeNull();
      feeds?.forEach(feed => createdFeeds.push(feed.id));

      // Create articles for each feed
      const allArticlesData = [];
      for (const feed of feeds!) {
        for (let i = 0; i < 3; i++) {
          allArticlesData.push({
            feed_id: feed.id,
            inoreader_id: `test-rr129-concurrent-article-${feed.inoreader_id}-${i}`,
            title: `Concurrent Article ${i}`,
            content: `Content ${i}`,
            is_read: false,
            is_starred: false
          });
        }
      }

      const { error: articlesError } = await supabase
        .from('articles')
        .insert(allArticlesData);

      expect(articlesError).toBeNull();

      // Perform concurrent deletions
      const deletionPromises = feeds!.map(feed =>
        supabase
          .from('feeds')
          .delete()
          .eq('id', feed.id)
      );

      const results = await Promise.allSettled(deletionPromises);

      // All deletions should succeed
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.error).toBeNull();
        }
      });

      // Verify all articles are deleted
      const { count: remainingArticles } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .in('feed_id', feeds!.map(f => f.id));

      expect(remainingArticles).toBe(0);

      // Clear tracking
      createdFeeds.length = 0;
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle deletion of feeds with no articles', async () => {
      // Create feed without articles
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-empty-feed',
          title: 'Empty Feed Test',
          url: 'https://example.com/empty-feed.xml',
          unread_count: 0
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Delete feed
      const { error: deleteError } = await supabase
        .from('feeds')
        .delete()
        .eq('id', feed.id);

      expect(deleteError).toBeNull();

      // Verify feed is gone
      const { data: remainingFeed } = await supabase
        .from('feeds')
        .select('id')
        .eq('id', feed.id);

      expect(remainingFeed).toHaveLength(0);

      createdFeeds.length = 0;
    });

    it('should handle attempt to delete non-existent feed gracefully', async () => {
      const { error: deleteError, count } = await supabase
        .from('feeds')
        .delete()
        .eq('inoreader_id', 'non-existent-feed-rr129');

      expect(deleteError).toBeNull();
      expect(count).toBe(0);
    });

    it('should maintain referential integrity with folders', async () => {
      // Create test folder first
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-folder',
          name: 'Test Folder RR129'
        })
        .select()
        .single();

      expect(folderError).toBeNull();

      // Create feed in folder
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: 'test-rr129-folder-feed',
          title: 'Folder Feed Test',
          url: 'https://example.com/folder-feed.xml',
          folder_id: folder.id,
          unread_count: 1
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Delete feed
      const { error: deleteError } = await supabase
        .from('feeds')
        .delete()
        .eq('id', feed.id);

      expect(deleteError).toBeNull();

      // Folder should still exist
      const { data: remainingFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folder.id);

      expect(remainingFolder).toHaveLength(1);

      // Clean up folder
      await supabase
        .from('folders')
        .delete()
        .eq('id', folder.id);

      createdFeeds.length = 0;
    });
  });
});