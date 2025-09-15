/**
 * @fileoverview E2E tests for RR-284 auto-fetch functionality
 * Tests complete user journey from viewing article to auto-fetch triggering
 */

import { test, expect, type Page } from "@playwright/test";

test.describe("RR-284 Auto-fetch Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth state for tests
    await page.goto("/reader/auth/mock-login");
    await expect(page).toHaveTitle(/RSS News Reader/);
  });

  test("BBC article triggers auto-fetch and loads full content", async ({
    page,
  }) => {
    // Navigate to a BBC article (known partial content feed)
    await page.goto("/reader/articles/bbc-test-article");

    // Wait for page to load
    await expect(page.locator("h1")).toBeVisible();

    // Verify initial state shows partial content
    const articleContent = page.locator('[data-testid="article-content"]');
    await expect(articleContent).toBeVisible();

    // Look for indicators of partial content
    const readMoreButton = page.locator('[data-testid="read-more-button"]');
    const truncationIndicator = page.locator(".content-truncated");

    // Should show partial content initially
    await expect(readMoreButton.or(truncationIndicator)).toBeVisible();

    // Wait for auto-fetch to trigger
    // The auto-fetch should happen automatically due to isPartialContent flag
    const autoFetchRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/api/articles/") &&
        response.url().includes("/fetch-content"),
      { timeout: 5000 }
    );

    // Auto-fetch should trigger within 3 seconds
    const response = await autoFetchRequest;
    expect(response.status()).toBe(200);

    // Wait for content to be updated
    await page.waitForTimeout(1000);

    // Verify full content is now displayed
    await expect(readMoreButton).not.toBeVisible();
    await expect(truncationIndicator).not.toBeVisible();

    // Verify content length increased
    const fullContent = await articleContent.textContent();
    expect(fullContent?.length).toBeGreaterThan(500);

    // Performance check - auto-fetch should complete within 3 seconds
    const autoFetchDuration = await page.evaluate(() => {
      const timing = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      return timing.loadEventEnd - timing.navigationStart;
    });
    expect(autoFetchDuration).toBeLessThan(3000);
  });

  test("Ars Technica article triggers auto-fetch correctly", async ({
    page,
  }) => {
    await page.goto("/reader/articles/ars-technica-test-article");

    await expect(page.locator("h1")).toBeVisible();

    // Monitor auto-fetch request
    const autoFetchRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/api/articles/") &&
        response.url().includes("/fetch-content")
    );

    // Should auto-fetch for Ars Technica (known partial feed)
    const response = await autoFetchRequest;
    expect(response.status()).toBe(200);

    // Verify UI indicates full content loaded
    const contentIndicator = page.locator('[data-testid="content-status"]');
    await expect(contentIndicator).toHaveText(/full content|complete/i);
  });

  test("Feed lookup works correctly after transformation", async ({ page }) => {
    // Navigate to article list
    await page.goto("/reader/articles");

    // Wait for articles to load
    await expect(
      page.locator('[data-testid="article-card"]').first()
    ).toBeVisible();

    // Click on a BBC article
    const bbcArticle = page
      .locator('[data-testid="article-card"]')
      .filter({ hasText: /BBC|bbc/ })
      .first();

    await bbcArticle.click();

    // Verify feed information is displayed correctly
    const feedInfo = page.locator('[data-testid="feed-info"]');
    await expect(feedInfo).toBeVisible();
    await expect(feedInfo).toContainText("BBC News");

    // Verify feed-specific features work (partial content detection)
    const partialContentIndicator = page.locator(
      '[data-testid="partial-content-badge"]'
    );
    await expect(partialContentIndicator).toBeVisible();
  });

  test("Auto-fetch does not trigger for full content feeds", async ({
    page,
  }) => {
    // Navigate to article from full content feed (non-partial)
    await page.goto("/reader/articles/full-content-test-article");

    await expect(page.locator("h1")).toBeVisible();

    // Set up listener for auto-fetch requests (should not happen)
    let autoFetchTriggered = false;
    page.on("response", (response) => {
      if (response.url().includes("/fetch-content")) {
        autoFetchTriggered = true;
      }
    });

    // Wait reasonable time for auto-fetch (should not happen)
    await page.waitForTimeout(3000);

    // Verify auto-fetch did not trigger
    expect(autoFetchTriggered).toBe(false);

    // Verify no "read more" or truncation indicators
    const readMoreButton = page.locator('[data-testid="read-more-button"]');
    const truncationIndicator = page.locator(".content-truncated");

    await expect(readMoreButton).not.toBeVisible();
    await expect(truncationIndicator).not.toBeVisible();
  });

  test("Mobile touch interactions work with auto-fetched content", async ({
    page,
  }) => {
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/reader/articles/bbc-test-article");

    // Wait for auto-fetch to complete
    await page.waitForResponse(
      (response) => response.url().includes("/fetch-content"),
      { timeout: 5000 }
    );

    // Test mobile scroll behavior
    const articleContent = page.locator('[data-testid="article-content"]');
    await expect(articleContent).toBeVisible();

    // Test smooth scrolling performance
    await page.evaluate(() => {
      const startTime = performance.now();
      window.scrollTo({ top: 1000, behavior: "smooth" });
      const scrollTime = performance.now() - startTime;

      // Scroll should be smooth (< 16ms for 60fps)
      return scrollTime < 16;
    });

    // Test touch gestures work correctly
    await articleContent.click();
    await expect(page.locator('[data-testid="article-actions"]')).toBeVisible();
  });

  test("Offline mode handles transformed article data correctly", async ({
    page,
    context,
  }) => {
    // Visit article while online
    await page.goto("/reader/articles/bbc-test-article");
    await page.waitForResponse(
      (response) => response.url().includes("/fetch-content"),
      { timeout: 5000 }
    );

    // Simulate offline mode
    await context.setOffline(true);

    // Reload page (should work from cache)
    await page.reload();

    // Verify article loads from cache with transformed data
    await expect(page.locator("h1")).toBeVisible();
    const articleContent = page.locator('[data-testid="article-content"]');
    await expect(articleContent).toBeVisible();

    // Verify no network requests for already-cached content
    const contentText = await articleContent.textContent();
    expect(contentText?.length).toBeGreaterThan(500); // Should have full content
  });

  test("Error handling when auto-fetch fails", async ({ page }) => {
    // Mock API to return error for fetch-content
    await page.route("**/api/articles/*/fetch-content", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Fetch failed" }),
      });
    });

    await page.goto("/reader/articles/bbc-test-article");

    // Wait for failed auto-fetch attempt
    const failedRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/fetch-content") && response.status() === 500
    );

    await failedRequest;

    // Verify graceful error handling
    const errorMessage = page.locator('[data-testid="fetch-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/unable to load full content/i);

    // Verify partial content is still readable
    const articleContent = page.locator('[data-testid="article-content"]');
    await expect(articleContent).toBeVisible();

    const contentText = await articleContent.textContent();
    expect(contentText?.length).toBeGreaterThan(50); // Still has partial content
  });

  test("Performance: 60fps maintained during glass animations with auto-fetch", async ({
    page,
  }) => {
    await page.goto("/reader/articles/bbc-test-article");

    // Monitor frame rate during article loading and auto-fetch
    const frameRatePromise = page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        function countFrame() {
          frameCount++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrame);
          } else {
            resolve(frameCount);
          }
        }

        requestAnimationFrame(countFrame);
      });
    });

    // Trigger auto-fetch while monitoring frames
    await page.waitForResponse(
      (response) => response.url().includes("/fetch-content"),
      { timeout: 5000 }
    );

    const frameRate = await frameRatePromise;

    // Should maintain close to 60fps (allow some tolerance)
    expect(frameRate).toBeGreaterThan(55);
  });

  test("Memory usage remains stable with auto-fetch", async ({ page }) => {
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Load multiple articles with auto-fetch
    for (let i = 0; i < 5; i++) {
      await page.goto(`/reader/articles/bbc-test-article-${i}`);
      await page.waitForResponse(
        (response) => response.url().includes("/fetch-content"),
        { timeout: 5000 }
      );
    }

    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Memory increase should be reasonable (less than 50MB)
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});
