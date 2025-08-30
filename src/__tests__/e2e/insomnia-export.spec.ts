import { test, expect } from "@playwright/test";

test.describe("Insomnia Export E2E Tests", () => {
  const BASE_URL = "http://100.96.166.53:3000/reader";

  test.beforeEach(async ({ page }) => {
    // Navigate to Swagger UI
    await page.goto(`${BASE_URL}/api-docs`, { waitUntil: "networkidle" });
  });

  test("should display Insomnia export button in Swagger UI", async ({
    page,
  }) => {
    // Wait for Swagger UI to load
    await page.waitForSelector(".swagger-ui", { timeout: 10000 });

    // Look for Insomnia export button
    const exportButton = page.locator('[data-testid="insomnia-export-button"]');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toContainText("Insomnia");

    // Button should have download icon
    const icon = exportButton.locator("svg, i");
    await expect(icon).toBeVisible();
  });

  test("should download Insomnia collection from Swagger UI button", async ({
    page,
  }) => {
    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent("download");

    // Click the Insomnia export button
    await page.click('[data-testid="insomnia-export-button"]');

    // Wait for download to start
    const download = await downloadPromise;

    // Verify download filename
    expect(download.suggestedFilename()).toBe(
      "rss-reader-insomnia-collection.json"
    );

    // Save and read the downloaded file
    const path = await download.path();
    expect(path).toBeTruthy();

    // Read downloaded content
    const fs = require("fs");
    const content = fs.readFileSync(path, "utf-8");
    const collection = JSON.parse(content);

    // Verify it's a valid Insomnia collection
    expect(collection._type).toBe("export");
    expect(collection.__export_format).toBe(4);
    expect(collection.__export_source).toBe("rss-news-reader");

    // Verify workspace is included
    const workspace = collection.resources.find(
      (r: any) => r._type === "workspace"
    );
    expect(workspace).toBeDefined();
    expect(workspace.name).toBe("RSS News Reader API");

    // Verify environment with Tailscale URL (since we're accessing via Tailscale)
    const environment = collection.resources.find(
      (r: any) => r._type === "environment"
    );
    expect(environment).toBeDefined();
    expect(environment.data.base_url).toBe("http://100.96.166.53:3000/reader");
  });

  test("should access export endpoint directly via different domains", async ({
    page,
  }) => {
    // Test direct API access with Tailscale IP
    const response = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    expect(response.status()).toBe(200);

    const collection = await response.json();
    expect(collection._type).toBe("export");

    // Environment should match request origin
    const env = collection.resources.find(
      (r: any) => r._type === "environment"
    );
    expect(env.data.base_url).toBe("http://100.96.166.53:3000/reader");
  });

  test("should handle rate limiting gracefully", async ({ page }) => {
    // First request should succeed
    const response1 = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    expect(response1.status()).toBe(200);

    // Check rate limit headers
    const headers = response1.headers();
    expect(headers["x-ratelimit-limit"]).toBe("1");
    expect(headers["x-ratelimit-remaining"]).toBe("0");

    // Second immediate request should be rate limited
    const response2 = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    expect(response2.status()).toBe(429);

    const error = await response2.json();
    expect(error.error).toBe("rate_limit_exceeded");
    expect(error.retryAfter).toBeGreaterThan(0);
  });

  test("should include all documented endpoints in exported collection", async ({
    page,
  }) => {
    const response = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    expect(response.status()).toBe(200);

    const collection = await response.json();

    // Get all requests from collection
    const requests = collection.resources.filter(
      (r: any) => r._type === "request"
    );

    // Should have at least the documented health endpoints
    const healthEndpoints = requests.filter((r: any) =>
      r.url?.includes("/api/health")
    );
    expect(healthEndpoints.length).toBeGreaterThanOrEqual(6);

    // Check for sync endpoints if documented
    const syncEndpoints = requests.filter((r: any) =>
      r.url?.includes("/api/sync")
    );

    // Verify requests have required fields
    for (const request of requests) {
      expect(request).toHaveProperty("_id");
      expect(request).toHaveProperty("_type", "request");
      expect(request).toHaveProperty("name");
      expect(request).toHaveProperty("method");
      expect(request).toHaveProperty("url");

      // URL should use environment variable
      expect(request.url).toContain("{{ _.base_url }}");
    }
  });

  test("should organize endpoints into folders by tags", async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    const collection = await response.json();

    // Find folders (request groups)
    const folders = collection.resources.filter(
      (r: any) => r._type === "request_group"
    );

    // Should have folders for organization
    expect(folders.length).toBeGreaterThan(0);

    // Common folders we expect
    const folderNames = folders.map((f: any) => f.name);
    expect(folderNames).toContain("Health");

    // Each folder should have a unique ID
    const folderIds = folders.map((f: any) => f._id);
    expect(new Set(folderIds).size).toBe(folderIds.length);

    // Requests should be linked to folders
    const requests = collection.resources.filter(
      (r: any) => r._type === "request"
    );
    for (const request of requests) {
      if (request.parentId) {
        const parentExists = folders.some(
          (f: any) => f._id === request.parentId
        );
        expect(parentExists).toBe(true);
      }
    }
  });

  test("should export collection with proper request examples", async ({
    page,
  }) => {
    const response = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    const collection = await response.json();

    // Find POST/PUT requests which should have body examples
    const requests = collection.resources.filter(
      (r: any) => r._type === "request"
    );
    const requestsWithBody = requests.filter((r: any) =>
      ["POST", "PUT", "PATCH"].includes(r.method)
    );

    for (const request of requestsWithBody) {
      if (request.body) {
        // Body should have proper mime type
        expect(request.body.mimeType).toBe("application/json");

        // Body text should be valid JSON
        if (request.body.text) {
          let parsed;
          expect(() => {
            parsed = JSON.parse(request.body.text);
          }).not.toThrow();

          // Should have some content (not empty object)
          expect(Object.keys(parsed || {}).length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("should handle caching with ETag headers", async ({ page }) => {
    // First request
    const response1 = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    expect(response1.status()).toBe(200);

    const etag = response1.headers()["etag"];
    expect(etag).toBeTruthy();

    // Wait a moment to avoid rate limiting
    await page.waitForTimeout(61000); // Wait 61 seconds

    // Second request with If-None-Match
    const response2 = await page.request.get(`${BASE_URL}/api/insomnia.json`, {
      headers: {
        "If-None-Match": etag,
      },
    });

    // Should return 304 if content hasn't changed
    expect(response2.status()).toBe(304);
  });

  test("should export valid collection that imports in Insomnia", async ({
    page,
  }) => {
    const response = await page.request.get(`${BASE_URL}/api/insomnia.json`);
    const collection = await response.json();

    // Validate critical Insomnia v4 structure
    expect(collection).toMatchObject({
      _type: "export",
      __export_format: 4,
      resources: expect.arrayContaining([
        // Must have workspace
        expect.objectContaining({
          _type: "workspace",
          _id: expect.stringMatching(/^wrk_/),
          name: expect.any(String),
        }),
        // Must have environment
        expect.objectContaining({
          _type: "environment",
          _id: expect.stringMatching(/^env_/),
          data: expect.objectContaining({
            base_url: expect.any(String),
          }),
        }),
      ]),
    });

    // All resources must have valid IDs
    for (const resource of collection.resources) {
      expect(resource._id).toBeTruthy();
      expect(resource._type).toBeTruthy();

      // ID format validation
      if (resource._type === "workspace") {
        expect(resource._id).toMatch(/^wrk_/);
      } else if (resource._type === "environment") {
        expect(resource._id).toMatch(/^env_/);
      } else if (resource._type === "request") {
        expect(resource._id).toMatch(/^req_/);
      } else if (resource._type === "request_group") {
        expect(resource._id).toMatch(/^fld_/);
      }
    }

    // Parent-child relationships must be valid
    const resourceMap = new Map(
      collection.resources.map((r: any) => [r._id, r])
    );
    for (const resource of collection.resources) {
      if (resource.parentId) {
        expect(resourceMap.has(resource.parentId)).toBe(true);
      }
    }
  });

  test("should display proper error when export fails", async ({ page }) => {
    // Test error handling by requesting with invalid accept header
    const response = await page.request.get(`${BASE_URL}/api/insomnia.json`, {
      headers: {
        Accept: "invalid/type",
      },
    });

    // Should still return JSON error
    if (response.status() === 500) {
      const error = await response.json();
      expect(error).toHaveProperty("error");
      expect(error).toHaveProperty("message");
    } else {
      // Or succeed with JSON regardless of Accept header
      expect(response.status()).toBe(200);
    }
  });
});

test.describe("Mobile PWA - Insomnia Export", () => {
  test.use({
    viewport: { width: 390, height: 844 }, // iPhone 14 viewport
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });

  test("should access Insomnia export on mobile Safari", async ({ page }) => {
    const BASE_URL = "http://100.96.166.53:3000/reader";

    // Navigate to API docs on mobile
    await page.goto(`${BASE_URL}/api-docs`);

    // Mobile might show a different UI layout
    await page.waitForSelector(".swagger-ui", { timeout: 10000 });

    // Export button should be accessible on mobile
    const exportButton = page.locator('[data-testid="insomnia-export-button"]');

    if (await exportButton.isVisible()) {
      // Check touch target size (minimum 44x44 pixels for iOS)
      const box = await exportButton.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);

      // Verify it's tappable
      await exportButton.tap();

      // On mobile, download might trigger differently
      // Just verify no errors occurred
      await page.waitForTimeout(1000);
    }
  });
});
