/**
 * RR-27: Test state clearing on feed changes and refresh
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: State Clearing Tests", () => {
  test("should clear preserved state when switching feeds", async ({
    page,
  }) => {
    console.log("🔄 Testing feed switch state clearing...");

    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000);

    // Switch to Unread Only using dropdown
    const dropdownTrigger = page.locator(
      'button[aria-label*="Current filter"]'
    );
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      const unreadOnlyOption = page.locator('[role="menuitem"]', {
        hasText: "Unread only",
      });
      if (await unreadOnlyOption.isVisible()) {
        await unreadOnlyOption.click();
        await page.waitForTimeout(1000);
      }
    }

    // Get initial article count on "All Articles"
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    const initialCount = await articles.count();
    console.log(`Initial unread count: ${initialCount}`);

    // Navigate to first article to create session state
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");
    console.log(`📖 Reading article: ${firstArticleId}`);

    const articleDetailUrl = `${RSS_READER_URL}/article/${firstArticleId}`;
    await page.goto(articleDetailUrl);
    await page.waitForTimeout(3000);

    // Navigate back to verify article is preserved
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    await articles.first().waitFor({ timeout: 10000 });

    // Verify article is still visible (preserved)
    const preservedArticle = page.locator(
      `[data-article-id="${firstArticleId}"]`
    );
    const isPreserved = await preservedArticle.isVisible();
    console.log(`Article preserved after back navigation: ${isPreserved}`);
    expect(isPreserved).toBe(true);

    // Get current count with preserved article
    const countWithPreserved = await articles.count();
    console.log(`Count with preserved article: ${countWithPreserved}`);

    // Now switch to a different feed
    console.log("🔄 Switching to different feed...");
    const feedSidebar = page
      .locator('[data-testid="feed-sidebar"]')
      .or(page.locator(".feed-sidebar"))
      .or(page.locator("aside"))
      .first();

    // Try to find a specific feed to click
    const specificFeed = page
      .locator("text=AppleInsider")
      .or(page.locator("text=MacRumors"))
      .or(page.locator("text=Forbes"))
      .first();

    if (await specificFeed.isVisible()) {
      await specificFeed.click();
      await page.waitForTimeout(2000);
      console.log("✅ Switched to specific feed");

      // Switch back to "All Articles"
      const allArticlesButton = page.locator("text=All Articles").first();
      if (await allArticlesButton.isVisible()) {
        await allArticlesButton.click();
        await page.waitForTimeout(2000);
        console.log("✅ Switched back to All Articles");

        // Wait for articles to reload
        await articles.first().waitFor({ timeout: 10000 });

        // Now the preserved article should NOT be visible anymore (state should be cleared)
        const finalCount = await articles.count();
        console.log(`Final count after feed switch: ${finalCount}`);

        const articleStillVisible = await preservedArticle.isVisible();
        console.log(
          `Article still visible after feed switch: ${articleStillVisible}`
        );

        // The article should be gone from "Unread Only" view since state was cleared
        if (articleStillVisible) {
          console.log(
            "❌ FAILURE: Article is still preserved after feed switch"
          );
          expect(articleStillVisible).toBe(false);
        } else {
          console.log(
            "✅ SUCCESS: Article correctly disappeared after feed switch"
          );
        }
      }
    } else {
      console.log("⚠️ Could not find specific feed to test with");
    }

    console.log("🏁 Feed switch test completed");
  });

  test("should clear preserved state when switching filters", async ({
    page,
  }) => {
    console.log("🔄 Testing filter switch state clearing...");

    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Start in "All Articles" mode using dropdown
    const dropdownTrigger = page.locator(
      'button[aria-label*="Current filter"]'
    );
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      const allArticlesOption = page.locator('[role="menuitem"]', {
        hasText: "All articles",
      });
      if (await allArticlesOption.isVisible()) {
        await allArticlesOption.click();
        await page.waitForTimeout(1000);
        console.log("✅ Started in All Articles mode");
      }
    }

    // Switch to "Unread Only"
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
      console.log("✅ Switched to Unread Only mode");
    }

    // Read an article to create preserved state
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");

    const articleDetailUrl = `${RSS_READER_URL}/article/${firstArticleId}`;
    await page.goto(articleDetailUrl);
    await page.waitForTimeout(3000);

    // Navigate back
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Verify article is preserved in "Unread Only"
    await articles.first().waitFor({ timeout: 10000 });
    const preservedArticle = page.locator(
      `[data-article-id="${firstArticleId}"]`
    );
    const isPreserved = await preservedArticle.isVisible();
    console.log(`Article preserved in Unread Only: ${isPreserved}`);
    expect(isPreserved).toBe(true);

    // Switch to "All Articles" (this should clear state)
    console.log("🔄 Switching to All Articles filter...");
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      const allArticlesOption = page.locator('[role="menuitem"]', {
        hasText: "All articles",
      });
      if (await allArticlesOption.isVisible()) {
        await allArticlesOption.click();
        await page.waitForTimeout(1000);
        console.log("✅ Switched to All Articles");
      }
    }

    // Switch back to "Unread Only" (state should be cleared)
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      const unreadOnlyOption = page.locator('text="Unread only"');
      if (await unreadOnlyOption.isVisible()) {
        await unreadOnlyOption.click();
        await page.waitForTimeout(1000);
        console.log("✅ Switched back to Unread Only");
      }
    }

    // Wait for articles to reload
    await articles.first().waitFor({ timeout: 10000 });

    // The article should no longer be visible in "Unread Only" since it's read and state was cleared
    const articleStillVisible = await preservedArticle.isVisible();
    console.log(
      `Article still visible after filter switch: ${articleStillVisible}`
    );

    if (articleStillVisible) {
      console.log("❌ FAILURE: Article is still preserved after filter switch");
      expect(articleStillVisible).toBe(false);
    } else {
      console.log(
        "✅ SUCCESS: Article correctly disappeared after filter switch"
      );
    }

    console.log("🏁 Filter switch test completed");
  });

  test("should verify session storage is cleared on state clearing", async ({
    page,
  }) => {
    console.log("💾 Testing session storage clearing...");

    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Switch to Unread Only using dropdown
    const dropdownTrigger = page.locator(
      'button[aria-label*="Current filter"]'
    );
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      const unreadOnlyOption = page.locator('[role="menuitem"]', {
        hasText: "Unread only",
      });
      if (await unreadOnlyOption.isVisible()) {
        await unreadOnlyOption.click();
        await page.waitForTimeout(1000);
      }
    }

    // Read an article
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");

    await page.goto(`${RSS_READER_URL}/article/${firstArticleId}`);
    await page.waitForTimeout(3000);

    // Check session storage has state
    let sessionState = await page.evaluate(() => {
      return sessionStorage.getItem("articleListState");
    });

    console.log(
      "Session state after reading article:",
      sessionState ? "exists" : "null"
    );
    expect(sessionState).toBeTruthy();

    // Navigate back
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(2000);

    // Switch to a different feed to trigger state clearing
    const specificFeed = page
      .locator("text=AppleInsider")
      .or(page.locator("text=MacRumors"))
      .first();
    if (await specificFeed.isVisible()) {
      await specificFeed.click();
      await page.waitForTimeout(2000);

      // Check session storage is cleared
      sessionState = await page.evaluate(() => {
        return sessionStorage.getItem("articleListState");
      });

      console.log(
        "Session state after feed change:",
        sessionState ? "exists" : "null"
      );
      expect(sessionState).toBeNull();

      console.log("✅ SUCCESS: Session storage cleared after feed change");
    }

    console.log("🏁 Session storage test completed");
  });
});
