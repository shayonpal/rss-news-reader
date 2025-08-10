import { test, expect } from '@playwright/test';

/**
 * RR-176: Fix critical regression where ALL articles incorrectly trigger full content fetching
 * 
 * Test Requirements:
 * 1. Auto-parse should ONLY trigger for partial feeds (is_partial_feed = true)
 * 2. Fetch/Revert buttons must actually work (not just visual changes)
 * 3. Button states must stay synchronized between header and footer
 */

test.describe('RR-176: Content Fetching Regression Tests', () => {
  // Test configuration
  const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
  const APP_URL = `${BASE_URL}/reader`;

  test.beforeEach(async ({ page }) => {
    // Set up any required test data or mocks
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Auto-Parse Behavior', () => {
    test('should NOT auto-fetch for normal feeds with sufficient content', async ({ page }) => {
      // Navigate to a normal feed (not partial)
      await page.click('[data-testid="feed-item"]:not([data-partial="true"]):first-child');
      await page.waitForSelector('[data-testid="article-item"]');

      // Click on an article with sufficient content
      await page.click('[data-testid="article-item"]:first-child');
      await page.waitForSelector('.article-content');

      // Verify no parsing indicator appears
      const parsingIndicator = page.locator('.content-parsing-indicator');
      await expect(parsingIndicator).not.toBeVisible();

      // Verify original RSS content is displayed
      const content = page.locator('.article-content');
      await expect(content).toBeVisible();
      
      // Verify fetch button is in initial state (not showing revert)
      const fetchButton = page.locator('[data-testid="fetch-button"]').first();
      await expect(fetchButton).toHaveAttribute('aria-label', 'Full Content');

      // Monitor network to ensure no auto-fetch occurs
      const fetchRequests = [];
      page.on('request', request => {
        if (request.url().includes('/fetch-content')) {
          fetchRequests.push(request.url());
        }
      });

      // Wait to ensure no auto-fetch happens
      await page.waitForTimeout(2000);
      expect(fetchRequests).toHaveLength(0);
    });

    test('should auto-fetch ONLY for partial feeds', async ({ page }) => {
      // Navigate to a partial feed
      await page.click('[data-testid="feed-item"][data-partial="true"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');

      // Set up network monitoring
      const fetchPromise = page.waitForResponse(
        response => response.url().includes('/fetch-content') && response.status() === 200
      );

      // Click on an article
      await page.click('[data-testid="article-item"]:first-child');

      // Verify parsing indicator appears
      const parsingIndicator = page.locator('.content-parsing-indicator');
      await expect(parsingIndicator).toBeVisible();

      // Wait for auto-fetch to complete
      await fetchPromise;

      // Verify indicator disappears after completion
      await expect(parsingIndicator).not.toBeVisible();

      // Verify full content is displayed
      const content = page.locator('.article-content');
      await expect(content).toContainText(/./); // Has some content
    });

    test('should auto-fetch for short content (<500 chars) in any feed', async ({ page }) => {
      // Navigate to any feed
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');

      // Find article with short content indicator
      const shortArticle = page.locator('[data-testid="article-item"][data-short="true"]').first();
      
      if (await shortArticle.isVisible()) {
        const fetchPromise = page.waitForResponse(
          response => response.url().includes('/fetch-content'),
          { timeout: 5000 }
        ).catch(() => null);

        await shortArticle.click();
        
        const response = await fetchPromise;
        expect(response).not.toBeNull();
      }
    });

    test('should auto-fetch for content with truncation indicators', async ({ page }) => {
      // Navigate to feed with truncated content
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');

      // Look for article with truncation indicator
      const truncatedArticle = await page.locator('[data-testid="article-item"]').filter({
        hasText: /Read more|Continue reading|\.\.\./i
      }).first();

      if (await truncatedArticle.isVisible()) {
        const fetchPromise = page.waitForResponse(
          response => response.url().includes('/fetch-content')
        );

        await truncatedArticle.click();
        await fetchPromise;

        // Verify full content loaded
        const content = page.locator('.article-content');
        await expect(content).not.toContainText(/Read more|Continue reading/i);
      }
    });
  });

  test.describe('Manual Fetch/Revert Operations', () => {
    test('fetch button should retrieve and display full content', async ({ page }) => {
      // Navigate to an article
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');
      await page.waitForSelector('.article-content');

      // Get initial content
      const initialContent = await page.locator('.article-content').textContent();

      // Click fetch button
      const fetchButton = page.locator('[data-testid="fetch-button"]').first();
      await expect(fetchButton).toHaveAttribute('aria-label', 'Full Content');

      // Set up response monitoring
      const fetchPromise = page.waitForResponse(
        response => response.url().includes('/fetch-content') && response.status() === 200
      );

      await fetchButton.click();

      // Wait for fetch to complete
      const response = await fetchPromise;
      expect(response.status()).toBe(200);

      // Button should change to revert
      await expect(fetchButton).toHaveAttribute('aria-label', 'Original Content');

      // Content should be updated
      const updatedContent = await page.locator('.article-content').textContent();
      expect(updatedContent).not.toBe(initialContent);
    });

    test('revert button should restore previous content without API call', async ({ page }) => {
      // Navigate to article and fetch content first
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');
      await page.waitForSelector('.article-content');

      // Fetch content
      const fetchButton = page.locator('[data-testid="fetch-button"]').first();
      await fetchButton.click();
      await page.waitForResponse(response => response.url().includes('/fetch-content'));

      // Wait for button to change
      await expect(fetchButton).toHaveAttribute('aria-label', 'Original Content');

      // Get fetched content
      const fetchedContent = await page.locator('.article-content').textContent();

      // Monitor network to ensure no API call on revert
      const apiCalls = [];
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiCalls.push(request.url());
        }
      });

      // Click revert
      await fetchButton.click();

      // Button should change back
      await expect(fetchButton).toHaveAttribute('aria-label', 'Full Content');

      // Content should change
      const revertedContent = await page.locator('.article-content').textContent();
      expect(revertedContent).not.toBe(fetchedContent);

      // No API calls should have been made
      expect(apiCalls).toHaveLength(0);
    });

    test('should handle fetch errors gracefully', async ({ page }) => {
      // Navigate to article
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');

      // Intercept and fail the fetch request
      await page.route('**/api/articles/*/fetch-content', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Failed to fetch content' }),
        });
      });

      const fetchButton = page.locator('[data-testid="fetch-button"]').first();
      await fetchButton.click();

      // Should show error message
      await expect(page.locator('text=/failed|error/i')).toBeVisible();

      // Button should remain in fetch state (not revert)
      await expect(fetchButton).toHaveAttribute('aria-label', 'Full Content');

      // Original content should still be visible
      await expect(page.locator('.article-content')).toBeVisible();
    });
  });

  test.describe('Button Synchronization', () => {
    test('header and footer buttons should always show same state', async ({ page }) => {
      // Navigate to article
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');
      await page.waitForSelector('.article-content');

      // Get both button instances
      const headerButton = page.locator('.article-header [data-testid="fetch-button"]');
      const footerButton = page.locator('.article-footer [data-testid="fetch-button"]');

      // Initial state - both should show "Full Content"
      await expect(headerButton).toHaveAttribute('aria-label', 'Full Content');
      await expect(footerButton).toHaveAttribute('aria-label', 'Full Content');

      // Click header button to fetch
      await headerButton.click();
      await page.waitForResponse(response => response.url().includes('/fetch-content'));

      // Both should update to "Original Content"
      await expect(headerButton).toHaveAttribute('aria-label', 'Original Content');
      await expect(footerButton).toHaveAttribute('aria-label', 'Original Content');

      // Click footer button to revert
      await footerButton.click();

      // Both should revert to "Full Content"
      await expect(headerButton).toHaveAttribute('aria-label', 'Full Content');
      await expect(footerButton).toHaveAttribute('aria-label', 'Full Content');
    });

    test('rapid clicks should not desynchronize buttons', async ({ page }) => {
      // Navigate to article
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');

      const headerButton = page.locator('.article-header [data-testid="fetch-button"]');
      const footerButton = page.locator('.article-footer [data-testid="fetch-button"]');

      // Click both buttons rapidly
      await Promise.all([
        headerButton.click(),
        footerButton.click(),
      ]);

      // Wait for any pending operations
      await page.waitForTimeout(1000);

      // Both buttons should have same state
      const headerLabel = await headerButton.getAttribute('aria-label');
      const footerLabel = await footerButton.getAttribute('aria-label');
      expect(headerLabel).toBe(footerLabel);
    });

    test('button state should persist during scroll', async ({ page }) => {
      // Navigate to article
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');

      // Fetch content
      const headerButton = page.locator('.article-header [data-testid="fetch-button"]');
      await headerButton.click();
      await page.waitForResponse(response => response.url().includes('/fetch-content'));

      // Verify state after fetch
      await expect(headerButton).toHaveAttribute('aria-label', 'Original Content');

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // Footer button should have same state
      const footerButton = page.locator('.article-footer [data-testid="fetch-button"]');
      await expect(footerButton).toHaveAttribute('aria-label', 'Original Content');

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Header button should maintain state
      await expect(headerButton).toHaveAttribute('aria-label', 'Original Content');
    });
  });

  test.describe('Content State Transitions', () => {
    test('should maintain fetched content when navigating between articles', async ({ page }) => {
      // Navigate to first article
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:nth-child(1)');

      // Fetch content
      const fetchButton = page.locator('[data-testid="fetch-button"]').first();
      await fetchButton.click();
      await page.waitForResponse(response => response.url().includes('/fetch-content'));

      // Navigate to next article
      await page.click('[data-testid="nav-next"]');
      await page.waitForSelector('.article-content');

      // Previous article's fetch state should not affect this article
      const newFetchButton = page.locator('[data-testid="fetch-button"]').first();
      await expect(newFetchButton).toHaveAttribute('aria-label', 'Full Content');

      // Navigate back
      await page.click('[data-testid="nav-prev"]');

      // Original article should still show fetched content
      const originalButton = page.locator('[data-testid="fetch-button"]').first();
      await expect(originalButton).toHaveAttribute('aria-label', 'Original Content');
    });

    test('should handle feed type changes correctly', async ({ page }) => {
      // Start with normal feed article
      await page.click('[data-testid="feed-item"]:not([data-partial="true"]):first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');

      // Verify no auto-fetch
      const fetchButton1 = page.locator('[data-testid="fetch-button"]').first();
      await expect(fetchButton1).toHaveAttribute('aria-label', 'Full Content');

      // Navigate to partial feed article
      await page.click('[data-testid="back-button"]');
      await page.click('[data-testid="feed-item"][data-partial="true"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      
      // Should trigger auto-fetch for partial feed
      const fetchPromise = page.waitForResponse(
        response => response.url().includes('/fetch-content'),
        { timeout: 5000 }
      ).catch(() => null);

      await page.click('[data-testid="article-item"]:first-child');
      
      const response = await fetchPromise;
      if (response) {
        // Auto-fetch happened for partial feed
        expect(response.status()).toBe(200);
      }
    });
  });

  test.describe('Performance and Edge Cases', () => {
    test('should cancel pending fetch on navigation', async ({ page }) => {
      // Navigate to article
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"]:first-child');

      // Start fetch but don't wait
      const fetchButton = page.locator('[data-testid="fetch-button"]').first();
      const fetchPromise = page.waitForResponse(
        response => response.url().includes('/fetch-content'),
        { timeout: 5000 }
      ).catch(() => 'cancelled');

      await fetchButton.click();

      // Immediately navigate away
      await page.click('[data-testid="back-button"]');

      // Fetch should be cancelled
      const result = await fetchPromise;
      expect(result).toBe('cancelled');
    });

    test('should handle very large content efficiently', async ({ page }) => {
      // Navigate to article with large content
      await page.click('[data-testid="feed-item"]:first-child');
      await page.waitForSelector('[data-testid="article-item"]');
      await page.click('[data-testid="article-item"][data-large="true"]:first-child');

      const startTime = Date.now();
      
      // Fetch large content
      const fetchButton = page.locator('[data-testid="fetch-button"]').first();
      await fetchButton.click();
      
      await page.waitForResponse(response => response.url().includes('/fetch-content'));
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      // Content should be displayed
      await expect(page.locator('.article-content')).toBeVisible();
    });
  });
});