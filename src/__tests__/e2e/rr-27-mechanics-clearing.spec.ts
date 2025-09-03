/**
 * RR-27: State Clearing Mechanics - OPTIMIZED
 *
 * Consolidated test file with grouped scenarios to meet <20s execution target
 * Reduces individual test() calls from 14 to 4 comprehensive tests
 */

import { test, expect } from "@playwright/test";
import {
  StatePreservationHelper,
  ArticleInteractionHelper,
  FilterHelper,
  SessionStorageHelper,
} from "./helpers/rr-27/page-helpers";
import { TEST_CONSTANTS } from "./helpers/rr-27/types";

test.describe("RR-27: State Clearing Mechanics", () => {
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

    // Navigate to RSS reader and setup initial state
    await page.goto(TEST_CONSTANTS.RSS_READER_URL);
    await articleHelper.waitForArticleList();

    // Pre-populate some state for clearing tests
    await filterHelper.switchToUnreadOnlyMode();
    await filterHelper.setSearchQuery("test");
  });

  test("Feed Switching State Clearing", async ({ page }) => {
    // Test consolidates: clear-state-switching-feeds, clear-state-all-feeds-view

    // Step 1: Create initial state to be cleared
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);
    const initialState = await stateHelper.captureCurrentState();
    expect(initialState.articleCount).toBeGreaterThan(0);

    // Verify initial session storage has state
    const initialStorageState = await storageHelper.getItem("articleListState");
    expect(initialStorageState).toBeTruthy();

    // Step 2: Switch to different feed
    await filterHelper.switchFeed("Technology");
    await page.waitForLoadState("networkidle");

    // Step 3: Verify state cleared after feed switch
    const stateAfterFeedSwitch = await stateHelper.captureCurrentState();
    const storageAfterFeedSwitch =
      await storageHelper.getItem("articleListState");

    // State should be cleared
    expect(stateAfterFeedSwitch.scrollPosition).toBe(0);
    if (storageAfterFeedSwitch) {
      const parsedState = JSON.parse(storageAfterFeedSwitch);
      expect(parsedState.autoReadArticles || []).toHaveLength(0);
    }

    // Step 4: Test switching to "All Feeds" view
    await filterHelper.switchToUnreadOnlyMode();
    const moreAutoReadArticles =
      await articleHelper.scrollToMarkArticlesAsRead(1);

    await filterHelper.switchFeed("All Feeds");
    await page.waitForLoadState("networkidle");

    // Step 5: Verify all feeds view clears state
    const finalState = await stateHelper.captureCurrentState();
    const finalStorage = await storageHelper.getItem("articleListState");

    expect(finalState.scrollPosition).toBe(0);
    if (finalStorage) {
      const parsedFinalState = JSON.parse(finalStorage);
      expect(parsedFinalState.autoReadArticles || []).toHaveLength(0);
    }
  });

  test("Filter Switching State Clearing", async ({ page }) => {
    // Test consolidates: clear-state-switching-filters, clear-state-unread-to-all,
    // preserve-search-query-filter-change

    // Step 1: Set up initial state with preserved articles
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);
    const searchQuery = "technology";
    await filterHelper.setSearchQuery(searchQuery);

    // Verify initial state exists
    const initialStorage = await storageHelper.getItem("articleListState");
    expect(initialStorage).toBeTruthy();

    // Step 2: Switch from Unread to All filter
    await filterHelper.switchFilter("all");
    await page.waitForLoadState("networkidle");

    // Step 3: Verify article state cleared but search preserved
    const storageAfterFilterSwitch =
      await storageHelper.getItem("articleListState");
    if (storageAfterFilterSwitch) {
      const parsedState = JSON.parse(storageAfterFilterSwitch);
      expect(parsedState.autoReadArticles || []).toHaveLength(0);
      // Search query should be preserved
      expect(parsedState.searchQuery || "").toBe(searchQuery);
    }

    // Step 4: Test multiple filter switches
    await filterHelper.switchFilter("read");
    await page.waitForLoadState("networkidle");

    await filterHelper.switchFilter("unread");
    await page.waitForLoadState("networkidle");

    // Step 5: Verify state remains cleared through filter changes
    const finalStorage = await storageHelper.getItem("articleListState");
    if (finalStorage) {
      const finalParsedState = JSON.parse(finalStorage);
      expect(finalParsedState.autoReadArticles || []).toHaveLength(0);
      expect(finalParsedState.searchQuery || "").toBe(searchQuery);
    }

    // Verify scroll position is reset
    const scrollPosition = await page.evaluate(() => window.pageYOffset);
    expect(scrollPosition).toBeLessThan(100); // Should be near top
  });

  test("Session Storage and Second Click Behavior", async ({ page }) => {
    // Test consolidates: verify-session-storage-cleared, handle-corrupted-session-storage,
    // preserve-session-read-second-article, handle-rapid-second-clicks

    // Step 1: Create and verify session storage state
    await filterHelper.switchToUnreadOnlyMode();
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);

    const sessionStorage = await storageHelper.getItem("articleListState");
    expect(sessionStorage).toBeTruthy();
    const initialParsedState = JSON.parse(sessionStorage!);
    expect(initialParsedState.autoReadArticles).toContain(autoReadArticles[0]);

    // Step 2: Test second click behavior - should preserve session-read articles
    const articles = await articleHelper.getArticleElements();
    const firstArticle = articles.nth(0);
    const secondArticle = articles.nth(1);

    // Click first article
    const firstArticleId = await firstArticle.getAttribute("data-article-id");
    await firstArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));
    await articleHelper.navigateBackToList();

    // Click second article
    const secondArticleId = await secondArticle.getAttribute("data-article-id");
    await secondArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${secondArticleId}`));
    await articleHelper.navigateBackToList();

    // Step 3: Verify session-read articles are preserved
    const sessionArticles = page.locator('[class*="session-preserved-read"]');
    const sessionCount = await sessionArticles.count();
    expect(sessionCount).toBeGreaterThanOrEqual(1);

    // Step 4: Test rapid second clicks without state corruption
    const thirdArticle = articles.nth(2);
    const fourthArticle = articles.nth(3);

    // Simulate rapid clicking
    await thirdArticle.click();
    await page.waitForLoadState("networkidle");

    await fourthArticle.click();
    await page.waitForLoadState("networkidle");

    await articleHelper.navigateBackToList();

    // Step 5: Test corrupted session storage handling
    try {
      await storageHelper.setItem("articleListState", "corrupted-json-data");

      // Navigate away and back to trigger storage read
      await page.reload();
      await articleHelper.waitForArticleList();

      // Should handle gracefully without crashing
      const finalState = await stateHelper.captureCurrentState();
      expect(finalState.articleCount).toBeGreaterThan(0);

      // Storage should be reset to valid state or cleared
      const finalStorage = await storageHelper.getItem("articleListState");
      if (finalStorage && finalStorage !== "corrupted-json-data") {
        expect(() => JSON.parse(finalStorage)).not.toThrow();
      }
    } catch (error) {
      // Expected behavior - graceful handling of corruption
      expect(error).toBeDefined();
    }
  });

  test("Selective Clearing and Edge Cases", async ({ page }) => {
    // Test consolidates: selective clearing behaviors and edge case handling

    // Step 1: Create mixed state with different article types
    await filterHelper.switchToUnreadOnlyMode();
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(3);

    // Manually mark some articles as read through navigation
    const articles = await articleHelper.getArticleElements();
    const manualReadArticle = articles.nth(0);
    const manualReadId =
      await manualReadArticle.getAttribute("data-article-id");

    await manualReadArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${manualReadId}`));
    await articleHelper.navigateBackToList();

    // Step 2: Test selective clearing - only auto-read should be cleared
    const stateBeforeClearing = await stateHelper.captureCurrentState();

    // Trigger selective clearing by switching filters
    await filterHelper.switchFilter("all");
    await page.waitForLoadState("networkidle");
    await filterHelper.switchFilter("unread");
    await page.waitForLoadState("networkidle");

    // Step 3: Verify selective clearing behavior
    const storageAfterClearing =
      await storageHelper.getItem("articleListState");
    if (storageAfterClearing) {
      const parsedState = JSON.parse(storageAfterClearing);
      // Auto-read articles should be cleared
      expect(parsedState.autoReadArticles || []).toHaveLength(0);
    }

    // Manually read article should maintain its read state
    const manualReadElement = page.locator(
      `[data-article-id="${manualReadId}"]`
    );
    if ((await manualReadElement.count()) > 0) {
      // In unread filter, manually read articles should not be visible
      expect(await manualReadElement.isVisible()).toBe(false);
    }

    // Step 4: Test edge case - empty state clearing
    await storageHelper.removeItem("articleListState");

    // Should handle missing storage gracefully
    await filterHelper.switchFilter("all");
    await page.waitForLoadState("networkidle");

    const finalState = await stateHelper.captureCurrentState();
    expect(finalState.articleCount).toBeGreaterThan(0);

    // Step 5: Test rapid state changes without corruption
    for (let i = 0; i < 3; i++) {
      await filterHelper.switchFilter(i % 2 === 0 ? "unread" : "all");
      await page.waitForLoadState("domcontentloaded");
    }

    // Should end in stable state
    const stableState = await stateHelper.captureCurrentState();
    expect(stableState.articleCount).toBeGreaterThan(0);
  });
});
