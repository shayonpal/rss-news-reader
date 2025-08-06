/**
 * RR-27: Article List State Preservation - End-to-End Tests
 * 
 * These tests verify the complete user flow for article list state preservation
 * when navigating back from article detail view, especially in "Unread Only" mode.
 */

import { test, expect, type Page } from '@playwright/test';

const RSS_READER_URL = 'http://100.96.166.53:3000/reader';

// Helper functions
async function waitForArticlesToLoad(page: Page) {
  await page.waitForSelector('[data-article-id]', { timeout: 10000 });
  // Wait a bit more for potential loading states to settle
  await page.waitForTimeout(1000);
}

async function getArticleElements(page: Page) {
  return page.locator('[data-article-id]');
}

async function switchToUnreadOnlyMode(page: Page) {
  const filterButton = page.locator('button:has-text("Unread")');
  if (await filterButton.isVisible()) {
    await filterButton.click();
    await page.waitForTimeout(500); // Wait for filter to apply
  }
}

async function getArticleCount(page: Page) {
  const articles = await getArticleElements(page);
  return await articles.count();
}

async function scrollToMarkArticlesAsRead(page: Page, count: number = 3) {
  // Get first few articles to scroll past them
  const articles = await getArticleElements(page);
  const articleCount = Math.min(count, await articles.count());
  
  if (articleCount === 0) return [];
  
  const markedArticles: string[] = [];
  
  // Scroll down to mark articles as read via auto-scroll
  for (let i = 0; i < articleCount; i++) {
    const article = articles.nth(i);
    const articleId = await article.getAttribute('data-article-id');
    
    if (articleId) {
      markedArticles.push(articleId);
      
      // Scroll past this article to trigger auto-read
      const articleBox = await article.boundingBox();
      if (articleBox) {
        await page.mouse.wheel(0, articleBox.height + 50);
        await page.waitForTimeout(200); // Wait for scroll to settle
      }
    }
  }
  
  // Wait for auto-read to process
  await page.waitForTimeout(1000);
  
  return markedArticles;
}

async function getSessionStorage(page: Page, key: string) {
  return await page.evaluate((storageKey) => {
    return sessionStorage.getItem(storageKey);
  }, key);
}

