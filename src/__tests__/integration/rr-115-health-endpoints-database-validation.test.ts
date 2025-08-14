/**
 * Integration Tests for RR-115: Health Endpoints Database Connection State Validation
 *
 * These tests verify that health endpoints properly handle:
 * 1. Real database connection states during service startup
 * 2. Database health endpoint HTTP status codes (200 vs 503)
 * 3. Service startup dependencies with real API calls
 * 4. Test environment configuration and graceful degradation
 * 5. Timing and race conditions with actual network requests
 *
 * RED PHASE: These tests will FAIL initially and guide implementation fixes.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer } from "./test-server";
import type { Server } from "http";

const port = 3159; // Use unique port for RR-115 tests

describe("RR-115: Health Endpoints Database Connection State Validation", () => {
  let server: Server;
  let app: any;
  let baseUrl: string;

  beforeAll(async () => {
    const setup = await setupTestServer(port);
    server = setup.server;
    app = setup.app;
    baseUrl = `http://localhost:${port}`;

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`> RR-115 Test server ready on http://localhost:${port}`);
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    if (app) {
      await app.close?.();
    }
  });

  describe("Database Connection State Detection", () => {
    it("should return 200 OK when database is healthy during startup", async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      const data = await response.json();

      // RR-115: Should return 200 OK when healthy
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("database");
      expect(data).toHaveProperty("connection"); // RR-114 alias
      expect(data).toHaveProperty("timestamp");

      // Database should be in a healthy state
      expect(["connected", "unavailable"]).toContain(data.database);
      expect(data.connection).toBe(data.database);

      console.log(
        `✓ Database health endpoint returned: status=${data.status}, database=${data.database}`
      );
    });

    it("should return proper status codes based on database state", async () => {
      // Test multiple rapid requests to catch different states
      const requests = Array(5)
        .fill(null)
        .map(() => fetch(`${baseUrl}/reader/api/health/db`));

      const responses = await Promise.all(requests);
      const dataResults = await Promise.all(responses.map((r) => r.json()));

      responses.forEach((response, index) => {
        const data = dataResults[index];

        // RR-115: Status code should match database state
        if (data.database === "error") {
          expect(response.status).toBe(503); // Service Unavailable
          expect(data.status).toBe("unhealthy");
        } else if (data.database === "slow") {
          expect(response.status).toBe(200); // OK but degraded
          expect(data.status).toBe("degraded");
        } else if (data.database === "connected") {
          expect(response.status).toBe(200); // OK
          expect(data.status).toBe("healthy");
        } else if (data.database === "unavailable") {
          // In test environment - should be OK
          expect(response.status).toBe(200);
          expect(data.status).toBe("healthy");
        }

        console.log(
          `✓ Request ${index + 1}: HTTP ${response.status}, database=${data.database}, status=${data.status}`
        );
      });
    });

    it("should validate database connection properties during service startup", async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      const data = await response.json();

      expect(response.status).toBe(200);

      // RR-115: Should have comprehensive connection validation
      expect(data).toHaveProperty("database");
      expect(data).toHaveProperty("connection"); // RR-114 alias
      expect(data).toHaveProperty("environment");
      expect(data).toHaveProperty("queryTime");
      expect(data).toHaveProperty("timestamp");

      // Connection alias should match database value
      expect(data.connection).toBe(data.database);

      // Query time should be reasonable
      expect(typeof data.queryTime).toBe("number");
      expect(data.queryTime).toBeGreaterThanOrEqual(0);
      expect(data.queryTime).toBeLessThan(30000); // Less than 30 seconds

      // Environment should be properly detected
      expect(["development", "test", "production"]).toContain(data.environment);

      console.log(
        `✓ Database connection validated: queryTime=${data.queryTime}ms, env=${data.environment}`
      );
    });

    it("should handle database connection timeouts gracefully", async () => {
      // Set a reasonable timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(`${baseUrl}/reader/api/health/db`, {
          signal: controller.signal,
        });
        const data = await response.json();

        clearTimeout(timeoutId);

        // Should respond within timeout
        expect(response.status).toMatch(/^(200|503)$/);
        expect(data).toHaveProperty("database");
        expect(data).toHaveProperty("queryTime");

        // If query time is high, should be marked as slow
        if (data.queryTime > 5000) {
          expect(data.database).toBe("slow");
          expect(data.status).toBe("degraded");
        }

        console.log(`✓ Database health check completed in ${data.queryTime}ms`);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          console.log(
            "⚠️ Database health check timed out - this indicates a potential issue"
          );
          throw new Error("Database health check should not timeout");
        }
        throw error;
      }
    });
  });

  describe("App Health Endpoint Service Dependencies", () => {
    it("should return 200 OK when app services are healthy during startup", async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/app`);
      const data = await response.json();

      // RR-115: Should return 200 OK when healthy
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("service");
      expect(data).toHaveProperty("version"); // RR-114
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("dependencies");

      // Should have dependency information
      expect(data.dependencies).toHaveProperty("database");
      expect(data.dependencies).toHaveProperty("oauth");

      console.log(
        `✓ App health endpoint returned: status=${data.status}, service=${data.service}`
      );
    });

    it("should return 503 Service Unavailable when critical services are down", async () => {
      // This test may pass or fail depending on actual service state
      // The key is to verify that 503 is returned when services are actually unhealthy

      const response = await fetch(`${baseUrl}/reader/api/health/app`);
      const data = await response.json();

      // RR-115: Status code should match service health
      if (data.status === "unhealthy") {
        expect(response.status).toBe(503);
        expect(data).toHaveProperty("error");
        console.log(
          `✓ App correctly returned 503 for unhealthy status: ${data.error}`
        );
      } else if (data.status === "degraded") {
        expect(response.status).toBe(200); // Degraded still returns 200
        console.log(`✓ App correctly returned 200 for degraded status`);
      } else {
        expect(response.status).toBe(200);
        expect(data.status).toBe("healthy");
        console.log(`✓ App correctly returned 200 for healthy status`);
      }
    });

    it("should validate service startup dependencies in app health", async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/app`);
      const data = await response.json();

      expect(response.status).toBe(200);

      // RR-115: Should validate all critical dependencies
      expect(data).toHaveProperty("dependencies");
      expect(data.dependencies).toHaveProperty("database");
      expect(data.dependencies).toHaveProperty("oauth");

      // Dependencies should have valid states
      const validStates = ["connected", "unavailable", "error", "unknown"];
      expect(validStates).toContain(data.dependencies.database);
      expect(validStates).toContain(data.dependencies.oauth);

      // Should have performance metrics
      expect(data).toHaveProperty("performance");
      expect(data.performance).toHaveProperty("avgSyncTime");
      expect(data.performance).toHaveProperty("avgDbQueryTime");
      expect(data.performance).toHaveProperty("avgApiCallTime");

      console.log(
        `✓ Service dependencies validated: db=${data.dependencies.database}, oauth=${data.dependencies.oauth}`
      );
    });

    it("should handle ping parameter correctly with service validation", async () => {
      const response = await fetch(
        `${baseUrl}/reader/api/health/app?ping=true`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("ping", true);
      expect(data).toHaveProperty("version"); // RR-114

      // Ping should be fast
      const responseTime = response.headers.get("x-response-time");
      if (responseTime) {
        const timeMs = parseFloat(responseTime);
        expect(timeMs).toBeLessThan(1000); // Less than 1 second
      }

      console.log(
        `✓ Ping endpoint responded correctly with version: ${data.version}`
      );
    });
  });

  describe("Service Availability Detection", () => {
    it("should detect when services are starting up vs fully available", async () => {
      // Test both endpoints simultaneously to check for race conditions
      const [appResponse, dbResponse] = await Promise.all([
        fetch(`${baseUrl}/reader/api/health/app`),
        fetch(`${baseUrl}/reader/api/health/db`),
      ]);

      const [appData, dbData] = await Promise.all([
        appResponse.json(),
        dbResponse.json(),
      ]);

      // Both should respond successfully
      expect(appResponse.status).toMatch(/^(200|503)$/);
      expect(dbResponse.status).toMatch(/^(200|503)$/);

      // App endpoint should have service information
      expect(appData).toHaveProperty("service");
      expect(appData).toHaveProperty("status");

      // DB endpoint should have database information
      expect(dbData).toHaveProperty("database");
      expect(dbData).toHaveProperty("connection");

      // RR-115: Should detect if services are in startup vs ready state
      if (appData.status === "healthy" && dbData.status === "healthy") {
        console.log(`✓ All services fully available`);
      } else {
        console.log(
          `⚠️ Services in transitional state: app=${appData.status}, db=${dbData.status}`
        );
      }
    });

    it("should handle concurrent requests during service startup", async () => {
      // Make multiple concurrent requests to stress test startup handling
      const concurrentRequests = 10;
      const appRequests = Array(concurrentRequests)
        .fill(null)
        .map(() => fetch(`${baseUrl}/reader/api/health/app`));
      const dbRequests = Array(concurrentRequests)
        .fill(null)
        .map(() => fetch(`${baseUrl}/reader/api/health/db`));

      const [appResponses, dbResponses] = await Promise.all([
        Promise.all(appRequests),
        Promise.all(dbRequests),
      ]);

      // All requests should complete successfully
      appResponses.forEach((response, index) => {
        expect([200, 503]).toContain(response.status);
        console.log(`✓ App request ${index + 1}: HTTP ${response.status}`);
      });

      dbResponses.forEach((response, index) => {
        expect([200, 503]).toContain(response.status);
        console.log(`✓ DB request ${index + 1}: HTTP ${response.status}`);
      });

      console.log(
        `✓ Handled ${concurrentRequests} concurrent requests to each endpoint`
      );
    });

    it("should provide consistent responses across multiple requests", async () => {
      // Make sequential requests to check for consistency
      const numRequests = 5;
      const responses = [];

      for (let i = 0; i < numRequests; i++) {
        const appResponse = await fetch(`${baseUrl}/reader/api/health/app`);
        const dbResponse = await fetch(`${baseUrl}/reader/api/health/db`);

        const appData = await appResponse.json();
        const dbData = await dbResponse.json();

        responses.push({
          app: { status: appResponse.status, data: appData },
          db: { status: dbResponse.status, data: dbData },
        });

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Check for consistency in service states
      const appStatuses = responses.map((r) => r.app.data.status);
      const dbStatuses = responses.map((r) => r.db.data.database);

      console.log(`App statuses: ${appStatuses.join(", ")}`);
      console.log(`DB statuses: ${dbStatuses.join(", ")}`);

      // Services should not flip between healthy/unhealthy rapidly
      // This would indicate unstable service detection
      const uniqueAppStatuses = [...new Set(appStatuses)];
      const uniqueDbStatuses = [...new Set(dbStatuses)];

      expect(uniqueAppStatuses.length).toBeLessThanOrEqual(2); // Should not have more than 2 different states
      expect(uniqueDbStatuses.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Test Environment Configuration", () => {
    it("should handle test environment database connections appropriately", async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      const data = await response.json();

      expect(response.status).toBe(200);

      // In test environment, should gracefully handle unavailable database
      if (data.environment === "test") {
        expect(data.database).toBe("unavailable");
        expect(data.connection).toBe("unavailable");
        expect(data.message).toContain("test environment");
        console.log(`✓ Test environment correctly handled: ${data.message}`);
      } else {
        // In development environment, should attempt real connection
        expect(["connected", "error", "slow"]).toContain(data.database);
        console.log(
          `✓ ${data.environment} environment database: ${data.database}`
        );
      }
    });

    it("should configure health checks based on available services", async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/app`);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Should adapt to environment capabilities
      expect(data).toHaveProperty("dependencies");
      expect(data).toHaveProperty("performance");

      // Dependencies should reflect actual environment capabilities
      if (data.dependencies.database === "unavailable") {
        // Test environment - should not report errors
        expect(data.status).not.toBe("unhealthy");
      }

      console.log(
        `✓ Health checks adapted to environment: ${JSON.stringify(data.dependencies)}`
      );
    });

    it("should maintain backwards compatibility in test responses", async () => {
      // Test both endpoints for backwards compatibility
      const [appResponse, dbResponse] = await Promise.all([
        fetch(`${baseUrl}/reader/api/health/app`),
        fetch(`${baseUrl}/reader/api/health/db`),
      ]);

      const [appData, dbData] = await Promise.all([
        appResponse.json(),
        dbResponse.json(),
      ]);

      // App endpoint - all existing properties should be present
      expect(appData).toHaveProperty("status");
      expect(appData).toHaveProperty("service");
      expect(appData).toHaveProperty("timestamp");
      expect(appData).toHaveProperty("dependencies");
      expect(appData).toHaveProperty("performance");

      // RR-114 new property
      expect(appData).toHaveProperty("version");

      // DB endpoint - all existing properties should be present
      expect(dbData).toHaveProperty("status");
      expect(dbData).toHaveProperty("database");
      expect(dbData).toHaveProperty("timestamp");
      expect(dbData).toHaveProperty("environment");

      // RR-114 new property (alias)
      expect(dbData).toHaveProperty("connection");
      expect(dbData.connection).toBe(dbData.database);

      console.log(`✓ Backwards compatibility maintained`);
    });
  });

  describe("Error Response Validation", () => {
    it("should return appropriate HTTP status codes for different error scenarios", async () => {
      // Test app endpoint error handling
      const appResponse = await fetch(`${baseUrl}/reader/api/health/app`);
      const appData = await appResponse.json();

      // Validate status code matches reported health
      if (appData.status === "unhealthy") {
        expect(appResponse.status).toBe(503);
        expect(appData).toHaveProperty("error");
        console.log(
          `✓ App endpoint correctly returned 503 for unhealthy state`
        );
      } else if (appData.status === "degraded") {
        expect(appResponse.status).toBe(200);
        console.log(`✓ App endpoint correctly returned 200 for degraded state`);
      } else {
        expect(appResponse.status).toBe(200);
        expect(appData.status).toBe("healthy");
        console.log(`✓ App endpoint correctly returned 200 for healthy state`);
      }

      // Test db endpoint error handling
      const dbResponse = await fetch(`${baseUrl}/reader/api/health/db`);
      const dbData = await dbResponse.json();

      // Validate status code matches database state
      if (dbData.database === "error") {
        expect(dbResponse.status).toBe(503);
        expect(dbData.status).toBe("unhealthy");
        console.log(`✓ DB endpoint correctly returned 503 for error state`);
      } else if (dbData.database === "slow") {
        expect(dbResponse.status).toBe(200);
        expect(dbData.status).toBe("degraded");
        console.log(`✓ DB endpoint correctly returned 200 for slow state`);
      } else {
        expect(dbResponse.status).toBe(200);
        console.log(
          `✓ DB endpoint correctly returned 200 for ${dbData.database} state`
        );
      }
    });

    it("should provide detailed error information for debugging", async () => {
      const responses = await Promise.all([
        fetch(`${baseUrl}/reader/api/health/app`),
        fetch(`${baseUrl}/reader/api/health/db`),
      ]);

      const dataResults = await Promise.all(responses.map((r) => r.json()));

      responses.forEach((response, index) => {
        const data = dataResults[index];
        const endpoint = index === 0 ? "app" : "db";

        // Should have timestamp for all responses
        expect(data).toHaveProperty("timestamp");
        expect(new Date(data.timestamp)).toBeInstanceOf(Date);

        // If unhealthy, should have error details
        if (response.status === 503) {
          expect(data).toHaveProperty("error");
          expect(typeof data.error).toBe("string");
          expect(data.error.length).toBeGreaterThan(0);
          console.log(
            `✓ ${endpoint} endpoint provided error details: ${data.error}`
          );
        } else {
          console.log(
            `✓ ${endpoint} endpoint healthy: ${data.status || data.database}`
          );
        }
      });
    });

    it("should handle malformed requests gracefully", async () => {
      // Test with invalid query parameters
      const responses = await Promise.all([
        fetch(`${baseUrl}/reader/api/health/app?invalid=param&malformed`),
        fetch(`${baseUrl}/reader/api/health/db?test=123&random=data`),
      ]);

      // Should still respond normally despite invalid params
      responses.forEach((response, index) => {
        const endpoint = index === 0 ? "app" : "db";
        expect([200, 503]).toContain(response.status);
        console.log(
          `✓ ${endpoint} endpoint handled malformed request: HTTP ${response.status}`
        );
      });
    });
  });
});
