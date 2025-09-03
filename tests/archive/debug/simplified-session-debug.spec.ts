/**
 * Simplified Session Debug Test
 *
 * Focus on the core session state issue without complex navigation
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

async function waitForArticleToLoad(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

async function captureSessionState(page: Page, label: string) {
  const state = await page.evaluate(() => {
    const sessionState = sessionStorage.getItem("articleListState");
    return {
      timestamp: Date.now(),
      url: window.location.href,
      sessionExists: !!sessionState,
      sessionState: sessionState ? JSON.parse(sessionState) : null,
      articleElements: document.querySelectorAll("[data-article-id]").length,
    };
  });

  console.log(`\n📸 ${label}:`);
  console.log(`URL: ${state.url}`);
  console.log(`Session exists: ${state.sessionExists}`);
  console.log(`Articles in DOM: ${state.articleElements}`);

  if (state.sessionState) {
    console.log(
      `Auto-read: ${state.sessionState.autoReadArticles?.length || 0}`
    );
    console.log(
      `Manual-read: ${state.sessionState.manualReadArticles?.length || 0}`
    );
    console.log(`Feed ID: ${state.sessionState.feedId}`);
    console.log(`Filter: ${state.sessionState.filterMode}`);
  }

  return state;
}

test.describe("Simplified Session Debug", () => {
  test("should debug article reading and session state creation", async ({
    page,
  }) => {
    console.log("🚀 Starting simplified session debug test...");

    // Enable console logging for state management
    page.on("console", (msg) => {
      if (
        msg.type() === "log" &&
        (msg.text().includes("🔧") ||
          msg.text().includes("Hook") ||
          msg.text().includes("State"))
      ) {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });

    // Step 1: Navigate to RSS reader
    console.log("\n📍 Step 1: Navigate to RSS reader");
    await page.goto(RSS_READER_URL);
    await waitForArticleToLoad(page);

    const state1 = await captureSessionState(page, "Initial Load");

    // Step 2: Switch to unread filter
    console.log("\n📍 Step 2: Switch to unread filter");
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
    }

    const state2 = await captureSessionState(page, "After Unread Filter");

    // Step 3: Get article details before clicking
    console.log("\n📍 Step 3: Analyze available articles");
    const articleInfo = await page.evaluate(() => {
      const articles = document.querySelectorAll("[data-article-id]");
      const info = [];

      for (let i = 0; i < Math.min(articles.length, 5); i++) {
        const article = articles[i];
        info.push({
          id: article.getAttribute("data-article-id"),
          isRead: article.getAttribute("data-is-read"),
          visible: window.getComputedStyle(article).display !== "none",
          hasClickHandler: article.getAttribute("role") || article.tagName,
        });
      }

      return info;
    });

    console.log("Available articles:");
    articleInfo.forEach((article, idx) => {
      console.log(
        `${idx + 1}. ID: ${article.id}, Read: ${article.isRead}, Visible: ${article.visible}, Element: ${article.hasClickHandler}`
      );
    });

    if (articleInfo.length === 0) {
      console.log("❌ No articles found, ending test");
      return;
    }

    // Step 4: Click first article and monitor what happens
    console.log("\n📍 Step 4: Click first article");
    const firstArticleId = articleInfo[0].id;
    console.log(`🎯 Target article: ${firstArticleId}`);

    // Monitor navigation
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        console.log(`[NAV] Navigated to: ${frame.url()}`);
      }
    });

    // Click the article
    const firstArticle = page
      .locator(`[data-article-id="${firstArticleId}"]`)
      .first();

    try {
      console.log("Attempting normal click...");
      await firstArticle.click({ timeout: 5000 });
    } catch (e) {
      console.log("Normal click failed, trying force click...");
      await firstArticle.click({ force: true });
    }

    // Wait for navigation and check where we ended up
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log(`📍 Current URL after click: ${currentUrl}`);

    const state3 = await captureSessionState(page, "After Article Click");

    // Check if we're on article detail page
    if (currentUrl.includes("/article/")) {
      console.log("✅ Successfully navigated to article detail page");

      // Wait a bit more for the article to be processed
      await page.waitForTimeout(3000);

      const state4 = await captureSessionState(
        page,
        "After Article Processing"
      );

      // Navigate back to list
      console.log("\n📍 Step 5: Navigate back to list");
      await page.goto(RSS_READER_URL);
      await waitForArticleToLoad(page);

      const state5 = await captureSessionState(page, "Back to List");

      // Check the article's read status now
      const updatedArticleInfo = await page.evaluate((targetId) => {
        const article = document.querySelector(
          `[data-article-id="${targetId}"]`
        );
        if (!article) return null;

        return {
          id: article.getAttribute("data-article-id"),
          isRead: article.getAttribute("data-is-read"),
          visible: window.getComputedStyle(article).display !== "none",
          className: article.className,
          hasSessionPreserved: article.className.includes("session-preserved"),
        };
      }, firstArticleId);

      console.log("\n📊 Article status after reading:");
      if (updatedArticleInfo) {
        console.log(`ID: ${updatedArticleInfo.id}`);
        console.log(`Read: ${updatedArticleInfo.isRead}`);
        console.log(`Visible: ${updatedArticleInfo.visible}`);
        console.log(
          `Session preserved: ${updatedArticleInfo.hasSessionPreserved}`
        );
        console.log(
          `Class: ${updatedArticleInfo.className.substring(0, 100)}...`
        );
      } else {
        console.log("❌ Article not found in DOM after navigation back");
      }

      // Test second article if we have one
      if (articleInfo.length > 1 && updatedArticleInfo?.isRead === "true") {
        console.log("\n📍 Step 6: Test second article");

        // Find the next unread article
        const nextUnreadInfo = await page.evaluate(() => {
          const unreadArticles = document.querySelectorAll(
            '[data-article-id][data-is-read="false"]'
          );
          if (unreadArticles.length === 0) return null;

          const article = unreadArticles[0];
          return {
            id: article.getAttribute("data-article-id"),
            isRead: article.getAttribute("data-is-read"),
          };
        });

        if (nextUnreadInfo) {
          console.log(`🎯 Second target article: ${nextUnreadInfo.id}`);

          const secondArticle = page
            .locator(`[data-article-id="${nextUnreadInfo.id}"]`)
            .first();

          try {
            await secondArticle.click({ timeout: 5000 });
          } catch (e) {
            await secondArticle.click({ force: true });
          }

          await page.waitForTimeout(3000);
          const state6 = await captureSessionState(
            page,
            "After Second Article"
          );

          // Navigate back again
          await page.goto(RSS_READER_URL);
          await waitForArticleToLoad(page);

          const state7 = await captureSessionState(
            page,
            "Back After Second Article"
          );

          // Check how many read articles are now visible
          const finalReadCount = await page.evaluate(() => {
            const readArticles = document.querySelectorAll(
              '[data-article-id][data-is-read="true"]'
            );
            const visibleReadArticles = Array.from(readArticles).filter(
              (article) => window.getComputedStyle(article).display !== "none"
            );
            return {
              total: readArticles.length,
              visible: visibleReadArticles.length,
              ids: Array.from(visibleReadArticles).map((a) =>
                a.getAttribute("data-article-id")
              ),
            };
          });

          console.log("\n🔍 FINAL ANALYSIS:");
          console.log(`Total read articles in DOM: ${finalReadCount.total}`);
          console.log(`Visible read articles: ${finalReadCount.visible}`);
          console.log(`Expected visible: 2 (session preserved)`);
          console.log(`Visible article IDs: ${finalReadCount.ids.join(", ")}`);

          if (finalReadCount.visible > 2) {
            console.log(
              "🐛 BUG CONFIRMED: More than 2 read articles are visible"
            );
            console.log("This indicates session state corruption");
          } else {
            console.log("✅ Behavior appears correct");
          }
        }
      }
    } else {
      console.log("❌ Did not navigate to article detail page");
      console.log("This suggests the click handler is not working properly");
    }

    // Take final screenshot
    await page.screenshot({
      path: "simplified-session-debug.png",
      fullPage: true,
    });

    console.log("\n🏁 Simplified session debug test completed");
  });
});