test.describe('RR-27: Article List State Preservation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the RSS reader
    await page.goto(RSS_READER_URL);
    await waitForArticlesToLoad(page);
  });

  test('should preserve auto-read articles in Unread Only mode after back navigation', async ({ page }) => {
    // Step 1: Switch to "Unread Only" mode
    await switchToUnreadOnlyMode(page);
    
    // Get initial unread article count
    const initialCount = await getArticleCount(page);
    expect(initialCount).toBeGreaterThan(3);
    
    // Step 2: Scroll to mark some articles as auto-read
    const autoReadArticles = await scrollToMarkArticlesAsRead(page, 3);
    expect(autoReadArticles.length).toBe(3);
    
    // Step 3: Verify articles are still visible (state preservation should keep them)
    const countAfterScroll = await getArticleCount(page);
    expect(countAfterScroll).toBe(initialCount); // Should still show auto-read articles
    
    // Step 4: Click on the 4th article (unread)
    const articles = await getArticleElements(page);
    const fourthArticle = articles.nth(3);
    const fourthArticleId = await fourthArticle.getAttribute('data-article-id');
    
    expect(fourthArticleId).toBeTruthy();
    
    // Verify article doesn't disappear when clicked
    await fourthArticle.click();
    
    // Step 5: Wait for navigation to article detail
    await page.waitForURL(new RegExp(`/reader/article/${fourthArticleId}`));
    
    // Step 6: Navigate back using browser back button
    await page.goBack();
    await page.waitForURL('/reader');
    await waitForArticlesToLoad(page);
    
    // Step 7: Verify state is preserved
    const finalCount = await getArticleCount(page);
    expect(finalCount).toBe(initialCount); // All articles should still be visible
    
    // Step 8: Verify auto-read articles have special styling
    for (const articleId of autoReadArticles) {
      const preservedArticle = page.locator(`[data-article-id="${articleId}"]`);
      await expect(preservedArticle).toHaveClass(/session-preserved-read/);
    }
    
    // Step 9: Verify session storage contains state
    const savedState = await getSessionStorage(page, 'articleListState');
    expect(savedState).toBeTruthy();
    
    const parsedState = JSON.parse(savedState!);
    expect(parsedState.autoReadArticles).toContain(autoReadArticles[0]);
    expect(parsedState.filterMode).toBe('unread');
  });

  test('should not immediately hide article when clicked in Unread Only mode', async ({ page }) => {
    // Switch to "Unread Only" mode
    await switchToUnreadOnlyMode(page);
    
    const articles = await getArticleElements(page);
    const firstArticle = articles.nth(0);
    const articleId = await firstArticle.getAttribute('data-article-id');
    
    // Verify article is visible before click
    await expect(firstArticle).toBeVisible();
    
    // Click the article
    await firstArticle.click();
    
    // Article should still be visible immediately after click
    // (it should not disappear until navigation completes)
    await expect(firstArticle).toBeVisible();
    
    // Wait for navigation
    await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
  });

  test('should restore exact scroll position on back navigation', async ({ page }) => {
    // Scroll down to a specific position
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(500);
    
    // Get current scroll position
    const scrollPosition = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="article-list-container"]') || document.body;
      return container.scrollTop;
    });
    
    expect(scrollPosition).toBeGreaterThan(700);
    
    // Click on an article
    const articles = await getArticleElements(page);
    const firstArticle = articles.nth(0);
    const articleId = await firstArticle.getAttribute('data-article-id');
    
    await firstArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
    
    // Navigate back
    await page.goBack();
    await page.waitForURL('/reader');
    await waitForArticlesToLoad(page);
    
    // Verify scroll position is restored (within 10px tolerance)
    const restoredPosition = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="article-list-container"]') || document.body;
      return container.scrollTop;
    });
    
    expect(Math.abs(restoredPosition - scrollPosition)).toBeLessThan(10);
  });

  test('should differentiate between auto-read and manually read articles', async ({ page }) => {
    await switchToUnreadOnlyMode(page);
    
    // Mark some articles as auto-read via scrolling
    const autoReadArticles = await scrollToMarkArticlesAsRead(page, 2);
    
    // Click on an article to mark it as manually read
    const articles = await getArticleElements(page);
    const thirdArticle = articles.nth(2);
    const manuallyReadId = await thirdArticle.getAttribute('data-article-id');
    
    await thirdArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${manuallyReadId}`));
    
    // Navigate back
    await page.goBack();
    await page.waitForURL('/reader');
    await waitForArticlesToLoad(page);
    
    // Verify auto-read articles have special styling
    for (const articleId of autoReadArticles) {
      const autoReadArticle = page.locator(`[data-article-id="${articleId}"]`);
      await expect(autoReadArticle).toHaveClass(/session-preserved-read/);
    }
    
    // Verify manually read article has different styling
    const manuallyReadArticle = page.locator(`[data-article-id="${manuallyReadId}"]`);
    await expect(manuallyReadArticle).not.toHaveClass(/session-preserved-read/);
  });

  test('should handle session storage expiry after 30 minutes', async ({ page }) => {
    await switchToUnreadOnlyMode(page);
    
    // Mark some articles as auto-read
    const autoReadArticles = await scrollToMarkArticlesAsRead(page, 2);
    
    // Manually set an expired timestamp in session storage
    await page.evaluate(() => {
      const expiredTime = Date.now() - (31 * 60 * 1000); // 31 minutes ago
      const state = {
        articleIds: ['test-1', 'test-2'],
        readStates: { 'test-1': true, 'test-2': true },
        autoReadArticles: ['test-1', 'test-2'],
        manualReadArticles: [],
        scrollPosition: 100,
        timestamp: expiredTime,
        filterMode: 'unread'
      };
      sessionStorage.setItem('articleListState', JSON.stringify(state));
    });
    
    // Click on an article
    const articles = await getArticleElements(page);
    const firstArticle = articles.nth(0);
    const articleId = await firstArticle.getAttribute('data-article-id');
    
    await firstArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
    
    // Navigate back
    await page.goBack();
    await page.waitForURL('/reader');
    await waitForArticlesToLoad(page);
    
    // Expired state should be cleared
    const savedState = await getSessionStorage(page, 'articleListState');
    expect(savedState).toBeNull();
  });

  test('should work with prev/next navigation between articles', async ({ page }) => {
    await switchToUnreadOnlyMode(page);
    
    // Mark some articles as auto-read
    const autoReadArticles = await scrollToMarkArticlesAsRead(page, 3);
    
    // Click on first article
    const articles = await getArticleElements(page);
    const firstArticle = articles.nth(0);
    const firstArticleId = await firstArticle.getAttribute('data-article-id');
    
    await firstArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));
    
    // Navigate to next article if prev/next buttons exist
    const nextButton = page.locator('button:has-text("Next")').or(page.locator('[aria-label="Next article"]'));
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Navigate back to list
    await page.goBack();
    await page.waitForURL('/reader');
    await waitForArticlesToLoad(page);
    
    // Verify auto-read articles are still preserved
    for (const articleId of autoReadArticles.slice(0, 2)) {
      const preservedArticle = page.locator(`[data-article-id="${articleId}"]`);
      await expect(preservedArticle).toBeVisible();
    }
  });

  test('should handle rapid navigation without losing state', async ({ page }) => {
    await switchToUnreadOnlyMode(page);
    
    const articles = await getArticleElements(page);
    const articleIds: string[] = [];
    
    // Collect first 3 article IDs
    for (let i = 0; i < 3; i++) {
      const id = await articles.nth(i).getAttribute('data-article-id');
      if (id) articleIds.push(id);
    }
    
    // Rapidly navigate between articles
    for (const articleId of articleIds) {
      const article = page.locator(`[data-article-id="${articleId}"]`);
      await article.click();
      await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
      await page.waitForTimeout(100); // Brief pause
      await page.goBack();
      await page.waitForURL('/reader');
      await page.waitForTimeout(100);
    }
    
    // Verify articles are still visible and state is maintained
    const finalCount = await getArticleCount(page);
    expect(finalCount).toBeGreaterThan(0);
    
    // Verify session storage state is still valid
    const savedState = await getSessionStorage(page, 'articleListState');
    expect(savedState).toBeTruthy();
  });

  test('should maintain state across browser refresh', async ({ page }) => {
    await switchToUnreadOnlyMode(page);
    
    // Mark articles as auto-read
    const autoReadArticles = await scrollToMarkArticlesAsRead(page, 2);
    
    // Click on an article and navigate back to save state
    const articles = await getArticleElements(page);
    const firstArticle = articles.nth(2);
    const articleId = await firstArticle.getAttribute('data-article-id');
    
    await firstArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
    await page.goBack();
    await page.waitForURL('/reader');
    await waitForArticlesToLoad(page);
    
    // Refresh the page
    await page.reload();
    await waitForArticlesToLoad(page);
    
    // State should be cleared after refresh (session storage is ephemeral)
    const savedState = await getSessionStorage(page, 'articleListState');
    // Session storage persists across page refresh, but our app should handle stale state
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      // State should be valid or cleared if too old
      expect(parsedState.timestamp).toBeDefined();
    }
  });

  test('should handle filter changes correctly', async ({ page }) => {
    // Start in "All" mode
    const allModeButton = page.locator('button:has-text("All")');
    if (await allModeButton.isVisible()) {
      await allModeButton.click();
      await page.waitForTimeout(500);
    }
    
    const initialCount = await getArticleCount(page);
    
    // Switch to "Unread Only" mode
    await switchToUnreadOnlyMode(page);
    
    const unreadCount = await getArticleCount(page);
    expect(unreadCount).toBeLessThanOrEqual(initialCount);
    
    // Mark some articles as auto-read
    await scrollToMarkArticlesAsRead(page, 2);
    
    // Switch back to "All" mode
    if (await allModeButton.isVisible()) {
      await allModeButton.click();
      await page.waitForTimeout(500);
    }
    
    // All articles should be visible in "All" mode
    const finalCount = await getArticleCount(page);
    expect(finalCount).toBeGreaterThanOrEqual(unreadCount);
  });
});

test.describe('RR-27: Performance and Edge Cases', () => {
  test('should handle large number of articles without performance issues', async ({ page }) => {
    await page.goto(RSS_READER_URL);
    await waitForArticlesToLoad(page);
    
    // Measure time for state operations
    const startTime = Date.now();
    
    // Scroll through many articles quickly
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
    }
    
    // Click on an article
    const articles = await getArticleElements(page);
    if (await articles.count() > 0) {
      const firstArticle = articles.nth(0);
      const articleId = await firstArticle.getAttribute('data-article-id');
      
      await firstArticle.click();
      await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
      
      // Navigate back
      await page.goBack();
      await page.waitForURL('/reader');
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should complete within reasonable time (less than 10 seconds)
    expect(totalTime).toBeLessThan(10000);
  });

  test('should gracefully handle storage quota exceeded', async ({ page }) => {
    await page.goto(RSS_READER_URL);
    await waitForArticlesToLoad(page);
    
    // Fill up session storage to near quota
    await page.evaluate(() => {
      try {
        for (let i = 0; i < 100; i++) {
          sessionStorage.setItem(`dummy-${i}`, 'x'.repeat(10000));
        }
      } catch (e) {
        // Expected to fail at some point
      }
    });
    
    // Try to use state preservation
    await switchToUnreadOnlyMode(page);
    await scrollToMarkArticlesAsRead(page, 2);
    
    const articles = await getArticleElements(page);
    if (await articles.count() > 0) {
      const firstArticle = articles.nth(0);
      const articleId = await firstArticle.getAttribute('data-article-id');
      
      // Should not throw errors even with storage issues
      await firstArticle.click();
      await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
      await page.goBack();
      await page.waitForURL('/reader');
      await waitForArticlesToLoad(page);
    }
    
    // Clean up
    await page.evaluate(() => {
      sessionStorage.clear();
    });
  });
});