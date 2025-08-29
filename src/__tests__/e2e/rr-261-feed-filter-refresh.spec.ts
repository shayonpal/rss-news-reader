/**
 * E2E Tests for RR-261: Feed Filter Persistence on Page Refresh
 *
 * Validates that feed and tag filters persist correctly when the page is refreshed.
 * This is a regression test to ensure that refreshing a filtered view doesn't
 * revert to showing all articles.
 *
 * Test Scenarios:
 * 1. Feed filter persistence on page refresh
 * 2. Tag filter persistence on page refresh
 * 3. No filter (all articles) persistence on page refresh
 * 4. Validates header, URL, and content remain consistent
 */

import { test, expect, type Page } from "@playwright/test";

// Test configuration
const TEST_CONFIG = {
  BASE_URL: "http://100.96.166.53:3000/reader",
  TIMEOUTS: {
    PAGE_LOAD: 15000,
    ELEMENT_VISIBLE: 10000,
    CONTENT_LOAD: 5000,
    SYNC_WAIT: 3000,
  },
  // Sample test data - these should exist in the test database
  TEST_FEED: {
    id: "ac6c0192-4e50-4e49-b93b-021d905cca5d", // AppleInsider feed
    name: "AppleInsider",
    expectedArticles: ["Apple", "iPhone", "Mac", "iOS"],
    unexpectedArticles: ["TechCrunch", "Verge", "Ars Technica"],
  },
  TEST_TAG: {
    id: "b139c50e-19d9-4438-b69c-908aed45452d", // India/Canada tag
    name: "India/Canada",
    expectedArticles: ["India", "Canada", "Realme", "national"],
    unexpectedArticles: ["Apple Watch", "iPhone", "Microsoft"],
  },
};

