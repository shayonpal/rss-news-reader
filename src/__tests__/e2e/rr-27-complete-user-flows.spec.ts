import { test, expect, type Page } from "@playwright/test";

/**
 * RR-27: Article List State Preservation - End-to-End Tests
 *
 * These tests verify complete user flows for article list state preservation
 * using actual browser interactions and DOM elements.
 */

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

// Test utilities
async function waitForArticleList(page: Page) {
  await page.waitForSelector('[data-testid="article-list"]', {
    timeout: 10000,
  });
  await page.waitForLoadState("networkidle");
}

async function getVisibleArticles(page: Page) {
  return await page.locator('[data-testid^="article-"]').all();
}

async function getReadArticles(page: Page) {
  return await page
    .locator('[data-testid^="article-"][data-read="true"]')
    .all();
}

async function getUnreadArticles(page: Page) {
  return await page
    .locator('[data-testid^="article-"][data-read="false"]')
    .all();
}

async function getSessionPreservedArticles(page: Page) {
  return await page
    .locator('[data-testid^="article-"].session-preserved-read')
    .all();
}

async function scrollToBottom(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1000); // Allow auto-read to trigger
}

async function setUnreadOnlyFilter(page: Page) {
  await page.click('[data-testid="filter-unread"]');
  await page.waitForTimeout(500);
}

