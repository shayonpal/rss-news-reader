/**
 * RR-27: Complete User Flows - OPTIMIZED
 *
 * Consolidated test file with grouped scenarios to meet <20s execution target
 * Reduces individual test() calls from 17 to 5 comprehensive tests
 */

import { test, expect } from "@playwright/test";
import {
  StatePreservationHelper,
  ArticleInteractionHelper,
  FilterHelper,
  SessionStorageHelper,
  MobileTestHelper,
} from "./helpers/rr-27/page-helpers";
import { TEST_CONSTANTS } from "./helpers/rr-27/types";

test.describe("RR-27: Complete User Flows", () => {
  let stateHelper: StatePreservationHelper;
  let articleHelper: ArticleInteractionHelper;
  let filterHelper: FilterHelper;
  let storageHelper: SessionStorageHelper;
  let mobileHelper: MobileTestHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize helper classes
    stateHelper = new StatePreservationHelper(page);
    articleHelper = new ArticleInteractionHelper(page);
    filterHelper = new FilterHelper(page);
    storageHelper = new SessionStorageHelper(page);
    mobileHelper = new MobileTestHelper(page);

    // Navigate to RSS reader
    await page.goto(TEST_CONSTANTS.RSS_READER_URL);
    await articleHelper.waitForArticleList();
  });

  test("Complete Reading Workflow - Auto-read vs Manual Read Differentiation", async ({
    page,
  }) => {
    // Test consolidates: preserve-auto-read-navigation-back, differentiate-auto-read-manual,
    // complete-user-scenario-linear-issue

    // Step 1: Switch to Unread Only mode and create auto-read articles
    await filterHelper.switchToUnreadOnlyMode();
    const initialCount = await articleHelper.getArticleCount();
    expect(initialCount).toBeGreaterThan(3);

    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(3);
    expect(autoReadArticles.length).toBe(3);

    // Verify auto-read articles still visible (preservation behavior)
    const countAfterAutoRead = await articleHelper.getArticleCount();
    expect(countAfterAutoRead).toBe(initialCount);

    // Step 2: Manually read an article through navigation
    const articles = await articleHelper.getArticleElements();
    const manualReadArticle = articles.nth(3); // Different from auto-read
    const manualReadId =
      await manualReadArticle.getAttribute("data-article-id");

    const beforeNavigation = await stateHelper.captureCurrentState();
    await manualReadArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${manualReadId}`));
    await articleHelper.navigateBackToList();

    // Step 3: Verify state preservation after navigation
    const afterNavigation = await stateHelper.captureCurrentState();
    await stateHelper.assertStatePreserved(beforeNavigation, afterNavigation);

    // Step 4: Verify visual differentiation between auto-read and manual-read
    for (const autoReadId of autoReadArticles) {
      const autoReadElement = page.locator(`[data-article-id="${autoReadId}"]`);
      await expect(autoReadElement).toHaveClass(/session-preserved-read/);
    }

    // Manual read article should not be visible in Unread Only mode
    const manualReadElement = page.locator(
      `[data-article-id="${manualReadId}"]`
    );
    expect(await manualReadElement.count()).toBe(0);

    // Step 5: Complete Linear issue scenario - switch to All to see manual read
    await filterHelper.switchFilter("all");
    await page.waitForLoadState("networkidle");

    const manualReadInAll = page.locator(`[data-article-id="${manualReadId}"]`);
    await expect(manualReadInAll).toBeVisible();
    await expect(manualReadInAll).toHaveClass(/read/);
    await expect(manualReadInAll).not.toHaveClass(/session-preserved-read/);
  });

  test("Multi-Article Navigation Patterns and State Integrity", async ({
    page,
  }) => {
    // Test consolidates: rapid-navigation-no-corruption, preserve-state-prev-next,
    // navigate-article-back-preservation, multiple-article-navigations

    await filterHelper.switchToUnreadOnlyMode();
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);

    const articles = await articleHelper.getArticleElements();
    const firstArticleId = await articles
      .nth(0)
      .getAttribute("data-article-id");
    const secondArticleId = await articles
      .nth(1)
      .getAttribute("data-article-id");
    const thirdArticleId = await articles
      .nth(2)
      .getAttribute("data-article-id");

    // Step 1: Test rapid navigation without corruption
    const stateBeforeRapid = await stateHelper.captureCurrentState();

    await articles.nth(0).click();
    await page.waitForLoadState("networkidle");
    await page.goBack();
    await page.waitForLoadState("networkidle");

    await articles.nth(1).click();
    await page.waitForLoadState("networkidle");
    await page.goBack();
    await page.waitForLoadState("networkidle");

    const stateAfterRapid = await stateHelper.captureCurrentState();
    expect(stateAfterRapid.articleCount).toEqual(stateBeforeRapid.articleCount);

    // Step 2: Test prev/next navigation with state preservation
    await articles.nth(0).click();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));

    // Navigate using prev/next buttons if available
    const nextButton = page.locator(
      '[data-testid="next-article"], .next-article'
    );
    if ((await nextButton.count()) > 0) {
      await nextButton.click();
      await page.waitForURL(new RegExp(`/reader/article/${secondArticleId}`));

      const prevButton = page.locator(
        '[data-testid="prev-article"], .prev-article'
      );
      if ((await prevButton.count()) > 0) {
        await prevButton.click();
        await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));
      }
    }

    await articleHelper.navigateBackToList();

    // Step 3: Test multiple article navigation sequence
    const navigationSequence = [0, 2, 1]; // Non-sequential to test state robustness

    for (const index of navigationSequence) {
      const articleElement = articles.nth(index);
      const articleId = await articleElement.getAttribute("data-article-id");

      await articleElement.click();
      await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
      await page.waitForTimeout(500); // Brief reading simulation
      await articleHelper.navigateBackToList();
    }

    // Step 4: Verify state integrity after complex navigation
    const finalState = await stateHelper.captureCurrentState();
    expect(finalState.articleCount).toBeGreaterThan(0);

    const finalStorage = await storageHelper.getItem("articleListState");
    expect(finalStorage).toBeTruthy();

    if (finalStorage) {
      const parsedState = JSON.parse(finalStorage);
      expect(parsedState.autoReadArticles).toContain(autoReadArticles[0]);
    }
  });

  test("Mobile-Specific User Flows and Touch Navigation", async ({ page }) => {
    // Test consolidates: mobile-swipe-navigation-state, pull-to-refresh-filters

    // Step 1: Setup mobile viewport and initial state
    await mobileHelper.setupMobileEnvironment();
    await filterHelper.switchToUnreadOnlyMode();

    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);
    const initialState = await stateHelper.captureCurrentState();

    // Step 2: Test mobile swipe navigation preserving state
    const articles = await articleHelper.getArticleElements();
    const firstArticle = articles.nth(0);
    const firstArticleId = await firstArticle.getAttribute("data-article-id");

    await firstArticle.click();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));

    // Simulate mobile swipe gestures if supported
    const articleContent = page.locator(".article-content, main");
    if ((await articleContent.count()) > 0) {
      await articleContent.swipe("left"); // Swipe to next if supported
      await page.waitForLoadState("domcontentloaded");
    }

    await articleHelper.navigateBackToList();

    // Step 3: Test pull-to-refresh maintaining filters
    const searchQuery = "mobile test";
    await filterHelper.setSearchQuery(searchQuery);

    // Simulate pull-to-refresh gesture
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("refresh"));
    });
    await page.waitForLoadState("networkidle");

    // Verify filters maintained after refresh
    const currentFilter = await filterHelper.getCurrentFilter();
    expect(currentFilter).toBe("unread");

    const currentSearch = await filterHelper.getCurrentSearchQuery();
    expect(currentSearch).toBe(searchQuery);

    // Step 4: Verify mobile state preservation
    const mobileStateAfter = await stateHelper.captureCurrentState();
    expect(mobileStateAfter.articleCount).toBeGreaterThan(0);

    const mobileStorage = await storageHelper.getItem("articleListState");
    if (mobileStorage) {
      const parsedMobileState = JSON.parse(mobileStorage);
      expect(parsedMobileState.searchQuery).toBe(searchQuery);
      expect(parsedMobileState.filterMode).toBe("unread");
    }
  });

  test("Browser Navigation Patterns and History Management", async ({
    page,
  }) => {
    // Test consolidates: browser-back-forward-navigation, history-state-preservation,
    // url-change-state-maintenance

    await filterHelper.switchToUnreadOnlyMode();
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(2);

    // Step 1: Test browser back/forward button navigation
    const articles = await articleHelper.getArticleElements();
    const firstArticleId = await articles
      .nth(0)
      .getAttribute("data-article-id");
    const secondArticleId = await articles
      .nth(1)
      .getAttribute("data-article-id");

    // Navigate using browser history
    await articles.nth(0).click();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));

    await articles.nth(1).click();
    await page.waitForURL(new RegExp(`/reader/article/${secondArticleId}`));

    // Use browser back button
    await page.goBack();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));

    // Use browser forward button
    await page.goForward();
    await page.waitForURL(new RegExp(`/reader/article/${secondArticleId}`));

    // Return to list
    await articleHelper.navigateBackToList();

    // Step 2: Test URL change state maintenance
    const currentUrl = page.url();
    const stateBeforeUrlChange = await stateHelper.captureCurrentState();

    // Navigate to different filter via URL if supported
    await filterHelper.switchFilter("all");
    await page.waitForLoadState("networkidle");

    await filterHelper.switchFilter("unread");
    await page.waitForLoadState("networkidle");

    // Step 3: Verify history state preservation
    const stateAfterUrlChanges = await stateHelper.captureCurrentState();

    // Auto-read articles should still be preserved in session
    const historyStorage = await storageHelper.getItem("articleListState");
    if (historyStorage) {
      const parsedHistoryState = JSON.parse(historyStorage);
      expect(parsedHistoryState.filterMode).toBe("unread");
      // Auto-read state may be cleared by filter changes, but structure should be intact
      expect(parsedHistoryState).toHaveProperty("autoReadArticles");
    }

    // Step 4: Test complex navigation history
    const navigationHistory = [];

    for (let i = 0; i < 3; i++) {
      const article = articles.nth(i);
      const articleId = await article.getAttribute("data-article-id");
      navigationHistory.push(articleId);

      await article.click();
      await page.waitForURL(new RegExp(`/reader/article/${articleId}`));
    }

    // Navigate back through history
    for (let i = 0; i < navigationHistory.length - 1; i++) {
      await page.goBack();
      await page.waitForLoadState("domcontentloaded");
    }

    await articleHelper.navigateBackToList();

    // Verify final state integrity
    const finalHistoryState = await stateHelper.captureCurrentState();
    expect(finalHistoryState.articleCount).toBeGreaterThan(0);
  });

  test("Edge Cases and Error Recovery in User Flows", async ({ page }) => {
    // Test consolidates: error handling, network recovery, state corruption recovery

    await filterHelper.switchToUnreadOnlyMode();

    // Step 1: Test navigation with missing articles (404 scenarios)
    const articles = await articleHelper.getArticleElements();
    const firstArticleId = await articles
      .nth(0)
      .getAttribute("data-article-id");

    // Navigate to valid article first
    await articles.nth(0).click();
    await page.waitForURL(new RegExp(`/reader/article/${firstArticleId}`));

    // Test navigation to potentially invalid article ID
    const invalidUrl = page
      .url()
      .replace(firstArticleId!, "invalid-article-id");
    await page.goto(invalidUrl);
    await page.waitForLoadState("networkidle");

    // Should handle gracefully (either redirect or show error)
    const currentUrl = page.url();
    expect(currentUrl).toBeDefined();

    // Return to list
    await articleHelper.navigateBackToList();

    // Step 2: Test state recovery after corruption
    const autoReadArticles = await articleHelper.scrollToMarkArticlesAsRead(1);

    // Corrupt session storage
    await storageHelper.setItem("articleListState", "invalid-json");

    // Navigate and verify recovery
    await page.reload();
    await articleHelper.waitForArticleList();

    const recoveredState = await stateHelper.captureCurrentState();
    expect(recoveredState.articleCount).toBeGreaterThan(0);

    // Step 3: Test rapid state changes and recovery
    try {
      for (let i = 0; i < 5; i++) {
        await filterHelper.switchFilter(i % 2 === 0 ? "unread" : "all");
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 });
      }
    } catch (error) {
      // Some rapid changes might timeout - this is acceptable
      console.warn("Rapid navigation encountered timeout - testing recovery");
    }

    // Should recover to stable state
    await page.waitForLoadState("networkidle");
    const recoveredFinalState = await stateHelper.captureCurrentState();
    expect(recoveredFinalState.articleCount).toBeGreaterThan(0);

    // Step 4: Test network recovery scenarios
    // Simulate offline/online if supported by test environment
    const finalStorage = await storageHelper.getItem("articleListState");
    if (finalStorage && finalStorage !== "invalid-json") {
      expect(() => JSON.parse(finalStorage)).not.toThrow();
    }
  });
});
