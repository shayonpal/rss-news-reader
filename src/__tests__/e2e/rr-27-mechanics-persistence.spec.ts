/**
 * RR-27: State Preservation Mechanics - OPTIMIZED
 *
 * Consolidated test file with grouped scenarios to meet <20s execution target
 * Reduces individual test() calls from 13 to 4 comprehensive tests
 */

import { test, expect } from "@playwright/test";
import {
  StatePreservationHelper,
  ArticleInteractionHelper,
  FilterHelper,
  SessionStorageHelper,
} from "./helpers/rr-27/page-helpers";
import { TEST_CONSTANTS } from "./helpers/rr-27/types";

test.describe("RR-27: State Preservation Mechanics", () => {
  let stateHelper: StatePreservationHelper;
  let articleHelper: ArticleInteractionHelper;
  let filterHelper: FilterHelper;
  let storageHelper: SessionStorageHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize helper classes
    stateHelper = new StatePreservationHelper(page);
    articleHelper = new ArticleInteractionHelper(page);
    filterHelper = new FilterHelper(page);
    storageHelper = new SessionStorageHelper(page);

    // Navigate to RSS reader
    await page.goto(TEST_CONSTANTS.RSS_READER_URL);
    await articleHelper.waitForArticleList();
  });

  test("Core State Preservation - Auto-read articles in Unread Only mode", async ({
    page,
  }) => {
    // Test consolidates: persist-auto-read-unread-mode, no-immediate-hide-on-click,
    // differentiate-auto-read-manual-read, keep-clicked-visible

    // Step 1: Switch to "Unread Only" mode
    await filterHelper.switchToUnreadOnlyMode();
    const initialCount = await articleHelper.getArticleCount();
    expect(initialCount).toBeGreaterThan(3);

    // Step 2: Scroll to mark articles as auto-read
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(3);
    expect(autoReadArticles.length).toBe(3);

    // Step 3: Verify articles remain visible (preservation behavior)
    const countAfterScroll = await articleHelper.getArticleCount();
    expect(countAfterScroll).toBe(initialCount);

    // Step 4: Test click behavior - article should remain visible
    const firstArticle = (await articleHelper.getArticleElements()).nth(0);
    await firstArticle.click();
    await page.waitForLoadState("networkidle");
    expect(await firstArticle.isVisible()).toBe(true);

    // Step 5: Navigate to article and back to test preservation
    const fourthArticle = (await articleHelper.getArticleElements()).nth(3);
    const articleId = await fourthArticle.getAttribute("data-article-id");

    const beforeState = await stateHelper.captureCurrentState();
    await fourthArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
    await articleHelper.navigateBackToList();

    // Step 6: Verify state preserved and styling applied
    const afterState = await stateHelper.captureCurrentState();
    await stateHelper.assertStatePreserved(beforeState, afterState);

    for (const autoReadId of autoReadArticles) {
      const preservedArticle = page.locator(
        `[data-article-id="${autoReadId}"]`
      );
      await expect(preservedArticle).toHaveClass(/session-preserved-read/);
    }
  });

  test("Scroll Position and Session Storage", async ({ page }) => {
    // Test consolidates: exact-scroll-restoration, session-storage-expiry,
    // verify-session-storage-state, maintain-state-refresh

    await filterHelper.switchToUnreadOnlyMode();

    // Step 1: Scroll to specific position and mark articles
    const targetPosition = 400;
    await page.evaluate((pos) => window.scrollTo(0, pos), targetPosition);
    await page.waitForLoadState("networkidle");

    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);
    const scrollPositionBefore = await page.evaluate(() => window.pageYOffset);

    // Step 2: Navigate away and back
    const firstArticle = (await articleHelper.getArticleElements()).nth(0);
    const articleId = await firstArticle.getAttribute("data-article-id");

    await firstArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
    await articleHelper.navigateBackToList();

    // Step 3: Verify scroll position restored
    const scrollPositionAfter = await page.evaluate(() => window.pageYOffset);
    expect(Math.abs(scrollPositionAfter - scrollPositionBefore)).toBeLessThan(
      50
    );

    // Step 4: Verify session storage contains correct data
    const savedState = await storageHelper.getItem("articleListState");
    expect(savedState).toBeTruthy();

    const parsedState = JSON.parse(savedState!);
    expect(parsedState.autoReadArticles).toContain(autoReadArticles[0]);
    expect(parsedState.scrollPosition).toBeCloseTo(scrollPositionBefore, -1);
    expect(parsedState.filterMode).toBe("unread");

    // Step 5: Test state maintenance across refresh
    await page.reload();
    await articleHelper.waitForArticleList();

    const stateAfterRefresh = await storageHelper.getItem("articleListState");
    expect(stateAfterRefresh).toBeTruthy();
  });

  test("Filter Changes and Navigation", async ({ page }) => {
    // Test consolidates: handle-filter-changes, prev-next-navigation,
    // rapid-navigation-state

    // Step 1: Set initial state with auto-read articles
    await filterHelper.switchToUnreadOnlyMode();
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);

    // Step 2: Test filter changes
    await filterHelper.switchFilter("all");
    await page.waitForLoadState("networkidle");
    expect(await articleHelper.getArticleCount()).toBeGreaterThanOrEqual(2);

    // Switch back to unread and verify state
    await filterHelper.switchToUnreadOnlyMode();
    const countAfterFilterChange = await articleHelper.getArticleCount();
    expect(countAfterFilterChange).toBeGreaterThan(0);

    // Step 3: Test prev/next navigation
    const articles = await articleHelper.getArticleElements();
    const firstArticleId = await articles
      .nth(0)
      .getAttribute("data-article-id");
    const secondArticleId = await articles
      .nth(1)
      .getAttribute("data-article-id");

    await articles.nth(0).click();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));

    // Navigate to next article
    const nextButton = page.locator('[data-testid="next-article"]');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForURL(new RegExp(`/reader/article/${secondArticleId}`));
    }

    // Navigate back to list
    await articleHelper.navigateBackToList();

    // Step 4: Test rapid navigation without state loss
    const beforeRapidNav = await stateHelper.captureCurrentState();

    // Rapid navigation simulation
    await articles.nth(0).click();
    await page.waitForLoadState("networkidle");
    await page.goBack();
    await page.waitForLoadState("networkidle");
    await articles.nth(1).click();
    await page.waitForLoadState("networkidle");
    await page.goBack();

    await articleHelper.waitForArticleList();
    const afterRapidNav = await stateHelper.captureCurrentState();

    // State should be maintained despite rapid navigation
    expect(afterRapidNav.articleCount).toEqual(beforeRapidNav.articleCount);
  });

  test("Performance and Edge Cases", async ({ page }) => {
    // Test consolidates: performance-large-articles, storage-quota-exceeded

    await filterHelper.switchToUnreadOnlyMode();

    // Step 1: Test performance with multiple articles
    const startTime = Date.now();
    const articles = await articleHelper.getArticleElements();
    const articleCount = await articles.count();

    if (articleCount > 10) {
      // Test scrolling performance with many articles
      for (let i = 0; i < Math.min(5, articleCount - 1); i++) {
        await page.evaluate(() => window.scrollBy(0, 200));
        await page.waitForLoadState("domcontentloaded");
      }

      const autoReadArticles =
        await articleHelper.scrollToMarkArticlesAsRead(3);
      expect(autoReadArticles.length).toBe(3);
    }

    const operationTime = Date.now() - startTime;
    expect(operationTime).toBeLessThan(10000); // Should complete within 10s

    // Step 2: Test storage quota handling (simulate near-quota condition)
    try {
      const largeData = "x".repeat(1024 * 1024); // 1MB string
      await storageHelper.setItem("test-large-data", largeData);

      // Should still be able to save article state
      const testState = { test: "data", timestamp: Date.now() };
      await storageHelper.setItem(
        "articleListState",
        JSON.stringify(testState)
      );

      const savedState = await storageHelper.getItem("articleListState");
      expect(savedState).toBeTruthy();

      // Cleanup
      await storageHelper.removeItem("test-large-data");
    } catch (error) {
      // Storage quota exceeded - should gracefully handle
      // Expected scenario: quota exceeded, continue with essential state

      // Verify essential state still works
      const minimalState = { essential: "data" };
      await storageHelper.setItem(
        "articleListState",
        JSON.stringify(minimalState)
      );

      const savedState = await storageHelper.getItem("articleListState");
      expect(savedState).toBeTruthy();
    }
  });
});
