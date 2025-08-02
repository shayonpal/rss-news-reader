/**
 * Integration Tests for API 404 JSON Response Handler (RR-120)
 * Tests that API routes return JSON 404 responses instead of HTML
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const port = 3149; // Use different port for testing

describe("API 404 JSON Response Handler", () => {
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
      it(`should return JSON 404 for GET ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        
        expect(response.status).toBe(404);
        
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("application/json");
        
        const data = await response.json();
        expect(data).toMatchObject({
          error: "Not Found",
          status: 404,
          path: endpoint
        });
      });

      it(`should return JSON 404 for POST ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true })
        });
        
        expect(response.status).toBe(404);
        
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("application/json");
        
        const data = await response.json();
        expect(data).toMatchObject({
          error: "Not Found",
          status: 404,
          path: endpoint
        });
      });
    });

    it("should return JSON 404 for unsupported HTTP methods on API routes", async () => {
      const methods = ["PUT", "DELETE", "PATCH"];
      
      for (const method of methods) {
        const response = await fetch(`http://localhost:${port}/reader/api/health/app`, {
          method
        });
        
        if (response.status === 404) {
          const contentType = response.headers.get("content-type");
          expect(contentType).toContain("application/json");
          
          const data = await response.json();
          expect(data).toHaveProperty("error");
          expect(data).toHaveProperty("status", 404);
        }
      }
    });
  });

  describe("Security - No Sensitive Information in 404s", () => {
    const sensitiveTerms = [
      "supabase",
      "config",
      "debug", 
      "internal",
      "secret",
      "key",
      "token",
      "password",
      "database",
      "env"
    ];

    it("should not expose sensitive information in API 404 responses", async () => {
      const testEndpoints = [
        "/reader/api/test-supabase",
        "/reader/api/config/secret",
        "/reader/api/debug/internal"
      ];

      for (const endpoint of testEndpoints) {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        expect(response.status).toBe(404);
        
        const data = await response.json();
        const responseText = JSON.stringify(data).toLowerCase();
        
        sensitiveTerms.forEach(term => {
          expect(responseText).not.toContain(term.toLowerCase());
        });
      }
    });

    it("should return minimal error information", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/removed-endpoint`);
      const data = await response.json();
      
      // Should only contain basic error info
      const allowedFields = ["error", "status", "path", "message"];
      const actualFields = Object.keys(data);
      
      actualFields.forEach(field => {
        expect(allowedFields).toContain(field);
      });
    });
  });

  describe("Response Format Consistency", () => {
    it("should return consistent JSON structure across different 404s", async () => {
      const endpoints = [
        "/reader/api/endpoint1",
        "/reader/api/endpoint2",
        "/reader/api/deep/nested/endpoint"
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint => 
          fetch(`http://localhost:${port}${endpoint}`)
            .then(res => res.json())
        )
      );

      const structures = responses.map(data => Object.keys(data).sort());
      
      // All should have the same structure
      expect(structures.every(structure => 
        JSON.stringify(structure) === JSON.stringify(structures[0])
      )).toBe(true);
    });

    it("should include proper HTTP headers for JSON responses", async () => {
      const response = await fetch(`http://localhost:${port}/reader/api/test-404`);
      
      expect(response.headers.get("content-type")).toContain("application/json");
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
          expect(contentType).toContain("application/json");
          
          const data = await response.json();
          expect(data).toHaveProperty("error");
          expect(data).toHaveProperty("status", 404);
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
      expect(contentType).toContain("application/json");
    });
  });

  describe("Comparison with Non-API Routes", () => {
    it("should return HTML 404 for non-API routes", async () => {
      const response = await fetch(`http://localhost:${port}/reader/non-existent-page`);
      
      expect(response.status).toBe(404);
      
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("text/html");
    });

    it("should differentiate between API and page 404s", async () => {
      const apiResponse = await fetch(`http://localhost:${port}/reader/api/test`);
      const pageResponse = await fetch(`http://localhost:${port}/reader/test-page`);
      
      const apiContentType = apiResponse.headers.get("content-type");
      const pageContentType = pageResponse.headers.get("content-type");
      
      expect(apiContentType).toContain("application/json");
      expect(pageContentType).toContain("text/html");
    });
  });
});