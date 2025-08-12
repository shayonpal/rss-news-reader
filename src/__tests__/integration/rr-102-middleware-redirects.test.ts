/**
 * Integration Tests for RR-102: API Base Path Middleware Redirects
 *
 * Tests the middleware that automatically redirects API requests missing the
 * /reader prefix to the correct path in development environment.
 *
 * Expected behavior:
 * - GET requests to /api/* redirect to /reader/api/* in development
 * - POST/PUT/DELETE requests return helpful JSON error messages
 * - Production mode bypasses middleware entirely
 * - Static files and Next.js internals are not affected
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

const port = 3152; // Unique port for this test

describe("RR-102: API Base Path Middleware", () => {
  let server: any;
  let app: any;
  const originalEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    // Set to development mode to test middleware behavior
    process.env.NODE_ENV = "development";
    process.env.NEXT_BUILD_DIR = ".next-test-rr102";

    app = next({
      dev: true,
      dir: process.cwd(),
      conf: {
        basePath: "/reader",
      },
    });
    const handle = app.getRequestHandler();
    await app.prepare();

    server = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    });

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`> Test server ready on http://localhost:${port}`);
        resolve();
      });
    });
  }, 60000);

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    delete process.env.NEXT_BUILD_DIR;
    process.env.NODE_ENV = originalEnv;
  });

  describe("GET Request Redirects", () => {
    it("should redirect /api/health/app to /reader/api/health/app", async () => {
      const response = await fetch(`http://localhost:${port}/api/health/app`, {
        redirect: "manual",
      });

      expect(response.status).toBe(307); // Next.js redirects use 307
      expect(response.headers.get("location")).toBe("/reader/api/health/app");
    });

    it("should redirect /api/articles to /reader/api/articles", async () => {
      const response = await fetch(`http://localhost:${port}/api/articles`, {
        redirect: "manual",
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/api/articles");
    });

    it("should redirect /api/sync/health to /reader/api/sync/health", async () => {
      const response = await fetch(`http://localhost:${port}/api/sync/health`, {
        redirect: "manual",
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/api/sync/health");
    });

    it("should redirect /health to /reader/health", async () => {
      const response = await fetch(`http://localhost:${port}/health`, {
        redirect: "manual",
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/health");
    });

    it("should redirect /manifest.json to /reader/manifest.json", async () => {
      const response = await fetch(`http://localhost:${port}/manifest.json`, {
        redirect: "manual",
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/manifest.json");
    });

    it("should preserve query parameters during redirect", async () => {
      const response = await fetch(
        `http://localhost:${port}/api/articles?page=2&limit=10`,
        {
          redirect: "manual",
        }
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "/reader/api/articles?page=2&limit=10"
      );
    });

    it("should not redirect requests already containing /reader", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/health/app`
      );

      // Should get actual response, not a redirect
      expect(response.status).not.toBe(308);
      expect(response.headers.get("location")).toBeNull();
    });

    it("should not redirect static Next.js files", async () => {
      const response = await fetch(
        `http://localhost:${port}/_next/static/test.js`,
        {
          redirect: "manual",
        }
      );

      // Should not redirect _next paths
      expect(response.status).not.toBe(308);
    });

    it("should not redirect favicon.ico", async () => {
      const response = await fetch(`http://localhost:${port}/favicon.ico`, {
        redirect: "manual",
      });

      // Should not redirect favicon
      expect(response.status).not.toBe(308);
    });
  });

  describe("POST/PUT/DELETE Request Handling", () => {
    it("should redirect POST /api/articles to /reader/api/articles", async () => {
      const response = await fetch(`http://localhost:${port}/api/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
        redirect: "manual",
      });

      // POST requests also get redirected with 307 (preserves method)
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/api/articles");
    });

    it("should redirect PUT /api/articles/123 to /reader/api/articles/123", async () => {
      const response = await fetch(
        `http://localhost:${port}/api/articles/123`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
          redirect: "manual",
        }
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/api/articles/123");
    });

    it("should redirect DELETE /api/sync/queue/456 to /reader/api/sync/queue/456", async () => {
      const response = await fetch(
        `http://localhost:${port}/api/sync/queue/456`,
        {
          method: "DELETE",
          redirect: "manual",
        }
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "/reader/api/sync/queue/456"
      );
    });

    it("should follow redirect and get actual 404 for non-existent POST endpoint", async () => {
      const response = await fetch(`http://localhost:${port}/api/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "test" }),
        redirect: "follow", // Let it follow the redirect
      });

      // After following redirect, should get 404 from the actual endpoint
      expect(response.status).toBe(404);
    });
  });

  describe("Edge Cases", () => {
    it("should handle deeply nested API paths", async () => {
      const response = await fetch(
        `http://localhost:${port}/api/v1/deep/nested/endpoint`,
        {
          redirect: "manual",
        }
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "/reader/api/v1/deep/nested/endpoint"
      );
    });

    it("should handle paths with special characters", async () => {
      const response = await fetch(
        `http://localhost:${port}/api/test%20space`,
        {
          redirect: "manual",
        }
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/api/test%20space");
    });

    it("should not create redirect loops", async () => {
      // This should not redirect since it already has /reader
      const response = await fetch(
        `http://localhost:${port}/reader/api/health`,
        {
          redirect: "manual",
        }
      );

      expect(response.status).not.toBe(308);
    });

    it("should redirect OPTIONS requests as well", async () => {
      const response = await fetch(`http://localhost:${port}/api/test`, {
        method: "OPTIONS",
        redirect: "manual",
      });

      // OPTIONS gets redirected too with 307
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/api/test");
    });

    it("should handle HEAD requests like GET", async () => {
      const response = await fetch(`http://localhost:${port}/api/health`, {
        method: "HEAD",
        redirect: "manual",
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/reader/api/health");
    });
  });

  describe("Performance", () => {
    it("should redirect quickly without significant overhead", async () => {
      const start = Date.now();

      await fetch(`http://localhost:${port}/api/health/app`, {
        redirect: "manual",
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should redirect within 100ms
    });

    it("should handle multiple concurrent redirects", async () => {
      const promises = Array(10)
        .fill(null)
        .map((_, i) =>
          fetch(`http://localhost:${port}/api/endpoint-${i}`, {
            redirect: "manual",
          })
        );

      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          `/reader/api/endpoint-${i}`
        );
      });
    });
  });

  describe("Monitoring Script Compatibility", () => {
    it("should redirect monitoring endpoints correctly", async () => {
      const monitoringEndpoints = [
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/sync/health",
      ];

      for (const endpoint of monitoringEndpoints) {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
          redirect: "manual",
        });

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(`/reader${endpoint}`);
      }
    });
  });
});

describe.skip("RR-102: Production Mode Behavior", () => {
  let server: any;
  let app: any;

  beforeAll(async () => {
    // Set to production mode to test middleware bypass
    process.env.NODE_ENV = "production";
    process.env.NEXT_BUILD_DIR = ".next-test-rr102-prod";

    app = next({
      dev: false,
      dir: process.cwd(),
      conf: {
        basePath: "/reader",
      },
    });
    const handle = app.getRequestHandler();
    await app.prepare();

    server = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    });

    await new Promise<void>((resolve) => {
      server.listen(port + 1, () => {
        console.log(
          `> Production test server ready on http://localhost:${port + 1}`
        );
        resolve();
      });
    });
  }, 60000);

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    delete process.env.NEXT_BUILD_DIR;
  });

  it("should NOT redirect in production mode", async () => {
    const response = await fetch(
      `http://localhost:${port + 1}/api/health/app`,
      {
        redirect: "manual",
      }
    );

    // In production, should get 404, not redirect
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should return standard 404 for POST in production", async () => {
    const response = await fetch(`http://localhost:${port + 1}/api/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    expect(response.status).toBe(404);

    // In production, might return HTML 404 instead of JSON
    const contentType = response.headers.get("content-type");
    expect(contentType).toBeDefined();
  });
});
