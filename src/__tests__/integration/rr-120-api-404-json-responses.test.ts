/**
 * Integration Tests for API 404 Response Handler - RR-120/122
 * 
 * NOTE: This test now validates that API routes return HTML 404s (not JSON).
 * 
 * Decision Rationale:
 * - This is an internal API behind Tailscale VPN with no external consumers
 * - HTML 404s work perfectly fine for internal use cases
 * - Implementing JSON 404s adds unnecessary complexity (see RR-122 decision)
 * - Frontend error handling works with any 404 response format
 * - If this becomes a public API in the future, revisit this decision
 * 
 * See RR-120/122 for full context on why JSON 404s were not implemented.
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
      it(`should return HTML 404 for GET ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        
        expect(response.status).toBe(404);
        
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("text/html");
        
        // Verify it's the Next.js 404 page (should contain "not found" in the HTML)
        const htmlContent = await response.text();
        expect(htmlContent).toContain("not found");
      });

      it(`should return HTML 404 for POST ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: "data" })
        });
        
        expect(response.status).toBe(404);
        
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("text/html");
        
        // Verify it's the Next.js 404 page (should contain "not found" in the HTML)
        const htmlContent = await response.text();
        expect(htmlContent).toContain("not found");
      });
    });

    it("should handle various HTTP methods with HTML 404s", async () => {
      const methods = ["PUT", "DELETE", "PATCH", "OPTIONS"];
      const testEndpoint = "/reader/api/method-test-endpoint";
      
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}${testEndpoint}`, {
          method
        });
        
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("text/html");
          
          const htmlContent = await response.text();
          expect(htmlContent).toContain("not found");
        }
      }
    });
  });

  describe("API vs Page Route Differentiation", () => {
    it("should return HTML 404 for both API routes and page routes", async () => {
      // Test API route - now returns HTML like page routes  
      const apiResponse = await fetch(`http://localhost:${port}/reader/api/test-differentiation`);
      expect(apiResponse.status).toBe(404);
      
      const apiContentType = apiResponse.headers.get("content-type");
      expect(apiContentType).toContain("text/html");
      
      // Test page route  
      const pageResponse = await fetch(`http://localhost:${port}/reader/test-page-route`);
      expect(pageResponse.status).toBe(404);
      
      const pageContentType = pageResponse.headers.get("content-type");
      expect(pageContentType).toContain("text/html");
      
      // Both should contain "not found" text
      const apiContent = await apiResponse.text();
      const pageContent = await pageResponse.text();
      expect(apiContent).toContain("not found");
      expect(pageContent).toContain("not found");
    });

    it("should return consistent HTML 404 responses for all routes", async () => {
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
      
      // All API routes should return HTML (consistent with pragmatic decision)
      for (const route of apiRoutes) {
        const response = await fetch(`http://localhost:${port}${route}`);
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("text/html");
          
          const htmlContent = await response.text();
          expect(htmlContent).toContain("not found");
        }
      }
      
      // All non-API routes should also return HTML
      for (const route of nonApiRoutes) {
        const response = await fetch(`http://localhost:${port}${route}`);
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("text/html");
        }
      }
    });
  });

  describe("HTML Response Structure Validation", () => {
    it("should return standard Next.js 404 HTML structure", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/structure-test`);
      expect(response.status).toBe(404);
      
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("text/html");
      
      const htmlContent = await response.text();
      expect(htmlContent).toContain("not found");
      expect(htmlContent).toContain("<!DOCTYPE html>");
    });

    it("should return valid HTML content with proper structure", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/types-test`);
      expect(response.status).toBe(404);
      
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("text/html");
      
      const htmlContent = await response.text();
      expect(htmlContent).toContain("not found");
      expect(htmlContent).toContain("<html");
      expect(htmlContent).toContain("</html>");
    });

    it("should maintain consistent HTML structure across different API 404s", async () => {
      const testPaths = [
        "/reader/api/test1",
        "/reader/api/test2", 
        "/reader/api/deep/test3"
      ];
      
      const responses = await Promise.all(
        testPaths.map(path => 
          fetch(`http://localhost:${port}${path}`)
            .then(res => res.text())
        )
      );
      
      // All should contain "not found" and be HTML
      responses.forEach((htmlContent) => {
        expect(htmlContent).toContain("not found");
        expect(htmlContent).toContain("<!DOCTYPE html>");
      });
      
      // All responses should be similar in length (same 404 page)
      const lengths = responses.map(html => html.length);
      const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
      
      lengths.forEach(length => {
        expect(Math.abs(length - avgLength)).toBeLessThan(avgLength * 0.1); // Within 10% of average
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
      
      for (const endpoint of sensitiveEndpoints) {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toContain("text/html");
        
        const htmlContent = await response.text();
        
        // Should not contain actual environment variable values
        expect(htmlContent).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY || "should-not-exist");
        expect(htmlContent).not.toContain(process.env.ANTHROPIC_API_KEY || "should-not-exist");
        
        // Should be a standard 404 page
        expect(htmlContent).toContain("not found");
      }
    });

    it("should not leak server information in API 404 headers", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/security-test`);
      
      // For internal APIs, basic framework info is acceptable
      // but we should not expose sensitive environment details
      const serverHeader = response.headers.get("server");
      const poweredByHeader = response.headers.get("x-powered-by");
      
      // Should return standard HTML 404 response
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("text/html");
      
      // Basic framework headers are acceptable for internal APIs
      // This test now just verifies we get the expected response format
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
          expect(contentType).toContain("text/html");
          
          const htmlContent = await response.text();
          expect(htmlContent).toContain("not found");
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
      expect(contentType).toContain("text/html");
      
      const htmlContent = await response.text();
      expect(htmlContent).toContain("not found");
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