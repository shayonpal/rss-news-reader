import { test, expect } from '@playwright/test';

// E2E tests for RR-148: On-demand content parsing for partial feeds
test.describe('RR-148: On-Demand Content Parsing E2E', () => {
  const baseUrl = 'http://100.96.166.53:3000/reader';

  test.beforeEach(async ({ page }) => {
    // Navigate to the reader and wait for initial load
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Partial Feed Article Opening', () => {
    test('should trigger content parsing when opening partial feed article', async ({ page }) => {
      // Mock scenario where we have a partial feed article
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: '<p>This is the full extracted content from on-demand parsing</p>',
            cached: false,
            title: 'Full Article Title',
            excerpt: 'Full article excerpt',
          }),
        });
      });

      // Wait for article list to load
      await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });

      // Find and click on a partial feed article (mock scenario)
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.waitFor({ state: 'visible' });
      
      // Click to open article
      await firstArticle.click();

      // Should show loading indicator for content parsing
      await expect(page.locator('[data-testid="content-loading"]')).toBeVisible();

      // Wait for full content to load
      await expect(page.locator('[data-testid="article-content"]')).toContainText('full extracted content');

      // Loading indicator should disappear
      await expect(page.locator('[data-testid="content-loading"]')).not.toBeVisible();
    });

    test('should display loading indicator during content parsing', async ({ page }) => {
      // Mock slow parsing response
      await page.route('**/api/articles/*/parse-content', async (route) => {
        // Simulate 2-second parsing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: '<p>Slowly loaded content</p>',
            cached: false,
          }),
        });
      });

      // Open an article that requires parsing
      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should immediately show loading state
      await expect(page.locator('[data-testid="content-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="loading-message"]')).toContainText('Loading full content');

      // Loading should persist for reasonable time
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="content-loading"]')).toBeVisible();

      // Should eventually complete
      await expect(page.locator('[data-testid="article-content"]')).toContainText('Slowly loaded content');
      await expect(page.locator('[data-testid="content-loading"]')).not.toBeVisible();
    });

    test('should show cached content immediately if already parsed', async ({ page }) => {
      // Mock cached content response
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: '<p>Previously cached full content</p>',
            cached: true,
          }),
        });
      });

      // Open article
      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should show content immediately without loading state
      await expect(page.locator('[data-testid="article-content"]')).toContainText('cached full content');
      
      // Loading indicator should not appear for cached content
      await expect(page.locator('[data-testid="content-loading"]')).not.toBeVisible();
    });

    test('should fallback to RSS content when parsing fails', async ({ page }) => {
      // Mock parsing failure
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: 'Original RSS content summary...',
            fallback: true,
          }),
        });
      });

      // Open article
      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should display RSS content as fallback
      await expect(page.locator('[data-testid="article-content"]')).toContainText('Original RSS content');
      
      // Should not show error message to user
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    });
  });

  test.describe('User Experience Flow', () => {
    test('should provide seamless reading experience', async ({ page }) => {
      // Mock article data and parsing
      await page.route('**/api/articles/*', async (route) => {
        if (route.request().url().includes('/parse-content')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              content: '<div><h1>Full Article</h1><p>Complete article content with detailed information...</p></div>',
              cached: false,
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Navigate through article list
      await page.waitForSelector('[data-testid="article-list"]');
      
      // Click on article
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.click();

      // Should transition smoothly to article view
      await expect(page.locator('[data-testid="article-detail"]')).toBeVisible();
      
      // Content should load and be readable
      await expect(page.locator('[data-testid="article-content"]')).toContainText('Complete article content');

      // Should maintain proper formatting
      await expect(page.locator('[data-testid="article-content"] h1')).toContainText('Full Article');
    });

    test('should handle multiple rapid article opens gracefully', async ({ page }) => {
      let requestCount = 0;
      
      // Mock parsing with request tracking
      await page.route('**/api/articles/*/parse-content', async (route) => {
        requestCount++;
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: `<p>Article content ${requestCount}</p>`,
            cached: false,
          }),
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      
      // Rapidly click multiple articles
      const articles = page.locator('[data-testid="article-item"]');
      const articleCount = Math.min(3, await articles.count());
      
      for (let i = 0; i < articleCount; i++) {
        await articles.nth(i).click();
        await page.waitForTimeout(500); // Brief pause between clicks
      }

      // Should handle requests without errors
      expect(requestCount).toBeLessThanOrEqual(5); // Rate limiting should prevent excessive requests
    });

    test('should work correctly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: '<p>Mobile-optimized full content</p>',
            cached: false,
          }),
        });
      });

      await page.goto(baseUrl);
      await page.waitForSelector('[data-testid="article-list"]');

      // Tap on article
      const article = page.locator('[data-testid="article-item"]').first();
      await article.tap();

      // Should show loading indicator appropriately on mobile
      await expect(page.locator('[data-testid="content-loading"]')).toBeVisible();
      
      // Content should load and be readable on mobile
      await expect(page.locator('[data-testid="article-content"]')).toContainText('Mobile-optimized');
      
      // Should handle mobile interactions properly
      await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should complete parsing within performance target', async ({ page }) => {
      const startTime = Date.now();
      
      await page.route('**/api/articles/*/parse-content', async (route) => {
        // Simulate realistic parsing time (2.5 seconds - within target)
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: '<p>Performance-tested content</p>',
            cached: false,
          }),
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Wait for content to appear
      await expect(page.locator('[data-testid="article-content"]')).toContainText('Performance-tested');
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within reasonable time (allowing for UI overhead)
      expect(totalTime).toBeLessThan(4000); // 4 seconds max including UI
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.abort('connectionfailed');
      });

      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should show fallback content instead of error
      await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
      
      // Should not show network error to user
      await expect(page.locator('[data-testid="network-error"]')).not.toBeVisible();
    });

    test('should maintain service worker functionality', async ({ page }) => {
      // Register service worker if not already registered
      await page.evaluate(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js');
        }
      });

      // Mock offline scenario
      await page.context().setOffline(true);

      await page.route('**/api/articles/*/parse-content', async (route) => {
        // Simulate offline - should fallback to cached RSS content
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: 'Cached RSS content (offline)',
            fallback: true,
            offline: true,
          }),
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should show cached content when offline
      await expect(page.locator('[data-testid="article-content"]')).toContainText('offline');
      
      // Go back online
      await page.context().setOffline(false);
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle articles without URLs', async ({ page }) => {
      // Mock article without URL
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'no_url',
            message: 'Article has no URL to fetch',
          }),
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should show RSS content as fallback
      await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
      
      // Should not show error message to user
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    });

    test('should handle timeout scenarios', async ({ page }) => {
      // Mock timeout response
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'timeout',
            message: 'Request timed out while fetching article',
          }),
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should fallback gracefully without showing timeout error
      await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
    });

    test('should handle malformed response data', async ({ page }) => {
      // Mock malformed JSON response
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json response',
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Should handle gracefully and show fallback content
      await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
    });

    test('should handle concurrent parsing requests', async ({ page }) => {
      let concurrentRequests = 0;
      const maxConcurrent = 3;
      
      await page.route('**/api/articles/*/parse-content', async (route) => {
        concurrentRequests++;
        
        if (concurrentRequests > maxConcurrent) {
          // Rate limited
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'rate_limit',
              message: 'Too many requests',
            }),
          });
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              content: `<p>Concurrent request ${concurrentRequests}</p>`,
            }),
          });
        }
        
        concurrentRequests--;
      });

      await page.waitForSelector('[data-testid="article-list"]');
      
      // Try to open multiple articles rapidly
      const articles = page.locator('[data-testid="article-item"]');
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(articles.nth(i % 3).click());
      }
      
      await Promise.allSettled(promises);
      
      // Should handle all requests without breaking
      await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should maintain accessibility during content loading', async ({ page }) => {
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: '<p>Accessible content loaded</p>',
          }),
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      const article = page.locator('[data-testid="article-item"]').first();
      await article.click();

      // Loading state should be announced to screen readers
      const loadingElement = page.locator('[data-testid="content-loading"]');
      await expect(loadingElement).toHaveAttribute('aria-live', 'polite');
      await expect(loadingElement).toHaveAttribute('role', 'status');

      // Content should be properly structured for accessibility
      await expect(page.locator('[data-testid="article-content"]')).toContainText('Accessible content');
    });

    test('should support keyboard navigation during parsing', async ({ page }) => {
      await page.route('**/api/articles/*/parse-content', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            content: '<p>Keyboard-accessible content</p>',
          }),
        });
      });

      await page.waitForSelector('[data-testid="article-list"]');
      
      // Navigate using keyboard
      await page.keyboard.press('Tab'); // Focus first article
      await page.keyboard.press('Enter'); // Open article

      // Should maintain keyboard focus during loading
      await expect(page.locator('[data-testid="article-detail"]')).toBeFocused();

      // Content should be keyboard accessible
      await expect(page.locator('[data-testid="article-content"]')).toContainText('Keyboard-accessible');
    });
  });
});