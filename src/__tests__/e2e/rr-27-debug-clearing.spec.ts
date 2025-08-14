/**
 * RR-27: Debug state clearing logic
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Debug State Clearing", () => {
  test("should debug the filter change state clearing process", async ({
    page,
  }) => {
    console.log("🔍 Starting debug filter clearing test...");

    // Enable console logs
    page.on("console", (msg) => {
      if (
        msg.text().includes("🧹") ||
        msg.text().includes("📊") ||
        msg.text().includes("🔧")
      ) {
        console.log("BROWSER:", msg.text());
      }
    });

    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Switch to Unread Only mode using dropdown
    const dropdownTrigger = page.locator(
      'button[aria-label*="Current filter"]'
    );
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      // Click on "Unread only" option in dropdown
      const unreadOnlyOption = page.locator('[role="menuitem"]', {
        hasText: "Unread only",
      });
      if (await unreadOnlyOption.isVisible()) {
        await unreadOnlyOption.click();
        await page.waitForTimeout(1000);
        console.log("✅ Switched to Unread Only mode");
      }
    }

    // Check initial session state
    let sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log("Initial session state:", sessionState ? "exists" : "null");

    // Read an article to create session state
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");
    console.log(`📖 Reading article: ${firstArticleId}`);

    await page.goto(`${RSS_READER_URL}/article/${firstArticleId}`);
    await page.waitForTimeout(3000);

    // Check session state after reading
    sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log(
      "Session state after reading:",
      sessionState ? "exists with preserved articles" : "null"
    );

    // Navigate back to list
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Verify article is preserved
    await articles.first().waitFor({ timeout: 10000 });
    const preservedArticle = page.locator(
      `[data-article-id="${firstArticleId}"]`
    );
    const isPreservedBefore = await preservedArticle.isVisible();
    console.log(`Article preserved before filter change: ${isPreservedBefore}`);

    // Get current filter mode by checking dropdown button text
    const currentFilter = await page.evaluate(() => {
      // Look for the dropdown trigger button with filter text
      const dropdownButton = document.querySelector(
        'button[aria-label*="Current filter"]'
      );
      if (dropdownButton) {
        const text = dropdownButton.textContent?.toLowerCase() || "";
        if (text.includes("unread only")) return "unread";
        if (text.includes("all articles")) return "all";
        if (text.includes("read only")) return "read";
      }
      return "unknown";
    });
    console.log(`Current detected filter: ${currentFilter}`);

    // Switch to All Articles mode using dropdown
    console.log("🔄 Switching to All Articles...");
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      // Click on "All articles" option in dropdown
      const allArticlesOption = page.locator('[role="menuitem"]', {
        hasText: "All articles",
      });
      if (await allArticlesOption.isVisible()) {
        await allArticlesOption.click();
        await page.waitForTimeout(2000); // Give more time for state changes
        console.log("✅ Clicked All Articles option");
      }
    }

    // Check if session state was cleared
    sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log(
      "Session state after switching to All:",
      sessionState ? "still exists" : "cleared"
    );

    // Switch back to Unread Only using dropdown
    console.log("🔄 Switching back to Unread Only...");
    if (await dropdownTrigger.isVisible()) {
      await dropdownTrigger.click();
      await page.waitForTimeout(500);

      // Click on "Unread only" option in dropdown
      const unreadOnlyOption = page.locator('[role="menuitem"]', {
        hasText: "Unread only",
      });
      if (await unreadOnlyOption.isVisible()) {
        await unreadOnlyOption.click();
        await page.waitForTimeout(2000);
        console.log("✅ Clicked Unread Only option");
      }
    }

    // Wait for articles to reload
    await articles.first().waitFor({ timeout: 10000 });

    // Check final session state
    sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log("Final session state:", sessionState ? "exists" : "null");

    // Check if article is still visible
    const isPreservedAfter = await preservedArticle.isVisible();
    console.log(`Article preserved after filter changes: ${isPreservedAfter}`);

    // Get final article count
    const finalCount = await articles.count();
    console.log(`Final article count: ${finalCount}`);

    // The key test - if state was properly cleared, the read article should not be visible
    if (isPreservedAfter) {
      console.log(
        "❌ Article is still preserved - state clearing may not be working"
      );
    } else {
      console.log("✅ Article is gone - state clearing worked correctly");
    }

    console.log("🏁 Debug filter clearing test completed");
  });

  test("should debug feed changes for state clearing", async ({ page }) => {
    console.log("🔍 Starting debug feed change test...");

    // Enable console logs
    page.on("console", (msg) => {
      if (
        msg.text().includes("🧹") ||
        msg.text().includes("📊") ||
        msg.text().includes("🔧")
      ) {
        console.log("BROWSER:", msg.text());
      }
    });

    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Switch to Unread Only mode
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
        console.log("✅ Switched to Unread Only mode");
      }
    }

    // Read an article to create session state
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");
    console.log(`📖 Reading article: ${firstArticleId}`);

    await page.goto(`${RSS_READER_URL}/article/${firstArticleId}`);
    await page.waitForTimeout(3000);

    // Navigate back and verify article is preserved
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);
    await articles.first().waitFor({ timeout: 10000 });

    const preservedArticle = page.locator(
      `[data-article-id="${firstArticleId}"]`
    );
    const isPreservedBefore = await preservedArticle.isVisible();
    console.log(`Article preserved before feed change: ${isPreservedBefore}`);

    // Check session state before feed change
    let sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });
    console.log(
      "Session state before feed change:",
      sessionState ? "exists" : "null"
    );

    // Click on a specific feed
    console.log("🔄 Clicking on specific feed...");
    const specificFeed = page
      .locator("text=AppleInsider")
      .or(page.locator("text=MacRumors"))
      .or(page.locator("text=Forbes"))
      .first();
    if (await specificFeed.isVisible()) {
      await specificFeed.click();
      await page.waitForTimeout(2000);
      console.log("✅ Clicked on specific feed");

      // Check session state after feed change
      sessionState = await page.evaluate(() => {
        const state = sessionStorage.getItem("articleListState");
        return state ? JSON.parse(state) : null;
      });
      console.log(
        "Session state after clicking specific feed:",
        sessionState ? "exists" : "cleared"
      );
    }

    // Click on "All Articles" to go back
    console.log("🔄 Clicking on All Articles...");
    const allArticlesButton = page.locator("text=All Articles").first();
    if (await allArticlesButton.isVisible()) {
      await allArticlesButton.click();
      await page.waitForTimeout(2000);
      console.log("✅ Clicked on All Articles");

      // Check session state after going back to All Articles
      sessionState = await page.evaluate(() => {
        const state = sessionStorage.getItem("articleListState");
        return state ? JSON.parse(state) : null;
      });
      console.log(
        "Session state after clicking All Articles:",
        sessionState ? "exists" : "cleared"
      );
    }

    // Wait for articles to load and check if preserved article is gone
    await page.waitForTimeout(3000);
    await articles.first().waitFor({ timeout: 10000 });

    const isPreservedAfter = await preservedArticle.isVisible();
    console.log(`Article preserved after feed changes: ${isPreservedAfter}`);

    if (isPreservedAfter) {
      console.log("❌ FAILURE: Article is still preserved after feed change");
    } else {
      console.log(
        "✅ SUCCESS: Article correctly disappeared after feed change"
      );
    }

    console.log("🏁 Debug feed change test completed");
  });
});
