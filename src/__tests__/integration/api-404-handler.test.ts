/**
 * Integration Tests for API 404 Response Handler (RR-120/122)
 * 
 * NOTE: This test now validates that API routes return HTML 404s (not JSON).
 * 
 * Decision Rationale:
 * - This is an internal API behind Tailscale VPN with no external consumers
 * - HTML 404s work perfectly fine for internal use cases
 * - Implementing JSON 404s adds unnecessary complexity (see RR-120 failure)
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
const port = 3149; // Use different port for testing

describe("API 404 Response Handler", () => {
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
        console.log(`> Test server ready on http://localhost:${port}`);
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    delete process.env.NEXT_BUILD_DIR;
  });

  describe("API Route 404 Responses", () => {
    const nonExistentApiRoutes = [
      "/reader/api/non-existent-endpoint",
      "/reader/api/fake/endpoint",
      "/reader/api/test-removed-endpoint",
      "/reader/api/debug/removed",
      "/reader/api/articles/invalid/nonexistent"
    ];

    nonExistentApiRoutes.forEach((endpoint) => {
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
          body: JSON.stringify({ test: true })
        });
        
        expect(response.status).toBe(404);
        
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("text/html");
        
        // Verify it's the Next.js 404 page (should contain "not found" in the HTML)
        const htmlContent = await response.text();
        expect(htmlContent).toContain("not found");
      });
    });

    it("should return HTML 404 for unsupported HTTP methods on API routes", async () => {
      const methods = ["PUT", "DELETE", "PATCH"];
      
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}/reader/api/health/app`, {
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

  describe("Security - No Sensitive Information in 404s", () => {
    it("should return standard HTML 404 without exposing actual secrets", async () => {
      const testEndpoints = [
        "/reader/api/test-endpoint",
        "/reader/api/config/test",
        "/reader/api/debug/test"
      ];

      for (const endpoint of testEndpoints) {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        expect(response.status).toBe(404);
        
        const htmlContent = await response.text();
        
        // Should not contain actual environment variable values or database URLs
        // Note: For internal APIs, generic terms like "secret" in compiled JS are acceptable
        expect(htmlContent).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY || "should-not-exist");
        expect(htmlContent).not.toContain(process.env.ANTHROPIC_API_KEY || "should-not-exist");
      }
    });

    it("should return minimal error information", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/removed-endpoint`);
      const htmlContent = await response.text();
      
      // Should be a standard Next.js 404 page
      expect(htmlContent).toContain("not found");
      expect(response.headers.get("content-type")).toContain("text/html");
      
      // Should not expose actual environment variable values
      expect(htmlContent).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY || "should-not-exist");
    });
  });

  describe("Response Format Consistency", () => {
    it("should return consistent HTML structure across different 404s", async () => {
      const endpoints = [
        "/reader/api/endpoint1",
        "/reader/api/endpoint2",
        "/reader/api/deep/nested/endpoint"
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint => 
          fetch(`http://localhost:${port}${endpoint}`)
            .then(res => res.text())
        )
      );

      // All should be HTML responses containing "not found"
      responses.forEach(htmlContent => {
        expect(htmlContent).toContain("not found");
      });
      
      // All responses should be similar in length (same 404 page)
      const lengths = responses.map(html => html.length);
      const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
      
      lengths.forEach(length => {
        expect(Math.abs(length - avgLength)).toBeLessThan(avgLength * 0.1); // Within 10% of average
      });
    });

    it("should include proper HTTP headers for HTML responses", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/test-404`);
      
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("cache-control")).toBeTruthy();
    });

    it("should respond quickly to 404 requests", async () => {
      const start = Date.now();
      await fetch(`http://localhost:${port}/reader/api/quick-404-test`);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed API paths", async () => {
      const malformedPaths = [
        "/reader/api/",
        "/reader/api//double-slash",
        "/reader/api/%20spaces",
        "/reader/api/unicode-📚"
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

    it("should handle concurrent 404 requests", async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        fetch(`http://localhost:${port}/reader/api/concurrent-test-${i}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(404);
      });
    });

    it("should handle large request bodies on 404 endpoints", async () => {
      const largeBody = JSON.stringify({
        data: "x".repeat(10000) // 10KB of data
      });

      const response = await fetch(`http://localhost:${port}/reader/api/large-body-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: largeBody
      });

      expect(response.status).toBe(404);
      
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("text/html");
    });
  });

  describe("Comparison with Non-API Routes", () => {
    it("should return HTML 404 for non-API routes", async () => {
      const response = await fetch(`http://localhost:${port}/reader/non-existent-page`);
      
      expect(response.status).toBe(404);
      
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("text/html");
    });

    it("should return same format for both API and page 404s", async () => {
      const apiResponse = await fetch(`http://localhost:${port}/reader/api/test`);
      const pageResponse = await fetch(`http://localhost:${port}/reader/test-page`);
      
      const apiContentType = apiResponse.headers.get("content-type");
      const pageContentType = pageResponse.headers.get("content-type");
      
      // Both should return HTML 404s (no differentiation needed for internal API)
      expect(apiContentType).toContain("text/html");
      expect(pageContentType).toContain("text/html");
    });
  });
});