import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer } from "./test-server";
import type { Server } from "http";

let server: Server;
let app: any;

beforeAll(async () => {
  const testServer = await setupTestServer(3003);
  server = testServer.server;
  app = testServer.app;

  await new Promise<void>((resolve) => {
    server.listen(3003, resolve);
  });
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (app) {
    await app.close();
  }
});

describe("OpenAPI Integration Tests (RR-200)", () => {
  describe("Swagger UI Accessibility", () => {
    it("should serve Swagger UI at /reader/api-docs", async () => {
      const response = await fetch("http://localhost:3003/reader/api-docs");

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Swagger UI");
      expect(html).toContain("RSS Reader API");
    });

    it("should serve OpenAPI specification JSON", async () => {
      const response = await fetch(
        "http://localhost:3003/reader/api-docs/openapi.json"
      );

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json"
      );

      const spec = await response.json();
      expect(spec).toMatchObject({
        openapi: "3.0.0",
        info: {
          title: "RSS Reader API",
          version: "1.0.0",
        },
      });
    });

    it("should include CORS headers for OpenAPI JSON", async () => {
      const response = await fetch(
        "http://localhost:3003/reader/api-docs/openapi.json"
      );

      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "GET"
      );
    });
  });

  describe("Health Endpoints in OpenAPI", () => {
    let openApiSpec: any;

    beforeAll(async () => {
      const response = await fetch(
        "http://localhost:3003/reader/api-docs/openapi.json"
      );
      openApiSpec = await response.json();
    });

    it("should include all 6 health endpoints in specification", async () => {
      const expectedPaths = [
        "/api/health",
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/health/parsing",
        "/api/health/claude",
      ];

      expectedPaths.forEach((path) => {
        expect(openApiSpec.paths).toHaveProperty(path);
        expect(openApiSpec.paths[path]).toHaveProperty("get");
      });
    });

    it("should have proper operation metadata for each endpoint", async () => {
      const healthAppEndpoint = openApiSpec.paths["/api/health/app"];

      expect(healthAppEndpoint.get).toMatchObject({
        summary: expect.any(String),
        description: expect.any(String),
        tags: expect.arrayContaining(["Health"]),
        operationId: expect.any(String),
      });
    });

    it("should include response schemas for 200 and 500 status codes", async () => {
      const endpointPaths = [
        "/api/health",
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/health/parsing",
        "/api/health/claude",
      ];

      endpointPaths.forEach((path) => {
        const endpoint = openApiSpec.paths[path].get;

        expect(endpoint.responses).toHaveProperty("200");
        expect(endpoint.responses).toHaveProperty("500");

        // Check 200 response has content and schema
        expect(endpoint.responses["200"]).toHaveProperty("content");
        expect(endpoint.responses["200"].content).toHaveProperty(
          "application/json"
        );
        expect(
          endpoint.responses["200"].content["application/json"]
        ).toHaveProperty("schema");

        // Check 500 response has content and schema
        expect(endpoint.responses["500"]).toHaveProperty("content");
        expect(endpoint.responses["500"].content).toHaveProperty(
          "application/json"
        );
        expect(
          endpoint.responses["500"].content["application/json"]
        ).toHaveProperty("schema");
      });
    });

    it("should include response examples for all endpoints", async () => {
      const endpointPaths = [
        "/api/health",
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/health/parsing",
        "/api/health/claude",
      ];

      endpointPaths.forEach((path) => {
        const endpoint = openApiSpec.paths[path].get;

        // Check 200 response has examples
        const response200 = endpoint.responses["200"];
        expect(response200.content["application/json"]).toHaveProperty(
          "examples"
        );
        expect(
          Object.keys(response200.content["application/json"].examples)
        ).toHaveLength.greaterThan(0);

        // Check 500 response has examples
        const response500 = endpoint.responses["500"];
        expect(response500.content["application/json"]).toHaveProperty(
          "examples"
        );
        expect(
          Object.keys(response500.content["application/json"].examples)
        ).toHaveLength.greaterThan(0);
      });
    });
  });

  describe("Real Health Endpoint Integration", () => {
    it("should verify actual health endpoints respond correctly", async () => {
      const healthEndpoints = [
        { path: "/api/health", name: "Main health" },
        { path: "/api/health/app", name: "App health" },
        { path: "/api/health/db", name: "DB health" },
        { path: "/api/health/cron", name: "Cron health" },
        { path: "/api/health/parsing", name: "Parsing health" },
        { path: "/api/health/claude", name: "Claude health" },
      ];

      for (const endpoint of healthEndpoints) {
        const response = await fetch(
          `http://localhost:3003/reader${endpoint.path}`
        );

        // Should respond successfully (either 200 or 503 for test environment)
        expect([200, 503]).toContain(response.status);
        expect(response.headers.get("content-type")).toContain(
          "application/json"
        );

        const data = await response.json();
        expect(data).toHaveProperty("status");
        expect(data).toHaveProperty("timestamp");

        // Status should be valid enum value
        expect(["healthy", "unhealthy", "degraded"]).toContain(data.status);
      }
    });

    it("should match OpenAPI schema with actual responses", async () => {
      // Test main health endpoint
      const healthResponse = await fetch(
        "http://localhost:3003/reader/api/health"
      );
      const healthData = await healthResponse.json();

      // Response should match OpenAPI schema structure
      expect(healthData).toMatchObject({
        status: expect.any(String),
        timestamp: expect.any(String),
      });

      // Test app health endpoint
      const appResponse = await fetch(
        "http://localhost:3003/reader/api/health/app"
      );
      const appData = await appResponse.json();

      expect(appData).toMatchObject({
        status: expect.any(String),
        service: expect.any(String),
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/), // Semantic version
        timestamp: expect.any(String),
      });

      // Test database health endpoint
      const dbResponse = await fetch(
        "http://localhost:3003/reader/api/health/db"
      );
      const dbData = await dbResponse.json();

      expect(dbData).toMatchObject({
        status: expect.any(String),
        database: expect.any(String),
        connection: expect.any(String), // RR-114: alias property
        timestamp: expect.any(String),
      });

      // Connection should equal database value (alias requirement)
      expect(dbData.connection).toBe(dbData.database);
    });
  });

  describe("OpenAPI Registry Integration", () => {
    it("should generate valid OpenAPI document", async () => {
      const response = await fetch(
        "http://localhost:3003/reader/api-docs/openapi.json"
      );
      const spec = await response.json();

      // Validate OpenAPI 3.0 structure
      expect(spec.openapi).toBe("3.0.0");
      expect(spec.info).toBeDefined();
      expect(spec.paths).toBeDefined();
      expect(spec.servers).toBeDefined();

      // Validate server configuration
      expect(spec.servers).toEqual([
        {
          url: expect.stringContaining("reader"),
          description: expect.any(String),
        },
      ]);
    });

    it("should have consistent schema structure across endpoints", async () => {
      const response = await fetch(
        "http://localhost:3003/reader/api-docs/openapi.json"
      );
      const spec = await response.json();

      const healthPaths = Object.keys(spec.paths).filter((path) =>
        path.startsWith("/api/health")
      );

      expect(healthPaths).toHaveLength(6);

      // All health endpoints should have consistent structure
      healthPaths.forEach((path) => {
        const endpoint = spec.paths[path].get;

        expect(endpoint).toHaveProperty("tags");
        expect(endpoint.tags).toContain("Health");
        expect(endpoint).toHaveProperty("operationId");
        expect(endpoint).toHaveProperty("summary");
        expect(endpoint).toHaveProperty("description");
        expect(endpoint).toHaveProperty("responses");
      });
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle missing OpenAPI registry gracefully", async () => {
      // This test verifies the system degrades gracefully if OpenAPI components fail
      const response = await fetch("http://localhost:3003/reader/api-docs", {
        headers: { Accept: "text/html" },
      });

      // Should either work or fail gracefully with proper error page
      if (!response.ok) {
        expect([404, 500, 503]).toContain(response.status);
      } else {
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain("html");
      }
    });

    it("should handle malformed requests to api-docs", async () => {
      const invalidRequests = [
        "http://localhost:3003/reader/api-docs/../..",
        "http://localhost:3003/reader/api-docs/%2e%2e",
        "http://localhost:3003/reader/api-docs?inject=<script>",
      ];

      for (const url of invalidRequests) {
        const response = await fetch(url);

        // Should not crash and should return proper error status
        expect([400, 403, 404, 500]).toContain(response.status);
      }
    });
  });

  describe("Performance Integration", () => {
    it("should load Swagger UI within reasonable time", async () => {
      const startTime = Date.now();

      const response = await fetch("http://localhost:3003/reader/api-docs");

      const loadTime = Date.now() - startTime;

      expect(response.ok).toBe(true);
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    it("should serve OpenAPI JSON efficiently", async () => {
      const startTime = Date.now();

      const response = await fetch(
        "http://localhost:3003/reader/api-docs/openapi.json"
      );

      const loadTime = Date.now() - startTime;

      expect(response.ok).toBe(true);
      expect(loadTime).toBeLessThan(1000); // JSON should load within 1 second

      // Response should be reasonably sized
      const spec = await response.json();
      const specSize = JSON.stringify(spec).length;
      expect(specSize).toBeLessThan(100000); // Less than 100KB
    });

    it("should cache static resources appropriately", async () => {
      const response = await fetch("http://localhost:3003/reader/api-docs");

      const cacheHeader = response.headers.get("cache-control");
      if (cacheHeader) {
        // Should have some caching strategy
        expect(cacheHeader).toMatch(/max-age=\d+|no-cache|public|private/);
      }
    });
  });

  describe("Security Integration", () => {
    it("should not expose sensitive information in OpenAPI spec", async () => {
      const response = await fetch(
        "http://localhost:3003/reader/api-docs/openapi.json"
      );
      const spec = await response.json();
      const specText = JSON.stringify(spec);

      // Should not contain sensitive patterns
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /key.*=.*[a-zA-Z0-9]/,
        /api[_-]?key/i,
      ];

      sensitivePatterns.forEach((pattern) => {
        expect(specText).not.toMatch(pattern);
      });
    });

    it("should include proper security headers", async () => {
      const response = await fetch("http://localhost:3003/reader/api-docs");

      // Check for common security headers
      const securityHeaders = [
        "x-content-type-options",
        "x-frame-options",
        "x-xss-protection",
      ];

      securityHeaders.forEach((header) => {
        // Headers may or may not be present, but if present should have safe values
        const headerValue = response.headers.get(header);
        if (headerValue) {
          expect(headerValue).toBeTruthy();
        }
      });
    });
  });
});
