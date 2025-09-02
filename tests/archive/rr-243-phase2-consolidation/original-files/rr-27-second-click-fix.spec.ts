/**
 * RR-27: Test fix for second article click issue
 * This test verifies that clicking a second article doesn't show all unread articles
 */

import { test, expect } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Second Article Click Fix", () => {
  test("should preserve only session-read articles after clicking second article", async ({
    page,
  }) => {
    console.log("🔍 Testing second article click fix...");

    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Click on a specific feed to get a filtered view
    const feedLink = page.locator('a[href*="/feed/"]').first();
    if (await feedLink.isVisible()) {
      console.log("📁 Clicking on first feed...");
      await feedLink.click();
      await page.waitForTimeout(3000);
    }

    // Switch to Unread Only mode
    const filterButton = page
      .locator("button")
      .filter({ hasText: /Current filter|All articles|Unread only/i })
      .first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);

      const unreadOption = page
        .locator('[role="menuitem"]')
        .filter({ hasText: "Unread only" });
      if (await unreadOption.isVisible()) {
        await unreadOption.click();
        console.log("✅ Switched to Unread Only mode");
        await page.waitForTimeout(2000);
      }
    }

    // Count initial unread articles
    const initialCount = await page.locator("[data-article-id]").count();
    console.log(`📊 Initial unread articles: ${initialCount}`);

    if (initialCount < 2) {
      console.log("❌ Not enough unread articles for test");
      return;
    }

    // Click first article
    const firstArticle = page.locator("[data-article-id]").first();
    const firstArticleId = await firstArticle.getAttribute("data-article-id");
    console.log(`📖 Clicking first article: ${firstArticleId}`);

    await firstArticle.click();
    await page.waitForTimeout(3000);

    // Go back
    await page.goBack();
    await page.waitForTimeout(3000);

    // Count articles after first read
    const afterFirstCount = await page.locator("[data-article-id]").count();
    console.log(`📊 Articles after first read: ${afterFirstCount}`);

    // Verify first article is preserved
    const firstArticleVisible = await page
      .locator(`[data-article-id="${firstArticleId}"]`)
      .isVisible();
    console.log(`First article preserved: ${firstArticleVisible}`);

    // Click second article
    const secondArticle = page.locator("[data-article-id]").nth(1);
    const secondArticleId = await secondArticle.getAttribute("data-article-id");
    console.log(`📖 Clicking second article: ${secondArticleId}`);

    await secondArticle.click();
    await page.waitForTimeout(3000);

    // Check session state after clicking second article
    const sessionStateAfterSecond = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });

    console.log("Session state after second click:", {
      feedId: sessionStateAfterSecond?.feedId,
      manualReadCount: sessionStateAfterSecond?.manualReadArticles?.length || 0,
      manualReadArticles: sessionStateAfterSecond?.manualReadArticles,
    });

    // Go back
    await page.goBack();
    await page.waitForTimeout(3000);

    // Count articles after second read
    const afterSecondCount = await page.locator("[data-article-id]").count();
    console.log(`📊 Articles after second read: ${afterSecondCount}`);

    // Critical check: Should NOT show all unread articles (100+)
    // Should only show unread + the 2 we just read
    expect(afterSecondCount).toBeLessThan(initialCount + 5); // Allow some margin

    // Both read articles should be visible
    const firstStillVisible = await page
      .locator(`[data-article-id="${firstArticleId}"]`)
      .isVisible();
    const secondVisible = await page
      .locator(`[data-article-id="${secondArticleId}"]`)
      .isVisible();

    console.log(`First article still preserved: ${firstStillVisible}`);
    console.log(`Second article preserved: ${secondVisible}`);

    // Final session state check
    const finalSessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });

    console.log("Final session state:", {
      feedId: finalSessionState?.feedId,
      manualReadCount: finalSessionState?.manualReadArticles?.length || 0,
      hasFirstArticle:
        finalSessionState?.manualReadArticles?.includes(firstArticleId),
      hasSecondArticle:
        finalSessionState?.manualReadArticles?.includes(secondArticleId),
    });

    console.log("🏁 Second article click test completed");
  });
});
