/**
 * RR-27: Test with real navigation to article detail page
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Real Navigation Test", () => {
  test("should navigate to article and back with proper state preservation", async ({
    page,
  }) => {
    console.log("🚀 Starting real navigation test...");

    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000);

    // Wait for articles
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    console.log(`Found ${await articles.count()} articles`);

    // Switch to Unread Only mode
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
      console.log("✅ Switched to Unread Only mode");
    }

    // Get article info
    const firstArticle = articles.first();
    const firstArticleId = await firstArticle.getAttribute("data-article-id");
    const initialCount = await articles.count();

    console.log(`🎯 Target article: ${firstArticleId}`);
    console.log(`Initial article count: ${initialCount}`);

    // Navigate directly to the article detail page
    const articleDetailUrl = `${RSS_READER_URL}/article/${firstArticleId}`;
    console.log(`📖 Navigating to article detail: ${articleDetailUrl}`);

    await page.goto(articleDetailUrl);
    await page.waitForTimeout(3000); // Wait for article to load and be marked as read

    // Check if we're on the article page
    expect(page.url()).toBe(articleDetailUrl);
    console.log("✅ Successfully navigated to article detail page");

    // Navigate back to the reader
    console.log("⬅️ Navigating back to reader...");
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Wait for articles to reload
    await articles.first().waitFor({ timeout: 10000 });

    // Check if we're back to the reader
    expect(page.url()).toBe(RSS_READER_URL);
    console.log("✅ Back to reader page");

    // Verify the article is still visible
    const originalArticle = page.locator(
      `[data-article-id="${firstArticleId}"]`
    );
    const isVisible = await originalArticle.isVisible();

    console.log(`Original article visible: ${isVisible}`);

    // Check read status (regardless of visibility for debugging)
    const isRead = isVisible
      ? await originalArticle.getAttribute("data-is-read")
      : null;

    if (isVisible) {
      console.log("✅ SUCCESS: Article remained visible after navigation");
      console.log(`Article read status: ${isRead}`);

      // Check styling
      const styling = await originalArticle.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          opacity: styles.opacity,
          hasSessionClass: el.classList.contains("session-preserved-read"),
        };
      });

      console.log("Article styling:", styling);

      // Verify final count
      const finalCount = await articles.count();
      console.log(`Final article count: ${finalCount}`);

      // The key assertion - article should still be visible in Unread Only mode
      expect(isVisible).toBe(true);

      // If article is marked as read, it should have reduced opacity
      if (isRead === "true") {
        expect(parseFloat(styling.opacity)).toBeLessThan(1);
        console.log("✅ Read article has proper reduced opacity");
      }
    } else {
      console.log("❌ FAILURE: Article disappeared");
      await page.screenshot({
        path: "real-navigation-failure.png",
        fullPage: true,
      });
      expect(isVisible).toBe(true);
    }

    // Check session storage
    const sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });

    console.log("Session state after navigation:", sessionState);

    if (sessionState) {
      console.log(
        `Session contains ${sessionState.manualReadArticles?.length || 0} manually read articles`
      );
      console.log(
        `Session contains ${sessionState.autoReadArticles?.length || 0} auto read articles`
      );

      // Check if our article is tracked
      const isTrackedAsManual =
        sessionState.manualReadArticles?.includes(firstArticleId);
      const isTrackedAsAuto =
        sessionState.autoReadArticles?.includes(firstArticleId);

      console.log(`Article tracked as manually read: ${isTrackedAsManual}`);
      console.log(`Article tracked as auto read: ${isTrackedAsAuto}`);

      // Should be tracked in one of the arrays if it was read
      if (isRead === "true") {
        expect(isTrackedAsManual || isTrackedAsAuto).toBe(true);
      }
    }

    console.log("🏁 Real navigation test completed");
  });

  test("should handle multiple article navigations", async ({ page }) => {
    console.log("🔄 Testing multiple navigations...");

    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });

    // Switch to Unread Only
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
    }

    // Get first 3 article IDs
    const articleIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await articles.nth(i).getAttribute("data-article-id");
      if (id) articleIds.push(id);
    }

    console.log(`Testing with articles: ${articleIds.join(", ")}`);

    // Navigate to each article and back
    for (const articleId of articleIds) {
      console.log(`📖 Navigating to article: ${articleId}`);
      await page.goto(`${RSS_READER_URL}/article/${articleId}`);
      await page.waitForTimeout(2000);

      console.log(`⬅️ Navigating back from: ${articleId}`);
      await page.goto(RSS_READER_URL);
      await page.waitForTimeout(2000);
    }

    // Verify all articles are still visible
    await articles.first().waitFor({ timeout: 10000 });

    let visibleCount = 0;
    for (const articleId of articleIds) {
      const article = page.locator(`[data-article-id="${articleId}"]`);
      if (await article.isVisible()) {
        visibleCount++;
      }
    }

    console.log(`${visibleCount}/${articleIds.length} articles still visible`);
    expect(visibleCount).toBe(articleIds.length);

    console.log("✅ Multiple navigation test completed");
  });
});
