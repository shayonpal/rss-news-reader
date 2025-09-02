/**
 * RR-27: Comprehensive E2E Tests for Enhanced Implementation
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Comprehensive Mark-as-Read Scenarios", () => {
  test("should handle all 5 mark-as-read scenarios with session preservation", async ({
    page,
  }) => {
    // Scenario 1: Manual click
    await test.step("Manual article click preserves with context", async () => {
      await page.goto(RSS_READER_URL);

      // Navigate to specific feed
      await page.click("text=AppleInsider");
      await page.waitForTimeout(2000);

      // Switch to Unread Only
      await page.locator('button[aria-label*="Current filter"]').click();
      await page
        .locator('[role="menuitem"]', { hasText: "Unread only" })
        .click();

      // Click article
      const firstArticle = page.locator("[data-article-id]").first();
      const articleId = await firstArticle.getAttribute("data-article-id");
      await firstArticle.click();

      // Check session state has feed context
      const sessionState = await page.evaluate(() => {
        const state = sessionStorage.getItem("articleListState");
        return state ? JSON.parse(state) : null;
      });

      expect(sessionState).toBeTruthy();
      expect(sessionState.feedId).toBeTruthy();
      expect(sessionState.manualReadArticles).toContain(articleId);
    });

    // Scenario 2: Prev/Next navigation
    await test.step("Prev/Next navigation creates state if missing", async () => {
      // Clear session state
      await page.evaluate(() => sessionStorage.clear());

      // Navigate via keyboard
      await page.keyboard.press("ArrowRight"); // Next article
      await page.waitForTimeout(1000);

      // Check state was created with context
      const sessionState = await page.evaluate(() => {
        const state = sessionStorage.getItem("articleListState");
        return state ? JSON.parse(state) : null;
      });

      expect(sessionState).toBeTruthy();
      expect(sessionState.feedId).toBeTruthy();
    });

    // Scenario 3: Auto-mark-as-read (scroll)
    await test.step("Auto-mark preserves articles during scroll", async () => {
      await page.goto(RSS_READER_URL);
      await page.waitForTimeout(2000);

      // Scroll to trigger auto-mark
      await page.evaluate(() => {
        const container = document.querySelector(".article-list-container");
        if (container) {
          container.scrollTop = 1000;
        }
      });

      await page.waitForTimeout(1000);

      // Check session state includes auto-read articles
      const sessionState = await page.evaluate(() => {
        const state = sessionStorage.getItem("articleListState");
        return state ? JSON.parse(state) : null;
      });

      expect(sessionState.autoReadArticles.length).toBeGreaterThan(0);
    });

    // Scenario 4: Mark All as Read
    await test.step("Mark All as Read marks ALL articles and preserves in session", async () => {
      // Navigate to specific feed
      await page.click("text=MacRumors");
      await page.waitForTimeout(2000);

      // Get initial unread count
      const unreadCount = await page
        .locator(".text-muted-foreground")
        .textContent();
      console.log("Initial unread count:", unreadCount);

      // Click Mark All as Read (twice for confirmation)
      const markAllButton = page.locator('button:has-text("Mark All Read")');
      await markAllButton.click();
      await page.waitForTimeout(500);
      await markAllButton.click(); // Confirm

      await page.waitForTimeout(3000);

      // Verify empty state or all articles marked
      const finalCount = await page
        .locator(".text-muted-foreground")
        .textContent();
      expect(finalCount).toContain("0 unread");

      // Check session state has all marked articles
      const sessionState = await page.evaluate(() => {
        const state = sessionStorage.getItem("articleListState");
        return state ? JSON.parse(state) : null;
      });

      expect(sessionState.manualReadArticles.length).toBeGreaterThan(0);
    });

    // Scenario 5: Direct URL navigation
    await test.step("Direct URL navigation preserves context", async () => {
      const directUrl = `${RSS_READER_URL}/article/test-article-id`;
      await page.goto(directUrl);
      await page.waitForTimeout(2000);

      // Session state should be created even for direct navigation
      const sessionState = await page.evaluate(() => {
        const state = sessionStorage.getItem("articleListState");
        return state ? JSON.parse(state) : null;
      });

      expect(sessionState).toBeTruthy();
    });
  });

  test("should maintain context across complex navigation flows", async ({
    page,
  }) => {
    await page.goto(RSS_READER_URL);

    // Start from specific feed
    await page.click("text=Forbes");
    await page.waitForTimeout(2000);

    // Read multiple articles via different methods
    const actions = [
      () => page.locator("[data-article-id]").first().click(), // Manual
      () => page.keyboard.press("ArrowRight"), // Prev/Next
      () =>
        page.evaluate(() => {
          // Scroll
          document.querySelector(".article-list-container")?.scrollBy(0, 500);
        }),
    ];

    for (const action of actions) {
      await action();
      await page.waitForTimeout(1000);

      // Verify session state maintains feed context
      const state = await page.evaluate(() => {
        const s = sessionStorage.getItem("articleListState");
        return s ? JSON.parse(s) : null;
      });

      expect(state?.feedId).toBeTruthy();
      expect(state?.feedId).toContain("forbes"); // Feed context maintained
    }
  });

  test("should handle session state loss gracefully", async ({ page }) => {
    await page.goto(RSS_READER_URL);

    // Set up initial state
    await page.click("text=AppleInsider");
    await page.locator("[data-article-id]").first().click();
    await page.waitForTimeout(1000);

    // Simulate session state loss
    await page.evaluate(() => {
      sessionStorage.removeItem("articleListState");
    });

    // Continue navigation - should self-heal
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1000);

    // State should be recreated
    const newState = await page.evaluate(() => {
      const s = sessionStorage.getItem("articleListState");
      return s ? JSON.parse(s) : null;
    });

    expect(newState).toBeTruthy();
    expect(newState.feedId).toBeTruthy();
  });
});
