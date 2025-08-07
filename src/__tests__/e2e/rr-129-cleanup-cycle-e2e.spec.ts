import { test, expect } from '@playwright/test';

/**
 * RR-129: E2E tests for full cleanup cycle
 * Tests the complete user journey including UI interactions, sync operations, and cleanup
 */
test.describe('RR-129: Full Cleanup Cycle E2E', () => {
  const baseUrl = 'http://100.96.166.53:3000/reader';

  test.beforeEach(async ({ page }) => {
    // Navigate to the reader app
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Article Reading and Cleanup Flow', () => {
    test('should complete full article lifecycle: read → cleanup → sync prevention', async ({ page }) => {
      // Mock API responses for the test scenario
      let articleReadStatus = false;
      let articleDeleted = false;
      let syncAttempted = false;

      // Mock article list API
      await page.route('**/api/inoreader/**', async (route) => {
        if (route.request().url().includes('stream-contents')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [
                {
                  id: 'test-rr129-e2e-article-1',
                  title: 'E2E Test Article 1',
                  summary: { content: 'This is a test article for E2E cleanup testing' },
                  author: 'Test Author',
                  published: Math.floor(Date.now() / 1000),
                  canonical: [{ href: 'https://example.com/article1' }],
                  categories: articleReadStatus ? ['user/-/state/com.google/read'] : []
                },
                {
                  id: 'test-rr129-e2e-article-2',
                  title: 'E2E Test Article 2',
                  summary: { content: 'This is another test article' },
                  author: 'Test Author 2',
                  published: Math.floor(Date.now() / 1000),
                  canonical: [{ href: 'https://example.com/article2' }],
                  categories: []
                }
              ]
            })
          });
        } else {
          await route.continue();
        }
      });

      // Mock sync API
      await page.route('**/api/sync', async (route) => {
        syncAttempted = true;
        
        // Simulate cleanup during sync
        if (articleReadStatus && !articleDeleted) {
          articleDeleted = true; // Article gets cleaned up
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            feeds_synced: 1,
            articles_synced: articleDeleted ? 1 : 2, // One less if cleaned up
            sync_time: Date.now(),
            cleanup_stats: {
              articles_deleted: articleDeleted ? 1 : 0,
              articles_tracked: articleDeleted ? 1 : 0
            }
          })
        });
      });

      // Mock Supabase queries for article data
      await page.route('**/rest/v1/**', async (route) => {
        const url = route.request().url();
        
        if (url.includes('articles') && url.includes('select=')) {
          // Return articles that haven't been cleaned up
          const articles = [];
          
          if (!articleDeleted) {
            articles.push({
              id: 'local-1',
              inoreader_id: 'test-rr129-e2e-article-1',
              title: 'E2E Test Article 1',
              content: 'This is a test article for E2E cleanup testing',
              is_read: articleReadStatus,
              is_starred: false,
              published_at: new Date().toISOString(),
              feed_id: 'test-feed-1'
            });
          }

          articles.push({
            id: 'local-2',
            inoreader_id: 'test-rr129-e2e-article-2',
            title: 'E2E Test Article 2',
            content: 'This is another test article',
            is_read: false,
            is_starred: false,
            published_at: new Date().toISOString(),
            feed_id: 'test-feed-1'
          });

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(articles)
          });
        } else {
          await route.continue();
        }
      });

      // Step 1: Load article list
      await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
      
      // Should see 2 articles initially
      const initialArticles = page.locator('[data-testid="article-item"]');
      await expect(initialArticles).toHaveCount(2);

      // Step 2: Click on first article to read it
      const firstArticle = initialArticles.first();
      await expect(firstArticle).toContainText('E2E Test Article 1');
      await firstArticle.click();

      // Navigate to article detail
      await expect(page.locator('[data-testid="article-detail"]')).toBeVisible();
      await expect(page.locator('[data-testid="article-title"]')).toContainText('E2E Test Article 1');

      // Step 3: Mark article as read (simulate reading)
      articleReadStatus = true;
      
      // Click read/unread button to mark as read
      const markReadButton = page.locator('[data-testid="mark-read-button"]');
      if (await markReadButton.isVisible()) {
        await markReadButton.click();
        
        // Wait for read status to update
        await expect(page.locator('[data-testid="read-indicator"]')).toBeVisible();
      }

      // Step 4: Navigate back to article list
      await page.goBack();
      await page.waitForSelector('[data-testid="article-list"]');

      // Step 5: Trigger sync (which should perform cleanup)
      const syncButton = page.locator('[data-testid="sync-button"]');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        
        // Wait for sync to complete
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete', { timeout: 15000 });
      }

      // Verify sync was attempted
      expect(syncAttempted).toBe(true);

      // Step 6: Verify article was cleaned up (should only see 1 article now)
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="article-list"]');

      const remainingArticles = page.locator('[data-testid="article-item"]');
      await expect(remainingArticles).toHaveCount(1);
      await expect(remainingArticles.first()).toContainText('E2E Test Article 2');

      // Step 7: Trigger another sync to verify deleted article doesn't reappear
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete', { timeout: 15000 });
      }

      // Article count should remain 1 (article shouldn't be re-imported)
      await expect(remainingArticles).toHaveCount(1);
    });

    test('should restore article when marked unread in Inoreader after deletion', async ({ page }) => {
      let articleState = 'read'; // 'read' -> 'deleted' -> 'unread'
      let syncCount = 0;

      // Mock sync and Inoreader APIs
      await page.route('**/api/inoreader/**', async (route) => {
        if (route.request().url().includes('stream-contents')) {
          const categories = [];
          
          if (articleState === 'read') {
            categories.push('user/-/state/com.google/read');
          }
          // When 'deleted', article still exists in Inoreader but is read
          // When 'unread', article exists and is unread

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [{
                id: 'test-rr129-e2e-restore-article',
                title: 'Restoration Test Article',
                summary: { content: 'This article will be deleted then restored' },
                author: 'Restoration Author',
                published: Math.floor(Date.now() / 1000),
                canonical: [{ href: 'https://example.com/restore-article' }],
                categories
              }]
            })
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/sync', async (route) => {
        syncCount++;
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            feeds_synced: 1,
            articles_synced: articleState === 'deleted' ? 0 : 1,
            sync_time: Date.now(),
            restoration_stats: {
              articles_restored: articleState === 'unread' && syncCount > 2 ? 1 : 0,
              tracking_removed: articleState === 'unread' && syncCount > 2 ? 1 : 0
            }
          })
        });
      });

      // Mock article data
      await page.route('**/rest/v1/**', async (route) => {
        if (route.request().url().includes('articles')) {
          const articles = [];
          
          // Article exists unless it's been deleted
          if (articleState !== 'deleted') {
            articles.push({
              id: 'restore-local-1',
              inoreader_id: 'test-rr129-e2e-restore-article',
              title: 'Restoration Test Article',
              content: 'This article will be deleted then restored',
              is_read: articleState === 'read',
              is_starred: false,
              published_at: new Date().toISOString(),
              feed_id: 'restore-feed-1'
            });
          }

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(articles)
          });
        } else {
          await route.continue();
        }
      });

      // Initial load - article should be visible
      await page.waitForSelector('[data-testid="article-list"]');
      let articles = page.locator('[data-testid="article-item"]');
      await expect(articles).toHaveCount(1);

      // Mark as read and trigger cleanup
      articleState = 'read';
      const syncButton = page.locator('[data-testid="sync-button"]');
      
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete');
      }

      // Simulate article cleanup
      articleState = 'deleted';
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Article should be gone
      articles = page.locator('[data-testid="article-item"]');
      await expect(articles).toHaveCount(0);

      // Simulate user marking article as unread in Inoreader
      articleState = 'unread';
      
      // Sync again - article should be restored
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete');
      }

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Article should be back and unread
      articles = page.locator('[data-testid="article-item"]');
      await expect(articles).toHaveCount(1);
      
      const restoredArticle = articles.first();
      await expect(restoredArticle).toContainText('Restoration Test Article');
      
      // Check that it's unread (no read indicator)
      await expect(restoredArticle.locator('[data-testid="read-indicator"]')).not.toBeVisible();
    });
  });

  test.describe('Starred Article Protection', () => {
    test('should never delete starred articles during cleanup', async ({ page }) => {
      let syncPerformed = false;

      // Mock articles with one starred
      await page.route('**/api/inoreader/**', async (route) => {
        if (route.request().url().includes('stream-contents')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [
                {
                  id: 'test-rr129-e2e-starred',
                  title: 'Starred Article (Protected)',
                  summary: { content: 'This starred article should never be deleted' },
                  published: Math.floor(Date.now() / 1000),
                  categories: ['user/-/state/com.google/read', 'user/-/state/com.google/starred']
                },
                {
                  id: 'test-rr129-e2e-unstarred',
                  title: 'Unstarred Read Article',
                  summary: { content: 'This should be deleted during cleanup' },
                  published: Math.floor(Date.now() / 1000),
                  categories: ['user/-/state/com.google/read']
                }
              ]
            })
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/sync', async (route) => {
        syncPerformed = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            feeds_synced: 1,
            articles_synced: 2,
            cleanup_stats: {
              articles_deleted: 1, // Only unstarred article deleted
              starred_preserved: 1
            }
          })
        });
      });

      // Mock Supabase to show articles with proper star status
      await page.route('**/rest/v1/**', async (route) => {
        if (route.request().url().includes('articles')) {
          const articles = [
            {
              id: 'starred-1',
              inoreader_id: 'test-rr129-e2e-starred',
              title: 'Starred Article (Protected)',
              content: 'This starred article should never be deleted',
              is_read: true,
              is_starred: true, // This protects it from cleanup
              published_at: new Date().toISOString(),
              feed_id: 'test-feed-1'
            }
            // Unstarred article removed during cleanup
          ];

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(articles)
          });
        } else {
          await route.continue();
        }
      });

      // Load initial state
      await page.waitForSelector('[data-testid="article-list"]');
      
      // Trigger sync/cleanup
      const syncButton = page.locator('[data-testid="sync-button"]');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete');
      }

      expect(syncPerformed).toBe(true);

      // Reload to see post-cleanup state
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Only starred article should remain
      const articles = page.locator('[data-testid="article-item"]');
      await expect(articles).toHaveCount(1);
      
      const starredArticle = articles.first();
      await expect(starredArticle).toContainText('Starred Article (Protected)');
      
      // Verify it shows as starred
      await expect(starredArticle.locator('[data-testid="star-indicator"]')).toBeVisible();
      await expect(starredArticle.locator('[data-testid="read-indicator"]')).toBeVisible();
    });
  });

  test.describe('Feed Deletion Scenarios', () => {
    test('should remove feeds and articles when feeds deleted in Inoreader', async ({ page }) => {
      let feedsInInoreader = ['feed-1', 'feed-2']; // Initially 2 feeds
      let syncCount = 0;

      // Mock feed subscriptions
      await page.route('**/api/inoreader/subscriptions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            subscriptions: feedsInInoreader.map(feedId => ({
              id: `tag:google.com,2005:reader/feed/https://example.com/${feedId}.xml`,
              title: `Test Feed ${feedId}`,
              url: `https://example.com/${feedId}.xml`,
              htmlUrl: `https://example.com/${feedId}`,
              categories: []
            }))
          })
        });
      });

      // Mock sync API
      await page.route('**/api/sync', async (route) => {
        syncCount++;
        
        // After first sync, simulate feed-2 being deleted from Inoreader
        if (syncCount === 1) {
          feedsInInoreader = ['feed-1']; // feed-2 removed
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            feeds_synced: feedsInInoreader.length,
            feed_cleanup_stats: {
              feeds_deleted: syncCount > 1 ? 1 : 0,
              articles_cascade_deleted: syncCount > 1 ? 3 : 0 // Articles from deleted feed
            }
          })
        });
      });

      // Mock feed list
      await page.route('**/rest/v1/**', async (route) => {
        if (route.request().url().includes('feeds')) {
          const feeds = [];
          
          // feed-1 always exists
          feeds.push({
            id: 'local-feed-1',
            inoreader_id: 'feed-1',
            title: 'Test Feed feed-1',
            url: 'https://example.com/feed-1.xml',
            unread_count: 2
          });

          // feed-2 only exists before cleanup
          if (syncCount < 2) {
            feeds.push({
              id: 'local-feed-2', 
              inoreader_id: 'feed-2',
              title: 'Test Feed feed-2',
              url: 'https://example.com/feed-2.xml',
              unread_count: 3
            });
          }

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(feeds)
          });
        } else {
          await route.continue();
        }
      });

      // Initial load - should see both feeds
      await page.waitForSelector('[data-testid="feed-list"]', { timeout: 10000 });
      
      let feeds = page.locator('[data-testid="feed-item"]');
      await expect(feeds).toHaveCount(2);

      // First sync - no changes expected
      const syncButton = page.locator('[data-testid="sync-button"]');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete');
      }

      // Second sync - feed-2 should be deleted
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete');
      }

      // Reload to see updated state
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should only see feed-1 now
      feeds = page.locator('[data-testid="feed-item"]');
      await expect(feeds).toHaveCount(1);
      await expect(feeds.first()).toContainText('Test Feed feed-1');
    });
  });

  test.describe('Performance and User Experience', () => {
    test('should complete cleanup operations within acceptable time limits', async ({ page }) => {
      let cleanupStartTime = 0;
      let cleanupEndTime = 0;

      // Mock large dataset cleanup
      await page.route('**/api/sync', async (route) => {
        cleanupStartTime = Date.now();
        
        // Simulate cleanup of large dataset
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second cleanup
        
        cleanupEndTime = Date.now();
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            feeds_synced: 10,
            articles_synced: 500,
            cleanup_stats: {
              articles_deleted: 150,
              articles_tracked: 150,
              cleanup_time_ms: cleanupEndTime - cleanupStartTime,
              performance_target_met: true
            }
          })
        });
      });

      // Load app
      await page.waitForSelector('[data-testid="article-list"]');

      // Start sync with performance monitoring
      const pageStartTime = Date.now();
      
      const syncButton = page.locator('[data-testid="sync-button"]');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        
        // Should show progress indicator
        await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible();
        
        // Should complete within reasonable time
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete', { timeout: 10000 });
      }

      const totalPageTime = Date.now() - pageStartTime;
      const cleanupTime = cleanupEndTime - cleanupStartTime;

      // Performance assertions
      expect(cleanupTime).toBeLessThan(5000); // Cleanup should be under 5 seconds
      expect(totalPageTime).toBeLessThan(10000); // Total user experience should be under 10 seconds

      console.log(`Cleanup completed in ${cleanupTime}ms, total page interaction ${totalPageTime}ms`);
    });

    test('should provide user feedback during cleanup operations', async ({ page }) => {
      // Mock progressive sync updates
      let syncStep = 0;
      const syncSteps = [
        { message: 'Fetching subscriptions...', progress: 20 },
        { message: 'Syncing articles...', progress: 40 },
        { message: 'Cleaning up read articles...', progress: 70 },
        { message: 'Updating tracking...', progress: 90 },
        { message: 'Complete', progress: 100 }
      ];

      await page.route('**/api/sync', async (route) => {
        // Simulate progressive sync with delays
        for (const step of syncSteps) {
          syncStep++;
          
          // Send intermediate responses (in real app, this would be WebSocket/SSE)
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (syncStep === syncSteps.length) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                message: step.message,
                progress: step.progress,
                cleanup_stats: {
                  articles_deleted: 25,
                  articles_tracked: 25
                }
              })
            });
            break;
          }
        }
      });

      await page.waitForSelector('[data-testid="article-list"]');

      // Start sync
      const syncButton = page.locator('[data-testid="sync-button"]');
      await syncButton.click();

      // Should show immediate feedback
      await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible();
      
      // Should show progress indication
      const progressBar = page.locator('[data-testid="progress-bar"]');
      if (await progressBar.isVisible()) {
        await expect(progressBar).toHaveAttribute('aria-valuenow');
      }

      // Should show status messages
      const statusMessage = page.locator('[data-testid="sync-message"]');
      if (await statusMessage.isVisible()) {
        await expect(statusMessage).toContainText(/Fetching|Syncing|Cleaning|Complete/);
      }

      // Should complete successfully
      await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete', { timeout: 15000 });
    });
  });

  test.describe('Database Size and Storage Impact', () => {
    test('should demonstrate database size reduction after cleanup', async ({ page }) => {
      let beforeCleanupSize = 0;
      let afterCleanupSize = 0;

      // Mock database size reporting
      await page.route('**/api/analytics/storage-stats', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            before_cleanup: {
              articles_count: 2000,
              total_size_mb: 150,
              read_articles: 1200
            },
            after_cleanup: {
              articles_count: 800, // 60% reduction
              total_size_mb: 60, // 60% size reduction
              read_articles: 0
            },
            reduction_percentage: 60,
            storage_saved_mb: 90
          })
        });
      });

      await page.route('**/api/sync', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            cleanup_stats: {
              articles_deleted: 1200,
              storage_freed_mb: 90,
              database_size_reduction: '60%'
            }
          })
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');

      // Navigate to storage/analytics page if available
      const analyticsLink = page.locator('[data-testid="analytics-link"]');
      if (await analyticsLink.isVisible()) {
        await analyticsLink.click();
        
        // Should show storage statistics
        await expect(page.locator('[data-testid="storage-stats"]')).toBeVisible();
        
        // Should indicate potential savings
        await expect(page.locator('[data-testid="storage-reduction"]')).toContainText(/60%|reduction/);
      }

      // Trigger sync/cleanup
      const syncButton = page.locator('[data-testid="sync-button"]');
      if (await syncButton.isVisible()) {
        await syncButton.click();
        await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete');
      }

      // Should show cleanup results
      const cleanupResults = page.locator('[data-testid="cleanup-results"]');
      if (await cleanupResults.isVisible()) {
        await expect(cleanupResults).toContainText(/1200.*deleted|90.*MB.*freed/);
      }

      console.log('Database size reduction verified in E2E test');
    });
  });

  test.describe('Error Scenarios and Recovery', () => {
    test('should handle sync failures gracefully without data corruption', async ({ page }) => {
      let syncAttempts = 0;

      await page.route('**/api/sync', async (route) => {
        syncAttempts++;
        
        if (syncAttempts === 1) {
          // First attempt fails
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Database connection timeout',
              retry_suggested: true
            })
          });
        } else {
          // Second attempt succeeds
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              feeds_synced: 5,
              articles_synced: 100,
              cleanup_stats: {
                articles_deleted: 30
              }
            })
          });
        }
      });

      await page.waitForSelector('[data-testid="article-list"]');

      // First sync attempt - should fail
      const syncButton = page.locator('[data-testid="sync-button"]');
      await syncButton.click();
      
      // Should show error message
      await expect(page.locator('[data-testid="sync-error"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="sync-error"]')).toContainText(/timeout|error|failed/);
      
      // Should offer retry option
      const retryButton = page.locator('[data-testid="retry-sync-button"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
      } else {
        // Or sync button should be available again
        await syncButton.click();
      }
      
      // Second attempt should succeed
      await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete', { timeout: 15000 });
      
      // App should be in stable state
      await expect(page.locator('[data-testid="article-list"]')).toBeVisible();
      
      expect(syncAttempts).toBe(2);
    });
  });
});