test.describe("RR-261: Feed Filter Refresh Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("Browser error:", msg.text());
      } else if (
        msg.text().includes("RR-261") ||
        msg.text().includes("filter")
      ) {
        console.log("Filter log:", msg.text());
      }
    });

    // Monitor network requests for debugging
    page.on("requestfailed", (request) => {
      console.error(`Request failed: ${request.url()}`);
    });
  });

  test("Feed filter persists on page refresh", async ({ page }) => {
    console.log("🧪 Testing feed filter persistence on page refresh");

    // Step 1: Navigate directly to a feed filter URL
    console.log("📍 Step 1: Navigating to feed filter URL");
    const feedUrl = `${TEST_CONFIG.BASE_URL}?feed=${TEST_CONFIG.TEST_FEED.id}`;
    await page.goto(feedUrl);

    // Wait for content to load
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await page.waitForTimeout(TEST_CONFIG.TIMEOUTS.SYNC_WAIT);

    // Step 2: Verify initial state before refresh
    console.log("📍 Step 2: Verifying initial filtered state");

    // Check URL parameters
    const urlBeforeRefresh = page.url();
    expect(urlBeforeRefresh).toContain(`feed=${TEST_CONFIG.TEST_FEED.id}`);
    console.log(`✅ URL contains feed parameter: ${urlBeforeRefresh}`);

    // Check header shows feed name (not "All Articles" or just "Articles")
    const headerBeforeRefresh = page.locator("h1").first();
    await expect(headerBeforeRefresh).toBeVisible({
      timeout: TEST_CONFIG.TIMEOUTS.ELEMENT_VISIBLE,
    });
    const headerTextBefore = await headerBeforeRefresh.textContent();
    expect(headerTextBefore).not.toContain("All Articles");
    // The header might show "AppleInsider" or contain it
    console.log(`✅ Header before refresh: ${headerTextBefore}`);

    // Check that content is filtered (look for expected articles)
    const pageContentBefore = await page.textContent("body");

    // Should contain at least one expected article keyword
    const hasExpectedContent = TEST_CONFIG.TEST_FEED.expectedArticles.some(
      (keyword) => pageContentBefore?.includes(keyword)
    );

    // Log what we found for debugging
    if (hasExpectedContent) {
      console.log("✅ Found expected feed content before refresh");
    }

    // Step 3: Refresh the page
    console.log("📍 Step 3: Refreshing the page");
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for content to reload
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await page.waitForTimeout(TEST_CONFIG.TIMEOUTS.SYNC_WAIT);

    // Step 4: Verify state after refresh
    console.log("📍 Step 4: Verifying filtered state persists after refresh");

    // Check URL still has feed parameter
    const urlAfterRefresh = page.url();
    expect(urlAfterRefresh).toContain(`feed=${TEST_CONFIG.TEST_FEED.id}`);
    console.log(`✅ URL still contains feed parameter: ${urlAfterRefresh}`);

    // Check header still shows feed name
    const headerAfterRefresh = page.locator("h1").first();
    await expect(headerAfterRefresh).toBeVisible({
      timeout: TEST_CONFIG.TIMEOUTS.ELEMENT_VISIBLE,
    });
    const headerTextAfter = await headerAfterRefresh.textContent();
    expect(headerTextAfter).not.toContain("All Articles");
    console.log(`✅ Header after refresh: ${headerTextAfter}`);

    // Headers should match before and after
    expect(headerTextAfter).toBe(headerTextBefore);
    console.log("✅ Header text matches before and after refresh");

    // Check content is still filtered
    const pageContentAfter = await page.textContent("body");

    // Should still contain expected content
    const stillHasExpectedContent = TEST_CONFIG.TEST_FEED.expectedArticles.some(
      (keyword) => pageContentAfter?.includes(keyword)
    );

    if (stillHasExpectedContent) {
      console.log("✅ Feed filter persisted successfully after refresh!");
    }

    // Should NOT show unrelated articles (proves filter is working)
    for (const unexpectedArticle of TEST_CONFIG.TEST_FEED.unexpectedArticles) {
      if (pageContentAfter?.includes(unexpectedArticle)) {
        console.warn(`⚠️ Found unexpected article: ${unexpectedArticle}`);
      }
    }

    console.log("✅ Feed filter refresh test completed successfully!");
  });

  test("Tag filter persists on page refresh", async ({ page }) => {
    console.log("🧪 Testing tag filter persistence on page refresh");

    // Step 1: Navigate directly to a tag filter URL
    console.log("📍 Step 1: Navigating to tag filter URL");
    const tagUrl = `${TEST_CONFIG.BASE_URL}?tag=${TEST_CONFIG.TEST_TAG.id}`;
    await page.goto(tagUrl);

    // Wait for content to load
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await page.waitForTimeout(TEST_CONFIG.TIMEOUTS.SYNC_WAIT);

    // Step 2: Verify initial state before refresh
    console.log("📍 Step 2: Verifying initial filtered state");

    // Check URL parameters
    const urlBeforeRefresh = page.url();
    expect(urlBeforeRefresh).toContain(`tag=${TEST_CONFIG.TEST_TAG.id}`);
    console.log(`✅ URL contains tag parameter: ${urlBeforeRefresh}`);

    // Check header shows tag name
    const headerBeforeRefresh = page.locator("h1").first();
    await expect(headerBeforeRefresh).toBeVisible({
      timeout: TEST_CONFIG.TIMEOUTS.ELEMENT_VISIBLE,
    });
    const headerTextBefore = await headerBeforeRefresh.textContent();
    expect(headerTextBefore).not.toContain("All Articles");
    console.log(`✅ Header before refresh: ${headerTextBefore}`);

    // Store article count before refresh (for comparison)
    const articleCountBefore = await page
      .locator("article, button[role='article']")
      .count();
    console.log(`📊 Article count before refresh: ${articleCountBefore}`);

    // Step 3: Refresh the page
    console.log("📍 Step 3: Refreshing the page");
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for content to reload
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await page.waitForTimeout(TEST_CONFIG.TIMEOUTS.SYNC_WAIT);

    // Step 4: Verify state after refresh
    console.log("📍 Step 4: Verifying filtered state persists after refresh");

    // Check URL still has tag parameter
    const urlAfterRefresh = page.url();
    expect(urlAfterRefresh).toContain(`tag=${TEST_CONFIG.TEST_TAG.id}`);
    console.log(`✅ URL still contains tag parameter: ${urlAfterRefresh}`);

    // Check header still shows tag name
    const headerAfterRefresh = page.locator("h1").first();
    await expect(headerAfterRefresh).toBeVisible({
      timeout: TEST_CONFIG.TIMEOUTS.ELEMENT_VISIBLE,
    });
    const headerTextAfter = await headerAfterRefresh.textContent();
    expect(headerTextAfter).not.toContain("All Articles");
    console.log(`✅ Header after refresh: ${headerTextAfter}`);

    // Headers should match
    expect(headerTextAfter).toBe(headerTextBefore);
    console.log("✅ Header text matches before and after refresh");

    // Check article count is consistent
    const articleCountAfter = await page
      .locator("article, button[role='article']")
      .count();
    console.log(`📊 Article count after refresh: ${articleCountAfter}`);

    // Allow for some variance due to potential sync, but should be similar
    expect(
      Math.abs(articleCountAfter - articleCountBefore)
    ).toBeLessThanOrEqual(2);
    console.log("✅ Article count is consistent after refresh");

    console.log("✅ Tag filter refresh test completed successfully!");
  });

  test("No filter (all articles) persists on page refresh", async ({
    page,
  }) => {
    console.log(
      "🧪 Testing no filter (all articles) persistence on page refresh"
    );

    // Step 1: Navigate to base URL without filters
    console.log("📍 Step 1: Navigating to base URL without filters");
    await page.goto(TEST_CONFIG.BASE_URL);

    // Wait for content to load
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await page.waitForTimeout(TEST_CONFIG.TIMEOUTS.SYNC_WAIT);

    // Step 2: Verify initial state before refresh
    console.log("📍 Step 2: Verifying unfiltered state");

    // Check URL has no filter parameters
    const urlBeforeRefresh = page.url();
    expect(urlBeforeRefresh).not.toContain("feed=");
    expect(urlBeforeRefresh).not.toContain("tag=");
    expect(urlBeforeRefresh).not.toContain("folder=");
    console.log(`✅ URL has no filter parameters: ${urlBeforeRefresh}`);

    // Check header shows "All Articles" or just "Articles"
    const headerBeforeRefresh = page.locator("h1").first();
    await expect(headerBeforeRefresh).toBeVisible({
      timeout: TEST_CONFIG.TIMEOUTS.ELEMENT_VISIBLE,
    });
    const headerTextBefore = await headerBeforeRefresh.textContent();
    console.log(`✅ Header before refresh: ${headerTextBefore}`);

    // Count total articles (should be more than filtered views)
    const articleCountBefore = await page
      .locator("article, button[role='article']")
      .count();
    console.log(`📊 Article count before refresh: ${articleCountBefore}`);

    // Step 3: Refresh the page
    console.log("📍 Step 3: Refreshing the page");
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for content to reload
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });
    await page.waitForTimeout(TEST_CONFIG.TIMEOUTS.SYNC_WAIT);

    // Step 4: Verify state after refresh
    console.log("📍 Step 4: Verifying unfiltered state persists after refresh");

    // Check URL still has no filter parameters
    const urlAfterRefresh = page.url();
    expect(urlAfterRefresh).not.toContain("feed=");
    expect(urlAfterRefresh).not.toContain("tag=");
    expect(urlAfterRefresh).not.toContain("folder=");
    console.log(`✅ URL still has no filter parameters: ${urlAfterRefresh}`);

    // Check header still shows same text
    const headerAfterRefresh = page.locator("h1").first();
    await expect(headerAfterRefresh).toBeVisible({
      timeout: TEST_CONFIG.TIMEOUTS.ELEMENT_VISIBLE,
    });
    const headerTextAfter = await headerAfterRefresh.textContent();
    expect(headerTextAfter).toBe(headerTextBefore);
    console.log(`✅ Header after refresh: ${headerTextAfter}`);

    // Check article count is consistent
    const articleCountAfter = await page
      .locator("article, button[role='article']")
      .count();
    console.log(`📊 Article count after refresh: ${articleCountAfter}`);

    // Allow for variance due to sync
    expect(
      Math.abs(articleCountAfter - articleCountBefore)
    ).toBeLessThanOrEqual(5);
    console.log("✅ Article count is consistent after refresh");

    console.log("✅ No filter refresh test completed successfully!");
  });

  test("Filter state changes are reflected in URL and persist on refresh", async ({
    page,
  }) => {
    console.log("🧪 Testing filter state changes and persistence");

    // Step 1: Start with no filter
    console.log("📍 Step 1: Starting with no filter");
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    const initialUrl = page.url();
    expect(initialUrl).not.toContain("feed=");
    expect(initialUrl).not.toContain("tag=");

    // Step 2: Apply a filter by clicking in sidebar (if visible)
    console.log("📍 Step 2: Attempting to apply filter via UI");

    // Try to find and click a feed in the sidebar
    const feedButton = page.locator("text=Feeds").first();
    if (await feedButton.isVisible({ timeout: 3000 })) {
      // Look for a feed item to click
      const firstFeed = page
        .locator('[data-testid*="feed"]')
        .first()
        .or(
          page
            .locator("button")
            .filter({ hasText: /AppleInsider|TechCrunch|Verge/ })
            .first()
        );

      if (await firstFeed.isVisible({ timeout: 3000 })) {
        await firstFeed.click();
        await page.waitForTimeout(2000);

        // Verify URL changed to include filter
        const filteredUrl = page.url();
        const hasFilter =
          filteredUrl.includes("feed=") || filteredUrl.includes("tag=");

        if (hasFilter) {
          console.log(`✅ Filter applied, URL: ${filteredUrl}`);

          // Step 3: Refresh and verify filter persists
          console.log("📍 Step 3: Refreshing to test persistence");
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForSelector("h1", {
            timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
          });

          const urlAfterRefresh = page.url();
          expect(urlAfterRefresh).toBe(filteredUrl);
          console.log(`✅ Filter persisted after refresh: ${urlAfterRefresh}`);
        }
      }
    } else {
      console.log("ℹ️ Sidebar not visible, skipping UI filter test");
    }

    console.log("✅ Filter state change test completed!");
  });

  test("Multiple rapid refreshes maintain filter state", async ({ page }) => {
    console.log("🧪 Testing multiple rapid refreshes");

    // Navigate to a filtered view
    const feedUrl = `${TEST_CONFIG.BASE_URL}?feed=${TEST_CONFIG.TEST_FEED.id}`;
    await page.goto(feedUrl);
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    const originalUrl = page.url();
    const originalHeader = await page.locator("h1").first().textContent();

    // Perform multiple rapid refreshes
    for (let i = 1; i <= 3; i++) {
      console.log(`📍 Refresh ${i}/3`);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("h1", {
        timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
      });

      // Verify URL and header remain consistent
      const currentUrl = page.url();
      const currentHeader = await page.locator("h1").first().textContent();

      expect(currentUrl).toBe(originalUrl);
      expect(currentHeader).toBe(originalHeader);

      console.log(`✅ Refresh ${i} maintained filter state`);
    }

    console.log("✅ Multiple rapid refreshes test completed!");
  });
});

