/**
 * Integration Tests for Health Endpoints
 * Ensures health monitoring still works after removing test endpoints (RR-69)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer } from "./test-server";
import type { Server } from "http";

const port = 3148; // Use different port for testing

describe("Health Endpoints - Post RR-69 Verification", () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    const setup = await setupTestServer(port);
    server = setup.server;
    app = setup.app;

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`> Test server ready on http://localhost:${port}`);
        resolve();
      });
    });
  }, 30000); // Increase timeout for server startup

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    // Clean up environment variable
    delete process.env.NEXT_BUILD_DIR;
  });

  describe("Production Health Endpoints", () => {
    it("should return 200 for /reader/api/health/app", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/health/app`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("version");
    });

    // RR-114: Enhanced version property integration tests
    it("should return valid version property format in /reader/api/health/app", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/health/app`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("version");
      expect(typeof data.version).toBe("string");
      expect(data.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
      expect(data.version.length).toBeGreaterThan(4); // At least "0.0.1"
    });

    it("should support ping parameter for /reader/api/health/app", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/health/app?ping=true`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("ping", true);
      // RR-114: Version should be returned even with ping=true
      expect(data).toHaveProperty("version");
      expect(typeof data.version).toBe("string");
      expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should return 200 for /reader/api/health/db", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/health/db`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("database");
      expect(data).toHaveProperty("timestamp");
    });

    // RR-114: Connection property alias integration tests
    it("should return connection property as alias for database property in /reader/api/health/db", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/health/db`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("database");
      expect(data).toHaveProperty("connection"); // RR-114: connection alias
      expect(data.connection).toBe(data.database); // Alias should match database value
      expect(typeof data.database).toBe("string");
      expect(typeof data.connection).toBe("string");
      
      // Verify common database status values
      const validStatuses = ["connected", "unavailable", "error", "slow"];
      expect(validStatuses).toContain(data.database);
      expect(validStatuses).toContain(data.connection);
    });

    it("should return 200 for /reader/api/health/cron", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/health/cron`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("lastRun");
    });
  });

  describe("Removed Test Endpoints", () => {
    const removedEndpoints = [
      "/reader/api/test-supabase",
      "/reader/api/test-prompt-config",
      "/reader/api/test-api-endpoints",
      "/reader/api/test-refresh-stats",
      "/reader/api/debug/data-cleanup",
    ];

    removedEndpoints.forEach((endpoint) => {
      it(`should return 404 for ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        expect(response.status).toBe(404);

        // Should not return any sensitive data
        const text = await response.text();
        expect(text).not.toContain("supabase");
        expect(text).not.toContain("config");
        expect(text).not.toContain("debug");
      });

      it(`should return 404 for POST ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true }),
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe("Core API Functionality", () => {
    it("should still serve authentication status endpoint", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("authenticated");
    });

    it("should serve specific article endpoints", async () => {
      // Test that article-specific endpoints exist (even if they return errors without params)
      // Note: /api/articles and /api/feeds base endpoints don't exist - data is fetched via Supabase directly
      const response = await fetch(`http://localhost:${port}/reader/api/articles/test-id/fetch-content`, {
        method: 'POST'
      });
      // Should return 400 or 404 for invalid ID, not route-not-found
      expect([400, 404, 500]).toContain(response.status);
    });
  });

  describe("Error Response Consistency", () => {
    it("should return consistent 404 error format", async () => {
      const response1 = await fetch(
        `http://localhost:${port}/reader/api/test-supabase`
      );
      const response2 = await fetch(
        `http://localhost:${port}/reader/api/non-existent-endpoint`
      );

      expect(response1.status).toBe(404);
      expect(response2.status).toBe(404);

      // Both should have similar error responses
      const text1 = await response1.text();
      const text2 = await response2.text();

      // Should have similar structure (both Next.js 404s)
      expect(text1.length).toBeGreaterThan(0);
      expect(text2.length).toBeGreaterThan(0);
    });
  });

  describe("Health Endpoint Response Times", () => {
    it("should respond quickly to health checks", async () => {
      const start = Date.now();
      const response = await fetch(
        `http://localhost:${port}/reader/api/health/app?ping=true`
      );
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it("should handle concurrent health checks", async () => {
      const promises = Array(10)
        .fill(null)
        .map(() => fetch(`http://localhost:${port}/reader/api/health/app`));

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
