/**
 * RR-27: Manual Test for State Preservation
 * This test simulates the exact user workflow that was reported as broken
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Manual User Workflow Test", () => {
  test("should reproduce the original bug and verify the fix", async ({
    page,
  }) => {
    console.log("🚀 Starting RR-27 manual test...");

    // Step 1: Navigate to RSS reader
    console.log("📱 Navigating to RSS reader...");
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000); // Wait for app to fully load

    // Take initial screenshot
    await page.screenshot({ path: "manual-1-initial.png", fullPage: true });

    // Step 2: Check that articles are loaded
    console.log("📰 Checking for articles...");
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    const articleCount = await articles.count();
    console.log(`Found ${articleCount} articles`);
    expect(articleCount).toBeGreaterThan(0);

    // Step 3: Switch to "Unread Only" mode
    console.log("🔍 Switching to Unread Only filter...");
    const unreadButton = page
      .locator("button")
      .filter({ hasText: "Unread Only" })
      .or(page.locator("button").filter({ hasText: "Unread" }));

    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
      console.log("✅ Switched to Unread Only mode");
    } else {
      console.log("⚠️ Unread filter button not found, continuing...");
    }

    await page.screenshot({
      path: "manual-2-unread-filter.png",
      fullPage: true,
    });

    // Step 4: Get the count of articles in Unread Only mode
    const unreadCount = await articles.count();
    console.log(`Unread articles count: ${unreadCount}`);

    // Step 5: Select the first article
    const firstArticle = articles.first();
    const firstArticleId = await firstArticle.getAttribute("data-article-id");
    const firstArticleTitle = await firstArticle
      .locator("h2, h3, .article-title")
      .first()
      .textContent();

    console.log(
      `🎯 Selected article: ${firstArticleId} - "${firstArticleTitle?.substring(0, 50)}..."`
    );

    // Step 6: Verify article is visible before clicking
    await expect(firstArticle).toBeVisible();
    console.log("✅ Article is visible before click");

    // Step 7: Click the article (this was causing the immediate disappearance)
    console.log("👆 Clicking article...");

    // Get current URL before click
    const urlBeforeClick = page.url();
    console.log(`URL before click: ${urlBeforeClick}`);

    // Click with some debugging
    await firstArticle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Check if article is still visible right before click
    const visibleBeforeClick = await firstArticle.isVisible();
    console.log(`Article visible right before click: ${visibleBeforeClick}`);

    await firstArticle.click({ timeout: 10000 });
    console.log("✅ Article clicked");

    // Step 8: Check if article immediately disappears (the original bug)
    await page.waitForTimeout(500); // Brief pause to let any immediate state changes occur

    const visibleAfterClick = await firstArticle.isVisible();
    console.log(`Article visible after click: ${visibleAfterClick}`);

    // This is the key test - the article should NOT disappear immediately
    if (!visibleAfterClick) {
      console.log(
        "❌ BUG REPRODUCED: Article disappeared immediately after click!"
      );
      await page.screenshot({
        path: "manual-3-article-disappeared.png",
        fullPage: true,
      });

      // If we can't see the article, count total articles to see if list changed
      const countAfterClick = await articles.count();
      console.log(
        `Article count after click: ${countAfterClick} (was ${unreadCount})`
      );

      expect(visibleAfterClick).toBe(true); // This should pass with our fix
    } else {
      console.log("✅ FIX VERIFIED: Article remains visible after click");
      await page.screenshot({
        path: "manual-3-article-still-visible.png",
        fullPage: true,
      });
    }

    // Step 9: Wait for navigation or check current URL
    await page.waitForTimeout(2000);
    const urlAfterClick = page.url();
    console.log(`URL after click: ${urlAfterClick}`);

    // Check if navigation happened
    if (urlAfterClick !== urlBeforeClick) {
      console.log("✅ Navigation occurred");

      // Step 10: Navigate back using browser back button
      console.log("⬅️ Navigating back...");
      await page.goBack();
      await page.waitForTimeout(2000);

      const urlAfterBack = page.url();
      console.log(`URL after back navigation: ${urlAfterBack}`);

      // Step 11: Verify we're back to the article list
      await page.waitForSelector("[data-article-id]", { timeout: 10000 });

      // Step 12: Check if the article is preserved in the list (key test for RR-27)
      const finalCount = await articles.count();
      console.log(`Final article count: ${finalCount}`);

      // The article should be preserved in Unread Only mode
      const originalArticleAfterBack = page.locator(
        `[data-article-id="${firstArticleId}"]`
      );
      const isPreservedAndVisible = await originalArticleAfterBack.isVisible();

      console.log(
        `Original article preserved and visible: ${isPreservedAndVisible}`
      );

      if (isPreservedAndVisible) {
        console.log(
          "✅ RR-27 SUCCESS: Article is preserved in Unread Only mode after back navigation"
        );

        // Check if it has the session-preserved styling
        const hasSessionPreservedClass =
          await originalArticleAfterBack.evaluate((el) =>
            el.classList.contains("session-preserved-read")
          );
        console.log(
          `Has session-preserved styling: ${hasSessionPreservedClass}`
        );
      } else {
        console.log(
          "❌ RR-27 FAILURE: Article was not preserved after back navigation"
        );
      }

      await page.screenshot({
        path: "manual-4-after-back-navigation.png",
        fullPage: true,
      });

      // Final assertion
      expect(isPreservedAndVisible).toBe(true);
    } else {
      console.log(
        "❌ Navigation did not occur - need to investigate click handler"
      );
      await page.screenshot({
        path: "manual-error-no-navigation.png",
        fullPage: true,
      });

      // Let's check if there are any JavaScript errors
      const errors = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });

      await page.waitForTimeout(1000);

      if (errors.length > 0) {
        console.log("JavaScript errors found:", errors);
      }

      // Try to investigate what happens when we click
      const clickResult = await firstArticle.evaluate((el) => {
        const events = [];

        // Check if there are click handlers
        const handlers = el.onclick || el.getAttribute("onclick");
        events.push(`onclick: ${handlers}`);

        // Check for event listeners
        const listeners = getEventListeners
          ? getEventListeners(el)
          : "getEventListeners not available";
        events.push(`listeners: ${JSON.stringify(listeners)}`);

        return events;
      });

      console.log("Click investigation:", clickResult);
    }

    console.log("🏁 Manual test completed");
  });
});
