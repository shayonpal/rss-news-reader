/**
 * RR-27: Manual Debug Test
 */

import { test, expect } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Manual Debug", () => {
  test("debug session state behavior", async ({ page }) => {
    console.log("🔍 Starting manual debug test...");

    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000);

    // Take screenshot to see what's loaded
    await page.screenshot({ path: "debug-initial-load.png" });

    // Check if articles are loaded
    const articleCount = await page.locator("[data-article-id]").count();
    console.log(`📊 Articles loaded: ${articleCount}`);

    if (articleCount === 0) {
      console.log("❌ No articles loaded - checking for errors...");

      // Check for error messages
      const errorText = await page
        .locator(".text-muted-foreground")
        .textContent();
      console.log(`Error text: ${errorText}`);

      // Check console errors
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          console.log("Browser console error:", msg.text());
        }
      });

      return;
    }

    // Try to find filter dropdown
    const filterButton = page
      .locator("button")
      .filter({ hasText: /Current filter|All articles|Unread only/i });
    const filterButtonCount = await filterButton.count();
    console.log(`Filter button found: ${filterButtonCount}`);

    if (filterButtonCount > 0) {
      await filterButton.first().click();
      await page.waitForTimeout(1000);

      // Look for dropdown menu
      const menuItems = await page.locator('[role="menuitem"]').count();
      console.log(`Dropdown menu items: ${menuItems}`);

      if (menuItems > 0) {
        const unreadOption = page
          .locator('[role="menuitem"]')
          .filter({ hasText: "Unread only" });
        if (await unreadOption.isVisible()) {
          await unreadOption.click();
          console.log("✅ Switched to Unread Only mode");
        }
      }
    }

    // Wait and check article count again
    await page.waitForTimeout(2000);
    const unreadArticleCount = await page.locator("[data-article-id]").count();
    console.log(`📊 Unread articles: ${unreadArticleCount}`);

    if (unreadArticleCount > 0) {
      // Click first article
      const firstArticle = page.locator("[data-article-id]").first();
      const articleId = await firstArticle.getAttribute("data-article-id");
      console.log(`📖 Clicking article: ${articleId}`);

      await firstArticle.click();
      await page.waitForTimeout(3000);

      // Check if we're on article detail page
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);

      if (currentUrl.includes("/article/")) {
        console.log("✅ Navigated to article detail page");

        // Check session state
        const sessionState = await page.evaluate(() => {
          const state = sessionStorage.getItem("articleListState");
          return state ? JSON.parse(state) : null;
        });

        console.log("Session state after reading:", sessionState);

        // Go back
        await page.goBack();
        await page.waitForTimeout(3000);

        // Check if article is preserved
        const preservedArticle = page.locator(
          `[data-article-id="${articleId}"]`
        );
        const isVisible = await preservedArticle.isVisible();
        console.log(`Article preserved after back navigation: ${isVisible}`);

        // Final session state
        const finalState = await page.evaluate(() => {
          const state = sessionStorage.getItem("articleListState");
          return state ? JSON.parse(state) : null;
        });

        console.log("Final session state:", finalState);
      }
    }

    console.log("🏁 Debug test completed");
  });
});
