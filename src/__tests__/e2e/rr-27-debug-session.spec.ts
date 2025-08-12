/**
 * RR-27: Debug session state and article loading
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Debug Session State", () => {
  test("should debug the complete state flow", async ({ page }) => {
    console.log("🔍 Starting debug session state test...");

    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000);

    // Switch to Unread Only
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
    }

    // Get first article
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");

    console.log(`🎯 Target article: ${firstArticleId}`);

    // Check initial session storage
    let sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log("Initial session state:", sessionState);

    // Navigate to article detail
    const articleDetailUrl = `${RSS_READER_URL}/article/${firstArticleId}`;
    console.log(`📖 Navigating to: ${articleDetailUrl}`);
    await page.goto(articleDetailUrl);
    await page.waitForTimeout(5000); // Wait for article to load and be processed

    // Check session state after article visit
    sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log("Session state after article visit:", sessionState);

    // Navigate back
    console.log("⬅️ Navigating back...");
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000);

    // Check session state after back navigation
    sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log("Session state after back navigation:", sessionState);

    // Debug the article loading process
    const debugInfo = await page.evaluate((targetId) => {
      // Check if articles are loaded
      const articleElements = document.querySelectorAll("[data-article-id]");
      const articleCount = articleElements.length;

      // Check if target article exists in DOM
      const targetArticle = document.querySelector(
        `[data-article-id="${targetId}"]`
      );
      const targetExists = targetArticle !== null;
      const targetVisible = targetArticle
        ? window.getComputedStyle(targetArticle).display !== "none"
        : false;
      const targetReadStatus = targetArticle
        ? targetArticle.getAttribute("data-is-read")
        : null;

      // Check session state parsing
      const sessionState = sessionStorage.getItem("articleListState");
      let sessionParsed = null;
      let sessionValid = false;

      if (sessionState) {
        try {
          sessionParsed = JSON.parse(sessionState);
          sessionValid = true;
        } catch (e) {
          sessionParsed = { error: e.message };
        }
      }

      return {
        articleCount,
        targetExists,
        targetVisible,
        targetReadStatus,
        sessionValid,
        sessionParsed,
        currentUrl: window.location.href,
        timestamp: Date.now(),
      };
    }, firstArticleId);

    console.log("Debug info:", JSON.stringify(debugInfo, null, 2));

    // Check if the article should be preserved according to our logic
    if (debugInfo.sessionParsed && debugInfo.sessionValid) {
      const isManuallyRead =
        debugInfo.sessionParsed.manualReadArticles?.includes(firstArticleId);
      const isAutoRead =
        debugInfo.sessionParsed.autoReadArticles?.includes(firstArticleId);
      const isExpired =
        debugInfo.sessionParsed.timestamp &&
        Date.now() - debugInfo.sessionParsed.timestamp > 30 * 60 * 1000;

      console.log(`Article ${firstArticleId}:`);
      console.log(`- Is manually read: ${isManuallyRead}`);
      console.log(`- Is auto read: ${isAutoRead}`);
      console.log(`- Session expired: ${isExpired}`);
      console.log(
        `- Should be preserved: ${(isManuallyRead || isAutoRead) && !isExpired}`
      );
    }

    // Take screenshot
    await page.screenshot({ path: "debug-session-state.png", fullPage: true });

    console.log("🏁 Debug session state test completed");
  });
});
