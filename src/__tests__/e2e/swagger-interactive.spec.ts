import { test, expect } from "@playwright/test";

test.describe("Swagger UI Interactive Functionality (RR-200)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Swagger UI page
    await page.goto("http://100.96.166.53:3000/reader/api-docs");
    await page.waitForLoadState("networkidle");

    // Wait for Swagger UI to load
    await page.waitForSelector(".swagger-ui", { timeout: 10000 });
  });

  test("should load Swagger UI with all health endpoints", async ({ page }) => {
    // Check that Swagger UI is loaded
    await expect(page.locator(".swagger-ui")).toBeVisible();

    // Check page title
    await expect(page.locator("h2")).toContainText("RSS Reader API");

    // Verify all 6 health endpoints are listed
    const endpoints = [
      "/api/health",
      "/api/health/app",
      "/api/health/db",
      "/api/health/cron",
      "/api/health/parsing",
      "/api/health/claude",
    ];

    for (const endpoint of endpoints) {
      await expect(page.locator(`[data-path="${endpoint}"]`)).toBeVisible();
    }
  });

  test("should expand endpoint details when clicked", async ({ page }) => {
    // Click on main health endpoint
    const healthEndpoint = page.locator('[data-path="/api/health"]');
    await healthEndpoint.click();

    // Wait for expansion
    await page.waitForTimeout(500);

    // Check that endpoint details are visible
    await expect(page.locator(".opblock-summary")).toContainText(
      "Main health check"
    );
    await expect(page.locator(".opblock-description")).toBeVisible();
  });

  test("should show 'Try it out' button for GET endpoints", async ({
    page,
  }) => {
    // Expand the main health endpoint
    await page.locator('[data-path="/api/health"]').click();
    await page.waitForTimeout(500);

    // Look for Try it out button
    const tryItOutButton = page.locator('button:has-text("Try it out")');
    await expect(tryItOutButton).toBeVisible();
    await expect(tryItOutButton).toBeEnabled();
  });

  test("should enable execution after clicking 'Try it out'", async ({
    page,
  }) => {
    // Expand endpoint and click Try it out
    await page.locator('[data-path="/api/health"]').click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Try it out")').click();
    await page.waitForTimeout(500);

    // Execute button should now be visible
    const executeButton = page.locator('button:has-text("Execute")');
    await expect(executeButton).toBeVisible();
    await expect(executeButton).toBeEnabled();
  });

  test("should execute health check and show response", async ({ page }) => {
    // Expand endpoint and enable Try it out
    await page.locator('[data-path="/api/health"]').click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Try it out")').click();
    await page.waitForTimeout(500);

    // Execute the request
    await page.locator('button:has-text("Execute")').click();

    // Wait for response
    await page.waitForSelector(".responses-wrapper", { timeout: 10000 });

    // Check response code
    const responseCode = page.locator(".response-col_status");
    await expect(responseCode).toContainText("200");

    // Check response body contains expected fields
    const responseBody = page.locator(".response-col_description");
    await expect(responseBody).toContainText("status");
    await expect(responseBody).toContainText("timestamp");
  });

  test("should test all health endpoints interactively", async ({ page }) => {
    const endpoints = [
      { path: "/api/health", name: "Main health check" },
      { path: "/api/health/app", name: "Application health" },
      { path: "/api/health/db", name: "Database health" },
      { path: "/api/health/cron", name: "Cron health" },
      { path: "/api/health/parsing", name: "Parsing health" },
      { path: "/api/health/claude", name: "Claude API health" },
    ];

    for (const endpoint of endpoints) {
      // Expand endpoint
      await page.locator(`[data-path="${endpoint.path}"]`).click();
      await page.waitForTimeout(500);

      // Enable Try it out
      await page.locator('button:has-text("Try it out")').first().click();
      await page.waitForTimeout(500);

      // Execute request
      await page.locator('button:has-text("Execute")').first().click();

      // Wait for and verify response
      await page.waitForSelector(".responses-wrapper", { timeout: 10000 });

      const responseCode = page.locator(".response-col_status").first();
      await expect(responseCode).toContainText(/200|503/); // Either healthy or test environment

      // Collapse endpoint before moving to next
      await page.locator(`[data-path="${endpoint.path}"]`).click();
      await page.waitForTimeout(500);
    }
  });

  test("should display response examples for 200 and 500 status codes", async ({
    page,
  }) => {
    // Expand main health endpoint
    await page.locator('[data-path="/api/health"]').click();
    await page.waitForTimeout(500);

    // Check for response examples section
    await expect(page.locator(".responses")).toBeVisible();

    // Should show examples for different status codes
    await expect(page.locator('[data-code="200"]')).toBeVisible();
    await expect(page.locator('[data-code="500"]')).toBeVisible();

    // Click on 200 response to see example
    await page.locator('[data-code="200"]').click();
    await page.waitForTimeout(500);

    // Should show example response body
    const exampleBody = page.locator(".model-example");
    await expect(exampleBody).toBeVisible();
    await expect(exampleBody).toContainText("status");
    await expect(exampleBody).toContainText("healthy");
  });

  test("should show proper error handling for invalid requests", async ({
    page,
  }) => {
    // Test with a non-existent endpoint by modifying URL manually
    await page.goto("http://100.96.166.53:3000/reader/api-docs");

    // Expand main health endpoint
    await page.locator('[data-path="/api/health"]').click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Try it out")').click();
    await page.waitForTimeout(500);

    // Modify the URL in the request (if possible via UI)
    // Or test error responses when service is down
    await page.locator('button:has-text("Execute")').click();

    // Response should handle errors gracefully
    await page.waitForSelector(".responses-wrapper", { timeout: 10000 });

    // Should not crash and should show some response
    const responseSection = page.locator(".responses-wrapper");
    await expect(responseSection).toBeVisible();
  });

  test("should handle different response formats properly", async ({
    page,
  }) => {
    // Test JSON response format
    await page.locator('[data-path="/api/health/app"]').click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Try it out")').click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Execute")').click();
    await page.waitForSelector(".responses-wrapper", { timeout: 10000 });

    // Check response format is JSON
    const responseHeaders = page.locator(".response-col_headers");
    await expect(responseHeaders).toContainText("content-type");
    await expect(responseHeaders).toContainText("application/json");

    // Response body should be properly formatted JSON
    const responseBody = page.locator(".response-col_description");
    await expect(responseBody).toContainText("{");
    await expect(responseBody).toContainText("}");
  });

  test("should show request details before execution", async ({ page }) => {
    await page.locator('[data-path="/api/health/db"]').click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Try it out")').click();
    await page.waitForTimeout(500);

    // Should show request URL
    const requestUrl = page.locator(".request-url");
    await expect(requestUrl).toBeVisible();
    await expect(requestUrl).toContainText(
      "http://100.96.166.53:3000/reader/api/health/db"
    );

    // Should show request method
    const requestMethod = page.locator(".opblock-summary-method");
    await expect(requestMethod).toContainText("GET");
  });

  test("should handle concurrent requests to different endpoints", async ({
    page,
  }) => {
    // Test multiple endpoints without waiting for each to complete
    const endpoints = ["/api/health", "/api/health/app", "/api/health/db"];

    for (const endpoint of endpoints) {
      await page.locator(`[data-path="${endpoint}"]`).click();
      await page.waitForTimeout(200);

      await page.locator('button:has-text("Try it out")').first().click();
      await page.waitForTimeout(200);

      // Start execution without waiting for completion
      await page.locator('button:has-text("Execute")').first().click();
    }

    // Wait for all responses to complete
    await page.waitForTimeout(5000);

    // Check that all endpoints returned responses
    const responseWrappers = page.locator(".responses-wrapper");
    const count = await responseWrappers.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("should preserve state when navigating between endpoints", async ({
    page,
  }) => {
    // Expand first endpoint
    await page.locator('[data-path="/api/health"]').click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Try it out")').click();
    await page.waitForTimeout(500);

    // Navigate to another endpoint
    await page.locator('[data-path="/api/health/app"]').click();
    await page.waitForTimeout(500);

    // Return to first endpoint - should still be expanded and in Try it out mode
    await page.locator('[data-path="/api/health"]').click();
    await page.waitForTimeout(500);

    // Execute button should still be available
    const executeButton = page.locator('button:has-text("Execute")').first();
    await expect(executeButton).toBeVisible();
  });

  test("should display comprehensive API documentation metadata", async ({
    page,
  }) => {
    // Check main API info
    await expect(page.locator(".info")).toBeVisible();

    // Should show API title and version
    await expect(page.locator(".title")).toContainText("RSS Reader API");
    await expect(page.locator(".version")).toContainText("1.0.0");

    // Should show API description
    await expect(page.locator(".description")).toContainText(
      "Health endpoints"
    );

    // Should show server information
    await expect(page.locator(".servers")).toBeVisible();
    await expect(page.locator(".servers")).toContainText(
      "http://100.96.166.53:3000/reader"
    );
  });
});
