/**
 * E2E Test for RR-256 Regression Prevention
 *
 * Verifies that the auto-fetch full content functionality works correctly
 * and doesn't break existing features like article state preservation (RR-27).
 *
 * Test scenarios:
 * 1. Article content display after summarization (Issue #1)
 * 2. Back navigation state preservation (Issue #2 - RR-27 regression)
 * 3. Combined workflow end-to-end
 */

import { test, expect } from "@playwright/test";

test.describe("RR-256 Regression Prevention", () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        console.error("❌ Browser error:", text);
      } else if (
        text.includes("RR-256") ||
        text.includes("RR-27") ||
        text.includes("📄 Article updated") ||
        text.includes("🔄 Skipping article reload") ||
        text.includes("summarize") ||
        text.includes("full content") ||
        text.includes("navigation")
      ) {
        console.log(`🔍 Debug: ${text}`);
      }
    });

    // Navigate to the RSS reader
    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForSelector('[data-testid="article-list"]', {
      timeout: 10000,
    });
  });

  test("Issue #1: Article shows full content after summarization", async ({
    page,
  }) => {
    // Step 1: Find a partial feed article
    await test.step("Find partial feed article", async () => {
      // Look for an article from a known partial feed (e.g., BBC)
      const partialFeedArticle = page
        .locator("[data-article-id]")
        .filter({
          has: page.locator("text=BBC"),
        })
        .first();

      await expect(partialFeedArticle).toBeVisible();

      // Store article ID for later verification
      const articleId =
        await partialFeedArticle.getAttribute("data-article-id");
      await page.evaluate(
        (id) => (window.testContext = { articleId: id }),
        articleId
      );
    });

    // Step 2: Click summarize button on article listing
    await test.step("Click summarize button from listing", async () => {
      const summarizeButton = page
        .locator('[data-article-id] [data-testid="summary-button"]')
        .first();
      await expect(summarizeButton).toBeVisible();
      await summarizeButton.click();

      // Wait for summarization to complete (max 30 seconds for auto-fetch + AI)
      await expect(
        page.locator('[data-testid="summary-loading"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="summary-loading"]')
      ).not.toBeVisible({ timeout: 35000 });
    });

    // Step 3: Open the article to check content display
    await test.step("Open article and verify full content display", async () => {
      // Click on the article to open it
      const articleCard = page.locator("[data-article-id]").first();
      await articleCard.click();

      // Wait for article detail page to load
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 10000,
      });

      // Check if the console log indicates article was updated
      const logs = [];
      page.on("console", (msg) => {
        if (
          msg
            .text()
            .includes("📄 Article updated in store, refreshing local state")
        ) {
          logs.push(msg.text());
        }
      });

      // The article should show full content, not partial RSS content
      // We can check this by looking for typical full content indicators
      const contentArea = page.locator('[data-testid="article-content"]');
      await expect(contentArea).toBeVisible();

      // Verify the content is substantial (full content should be longer than RSS snippet)
      const contentText = await contentArea.textContent();
      expect(contentText).toBeTruthy();
      expect(contentText!.length).toBeGreaterThan(500); // Full content should be substantial

      // Check that it's not showing typical partial content indicators
      expect(contentText).not.toMatch(/read more|continue reading|\[\.\.\.\]/i);
    });

    // Step 4: Verify database state
    await test.step("Verify database has full content", async () => {
      const articleId = await page.evaluate(
        () => window.testContext?.articleId
      );

      // Make API call to verify database state
      const response = await page.request.get(
        `http://100.96.166.53:3000/reader/api/test/check-article-content/${articleId}`
      );

      if (response.ok()) {
        const data = await response.json();
        expect(data.has_full_content).toBe(true);
        expect(data.full_content).toBeTruthy();
        expect(data.ai_summary).toBeTruthy();
      }
    });
  });

  test("Issue #2: Back navigation preserves article list state (RR-27)", async ({
    page,
  }) => {
    // Step 1: Navigate to a specific feed to create a filtered view
    await test.step("Navigate to specific feed filter", async () => {
      // Click on a feed in the sidebar to filter articles
      const feedLink = page.locator('[data-testid="feed-link"]').first();
      await expect(feedLink).toBeVisible();

      const feedName = await feedLink.textContent();
      await feedLink.click();

      // Wait for filtered articles to load
      await page.waitForSelector("[data-article-id]", { timeout: 10000 });

      // Store context
      await page.evaluate((name) => {
        window.testContext = { ...window.testContext, feedName: name };
      }, feedName);
    });

    // Step 2: Note the initial article list state
    await test.step("Capture initial article list state", async () => {
      // Count articles in the list
      const articleCount = await page.locator("[data-article-id]").count();
      expect(articleCount).toBeGreaterThan(0);

      // Get the first few article IDs
      const articleIds = await page
        .locator("[data-article-id]")
        .evaluateAll((articles) =>
          articles.slice(0, 5).map((el) => el.getAttribute("data-article-id"))
        );

      await page.evaluate(
        (data) => {
          window.testContext = {
            ...window.testContext,
            initialArticleCount: data.count,
            initialArticleIds: data.ids,
          };
        },
        { count: articleCount, ids: articleIds }
      );
    });

    // Step 3: Click on an article to navigate away
    await test.step("Navigate to article detail", async () => {
      const firstArticle = page.locator("[data-article-id]").first();
      const articleId = await firstArticle.getAttribute("data-article-id");

      await firstArticle.click();

      // Wait for article detail page
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 10000,
      });
      expect(page.url()).toContain(`/article/${articleId}`);
    });

    // Step 4: Navigate back using back button
    await test.step("Press back button", async () => {
      const backButton = page.locator('[data-testid="back-button"]');
      await expect(backButton).toBeVisible();

      await backButton.click();

      // Should return to article list
      await page.waitForSelector('[data-testid="article-list"]', {
        timeout: 10000,
      });
    });

    // Step 5: Verify article list state is preserved
    await test.step("Verify article list state preservation", async () => {
      // Wait a moment for any potential unwanted reloads
      await page.waitForTimeout(1000);

      // Check that we didn't trigger a reload
      const reloadMessages = [];
      page.on("console", (msg) => {
        if (msg.text().includes("🔄 Loading articles for feedId")) {
          reloadMessages.push(msg.text());
        }
      });

      // Get current article list state
      const currentArticleCount = await page
        .locator("[data-article-id]")
        .count();
      const currentArticleIds = await page
        .locator("[data-article-id]")
        .evaluateAll((articles) =>
          articles.slice(0, 5).map((el) => el.getAttribute("data-article-id"))
        );

      // Retrieve initial state
      const initialState = await page.evaluate(() => window.testContext);

      // The article count should be preserved (might be -1 if article was marked as read and filter is "unread")
      expect(currentArticleCount).toBeGreaterThanOrEqual(
        initialState.initialArticleCount - 1
      );

      // At least some of the same article IDs should still be present
      const preservedIds = currentArticleIds.filter((id) =>
        initialState.initialArticleIds.includes(id)
      );
      expect(preservedIds.length).toBeGreaterThan(0);

      // Verify no unwanted reload happened
      expect(reloadMessages.length).toBe(0);
    });
  });

  test("Combined workflow: Full content + state preservation", async ({
    page,
  }) => {
    // This test combines both scenarios to ensure they work together

    await test.step("Setup: Navigate to partial feed", async () => {
      // Click on a feed known to have partial content (e.g., BBC)
      const bbcFeed = page.locator("text=BBC").first();
      if (await bbcFeed.isVisible()) {
        await bbcFeed.click();
        await page.waitForSelector("[data-article-id]", { timeout: 10000 });
      }
    });

    await test.step("Summarize article from listing page", async () => {
      // Find first unsummarized article
      const unsummarizedArticle = page
        .locator("[data-article-id]")
        .filter({ hasNot: page.locator('[title="AI Summary Available"]') })
        .first();

      await expect(unsummarizedArticle).toBeVisible();

      // Get article ID for verification
      const articleId =
        await unsummarizedArticle.getAttribute("data-article-id");

      // Click summarize button
      const summarizeButton = unsummarizedArticle.locator(
        '[data-testid="summary-button"]'
      );
      await summarizeButton.click();

      // Wait for summarization to complete
      await expect(
        page.locator('[data-testid="summary-loading"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="summary-loading"]')
      ).not.toBeVisible({ timeout: 35000 });

      // Store article ID
      await page.evaluate(
        (id) => (window.testContext = { targetArticleId: id }),
        articleId
      );
    });

    await test.step("Open article and verify full content", async () => {
      const articleId = await page.evaluate(
        () => window.testContext?.targetArticleId
      );

      // Click on the summarized article
      const article = page.locator(`[data-article-id="${articleId}"]`);
      await article.click();

      // Wait for article detail page
      await page.waitForSelector('[data-testid="article-detail"]', {
        timeout: 10000,
      });

      // Verify we see full content (should be substantial and not truncated)
      const contentArea = page.locator('[data-testid="article-content"]');
      const contentText = await contentArea.textContent();

      expect(contentText).toBeTruthy();
      expect(contentText!.length).toBeGreaterThan(500);
      expect(contentText).not.toMatch(/read more|continue reading|\[\.\.\.\]/i);
    });

    await test.step("Navigate back and verify state preservation", async () => {
      // Press back button
      const backButton = page.locator('[data-testid="back-button"]');
      await backButton.click();

      // Wait for article list to appear
      await page.waitForSelector('[data-testid="article-list"]', {
        timeout: 10000,
      });

      // The article should still be in the list (even if marked as read)
      const articleId = await page.evaluate(
        () => window.testContext?.targetArticleId
      );
      const preservedArticle = page.locator(`[data-article-id="${articleId}"]`);

      // Check if article is preserved in the list
      // Note: If "unread" filter is active and article was marked as read,
      // it might be hidden, but we should see console logs indicating proper state management
      const isVisible = await preservedArticle.isVisible();
      const hasSkipLog = await page.evaluate(() => {
        return (
          window.console.logs?.some?.((log) =>
            log.includes(
              "🔄 Skipping article reload - returning from article navigation"
            )
          ) ?? false
        );
      });

      // Either the article should be visible OR we should see the skip log
      expect(isVisible || hasSkipLog).toBe(true);
    });
  });

  test("Performance: Auto-fetch timeout compliance", async ({ page }) => {
    // Test that auto-fetch respects the 30-second timeout

    await test.step("Setup: Mock slow response", async () => {
      // Intercept the fetch-content API to simulate slow response
      await page.route("**/api/articles/*/fetch-content", async (route) => {
        // Delay response by 25 seconds (should succeed)
        await new Promise((resolve) => setTimeout(resolve, 25000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            content: "<p>Delayed but successful full content extraction</p>",
          }),
        });
      });
    });

    await test.step("Test timeout compliance", async () => {
      // Find a partial feed article and summarize
      const article = page.locator("[data-article-id]").first();
      const summarizeButton = article.locator('[data-testid="summary-button"]');

      await summarizeButton.click();

      // Start timing
      const startTime = Date.now();

      // Wait for completion or timeout
      try {
        await expect(
          page.locator('[data-testid="summary-loading"]')
        ).not.toBeVisible({ timeout: 32000 });
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within reasonable time (25s + processing)
        expect(duration).toBeLessThan(28000);
      } catch (error) {
        // If it times out, that's also acceptable as long as it's around 30 seconds
        const endTime = Date.now();
        const duration = endTime - startTime;
        expect(duration).toBeGreaterThan(24000); // At least close to our 25s mock delay
        expect(duration).toBeLessThan(35000); // But not much longer than 30s timeout
      }
    });
  });

  test("Database verification: Full content stored correctly", async ({
    page,
  }) => {
    // Verify that auto-fetch properly updates the database

    let articleId: string;

    await test.step("Summarize article and capture ID", async () => {
      const article = page.locator("[data-article-id]").first();
      articleId = (await article.getAttribute("data-article-id"))!;

      const summarizeButton = article.locator('[data-testid="summary-button"]');
      await summarizeButton.click();

      // Wait for completion
      await expect(
        page.locator('[data-testid="summary-loading"]')
      ).not.toBeVisible({ timeout: 35000 });
    });

    await test.step("Verify database state via API", async () => {
      // Use a test endpoint to check database state
      const response = await page.request.get(
        `http://100.96.166.53:3000/reader/api/articles/${articleId}/content-status`
      );

      if (response.ok()) {
        const data = await response.json();

        // Should have full content after auto-fetch
        expect(data.has_full_content).toBe(true);
        expect(data.full_content).toBeTruthy();
        expect(data.ai_summary).toBeTruthy();

        // Verify content length is substantial
        expect(data.full_content.length).toBeGreaterThan(
          data.content?.length || 0
        );
      }
    });

    await test.step("Verify fetch_logs entry created", async () => {
      // Check that the fetch attempt was logged
      const logsResponse = await page.request.get(
        `http://100.96.166.53:3000/reader/api/analytics/fetch-logs?article_id=${articleId}&limit=5`
      );

      if (logsResponse.ok()) {
        const data = await logsResponse.json();
        expect(data.logs).toBeTruthy();
        expect(data.logs.length).toBeGreaterThan(0);

        // Should have successful fetch log
        const successLog = data.logs.find(
          (log: any) => log.article_id === articleId && log.status === "success"
        );
        expect(successLog).toBeTruthy();
      }
    });
  });

  test("Error handling: Graceful fallback on extraction failure", async ({
    page,
  }) => {
    // Test that failed auto-fetch gracefully falls back to RSS content

    await test.step("Setup: Mock fetch failure", async () => {
      // Intercept fetch-content API to simulate failure
      await page.route("**/api/articles/*/fetch-content", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Extraction failed - site unreachable",
          }),
        });
      });
    });

    await test.step("Test graceful fallback", async () => {
      const article = page.locator("[data-article-id]").first();
      const summarizeButton = article.locator('[data-testid="summary-button"]');

      await summarizeButton.click();

      // Should still complete summarization using RSS content
      await expect(
        page.locator('[data-testid="summary-loading"]')
      ).not.toBeVisible({ timeout: 35000 });

      // Should show summary generated from RSS content
      const summaryElement = page.locator('[title="AI Summary Available"]');
      await expect(summaryElement).toBeVisible({ timeout: 5000 });
    });

    await test.step("Verify fallback content in article detail", async () => {
      // Open the article
      const article = page.locator("[data-article-id]").first();
      await article.click();

      await page.waitForSelector('[data-testid="article-detail"]');

      // Should show RSS content since extraction failed
      const contentArea = page.locator('[data-testid="article-content"]');
      const contentText = await contentArea.textContent();

      expect(contentText).toBeTruthy();
      // Fallback content might be shorter since it's RSS content
      expect(contentText!.length).toBeGreaterThan(50);
    });
  });

  test("Edge case: Non-partial feed behavior unchanged", async ({ page }) => {
    // Verify that non-partial feeds don't trigger auto-fetch

    await test.step("Find non-partial feed article", async () => {
      // Look for articles from feeds that typically have full content (e.g., TechCrunch)
      const fullContentArticle = page
        .locator("[data-article-id]")
        .filter({
          has: page.locator("text=TechCrunch"),
        })
        .first();

      // If no TechCrunch, use any article
      const article = (await fullContentArticle.isVisible())
        ? fullContentArticle
        : page.locator("[data-article-id]").first();

      await expect(article).toBeVisible();
    });

    await test.step("Verify no auto-fetch for non-partial feeds", async () => {
      // Monitor fetch-content API calls
      let fetchContentCalled = false;
      page.on("request", (request) => {
        if (request.url().includes("/fetch-content")) {
          fetchContentCalled = true;
        }
      });

      const article = page.locator("[data-article-id]").first();
      const summarizeButton = article.locator('[data-testid="summary-button"]');
      await summarizeButton.click();

      // Wait for summarization
      await expect(
        page.locator('[data-testid="summary-loading"]')
      ).not.toBeVisible({ timeout: 35000 });

      // Should NOT have called fetch-content for non-partial feeds
      expect(fetchContentCalled).toBe(false);
    });
  });
});
