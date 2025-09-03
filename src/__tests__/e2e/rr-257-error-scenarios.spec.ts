/**
 * RR-257: E2E Error Scenarios for Summarization Feedback
 *
 * Test Specification:
 * - Complete user journeys for error handling
 * - Mobile PWA error scenarios
 * - Network failure and recovery flows
 * - Accessibility validation for error feedback
 */

import { test, expect } from "@playwright/test";

test.describe("RR-257: Summarization Error Feedback", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to RSS Reader app
    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Network Error Scenarios", () => {
    test("should show error toast on network failure with retry action", async ({
      page,
    }) => {
      // Arrange: Intercept API call to simulate network error
      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Click summarize button
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Error toast appears with correct message
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText(/summary failed.*try again/i);

      // Assert: Retry button exists and is clickable
      const retryButton = errorToast.locator("button", { hasText: "Retry" });
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toBeEnabled();
    });

    test("should successfully retry after network error", async ({ page }) => {
      // Arrange: First call fails, second succeeds
      let attemptCount = 0;
      await page.route("**/api/articles/*/summarize", (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          route.abort("failed");
        } else {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              summary: "Successfully generated summary",
              model: "claude-sonnet-4",
            }),
          });
        }
      });

      // Act: Initial failure
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Wait for error toast
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();

      // Act: Click retry
      const retryButton = errorToast.locator("button", { hasText: "Retry" });
      await retryButton.click();

      // Assert: Success toast appears
      const successToast = page.locator(
        '[data-sonner-toast][data-type="success"]'
      );
      await expect(successToast).toBeVisible();
      await expect(successToast).toContainText(/generated/i);
    });

    test("should handle offline scenarios appropriately", async ({ page }) => {
      // Arrange: Simulate offline state
      await page.context().setOffline(true);

      // Act: Attempt summarization while offline
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Offline-specific error message
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText(/offline.*reconnect/i);

      // Cleanup
      await page.context().setOffline(false);
    });
  });

  test.describe("API Error Scenarios", () => {
    test("should handle rate limit errors with appropriate messaging", async ({
      page,
    }) => {
      // Arrange: Rate limit response
      await page.route("**/api/articles/*/summarize", (route) => {
        route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Rate limit exceeded",
            retryAfter: 3600,
          }),
        });
      });

      // Act: Trigger rate limit
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Rate limit specific message
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText(/too many requests/i);
    });

    test("should handle authentication errors", async ({ page }) => {
      // Arrange: Auth error response
      await page.route("**/api/articles/*/summarize", (route) => {
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Authentication failed",
          }),
        });
      });

      // Act: Trigger auth error
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Authentication specific guidance
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText(/session expired/i);
    });

    test("should handle server errors gracefully", async ({ page }) => {
      // Arrange: Server error response
      await page.route("**/api/articles/*/summarize", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Internal server error",
          }),
        });
      });

      // Act: Trigger server error
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Generic error with retry option
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText(/failed.*try again/i);
    });
  });

  test.describe("User Cancellation Scenarios", () => {
    test("should NOT show error on user navigation away", async ({ page }) => {
      // Arrange: Start summarization then navigate away immediately
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();

      // Act: Start summarization and immediately navigate
      await summaryButton.click();
      await page.goBack(); // Simulate user navigation

      // Assert: No error toast for user-initiated cancellation
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).not.toBeVisible({ timeout: 3000 });
    });

    test("should NOT show error when user clicks away from article", async ({
      page,
    }) => {
      // Arrange: Click summarize then click elsewhere
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();

      // Act: Start summarization then click elsewhere
      await summaryButton.click();
      await page.click("header"); // Click away from article

      // Assert: No error toast for implicit cancellation
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).not.toBeVisible({ timeout: 2000 });
    });
  });

  test.describe("Mobile PWA Error Scenarios", () => {
    test("should display error toast correctly on mobile viewport", async ({
      page,
    }) => {
      // Arrange: Mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Error on mobile
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Toast positioned correctly (doesn't cover content)
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();

      // Verify toast doesn't cover important controls
      const backButton = page.locator('[data-testid="back-button"]');
      if (await backButton.isVisible()) {
        const toastBox = await errorToast.boundingBox();
        const backBox = await backButton.boundingBox();

        // Toast should not overlap critical navigation
        const overlap =
          toastBox &&
          backBox &&
          !(
            toastBox.x > backBox.x + backBox.width ||
            backBox.x > toastBox.x + toastBox.width ||
            toastBox.y > backBox.y + backBox.height ||
            backBox.y > toastBox.y + toastBox.height
          );

        expect(overlap).toBeFalsy();
      }
    });

    test("should have proper touch targets for retry button on mobile", async ({
      page,
    }) => {
      // Arrange: Mobile viewport with error
      await page.setViewportSize({ width: 375, height: 667 });

      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Trigger error
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Retry button meets mobile touch requirements
      const retryButton = page.locator("[data-sonner-toast] button", {
        hasText: "Retry",
      });
      await expect(retryButton).toBeVisible();

      const buttonBox = await retryButton.boundingBox();
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44); // WCAG touch target
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe("Accessibility Validation", () => {
    test("should announce errors to screen readers", async ({ page }) => {
      // Arrange: Error scenario
      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Trigger error
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Error announced via aria-live region
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();

      // Check for proper ARIA attributes
      await expect(errorToast).toHaveAttribute("role", "alert");

      // Error should have accessible text content
      const errorText = await errorToast.textContent();
      expect(errorText).toBeTruthy();
      expect(errorText?.length).toBeGreaterThan(10); // Meaningful message
    });

    test("should maintain focus management during error states", async ({
      page,
    }) => {
      // Arrange: Focus on summary button
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.focus();

      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Trigger error while focused
      await summaryButton.click();

      // Assert: Focus remains on button for easy retry
      await expect(summaryButton).toBeFocused();

      // Verify keyboard accessibility
      await page.keyboard.press("Space"); // Should be able to retry with keyboard
    });
  });

  test.describe("Performance Validation", () => {
    test("should show error feedback within 500ms target", async ({ page }) => {
      // Arrange: Error simulation with timing
      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Measure error feedback timing
      const startTime = Date.now();

      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Toast appears within performance target
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();

      const feedbackTime = Date.now() - startTime;
      expect(feedbackTime).toBeLessThan(500); // Performance target
    });

    test("should maintain UI responsiveness during error handling", async ({
      page,
    }) => {
      // Arrange: Error with UI interaction test
      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Trigger error then interact with other UI
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Other controls remain responsive
      const headerButton = page.locator("header button").first();
      if (await headerButton.isVisible()) {
        const startTime = Date.now();
        await headerButton.click();
        const responseTime = Date.now() - startTime;

        expect(responseTime).toBeLessThan(100); // UI remains responsive
      }
    });
  });

  test.describe("Context-Specific Error Handling", () => {
    test("should handle errors in article list context", async ({ page }) => {
      // Arrange: Navigate to article list with summarization
      await page.goto("http://100.96.166.53:3000/reader");

      await page.route("**/api/articles/*/summarize", (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ message: "Server error" }),
        });
      });

      // Act: Error from article list summary button
      const listSummaryButton = page
        .locator('[data-testid="article-list"] [data-testid="summary-button"]')
        .first();
      await listSummaryButton.click();

      // Assert: Error doesn't break list navigation
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();

      // Should still be able to navigate to article detail
      const article = page.locator('[data-testid="article-card"]').first();
      await article.click();

      await expect(page.url()).toContain("/reader/article/");
    });

    test("should handle errors in article detail toolbar", async ({ page }) => {
      // Arrange: Navigate to article detail
      await page.click('[data-testid="article-card"]');
      await page.waitForURL("**/reader/article/**");

      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Error from detail toolbar summary button
      const detailSummaryButton = page.locator(
        '[data-testid="article-toolbar"] [data-testid="summary-button"]'
      );
      await detailSummaryButton.click();

      // Assert: Error doesn't break detail page functionality
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).toBeVisible();

      // Should still be able to navigate back
      const backButton = page.locator('[data-testid="back-button"]');
      await backButton.click();

      await expect(page.url()).toContain("/reader");
      await expect(page.url()).not.toContain("/article/");
    });

    test("should differentiate new vs re-summarization error messages", async ({
      page,
    }) => {
      // Arrange: Article with existing summary
      await page.click('[data-testid="article-card"]'); // Article with summary
      await page.waitForURL("**/reader/article/**");

      await page.route("**/api/articles/*/summarize", (route) => {
        route.abort("failed");
      });

      // Act: Click re-summarize (different message expected)
      const resummaryButton = page.locator('[data-testid="summary-button"]', {
        hasText: /re-summarize/i,
      });

      if (await resummaryButton.isVisible()) {
        await resummaryButton.click();

        // Assert: Re-summarization specific error message
        const errorToast = page.locator(
          '[data-sonner-toast][data-type="error"]'
        );
        await expect(errorToast).toBeVisible();
        await expect(errorToast).toContainText(/re-summarize failed/i);
      }
    });
  });

  test.describe("Loading State Integration", () => {
    test("should verify loading skeleton works during navigation as specified", async ({
      page,
    }) => {
      // Arrange: Long-running summarization
      await page.route("**/api/articles/*/summarize", (route) => {
        // Delay response to test loading states
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ summary: "Delayed success" }),
          });
        }, 2000);
      });

      // Act: Start summarization and navigate
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Assert: Loading skeleton visible during operation
      const loadingIcon = page.locator(
        '[data-testid="summary-button"] [data-testid="loader"]'
      );
      await expect(loadingIcon).toBeVisible();

      // Navigate during loading
      await page.click('[data-testid="article-card"]');

      // Should maintain loading state during navigation
      await expect(loadingIcon).toBeVisible();
    });

    test("should cancel loading state on navigation (AbortError path)", async ({
      page,
    }) => {
      // Arrange: Long-running request
      await page.route("**/api/articles/*/summarize", (route) => {
        // Never fulfill - simulates cancelled request
        setTimeout(() => route.abort("cancelled"), 1000);
      });

      // Act: Start summarization then navigate away
      const summaryButton = page
        .locator('[data-testid="summary-button"]')
        .first();
      await summaryButton.click();

      // Verify loading started
      const loadingIcon = page.locator(
        '[data-testid="summary-button"] [data-testid="loader"]'
      );
      await expect(loadingIcon).toBeVisible();

      // Navigate away (should cancel request)
      await page.goBack();

      // Assert: No error toast for user cancellation
      await page.waitForTimeout(1000); // Give time for potential error
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
      await expect(errorToast).not.toBeVisible();
    });
  });
});