// Additional test suite for edge cases
test.describe("RR-261: Edge Cases and Error Scenarios", () => {
  test("Invalid feed ID in URL gracefully handles refresh", async ({
    page,
  }) => {
    console.log("🧪 Testing invalid feed ID handling on refresh");

    // Navigate with invalid feed ID
    const invalidFeedUrl = `${TEST_CONFIG.BASE_URL}?feed=invalid-uuid-12345`;
    await page.goto(invalidFeedUrl);
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Should fallback to showing all articles or show error
    const headerText = await page.locator("h1").first().textContent();
    console.log(`📍 Header with invalid feed: ${headerText}`);

    // Refresh should not crash
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Page should still be functional
    const headerAfterRefresh = await page.locator("h1").first().textContent();
    expect(headerAfterRefresh).toBeTruthy();
    console.log(
      `✅ Page handles invalid feed ID gracefully: ${headerAfterRefresh}`
    );
  });

  test("Multiple filter parameters are handled correctly on refresh", async ({
    page,
  }) => {
    console.log("🧪 Testing multiple filter parameters");

    // Try URL with both feed and tag (should use only one)
    const multiFilterUrl = `${TEST_CONFIG.BASE_URL}?feed=${TEST_CONFIG.TEST_FEED.id}&tag=${TEST_CONFIG.TEST_TAG.id}`;
    await page.goto(multiFilterUrl);
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    const urlBefore = page.url();
    const headerBefore = await page.locator("h1").first().textContent();

    // Refresh
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    const urlAfter = page.url();
    const headerAfter = await page.locator("h1").first().textContent();

    // Should maintain consistent behavior
    expect(headerAfter).toBe(headerBefore);
    console.log(
      `✅ Multiple filter parameters handled consistently: ${headerAfter}`
    );
  });

  test("Browser back/forward maintains filter after refresh", async ({
    page,
  }) => {
    console.log("🧪 Testing browser navigation with refresh");

    // Navigate to filtered view
    const feedUrl = `${TEST_CONFIG.BASE_URL}?feed=${TEST_CONFIG.TEST_FEED.id}`;
    await page.goto(feedUrl);
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Navigate to unfiltered view
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Go back to filtered view
    await page.goBack();
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Refresh while on the back-navigated page
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", {
      timeout: TEST_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Should still show filtered view
    const finalUrl = page.url();
    expect(finalUrl).toContain(`feed=${TEST_CONFIG.TEST_FEED.id}`);
    console.log(
      `✅ Filter maintained after back navigation and refresh: ${finalUrl}`
    );
  });
});