test.describe("RR-27: Complete User Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await waitForArticleList(page);
  });

  test("should preserve auto-read articles when navigating back in Unread Only mode", async ({
    page,
  }) => {
    // Step 1: Switch to "Unread Only" filter
    await setUnreadOnlyFilter(page);

    // Step 2: Wait for articles to load
    await waitForArticleList(page);
    const initialUnreadCount = (await getUnreadArticles(page)).length;
    expect(initialUnreadCount).toBeGreaterThan(0);

    // Step 3: Scroll down to trigger auto-read
    await scrollToBottom(page);
    await page.waitForTimeout(2000); // Allow auto-read to process

    // Step 4: Check that some articles were auto-read but still visible
    const preservedArticles = await getSessionPreservedArticles(page);
    expect(preservedArticles.length).toBeGreaterThan(0);

    // Step 5: Click on an unread article to navigate to detail
    const unreadArticles = await getUnreadArticles(page);
    expect(unreadArticles.length).toBeGreaterThan(0);

    const firstUnreadArticle = unreadArticles[0];
    const articleId = await firstUnreadArticle.getAttribute("data-testid");
    await firstUnreadArticle.click();

    // Step 6: Wait for article detail page
    await page.waitForSelector('[data-testid="article-detail"]', {
      timeout: 5000,
    });
    await page.waitForTimeout(1000);

    // Step 7: Navigate back using browser back button
    await page.goBack();
    await waitForArticleList(page);

    // Step 8: Verify that auto-read articles are still visible
    const restoredPreservedArticles = await getSessionPreservedArticles(page);
    expect(restoredPreservedArticles.length).toBeGreaterThanOrEqual(
      preservedArticles.length
    );

    // Step 9: Verify scroll position was restored
    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeGreaterThan(0);
  });

  test("should differentiate between auto-read and manually read articles visually", async ({
    page,
  }) => {
    // Step 1: Switch to "Unread Only" filter
    await setUnreadOnlyFilter(page);
    await waitForArticleList(page);

    // Step 2: Scroll to trigger auto-read
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(2000);

    // Step 3: Manually click and read an article
    const unreadArticles = await getUnreadArticles(page);
    const manualReadArticle = unreadArticles[0];
    await manualReadArticle.click();

    await page.waitForSelector('[data-testid="article-detail"]');
    await page.goBack();
    await waitForArticleList(page);

    // Step 4: Check visual differentiation
    const autoReadArticles = await page
      .locator(".session-preserved-read")
      .all();
    const manuallyReadArticles = await page
      .locator('[data-read="true"]:not(.session-preserved-read)')
      .all();

    // Auto-read articles should have specific styling
    if (autoReadArticles.length > 0) {
      const autoReadOpacity = await autoReadArticles[0].evaluate(
        (el) => getComputedStyle(el).opacity
      );
      expect(parseFloat(autoReadOpacity)).toBeGreaterThan(0.8); // Less faded
    }

    // Manually read articles should have different styling
    if (manuallyReadArticles.length > 0) {
      const manualReadOpacity = await manuallyReadArticles[0].evaluate(
        (el) => getComputedStyle(el).opacity
      );
      expect(parseFloat(manualReadOpacity)).toBeLessThan(0.8); // More faded
    }
  });

  test("should handle rapid navigation without state corruption", async ({
    page,
  }) => {
    await waitForArticleList(page);

    // Step 1: Rapid navigation sequence
    const articles = await getVisibleArticles(page);
    expect(articles.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < Math.min(3, articles.length); i++) {
      await articles[i].click();
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 3000,
      });
      await page.waitForTimeout(500);
      await page.goBack();
      await waitForArticleList(page);
    }

    // Step 2: Verify article list is still functional
    const finalArticles = await getVisibleArticles(page);
    expect(finalArticles.length).toBeGreaterThan(0);

    // Step 3: Verify no JavaScript errors occurred
    const logs = await page.evaluate(() => {
      return (window as any).jsErrors || [];
    });
    expect(logs.filter((log: any) => log.level === "error")).toHaveLength(0);
  });

  test("should preserve state across prev/next navigation", async ({
    page,
  }) => {
    await waitForArticleList(page);

    // Step 1: Navigate to first article
    const articles = await getVisibleArticles(page);
    expect(articles.length).toBeGreaterThanOrEqual(2);

    await articles[0].click();
    await page.waitForSelector('[data-testid="article-detail"]');

    // Step 2: Use next navigation
    const nextButton = page.locator('[data-testid="next-article"]');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Step 3: Use previous navigation
      const prevButton = page.locator('[data-testid="prev-article"]');
      if (await prevButton.isVisible()) {
        await prevButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 4: Navigate back to list
    await page.goBack();
    await waitForArticleList(page);

    // Step 5: Verify state preservation
    const finalArticles = await getVisibleArticles(page);
    expect(finalArticles.length).toBeGreaterThan(0);
  });

  test("should handle session storage expiry gracefully", async ({ page }) => {
    await waitForArticleList(page);

    // Step 1: Create initial state
    await scrollToBottom(page);
    await page.waitForTimeout(2000);

    // Step 2: Simulate time passage by manipulating timestamps
    await page.evaluate(() => {
      const stateKey = "articleListState";
      const existingState = sessionStorage.getItem(stateKey);
      if (existingState) {
        const state = JSON.parse(existingState);
        // Set timestamp to 31 minutes ago
        state.timestamp = Date.now() - 31 * 60 * 1000;
        sessionStorage.setItem(stateKey, JSON.stringify(state));
      }
    });

    // Step 3: Navigate to article and back
    const articles = await getVisibleArticles(page);
    if (articles.length > 0) {
      await articles[0].click();
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 5000,
      });
      await page.goBack();
      await waitForArticleList(page);
    }

    // Step 4: Verify expired state was cleared
    const hasExpiredState = await page.evaluate(() => {
      const stateKey = "articleListState";
      const existingState = sessionStorage.getItem(stateKey);
      return existingState !== null;
    });

    // State should either be cleared or refreshed with new timestamp
    if (hasExpiredState) {
      const stateTimestamp = await page.evaluate(() => {
        const stateKey = "articleListState";
        const existingState = sessionStorage.getItem(stateKey);
        if (existingState) {
          return JSON.parse(existingState).timestamp;
        }
        return null;
      });

      if (stateTimestamp) {
        const ageMinutes = (Date.now() - stateTimestamp) / (60 * 1000);
        expect(ageMinutes).toBeLessThan(30); // Should be fresh state
      }
    }
  });

  test("should maintain performance with large article lists", async ({
    page,
  }) => {
    await waitForArticleList(page);

    // Step 1: Measure initial load performance
    const loadStartTime = Date.now();
    await page.reload();
    await waitForArticleList(page);
    const loadTime = Date.now() - loadStartTime;

    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds

    // Step 2: Test scrolling performance
    const scrollStartTime = Date.now();

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(200);
    }

    const scrollTime = Date.now() - scrollStartTime;
    expect(scrollTime).toBeLessThan(3000); // Scrolling should be smooth

    // Step 3: Test state save/restore performance
    const stateStartTime = Date.now();

    const articles = await getVisibleArticles(page);
    if (articles.length > 0) {
      await articles[0].click();
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 5000,
      });
      await page.goBack();
      await waitForArticleList(page);
    }

    const stateTime = Date.now() - stateStartTime;
    expect(stateTime).toBeLessThan(4000); // Navigation should be responsive
  });

  test("should handle edge case of all articles becoming read", async ({
    page,
  }) => {
    // Step 1: Switch to unread only filter
    await setUnreadOnlyFilter(page);
    await waitForArticleList(page);

    const initialUnreadCount = (await getUnreadArticles(page)).length;
    if (initialUnreadCount === 0) {
      // Skip test if no unread articles
      test.skip();
      return;
    }

    // Step 2: Scroll to trigger auto-read on all visible articles
    await page.evaluate(() => {
      // Scroll to bottom multiple times to ensure all articles are auto-read
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, 1000);
      }
    });
    await page.waitForTimeout(3000);

    // Step 3: Navigate to an article and back
    const preservedArticles = await getSessionPreservedArticles(page);
    if (preservedArticles.length > 0) {
      await preservedArticles[0].click();
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 5000,
      });
      await page.goBack();
      await waitForArticleList(page);

      // Step 4: Verify preserved articles are still shown in unread filter
      const finalPreservedArticles = await getSessionPreservedArticles(page);
      expect(finalPreservedArticles.length).toBeGreaterThanOrEqual(
        preservedArticles.length
      );
    }
  });

  test("should recover from storage quota exceeded errors", async ({
    page,
  }) => {
    await waitForArticleList(page);

    // Step 1: Fill up session storage to near capacity
    await page.evaluate(() => {
      try {
        // Fill storage with large data
        for (let i = 0; i < 100; i++) {
          const largeData = "x".repeat(10000);
          sessionStorage.setItem(`filler-${i}`, largeData);
        }
      } catch (e) {
        // Expected when quota is reached
      }
    });

    // Step 2: Attempt normal operation (should handle quota gracefully)
    await scrollToBottom(page);
    await page.waitForTimeout(2000);

    const articles = await getVisibleArticles(page);
    if (articles.length > 0) {
      await articles[0].click();
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 5000,
      });
      await page.goBack();
      await waitForArticleList(page);
    }

    // Step 3: Verify application remains functional
    const finalArticles = await getVisibleArticles(page);
    expect(finalArticles.length).toBeGreaterThan(0);

    // Clean up
    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        sessionStorage.removeItem(`filler-${i}`);
      }
    });
  });

  test("should handle browser back/forward button navigation", async ({
    page,
  }) => {
    await waitForArticleList(page);

    // Step 1: Create navigation history
    const articles = await getVisibleArticles(page);
    expect(articles.length).toBeGreaterThanOrEqual(2);

    // Navigate to first article
    await articles[0].click();
    await page.waitForSelector('[data-testid="article-detail"]');
    await page.waitForTimeout(1000);

    // Go back to list
    await page.goBack();
    await waitForArticleList(page);

    // Navigate to second article
    await articles[1].click();
    await page.waitForSelector('[data-testid="article-detail"]');
    await page.waitForTimeout(1000);

    // Step 2: Use browser back/forward
    await page.goBack(); // Back to list
    await waitForArticleList(page);

    await page.goForward(); // Forward to second article
    await page.waitForSelector('[data-testid="article-detail"]');

    await page.goBack(); // Back to list again
    await waitForArticleList(page);

    // Step 3: Verify state is preserved through browser navigation
    const finalArticles = await getVisibleArticles(page);
    expect(finalArticles.length).toBeGreaterThan(0);

    // Check that read states are preserved
    const readArticles = await getReadArticles(page);
    expect(readArticles.length).toBeGreaterThanOrEqual(2); // Two articles were visited
  });

  test("should prevent auto-read during scroll restoration", async ({
    page,
  }) => {
    await waitForArticleList(page);

    // Step 1: Scroll down and create some auto-read articles
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(2000);

    const initialAutoReadCount = (await getSessionPreservedArticles(page))
      .length;

    // Step 2: Navigate to article
    const articles = await getVisibleArticles(page);
    if (articles.length > 0) {
      await articles[0].click();
      await page.waitForSelector('[data-testid="article-detail"]');
      await page.waitForTimeout(1000);

      // Step 3: Navigate back (scroll should be restored)
      await page.goBack();
      await waitForArticleList(page);
      await page.waitForTimeout(1000); // Allow restoration to complete

      // Step 4: Verify no additional articles were auto-read during restoration
      const finalAutoReadCount = (await getSessionPreservedArticles(page))
        .length;

      // Count should not increase significantly due to restoration
      // Allow for small increase due to normal auto-read behavior
      expect(finalAutoReadCount).toBeLessThanOrEqual(initialAutoReadCount + 2);

      // Step 5: Verify scroll position was restored
      const scrollPosition = await page.evaluate(() => window.scrollY);
      expect(scrollPosition).toBeGreaterThan(500); // Should be near previous position
    }
  });

  test("should handle complete user scenario from Linear issue", async ({
    page,
  }) => {
    // This test replicates the exact scenario described in RR-27

    // Step 1: User is in "Unread Only" mode
    await setUnreadOnlyFilter(page);
    await waitForArticleList(page);

    const initialUnreadArticles = await getUnreadArticles(page);
    expect(initialUnreadArticles.length).toBeGreaterThan(2);

    // Step 2: User scrolls down, first few articles are auto-marked as read
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(2500); // Allow auto-read to trigger

    // Step 3: Verify some articles are now auto-read but still visible (session-preserved)
    const autoReadArticles = await getSessionPreservedArticles(page);
    expect(autoReadArticles.length).toBeGreaterThan(0);

    // Step 4: User clicks on unread article to read details
    const remainingUnreadArticles = await getUnreadArticles(page);
    expect(remainingUnreadArticles.length).toBeGreaterThan(0);

    await remainingUnreadArticles[0].click();
    await page.waitForSelector('[data-testid="article-detail"]');
    await page.waitForTimeout(1000);

    // Step 5: User navigates back to article list
    await page.goBack();
    await waitForArticleList(page);

    // Step 6: CRITICAL VALIDATION - User should see session-preserved state, not complete article list
    const restoredAutoReadArticles = await getSessionPreservedArticles(page);
    const allVisibleArticles = await getVisibleArticles(page);
    const currentUnreadArticles = await getUnreadArticles(page);

    // The bug was: complete article list appearing instead of preserved state
    // Validation: In "Unread Only" mode, we should see:
    // - All unread articles
    // - Session-preserved auto-read articles
    // - NOT all read articles from other sessions

    expect(restoredAutoReadArticles.length).toBeGreaterThan(0); // Auto-read articles preserved
    expect(currentUnreadArticles.length).toBeGreaterThan(0); // Unread articles visible

    // Total visible should be reasonable (not complete list with hundreds of read articles)
    const expectedMaxVisible = initialUnreadArticles.length + 10; // Allow some margin
    expect(allVisibleArticles.length).toBeLessThan(expectedMaxVisible);

    // Step 7: Verify scroll position was restored
    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeGreaterThan(400); // Should be near previous scroll position

    // Step 8: Verify visual differentiation is maintained
    if (restoredAutoReadArticles.length > 0) {
      const autoReadOpacity = await restoredAutoReadArticles[0].evaluate(
        (el) => getComputedStyle(el).opacity
      );
      expect(parseFloat(autoReadOpacity)).toBeGreaterThan(0.7); // Less faded than manual reads
    }
  });
});

