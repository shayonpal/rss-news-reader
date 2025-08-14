/**
 * E2E Tests for RR-115: Service Availability Detection and Timing Conditions
 *
 * These tests verify that health endpoints properly handle:
 * 1. Service availability detection with real HTTP requests
 * 2. Timing and race conditions during concurrent access
 * 3. Network timeout handling and graceful degradation
 * 4. Service startup sequence validation
 * 5. Performance under load conditions
 *
 * RED PHASE: These tests will FAIL initially and guide implementation fixes.
 */

import { test, expect } from "@playwright/test";

const BASE_URL = "http://100.96.166.53:3000"; // Tailscale network URL
const FALLBACK_URL = "http://localhost:3000"; // Fallback for local testing

test.describe("RR-115: Service Availability Detection and Timing", () => {
  test.describe.configure({ mode: "serial" }); // Run tests in order

  // Helper function to test both URLs if first fails
  const testHealthEndpoint = async (
    page: any,
    endpoint: string,
    options: any = {}
  ) => {
    let response;
    let data;

    try {
      response = await page.request.get(`${BASE_URL}${endpoint}`, options);
      data = await response.json();
    } catch (error) {
      console.log(`Primary URL failed, trying fallback: ${error}`);
      response = await page.request.get(`${FALLBACK_URL}${endpoint}`, options);
      data = await response.json();
    }

    return { response, data };
  };

  test.describe("Service Availability Detection", () => {
    test("should detect when all services are available and healthy", async ({
      page,
    }) => {
      const startTime = Date.now();

      // Test both main health endpoints
      const [appResult, dbResult] = await Promise.all([
        testHealthEndpoint(page, "/reader/api/health/app"),
        testHealthEndpoint(page, "/reader/api/health/db"),
      ]);

      const totalTime = Date.now() - startTime;

      // RR-115: Should respond quickly when services are available
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds for both

      // App endpoint validation
      expect([200, 503]).toContain(appResult.response.status());
      expect(appResult.data).toHaveProperty("status");
      expect(appResult.data).toHaveProperty("service");
      expect(appResult.data).toHaveProperty("dependencies");

      // DB endpoint validation
      expect([200, 503]).toContain(dbResult.response.status());
      expect(dbResult.data).toHaveProperty("database");
      expect(dbResult.data).toHaveProperty("connection");

      // RR-115: Status codes should match actual service health
      if (appResult.data.status === "unhealthy") {
        expect(appResult.response.status()).toBe(503);
      } else {
        expect(appResult.response.status()).toBe(200);
      }

      if (dbResult.data.database === "error") {
        expect(dbResult.response.status()).toBe(503);
      } else {
        expect(dbResult.response.status()).toBe(200);
      }

      console.log(`✓ Service availability check completed in ${totalTime}ms`);
      console.log(
        `  - App: HTTP ${appResult.response.status()}, status=${appResult.data.status}`
      );
      console.log(
        `  - DB: HTTP ${dbResult.response.status()}, database=${dbResult.data.database}`
      );
    });

    test("should handle service startup sequence correctly", async ({
      page,
    }) => {
      // Test rapid sequential requests to simulate startup conditions
      const requests = [];
      const requestInterval = 100; // 100ms between requests

      for (let i = 0; i < 10; i++) {
        // Stagger requests to simulate different startup timing
        setTimeout(async () => {
          const result = await testHealthEndpoint(
            page,
            "/reader/api/health/app"
          );
          requests.push({
            index: i,
            timestamp: Date.now(),
            status: result.response.status(),
            data: result.data,
          });
        }, i * requestInterval);
      }

      // Wait for all requests to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // RR-115: Should handle startup sequence gracefully
      expect(requests.length).toBeGreaterThan(0);

      requests.forEach((req, index) => {
        expect([200, 503]).toContain(req.status);
        expect(req.data).toHaveProperty("status");

        console.log(
          `✓ Startup request ${index + 1}: HTTP ${req.status}, status=${req.data.status}`
        );
      });
    });

    test("should detect unavailable services and return appropriate status codes", async ({
      page,
    }) => {
      // Test ping endpoint which should always be available
      const pingResult = await testHealthEndpoint(
        page,
        "/reader/api/health/app?ping=true"
      );

      expect(pingResult.response.status()).toBe(200);
      expect(pingResult.data).toHaveProperty("status", "ok");
      expect(pingResult.data).toHaveProperty("ping", true);
      expect(pingResult.data).toHaveProperty("version");

      // Test full health check which may have unavailable services
      const fullResult = await testHealthEndpoint(
        page,
        "/reader/api/health/app"
      );

      expect([200, 503]).toContain(fullResult.response.status());
      expect(fullResult.data).toHaveProperty("status");
      expect(fullResult.data).toHaveProperty("dependencies");

      // RR-115: Should properly detect and report unavailable services
      if (fullResult.data.dependencies) {
        const deps = fullResult.data.dependencies;

        // Check each dependency state
        if (deps.database === "unavailable" || deps.database === "error") {
          console.log(`⚠️ Database service unavailable: ${deps.database}`);
        }

        if (deps.oauth === "unavailable" || deps.oauth === "error") {
          console.log(`⚠️ OAuth service unavailable: ${deps.oauth}`);
        }

        // If critical services are unavailable, should return 503
        if (
          deps.database === "error" &&
          fullResult.data.status === "unhealthy"
        ) {
          expect(fullResult.response.status()).toBe(503);
        }
      }

      console.log(
        `✓ Service availability detection: HTTP ${fullResult.response.status()}`
      );
    });

    test("should maintain service availability consistency over time", async ({
      page,
    }) => {
      const checkInterval = 500; // 500ms between checks
      const numChecks = 5;
      const results = [];

      for (let i = 0; i < numChecks; i++) {
        const startTime = Date.now();
        const result = await testHealthEndpoint(page, "/reader/api/health/app");
        const responseTime = Date.now() - startTime;

        results.push({
          check: i + 1,
          status: result.response.status(),
          health: result.data.status,
          responseTime,
        });

        if (i < numChecks - 1) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
        }
      }

      // RR-115: Service availability should be consistent
      const statusCodes = results.map((r) => r.status);
      const healthStates = results.map((r) => r.health);

      // Should not have rapid alternating between healthy/unhealthy
      const uniqueStatusCodes = [...new Set(statusCodes)];
      const uniqueHealthStates = [...new Set(healthStates)];

      expect(uniqueStatusCodes.length).toBeLessThanOrEqual(2);
      expect(uniqueHealthStates.length).toBeLessThanOrEqual(2);

      results.forEach((result) => {
        console.log(
          `✓ Check ${result.check}: HTTP ${result.status}, health=${result.health}, time=${result.responseTime}ms`
        );
      });

      // All response times should be reasonable
      const avgResponseTime =
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(2000); // Average less than 2 seconds

      console.log(`✓ Average response time: ${avgResponseTime.toFixed(0)}ms`);
    });
  });

  test.describe("Timing and Race Conditions", () => {
    test("should handle concurrent requests without race conditions", async ({
      page,
    }) => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      // Make concurrent requests to both endpoints
      const appPromises = Array(concurrentRequests)
        .fill(null)
        .map(() => testHealthEndpoint(page, "/reader/api/health/app"));

      const dbPromises = Array(concurrentRequests)
        .fill(null)
        .map(() => testHealthEndpoint(page, "/reader/api/health/db"));

      const [appResults, dbResults] = await Promise.all([
        Promise.all(appPromises),
        Promise.all(dbPromises),
      ]);

      const totalTime = Date.now() - startTime;

      // RR-115: Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds for all requests

      // All app requests should succeed
      appResults.forEach((result, index) => {
        expect([200, 503]).toContain(result.response.status());
        expect(result.data).toHaveProperty("status");

        // Validate response consistency
        if (result.response.status() === 503) {
          expect(result.data.status).toBe("unhealthy");
        } else if (result.data.status === "unhealthy") {
          expect(result.response.status()).toBe(503);
        }
      });

      // All db requests should succeed
      dbResults.forEach((result, index) => {
        expect([200, 503]).toContain(result.response.status());
        expect(result.data).toHaveProperty("database");

        // Validate response consistency
        if (result.response.status() === 503) {
          expect(result.data.database).toBe("error");
        } else if (result.data.database === "error") {
          expect(result.response.status()).toBe(503);
        }
      });

      console.log(
        `✓ Handled ${concurrentRequests * 2} concurrent requests in ${totalTime}ms`
      );

      // Check for consistency across concurrent requests
      const appStatusCodes = appResults.map((r) => r.response.status());
      const dbStatusCodes = dbResults.map((r) => r.response.status());

      const uniqueAppCodes = [...new Set(appStatusCodes)];
      const uniqueDbCodes = [...new Set(dbStatusCodes)];

      console.log(
        `✓ App status code consistency: ${uniqueAppCodes.join(", ")}`
      );
      console.log(`✓ DB status code consistency: ${uniqueDbCodes.join(", ")}`);
    });

    test("should handle rapid sequential requests efficiently", async ({
      page,
    }) => {
      const numRequests = 30;
      const results = [];
      const startTime = Date.now();

      // Make rapid sequential requests
      for (let i = 0; i < numRequests; i++) {
        const requestStart = Date.now();
        const result = await testHealthEndpoint(page, "/reader/api/health/app");
        const requestTime = Date.now() - requestStart;

        results.push({
          index: i + 1,
          status: result.response.status(),
          responseTime: requestTime,
          data: result.data,
        });
      }

      const totalTime = Date.now() - startTime;

      // RR-115: Should handle rapid requests efficiently
      expect(totalTime).toBeLessThan(15000); // Less than 15 seconds for all requests

      // All requests should succeed
      results.forEach((result) => {
        expect([200, 503]).toContain(result.status);
        expect(result.responseTime).toBeLessThan(3000); // Each request < 3 seconds
      });

      // Calculate performance metrics
      const avgResponseTime =
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map((r) => r.responseTime));
      const minResponseTime = Math.min(...results.map((r) => r.responseTime));

      console.log(`✓ Sequential requests completed:`);
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Average response: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`  - Min response: ${minResponseTime}ms`);
      console.log(`  - Max response: ${maxResponseTime}ms`);

      // Performance should be reasonable
      expect(avgResponseTime).toBeLessThan(1000); // Average less than 1 second
      expect(maxResponseTime).toBeLessThan(5000); // Max less than 5 seconds
    });

    test("should prevent race conditions in health status determination", async ({
      page,
    }) => {
      // Test overlapping requests to different endpoints
      const promises = [];

      // Stagger requests to create potential race conditions
      promises.push(testHealthEndpoint(page, "/reader/api/health/app"));

      setTimeout(() => {
        promises.push(testHealthEndpoint(page, "/reader/api/health/db"));
      }, 50);

      setTimeout(() => {
        promises.push(
          testHealthEndpoint(page, "/reader/api/health/app?ping=true")
        );
      }, 100);

      setTimeout(() => {
        promises.push(testHealthEndpoint(page, "/reader/api/health/freshness"));
      }, 150);

      const results = await Promise.all(promises);

      // All requests should complete successfully
      results.forEach((result, index) => {
        expect([200, 503]).toContain(result.response.status());
        expect(result.data).toBeDefined();

        const endpoint = ["app", "db", "ping", "freshness"][index];
        console.log(`✓ ${endpoint} endpoint: HTTP ${result.response.status()}`);
      });

      // Validate logical consistency between endpoints
      const appResult = results[0];
      const dbResult = results[1];

      // If app reports database as error, db endpoint should also indicate error
      if (appResult.data.dependencies?.database === "error") {
        expect(dbResult.data.database).toBe("error");
        expect(dbResult.response.status()).toBe(503);
      }

      console.log(`✓ No race conditions detected between overlapping requests`);
    });
  });

  test.describe("Network Timeout Handling", () => {
    test("should handle network timeouts gracefully", async ({ page }) => {
      // Set a reasonable timeout for the test
      page.setDefaultTimeout(10000); // 10 second timeout

      const startTime = Date.now();

      try {
        const result = await testHealthEndpoint(page, "/reader/api/health/app");
        const responseTime = Date.now() - startTime;

        // Should respond within timeout
        expect(responseTime).toBeLessThan(8000); // Less than 8 seconds
        expect([200, 503]).toContain(result.response.status());
        expect(result.data).toHaveProperty("status");

        console.log(`✓ Health endpoint responded in ${responseTime}ms`);
      } catch (error) {
        if (error.message.includes("timeout")) {
          console.log(
            `⚠️ Health endpoint timed out - this may indicate performance issues`
          );
          throw new Error(
            "Health endpoints should not timeout under normal conditions"
          );
        }
        throw error;
      }
    });

    test("should provide fast ping responses even under load", async ({
      page,
    }) => {
      const pingPromises = Array(10)
        .fill(null)
        .map(() => {
          const startTime = Date.now();
          return testHealthEndpoint(
            page,
            "/reader/api/health/app?ping=true"
          ).then((result) => ({
            ...result,
            responseTime: Date.now() - startTime,
          }));
        });

      const results = await Promise.all(pingPromises);

      // All ping requests should be fast
      results.forEach((result, index) => {
        expect(result.response.status()).toBe(200);
        expect(result.data).toHaveProperty("ping", true);
        expect(result.data).toHaveProperty("status", "ok");
        expect(result.responseTime).toBeLessThan(2000); // Less than 2 seconds

        console.log(`✓ Ping ${index + 1}: ${result.responseTime}ms`);
      });

      const avgPingTime =
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgPingTime).toBeLessThan(1000); // Average less than 1 second

      console.log(`✓ Average ping response time: ${avgPingTime.toFixed(0)}ms`);
    });

    test("should handle slow database responses appropriately", async ({
      page,
    }) => {
      const dbResult = await testHealthEndpoint(page, "/reader/api/health/db");

      expect([200, 503]).toContain(dbResult.response.status());
      expect(dbResult.data).toHaveProperty("database");
      expect(dbResult.data).toHaveProperty("queryTime");

      // RR-115: Should detect and report slow database responses
      if (dbResult.data.queryTime > 5000) {
        expect(dbResult.data.database).toBe("slow");
        expect(dbResult.data.status).toBe("degraded");
        expect(dbResult.response.status()).toBe(200); // Degraded returns 200
        console.log(`⚠️ Slow database detected: ${dbResult.data.queryTime}ms`);
      } else {
        console.log(`✓ Database response time: ${dbResult.data.queryTime}ms`);
      }

      // Query time should be reasonable
      expect(dbResult.data.queryTime).toBeLessThan(30000); // Less than 30 seconds
      expect(dbResult.data.queryTime).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Performance Under Load", () => {
    test("should maintain performance under sustained load", async ({
      page,
    }) => {
      const loadTestDuration = 10000; // 10 seconds
      const requestInterval = 200; // Request every 200ms
      const results = [];
      const startTime = Date.now();

      // Generate sustained load
      const loadTest = async () => {
        while (Date.now() - startTime < loadTestDuration) {
          const requestStart = Date.now();
          try {
            const result = await testHealthEndpoint(
              page,
              "/reader/api/health/app?ping=true"
            );
            const responseTime = Date.now() - requestStart;

            results.push({
              timestamp: Date.now(),
              status: result.response.status(),
              responseTime,
            });
          } catch (error) {
            results.push({
              timestamp: Date.now(),
              status: "error",
              responseTime: Date.now() - requestStart,
              error: error.message,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, requestInterval));
        }
      };

      await loadTest();

      // Analyze performance under load
      const successfulRequests = results.filter((r) => r.status === 200);
      const failedRequests = results.filter((r) => r.status !== 200);

      console.log(`✓ Load test completed:`);
      console.log(`  - Total requests: ${results.length}`);
      console.log(`  - Successful: ${successfulRequests.length}`);
      console.log(`  - Failed: ${failedRequests.length}`);

      // Should handle most requests successfully
      const successRate = successfulRequests.length / results.length;
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate

      // Response times should remain reasonable
      if (successfulRequests.length > 0) {
        const avgResponseTime =
          successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) /
          successfulRequests.length;
        expect(avgResponseTime).toBeLessThan(3000); // Less than 3 seconds average

        console.log(`  - Success rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(
          `  - Average response time: ${avgResponseTime.toFixed(0)}ms`
        );
      }
    });

    test("should recover gracefully from temporary overload", async ({
      page,
    }) => {
      // Generate a burst of requests to simulate overload
      const burstSize = 50;
      const burstPromises = Array(burstSize)
        .fill(null)
        .map(() => testHealthEndpoint(page, "/reader/api/health/app"));

      const burstStart = Date.now();
      const burstResults = await Promise.all(burstPromises);
      const burstDuration = Date.now() - burstStart;

      console.log(`✓ Burst test completed in ${burstDuration}ms`);

      // Count successful vs failed requests
      const successful = burstResults.filter((r) =>
        [200, 503].includes(r.response.status())
      ).length;
      const failed = burstResults.length - successful;

      console.log(`  - Successful responses: ${successful}`);
      console.log(`  - Failed responses: ${failed}`);

      // Should handle most requests (allow some failures under extreme load)
      expect(successful / burstResults.length).toBeGreaterThan(0.8); // 80% success rate

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Test recovery - should respond normally after burst
      const recoveryResult = await testHealthEndpoint(
        page,
        "/reader/api/health/app?ping=true"
      );
      expect(recoveryResult.response.status()).toBe(200);
      expect(recoveryResult.data).toHaveProperty("ping", true);

      console.log(`✓ Service recovered successfully after burst load`);
    });
  });
});
