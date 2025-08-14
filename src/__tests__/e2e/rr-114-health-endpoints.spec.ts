/**
 * E2E Tests for RR-114: Health Endpoint Enhancements
 *
 * Tests the real HTTP endpoints to verify:
 * 1. /api/health/app returns a version property
 * 2. /api/health/db returns a connection property as alias for database
 *
 * These tests will FAIL initially until the implementation is complete.
 */

import { test, expect } from "@playwright/test";

const BASE_URL = "http://100.96.166.53:3000"; // Tailscale network URL
const FALLBACK_URL = "http://localhost:3000"; // Fallback for local testing

test.describe("RR-114: Health Endpoint Enhancements - E2E", () => {
  test.describe.configure({ mode: "serial" }); // Run tests in order

  // Helper function to test both URLs if first fails
  const testHealthEndpoint = async (page: any, endpoint: string) => {
    let response;
    let data;

    try {
      response = await page.request.get(`${BASE_URL}${endpoint}`);
      data = await response.json();
    } catch (error) {
      console.log(`Primary URL failed, trying fallback: ${error}`);
      response = await page.request.get(`${FALLBACK_URL}${endpoint}`);
      data = await response.json();
    }

    return { response, data };
  };

  test.describe("/api/health/app version property tests", () => {
    test("should return version property in app health endpoint", async ({
      page,
    }) => {
      const { response, data } = await testHealthEndpoint(
        page,
        "/reader/api/health/app"
      );

      expect(response.status()).toBe(200);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("timestamp");

      // RR-114: Version property requirement
      expect(data).toHaveProperty("version");
      expect(typeof data.version).toBe("string");
      expect(data.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
      expect(data.version.length).toBeGreaterThan(4); // At least "0.0.1"

      console.log(`✓ App health endpoint returned version: ${data.version}`);
    });

    test("should return version property with ping=true parameter", async ({
      page,
    }) => {
      const { response, data } = await testHealthEndpoint(
        page,
        "/reader/api/health/app?ping=true"
      );

      expect(response.status()).toBe(200);
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("ping", true);

      // RR-114: Version should be returned even with ping=true
      expect(data).toHaveProperty("version");
      expect(typeof data.version).toBe("string");
      expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);

      console.log(
        `✓ App health ping endpoint returned version: ${data.version}`
      );
    });

    test("should return version property consistently across multiple requests", async ({
      page,
    }) => {
      const requests = [];

      // Make 3 concurrent requests
      for (let i = 0; i < 3; i++) {
        requests.push(testHealthEndpoint(page, "/reader/api/health/app"));
      }

      const results = await Promise.all(requests);

      // All should return the same version
      const versions = results.map(({ data }) => data.version);
      const uniqueVersions = [...new Set(versions)];

      expect(uniqueVersions).toHaveLength(1); // All versions should be identical
      expect(versions[0]).toMatch(/^\d+\.\d+\.\d+$/);

      console.log(`✓ Consistent version across requests: ${versions[0]}`);
    });
  });

  test.describe("/api/health/db connection property alias tests", () => {
    test("should return connection property as alias for database property", async ({
      page,
    }) => {
      const { response, data } = await testHealthEndpoint(
        page,
        "/reader/api/health/db"
      );

      expect(response.status()).toBe(200);
      expect(data).toHaveProperty("timestamp");

      // Original database property
      expect(data).toHaveProperty("database");
      expect(typeof data.database).toBe("string");

      // RR-114: Connection property alias requirement
      expect(data).toHaveProperty("connection");
      expect(typeof data.connection).toBe("string");
      expect(data.connection).toBe(data.database); // Alias should match database value

      // Valid database status values
      const validStatuses = ["connected", "unavailable", "error", "slow"];
      expect(validStatuses).toContain(data.database);
      expect(validStatuses).toContain(data.connection);

      console.log(
        `✓ DB health endpoint returned database: ${data.database}, connection: ${data.connection}`
      );
    });

    test("should maintain connection alias across different database states", async ({
      page,
    }) => {
      // Make multiple requests to potentially catch different database states
      const requests = [];

      for (let i = 0; i < 5; i++) {
        requests.push(testHealthEndpoint(page, "/reader/api/health/db"));
      }

      const results = await Promise.all(requests);

      // Verify all responses have matching database and connection values
      results.forEach(({ data }, index) => {
        expect(data).toHaveProperty("database");
        expect(data).toHaveProperty("connection");
        expect(data.connection).toBe(data.database);

        console.log(
          `✓ Request ${index + 1}: database=${data.database}, connection=${data.connection}`
        );
      });
    });

    test("should return connection alias even when database health checks fail", async ({
      page,
    }) => {
      // This test assumes there might be scenarios where DB is unhealthy
      const { response, data } = await testHealthEndpoint(
        page,
        "/reader/api/health/db"
      );

      // Response might be 200 (healthy) or 503 (unhealthy)
      expect([200, 503]).toContain(response.status());

      // Regardless of health status, both properties should exist and match
      expect(data).toHaveProperty("database");
      expect(data).toHaveProperty("connection");
      expect(data.connection).toBe(data.database);

      // If unhealthy, both should indicate error state
      if (response.status() === 503) {
        expect(data.database).toBe("error");
        expect(data.connection).toBe("error");
      }

      console.log(
        `✓ DB health status ${response.status()}: database=${data.database}, connection=${data.connection}`
      );
    });
  });

  test.describe("Combined health endpoint validation", () => {
    test("should return all required properties from both endpoints", async ({
      page,
    }) => {
      // Test both endpoints in parallel
      const [appResult, dbResult] = await Promise.all([
        testHealthEndpoint(page, "/reader/api/health/app"),
        testHealthEndpoint(page, "/reader/api/health/db"),
      ]);

      // App endpoint validations
      expect(appResult.response.status()).toBe(200);
      expect(appResult.data).toHaveProperty("status");
      expect(appResult.data).toHaveProperty("timestamp");
      expect(appResult.data).toHaveProperty("version"); // RR-114

      // DB endpoint validations
      expect(dbResult.response.status()).toBe(200);
      expect(dbResult.data).toHaveProperty("timestamp");
      expect(dbResult.data).toHaveProperty("database");
      expect(dbResult.data).toHaveProperty("connection"); // RR-114
      expect(dbResult.data.connection).toBe(dbResult.data.database);

      console.log("✓ Both endpoints return all required RR-114 properties");
      console.log(`  - App version: ${appResult.data.version}`);
      console.log(
        `  - DB status: database=${dbResult.data.database}, connection=${dbResult.data.connection}`
      );
    });

    test("should handle network timeouts gracefully", async ({ page }) => {
      // Set a shorter timeout to test resilience
      page.setDefaultTimeout(5000);

      try {
        const { response, data } = await testHealthEndpoint(
          page,
          "/reader/api/health/app"
        );

        expect(response.status()).toBe(200);
        expect(data).toHaveProperty("version"); // Should still have version even under load

        console.log(
          "✓ Health endpoints respond within timeout with version property"
        );
      } catch (error) {
        // If timeout occurs, this is valuable information for the implementation
        console.log(
          `⚠️  Timeout occurred - this may indicate performance issues: ${error}`
        );
        throw error; // Re-throw to mark test as failed
      }
    });
  });

  test.describe("RR-114 Implementation validation", () => {
    test("should validate version matches package.json format", async ({
      page,
    }) => {
      const { response, data } = await testHealthEndpoint(
        page,
        "/reader/api/health/app"
      );

      expect(response.status()).toBe(200);
      expect(data).toHaveProperty("version");

      // Version should be semantic version format (x.y.z)
      const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/;
      const match = data.version.match(versionPattern);

      expect(match).not.toBeNull();

      const [, major, minor, patch] = match;

      // Should be valid numbers
      expect(parseInt(major)).toBeGreaterThanOrEqual(0);
      expect(parseInt(minor)).toBeGreaterThanOrEqual(0);
      expect(parseInt(patch)).toBeGreaterThanOrEqual(0);

      console.log(
        `✓ Version format validated: ${data.version} (${major}.${minor}.${patch})`
      );
    });

    test("should maintain backwards compatibility with existing properties", async ({
      page,
    }) => {
      const [appResult, dbResult] = await Promise.all([
        testHealthEndpoint(page, "/reader/api/health/app"),
        testHealthEndpoint(page, "/reader/api/health/db"),
      ]);

      // App endpoint - existing properties should still exist
      expect(appResult.data).toHaveProperty("status");
      expect(appResult.data).toHaveProperty("timestamp");
      expect(appResult.data).toHaveProperty("service");

      // New property
      expect(appResult.data).toHaveProperty("version");

      // DB endpoint - existing properties should still exist
      expect(dbResult.data).toHaveProperty("status");
      expect(dbResult.data).toHaveProperty("timestamp");
      expect(dbResult.data).toHaveProperty("database");

      // New property (alias)
      expect(dbResult.data).toHaveProperty("connection");

      console.log(
        "✓ All existing properties maintained alongside new RR-114 requirements"
      );
    });
  });
});