test.describe("RR-27: Performance and Stress Tests", () => {
  test("should handle very large article lists without performance degradation", async ({
    page,
  }) => {
    // Test with performance monitoring
    await page.goto(RSS_READER_URL);

    // Start performance measurement
    await page.evaluate(() => performance.mark("test-start"));

    await waitForArticleList(page);

    // Simulate heavy scrolling and interactions
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(100);
    }

    // End performance measurement
    await page.evaluate(() => performance.mark("test-end"));

    const performanceMetrics = await page.evaluate(() => {
      performance.measure("test-duration", "test-start", "test-end");
      const measure = performance.getEntriesByName("test-duration")[0];
      return {
        duration: measure.duration,
        memory: (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0,
      };
    });

    expect(performanceMetrics.duration).toBeLessThan(10000); // Should complete within 10 seconds
  });

  test("should maintain responsiveness during rapid user interactions", async ({
    page,
  }) => {
    await page.goto(RSS_READER_URL);
    await waitForArticleList(page);

    const articles = await getVisibleArticles(page);
    expect(articles.length).toBeGreaterThanOrEqual(3);

    // Rapid interaction sequence
    const startTime = Date.now();

    for (let i = 0; i < Math.min(3, articles.length); i++) {
      await articles[i].click();

      // Quick navigation without waiting for full page load
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 2000,
      });
      await page.goBack();
      await page.waitForSelector('[data-testid="article-list"]', {
        timeout: 2000,
      });
    }

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(15000); // Should complete rapid navigation within 15 seconds

    // Verify final state is consistent
    const finalArticles = await getVisibleArticles(page);
    expect(finalArticles.length).toBeGreaterThan(0);
  });
});
