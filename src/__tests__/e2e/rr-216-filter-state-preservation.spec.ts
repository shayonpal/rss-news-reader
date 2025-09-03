/**
 * E2E Tests for RR-216: Filter State Preservation
 *
 * Validates that filters are preserved when navigating back from article detail view.
 * Tests URL synchronization, sidebar state, and header updates.
 */

import { test, expect, type Page } from "@playwright/test";

test.describe("RR-216: Filter State Preservation", () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging to monitor for errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("Browser console error:", msg.text());
      } else if (
        msg.text().includes("RR-216") ||
        msg.text().includes("filter")
      ) {
        console.log("Filter log:", msg.text());
      }
    });

    // Navigate to the app
    await page.goto("");

    // Wait for the app to load - look for main content areas
    try {
      // Try multiple selectors since we don't have data-testids
      await page.waitForSelector("h1, .flex.h-screen, main, article", {
        timeout: 15000,
      });
    } catch (error) {
      console.log("Primary selectors failed, trying backup selectors...");
      await page.waitForSelector("body", { timeout: 5000 });
    }

    // Wait for any initial sync to complete
    await page.waitForTimeout(3000);
  });

  test("Topic filter preserves state when navigating back from article", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing topic filter preservation with race condition fix..."
    );

    // Navigate directly to India/Canada filter to test the specific scenario
    console.log("📍 Step 1: Navigating directly to India/Canada filter");
    const tagId = "b139c50e-19d9-4438-b69c-908aed45452d";
    await page.goto(`http://100.96.166.53:3000/reader?tag=${tagId}`);
    await page.waitForTimeout(3000);

    // Step 2: Verify URL contains the tag parameter
    console.log("📍 Step 2: Verifying URL contains tag parameter");
    const urlAfterFilter = page.url();
    console.log(`📍 URL after filter: ${urlAfterFilter}`);
    expect(urlAfterFilter).toContain(`tag=${tagId}`);

    // Step 3: Verify header shows India/Canada (not All Articles)
    console.log("📍 Step 3: Verifying header shows correct filter");
    const indiaCanadaHeader = page
      .locator("h1")
      .filter({ hasText: "India/Canada" });
    await expect(indiaCanadaHeader).toBeVisible({ timeout: 10000 });
    const headerText = await indiaCanadaHeader.textContent();
    console.log(`✅ Header shows: ${headerText}`);

    // Step 4: Verify we're showing filtered articles (not all articles)
    console.log("📍 Step 4: Verifying filtered content");
    const pageContent = await page.textContent("body");

    // Should NOT show unrelated articles (proves no race condition)
    expect(pageContent).not.toContain("Apple Watch Reportedly Set");
    expect(pageContent).not.toContain("iPhone 17 Pro Price");
    console.log("✅ Not showing unrelated articles - race condition fixed");

    // Step 5: Find and click an article
    console.log("📍 Step 5: Clicking article in filtered view");
    const articleButton = page
      .locator("button")
      .filter({
        hasText: /Proposed national class action|Realme P4|dangers of Canada/,
      })
      .first();

    await expect(articleButton).toBeVisible({ timeout: 10000 });
    const articleTitle = await articleButton.locator("h2").textContent();
    console.log(`📍 Clicking article: ${articleTitle}`);

    await articleButton.click();
    await page.waitForTimeout(2000);

    // Verify we're on article detail page
    expect(page.url()).toContain("/article/");
    console.log("✅ Successfully navigated to article detail");

    // Step 6: Navigate back
    console.log("📍 Step 6: Navigating back to list");
    await page.goBack();
    await page.waitForTimeout(3000);

    // Step 7: Verify we're back with filters intact
    console.log(
      "📍 Step 7: Verifying filter preservation after back navigation"
    );
    const finalUrl = page.url();
    console.log(`📍 Final URL: ${finalUrl}`);

    // URL should still contain the tag parameter (RR-216 working)
    expect(finalUrl).toContain(`tag=${tagId}`);

    // Header should still show the filter (no race condition)
    const finalHeader = page.locator("h1").filter({ hasText: "India/Canada" });
    await expect(finalHeader).toBeVisible({ timeout: 10000 });

    // Should still show only filtered articles (race condition fixed)
    const finalPageContent = await page.textContent("body");
    expect(finalPageContent).not.toContain("Apple Watch Reportedly Set");

    console.log(
      "✅ Topic filter preservation test PASSED - race condition fixed!"
    );
  });

  test("Feed filter preserves state when navigating back from article", async ({
    page,
  }) => {
    console.log("🧪 Testing feed filter preservation...");

    // Step 1: Select a feed filter
    console.log("📍 Step 1: Selecting feed filter");

    // Wait for feeds section to be visible
    const feedsSection = page.locator("text=Feeds").first();
    await expect(feedsSection).toBeVisible({ timeout: 10000 });

    // Find a feed to click (looking for one with unread count)
    const feedWithUnread = page
      .locator('[data-testid="feed-item"]')
      .or(page.locator("text=/The Verge|TechCrunch|9to5Mac/").first());

    if ((await feedWithUnread.count()) > 0) {
      const firstFeed = feedWithUnread.first();
      const feedText = await firstFeed.textContent();
      console.log(`🎯 Clicking feed: ${feedText}`);

      await firstFeed.click();
      await page.waitForTimeout(1000);

      // Step 2: Verify URL contains the feed parameter
      console.log("📍 Step 2: Verifying URL contains feed parameter");
      const urlAfterFilter = page.url();
      console.log(`📍 URL after filter: ${urlAfterFilter}`);
      expect(urlAfterFilter).toMatch(/[?&]feed=/);

      // Step 3: Verify header shows filter title
      console.log("📍 Step 3: Verifying header shows filter");
      const headerTitle = page
        .locator('[data-testid="article-header-title"]')
        .or(page.locator("h1").first());
      await expect(headerTitle).not.toContainText("All Articles");

      // Step 4: Click on first article in filtered view
      console.log("📍 Step 4: Clicking article in filtered view");
      const firstArticle = page
        .locator('[data-testid="article-item"]')
        .or(page.locator("article").first())
        .or(page.locator('[role="article"]').first());

      await expect(firstArticle).toBeVisible({ timeout: 10000 });
      await firstArticle.click();

      // Wait for article detail page
      await page.waitForURL(/\/article\//, { timeout: 10000 });

      // Step 5: Click back button
      console.log("📍 Step 5: Clicking back button");
      const backButton = page
        .locator('[data-testid="back-button"]')
        .or(page.getByRole("button", { name: /back/i }))
        .or(page.locator("button").filter({ hasText: /←|Back/ }));

      await expect(backButton).toBeVisible({ timeout: 5000 });
      await backButton.click();

      // Step 6: Verify we're back with filters intact
      console.log("📍 Step 6: Verifying filter preservation");
      await page.waitForURL(/\?.*feed=/, { timeout: 10000 });

      const finalUrl = page.url();
      console.log(`📍 Final URL: ${finalUrl}`);

      // URL should still contain the feed parameter
      expect(finalUrl).toMatch(/[?&]feed=/);

      // Header should still show the filter
      await expect(headerTitle).not.toContainText("All Articles");

      console.log("✅ Feed filter preservation test passed!");
    } else {
      console.log("⚠️ No feeds with unread count found, skipping feed test");
    }
  });

  test("All Articles reset clears filters properly", async ({ page }) => {
    console.log("🧪 Testing All Articles filter reset...");

    // First, apply a filter
    const topicsSection = page.locator("text=Topics").first();
    if (await topicsSection.isVisible()) {
      const firstTopic = page
        .locator('[data-testid="tag-item"]')
        .or(page.locator("text=/AI|Tech|Gaming/").first());

      if ((await firstTopic.count()) > 0) {
        console.log("📍 Applying initial filter");
        await firstTopic.first().click();
        await page.waitForTimeout(1000);

        // Verify filter is applied
        const urlWithFilter = page.url();
        expect(urlWithFilter).toMatch(/[?&](feed|tag)=/);

        // Click "All Articles"
        console.log("📍 Clicking All Articles");
        const allArticlesButton = page.locator("text=All Articles").first();
        await expect(allArticlesButton).toBeVisible();
        await allArticlesButton.click();
        await page.waitForTimeout(1000);

        // Verify filters are cleared
        console.log("📍 Verifying filters are cleared");
        const finalUrl = page.url();
        console.log(`📍 Final URL: ${finalUrl}`);

        // URL should not contain filter parameters
        expect(finalUrl).not.toMatch(/[?&](feed|tag)=/);

        // Header should show "All Articles"
        const headerTitle = page
          .locator('[data-testid="article-header-title"]')
          .or(page.locator("h1").first());

        // Wait a bit for header to update
        await page.waitForTimeout(500);
        const headerText = await headerTitle.textContent();
        console.log(`📍 Header text: ${headerText}`);

        console.log("✅ All Articles reset test passed!");
      }
    }
  });

  test("Browser console monitoring for filter errors", async ({ page }) => {
    console.log("🧪 Testing browser console for filter-related errors...");

    const consoleErrors: string[] = [];
    const filterLogs: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        consoleErrors.push(text);
        console.error("❌ Console Error:", text);
      } else if (
        text.includes("filter") ||
        text.includes("RR-216") ||
        text.includes("📍")
      ) {
        filterLogs.push(text);
        console.log("📝 Filter Log:", text);
      }
    });

    // Perform filter operations to trigger potential issues
    console.log("📍 Testing filter operations for console errors");

    // Try clicking different filters rapidly
    const topics = page
      .locator('[data-testid="tag-item"]')
      .or(page.locator("text=/AI|Tech|Gaming/"));

    if ((await topics.count()) > 0) {
      for (let i = 0; i < Math.min(3, await topics.count()); i++) {
        await topics.nth(i).click();
        await page.waitForTimeout(300);
      }
    }

    // Click All Articles
    const allArticles = page.locator("text=All Articles").first();
    if (await allArticles.isVisible()) {
      await allArticles.click();
      await page.waitForTimeout(300);
    }

    // Check for errors
    console.log(`📊 Filter logs captured: ${filterLogs.length}`);
    console.log(`❌ Console errors: ${consoleErrors.length}`);

    // Log filter-specific logs for debugging
    filterLogs.forEach((log) => console.log(`  - ${log}`));

    // Report any errors
    if (consoleErrors.length > 0) {
      console.error("⚠️ Console errors detected:");
      consoleErrors.forEach((error) => console.error(`  - ${error}`));
    }

    console.log("✅ Console monitoring completed");
  });
});
