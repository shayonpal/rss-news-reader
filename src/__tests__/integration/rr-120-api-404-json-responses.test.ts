/**
 * Integration Tests for API 404 JSON Response Handler - RR-120 Issue 3
 * Tests that API routes return JSON 404 responses instead of HTML
 * 
 * This test is designed to FAIL initially (red phase) since the custom 404 handler 
 * for API routes hasn't been implemented yet.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const port = 3151; // Use unique port for this test suite

describe("API 404 JSON Response Handler - RR-120", () => {
  let server: any;
  let app: any;

  beforeAll(async () => {
    // Set environment variable to use separate build directory
    process.env.NEXT_BUILD_DIR = '.next-test';
    
    // Start Next.js server for testing
    app = next({ 
      dev, 
      dir: process.cwd(), 
      conf: { 
        basePath: '/reader'
      } 
    });
    const handle = app.getRequestHandler();
    await app.prepare();

    server = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    });

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`> RR-120 Test server ready on http://localhost:${port}`);
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    delete process.env.NEXT_BUILD_DIR;
  });

  describe("API 404 JSON Format Requirements", () => {
    const testEndpoints = [
      "/reader/api/non-existent-endpoint",
      "/reader/api/removed/test-endpoint", 
      "/reader/api/fake/deep/nested/endpoint",
      "/reader/api/debug/removed-functionality",
      "/reader/api/articles/invalid-id/non-existent-action"
    ];

    testEndpoints.forEach((endpoint) => {
      it(`should return JSON 404 with correct structure for GET ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        
        expect(response.status).toBe(404);
        
        // SHOULD return JSON content type (currently fails - returns HTML)
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("application/json");
        
        const data = await response.json();
        
        // Should match exact structure required by RR-120
        expect(data).toEqual({
          error: "Not Found",
          status: 404,
          path: endpoint
        });
      });

      it(`should return JSON 404 with correct structure for POST ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: "data" })
        });
        
        expect(response.status).toBe(404);
        
        // SHOULD return JSON content type (currently fails - returns HTML)
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("application/json");
        
        const data = await response.json();
        
        expect(data).toEqual({
          error: "Not Found", 
          status: 404,
          path: endpoint
        });
      });
    });

    it("should handle various HTTP methods with JSON 404s", async () => {
      const methods = ["PUT", "DELETE", "PATCH", "OPTIONS"];
      const testEndpoint = "/reader/api/method-test-endpoint";
      
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}${testEndpoint}`, {
          method
        });
        
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("application/json");
          
          const data = await response.json();
          expect(data).toEqual({
            error: "Not Found",
            status: 404,
            path: testEndpoint
          });
        }
      }
    });
  });

  describe("API vs Page Route Differentiation", () => {
    it("should return JSON 404 for API routes but HTML 404 for page routes", async () => {
      // Test API route
      const apiResponse = await fetch(`http://localhost:${port}/reader/api/test-differentiation`);
      expect(apiResponse.status).toBe(404);
      
      const apiContentType = apiResponse.headers.get("content-type");
      expect(apiContentType).toContain("application/json");
      
      // Test page route  
      const pageResponse = await fetch(`http://localhost:${port}/reader/test-page-route`);
      expect(pageResponse.status).toBe(404);
      
      const pageContentType = pageResponse.headers.get("content-type");
      expect(pageContentType).toContain("text/html");
    });

    it("should correctly identify API routes vs other routes", async () => {
      const apiRoutes = [
        "/reader/api/anything",
        "/reader/api/nested/path",
        "/reader/api/deep/nested/path"
      ];
      
      const nonApiRoutes = [
        "/reader/page",
        "/reader/some/page", 
        "/reader/nested/page/path"
      ];
      
      // All API routes should return JSON
      for (const route of apiRoutes) {
        const response = await fetch(`http://localhost:${port}${route}`);
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("application/json");
        }
      }
      
      // All non-API routes should return HTML
      for (const route of nonApiRoutes) {
        const response = await fetch(`http://localhost:${port}${route}`);
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("text/html");
        }
      }
    });
  });

  describe("JSON Response Structure Validation", () => {
    it("should return exactly 3 fields in API 404 response", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/structure-test`);
      expect(response.status).toBe(404);
      
      const data = await response.json();
      const fields = Object.keys(data);
      
      expect(fields).toHaveLength(3);
      expect(fields.sort()).toEqual(["error", "path", "status"]);
    });

    it("should have correct data types for each field", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/types-test`);
      const data = await response.json();
      
      expect(typeof data.error).toBe("string");
      expect(typeof data.status).toBe("number");
      expect(typeof data.path).toBe("string");
      
      expect(data.error).toBe("Not Found");
      expect(data.status).toBe(404);
      expect(data.path).toBe("/reader/api/types-test");
    });

    it("should maintain consistent structure across different API 404s", async () => {
      const testPaths = [
        "/reader/api/test1",
        "/reader/api/test2", 
        "/reader/api/deep/test3"
      ];
      
      const responses = await Promise.all(
        testPaths.map(path => 
          fetch(`http://localhost:${port}${path}`)
            .then(res => res.json())
        )
      );
      
      // All should have same structure
      responses.forEach((data, index) => {
        expect(data).toEqual({
          error: "Not Found",
          status: 404,
          path: testPaths[index]
        });
      });
    });
  });

  describe("Security Requirements", () => {
    it("should not expose sensitive information in API 404 responses", async () => {
      const sensitiveEndpoints = [
        "/reader/api/config/database",
        "/reader/api/internal/secrets",
        "/reader/api/debug/env-vars",
        "/reader/api/admin/private"
      ];
      
      const sensitiveTerms = [
        "supabase", "config", "secret", "key", "token", 
        "password", "database", "env", "internal", "debug"
      ];
      
      for (const endpoint of sensitiveEndpoints) {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        expect(response.status).toBe(404);
        
        const data = await response.json();
        const responseText = JSON.stringify(data).toLowerCase();
        
        // Should not contain sensitive information beyond the path
        sensitiveTerms.forEach(term => {
          // Allow the term if it's part of the requested path
          if (!endpoint.toLowerCase().includes(term)) {
            expect(responseText).not.toContain(term.toLowerCase());
          }
        });
      }
    });

    it("should not leak server information in API 404 headers", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/security-test`);
      
      // Should not expose server technology details
      const serverHeader = response.headers.get("server");
      const poweredByHeader = response.headers.get("x-powered-by");
      
      if (serverHeader) {
        expect(serverHeader).not.toMatch(/next|vercel|node/i);
      }
      if (poweredByHeader) {
        expect(poweredByHeader).not.toMatch(/next|vercel|node/i);
      }
    });
  });

  describe("Performance Requirements", () => {
    it("should respond to API 404s quickly", async () => {
      const start = Date.now();
      await fetch(`http://localhost:${port}/reader/api/performance-test`);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(500); // Should respond within 500ms
    });

    it("should handle concurrent API 404 requests efficiently", async () => {
      const promises = Array(20).fill(null).map((_, i) => 
        fetch(`http://localhost:${port}/reader/api/concurrent-test-${i}`)
      );
      
      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;
      
      responses.forEach(response => {
        expect(response.status).toBe(404);
      });
      
      expect(duration).toBeLessThan(2000); // All 20 requests in under 2 seconds
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed API paths correctly", async () => {
      const malformedPaths = [
        "/reader/api/",
        "/reader/api//double-slash",
        "/reader/api/%20spaces%20test",
        "/reader/api/unicode-test-📚",
        "/reader/api/very-very-very-long-endpoint-name-that-exceeds-normal-limits"
      ];
      
      for (const path of malformedPaths) {
        const response = await fetch(`http://localhost:${port}${path}`);
        
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("application/json");
          
          const data = await response.json();
          expect(data).toHaveProperty("error", "Not Found");
          expect(data).toHaveProperty("status", 404);
          expect(data).toHaveProperty("path");
        }
      }
    });

    it("should handle large request bodies on API 404 endpoints", async () => {
      const largeBody = JSON.stringify({
        data: "x".repeat(50000) // 50KB of data
      });

      const response = await fetch(`http://localhost:${port}/reader/api/large-body-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: largeBody
      });

      expect(response.status).toBe(404);
      
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
      
      const data = await response.json();
      expect(data).toEqual({
        error: "Not Found",
        status: 404,
        path: "/reader/api/large-body-test"
      });
    });
  });

  describe("HTTP Headers Validation", () => {
    it("should set appropriate cache headers for API 404s", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/cache-test`);
      
      const cacheControl = response.headers.get("cache-control");
      expect(cacheControl).toBeTruthy();
      
      // 404s should typically not be cached aggressively
      expect(cacheControl).toMatch(/no-cache|no-store|max-age=0/);
    });

    it("should include appropriate CORS headers if needed", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/cors-test`, {
        method: "OPTIONS"
      });
      
      // If CORS is enabled, headers should be present
      const corsOrigin = response.headers.get("access-control-allow-origin");
      if (corsOrigin) {
        expect(corsOrigin).toBeDefined();
      }
    });
  });
});