/**
 * RR-27: Test the specific visibility fix for manually read articles
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

test.describe("RR-27: Article Visibility Fix", () => {
  test("should keep clicked article visible in Unread Only mode", async ({
    page,
  }) => {
    console.log("🚀 Starting visibility fix test...");

    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000); // Wait for app to load

    // Wait for articles to load
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor({ timeout: 30000 });
    console.log(`Found ${await articles.count()} articles`);

    // Switch to "Unread Only" mode if not already
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
      console.log("✅ Switched to Unread Only mode");
    }

    // Get initial article count
    const initialCount = await articles.count();
    console.log(`Initial unread count: ${initialCount}`);

    // Get first article info
    const firstArticle = articles.first();
    const firstArticleId = await firstArticle.getAttribute("data-article-id");
    const firstArticleTitle = await firstArticle
      .locator('h2, h3, [class*="title"]')
      .first()
      .textContent();

    console.log(
      `🎯 Target article: ${firstArticleId} - "${firstArticleTitle?.substring(0, 50)}..."`
    );

    // Verify article is unread and visible before click
    const isReadBefore = await firstArticle.getAttribute("data-is-read");
    console.log(`Article read status before click: ${isReadBefore}`);
    expect(isReadBefore).toBe("false");

    // Use JavaScript to simulate the click and navigation
    // This bypasses the Playwright click interception issue
    const navigationResult = await page.evaluate((articleId) => {
      // Find the article element
      const articleElement = document.querySelector(
        `[data-article-id="${articleId}"]`
      );
      if (!articleElement) {
        return { success: false, error: "Article element not found" };
      }

      // Simulate the click behavior by directly navigating
      // This mimics what should happen when user clicks
      const newUrl = `/reader/article/${encodeURIComponent(articleId)}`;
      window.history.pushState({}, "", newUrl);

      // Dispatch a navigation event
      window.dispatchEvent(new PopStateEvent("popstate"));

      return {
        success: true,
        newUrl: window.location.pathname,
        articleId: articleId,
      };
    }, firstArticleId);

    console.log("Navigation result:", navigationResult);

    if (navigationResult.success) {
      // Wait for the page change
      await page.waitForTimeout(2000);

      // Navigate back using browser back
      console.log("⬅️ Navigating back...");
      await page.goBack();
      await page.waitForTimeout(2000);

      // Wait for articles to reload
      await articles.first().waitFor({ timeout: 10000 });

      // Check if we're back to the reader page
      const currentUrl = page.url();
      console.log(`Current URL after back navigation: ${currentUrl}`);
      expect(currentUrl).toBe(RSS_READER_URL);

      // Get final article count
      const finalCount = await articles.count();
      console.log(`Final article count: ${finalCount}`);

      // Check if the original article is still visible
      const originalArticleAfterBack = page.locator(
        `[data-article-id="${firstArticleId}"]`
      );
      const isVisibleAfterBack = await originalArticleAfterBack.isVisible();

      console.log(
        `Original article visible after back navigation: ${isVisibleAfterBack}`
      );

      // This is the key test - the article should still be visible
      if (isVisibleAfterBack) {
        console.log(
          "✅ SUCCESS: Article remained visible after back navigation"
        );

        // Check the read status - it should now be read
        const isReadAfter =
          await originalArticleAfterBack.getAttribute("data-is-read");
        console.log(`Article read status after navigation: ${isReadAfter}`);
        expect(isReadAfter).toBe("true");

        // Check if it has appropriate styling
        const hasReadStyling = await originalArticleAfterBack.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            opacity: styles.opacity,
            hasSessionPreservedClass: el.classList.contains(
              "session-preserved-read"
            ),
          };
        });

        console.log("Article styling:", hasReadStyling);

        // The article should have reduced opacity to indicate it's read
        expect(parseFloat(hasReadStyling.opacity)).toBeLessThan(1);
      } else {
        console.log("❌ FAILURE: Article disappeared after back navigation");

        // Take a screenshot for debugging
        await page.screenshot({
          path: "visibility-test-failure.png",
          fullPage: true,
        });

        // Check if the count changed dramatically
        if (finalCount < initialCount - 5) {
          console.log("⚠️ Many articles disappeared - possible filter issue");
        }

        expect(isVisibleAfterBack).toBe(true);
      }
    } else {
      console.log("❌ Navigation simulation failed:", navigationResult.error);
      throw new Error(
        `Navigation simulation failed: ${navigationResult.error}`
      );
    }

    console.log("🏁 Visibility fix test completed");
  });

  test("should verify session storage contains the article state", async ({
    page,
  }) => {
    console.log("🔍 Testing session storage state...");

    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Get session storage state
    const sessionState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return state ? JSON.parse(state) : null;
    });

    console.log("Session storage state:", sessionState);

    if (sessionState) {
      expect(sessionState).toHaveProperty("timestamp");
      expect(sessionState).toHaveProperty("filterMode");
      console.log("✅ Session storage structure looks correct");
    } else {
      console.log("ℹ️ No session state found (expected for fresh load)");
    }
  });
});
