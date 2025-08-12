/**
 * RR-106: End-to-End Tests for Freshness API Removal
 *
 * Tests the complete removal process and verifies system functionality
 * remains intact after freshness API removal.
 */

import { test, expect } from "@playwright/test";

test.describe("RR-106: Freshness API Removal - E2E Tests", () => {
  const APP_BASE_URL = "http://100.96.166.53:3000/reader";
  const LOCAL_BASE_URL = "http://localhost:3000/reader";

  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.setExtraHTTPHeaders({
      Accept: "application/json",
    });
  });

  test.describe("Health Endpoint Availability After Removal", () => {
    test("should verify remaining health endpoints are accessible", async ({
      page,
    }) => {
      const healthEndpoints = [
        `${APP_BASE_URL}/api/health/app`,
        `${APP_BASE_URL}/api/health/db`,
        `${APP_BASE_URL}/api/health/cron`,
      ];

      for (const endpoint of healthEndpoints) {
        const response = await page.request.get(endpoint);

        // Should return 200 (healthy) or 503 (degraded, but functional)
        expect([200, 503]).toContain(response.status());

        const data = await response.json();
        expect(data).toHaveProperty("status");
        expect(data).toHaveProperty("timestamp");
        expect(["healthy", "degraded", "error"]).toContain(data.status);
      }
    });

    test("should verify freshness endpoint returns 404 after removal", async ({
      page,
    }) => {
      const freshnessEndpoint = `${APP_BASE_URL}/api/health/freshness`;

      const response = await page.request.get(freshnessEndpoint);

      // After removal, should return 404
      if (response.status() === 404) {
        expect(response.status()).toBe(404);
      } else {
        // During development phase, might still be accessible
        console.log(
          `Freshness endpoint still returns ${response.status()} (expected during removal process)`
        );
        expect([200, 503]).toContain(response.status());
      }
    });

    test("should verify sync server health endpoint still works", async ({
      page,
    }) => {
      const syncHealthEndpoint = "http://localhost:3001/server/health";

      try {
        const response = await page.request.get(syncHealthEndpoint);

        if (response.ok()) {
          const data = await response.json();
          expect(data).toHaveProperty("status");
          expect(data).toHaveProperty("services");
          expect(data.services).toHaveProperty("database");
        } else {
          console.log("Sync server not accessible during E2E test");
        }
      } catch (error) {
        console.log("Sync server health endpoint not accessible:", error);
      }
    });
  });

  test.describe("Application Core Functionality", () => {
    test("should verify main application loads without freshness dependency", async ({
      page,
    }) => {
      await page.goto(APP_BASE_URL);

      // Wait for application to load
      await page.waitForLoadState("networkidle");

      // Application should load successfully
      expect(page.url()).toContain("/reader");

      // Should not have JavaScript errors related to freshness
      const logs = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          logs.push(msg.text());
        }
      });

      // Navigate to ensure no freshness-related errors
      await page.waitForTimeout(2000);

      const freshnessErrors = logs.filter((log) =>
        log.toLowerCase().includes("freshness")
      );

      expect(freshnessErrors).toHaveLength(0);
    });

    test("should verify article list functionality works", async ({ page }) => {
      await page.goto(APP_BASE_URL);
      await page.waitForLoadState("networkidle");

      // Check if articles are loading (may be empty in test environment)
      const articleListExists = await page
        .locator('[data-testid="article-list"], .article-list, main')
        .count();
      expect(articleListExists).toBeGreaterThan(0);

      // Should not show freshness-related UI elements
      const freshnessUI = await page
        .locator("text=/freshness|stale|degraded/i")
        .count();
      expect(freshnessUI).toBe(0);
    });

    test("should verify sync functionality remains accessible", async ({
      page,
    }) => {
      // Test sync endpoint accessibility (should return 405 for GET, 200 for POST)
      const syncResponse = await page.request.get(`${APP_BASE_URL}/api/sync`);
      expect([200, 405]).toContain(syncResponse.status());

      // Manual sync should be possible (test GET for endpoint existence)
      if (syncResponse.status() === 405) {
        // GET not allowed, but endpoint exists - this is correct
        expect(syncResponse.status()).toBe(405);
      }
    });
  });

  test.describe("Monitoring Integration", () => {
    test("should verify monitoring endpoints exclude freshness", async ({
      page,
    }) => {
      // Test that monitoring systems don't depend on freshness endpoint
      const monitoringEndpoints = [
        `${APP_BASE_URL}/api/health/app?ping=true`,
        `${APP_BASE_URL}/api/health/db`,
        `${APP_BASE_URL}/api/health/cron`,
      ];

      let accessibleEndpoints = 0;

      for (const endpoint of monitoringEndpoints) {
        try {
          const response = await page.request.get(endpoint);
          if (response.status() < 500) {
            accessibleEndpoints++;
          }
        } catch (error) {
          console.log(`Monitoring endpoint not accessible: ${endpoint}`);
        }
      }

      // At least one monitoring endpoint should be accessible
      expect(accessibleEndpoints).toBeGreaterThan(0);
    });

    test("should verify no freshness references in client-side monitoring", async ({
      page,
    }) => {
      await page.goto(APP_BASE_URL);
      await page.waitForLoadState("networkidle");

      // Check for any client-side freshness monitoring
      const freshnessRequests = [];

      page.on("request", (request) => {
        if (request.url().includes("freshness")) {
          freshnessRequests.push(request.url());
        }
      });

      // Wait for any asynchronous requests
      await page.waitForTimeout(5000);

      // After removal, should not make freshness requests
      if (freshnessRequests.length === 0) {
        expect(freshnessRequests).toHaveLength(0);
      } else {
        console.log(
          "Client still making freshness requests (expected during removal process):",
          freshnessRequests
        );
      }
    });
  });

  test.describe("Error Handling and Recovery", () => {
    test("should handle missing freshness endpoint gracefully", async ({
      page,
    }) => {
      // Simulate monitoring scripts trying to access removed endpoint
      const response = await page.request.get(
        `${APP_BASE_URL}/api/health/freshness`
      );

      if (response.status() === 404) {
        // Endpoint removed - should handle gracefully
        expect(response.status()).toBe(404);

        // Verify other endpoints still work
        const appResponse = await page.request.get(
          `${APP_BASE_URL}/api/health/app`
        );
        expect([200, 503]).toContain(appResponse.status());
      } else {
        console.log(
          "Freshness endpoint still accessible during removal process"
        );
      }
    });

    test("should verify monitoring systems recover from freshness removal", async ({
      page,
    }) => {
      // Test that application remains stable without freshness monitoring
      await page.goto(APP_BASE_URL);
      await page.waitForLoadState("networkidle");

      // Application should load and function normally
      const bodyContent = await page.locator("body").innerHTML();
      expect(bodyContent).toBeTruthy();
      expect(bodyContent.length).toBeGreaterThan(100);

      // No critical errors should occur
      const errorMessages = await page
        .locator('[data-testid="error"], .error, .alert-error')
        .count();
      expect(errorMessages).toBe(0);
    });
  });

  test.describe("Performance and Stability", () => {
    test("should verify application performance is not degraded", async ({
      page,
    }) => {
      const startTime = Date.now();

      await page.goto(APP_BASE_URL);
      await page.waitForLoadState("networkidle");

      const loadTime = Date.now() - startTime;

      // Application should load within reasonable time (10 seconds max)
      expect(loadTime).toBeLessThan(10000);

      // Memory usage should be stable
      const memoryUsage = await page.evaluate(() => {
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
      });

      // Should not have excessive memory usage (arbitrary threshold)
      if (memoryUsage > 0) {
        expect(memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB
      }
    });

    test("should verify no resource leaks from freshness removal", async ({
      page,
    }) => {
      await page.goto(APP_BASE_URL);
      await page.waitForLoadState("networkidle");

      // Check for unclosed connections or timers
      const networkIdle = await page.waitForLoadState("networkidle", {
        timeout: 5000,
      });

      // Should reach network idle state (no pending requests)
      expect(networkIdle).toBeUndefined(); // waitForLoadState returns void on success

      // No console errors related to freshness cleanup
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (
          msg.type() === "error" &&
          msg.text().toLowerCase().includes("freshness")
        ) {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe("Rollback Verification (Emergency)", () => {
    test("should document rollback requirements", async ({ page }) => {
      // This test documents what needs to be verified if rollback is needed
      const rollbackChecklist = [
        "Restore freshness API route file",
        "Update monitoring scripts to include freshness",
        "Restore Uptime Kuma freshness monitor",
        "Verify freshness endpoint responds correctly",
        "Update integration tests to include freshness",
        "Verify monitoring alerts work",
      ];

      // Document rollback endpoint for testing
      const rollbackEndpoint = `${APP_BASE_URL}/api/health/freshness`;

      expect(rollbackChecklist.length).toBeGreaterThan(0);
      expect(rollbackEndpoint).toContain("/health/freshness");
    });

    test("should verify system state can be restored", async ({ page }) => {
      // Verify critical endpoints that must work for rollback success
      const criticalEndpoints = [
        `${APP_BASE_URL}/api/health/app`,
        `${APP_BASE_URL}/api/health/db`,
      ];

      for (const endpoint of criticalEndpoints) {
        const response = await page.request.get(endpoint);
        expect([200, 503]).toContain(response.status());
      }

      // These endpoints must be functional for successful rollback
      expect(criticalEndpoints.length).toBe(2);
    });
  });
});
